-- Migration: Create Universe and World archetype tables
-- Implements the life operating system hierarchy: User → Universe → World → Project → Task

-- Update system option sets to include new archetypes
UPDATE system_option_sets 
SET archetype = replace(archetype, 'CHECK (archetype IN (''project'', ''task'', ''record'', ''document'', ''file'', ''activity'', ''discussion'', ''collection''))', 
                       'CHECK (archetype IN (''universe'', ''world'', ''project'', ''task'', ''record'', ''document'', ''file'', ''activity'', ''discussion'', ''collection''))') 
WHERE archetype LIKE '%CHECK%';

-- First, let's create the entity schemas entries for our new archetypes
INSERT INTO entity_schemas (organization_id, entity_name, archetype, custom_fields, is_active, created_at, updated_at)
SELECT 
  '00000000-0000-0000-0000-000000000000', -- System-level schema
  'universe',
  'universe',
  '[]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM entity_schemas 
  WHERE entity_name = 'universe' AND organization_id = '00000000-0000-0000-0000-000000000000'
);

INSERT INTO entity_schemas (organization_id, entity_name, archetype, custom_fields, is_active, created_at, updated_at)
SELECT 
  '00000000-0000-0000-0000-000000000000', -- System-level schema  
  'world',
  'world',
  '[]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM entity_schemas 
  WHERE entity_name = 'world' AND organization_id = '00000000-0000-0000-0000-000000000000'
);

-- Add system option sets for world archetype
INSERT INTO system_option_sets (option_set_type, archetype, name, description, is_active, sort_order)
VALUES 
  -- World state options
  ('status', 'world', 'World States', 'Lifecycle states for worlds', true, 0),
  -- World type options  
  ('category', 'world', 'World Types', 'Categories of worlds (personal, business, etc)', true, 0),
  -- World priority options
  ('priority', 'world', 'World Priorities', 'Priority levels for resource allocation', true, 0);

-- Add system option values for world states
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'exploring',
  'Exploring',
  'Early stage - discovering possibilities',
  '#94a3b8', -- gray
  1
FROM system_option_sets sos 
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'developing',
  'Developing', 
  'Building structure and momentum',
  '#fbbf24', -- yellow
  2
FROM system_option_sets sos 
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'active',
  'Active',
  'Primary focus area with regular attention',
  '#22c55e', -- green
  3
FROM system_option_sets sos 
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'paused',
  'Paused',
  'Temporarily inactive but not abandoned',
  '#f97316', -- orange
  4
FROM system_option_sets sos 
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'archived',
  'Archived',
  'Completed or permanently inactive',
  '#6b7280', -- gray
  5
FROM system_option_sets sos 
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States';

-- Add system option values for world types
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'personal',
  'Personal',
  'Personal life areas (health, family, hobbies)',
  '#8b5cf6', -- purple
  1
FROM system_option_sets sos 
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'business',
  'Business',
  'Business departments or functional areas',
  '#3b82f6', -- blue
  2
FROM system_option_sets sos 
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'client',
  'Client',
  'Client-specific work and projects',
  '#10b981', -- emerald
  3
FROM system_option_sets sos 
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'department',
  'Department',
  'Organizational departments',
  '#f59e0b', -- amber
  4
FROM system_option_sets sos 
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'project_domain',
  'Project Domain',
  'Specific project or initiative domains',
  '#ef4444', -- red
  5
FROM system_option_sets sos 
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types';

-- Add system option values for world priorities (reuse existing priority system)
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'low',
  'Low Priority',
  'Minimal resource allocation',
  '#94a3b8', -- gray
  1
FROM system_option_sets sos 
WHERE sos.option_set_type = 'priority' AND sos.archetype = 'world' AND sos.name = 'World Priorities';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'medium',
  'Medium Priority',
  'Standard resource allocation',
  '#fbbf24', -- yellow
  2
FROM system_option_sets sos 
WHERE sos.option_set_type = 'priority' AND sos.archetype = 'world' AND sos.name = 'World Priorities';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'high',
  'High Priority',
  'Increased resource allocation',
  '#f97316', -- orange
  3
FROM system_option_sets sos 
WHERE sos.option_set_type = 'priority' AND sos.archetype = 'world' AND sos.name = 'World Priorities';

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'critical',
  'Critical Priority',
  'Maximum resource allocation',
  '#ef4444', -- red
  4
FROM system_option_sets sos 
WHERE sos.option_set_type = 'priority' AND sos.archetype = 'world' AND sos.name = 'World Priorities';