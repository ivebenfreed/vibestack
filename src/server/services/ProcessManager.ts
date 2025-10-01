/**
 * Process Manager Service
 * Handles CRUD operations for process definitions, nodes, connections, and lanes
 */

import type { Kysely } from 'kysely';
import type { Database } from '../lib/database-types';
import type {
  ProcessDefinition,
  ProcessNode,
  ProcessConnection,
  ProcessLane,
  CreateProcessRequest,
  UpdateProcessRequest,
  CreateNodeRequest,
  UpdateNodeRequest,
  CreateConnectionRequest,
  CreateLaneRequest
} from '@/types/process-studio';

export class ProcessManager {

  // ====================  Process Definition CRUD ====================

  /**
   * Get all processes for an organization
   */
  async getProcesses(
    kysely: Kysely<Database>,
    orgId: string,
    includeUnpublished: boolean = true
  ): Promise<ProcessDefinition[]> {
    let query = kysely
      .selectFrom('process_definitions')
      .selectAll()
      .where('organization_id', '=', orgId)
      .orderBy('updated_at', 'desc');

    if (!includeUnpublished) {
      query = query.where('is_published', '=', true);
    }

    return await query.execute() as ProcessDefinition[];
  }

  /**
   * Get a single process by ID
   */
  async getProcess(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string
  ): Promise<ProcessDefinition | null> {
    const result = await kysely
      .selectFrom('process_definitions')
      .selectAll()
      .where('id', '=', processId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    return (result as ProcessDefinition) || null;
  }

  /**
   * Create a new process
   */
  async createProcess(
    kysely: Kysely<Database>,
    orgId: string,
    data: CreateProcessRequest,
    userId?: string
  ): Promise<ProcessDefinition> {
    const result = await kysely
      .insertInto('process_definitions')
      .values({
        organization_id: orgId,
        name: data.name,
        description: data.description,
        category: data.category,
        diagram_json: JSON.stringify(data.diagram_json || {}),
        created_by: userId,
        version: 1,
        is_published: false
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as ProcessDefinition;
  }

  /**
   * Update a process
   */
  async updateProcess(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string,
    data: UpdateProcessRequest
  ): Promise<ProcessDefinition> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.diagram_json !== undefined) updateData.diagram_json = JSON.stringify(data.diagram_json);

    const result = await kysely
      .updateTable('process_definitions')
      .set(updateData)
      .where('id', '=', processId)
      .where('organization_id', '=', orgId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as ProcessDefinition;
  }

  /**
   * Publish a process
   */
  async publishProcess(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string,
    userId?: string
  ): Promise<ProcessDefinition> {
    const result = await kysely
      .updateTable('process_definitions')
      .set({
        is_published: true,
        published_at: new Date().toISOString(),
        published_by: userId,
        updated_at: new Date().toISOString()
      })
      .where('id', '=', processId)
      .where('organization_id', '=', orgId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as ProcessDefinition;
  }

  /**
   * Delete a process (soft delete by unpublishing, or hard delete)
   */
  async deleteProcess(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string,
    hardDelete: boolean = false
  ): Promise<void> {
    if (hardDelete) {
      await kysely
        .deleteFrom('process_definitions')
        .where('id', '=', processId)
        .where('organization_id', '=', orgId)
        .execute();
    } else {
      // Soft delete: unpublish
      await kysely
        .updateTable('process_definitions')
        .set({
          is_published: false,
          updated_at: new Date().toISOString()
        })
        .where('id', '=', processId)
        .where('organization_id', '=', orgId)
        .execute();
    }
  }

  // ==================== Process Node CRUD ====================

  /**
   * Get all nodes for a process
   */
  async getNodes(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string
  ): Promise<ProcessNode[]> {
    return await kysely
      .selectFrom('process_nodes')
      .selectAll()
      .where('process_id', '=', processId)
      .where('organization_id', '=', orgId)
      .orderBy('created_at', 'asc')
      .execute() as ProcessNode[];
  }

  /**
   * Get a single node
   */
  async getNode(
    kysely: Kysely<Database>,
    orgId: string,
    nodeId: string
  ): Promise<ProcessNode | null> {
    const result = await kysely
      .selectFrom('process_nodes')
      .selectAll()
      .where('id', '=', nodeId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    return (result as ProcessNode) || null;
  }

  /**
   * Create a new node
   */
  async createNode(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string,
    data: CreateNodeRequest
  ): Promise<ProcessNode> {
    const result = await kysely
      .insertInto('process_nodes')
      .values({
        process_id: processId,
        organization_id: orgId,
        node_key: data.node_key,
        node_type: data.node_type,
        label: data.label,
        description: data.description,
        position_x: data.position_x,
        position_y: data.position_y,
        width: data.width || 100,
        height: data.height || 80,
        style: JSON.stringify(data.style || {}),
        linked_entity_type: data.linked_entity_type,
        linked_entity_id: data.linked_entity_id
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as ProcessNode;
  }

  /**
   * Update a node
   */
  async updateNode(
    kysely: Kysely<Database>,
    orgId: string,
    nodeId: string,
    data: UpdateNodeRequest
  ): Promise<ProcessNode> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (data.label !== undefined) updateData.label = data.label;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.position_x !== undefined) updateData.position_x = data.position_x;
    if (data.position_y !== undefined) updateData.position_y = data.position_y;
    if (data.width !== undefined) updateData.width = data.width;
    if (data.height !== undefined) updateData.height = data.height;
    if (data.style !== undefined) updateData.style = JSON.stringify(data.style);
    if (data.linked_entity_type !== undefined) updateData.linked_entity_type = data.linked_entity_type;
    if (data.linked_entity_id !== undefined) updateData.linked_entity_id = data.linked_entity_id;
    if (data.display_config !== undefined) updateData.display_config = JSON.stringify(data.display_config);

    const result = await kysely
      .updateTable('process_nodes')
      .set(updateData)
      .where('id', '=', nodeId)
      .where('organization_id', '=', orgId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as ProcessNode;
  }

  /**
   * Delete a node
   */
  async deleteNode(
    kysely: Kysely<Database>,
    orgId: string,
    nodeId: string
  ): Promise<void> {
    // Delete node (cascade will delete connections)
    await kysely
      .deleteFrom('process_nodes')
      .where('id', '=', nodeId)
      .where('organization_id', '=', orgId)
      .execute();
  }

  // ==================== Process Connection CRUD ====================

  /**
   * Get all connections for a process
   */
  async getConnections(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string
  ): Promise<ProcessConnection[]> {
    return await kysely
      .selectFrom('process_connections')
      .selectAll()
      .where('process_id', '=', processId)
      .where('organization_id', '=', orgId)
      .orderBy('created_at', 'asc')
      .execute() as ProcessConnection[];
  }

  /**
   * Create a new connection
   */
  async createConnection(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string,
    data: CreateConnectionRequest
  ): Promise<ProcessConnection> {
    const result = await kysely
      .insertInto('process_connections')
      .values({
        process_id: processId,
        organization_id: orgId,
        connection_key: data.connection_key,
        source_node_id: data.source_node_id,
        target_node_id: data.target_node_id,
        connection_type: data.connection_type || 'sequence_flow',
        label: data.label,
        condition_expression: data.condition_expression,
        is_default: data.is_default || false,
        waypoints: JSON.stringify(data.waypoints || []),
        style: JSON.stringify(data.style || {})
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as ProcessConnection;
  }

  /**
   * Delete a connection
   */
  async deleteConnection(
    kysely: Kysely<Database>,
    orgId: string,
    connectionId: string
  ): Promise<void> {
    await kysely
      .deleteFrom('process_connections')
      .where('id', '=', connectionId)
      .where('organization_id', '=', orgId)
      .execute();
  }

  // ==================== Process Lane CRUD ====================

  /**
   * Get all lanes for a process
   */
  async getLanes(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string
  ): Promise<ProcessLane[]> {
    return await kysely
      .selectFrom('process_lanes')
      .selectAll()
      .where('process_id', '=', processId)
      .where('organization_id', '=', orgId)
      .orderBy('position_y', 'asc')
      .execute() as ProcessLane[];
  }

  /**
   * Create a new lane
   */
  async createLane(
    kysely: Kysely<Database>,
    orgId: string,
    processId: string,
    data: CreateLaneRequest
  ): Promise<ProcessLane> {
    const result = await kysely
      .insertInto('process_lanes')
      .values({
        process_id: processId,
        organization_id: orgId,
        lane_key: data.lane_key,
        name: data.name,
        assigned_role: data.assigned_role,
        assigned_team_id: data.assigned_team_id,
        assigned_user_id: data.assigned_user_id,
        position_y: data.position_y,
        height: data.height || 200,
        color: data.color
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as ProcessLane;
  }

  /**
   * Delete a lane
   */
  async deleteLane(
    kysely: Kysely<Database>,
    orgId: string,
    laneId: string
  ): Promise<void> {
    await kysely
      .deleteFrom('process_lanes')
      .where('id', '=', laneId)
      .where('organization_id', '=', orgId)
      .execute();
  }
}

// Singleton instance
export const processManager = new ProcessManager();
