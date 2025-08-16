-- Test WAL Polling with Realistic Multi-Tenant Data
-- This script validates that the organization-aware WAL system correctly captures and isolates changes

-- =============================================================================
-- SETUP: ENABLE SYSTEM MODE FOR WAL TESTING
-- =============================================================================

-- Enable system mode to simulate replication/WAL processing
SELECT set_config('app.system_mode', 'true', false);

-- Check current change_history before making changes
SELECT 
  'Before Changes' as phase,
  COUNT(*) as total_changes,
  COUNT(DISTINCT organization_id) as organizations_with_changes
FROM change_history;

-- =============================================================================
-- TEST 1: CREATE NEW RECORDS IN BOTH ORGANIZATIONS
-- =============================================================================

-- TechFlow Agency: Add a new project
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_project (
  id, name, description, status, priority, client_name, start_date, budget_hours
) VALUES (
  'tf-proj-wal-test-001',
  'WAL Test Project - TechFlow',
  'Testing organization-aware WAL polling for TechFlow Agency',
  'active',
  'high',
  'WAL Test Client',
  CURRENT_DATE,
  120
);

-- StartupBoost Inc: Add a new project  
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_project (
  id, name, description, status, priority, product_area, sprint_number, start_date, story_points
) VALUES (
  'sb-proj-wal-test-001',
  'WAL Test Project - StartupBoost',
  'Testing organization-aware WAL polling for StartupBoost Inc',
  'active',
  'urgent',
  'testing',
  99,
  CURRENT_DATE,
  50
);

-- Add tasks to both projects
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_task (
  id, project_id, title, description, status, priority, assigned_to, estimated_hours
) VALUES (
  'tf-task-wal-test-001',
  'tf-proj-wal-test-001',
  'WAL Polling Validation Task',
  'Verify organization context is captured correctly in change history',
  'todo',
  'high',
  '0198ab70-1004-7000-8000-000000000001', -- Alex Kim (TechFlow developer)
  8.0
);

INSERT INTO org_0198ab70_2000_7000_8000_000000000002_task (
  id, project_id, title, description, status, priority, assigned_to, story_points
) VALUES (
  'sb-task-wal-test-001',
  'sb-proj-wal-test-001',
  'Multi-Tenant WAL Test',
  'Validate organization isolation in WAL change tracking',
  'todo',
  'urgent',
  '0198ab70-2005-7000-8000-000000000002', -- Carlos Mendez (StartupBoost engineer)
  8
);

-- =============================================================================
-- TEST 2: UPDATE EXISTING RECORDS
-- =============================================================================

-- Update TechFlow project status
UPDATE org_0198ab70_1000_7000_8000_000000000001_project 
SET status = 'active', priority = 'urgent'
WHERE id = 'tf-proj-003'; -- RetailCorp Inventory System

-- Update StartupBoost task status
UPDATE org_0198ab70_2000_7000_8000_000000000002_task 
SET status = 'in_progress', actual_hours = 15.5
WHERE id = 'sb-task-008'; -- Model training task

-- Add comments to both organizations
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_task_comment (
  id, task_id, author_id, content, comment_type
) VALUES (
  'tf-comment-wal-test-001',
  'tf-task-wal-test-001',
  '0198ab70-1002-7000-8000-000000000001', -- Marcus Johnson
  'WAL testing in progress - monitoring change_history table for organization isolation',
  'status_update'
);

INSERT INTO org_0198ab70_2000_7000_8000_000000000002_task_comment (
  id, task_id, author_id, content, comment_type
) VALUES (
  'sb-comment-wal-test-001',
  'sb-task-wal-test-001',
  '0198ab70-2003-7000-8000-000000000002', -- Ryan O'Connor
  'Verifying multi-tenant WAL polling captures organization context correctly',
  'status_update'
);

-- =============================================================================
-- TEST 3: BATCH OPERATIONS
-- =============================================================================

-- Add multiple time entries for TechFlow
INSERT INTO org_0198ab70_1000_7000_8000_000000000001_time_entry (
  task_id, user_id, description, hours, entry_date, billable
) VALUES 
  ('tf-task-wal-test-001', '0198ab70-1004-7000-8000-000000000001', 'WAL testing setup', 2.5, CURRENT_DATE, true),
  ('tf-task-wal-test-001', '0198ab70-1004-7000-8000-000000000001', 'Organization isolation validation', 3.0, CURRENT_DATE, true),
  ('tf-task-015', '0198ab70-1005-7000-8000-000000000001', 'Real-time inventory debugging', 1.5, CURRENT_DATE, true);

-- Add multiple time entries for StartupBoost
INSERT INTO org_0198ab70_2000_7000_8000_000000000002_time_entry (
  task_id, user_id, description, hours, entry_date, entry_type
) VALUES 
  ('sb-task-wal-test-001', '0198ab70-2005-7000-8000-000000000002', 'WAL polling test implementation', 4.0, CURRENT_DATE, 'development'),
  ('sb-task-wal-test-001', '0198ab70-2005-7000-8000-000000000002', 'Multi-tenant validation testing', 2.5, CURRENT_DATE, 'testing'),
  ('sb-task-008', '0198ab70-2005-7000-8000-000000000002', 'ML model performance tuning', 3.0, CURRENT_DATE, 'development');

-- =============================================================================
-- VALIDATION: CHECK CHANGE_HISTORY CAPTURES
-- =============================================================================

-- Check change_history after our test operations
SELECT 
  'After WAL Test Operations' as phase,
  COUNT(*) as total_changes,
  COUNT(DISTINCT organization_id) as organizations_with_changes,
  COUNT(CASE WHEN organization_id = '0198ab70-1000-7000-8000-000000000001' THEN 1 END) as techflow_changes,
  COUNT(CASE WHEN organization_id = '0198ab70-2000-7000-8000-000000000002' THEN 1 END) as startupboost_changes
FROM change_history;

-- Detailed change analysis by organization
SELECT 
  CASE 
    WHEN organization_id = '0198ab70-1000-7000-8000-000000000001' THEN 'TechFlow Agency'
    WHEN organization_id = '0198ab70-2000-7000-8000-000000000002' THEN 'StartupBoost Inc'
    ELSE 'Unknown/System'
  END as organization,
  table_name,
  operation,
  COUNT(*) as change_count,
  MIN(created_at) as first_change,
  MAX(created_at) as last_change
FROM change_history
GROUP BY organization_id, table_name, operation
ORDER BY organization_id, table_name, operation;

-- Show recent changes with organization context
SELECT 
  CASE 
    WHEN ch.organization_id = '0198ab70-1000-7000-8000-000000000001' THEN 'TechFlow'
    WHEN ch.organization_id = '0198ab70-2000-7000-8000-000000000002' THEN 'StartupBoost'
    ELSE 'System'
  END as org,
  ch.table_name,
  ch.operation,
  CASE 
    WHEN ch.data ? 'name' THEN ch.data->>'name'
    WHEN ch.data ? 'title' THEN ch.data->>'title'
    WHEN ch.data ? 'content' THEN LEFT(ch.data->>'content', 50) || '...'
    WHEN ch.data ? 'description' THEN LEFT(ch.data->>'description', 50) || '...'
    ELSE 'Record ID: ' || COALESCE(ch.data->>'id', 'Unknown')
  END as record_summary,
  ch.created_at
FROM change_history ch
WHERE ch.created_at > NOW() - INTERVAL '1 hour'
ORDER BY ch.created_at DESC
LIMIT 10;

-- =============================================================================
-- ORGANIZATION ISOLATION VALIDATION
-- =============================================================================

-- Test organization context switching with change_history
SELECT set_config('app.current_organization_id', '0198ab70-1000-7000-8000-000000000001', false);
SELECT set_config('app.system_mode', 'false', false);

SELECT 
  'TechFlow Context' as context,
  COUNT(*) as visible_changes
FROM change_history;

-- Switch to StartupBoost context
SELECT set_config('app.current_organization_id', '0198ab70-2000-7000-8000-000000000002', false);

SELECT 
  'StartupBoost Context' as context,
  COUNT(*) as visible_changes
FROM change_history;

-- Back to system mode to see all
SELECT set_config('app.system_mode', 'true', false);

SELECT 
  'System Mode' as context,
  COUNT(*) as visible_changes
FROM change_history;

-- =============================================================================
-- PERFORMANCE TEST: LARGE BATCH OPERATIONS
-- =============================================================================

-- Create a larger batch of changes to test WAL performance
DO $$
DECLARE
    i INTEGER;
    tf_task_id TEXT;
    sb_task_id TEXT;
BEGIN
    -- Create 10 tasks for each organization to test batch processing
    FOR i IN 1..10 LOOP
        tf_task_id := 'tf-task-batch-' || i;
        sb_task_id := 'sb-task-batch-' || i;
        
        -- TechFlow batch tasks
        INSERT INTO org_0198ab70_1000_7000_8000_000000000001_task (
            id, project_id, title, description, status, priority, estimated_hours
        ) VALUES (
            tf_task_id,
            'tf-proj-wal-test-001',
            'Batch Task ' || i || ' - TechFlow',
            'Performance testing task for WAL batch processing',
            'todo',
            'medium',
            i * 1.5
        );
        
        -- StartupBoost batch tasks
        INSERT INTO org_0198ab70_2000_7000_8000_000000000002_task (
            id, project_id, title, description, status, priority, story_points
        ) VALUES (
            sb_task_id,
            'sb-proj-wal-test-001',
            'Batch Task ' || i || ' - StartupBoost',
            'Performance testing task for WAL batch processing',
            'todo',
            'medium',
            i * 2
        );
    END LOOP;
    
    RAISE NOTICE 'Created 20 batch tasks (10 per organization) for WAL performance testing';
END $$;

-- =============================================================================
-- FINAL VALIDATION SUMMARY
-- =============================================================================

SELECT 
  '🎉 WAL TESTING COMPLETE' as status,
  COUNT(*) as total_change_records,
  COUNT(DISTINCT organization_id) as organizations_tracked,
  COUNT(DISTINCT table_name) as tables_with_changes,
  MIN(created_at) as oldest_change,
  MAX(created_at) as newest_change
FROM change_history;

-- Show organization breakdown
SELECT 
  CASE 
    WHEN organization_id = '0198ab70-1000-7000-8000-000000000001' THEN '🏢 TechFlow Agency'
    WHEN organization_id = '0198ab70-2000-7000-8000-000000000002' THEN '🚀 StartupBoost Inc'
    ELSE '⚙️ System/Other'
  END as organization,
  COUNT(*) as change_count,
  COUNT(DISTINCT table_name) as affected_tables
FROM change_history
GROUP BY organization_id
ORDER BY change_count DESC;

-- Reset session configuration
SELECT set_config('app.current_organization_id', '', false);
SELECT set_config('app.system_mode', 'false', false);