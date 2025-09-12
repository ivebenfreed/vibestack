-- Unified Relationship Fields System
-- 
-- Single table approach matching the options system pattern:
-- - Auto-populated from archetype templates during entity creation
-- - Single API endpoint (no system/custom distinction)
-- - Deletion protection via validation guards only
-- - Organizations can add custom relationship fields

-- Drop the existing table if it exists (since we're changing the approach)
DROP TABLE IF EXISTS dataforge_relationship_fields CASCADE;

-- Create unified relationship fields table
CREATE TABLE IF NOT EXISTS dataforge_relationship_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  entity_type VARCHAR(100) NOT NULL,        -- 'Task', 'Project', etc.
  field_name VARCHAR(100) NOT NULL,         -- 'assignee_id', 'reviewer_id', etc.
  field_type VARCHAR(50) NOT NULL,          -- 'user_reference', 'entity_reference'
  relationship_type VARCHAR(100) NOT NULL,  -- 'assigned_to', 'reviewed_by', etc.
  target_entity_type VARCHAR(100),          -- 'User', 'Project', 'CustomEntity'
  cardinality VARCHAR(50) DEFAULT 'many-to-many',
  
  -- Display customization (always editable by organizations)
  display_name VARCHAR(200),                -- 'Assignee', 'Code Reviewer'
  description TEXT,
  ui_config JSONB DEFAULT '{}',             -- Icons, colors, display settings
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- System protection and validation rules
  system_protected BOOLEAN DEFAULT false,   -- True for archetype-required fields
  validation_rules JSONB DEFAULT '{}',      -- Validation and behavior rules
  default_behavior JSONB DEFAULT '{}',      -- Default values and auto-assignment
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Unique constraint per organization
  UNIQUE(org_id, entity_type, field_name)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_dataforge_relationship_fields_org_entity 
  ON dataforge_relationship_fields (org_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_dataforge_relationship_fields_active 
  ON dataforge_relationship_fields (org_id, entity_type, is_active);

CREATE INDEX IF NOT EXISTS idx_dataforge_relationship_fields_system 
  ON dataforge_relationship_fields (system_protected);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dataforge_relationship_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_dataforge_relationship_fields_updated_at_trigger 
  ON dataforge_relationship_fields;
CREATE TRIGGER update_dataforge_relationship_fields_updated_at_trigger
  BEFORE UPDATE ON dataforge_relationship_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_dataforge_relationship_fields_updated_at();

-- Add comments for documentation
COMMENT ON TABLE dataforge_relationship_fields IS 'Unified relationship field configurations for entities - auto-populated from archetypes with deletion protection';
COMMENT ON COLUMN dataforge_relationship_fields.system_protected IS 'Prevents deletion of archetype-required relationship fields';
COMMENT ON COLUMN dataforge_relationship_fields.field_name IS 'Original field name from archetype or custom definition (for frontend convenience)';
COMMENT ON COLUMN dataforge_relationship_fields.display_name IS 'Human-readable name for UI display (customizable)';
COMMENT ON COLUMN dataforge_relationship_fields.ui_config IS 'Frontend display configuration: icons, colors, etc.';
COMMENT ON COLUMN dataforge_relationship_fields.validation_rules IS 'Validation rules: {"max_relationships": 1, "can_change": true, "required": false, "unique_per_entity": true}';
COMMENT ON COLUMN dataforge_relationship_fields.default_behavior IS 'Default behavior: {"auto_assign_creator": true, "default_value": "current_user", "inherit_from_parent": false}';