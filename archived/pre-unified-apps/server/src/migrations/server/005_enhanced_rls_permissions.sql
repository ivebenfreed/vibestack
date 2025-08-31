-- Enhanced RLS Implementation for Fine-Grained Access Control
-- This extends the basic RLS to support our permission hierarchy

-- ===================================
-- PART 1: ENHANCED RLS CONTEXT FUNCTIONS
-- ===================================

-- Function to get user's effective role for the current organization
-- This checks the permission hierarchy: project -> department -> organization -> system
CREATE OR REPLACE FUNCTION get_user_effective_role() 
RETURNS TEXT AS $$
DECLARE
    user_id TEXT;
    org_id TEXT;
    highest_role TEXT := 'none';
    role_levels INTEGER := 0;
BEGIN
    -- Get current context
    user_id := current_setting('app.current_user_id', true);
    org_id := current_setting('app.current_organization_id', true);
    
    IF user_id IS NULL OR org_id IS NULL THEN
        RETURN 'none';
    END IF;
    
    -- Define role hierarchy levels (higher number = more permissions)
    -- none: 0, viewer: 1, member: 2, contributor: 2, manager: 3, admin: 4, owner: 5
    
    -- Check system-level permissions first (highest priority)
    SELECT 
        CASE role
            WHEN 'owner' THEN 5
            WHEN 'admin' THEN 4  
            WHEN 'manager' THEN 3
            WHEN 'member' THEN 2
            WHEN 'contributor' THEN 2
            WHEN 'viewer' THEN 1
            ELSE 0
        END
    INTO role_levels
    FROM container_permission 
    WHERE user_id = get_user_effective_role.user_id
      AND permission_container_type = 'system'
      AND permission_container_id = 'global'
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY 
        CASE role
            WHEN 'owner' THEN 5
            WHEN 'admin' THEN 4
            WHEN 'manager' THEN 3  
            WHEN 'member' THEN 2
            WHEN 'contributor' THEN 2
            WHEN 'viewer' THEN 1
            ELSE 0
        END DESC
    LIMIT 1;
    
    -- If system role found, return it
    IF role_levels > 0 THEN
        SELECT role INTO highest_role
        FROM container_permission 
        WHERE user_id = get_user_effective_role.user_id
          AND permission_container_type = 'system'
          AND permission_container_id = 'global'
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY 
            CASE role
                WHEN 'owner' THEN 5
                WHEN 'admin' THEN 4
                WHEN 'manager' THEN 3
                WHEN 'member' THEN 2
                WHEN 'contributor' THEN 2
                WHEN 'viewer' THEN 1
                ELSE 0
            END DESC
        LIMIT 1;
        
        RETURN highest_role;
    END IF;
    
    -- Check organization-level permissions
    SELECT 
        CASE role
            WHEN 'owner' THEN 5
            WHEN 'admin' THEN 4
            WHEN 'manager' THEN 3
            WHEN 'member' THEN 2
            WHEN 'contributor' THEN 2
            WHEN 'viewer' THEN 1
            ELSE 0
        END
    INTO role_levels
    FROM container_permission 
    WHERE user_id = get_user_effective_role.user_id
      AND permission_container_type = 'organization'
      AND permission_container_id = org_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY 
        CASE role
            WHEN 'owner' THEN 5
            WHEN 'admin' THEN 4
            WHEN 'manager' THEN 3
            WHEN 'member' THEN 2
            WHEN 'contributor' THEN 2
            WHEN 'viewer' THEN 1
            ELSE 0
        END DESC
    LIMIT 1;
    
    -- If org role found, return it
    IF role_levels > 0 THEN
        SELECT role INTO highest_role
        FROM container_permission 
        WHERE user_id = get_user_effective_role.user_id
          AND permission_container_type = 'organization'
          AND permission_container_id = org_id
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY 
            CASE role
                WHEN 'owner' THEN 5
                WHEN 'admin' THEN 4
                WHEN 'manager' THEN 3
                WHEN 'member' THEN 2
                WHEN 'contributor' THEN 2
                WHEN 'viewer' THEN 1
                ELSE 0
            END DESC
        LIMIT 1;
        
        RETURN highest_role;
    END IF;
    
    -- Fall back to organization membership role
    SELECT role INTO highest_role
    FROM organization_members 
    WHERE user_id = get_user_effective_role.user_id
      AND organization_id = org_id;
    
    RETURN COALESCE(highest_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper functions for permission checks
CREATE OR REPLACE FUNCTION user_can_read() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_effective_role() IN ('viewer', 'member', 'contributor', 'manager', 'admin', 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_can_write() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_effective_role() IN ('member', 'contributor', 'manager', 'admin', 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_can_manage() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_effective_role() IN ('manager', 'admin', 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_can_administer() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_effective_role() IN ('admin', 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================
-- PART 2: APPLY RLS TO ENTITY TABLES
-- ===================================

-- Enable RLS on entity_schemas (controls who can manage schemas)
ALTER TABLE entity_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_schemas FORCE ROW LEVEL SECURITY;

-- Schema management policy - only admins can modify entity schemas
CREATE POLICY entity_schemas_read_policy ON entity_schemas
    FOR SELECT
    USING (
        -- User can read schemas if they can read data in this org
        user_can_read() AND 
        org_id = get_current_organization_id()::text
    );

CREATE POLICY entity_schemas_write_policy ON entity_schemas  
    FOR INSERT
    WITH CHECK (
        -- Only admins can create new entity schemas
        user_can_administer() AND
        org_id = get_current_organization_id()::text
    );

CREATE POLICY entity_schemas_update_policy ON entity_schemas
    FOR UPDATE
    USING (
        -- Only admins can modify entity schemas
        user_can_administer() AND
        org_id = get_current_organization_id()::text
    );

CREATE POLICY entity_schemas_delete_policy ON entity_schemas
    FOR DELETE
    USING (
        -- Only admins can delete entity schemas  
        user_can_administer() AND
        org_id = get_current_organization_id()::text
    );

-- ===================================
-- PART 3: DYNAMIC ENTITY TABLE RLS
-- ===================================

-- Function to apply RLS policies to dynamically created entity tables
CREATE OR REPLACE FUNCTION apply_entity_table_rls(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Enable RLS on the table
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    
    -- Read policy - users can read data in their org if they have read permissions
    EXECUTE format('
        CREATE POLICY %I_read_policy ON %I
        FOR SELECT
        USING (
            user_can_read() AND 
            organization_id = get_current_organization_id()
        )',
        table_name || '_read', table_name
    );
    
    -- Write policy - users can insert data if they have write permissions
    EXECUTE format('
        CREATE POLICY %I_insert_policy ON %I  
        FOR INSERT
        WITH CHECK (
            user_can_write() AND
            organization_id = get_current_organization_id()
        )',
        table_name || '_insert', table_name
    );
    
    -- Update policy - users can update data if they have write permissions
    EXECUTE format('
        CREATE POLICY %I_update_policy ON %I
        FOR UPDATE
        USING (
            user_can_write() AND
            organization_id = get_current_organization_id()
        )
        WITH CHECK (
            user_can_write() AND
            organization_id = get_current_organization_id()
        )',
        table_name || '_update', table_name
    );
    
    -- Delete policy - only managers can delete data
    EXECUTE format('
        CREATE POLICY %I_delete_policy ON %I
        FOR DELETE
        USING (
            user_can_manage() AND
            organization_id = get_current_organization_id()
        )',
        table_name || '_delete', table_name
    );
    
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- PART 4: SYSTEM TABLE PERMISSIONS
-- ===================================

-- container_permission table - users can read their own permissions (conditional creation)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'container_permission' AND policyname = 'container_permission_read_policy') THEN
        CREATE POLICY container_permission_read_policy ON container_permission
            FOR SELECT
            USING (
                user_id = get_current_user_id() OR
                user_can_administer()
            );
    END IF;
END $$;

-- Only admins can modify permissions (conditional creation)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'container_permission' AND policyname = 'container_permission_admin_policy') THEN
        CREATE POLICY container_permission_admin_policy ON container_permission
            FOR ALL
            USING (user_can_administer())
            WITH CHECK (user_can_administer());
    END IF;
END $$;

-- ===================================
-- PART 5: UTILITY FUNCTIONS
-- ===================================

-- Function to check if user has specific permission for operation
CREATE OR REPLACE FUNCTION check_user_permission(operation TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    CASE operation
        WHEN 'read' THEN
            RETURN user_can_read();
        WHEN 'write', 'create', 'update' THEN  
            RETURN user_can_write();
        WHEN 'delete', 'manage' THEN
            RETURN user_can_manage();
        WHEN 'administer', 'admin' THEN
            RETURN user_can_administer();
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's permission summary
CREATE OR REPLACE FUNCTION get_user_permissions()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'user_id', get_current_user_id(),
        'organization_id', get_current_organization_id(),
        'effective_role', get_user_effective_role(),
        'permissions', json_build_object(
            'can_read', user_can_read(),
            'can_write', user_can_write(), 
            'can_manage', user_can_manage(),
            'can_administer', user_can_administer()
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_effective_role() IS 'Gets the highest role for the current user in the current organization context';
COMMENT ON FUNCTION user_can_read() IS 'RLS helper - checks if user has read permissions';
COMMENT ON FUNCTION user_can_write() IS 'RLS helper - checks if user has write permissions';  
COMMENT ON FUNCTION user_can_manage() IS 'RLS helper - checks if user has manage permissions';
COMMENT ON FUNCTION user_can_administer() IS 'RLS helper - checks if user has admin permissions';
COMMENT ON FUNCTION apply_entity_table_rls(TEXT) IS 'Applies standard RLS policies to dynamically created entity tables';
COMMENT ON FUNCTION check_user_permission(TEXT) IS 'Checks if user has permission for specific operation';
COMMENT ON FUNCTION get_user_permissions() IS 'Returns JSON summary of user permissions in current context';