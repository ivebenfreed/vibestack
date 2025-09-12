-- Wide Corp Entity-to-World Assignment Migration
-- Assigns existing business entities to appropriate worlds for comprehensive testing
-- Based on business domain analysis and workflow optimization

-- Update clients to Sales & Client Success worlds
-- Split between Enterprise Sales Pipeline and Customer Onboarding based on status
UPDATE org_01920000_1000_7000_8000_000000000001_clients 
SET world_id = CASE 
    WHEN status = 'active' THEN '01920000-1003-7003-8003-000000000026'  -- Enterprise Sales Pipeline
    WHEN status = 'pending' THEN '01920000-1003-7003-8003-000000000026' -- Enterprise Sales Pipeline  
    WHEN status = 'inactive' THEN '01920000-1003-7003-8003-000000000027' -- Customer Onboarding (re-engagement)
    ELSE '01920000-1003-7003-8003-000000000026' -- Default to Sales Pipeline
END
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update development tasks to Engineering worlds
-- Split between API Infrastructure and Mobile App Development
UPDATE org_01920000_1000_7000_8000_000000000001_tasks 
SET world_id = CASE 
    WHEN task_type = 'bug' THEN '01920000-1003-7003-8003-000000000021'     -- API Infrastructure
    WHEN task_type = 'feature' THEN '01920000-1003-7003-8003-000000000020'  -- Mobile App Development
    WHEN title ILIKE '%api%' OR title ILIKE '%backend%' THEN '01920000-1003-7003-8003-000000000021' -- API Infrastructure
    WHEN title ILIKE '%mobile%' OR title ILIKE '%app%' THEN '01920000-1003-7003-8003-000000000020'  -- Mobile App Development
    ELSE '01920000-1003-7003-8003-000000000021' -- Default to API Infrastructure
END
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update projects to Project Delivery worlds
-- Assign to Phoenix Platform Migration (major projects) or Client Project Alpha (smaller projects)
UPDATE org_01920000_1000_7000_8000_000000000001_projects 
SET world_id = CASE 
    WHEN project_type = 'strategic' THEN '01920000-1003-7003-8003-000000000035' -- Phoenix Platform Migration
    WHEN budget > 50000 THEN '01920000-1003-7003-8003-000000000035'            -- Phoenix Platform Migration
    ELSE '01920000-1003-7003-8003-000000000003'                                 -- Client Project Alpha
END
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update invoices to Financial Operations world
UPDATE org_01920000_1000_7000_8000_000000000001_invoices 
SET world_id = '01920000-1003-7003-8003-000000000031' -- Financial Planning 2024
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update contracts to Sales world (client contracts) or Financial world (vendor contracts)
UPDATE org_01920000_1000_7000_8000_000000000001_contracts 
SET world_id = CASE 
    WHEN contract_type = 'client' OR contract_type = 'service' THEN '01920000-1003-7003-8003-000000000026' -- Enterprise Sales Pipeline
    WHEN contract_type = 'vendor' OR contract_type = 'supplier' THEN '01920000-1003-7003-8003-000000000031' -- Financial Planning 2024
    ELSE '01920000-1003-7003-8003-000000000026' -- Default to Sales Pipeline
END
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update meetings to appropriate worlds based on meeting type
UPDATE org_01920000_1000_7000_8000_000000000001_meetings 
SET world_id = CASE 
    WHEN meeting_type = 'client' THEN '01920000-1003-7003-8003-000000000026'     -- Enterprise Sales Pipeline
    WHEN meeting_type = 'project' THEN '01920000-1003-7003-8003-000000000035'    -- Phoenix Platform Migration
    WHEN meeting_type = 'technical' THEN '01920000-1003-7003-8003-000000000021'  -- API Infrastructure
    WHEN meeting_type = 'internal' THEN '01920000-1003-7003-8003-000000000032'   -- Company All-Hands
    ELSE '01920000-1003-7003-8003-000000000032' -- Default to Company All-Hands
END
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update expenses to Financial Operations world
UPDATE org_01920000_1000_7000_8000_000000000001_expenses 
SET world_id = '01920000-1003-7003-8003-000000000031' -- Financial Planning 2024
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update files to appropriate worlds based on file type and context
UPDATE org_01920000_1000_7000_8000_000000000001_files 
SET world_id = CASE 
    WHEN name ILIKE '%contract%' OR name ILIKE '%agreement%' THEN '01920000-1003-7003-8003-000000000031' -- Financial Planning 2024
    WHEN name ILIKE '%client%' OR name ILIKE '%proposal%' THEN '01920000-1003-7003-8003-000000000026'    -- Enterprise Sales Pipeline
    WHEN name ILIKE '%code%' OR name ILIKE '%tech%' THEN '01920000-1003-7003-8003-000000000021'          -- API Infrastructure
    WHEN name ILIKE '%project%' THEN '01920000-1003-7003-8003-000000000035'                              -- Phoenix Platform Migration
    ELSE '01920000-1003-7003-8003-000000000032' -- Default to Company All-Hands
END
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update timesheets to appropriate worlds based on activity type
UPDATE org_01920000_1000_7000_8000_000000000001_timesheets 
SET world_id = CASE 
    WHEN activity_type = 'development' THEN '01920000-1003-7003-8003-000000000021' -- API Infrastructure
    WHEN activity_type = 'project' THEN '01920000-1003-7003-8003-000000000035'     -- Phoenix Platform Migration
    WHEN activity_type = 'client' THEN '01920000-1003-7003-8003-000000000026'      -- Enterprise Sales Pipeline
    WHEN activity_type = 'admin' THEN '01920000-1003-7003-8003-000000000030'       -- HR & Talent Management
    ELSE '01920000-1003-7003-8003-000000000030' -- Default to HR & Talent Management
END
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update discussions to appropriate worlds based on discussion type
UPDATE org_01920000_1000_7000_8000_000000000001_discussions 
SET world_id = CASE 
    WHEN discussion_type = 'technical' THEN '01920000-1003-7003-8003-000000000021' -- API Infrastructure
    WHEN discussion_type = 'client' THEN '01920000-1003-7003-8003-000000000026'    -- Enterprise Sales Pipeline
    WHEN discussion_type = 'project' THEN '01920000-1003-7003-8003-000000000035'   -- Phoenix Platform Migration
    WHEN discussion_type = 'company' THEN '01920000-1003-7003-8003-000000000032'   -- Company All-Hands
    ELSE '01920000-1003-7003-8003-000000000032' -- Default to Company All-Hands
END
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Create new QA Testing world for test entities
INSERT INTO worlds (id, organization_id, team_id, name, description, owner_user_id, state, world_type, priority, created_at, updated_at, created_by) VALUES
('01920000-1003-7003-8003-000000000080', '01920000-1000-7000-8000-000000000001', '01920000-1002-7002-8002-000000000001', 'QA Testing Environment', 'Quality assurance testing, data validation, and system testing', '01980000-2000-4000-8000-000000000017', 'active', 'business', 'high', NOW(), NOW(), '01980000-2000-4000-8000-000000000017');

-- Assign all test entities to the QA Testing world
UPDATE org_01920000_1000_7000_8000_000000000001_testentitys SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_cachetestentitys SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_cleantests SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_testcompanys SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_testcompany2s SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_testproducts SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_testprojects SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_softdeletetests SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_testdeletes SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_archetypetests SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_temptests SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';
UPDATE org_01920000_1000_7000_8000_000000000001_morningworkouts SET world_id = '01920000-1003-7003-8003-000000000080' WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Update generic records to appropriate worlds based on record type
UPDATE org_01920000_1000_7000_8000_000000000001_records 
SET world_id = CASE 
    WHEN record_type = 'client' THEN '01920000-1003-7003-8003-000000000026'    -- Enterprise Sales Pipeline
    WHEN record_type = 'project' THEN '01920000-1003-7003-8003-000000000035'   -- Phoenix Platform Migration
    WHEN record_type = 'financial' THEN '01920000-1003-7003-8003-000000000031' -- Financial Planning 2024
    WHEN record_type = 'technical' THEN '01920000-1003-7003-8003-000000000021' -- API Infrastructure
    ELSE '01920000-1003-7003-8003-000000000032' -- Default to Company All-Hands
END
WHERE organization_id = '01920000-1000-7000-8000-000000000001';

-- Summary: Entity assignments completed
-- 1. Sales & Client Success: clients, contracts (client), meetings (client), files (client/proposal)
-- 2. Engineering & Development: tasks, timesheets (development), discussions (technical), files (code/tech)
-- 3. Project Delivery: projects, timesheets (project), discussions (project), files (project)
-- 4. Financial Operations: invoices, expenses, contracts (vendor), files (contract/agreement)
-- 5. Internal Operations: meetings (internal), timesheets (admin)
-- 6. QA Testing: all test entities isolated in dedicated world