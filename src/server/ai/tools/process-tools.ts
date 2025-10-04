/**
 * Process Studio Tools for AI Chat Agent
 * Maps all 15 Process API endpoints to AI SDK tools
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { Env } from '@/server/types/env';

// Validation schemas matching API
// Using z.string() instead of z.enum() for Gemini compatibility
const ProcessCategorySchema = z.string().describe('One of: operational, management, support, custom');
const BPMNNodeTypeSchema = z.string().describe('BPMN node type (e.g., start_event, task, exclusive_gateway, end_event)');
const ConnectionTypeSchema = z.string().describe('One of: sequence_flow, message_flow, association');

export function createProcessTools(env: Env, getContext: () => { orgId: string; userId?: string }) {
  const baseUrl = (orgId: string) => `/api/process/orgs/${orgId}`;

  return {
    // ==================== Process Definition Tools ====================

    'process.list': tool({
      description: 'List all process definitions for the organization. Use this to show available processes or find a process by name.',
      parameters: z.object({
        includeUnpublished: z.boolean().describe('Include draft/unpublished processes (set to true to include drafts)'),
      }),
      execute: async ({ includeUnpublished }) => {
        const { orgId } = getContext();
        const include = includeUnpublished !== undefined ? includeUnpublished : true;
        const query = include ? '?includeUnpublished=true' : '?includeUnpublished=false';
        const url = `${baseUrl(orgId)}/processes${query}`;

        console.log('[process.list] Fetching processes for org:', orgId, 'includeUnpublished:', includeUnpublished);
        console.log('[process.list] URL:', url);

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          console.error('[process.list] Failed:', response.status, response.statusText);
          throw new Error(`Failed to list processes: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[process.list] Success:', result.data?.length || 0, 'processes returned');
        return result.data || [];
      },
    }),

    'process.get': tool({
      description: 'Get detailed information about a specific process, including its diagram and metadata.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process to retrieve'),
      }),
      execute: async ({ processId }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Process ${processId} not found`);
          }
          throw new Error(`Failed to get process: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
      },
    }),

    'process.create': tool({
      description: 'Create a new BPMN process definition. Use this when user wants to create a new workflow or business process.',
      parameters: z.object({
        name: z.string().describe('Name of the process (e.g., "Customer Onboarding")'),
        description: z.string().describe('Description of what this process does'),
        category: ProcessCategorySchema.describe('Process category: operational, management, support, or custom'),
      }),
      execute: async ({ name, description, category }) => {
        const { orgId } = getContext();
        const url = `${baseUrl(orgId)}/processes`;

        console.log('[process.create] Creating process:', { name, description, category, orgId });
        console.log('[process.create] URL:', url);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, category }),
        });

        if (!response.ok) {
          console.error('[process.create] Failed:', response.status, response.statusText);
          const errorBody = await response.text();
          console.error('[process.create] Error body:', errorBody);
          throw new Error(`Failed to create process: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[process.create] Success, process ID:', result.data?.id);
        return result.data;
      },
    }),

    'process.update': tool({
      description: 'Update an existing process definition (name, description, category, or diagram).',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process to update'),
        name: z.string().min(1).max(255).optional().describe('New name for the process'),
        description: z.string().optional().describe('New description'),
        category: ProcessCategorySchema.optional().describe('New category'),
      }),
      execute: async ({ processId, ...updates }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(`Failed to update process: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
      },
    }),

    'process.publish': tool({
      description: 'Publish a process definition, making it official and active. Published processes are read-only.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process to publish'),
      }),
      execute: async ({ processId }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to publish process: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
      },
    }),

    'process.delete': tool({
      description: 'Delete a process definition. Use hardDelete=true to permanently remove it, otherwise it will be soft-deleted.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process to delete'),
        hardDelete: z.boolean().optional().describe('Permanently delete (true) or soft delete (false, default)'),
      }),
      execute: async ({ processId, hardDelete = false }) => {
        const { orgId } = getContext();
        const query = hardDelete ? '?hard=true' : '';

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}${query}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to delete process: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
      },
    }),

    // ==================== Node Tools ====================

    'node.list': tool({
      description: 'List all nodes (tasks, events, gateways) in a process diagram.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
      }),
      execute: async ({ processId }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/nodes`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to list nodes: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data || [];
      },
    }),

    'node.create': tool({
      description: 'Add a new node (task, event, gateway) to a process diagram. Common types: task, user_task, start_event, end_event, exclusive_gateway, parallel_gateway.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
        node_key: z.string().describe('Unique key for this node (e.g., "task_1")'),
        node_type: BPMNNodeTypeSchema.describe('BPMN node type (e.g., "task", "user_task", "start_event", "exclusive_gateway")'),
        label: z.string().describe('Display label for the node'),
        description: z.string().optional().describe('Optional description'),
        position_x: z.number().describe('X coordinate on the canvas'),
        position_y: z.number().describe('Y coordinate on the canvas'),
        width: z.number().optional().describe('Width in pixels (default: 100)'),
        height: z.number().optional().describe('Height in pixels (default: 80)'),
      }),
      execute: async ({ processId, ...nodeData }) => {
        const { orgId } = getContext();
        const url = `${baseUrl(orgId)}/processes/${processId}/nodes`;

        console.log('[node.create] Creating node:', { processId, nodeData, orgId });
        console.log('[node.create] URL:', url);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nodeData),
        });

        if (!response.ok) {
          console.error('[node.create] Failed:', response.status, response.statusText);
          const errorBody = await response.text();
          console.error('[node.create] Error body:', errorBody);
          throw new Error(`Failed to create node: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[node.create] Success, node ID:', result.data?.id);
        return result.data;
      },
    }),

    'node.update': tool({
      description: 'Update an existing node in a process diagram (change label, position, size, etc).',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
        nodeId: z.string().describe('The UUID of the node to update'),
        label: z.string().optional().describe('New label'),
        description: z.string().optional().describe('New description'),
        position_x: z.number().optional().describe('New X coordinate'),
        position_y: z.number().optional().describe('New Y coordinate'),
        width: z.number().optional().describe('New width'),
        height: z.number().optional().describe('New height'),
      }),
      execute: async ({ processId, nodeId, ...updates }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/nodes/${nodeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(`Failed to update node: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
      },
    }),

    'node.delete': tool({
      description: 'Remove a node from a process diagram.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
        nodeId: z.string().describe('The UUID of the node to delete'),
      }),
      execute: async ({ processId, nodeId }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/nodes/${nodeId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to delete node: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
      },
    }),

    // ==================== Connection Tools ====================

    'connection.list': tool({
      description: 'List all connections (arrows/flows) between nodes in a process diagram.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
      }),
      execute: async ({ processId }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/connections`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to list connections: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data || [];
      },
    }),

    'connection.create': tool({
      description: 'Create a connection (sequence flow) between two nodes in a process diagram. This defines the process flow.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
        connection_key: z.string().describe('Unique key for this connection (e.g., "flow_1")'),
        source_node_id: z.string().describe('UUID of the source node'),
        target_node_id: z.string().describe('UUID of the target node'),
        connection_type: ConnectionTypeSchema.optional().describe('Type of connection (default: sequence_flow)'),
        label: z.string().optional().describe('Optional label for the connection'),
        condition_expression: z.string().optional().describe('Conditional expression for gateway branches'),
        is_default: z.boolean().optional().describe('Is this the default path from a gateway?'),
      }),
      execute: async ({ processId, ...connectionData }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/connections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(connectionData),
        });

        if (!response.ok) {
          throw new Error(`Failed to create connection: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
      },
    }),

    'connection.delete': tool({
      description: 'Remove a connection between nodes in a process diagram.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
        connectionId: z.string().describe('The UUID of the connection to delete'),
      }),
      execute: async ({ processId, connectionId }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/connections/${connectionId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to delete connection: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
      },
    }),

    // ==================== Lane Tools ====================

    'lane.list': tool({
      description: 'List all swimlanes in a process diagram. Lanes group tasks by role, team, or department.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
      }),
      execute: async ({ processId }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/lanes`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to list lanes: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data || [];
      },
    }),

    'lane.create': tool({
      description: 'Add a swimlane to a process diagram. Lanes organize tasks by role, team, or department.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
        lane_key: z.string().describe('Unique key for this lane (e.g., "lane_sales")'),
        name: z.string().describe('Display name for the lane (e.g., "Sales Team")'),
        assigned_role: z.string().optional().describe('Role assigned to this lane (e.g., "manager")'),
        assigned_team_id: z.string().optional().describe('Team UUID assigned to this lane'),
        assigned_user_id: z.string().optional().describe('User UUID assigned to this lane'),
        position_y: z.number().describe('Y position of the lane'),
        height: z.number().optional().describe('Height of the lane in pixels (default: 200)'),
        color: z.string().optional().describe('Color code for the lane'),
      }),
      execute: async ({ processId, ...laneData }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/lanes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(laneData),
        });

        if (!response.ok) {
          throw new Error(`Failed to create lane: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data;
      },
    }),

    'lane.delete': tool({
      description: 'Remove a swimlane from a process diagram.',
      parameters: z.object({
        processId: z.string().describe('The UUID of the process'),
        laneId: z.string().describe('The UUID of the lane to delete'),
      }),
      execute: async ({ processId, laneId }) => {
        const { orgId } = getContext();

        const response = await fetch(`${baseUrl(orgId)}/processes/${processId}/lanes/${laneId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to delete lane: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
      },
    }),
  };
}
