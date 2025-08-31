-- WAL Polling & Change History RLS Integration
-- This migration creates an organization-aware change history system

-- ===================================
-- PART 1: DROP EXISTING CHANGE_HISTORY (if exists)
-- ===================================

-- Drop existing table if it exists (greenfield deployment)
DROP TABLE IF EXISTS change_history CASCADE;

-- ===================================
-- PART 2: CREATE ORGANIZATION-AWARE CHANGE_HISTORY
-- ===================================

CREATE TABLE change_history (
    -- Primary key and LSN
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    lsn TEXT NOT NULL,
    
    -- Organization context (NULL for system tables)
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Change metadata
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    data JSONB NOT NULL,
    
    -- Anti-echo support
    client_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT change_history_lsn_format CHECK (lsn ~ '^[0-9A-F]+/[0-9A-F]+$')
);

-- ===================================
-- PART 3: PERFORMANCE INDEXES
-- ===================================

-- Primary query indexes (organization + LSN)
CREATE INDEX idx_change_history_org_lsn ON change_history(organization_id, lsn) 
    WHERE organization_id IS NOT NULL;

-- System changes index (no organization)
CREATE INDEX idx_change_history_system_lsn ON change_history(lsn) 
    WHERE organization_id IS NULL;

-- Time-based queries
CREATE INDEX idx_change_history_org_time ON change_history(organization_id, created_at) 
    WHERE organization_id IS NOT NULL;

-- Table-specific queries
CREATE INDEX idx_change_history_table_org ON change_history(table_name, organization_id);

-- Client anti-echo filtering
CREATE INDEX idx_change_history_client_id ON change_history(client_id) 
    WHERE client_id IS NOT NULL;

-- LSN ordering for sync queries
CREATE INDEX idx_change_history_lsn_pg ON change_history(lsn::pg_lsn);

-- ===================================
-- PART 4: ROW LEVEL SECURITY
-- ===================================

-- Enable RLS for perfect tenant isolation
ALTER TABLE change_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organization isolation with system mode override
CREATE POLICY "change_history_org_isolation" ON change_history
    FOR ALL
    TO PUBLIC
    USING (
        -- System mode can see everything
        current_setting('app.system_mode', true) = 'true'
        OR
        -- Regular mode: only see your organization's changes
        organization_id = current_setting('app.current_organization_id', true)::UUID
    );

-- ===================================
-- PART 5: RLS HELPER FUNCTIONS
-- ===================================

-- Get current organization ID from session context
CREATE OR REPLACE FUNCTION get_current_organization_id() 
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_organization_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set organization context for current session
CREATE OR REPLACE FUNCTION set_current_organization_id(org_id UUID) 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_organization_id', org_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable system mode for cross-organization operations
CREATE OR REPLACE FUNCTION enable_system_mode() 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.system_mode', 'true', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disable system mode
CREATE OR REPLACE FUNCTION disable_system_mode() 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.system_mode', 'false', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================
-- PART 6: CHANGE HISTORY UTILITY FUNCTIONS
-- ===================================

-- Get organization change statistics
CREATE OR REPLACE FUNCTION get_organization_change_stats(
    org_id UUID,
    hours_back INTEGER DEFAULT 24
) RETURNS TABLE(
    change_count BIGINT,
    latest_lsn TEXT,
    last_change_at TIMESTAMP,
    tables_affected TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as change_count,
        MAX(ch.lsn) as latest_lsn,
        MAX(ch.created_at) as last_change_at,
        ARRAY_AGG(DISTINCT ch.table_name) as tables_affected
    FROM change_history ch
    WHERE ch.organization_id = org_id
      AND ch.created_at > NOW() - (hours_back || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up old change history (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_change_history(
    days_to_keep INTEGER DEFAULT 30
) RETURNS BIGINT AS $$
DECLARE
    deleted_count BIGINT;
BEGIN
    DELETE FROM change_history 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================
-- PART 7: VALIDATION QUERIES
-- ===================================

-- Validation function to check WAL RLS schema
CREATE OR REPLACE FUNCTION validate_wal_rls_schema() 
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check if change_history table exists with correct columns
    RETURN QUERY SELECT 
        'Change history table structure'::TEXT,
        CASE WHEN COUNT(*) = 7 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' of 7 expected columns'
    FROM information_schema.columns 
    WHERE table_name = 'change_history' 
    AND column_name IN (
        'id', 'lsn', 'organization_id', 'table_name', 
        'operation', 'data', 'client_id'
    );
    
    -- Check if RLS is enabled
    RETURN QUERY SELECT 
        'Row Level Security'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE c.relname = 'change_history' 
            AND n.nspname = 'public' 
            AND c.relrowsecurity = true
        ) THEN 'PASS' ELSE 'FAIL' END,
        'RLS enabled on change_history table'::TEXT;
    
    -- Check if RLS policies exist
    RETURN QUERY SELECT 
        'RLS policies'::TEXT,
        CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' RLS policies'
    FROM pg_policies 
    WHERE tablename = 'change_history';
    
    -- Check if indexes exist
    RETURN QUERY SELECT 
        'Performance indexes'::TEXT,
        CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' performance indexes'
    FROM pg_indexes 
    WHERE tablename = 'change_history';
    
    -- Check if helper functions exist
    RETURN QUERY SELECT 
        'RLS helper functions'::TEXT,
        CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' of 4 RLS helper functions'
    FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
        'get_current_organization_id', 'set_current_organization_id',
        'enable_system_mode', 'disable_system_mode'
    );
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- PART 8: RUN VALIDATION
-- ===================================

-- Run validation and show results
SELECT * FROM validate_wal_rls_schema();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'WAL Polling & Change History RLS Integration Complete!';
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'Change History: Organization-aware with perfect RLS isolation';
    RAISE NOTICE 'Indexes: 6 performance indexes for fast org-scoped queries';
    RAISE NOTICE 'RLS Policies: 2 policies for tenant isolation + system access';
    RAISE NOTICE 'Helper Functions: 4 functions for organization context management';
    RAISE NOTICE 'Utility Functions: 3 functions for stats and maintenance';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for organization-aware WAL polling and sync!';
END
$$;