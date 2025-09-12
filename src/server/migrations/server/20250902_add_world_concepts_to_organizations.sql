-- Migration: Add World Concepts to Organizations
-- This adds lore/canon fields to organizations to support the universe-world model
-- Organizations become "worlds" in the user's universe with their own purpose and rules

-- Add world-concept fields to organizations
ALTER TABLE organizations 
ADD COLUMN lore TEXT,
ADD COLUMN canon JSONB DEFAULT '[]'::jsonb;

-- Add indexes for searching world concepts
CREATE INDEX idx_organizations_lore_gin ON organizations USING gin(to_tsvector('english', lore));
CREATE INDEX idx_organizations_canon_gin ON organizations USING gin(canon);

-- Add comments to document the conceptual model
COMMENT ON COLUMN organizations.lore IS 'World lore: The purpose, mission, and story of this world (organization)';
COMMENT ON COLUMN organizations.canon IS 'World canon: The rules, standards, and boundaries that govern this world';

-- Update organizations table comment
COMMENT ON TABLE organizations IS 'Organizations table - each organization represents a "world" in a user''s universe with its own lore (purpose) and canon (rules)';

-- Populate some example data for existing organizations (optional)
UPDATE organizations 
SET 
    lore = CASE 
        WHEN name LIKE '%Wide Corp%' THEN 'Building innovative solutions for enterprise clients while maintaining work-life balance and continuous learning'
        WHEN type = 'personal' THEN 'Managing personal life areas with intentionality, balance, and alignment with core values'
        ELSE 'Creating value and impact through collaborative work and meaningful relationships'
    END,
    canon = CASE
        WHEN name LIKE '%Wide Corp%' THEN '["Quality over speed", "Customer success first", "Transparent communication", "Continuous learning"]'::jsonb
        WHEN type = 'personal' THEN '["Family time is sacred", "Health is non-negotiable", "Growth mindset always", "Be present and intentional"]'::jsonb  
        ELSE '["Respect and inclusion", "Collaborative decision making", "Quality deliverables", "Open communication"]'::jsonb
    END
WHERE lore IS NULL;