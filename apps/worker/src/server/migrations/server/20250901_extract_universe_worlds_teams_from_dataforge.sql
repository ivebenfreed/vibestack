-- Migration: Extract Universe, Worlds, and Teams from DataForge archetypes to fixed schema
-- This creates dedicated tables for core business logic entities (Universe, Worlds, Teams)
-- while keeping DataForge for user-configurable entity types (Projects, Tasks, Records, etc.)

-- Create universes table - personal workspace container for each user in each organization
CREATE TABLE universes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- Create indexes for universes
CREATE INDEX idx_universes_user_id ON universes(user_id);
CREATE INDEX idx_universes_organization_id ON universes(organization_id);
CREATE INDEX idx_universes_updated_at ON universes(updated_at);

-- Create teams table - organizational units within a single organization
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    parent_team_id UUID REFERENCES teams(id) ON DELETE CASCADE, -- NULL = top-level team
    team_type TEXT NOT NULL DEFAULT 'department' CHECK (team_type IN ('department', 'project', 'functional', 'cross_functional')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);

-- Create indexes for teams
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_teams_parent_team_id ON teams(parent_team_id);
CREATE INDEX idx_teams_updated_at ON teams(updated_at);

-- Create team_memberships table - user roles within specific teams
CREATE TABLE team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'lead', 'admin')),
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    UNIQUE(team_id, user_id)
);

-- Create indexes for team_memberships
CREATE INDEX idx_team_memberships_team_id ON team_memberships(team_id);
CREATE INDEX idx_team_memberships_user_id ON team_memberships(user_id);

-- Create worlds table - life areas (personal) or business domains (organizational)
CREATE TABLE worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL, -- NULL = org-wide, NOT NULL = team-specific
    name TEXT NOT NULL,
    description TEXT,
    universe_id UUID REFERENCES universes(id) ON DELETE CASCADE, -- NULL = business world, NOT NULL = personal world
    state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('exploring', 'developing', 'active', 'paused', 'archived')),
    world_type TEXT NOT NULL CHECK (world_type IN ('personal', 'business', 'client', 'department', 'project_domain')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);

-- Create indexes for worlds
CREATE INDEX idx_worlds_organization_id ON worlds(organization_id);
CREATE INDEX idx_worlds_team_id ON worlds(team_id);
CREATE INDEX idx_worlds_universe_id ON worlds(universe_id);
CREATE INDEX idx_worlds_state ON worlds(state);
CREATE INDEX idx_worlds_updated_at ON worlds(updated_at);

-- Create composite indexes for common query patterns
CREATE INDEX idx_worlds_org_team ON worlds(organization_id, team_id);
CREATE INDEX idx_worlds_universe_state ON worlds(universe_id, state) WHERE universe_id IS NOT NULL;
CREATE INDEX idx_worlds_business_active ON worlds(organization_id, state) WHERE universe_id IS NULL;

-- Add Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;

-- Universes: Users can only see their own universes
CREATE POLICY universes_user_isolation ON universes
    FOR ALL 
    USING (user_id = auth.uid()::uuid);

-- Teams: Users can see teams in organizations they belong to
CREATE POLICY teams_org_member_access ON teams
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()::uuid
        )
    );

-- Team creation/modification: Only org admins/owners
CREATE POLICY teams_admin_modify ON teams
    FOR INSERT, UPDATE, DELETE
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()::uuid 
            AND role IN ('admin', 'owner')
        )
    );

-- Team memberships: Users can see memberships for teams they belong to or can access
CREATE POLICY team_memberships_access ON team_memberships
    FOR SELECT
    USING (
        user_id = auth.uid()::uuid OR -- Own memberships
        team_id IN (
            SELECT team_id 
            FROM team_memberships 
            WHERE user_id = auth.uid()::uuid
        ) OR -- Teams user belongs to
        team_id IN (
            SELECT t.id 
            FROM teams t 
            JOIN organization_members om ON t.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()::uuid 
            AND om.role IN ('admin', 'owner')
        ) -- Admin can see all team memberships in their orgs
    );

-- Team membership modification: Team leads/admins or org admins
CREATE POLICY team_memberships_modify ON team_memberships
    FOR INSERT, UPDATE, DELETE
    USING (
        team_id IN (
            SELECT team_id 
            FROM team_memberships 
            WHERE user_id = auth.uid()::uuid 
            AND role IN ('lead', 'admin')
        ) OR -- Team leads/admins
        team_id IN (
            SELECT t.id 
            FROM teams t 
            JOIN organization_members om ON t.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()::uuid 
            AND om.role IN ('admin', 'owner')
        ) -- Org admins
    );

-- Worlds: Complex policy based on personal vs business worlds
CREATE POLICY worlds_access ON worlds
    FOR SELECT
    USING (
        -- Personal worlds: only universe owner can see
        (universe_id IS NOT NULL AND universe_id IN (
            SELECT id FROM universes WHERE user_id = auth.uid()::uuid
        )) OR
        -- Business worlds: based on organization membership and team access
        (universe_id IS NULL AND (
            -- Org-wide worlds: any org member can see active worlds
            (team_id IS NULL AND state = 'active' AND organization_id IN (
                SELECT organization_id 
                FROM organization_members 
                WHERE user_id = auth.uid()::uuid
            )) OR
            -- Team-specific worlds: team members can see
            (team_id IS NOT NULL AND team_id IN (
                SELECT team_id 
                FROM team_memberships 
                WHERE user_id = auth.uid()::uuid
            )) OR
            -- Admins can see all business worlds in their orgs
            (organization_id IN (
                SELECT organization_id 
                FROM organization_members 
                WHERE user_id = auth.uid()::uuid 
                AND role IN ('admin', 'owner')
            ))
        ))
    );

-- World modification: More restrictive than read access
CREATE POLICY worlds_modify ON worlds
    FOR INSERT, UPDATE, DELETE
    USING (
        -- Personal worlds: only universe owner
        (universe_id IS NOT NULL AND universe_id IN (
            SELECT id FROM universes WHERE user_id = auth.uid()::uuid
        )) OR
        -- Business worlds: team leads/admins or org admins
        (universe_id IS NULL AND (
            -- Team leads for team-specific worlds
            (team_id IS NOT NULL AND team_id IN (
                SELECT team_id 
                FROM team_memberships 
                WHERE user_id = auth.uid()::uuid 
                AND role IN ('lead', 'admin')
            )) OR
            -- Org admins for any business world
            (organization_id IN (
                SELECT organization_id 
                FROM organization_members 
                WHERE user_id = auth.uid()::uuid 
                AND role IN ('admin', 'owner')
            ))
        ))
    );

-- Add helpful comments for future reference
COMMENT ON TABLE universes IS 'Personal workspace container for each user in each organization';
COMMENT ON TABLE teams IS 'Organizational units within a single organization (departments, project teams, etc.)';
COMMENT ON TABLE team_memberships IS 'User roles and memberships within specific teams';
COMMENT ON TABLE worlds IS 'Life areas (personal) or business domains (organizational), can be org-wide or team-specific';

COMMENT ON COLUMN worlds.universe_id IS 'NULL = business world, NOT NULL = personal world';
COMMENT ON COLUMN worlds.team_id IS 'NULL = org-wide world, NOT NULL = team-specific world';
COMMENT ON COLUMN teams.parent_team_id IS 'NULL = top-level team, NOT NULL = sub-team';