-- Migration: Convert Worlds to Projects
-- This eliminates the "micro-worlds" problem by converting worlds table entries to projects
-- Organizations become the true "worlds" in the universe model

-- First, let's check if we have a projects table structure we need
-- This assumes projects table exists or we create it based on current world structure

-- Create projects table if it doesn't exist (based on worlds structure but without universe concepts)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Project lifecycle (simpler than world lifecycle)
    status TEXT DEFAULT 'active', -- active, completed, paused, cancelled
    priority TEXT DEFAULT 'medium', -- low, medium, high, critical
    
    -- Project categorization (what type of work this is)
    project_type TEXT, -- 'client_work', 'internal', 'research', 'product', etc.
    
    -- Project timeline
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    
    -- Ownership
    created_by UUID,
    project_lead_id UUID,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT projects_org_name_unique UNIQUE(organization_id, name),
    CONSTRAINT projects_status_check CHECK (status = ANY (ARRAY['active', 'completed', 'paused', 'cancelled'])),
    CONSTRAINT projects_priority_check CHECK (priority = ANY (ARRAY['low', 'medium', 'high', 'critical']))
);

-- Create indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_org_status ON projects(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_lead ON projects(project_lead_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Convert worlds to projects
INSERT INTO projects (
    id,
    organization_id, 
    team_id,
    name,
    description,
    status,
    priority,
    project_type,
    created_by,
    created_at,
    updated_at
)
SELECT 
    w.id,
    w.organization_id,
    w.team_id,
    w.name,
    w.description,
    -- Map world states to project status
    CASE 
        WHEN w.state = 'active' THEN 'active'
        WHEN w.state = 'developing' THEN 'active' 
        WHEN w.state = 'exploring' THEN 'active'
        WHEN w.state = 'paused' THEN 'paused'
        WHEN w.state = 'archived' THEN 'completed'
        ELSE 'active'
    END as status,
    -- Map world priority directly
    w.priority,
    -- Map world_type to project_type
    CASE 
        WHEN w.world_type = 'client' THEN 'client_work'
        WHEN w.world_type = 'business' THEN 'internal'
        WHEN w.world_type = 'department' THEN 'internal'
        WHEN w.world_type = 'project_domain' THEN 'product'
        WHEN w.world_type = 'personal' THEN 'personal'
        ELSE 'internal'
    END as project_type,
    w.created_by,
    w.created_at,
    w.updated_at
FROM worlds w
ON CONFLICT (organization_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    priority = EXCLUDED.priority,
    project_type = EXCLUDED.project_type,
    updated_at = NOW();

-- Log the conversion
DO $$ 
DECLARE 
    world_count INTEGER;
    project_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO world_count FROM worlds;
    SELECT COUNT(*) INTO project_count FROM projects;
    
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '  - Worlds converted: %', world_count;
    RAISE NOTICE '  - Projects created: %', project_count;
    RAISE NOTICE '  - Conversion completed successfully';
END $$;

-- Add RLS policies for projects (similar to worlds)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can only see projects in organizations they belong to
CREATE POLICY projects_organization_access ON projects
    FOR ALL
    USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.uid()::uuid
        )
    );

-- Add comment to projects table
COMMENT ON TABLE projects IS 'Projects table - contains actual work initiatives within organization worlds. Converted from the original worlds table to eliminate micro-worlds.';

-- Update foreign key references that pointed to worlds
-- This will need to be expanded based on what tables reference worlds
-- For now, let's identify what needs updating

-- Show what tables reference worlds (for manual verification)
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'worlds';

-- Note: After this migration, the worlds table should be dropped in a separate migration
-- once all foreign key references are updated to point to projects instead