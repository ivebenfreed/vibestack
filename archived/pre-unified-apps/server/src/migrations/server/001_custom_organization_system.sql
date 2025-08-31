-- Custom Organization System Migration
-- This replaces Better Auth's organization plugin with our custom system

-- Organizations table with enhanced features for B2B SaaS
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- for custom domains
    description TEXT,
    
    -- Business Information
    industry VARCHAR(100),
    company_size VARCHAR(50), -- "1-10", "11-50", "51-200", "201-500", "500+"
    website_url VARCHAR(255),
    country VARCHAR(100),
    timezone VARCHAR(100) DEFAULT 'UTC',
    
    -- Subscription & Billing
    subscription_tier VARCHAR(50) DEFAULT 'free', -- free, starter, pro, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active',
    billing_email VARCHAR(255),
    trial_ends_at TIMESTAMPTZ,
    
    -- Features & Limits
    max_users INTEGER DEFAULT 5,
    max_projects INTEGER DEFAULT 3,
    storage_limit_gb INTEGER DEFAULT 1,
    api_rate_limit INTEGER DEFAULT 1000,
    
    -- Settings (JSONB for flexible configuration)
    settings JSONB DEFAULT '{}',
    
    -- Security
    sso_enabled BOOLEAN DEFAULT FALSE,
    enforce_2fa BOOLEAN DEFAULT FALSE,
    allowed_domains TEXT[], -- Email domains that can auto-join
    
    -- Metadata
    logo_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- Soft delete for data retention
);

-- Organization members table with enhanced role system
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Role System (standard 5 roles for V1)
    role VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    
    -- Member Status
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, pending, suspended
    invited_by UUID REFERENCES users(id),
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

-- Organization invitations with enhanced tracking
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Invitation Details
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    invited_by UUID NOT NULL REFERENCES users(id),
    
    -- Token & Security
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, expired, cancelled
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users(id),
    
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
    actor_id UUID REFERENCES users(id), -- Who performed the action
    target_type VARCHAR(50), -- 'user', 'organization', 'project', etc.
    target_id UUID, -- ID of the affected entity
    
    -- Context
    details JSONB DEFAULT '{}', -- Action-specific details
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_tier ON organizations(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at);

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

-- Functions for common operations
CREATE OR REPLACE FUNCTION update_organization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update timestamps
CREATE TRIGGER trigger_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_updated_at();

CREATE TRIGGER trigger_organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_updated_at();

CREATE TRIGGER trigger_organization_invitations_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_updated_at();

-- Row Level Security (RLS) for multi-tenant isolation
-- Enable RLS on all organization tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_audit_logs ENABLE ROW LEVEL SECURITY;

-- Organization access policies will be defined in application middleware
-- For now, disable RLS to allow application-level access control
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_audit_logs DISABLE ROW LEVEL SECURITY;

-- Default data for testing (optional)
-- INSERT INTO organizations (name, slug, description, subscription_tier) 
-- VALUES ('VibeStack Demo', 'vibestack-demo', 'Demo organization for testing', 'pro')
-- ON CONFLICT (slug) DO NOTHING;