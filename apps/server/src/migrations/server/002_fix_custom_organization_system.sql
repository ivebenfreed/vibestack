-- Fix Custom Organization System Migration
-- Drop and recreate tables with correct references to Better Auth 'user' table (not 'users')

-- Clean up any partial tables from previous migration
DROP TABLE IF EXISTS organization_audit_logs CASCADE;
DROP TABLE IF EXISTS organization_invitations CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;

-- Keep the organizations table but ensure it doesn't conflict with Better Auth
-- We'll use our custom 'organizations' table alongside Better Auth 'organization' table

-- Organization members table with correct reference to Better Auth 'user' table
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, -- Reference Better Auth user table
    
    -- Role System (standard 5 roles for V1)
    role VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    
    -- Member Status
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, pending, suspended
    invited_by UUID REFERENCES "user"(id), -- Reference Better Auth user table
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    
    -- Member Details
    title VARCHAR(100), -- Job title
    department VARCHAR(100),
    notes TEXT, -- Admin notes about this member
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one membership per user per organization
    UNIQUE(organization_id, user_id)
);

-- Organization invitations with correct user references
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Invitation Details
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    invited_by UUID NOT NULL REFERENCES "user"(id), -- Reference Better Auth user table
    
    -- Token & Security
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, expired, cancelled
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES "user"(id), -- Reference Better Auth user table
    
    -- Metadata
    personal_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one pending invitation per email per organization
    UNIQUE(organization_id, email, status) DEFERRABLE INITIALLY DEFERRED
);

-- Organization audit log for compliance and security
CREATE TABLE IF NOT EXISTS organization_audit_logs (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Action Details
    action VARCHAR(100) NOT NULL, -- 'member_added', 'role_changed', 'settings_updated', etc.
    actor_id UUID REFERENCES "user"(id), -- Reference Better Auth user table
    target_type VARCHAR(50), -- 'user', 'organization', 'project', etc.
    target_id UUID, -- ID of the affected entity
    
    -- Context
    details JSONB DEFAULT '{}', -- Action-specific details
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recreate indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_organization_members_status ON organization_members(status);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_status ON organization_invitations(status);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_expires_at ON organization_invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_organization_audit_logs_org_id ON organization_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_audit_logs_action ON organization_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_organization_audit_logs_actor_id ON organization_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_organization_audit_logs_created_at ON organization_audit_logs(created_at);

-- Update function already exists from previous migration

-- Recreate triggers for the new tables
CREATE TRIGGER trigger_organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_updated_at();

CREATE TRIGGER trigger_organization_invitations_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_updated_at();

-- Note: We're keeping both Better Auth 'organization' table and our custom 'organizations' table
-- This allows for a gradual transition or hybrid approach if needed
-- The custom 'organizations' table has enhanced features for B2B SaaS