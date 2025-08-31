-- Create Organization-Scoped Tables and Realistic Business Data
-- This script creates tables for each organization following the org_{orgId}_{entity} pattern

-- Organization IDs for reference:
-- TechFlow Agency: 0198ab70-1000-7000-8000-000000000001
-- StartupBoost Inc: 0198ab70-2000-7000-8000-000000000002

-- =============================================================================
-- CREATE ORGANIZATION-SCOPED TABLES FOR TECHFLOW AGENCY
-- =============================================================================

-- TechFlow Agency: Projects Table
CREATE TABLE org_0198ab70_1000_7000_8000_000000000001_project (
    id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    client_name TEXT,
    start_date DATE,
    end_date DATE,
    budget_hours INTEGER,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- TechFlow Agency: Tasks Table
CREATE TABLE org_0198ab70_1000_7000_8000_000000000001_task (
    id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
    project_id TEXT REFERENCES org_0198ab70_1000_7000_8000_000000000001_project(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to TEXT, -- user ID
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2) DEFAULT 0,
    due_date DATE,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- TechFlow Agency: Task Comments Table
CREATE TABLE org_0198ab70_1000_7000_8000_000000000001_task_comment (
    id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
    task_id TEXT REFERENCES org_0198ab70_1000_7000_8000_000000000001_task(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL, -- user ID
    content TEXT NOT NULL,
    comment_type TEXT DEFAULT 'general' CHECK (comment_type IN ('general', 'status_update', 'client_feedback', 'issue', 'solution')),
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- TechFlow Agency: Time Entries Table
CREATE TABLE org_0198ab70_1000_7000_8000_000000000001_time_entry (
    id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
    task_id TEXT REFERENCES org_0198ab70_1000_7000_8000_000000000001_task(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    description TEXT,
    hours DECIMAL(5,2) NOT NULL,
    entry_date DATE NOT NULL,
    billable BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- CREATE ORGANIZATION-SCOPED TABLES FOR STARTUPBOOST INC
-- =============================================================================

-- StartupBoost Inc: Projects Table
CREATE TABLE org_0198ab70_2000_7000_8000_000000000002_project (
    id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    product_area TEXT, -- frontend, backend, mobile, marketing, etc.
    sprint_number INTEGER,
    start_date DATE,
    end_date DATE,
    story_points INTEGER,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- StartupBoost Inc: Tasks Table  
CREATE TABLE org_0198ab70_2000_7000_8000_000000000002_task (
    id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
    project_id TEXT REFERENCES org_0198ab70_2000_7000_8000_000000000002_project(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'testing', 'done', 'blocked')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to TEXT, -- user ID
    story_points INTEGER,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2) DEFAULT 0,
    epic_tag TEXT, -- epic/theme categorization
    feature_flag TEXT, -- feature flag name if applicable
    due_date DATE,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- StartupBoost Inc: Task Comments Table
CREATE TABLE org_0198ab70_2000_7000_8000_000000000002_task_comment (
    id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
    task_id TEXT REFERENCES org_0198ab70_2000_7000_8000_000000000002_task(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL, -- user ID
    content TEXT NOT NULL,
    comment_type TEXT DEFAULT 'general' CHECK (comment_type IN ('general', 'status_update', 'code_review', 'bug_report', 'feature_request', 'discussion')),
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- StartupBoost Inc: Time Entries Table
CREATE TABLE org_0198ab70_2000_7000_8000_000000000002_time_entry (
    id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
    task_id TEXT REFERENCES org_0198ab70_2000_7000_8000_000000000002_task(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    description TEXT,
    hours DECIMAL(5,2) NOT NULL,
    entry_date DATE NOT NULL,
    entry_type TEXT DEFAULT 'development' CHECK (entry_type IN ('development', 'design', 'testing', 'meeting', 'research', 'deployment')),
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- ENABLE RLS ON ALL ORGANIZATION-SCOPED TABLES
-- =============================================================================

-- TechFlow Agency Tables
ALTER TABLE org_0198ab70_1000_7000_8000_000000000001_project ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_0198ab70_1000_7000_8000_000000000001_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_0198ab70_1000_7000_8000_000000000001_task_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_0198ab70_1000_7000_8000_000000000001_time_entry ENABLE ROW LEVEL SECURITY;

-- StartupBoost Inc Tables
ALTER TABLE org_0198ab70_2000_7000_8000_000000000002_project ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_0198ab70_2000_7000_8000_000000000002_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_0198ab70_2000_7000_8000_000000000002_task_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_0198ab70_2000_7000_8000_000000000002_time_entry ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- CREATE RLS POLICIES FOR ORGANIZATION ISOLATION
-- =============================================================================

-- TechFlow Agency Policies
CREATE POLICY "techflow_project_access" ON org_0198ab70_1000_7000_8000_000000000001_project
    FOR ALL TO PUBLIC USING (
        current_setting('app.system_mode', true) = 'true'
        OR current_setting('app.current_organization_id', true) = '0198ab70-1000-7000-8000-000000000001'
    );

CREATE POLICY "techflow_task_access" ON org_0198ab70_1000_7000_8000_000000000001_task
    FOR ALL TO PUBLIC USING (
        current_setting('app.system_mode', true) = 'true'
        OR current_setting('app.current_organization_id', true) = '0198ab70-1000-7000-8000-000000000001'
    );

CREATE POLICY "techflow_comment_access" ON org_0198ab70_1000_7000_8000_000000000001_task_comment
    FOR ALL TO PUBLIC USING (
        current_setting('app.system_mode', true) = 'true'
        OR current_setting('app.current_organization_id', true) = '0198ab70-1000-7000-8000-000000000001'
    );

CREATE POLICY "techflow_time_access" ON org_0198ab70_1000_7000_8000_000000000001_time_entry
    FOR ALL TO PUBLIC USING (
        current_setting('app.system_mode', true) = 'true'
        OR current_setting('app.current_organization_id', true) = '0198ab70-1000-7000-8000-000000000001'
    );

-- StartupBoost Inc Policies
CREATE POLICY "startupboost_project_access" ON org_0198ab70_2000_7000_8000_000000000002_project
    FOR ALL TO PUBLIC USING (
        current_setting('app.system_mode', true) = 'true'
        OR current_setting('app.current_organization_id', true) = '0198ab70-2000-7000-8000-000000000002'
    );

CREATE POLICY "startupboost_task_access" ON org_0198ab70_2000_7000_8000_000000000002_task
    FOR ALL TO PUBLIC USING (
        current_setting('app.system_mode', true) = 'true'
        OR current_setting('app.current_organization_id', true) = '0198ab70-2000-7000-8000-000000000002'
    );

CREATE POLICY "startupboost_comment_access" ON org_0198ab70_2000_7000_8000_000000000002_task_comment
    FOR ALL TO PUBLIC USING (
        current_setting('app.system_mode', true) = 'true'
        OR current_setting('app.current_organization_id', true) = '0198ab70-2000-7000-8000-000000000002'
    );

CREATE POLICY "startupboost_time_access" ON org_0198ab70_2000_7000_8000_000000000002_time_entry
    FOR ALL TO PUBLIC USING (
        current_setting('app.system_mode', true) = 'true'
        OR current_setting('app.current_organization_id', true) = '0198ab70-2000-7000-8000-000000000002'
    );

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- List created organization-scoped tables
SELECT tablename 
FROM pg_tables 
WHERE tablename LIKE 'org_0198ab70_%' 
ORDER BY tablename;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'org_0198ab70_%'
ORDER BY tablename;