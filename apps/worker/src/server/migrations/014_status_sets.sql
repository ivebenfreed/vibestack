-- Status Set Management System
-- 
-- This migration creates the infrastructure for managing reusable status sets
-- that can be shared across multiple entities within an organization.

-- Table for storing status sets (collections of status values)
CREATE TABLE dataforge_status_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT, -- Optional: restrict to specific entity types like 'task', 'project'
  status_values JSONB NOT NULL, -- Array of status objects with value, label, color, etc.
  is_system_default BOOLEAN DEFAULT false, -- System-provided defaults (protected)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by UUID,
  
  -- Ensure unique names per org and optional entity type
  UNIQUE(organization_id, name, entity_type),
  
  -- Validation: status_values must be valid JSON array
  CONSTRAINT valid_status_values CHECK (jsonb_typeof(status_values) = 'array'),
  CONSTRAINT non_empty_status_values CHECK (jsonb_array_length(status_values) > 0)
);

-- Table for tracking which entities use which status sets
CREATE TABLE dataforge_entity_status_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  status_set_id UUID NOT NULL REFERENCES dataforge_status_sets(id) ON DELETE RESTRICT,
  field_name TEXT NOT NULL DEFAULT 'status', -- Usually 'status' but could be custom
  created_at TIMESTAMP DEFAULT now(),
  created_by UUID,
  
  -- Ensure one status field per entity (prevent multiple status fields)
  UNIQUE(organization_id, entity_name, field_name)
);

-- Indexes for performance
CREATE INDEX idx_status_sets_org ON dataforge_status_sets(organization_id);
CREATE INDEX idx_status_sets_entity_type ON dataforge_status_sets(entity_type);
CREATE INDEX idx_status_sets_active ON dataforge_status_sets(organization_id, is_active);
CREATE INDEX idx_entity_status_sets_org_entity ON dataforge_entity_status_sets(organization_id, entity_name);

-- Insert default status sets for each archetype
INSERT INTO dataforge_status_sets (organization_id, name, description, entity_type, status_values, is_system_default) VALUES
-- Task status set
('*', 'Task Workflow', 'Standard task management workflow', 'task', '[
  {"value": "not_started", "label": "Not Started", "color": "#6b7280", "backgroundColor": "#f3f4f6", "icon": "circle", "workflowCategory": "not_active"},
  {"value": "active", "label": "Active", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "in_progress"},
  {"value": "done", "label": "Done", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "done"},
  {"value": "blocked", "label": "Blocked", "color": "#dc2626", "backgroundColor": "#fee2e2", "icon": "x-circle", "workflowCategory": "closed"},
  {"value": "cancelled", "label": "Cancelled", "color": "#6b7280", "backgroundColor": "#f9fafb", "icon": "x", "workflowCategory": "closed"}
]', true),

-- Project status set
('*', 'Project Lifecycle', 'Standard project management lifecycle', 'project', '[
  {"value": "not_started", "label": "Not Started", "color": "#6b7280", "backgroundColor": "#f3f4f6", "icon": "circle", "workflowCategory": "not_active"},
  {"value": "active", "label": "Active", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "in_progress"},
  {"value": "paused", "label": "Paused", "color": "#d97706", "backgroundColor": "#fef3c7", "icon": "pause-circle", "workflowCategory": "in_progress"},
  {"value": "done", "label": "Done", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "done"},
  {"value": "cancelled", "label": "Cancelled", "color": "#6b7280", "backgroundColor": "#f9fafb", "icon": "x", "workflowCategory": "closed"}
]', true),

-- Document status set
('*', 'Document Publishing', 'Standard document publishing workflow', 'document', '[
  {"value": "draft", "label": "Draft", "color": "#6b7280", "backgroundColor": "#f3f4f6", "icon": "edit", "workflowCategory": "not_active"},
  {"value": "review", "label": "In Review", "color": "#d97706", "backgroundColor": "#fef3c7", "icon": "clock", "workflowCategory": "in_progress"},
  {"value": "published", "label": "Published", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "done"},
  {"value": "archived", "label": "Archived", "color": "#4b5563", "backgroundColor": "#e5e7eb", "icon": "archive", "workflowCategory": "closed"}
]', true),

-- File status set
('*', 'File Lifecycle', 'Standard file management lifecycle', 'file', '[
  {"value": "uploading", "label": "Uploading", "color": "#d97706", "backgroundColor": "#fef3c7", "icon": "upload", "workflowCategory": "not_active"},
  {"value": "available", "label": "Available", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "done"},
  {"value": "processing", "label": "Processing", "color": "#d97706", "backgroundColor": "#fef3c7", "icon": "clock", "workflowCategory": "in_progress"},
  {"value": "archived", "label": "Archived", "color": "#4b5563", "backgroundColor": "#e5e7eb", "icon": "archive", "workflowCategory": "closed"}
]', true),

-- Record status set
('*', 'Record Status', 'Standard record data states', 'record', '[
  {"value": "draft", "label": "Draft", "color": "#6b7280", "backgroundColor": "#f3f4f6", "icon": "edit", "workflowCategory": "not_active"},
  {"value": "active", "label": "Active", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "in_progress"},
  {"value": "inactive", "label": "Inactive", "color": "#6b7280", "backgroundColor": "#f3f4f6", "icon": "pause", "workflowCategory": "closed"},
  {"value": "archived", "label": "Archived", "color": "#4b5563", "backgroundColor": "#e5e7eb", "icon": "archive", "workflowCategory": "closed"}
]', true),

-- Activity status set
('*', 'Activity Scheduling', 'Standard activity scheduling workflow', 'activity', '[
  {"value": "scheduled", "label": "Scheduled", "color": "#6b7280", "backgroundColor": "#f3f4f6", "icon": "calendar", "workflowCategory": "not_active"},
  {"value": "active", "label": "Active", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "in_progress"},
  {"value": "completed", "label": "Completed", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "done"},
  {"value": "cancelled", "label": "Cancelled", "color": "#6b7280", "backgroundColor": "#f9fafb", "icon": "x", "workflowCategory": "closed"}
]', true),

-- Discussion status set
('*', 'Discussion States', 'Standard discussion thread states', 'discussion', '[
  {"value": "open", "label": "Open", "color": "#6b7280", "backgroundColor": "#f3f4f6", "icon": "message-circle", "workflowCategory": "not_active"},
  {"value": "active", "label": "Active", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "in_progress"},
  {"value": "resolved", "label": "Resolved", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "done"},
  {"value": "closed", "label": "Closed", "color": "#4b5563", "backgroundColor": "#e5e7eb", "icon": "x", "workflowCategory": "closed"}
]', true),

-- Collection status set
('*', 'Collection States', 'Standard collection lifecycle states', 'collection', '[
  {"value": "draft", "label": "Draft", "color": "#6b7280", "backgroundColor": "#f3f4f6", "icon": "edit", "workflowCategory": "not_active"},
  {"value": "active", "label": "Active", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "in_progress"},
  {"value": "complete", "label": "Complete", "color": "#059669", "backgroundColor": "#d1fae5", "icon": "check-circle", "workflowCategory": "done"},
  {"value": "archived", "label": "Archived", "color": "#4b5563", "backgroundColor": "#e5e7eb", "icon": "archive", "workflowCategory": "closed"}
]', true);

-- Function to copy system defaults to organization when needed
CREATE OR REPLACE FUNCTION copy_system_status_sets_to_org(target_org_id TEXT, entity_type_filter TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER := 0;
  row_count_val INTEGER;
  status_set_record RECORD;
BEGIN
  FOR status_set_record IN 
    SELECT name, description, entity_type, status_values 
    FROM dataforge_status_sets 
    WHERE organization_id = '*' 
      AND is_system_default = true
      AND (entity_type_filter IS NULL OR entity_type = entity_type_filter)
  LOOP
    INSERT INTO dataforge_status_sets (organization_id, name, description, entity_type, status_values, is_system_default)
    VALUES (target_org_id, status_set_record.name, status_set_record.description, status_set_record.entity_type, status_set_record.status_values, false)
    ON CONFLICT (organization_id, name, entity_type) DO NOTHING;
    
    GET DIAGNOSTICS row_count_val = ROW_COUNT;
    inserted_count = inserted_count + row_count_val;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;