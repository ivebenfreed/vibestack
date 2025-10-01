/**
 * Process Studio Type Definitions
 * BPMN 2.0 compliant business process modeling
 */

// BPMN 2.0 Node Types
export type BPMNNodeType =
  // Events
  | 'start_event'              // Circle
  | 'end_event'                // Bold circle
  | 'intermediate_event'       // Double circle
  | 'boundary_event'           // Double circle on task

  // Tasks
  | 'task'                     // Rectangle
  | 'user_task'                // Rectangle with user icon
  | 'service_task'             // Rectangle with gear icon
  | 'script_task'              // Rectangle with script icon
  | 'manual_task'              // Rectangle with hand icon
  | 'send_task'                // Rectangle with envelope icon
  | 'receive_task'             // Rectangle with envelope icon
  | 'business_rule_task'       // Rectangle with table icon

  // Gateways
  | 'exclusive_gateway'        // Diamond with X
  | 'parallel_gateway'         // Diamond with +
  | 'inclusive_gateway'        // Diamond with O
  | 'event_based_gateway'      // Diamond with pentagon

  // Subprocesses
  | 'subprocess'               // Rectangle with +
  | 'call_activity'            // Rectangle with thick border

  // Data Objects
  | 'data_object'              // Document icon
  | 'data_store'               // Database icon

  // Annotations
  | 'text_annotation';         // Bracket with text

export type ConnectionType = 'sequence_flow' | 'message_flow' | 'association';

export type ProcessCategory = 'operational' | 'management' | 'support' | 'custom';

// Process Definition
export interface ProcessDefinition {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  category?: ProcessCategory;
  version: number;
  is_published: boolean;
  bpmn_xml?: string;
  diagram_json: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  published_at?: string;
  published_by?: string;
}

// Process Node
export interface ProcessNode {
  id: string;
  process_id: string;
  organization_id: string;
  node_key: string;
  node_type: BPMNNodeType;
  label: string;
  description?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  style?: Record<string, any>;
  bpmn_properties?: Record<string, any>;
  linked_entity_type?: string;
  linked_entity_id?: string;
  display_config?: Record<string, any>;
  automation_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Process Connection
export interface ProcessConnection {
  id: string;
  process_id: string;
  organization_id: string;
  connection_key: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: ConnectionType;
  label?: string;
  condition_expression?: string;
  is_default: boolean;
  waypoints?: Array<{ x: number; y: number }>;
  style?: Record<string, any>;
  created_at: string;
}

// Process Lane
export interface ProcessLane {
  id: string;
  process_id: string;
  organization_id: string;
  lane_key: string;
  name: string;
  assigned_role?: string;
  assigned_team_id?: string;
  assigned_user_id?: string;
  position_y: number;
  height: number;
  color?: string;
  created_at: string;
}

// API Request/Response Types
export interface CreateProcessRequest {
  name: string;
  description?: string;
  category?: ProcessCategory;
  diagram_json?: Record<string, any>;
}

export interface UpdateProcessRequest {
  name?: string;
  description?: string;
  category?: ProcessCategory;
  diagram_json?: Record<string, any>;
}

export interface CreateNodeRequest {
  node_key: string;
  node_type: BPMNNodeType;
  label: string;
  description?: string;
  position_x: number;
  position_y: number;
  width?: number;
  height?: number;
  style?: Record<string, any>;
  linked_entity_type?: string;
  linked_entity_id?: string;
}

export interface UpdateNodeRequest {
  label?: string;
  description?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  style?: Record<string, any>;
  linked_entity_type?: string;
  linked_entity_id?: string;
  display_config?: Record<string, any>;
}

export interface CreateConnectionRequest {
  connection_key: string;
  source_node_id: string;
  target_node_id: string;
  connection_type?: ConnectionType;
  label?: string;
  condition_expression?: string;
  is_default?: boolean;
  waypoints?: Array<{ x: number; y: number }>;
  style?: Record<string, any>;
}

export interface CreateLaneRequest {
  lane_key: string;
  name: string;
  assigned_role?: string;
  assigned_team_id?: string;
  assigned_user_id?: string;
  position_y: number;
  height?: number;
  color?: string;
}
