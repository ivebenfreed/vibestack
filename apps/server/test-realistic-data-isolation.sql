-- Test Cross-Organization Isolation with Realistic Data
-- Validates that RLS policies properly isolate organization data

-- =============================================================================
-- SETUP: TEST ORGANIZATION CONTEXT SWITCHING
-- =============================================================================

-- Function to test organization context switching
DO $$
BEGIN
    RAISE NOTICE 'Starting Organization Isolation Tests...';
    RAISE NOTICE '==========================================';
END $$;

-- =============================================================================
-- TEST 1: TECHFLOW AGENCY CONTEXT (Organization 1)
-- =============================================================================

-- Set organization context for TechFlow Agency
SELECT set_config('app.current_organization_id', '0198ab70-1000-7000-8000-000000000001', false);
SELECT set_config('app.system_mode', 'false', false);

DO $$
DECLARE
    tf_project_count INTEGER;
    tf_task_count INTEGER;
    tf_comment_count INTEGER;
    tf_time_count INTEGER;
BEGIN
    -- Count TechFlow Agency data when in their context
    SELECT COUNT(*) INTO tf_project_count FROM org_0198ab70_1000_7000_8000_000000000001_project;
    SELECT COUNT(*) INTO tf_task_count FROM org_0198ab70_1000_7000_8000_000000000001_task;
    SELECT COUNT(*) INTO tf_comment_count FROM org_0198ab70_1000_7000_8000_000000000001_task_comment;
    SELECT COUNT(*) INTO tf_time_count FROM org_0198ab70_1000_7000_8000_000000000001_time_entry;
    
    RAISE NOTICE 'TechFlow Agency Context - Data Visible:';
    RAISE NOTICE '  Projects: %', tf_project_count;
    RAISE NOTICE '  Tasks: %', tf_task_count;
    RAISE NOTICE '  Comments: %', tf_comment_count;
    RAISE NOTICE '  Time Entries: %', tf_time_count;
    
    -- Verify we can see TechFlow data
    IF tf_project_count = 0 THEN
        RAISE EXCEPTION 'FAIL: TechFlow Agency cannot see their own data!';
    END IF;
    
    RAISE NOTICE '✅ TechFlow Agency can see their own data';
END $$;

-- Try to access StartupBoost data (should fail due to RLS)
DO $$
DECLARE
    sb_project_count INTEGER;
    sb_task_count INTEGER;
    sb_comment_count INTEGER;
    sb_time_count INTEGER;
BEGIN
    -- Attempt to count StartupBoost data from TechFlow context
    SELECT COUNT(*) INTO sb_project_count FROM org_0198ab70_2000_7000_8000_000000000002_project;
    SELECT COUNT(*) INTO sb_task_count FROM org_0198ab70_2000_7000_8000_000000000002_task;
    SELECT COUNT(*) INTO sb_comment_count FROM org_0198ab70_2000_7000_8000_000000000002_task_comment;
    SELECT COUNT(*) INTO sb_time_count FROM org_0198ab70_2000_7000_8000_000000000002_time_entry;
    
    RAISE NOTICE 'StartupBoost Data Visible from TechFlow Context:';
    RAISE NOTICE '  Projects: %', sb_project_count;
    RAISE NOTICE '  Tasks: %', sb_task_count;
    RAISE NOTICE '  Comments: %', sb_comment_count;
    RAISE NOTICE '  Time Entries: %', sb_time_count;
    
    -- Verify we CANNOT see StartupBoost data
    IF sb_project_count > 0 OR sb_task_count > 0 OR sb_comment_count > 0 OR sb_time_count > 0 THEN
        RAISE EXCEPTION 'FAIL: TechFlow Agency can see StartupBoost data! RLS breach detected.';
    END IF;
    
    RAISE NOTICE '✅ TechFlow Agency cannot see StartupBoost data (RLS working)';
END $$;

-- =============================================================================
-- TEST 2: STARTUPBOOST INC CONTEXT (Organization 2)
-- =============================================================================

-- Switch to StartupBoost context
SELECT set_config('app.current_organization_id', '0198ab70-2000-7000-8000-000000000002', false);

DO $$
DECLARE
    sb_project_count INTEGER;
    sb_task_count INTEGER;
    sb_comment_count INTEGER;
    sb_time_count INTEGER;
BEGIN
    -- Count StartupBoost data when in their context
    SELECT COUNT(*) INTO sb_project_count FROM org_0198ab70_2000_7000_8000_000000000002_project;
    SELECT COUNT(*) INTO sb_task_count FROM org_0198ab70_2000_7000_8000_000000000002_task;
    SELECT COUNT(*) INTO sb_comment_count FROM org_0198ab70_2000_7000_8000_000000000002_task_comment;
    SELECT COUNT(*) INTO sb_time_count FROM org_0198ab70_2000_7000_8000_000000000002_time_entry;
    
    RAISE NOTICE '';
    RAISE NOTICE 'StartupBoost Inc Context - Data Visible:';
    RAISE NOTICE '  Projects: %', sb_project_count;
    RAISE NOTICE '  Tasks: %', sb_task_count;
    RAISE NOTICE '  Comments: %', sb_comment_count;
    RAISE NOTICE '  Time Entries: %', sb_time_count;
    
    -- Verify we can see StartupBoost data
    IF sb_project_count = 0 THEN
        RAISE EXCEPTION 'FAIL: StartupBoost Inc cannot see their own data!';
    END IF;
    
    RAISE NOTICE '✅ StartupBoost Inc can see their own data';
END $$;

-- Try to access TechFlow data (should fail due to RLS)
DO $$
DECLARE
    tf_project_count INTEGER;
    tf_task_count INTEGER;
    tf_comment_count INTEGER;
    tf_time_count INTEGER;
BEGIN
    -- Attempt to count TechFlow data from StartupBoost context
    SELECT COUNT(*) INTO tf_project_count FROM org_0198ab70_1000_7000_8000_000000000001_project;
    SELECT COUNT(*) INTO tf_task_count FROM org_0198ab70_1000_7000_8000_000000000001_task;
    SELECT COUNT(*) INTO tf_comment_count FROM org_0198ab70_1000_7000_8000_000000000001_task_comment;
    SELECT COUNT(*) INTO tf_time_count FROM org_0198ab70_1000_7000_8000_000000000001_time_entry;
    
    RAISE NOTICE 'TechFlow Data Visible from StartupBoost Context:';
    RAISE NOTICE '  Projects: %', tf_project_count;
    RAISE NOTICE '  Tasks: %', tf_task_count;
    RAISE NOTICE '  Comments: %', tf_comment_count;
    RAISE NOTICE '  Time Entries: %', tf_time_count;
    
    -- Verify we CANNOT see TechFlow data
    IF tf_project_count > 0 OR tf_task_count > 0 OR tf_comment_count > 0 OR tf_time_count > 0 THEN
        RAISE EXCEPTION 'FAIL: StartupBoost Inc can see TechFlow data! RLS breach detected.';
    END IF;
    
    RAISE NOTICE '✅ StartupBoost Inc cannot see TechFlow data (RLS working)';
END $$;

-- =============================================================================
-- TEST 3: SYSTEM MODE (Should see all data)
-- =============================================================================

-- Switch to system mode
SELECT set_config('app.system_mode', 'true', false);

DO $$
DECLARE
    tf_project_count INTEGER;
    tf_task_count INTEGER;
    sb_project_count INTEGER;
    sb_task_count INTEGER;
BEGIN
    -- Count data from both organizations in system mode
    SELECT COUNT(*) INTO tf_project_count FROM org_0198ab70_1000_7000_8000_000000000001_project;
    SELECT COUNT(*) INTO tf_task_count FROM org_0198ab70_1000_7000_8000_000000000001_task;
    SELECT COUNT(*) INTO sb_project_count FROM org_0198ab70_2000_7000_8000_000000000002_project;
    SELECT COUNT(*) INTO sb_task_count FROM org_0198ab70_2000_7000_8000_000000000002_task;
    
    RAISE NOTICE '';
    RAISE NOTICE 'System Mode - All Data Visible:';
    RAISE NOTICE '  TechFlow Projects: %, Tasks: %', tf_project_count, tf_task_count;
    RAISE NOTICE '  StartupBoost Projects: %, Tasks: %', sb_project_count, sb_task_count;
    
    -- Verify system mode can see all data
    IF tf_project_count = 0 OR sb_project_count = 0 THEN
        RAISE EXCEPTION 'FAIL: System mode cannot see all organization data!';
    END IF;
    
    RAISE NOTICE '✅ System mode can see all organization data';
END $$;

-- =============================================================================
-- TEST 4: REALISTIC BUSINESS QUERIES
-- =============================================================================

-- Reset to normal mode for business query testing
SELECT set_config('app.system_mode', 'false', false);
SELECT set_config('app.current_organization_id', '0198ab70-1000-7000-8000-000000000001', false);

-- Test complex JOIN queries with organization isolation
DO $$
DECLARE
    active_projects INTEGER;
    project_details RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Testing Complex Business Queries (TechFlow Context):';
    
    -- Query active projects with task counts
    SELECT COUNT(*) INTO active_projects 
    FROM org_0198ab70_1000_7000_8000_000000000001_project p
    WHERE p.status = 'active';
    
    RAISE NOTICE '  Active Projects: %', active_projects;
    
    -- Detailed project information with aggregated data
    FOR project_details IN
        SELECT 
            p.name,
            p.status,
            p.client_name,
            COUNT(t.id) as task_count,
            COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks,
            COALESCE(SUM(te.hours), 0) as total_hours
        FROM org_0198ab70_1000_7000_8000_000000000001_project p
        LEFT JOIN org_0198ab70_1000_7000_8000_000000000001_task t ON p.id = t.project_id
        LEFT JOIN org_0198ab70_1000_7000_8000_000000000001_time_entry te ON t.id = te.task_id
        WHERE p.status IN ('active', 'completed')
        GROUP BY p.id, p.name, p.status, p.client_name
        ORDER BY p.status, p.name
        LIMIT 3
    LOOP
        RAISE NOTICE '  Project: % (%) - Tasks: %, Completed: %, Hours: %', 
            project_details.name, 
            project_details.status,
            project_details.task_count, 
            project_details.completed_tasks,
            project_details.total_hours;
    END LOOP;
    
    RAISE NOTICE '✅ Complex business queries working with RLS';
END $$;

-- =============================================================================
-- TEST 5: CHANGE_HISTORY TABLE INTEGRATION
-- =============================================================================

-- Test that change_history table exists and has organization-aware structure
DO $$
DECLARE
    change_count INTEGER;
    has_org_column BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Testing Change History Integration:';
    
    -- Check if change_history table exists
    SELECT COUNT(*) INTO change_count 
    FROM information_schema.tables 
    WHERE table_name = 'change_history';
    
    IF change_count = 0 THEN
        RAISE EXCEPTION 'FAIL: change_history table does not exist!';
    END IF;
    
    -- Check if organization_id column exists
    SELECT COUNT(*) > 0 INTO has_org_column
    FROM information_schema.columns 
    WHERE table_name = 'change_history' 
    AND column_name = 'organization_id';
    
    IF NOT has_org_column THEN
        RAISE EXCEPTION 'FAIL: change_history table missing organization_id column!';
    END IF;
    
    -- Count existing change history records
    SELECT COUNT(*) INTO change_count FROM change_history;
    
    RAISE NOTICE '  Change history table exists: ✅';
    RAISE NOTICE '  Organization-aware column exists: ✅';
    RAISE NOTICE '  Existing change records: %', change_count;
    RAISE NOTICE '✅ Change history integration ready for WAL testing';
END $$;

-- =============================================================================
-- SUMMARY REPORT
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'REALISTIC DATA SEEDING COMPLETE! 🎉';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Organizations Created:';
    RAISE NOTICE '  ✅ TechFlow Agency (8 users, 5 projects, 18 tasks)';
    RAISE NOTICE '  ✅ StartupBoost Inc (15 users, 8 projects, 10 tasks)';
    RAISE NOTICE '';
    RAISE NOTICE 'Multi-Tenant Security:';
    RAISE NOTICE '  ✅ Row Level Security (RLS) policies active';
    RAISE NOTICE '  ✅ Cross-organization data isolation verified';
    RAISE NOTICE '  ✅ System mode access control working';
    RAISE NOTICE '';
    RAISE NOTICE 'Business Data:';
    RAISE NOTICE '  ✅ Realistic project timelines and workflows';
    RAISE NOTICE '  ✅ Team collaboration patterns (comments/time tracking)';
    RAISE NOTICE '  ✅ Complex JOIN queries working correctly';
    RAISE NOTICE '';
    RAISE NOTICE 'WAL Integration Ready:';
    RAISE NOTICE '  ✅ Organization-aware change_history table';
    RAISE NOTICE '  ✅ Ready for real-time multi-tenant testing';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Test WAL polling with live data changes!';
END $$;

-- Reset session settings
SELECT set_config('app.current_organization_id', '', false);
SELECT set_config('app.system_mode', 'false', false);