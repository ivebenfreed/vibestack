-- Migration: Create system and custom option tables for reference-based field types
-- This implements the archetype option system with system defaults and org-specific customization

-- System option sets - shared defaults across all organizations
CREATE TABLE IF NOT EXISTS system_option_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_set_type TEXT NOT NULL, -- priority, status, category, discussion_type, etc.
  archetype TEXT NOT NULL CHECK (archetype IN ('project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection')),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(option_set_type, archetype, name)
);

-- System option values - the actual option values for system option sets
CREATE TABLE IF NOT EXISTS system_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_set_id UUID NOT NULL REFERENCES system_option_sets(id) ON DELETE CASCADE,
  value TEXT NOT NULL, -- stored value (e.g., 'high', 'active')
  label TEXT NOT NULL, -- display label (e.g., 'High Priority', 'Active')
  description TEXT,
  color TEXT, -- optional color for UI (e.g., '#ff0000' for high priority)
  icon TEXT, -- optional icon name
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}', -- additional option metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(option_set_id, value)
);

-- Custom option sets - organization-specific option sets
CREATE TABLE IF NOT EXISTS custom_option_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  option_set_type TEXT NOT NULL, -- priority, status, category, or custom types
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, option_set_type, name)
);

-- Custom option values - organization-specific option values
CREATE TABLE IF NOT EXISTS custom_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_set_id UUID NOT NULL REFERENCES custom_option_sets(id) ON DELETE CASCADE,
  value TEXT NOT NULL, -- stored value
  label TEXT NOT NULL, -- display label
  description TEXT,
  color TEXT, -- optional color for UI
  icon TEXT, -- optional icon name
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}', -- additional option metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(option_set_id, value)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_system_option_sets_type_archetype ON system_option_sets(option_set_type, archetype);
CREATE INDEX IF NOT EXISTS idx_system_options_set_id ON system_options(option_set_id);
CREATE INDEX IF NOT EXISTS idx_system_options_value ON system_options(value);

CREATE INDEX IF NOT EXISTS idx_custom_option_sets_org_type ON custom_option_sets(org_id, option_set_type);
CREATE INDEX IF NOT EXISTS idx_custom_options_set_id ON custom_options(option_set_id);
CREATE INDEX IF NOT EXISTS idx_custom_options_value ON custom_options(value);

-- Insert system option sets for each archetype
-- Project archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('priority', 'project', 'Project Priority', 'Standard priority levels for projects'),
('status', 'project', 'Project Status', 'Standard status workflow for projects');

-- Task archetype system options  
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('priority', 'task', 'Task Priority', 'Standard priority levels for tasks'),
('status', 'task', 'Task Status', 'Standard status workflow for tasks');

-- Record archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'record', 'Record Status', 'Standard status workflow for records');

-- Document archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'document', 'Document Status', 'Standard status workflow for documents');

-- File archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'file', 'File Status', 'Standard status workflow for files');

-- Activity archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'activity', 'Activity Status', 'Standard status workflow for activities');

-- Discussion archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'discussion', 'Discussion Status', 'Standard status workflow for discussions');

-- Collection archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'collection', 'Collection Status', 'Standard status workflow for collections');

-- Insert system option values
-- Project Priority Options
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'low', 'Low Priority', 'Low priority projects', '#22c55e', 1
FROM system_option_sets WHERE option_set_type = 'priority' AND archetype = 'project'
UNION ALL
SELECT id, 'medium', 'Medium Priority', 'Medium priority projects', '#f59e0b', 2  
FROM system_option_sets WHERE option_set_type = 'priority' AND archetype = 'project'
UNION ALL
SELECT id, 'high', 'High Priority', 'High priority projects', '#ef4444', 3
FROM system_option_sets WHERE option_set_type = 'priority' AND archetype = 'project'
UNION ALL
SELECT id, 'critical', 'Critical Priority', 'Critical priority projects', '#dc2626', 4
FROM system_option_sets WHERE option_set_type = 'priority' AND archetype = 'project';

-- Project Status Options (semantic states)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'not_started', 'Not Started', 'Project has not begun yet', '#6b7280', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project'
UNION ALL
SELECT id, 'active', 'Active', 'Project is actively being worked on', '#22c55e', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project'
UNION ALL
SELECT id, 'paused', 'Paused', 'Project is temporarily paused', '#f59e0b', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project'
UNION ALL
SELECT id, 'done', 'Done', 'Project has been completed', '#10b981', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project'
UNION ALL
SELECT id, 'cancelled', 'Cancelled', 'Project has been cancelled', '#ef4444', 5
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project';

-- Project category options removed - now org-specific only since categories vary by organization

-- Task Priority Options (same as project)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'low', 'Low Priority', 'Low priority tasks', '#22c55e', 1
FROM system_option_sets WHERE option_set_type = 'priority' AND archetype = 'task'
UNION ALL
SELECT id, 'medium', 'Medium Priority', 'Medium priority tasks', '#f59e0b', 2
FROM system_option_sets WHERE option_set_type = 'priority' AND archetype = 'task'
UNION ALL
SELECT id, 'high', 'High Priority', 'High priority tasks', '#ef4444', 3
FROM system_option_sets WHERE option_set_type = 'priority' AND archetype = 'task'
UNION ALL
SELECT id, 'critical', 'Critical Priority', 'Critical priority tasks', '#dc2626', 4
FROM system_option_sets WHERE option_set_type = 'priority' AND archetype = 'task';

-- Task Status Options (semantic workflow states)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'not_started', 'Not Started', 'Task has not been started yet', '#6b7280', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task'
UNION ALL
SELECT id, 'active', 'Active', 'Task is actively being worked on', '#f59e0b', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task'
UNION ALL
SELECT id, 'done', 'Done', 'Task is completed', '#10b981', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task'
UNION ALL
SELECT id, 'blocked', 'Blocked', 'Task is blocked by dependencies', '#ef4444', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task';

-- Task category options removed - now org-specific only since categories vary by organization

-- Record Status Options (data lifecycle states)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'draft', 'Draft', 'Record is in draft state', '#6b7280', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'record'
UNION ALL
SELECT id, 'active', 'Active', 'Record is active and in use', '#10b981', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'record'
UNION ALL
SELECT id, 'inactive', 'Inactive', 'Record is inactive but preserved', '#f59e0b', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'record'
UNION ALL
SELECT id, 'archived', 'Archived', 'Record is archived for historical reference', '#6b7280', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'record';

-- Document Status Options (publishing workflow states)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'draft', 'Draft', 'Document is in draft state', '#6b7280', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'document'
UNION ALL
SELECT id, 'review', 'Under Review', 'Document is under review', '#f59e0b', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'document'
UNION ALL
SELECT id, 'published', 'Published', 'Document is published and available', '#10b981', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'document'
UNION ALL
SELECT id, 'archived', 'Archived', 'Document is archived', '#6b7280', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'document';

-- File Status Options (file lifecycle states)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'uploading', 'Uploading', 'File is being uploaded', '#3b82f6', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'file'
UNION ALL
SELECT id, 'available', 'Available', 'File is available for use', '#10b981', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'file'
UNION ALL
SELECT id, 'processing', 'Processing', 'File is being processed', '#f59e0b', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'file'
UNION ALL
SELECT id, 'archived', 'Archived', 'File is archived', '#6b7280', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'file';

-- Activity Status Options (activity lifecycle states)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'scheduled', 'Scheduled', 'Activity is scheduled', '#6b7280', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'activity'
UNION ALL
SELECT id, 'active', 'Active', 'Activity is currently active', '#10b981', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'activity'
UNION ALL
SELECT id, 'completed', 'Completed', 'Activity is completed', '#10b981', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'activity'
UNION ALL
SELECT id, 'cancelled', 'Cancelled', 'Activity was cancelled', '#ef4444', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'activity';

-- Discussion Status Options (discussion lifecycle states)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'open', 'Open', 'Discussion is open for participation', '#10b981', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'discussion'
UNION ALL
SELECT id, 'active', 'Active', 'Discussion is actively ongoing', '#3b82f6', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'discussion'
UNION ALL
SELECT id, 'resolved', 'Resolved', 'Discussion has been resolved', '#10b981', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'discussion'
UNION ALL
SELECT id, 'closed', 'Closed', 'Discussion is closed', '#6b7280', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'discussion';

-- Collection Status Options (collection lifecycle states)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'draft', 'Draft', 'Collection is in draft state', '#6b7280', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'collection'
UNION ALL
SELECT id, 'active', 'Active', 'Collection is active', '#10b981', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'collection'
UNION ALL
SELECT id, 'complete', 'Complete', 'Collection is complete', '#10b981', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'collection'
UNION ALL
SELECT id, 'archived', 'Archived', 'Collection is archived', '#6b7280', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'collection';

-- Comments for documentation
COMMENT ON TABLE system_option_sets IS 'System-wide option sets shared across all organizations for each archetype';
COMMENT ON TABLE system_options IS 'System option values with labels, colors, and metadata';
COMMENT ON TABLE custom_option_sets IS 'Organization-specific option sets that can extend or override system options';
COMMENT ON TABLE custom_options IS 'Organization-specific option values with custom labels and styling';

COMMENT ON COLUMN system_option_sets.option_set_type IS 'Type of option set: priority, status, category, discussion_type, etc.';
COMMENT ON COLUMN system_option_sets.archetype IS 'Which archetype this option set applies to';
COMMENT ON COLUMN system_options.value IS 'The stored value in entity fields (e.g., "high", "active")';
COMMENT ON COLUMN system_options.label IS 'The display label shown in UI (e.g., "High Priority", "Active")';
COMMENT ON COLUMN system_options.color IS 'Hex color code for UI styling (e.g., "#ef4444" for red)';