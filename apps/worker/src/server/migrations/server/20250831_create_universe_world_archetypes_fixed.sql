-- Migration: Add Universe and World archetypes to existing constraints and schema
-- Fixes the archetype system to support the new life operating system entities

-- First, update the entity_schemas archetype constraint to include universe and world
ALTER TABLE entity_schemas 
DROP CONSTRAINT IF EXISTS entity_schemas_archetype_check;

ALTER TABLE entity_schemas 
ADD CONSTRAINT entity_schemas_archetype_check 
CHECK (archetype = ANY (ARRAY['universe'::text, 'world'::text, 'project'::text, 'task'::text, 'record'::text, 'document'::text, 'file'::text, 'activity'::text, 'discussion'::text, 'collection'::text]));

-- Update the system_option_sets archetype constraint to include universe and world
ALTER TABLE system_option_sets 
DROP CONSTRAINT IF EXISTS system_option_sets_archetype_check;

ALTER TABLE system_option_sets 
ADD CONSTRAINT system_option_sets_archetype_check 
CHECK (archetype = ANY (ARRAY['universe'::text, 'world'::text, 'project'::text, 'task'::text, 'record'::text, 'document'::text, 'file'::text, 'activity'::text, 'discussion'::text, 'collection'::text]));

-- Create entity schema entries for universe and world archetypes
INSERT INTO entity_schemas (org_id, entity_name, table_name, archetype, business_metadata)
SELECT 
  '00000000-0000-0000-0000-000000000000', -- System-level schema
  'universe',
  'universe',
  'universe',
  '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM entity_schemas 
  WHERE entity_name = 'universe' AND org_id = '00000000-0000-0000-0000-000000000000'
);

INSERT INTO entity_schemas (org_id, entity_name, table_name, archetype, business_metadata)
SELECT 
  '00000000-0000-0000-0000-000000000000', -- System-level schema  
  'world',
  'world',
  'world',
  '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM entity_schemas 
  WHERE entity_name = 'world' AND org_id = '00000000-0000-0000-0000-000000000000'
);

-- Add system option sets for world archetype
INSERT INTO system_option_sets (option_set_type, archetype, name, description, is_active, sort_order)
VALUES 
  -- World state options
  ('status', 'world', 'World States', 'Lifecycle states for worlds', true, 0),
  -- World type options  
  ('category', 'world', 'World Types', 'Categories of worlds (personal, business, etc)', true, 0),
  -- World priority options
  ('priority', 'world', 'World Priorities', 'Priority levels for resource allocation', true, 0)
ON CONFLICT (option_set_type, archetype, name) DO NOTHING;

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
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'developing',
  'Developing', 
  'Building structure and momentum',
  '#fbbf24', -- yellow
  2
FROM system_option_sets sos 
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'active',
  'Active',
  'Primary focus area with regular attention',
  '#22c55e', -- green
  3
FROM system_option_sets sos 
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'paused',
  'Paused',
  'Temporarily inactive but not abandoned',
  '#f97316', -- orange
  4
FROM system_option_sets sos 
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'archived',
  'Archived',
  'Completed or permanently inactive',
  '#6b7280', -- gray
  5
FROM system_option_sets sos 
WHERE sos.option_set_type = 'status' AND sos.archetype = 'world' AND sos.name = 'World States'
ON CONFLICT (option_set_id, value) DO NOTHING;

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
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'business',
  'Business',
  'Business departments or functional areas',
  '#3b82f6', -- blue
  2
FROM system_option_sets sos 
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'client',
  'Client',
  'Client-specific work and projects',
  '#10b981', -- emerald
  3
FROM system_option_sets sos 
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'department',
  'Department',
  'Organizational departments',
  '#f59e0b', -- amber
  4
FROM system_option_sets sos 
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'project_domain',
  'Project Domain',
  'Specific project or initiative domains',
  '#ef4444', -- red
  5
FROM system_option_sets sos 
WHERE sos.option_set_type = 'category' AND sos.archetype = 'world' AND sos.name = 'World Types'
ON CONFLICT (option_set_id, value) DO NOTHING;

-- Add system option values for world priorities
INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'low',
  'Low Priority',
  'Minimal resource allocation',
  '#94a3b8', -- gray
  1
FROM system_option_sets sos 
WHERE sos.option_set_type = 'priority' AND sos.archetype = 'world' AND sos.name = 'World Priorities'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'medium',
  'Medium Priority',
  'Standard resource allocation',
  '#fbbf24', -- yellow
  2
FROM system_option_sets sos 
WHERE sos.option_set_type = 'priority' AND sos.archetype = 'world' AND sos.name = 'World Priorities'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'high',
  'High Priority',
  'Increased resource allocation',
  '#f97316', -- orange
  3
FROM system_option_sets sos 
WHERE sos.option_set_type = 'priority' AND sos.archetype = 'world' AND sos.name = 'World Priorities'
ON CONFLICT (option_set_id, value) DO NOTHING;

INSERT INTO system_options (option_set_id, value, label, description, color, sort_order)
SELECT 
  sos.id,
  'critical',
  'Critical Priority',
  'Maximum resource allocation',
  '#ef4444', -- red
  4
FROM system_option_sets sos 
WHERE sos.option_set_type = 'priority' AND sos.archetype = 'world' AND sos.name = 'World Priorities'
ON CONFLICT (option_set_id, value) DO NOTHING;