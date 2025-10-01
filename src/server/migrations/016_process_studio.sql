-- Migration 016: Process Studio System Tables
-- BPMN 2.0 compliant business process modeling system

-- Process Definitions (BPMN Diagrams)
CREATE TABLE IF NOT EXISTS process_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                          -- 'operational', 'management', 'support'
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,

  -- BPMN 2.0 Data
  bpmn_xml TEXT,                          -- Standard BPMN 2.0 XML (future)
  diagram_json JSONB NOT NULL DEFAULT '{}', -- ReactFlow diagram state

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  published_by TEXT,

  CONSTRAINT unique_process_version UNIQUE(organization_id, name, version)
);

-- Process Nodes (Tasks, Gateways, Events)
CREATE TABLE IF NOT EXISTS process_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES process_definitions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,

  -- Node Identity
  node_key TEXT NOT NULL,                 -- Unique within process: 'task_1', 'gateway_2'
  node_type TEXT NOT NULL,                -- BPMN types: 'task', 'user_task', 'exclusive_gateway', etc.
  label TEXT NOT NULL,
  description TEXT,

  -- Visual Properties
  position_x NUMERIC NOT NULL,
  position_y NUMERIC NOT NULL,
  width NUMERIC DEFAULT 100,
  height NUMERIC DEFAULT 80,
  style JSONB DEFAULT '{}',               -- Colors, borders, icons

  -- BPMN Properties
  bpmn_properties JSONB DEFAULT '{}',     -- Type-specific BPMN properties

  -- Entity Integration (Read-Only References)
  linked_entity_type TEXT,                -- 'Task', 'Project', 'Activity', etc.
  linked_entity_id UUID,                  -- Specific entity instance (optional)
  display_config JSONB DEFAULT '{}',      -- UI display configuration

  -- Future BPA Integration
  automation_config JSONB,                -- Webhook triggers, notifications, etc.

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_node_key UNIQUE(process_id, node_key)
);

-- Process Connections (Sequence Flows)
CREATE TABLE IF NOT EXISTS process_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES process_definitions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,

  -- Connection Identity
  connection_key TEXT NOT NULL,           -- Unique within process
  source_node_id UUID NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,

  -- BPMN Properties
  connection_type TEXT DEFAULT 'sequence_flow', -- 'sequence_flow', 'message_flow', 'association'
  label TEXT,
  condition_expression TEXT,              -- Gateway condition: 'status === "approved"'
  is_default BOOLEAN DEFAULT false,       -- Default path for gateways

  -- Visual Properties
  waypoints JSONB DEFAULT '[]',           -- [{x: 100, y: 50}, ...] for routing
  style JSONB DEFAULT '{}',               -- Line style, color, markers

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_connection_key UNIQUE(process_id, connection_key)
);

-- Process Lanes (BPMN Swimlanes)
CREATE TABLE IF NOT EXISTS process_lanes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES process_definitions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,

  lane_key TEXT NOT NULL,
  name TEXT NOT NULL,

  -- Responsibility Assignment
  assigned_role TEXT,                     -- Organization role
  assigned_team_id UUID,                  -- Specific team
  assigned_user_id UUID,                  -- Specific user

  -- Visual Properties
  position_y NUMERIC NOT NULL,
  height NUMERIC DEFAULT 200,
  color TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_lane_key UNIQUE(process_id, lane_key)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_process_definitions_org ON process_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_process_definitions_published ON process_definitions(organization_id, is_published);
CREATE INDEX IF NOT EXISTS idx_process_nodes_process ON process_nodes(process_id);
CREATE INDEX IF NOT EXISTS idx_process_nodes_entity ON process_nodes(linked_entity_type, linked_entity_id) WHERE linked_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_process_connections_source ON process_connections(source_node_id);
CREATE INDEX IF NOT EXISTS idx_process_connections_target ON process_connections(target_node_id);
CREATE INDEX IF NOT EXISTS idx_process_connections_process ON process_connections(process_id);
CREATE INDEX IF NOT EXISTS idx_process_lanes_process ON process_lanes(process_id);

-- Comments for Documentation
COMMENT ON TABLE process_definitions IS 'BPMN 2.0 process definitions - system entity for business process modeling';
COMMENT ON TABLE process_nodes IS 'Process nodes (tasks, gateways, events) with optional entity linking';
COMMENT ON TABLE process_connections IS 'Sequence flows and connections between process nodes';
COMMENT ON TABLE process_lanes IS 'BPMN swimlanes for responsibility assignment';
