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
('status', 'project', 'Project Status', 'Standard status workflow for projects'),
('category', 'project', 'Project Category', 'Standard project categories');

-- Task archetype system options  
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('priority', 'task', 'Task Priority', 'Standard priority levels for tasks'),
('status', 'task', 'Task Status', 'Standard status workflow for tasks'),
('category', 'task', 'Task Category', 'Standard task categories');

-- Record archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('priority', 'record', 'Record Priority', 'Standard priority levels for records'),
('status', 'record', 'Record Status', 'Standard status workflow for records'),
('category', 'record', 'Record Category', 'Standard record categories');

-- Document archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'document', 'Document Status', 'Standard status workflow for documents'),
('category', 'document', 'Document Category', 'Standard document categories');

-- File archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'file', 'File Status', 'Standard status workflow for files'),
('category', 'file', 'File Category', 'Standard file categories');

-- Activity archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'activity', 'Activity Status', 'Standard status workflow for activities'),
('category', 'activity', 'Activity Category', 'Standard activity categories');

-- Discussion archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'discussion', 'Discussion Status', 'Standard status workflow for discussions'),
('category', 'discussion', 'Discussion Category', 'Standard discussion categories');

-- Collection archetype system options
INSERT INTO system_option_sets (option_set_type, archetype, name, description) VALUES
('status', 'collection', 'Collection Status', 'Standard status workflow for collections'),
('category', 'collection', 'Collection Category', 'Standard collection categories');

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

-- Project Status Options
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'planning', 'Planning', 'Project in planning phase', '#6b7280', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project'
UNION ALL
SELECT id, 'active', 'Active', 'Project is actively being worked on', '#22c55e', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project'
UNION ALL
SELECT id, 'on_hold', 'On Hold', 'Project is temporarily paused', '#f59e0b', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project'
UNION ALL
SELECT id, 'completed', 'Completed', 'Project has been completed', '#10b981', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project'
UNION ALL
SELECT id, 'cancelled', 'Cancelled', 'Project has been cancelled', '#ef4444', 5
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'project';

-- Project Category Options  
INSERT INTO system_options (option_set_id, value, label, description, sort_order)
SELECT id, 'software', 'Software Development', 'Software development projects', 1
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'project'
UNION ALL
SELECT id, 'research', 'Research', 'Research and development projects', 2
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'project'
UNION ALL
SELECT id, 'marketing', 'Marketing', 'Marketing and promotional projects', 3
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'project'
UNION ALL
SELECT id, 'operational', 'Operational', 'Operational improvement projects', 4
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'project'
UNION ALL
SELECT id, 'strategic', 'Strategic', 'Strategic business projects', 5
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'project';

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

-- Task Status Options
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT id, 'backlog', 'Backlog', 'Task is in backlog', '#6b7280', 1
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task'
UNION ALL
SELECT id, 'todo', 'To Do', 'Task is ready to start', '#3b82f6', 2
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task'
UNION ALL
SELECT id, 'in_progress', 'In Progress', 'Task is being worked on', '#f59e0b', 3
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task'
UNION ALL
SELECT id, 'review', 'In Review', 'Task is under review', '#8b5cf6', 4
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task'
UNION ALL
SELECT id, 'testing', 'Testing', 'Task is being tested', '#06b6d4', 5
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task'
UNION ALL
SELECT id, 'done', 'Done', 'Task is completed', '#10b981', 6
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task'
UNION ALL
SELECT id, 'blocked', 'Blocked', 'Task is blocked', '#ef4444', 7
FROM system_option_sets WHERE option_set_type = 'status' AND archetype = 'task';

-- Task Category Options
INSERT INTO system_options (option_set_id, value, label, description, sort_order)
SELECT id, 'feature', 'Feature', 'New feature development', 1
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'task'
UNION ALL
SELECT id, 'bug_fix', 'Bug Fix', 'Bug fixes and corrections', 2
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'task'
UNION ALL
SELECT id, 'research', 'Research', 'Research and investigation tasks', 3
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'task'
UNION ALL
SELECT id, 'documentation', 'Documentation', 'Documentation tasks', 4
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'task'
UNION ALL
SELECT id, 'testing', 'Testing', 'Testing and QA tasks', 5
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'task'
UNION ALL
SELECT id, 'deployment', 'Deployment', 'Deployment and release tasks', 6
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'task'
UNION ALL
SELECT id, 'meeting', 'Meeting', 'Meeting and discussion tasks', 7
FROM system_option_sets WHERE option_set_type = 'category' AND archetype = 'task';

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