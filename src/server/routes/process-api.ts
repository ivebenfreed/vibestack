/**
 * Process Studio API Routes
 * RESTful endpoints for process management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppContext } from '../types/hono';
import { withKysely } from '../lib/database-manager';
import { processManager } from '../services/ProcessManager';

// Validation schemas
const CreateProcessSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(['operational', 'management', 'support', 'custom']).optional(),
  diagram_json: z.record(z.any()).optional()
});

const UpdateProcessSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.enum(['operational', 'management', 'support', 'custom']).optional(),
  diagram_json: z.record(z.any()).optional()
});

const CreateNodeSchema = z.object({
  node_key: z.string().min(1),
  node_type: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  position_x: z.number(),
  position_y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  style: z.record(z.any()).optional(),
  linked_entity_type: z.string().optional(),
  linked_entity_id: z.string().optional()
});

const UpdateNodeSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  position_x: z.number().optional(),
  position_y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  style: z.record(z.any()).optional(),
  linked_entity_type: z.string().optional(),
  linked_entity_id: z.string().optional(),
  display_config: z.record(z.any()).optional()
});

const CreateConnectionSchema = z.object({
  connection_key: z.string().min(1),
  source_node_id: z.string().min(1),
  target_node_id: z.string().min(1),
  connection_type: z.enum(['sequence_flow', 'message_flow', 'association']).optional(),
  label: z.string().optional(),
  condition_expression: z.string().optional(),
  is_default: z.boolean().optional(),
  waypoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  style: z.record(z.any()).optional()
});

const CreateLaneSchema = z.object({
  lane_key: z.string().min(1),
  name: z.string().min(1),
  assigned_role: z.string().optional(),
  assigned_team_id: z.string().optional(),
  assigned_user_id: z.string().optional(),
  position_y: z.number(),
  height: z.number().optional(),
  color: z.string().optional()
});

const app = new Hono<AppContext>();

// Test route
app.get('/test', async (c) => {
  return c.json({ message: 'Process API is working!' });
});

// ==================== Process Definition Routes ====================

// Get all processes for org
app.get('/orgs/:orgId/processes', async (c) => {
  const { orgId } = c.req.param();
  const includeUnpublished = c.req.query('includeUnpublished') !== 'false';

  const processes = await withKysely(async (kysely) => {
    return await processManager.getProcesses(kysely, orgId, includeUnpublished);
  });

  return c.json({ data: processes });
});

// Get single process
app.get('/orgs/:orgId/processes/:processId', async (c) => {
  const { orgId, processId } = c.req.param();

  const process = await withKysely(async (kysely) => {
    return await processManager.getProcess(kysely, orgId, processId);
  });

  if (!process) {
    return c.json({ error: 'Process not found' }, 404);
  }

  return c.json({ data: process });
});

// Create process
app.post(
  '/orgs/:orgId/processes',
  zValidator('json', CreateProcessSchema),
  async (c) => {
    const { orgId } = c.req.param();
    const body = c.req.valid('json');
    const user = c.get('user');

    const process = await withKysely(async (kysely) => {
      return await processManager.createProcess(kysely, orgId, body, user?.id);
    });

    return c.json({ data: process }, 201);
  }
);

// Update process
app.put(
  '/orgs/:orgId/processes/:processId',
  zValidator('json', UpdateProcessSchema),
  async (c) => {
    const { orgId, processId } = c.req.param();
    const body = c.req.valid('json');

    const process = await withKysely(async (kysely) => {
      return await processManager.updateProcess(kysely, orgId, processId, body);
    });

    return c.json({ data: process });
  }
);

// Publish process
app.post('/orgs/:orgId/processes/:processId/publish', async (c) => {
  const { orgId, processId } = c.req.param();
  const user = c.get('user');

  const process = await withKysely(async (kysely) => {
    return await processManager.publishProcess(kysely, orgId, processId, user?.id);
  });

  return c.json({ data: process });
});

// Delete process
app.delete('/orgs/:orgId/processes/:processId', async (c) => {
  const { orgId, processId } = c.req.param();
  const hardDelete = c.req.query('hard') === 'true';

  await withKysely(async (kysely) => {
    await processManager.deleteProcess(kysely, orgId, processId, hardDelete);
  });

  return c.json({ success: true });
});

// ==================== Node Routes ====================

// Get all nodes for process
app.get('/orgs/:orgId/processes/:processId/nodes', async (c) => {
  const { orgId, processId } = c.req.param();

  const nodes = await withKysely(async (kysely) => {
    return await processManager.getNodes(kysely, orgId, processId);
  });

  return c.json({ data: nodes });
});

// Create node
app.post(
  '/orgs/:orgId/processes/:processId/nodes',
  zValidator('json', CreateNodeSchema),
  async (c) => {
    const { orgId, processId } = c.req.param();
    const body = c.req.valid('json');

    const node = await withKysely(async (kysely) => {
      return await processManager.createNode(kysely, orgId, processId, body);
    });

    return c.json({ data: node }, 201);
  }
);

// Update node
app.put(
  '/orgs/:orgId/processes/:processId/nodes/:nodeId',
  zValidator('json', UpdateNodeSchema),
  async (c) => {
    const { orgId, nodeId } = c.req.param();
    const body = c.req.valid('json');

    const node = await withKysely(async (kysely) => {
      return await processManager.updateNode(kysely, orgId, nodeId, body);
    });

    return c.json({ data: node });
  }
);

// Delete node
app.delete('/orgs/:orgId/processes/:processId/nodes/:nodeId', async (c) => {
  const { orgId, nodeId } = c.req.param();

  await withKysely(async (kysely) => {
    await processManager.deleteNode(kysely, orgId, nodeId);
  });

  return c.json({ success: true });
});

// ==================== Connection Routes ====================

// Get all connections for process
app.get('/orgs/:orgId/processes/:processId/connections', async (c) => {
  const { orgId, processId } = c.req.param();

  const connections = await withKysely(async (kysely) => {
    return await processManager.getConnections(kysely, orgId, processId);
  });

  return c.json({ data: connections });
});

// Create connection
app.post(
  '/orgs/:orgId/processes/:processId/connections',
  zValidator('json', CreateConnectionSchema),
  async (c) => {
    const { orgId, processId } = c.req.param();
    const body = c.req.valid('json');

    const connection = await withKysely(async (kysely) => {
      return await processManager.createConnection(kysely, orgId, processId, body);
    });

    return c.json({ data: connection }, 201);
  }
);

// Delete connection
app.delete('/orgs/:orgId/processes/:processId/connections/:connectionId', async (c) => {
  const { orgId, connectionId } = c.req.param();

  await withKysely(async (kysely) => {
    await processManager.deleteConnection(kysely, orgId, connectionId);
  });

  return c.json({ success: true });
});

// ==================== Lane Routes ====================

// Get all lanes for process
app.get('/orgs/:orgId/processes/:processId/lanes', async (c) => {
  const { orgId, processId } = c.req.param();

  const lanes = await withKysely(async (kysely) => {
    return await processManager.getLanes(kysely, orgId, processId);
  });

  return c.json({ data: lanes });
});

// Create lane
app.post(
  '/orgs/:orgId/processes/:processId/lanes',
  zValidator('json', CreateLaneSchema),
  async (c) => {
    const { orgId, processId } = c.req.param();
    const body = c.req.valid('json');

    const lane = await withKysely(async (kysely) => {
      return await processManager.createLane(kysely, orgId, processId, body);
    });

    return c.json({ data: lane }, 201);
  }
);

// Delete lane
app.delete('/orgs/:orgId/processes/:processId/lanes/:laneId', async (c) => {
  const { orgId, laneId } = c.req.param();

  await withKysely(async (kysely) => {
    await processManager.deleteLane(kysely, orgId, laneId);
  });

  return c.json({ success: true });
});
export default app;
