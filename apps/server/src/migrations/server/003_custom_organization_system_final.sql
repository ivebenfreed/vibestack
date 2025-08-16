-- Final Custom Organization System Migration
-- Uses correct data types to match Better Auth schema

-- Clean up any partial tables
DROP TABLE IF EXISTS organization_audit_logs CASCADE;
DROP TABLE IF EXISTS organization_invitations CASCADE;  
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Main organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- Business Information
    industry VARCHAR(100),
    company_size VARCHAR(50),
    website_url VARCHAR(500),
    country VARCHAR(2), -- ISO country code
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Subscription & Billing
    subscription_tier VARCHAR(50) DEFAULT 'free' 
        CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    subscription_status VARCHAR(50) DEFAULT 'active' 
        CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
    billing_email VARCHAR(255),
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    
    -- Limits & Features
    max_users INTEGER DEFAULT 5,
    max_projects INTEGER DEFAULT 3,
    storage_limit_gb INTEGER DEFAULT 1,
    api_rate_limit INTEGER DEFAULT 1000,
    
    -- Configuration
    settings JSONB DEFAULT '{}',
    sso_enabled BOOLEAN DEFAULT FALSE,
    enforce_2fa BOOLEAN DEFAULT FALSE,
    allowed_domains TEXT[], -- Array of allowed email domains
    
    -- Branding
    logo_url VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Organization members table with correct text IDs to match Better Auth
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, -- TEXT to match Better Auth
    
    -- Role System (standard 5 roles for V1)
    role VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    
    -- Member Status
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, pending, suspended
    invited_by TEXT REFERENCES "user"(id), -- TEXT to match Better Auth
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

-- Organization invitations with correct text user references
CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Invitation Details
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    invited_by TEXT NOT NULL REFERENCES "user"(id), -- TEXT to match Better Auth
    
    -- Token & Security
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, expired, cancelled
    accepted_at TIMESTAMPTZ,
    accepted_by TEXT REFERENCES "user"(id), -- TEXT to match Better Auth
    
    -- Metadata
    personal_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One pending invitation per email per organization (allow multiple with different statuses)
    UNIQUE(organization_id, email, status) DEFERRABLE INITIALLY DEFERRED
);

-- Organization audit log for compliance and security
CREATE TABLE organization_audit_logs (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Action Details
    action VARCHAR(100) NOT NULL, -- 'member_added', 'role_changed', 'settings_updated', etc.
    actor_id TEXT REFERENCES "user"(id), -- TEXT to match Better Auth
    target_type VARCHAR(50), -- 'user', 'organization', 'project', etc.
    target_id TEXT, -- ID of the affected entity (using TEXT for flexibility)
    
    -- Context
    details JSONB DEFAULT '{}', -- Action-specific details
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);
CREATE INDEX idx_organization_members_status ON organization_members(status);

CREATE INDEX idx_organization_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX idx_organization_invitations_status ON organization_invitations(status);
CREATE INDEX idx_organization_invitations_expires_at ON organization_invitations(expires_at);

CREATE INDEX idx_organization_audit_logs_org_id ON organization_audit_logs(organization_id);
CREATE INDEX idx_organization_audit_logs_action ON organization_audit_logs(action);
CREATE INDEX idx_organization_audit_logs_actor_id ON organization_audit_logs(actor_id);
CREATE INDEX idx_organization_audit_logs_created_at ON organization_audit_logs(created_at);

-- Create triggers for auto-updating timestamps (reuse existing function)
CREATE TRIGGER trigger_organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_updated_at();

CREATE TRIGGER trigger_organization_invitations_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_updated_at();

-- Show success message
SELECT 'Custom organization system tables created successfully!' AS result;