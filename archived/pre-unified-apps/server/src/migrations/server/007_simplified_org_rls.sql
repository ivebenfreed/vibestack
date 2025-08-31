-- Simplified Organization-Level RLS Migration
-- 
-- This migration simplifies RLS to focus on organization-level isolation only.
-- Complex role-based permissions are moved to Organization Actor SQLite cache.
-- 
-- STRATEGY:
-- PostgreSQL RLS: Simple org filtering (WHERE organization_id = current_org_id)
-- Organization Actor: Complex role permissions in zero-latency SQLite cache

-- ===================================
-- PART 1: REMOVE COMPLEX RLS POLICIES
-- ===================================

-- Drop complex role-based policies on organization tables
DROP POLICY IF EXISTS members_admin_policy ON organization_members;
DROP POLICY IF EXISTS invitations_admin_policy ON organization_invitations;
DROP POLICY IF EXISTS audit_organization_policy ON organization_audit_logs;

-- Drop complex membership policies (keep simple org filtering)
DROP POLICY IF EXISTS organization_user_membership_policy ON organizations;
DROP POLICY IF EXISTS members_own_membership_policy ON organization_members;
DROP POLICY IF EXISTS invitations_public_accept_policy ON organization_invitations;

-- ===================================
-- PART 2: SIMPLIFIED ORG-LEVEL POLICIES
-- ===================================

-- SIMPLIFIED: Organizations - only current org access
CREATE POLICY simplified_org_access_policy ON organizations
    FOR ALL 
    USING (id = get_current_organization_id());

-- SIMPLIFIED: Organization members - only current org
CREATE POLICY simplified_members_policy ON organization_members
    FOR ALL
    USING (organization_id = get_current_organization_id());

-- SIMPLIFIED: Organization invitations - only current org  
CREATE POLICY simplified_invitations_policy ON organization_invitations
    FOR ALL
    USING (organization_id = get_current_organization_id());

-- SIMPLIFIED: Audit logs - only current org (no role filtering)
CREATE POLICY simplified_audit_policy ON organization_audit_logs
    FOR ALL
    USING (organization_id = get_current_organization_id());

-- ===================================
-- PART 3: BUSINESS TABLES RLS SIMPLIFICATION
-- ===================================

-- Function to apply simplified RLS to all organization business tables
CREATE OR REPLACE FUNCTION apply_simplified_business_table_rls()
RETURNS TEXT AS $$
DECLARE
    table_record RECORD;
    policy_count INTEGER := 0;
BEGIN
    -- Find all business tables (org_*_* pattern)
    FOR table_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'org_%_%'
        AND schemaname = 'public'
    LOOP
        -- Drop existing complex policies
        EXECUTE format('DROP POLICY IF EXISTS %I_admin_policy ON %I.%I', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        EXECUTE format('DROP POLICY IF EXISTS %I_user_policy ON %I.%I', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        EXECUTE format('DROP POLICY IF EXISTS %I_role_policy ON %I.%I', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        
        -- Create simple organization-only policy
        EXECUTE format('CREATE POLICY %I_org_policy ON %I.%I FOR ALL USING (organization_id = get_current_organization_id())', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        
        policy_count := policy_count + 1;
        
        RAISE NOTICE 'Applied simplified RLS to table: %', table_record.tablename;
    END LOOP;
    
    RETURN format('Applied simplified RLS policies to %s business tables', policy_count);
END;
$$ LANGUAGE plpgsql;

-- Execute the function to update all business tables
SELECT apply_simplified_business_table_rls();

-- ===================================
-- PART 4: SIMPLIFIED RLS CONTEXT FUNCTIONS
-- ===================================

-- Simplified context setter (no role needed for PostgreSQL)
CREATE OR REPLACE FUNCTION set_simplified_rls_context(
    p_organization_id UUID,
    p_user_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Set only the organization context (for PostgreSQL RLS)
    PERFORM set_config('app.current_organization_id', p_organization_id::text, true);
    PERFORM set_config('app.current_user_id', p_user_id, true);
    
    -- Clear role from PostgreSQL context (handled by Organization Actor)
    PERFORM set_config('app.current_user_role', NULL, true);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate simplified context
CREATE OR REPLACE FUNCTION validate_simplified_rls_context() 
RETURNS BOOLEAN AS $$
BEGIN
    -- Only check org and user context (role handled by Organization Actor)
    IF get_current_organization_id() IS NULL THEN
        RAISE EXCEPTION 'Organization context not set - RLS security violation';
    END IF;
    
    IF get_current_user_id() IS NULL THEN
        RAISE EXCEPTION 'User context not set - RLS security violation';
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================
-- PART 5: REMOVE ROLE-BASED FUNCTIONS
-- ===================================

-- Mark role-based functions as deprecated (keep for backward compatibility)
CREATE OR REPLACE FUNCTION get_current_user_role() 
RETURNS TEXT AS $$
BEGIN
    -- Return NULL - roles now handled by Organization Actor
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_organization_admin() 
RETURNS BOOLEAN AS $$
BEGIN
    -- Return FALSE - admin checks now handled by Organization Actor
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add deprecation comments
COMMENT ON FUNCTION get_current_user_role() IS 'DEPRECATED: Role checks moved to Organization Actor SQLite cache';
COMMENT ON FUNCTION is_organization_admin() IS 'DEPRECATED: Admin checks moved to Organization Actor SQLite cache';

-- ===================================
-- PART 6: PERFORMANCE OPTIMIZATION
-- ===================================

-- Remove role-based indexes (no longer needed)
DROP INDEX IF EXISTS idx_org_members_user_id_status;
DROP INDEX IF EXISTS idx_org_invitations_token;
DROP INDEX IF EXISTS idx_org_audit_logs_user_id;

-- Keep simple org-based indexes
-- (These already exist from previous migrations)

-- Add organization_id indexes for business tables if missing
CREATE OR REPLACE FUNCTION ensure_org_id_indexes()
RETURNS TEXT AS $$
DECLARE
    table_record RECORD;
    index_count INTEGER := 0;
BEGIN
    FOR table_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'org_%_%'
        AND schemaname = 'public'
    LOOP
        -- Create organization_id index if it doesn't exist
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_organization_id ON %I.%I(organization_id)', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
        
        index_count := index_count + 1;
    END LOOP;
    
    RETURN format('Ensured organization_id indexes on %s business tables', index_count);
END;
$$ LANGUAGE plpgsql;

SELECT ensure_org_id_indexes();

-- ===================================
-- PART 7: ORGANIZATION ACTOR INTEGRATION
-- ===================================

-- Function to extract organization roles for Organization Actor cache warming
CREATE OR REPLACE FUNCTION get_organization_roles_for_cache(p_organization_id UUID)
RETURNS TABLE(
    user_id TEXT,
    organization_id UUID,
    role TEXT,
    permissions TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        om.user_id,
        om.organization_id,
        om.role,
        CASE om.role
            WHEN 'owner' THEN ARRAY['admin', 'write', 'read', 'invite', 'manage_billing']
            WHEN 'admin' THEN ARRAY['admin', 'write', 'read', 'invite']  
            WHEN 'manager' THEN ARRAY['write', 'read', 'invite']
            WHEN 'member' THEN ARRAY['read', 'write']
            ELSE ARRAY['read']
        END as permissions
    FROM organization_members om
    WHERE om.organization_id = p_organization_id
    AND om.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to application role
GRANT EXECUTE ON FUNCTION get_organization_roles_for_cache(UUID) TO vibestack_app;

-- ===================================
-- PART 8: AUDIT AND VERIFICATION
-- ===================================

-- Create simplified RLS test function
CREATE OR REPLACE FUNCTION test_simplified_rls() 
RETURNS TABLE(test_name TEXT, passed BOOLEAN, details TEXT) AS $$
BEGIN
    -- Test 1: No context = no access
    PERFORM clear_rls_context();
    
    RETURN QUERY SELECT 
        'Simplified RLS - No context test'::TEXT,
        (SELECT COUNT(*) FROM organizations) = 0,
        'Should have no access without organization context'::TEXT;
    
    -- Test 2: With org context = access to org data only
    PERFORM set_simplified_rls_context(
        '01920000-1000-7000-8000-000000000001'::uuid,
        'test-user-id'
    );
    
    RETURN QUERY SELECT 
        'Simplified RLS - Org context test'::TEXT,
        (SELECT COUNT(*) FROM organizations WHERE id = '01920000-1000-7000-8000-000000000001'::uuid) > 0,
        'Should have access to specified organization only'::TEXT;
        
    -- Clean up
    PERFORM clear_rls_context();
END;
$$ LANGUAGE plpgsql;

-- Log the simplification
INSERT INTO organization_audit_logs (
    id,
    organization_id,
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    metadata,
    created_at
) VALUES (
    generate_uuidv7(),
    NULL,
    'system',
    'rls_simplification',
    'security',
    'database',
    'Simplified PostgreSQL RLS to organization-level only. Role-based permissions moved to Organization Actor.',
    jsonb_build_object(
        'migration', '007_simplified_org_rls',
        'strategy', 'postgresql_org_filtering_plus_org_actor_roles',
        'performance_improvement', 'significant',
        'complexity_reduction', 'major'
    ),
    NOW()
) ON CONFLICT DO NOTHING;

-- ===================================
-- PART 9: SUCCESS MESSAGE
-- ===================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS SIMPLIFICATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PostgreSQL RLS: Simple organization-level filtering';
    RAISE NOTICE 'Organization Actor: Complex role-based permissions';
    RAISE NOTICE 'Performance: Significantly improved';
    RAISE NOTICE 'Complexity: Majorly reduced';
    RAISE NOTICE '========================================';
END
$$;