-- Add default and last-used organization fields to user table
-- This enables server-side organization context management

-- Add organization preference columns to user table
ALTER TABLE "user" 
ADD COLUMN default_organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
ADD COLUMN last_used_organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
ADD COLUMN last_org_access_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX idx_user_default_organization_id ON "user"(default_organization_id);
CREATE INDEX idx_user_last_used_organization_id ON "user"(last_used_organization_id);
CREATE INDEX idx_user_last_org_access_at ON "user"(last_org_access_at);

-- Function to automatically set default organization for new members
CREATE OR REPLACE FUNCTION set_default_organization_for_new_member()
RETURNS TRIGGER AS $$
BEGIN
    -- When a user joins their first organization, set it as default
    UPDATE "user" 
    SET 
        default_organization_id = COALESCE(default_organization_id, NEW.organization_id),
        last_used_organization_id = NEW.organization_id,
        last_org_access_at = NOW()
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set default org when user joins an organization
CREATE TRIGGER trigger_set_default_organization_for_new_member
    AFTER INSERT ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION set_default_organization_for_new_member();

-- Function to update last org access when switching organizations
CREATE OR REPLACE FUNCTION update_user_org_access(
    p_user_id TEXT,
    p_organization_id TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE "user" 
    SET 
        last_used_organization_id = p_organization_id,
        last_org_access_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to set user's default organization
CREATE OR REPLACE FUNCTION set_user_default_organization(
    p_user_id TEXT,
    p_organization_id TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Verify user is a member of the organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE user_id = p_user_id 
        AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'User is not an active member of organization';
    END IF;
    
    UPDATE "user" 
    SET 
        default_organization_id = p_organization_id,
        last_used_organization_id = p_organization_id,
        last_org_access_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Set default organization for existing users (their first organization they're a member of)
UPDATE "user" 
SET 
    default_organization_id = subquery.first_org_id,
    last_used_organization_id = subquery.first_org_id,
    last_org_access_at = NOW()
FROM (
    SELECT 
        om.user_id,
        MIN(om.organization_id) as first_org_id
    FROM organization_members om
    GROUP BY om.user_id
) subquery
WHERE "user".id = subquery.user_id
AND "user".default_organization_id IS NULL;

-- Show success message
SELECT 'User default organization system added successfully!' AS result;