/**
 * Organization Actor routing
 * 
 * Routes requests to the appropriate Organization Actor based on organization ID.
 * Includes MCP agent endpoints scoped to the organization.
 * Runs alongside existing sync routes for gradual migration.
 */

import { Hono } from 'hono';
import type { AppBindings } from '../types/hono';
import { syncLogger } from '../middleware/logger';
import { authMiddleware } from '../middleware/auth';

const MODULE_NAME = 'OrganizationActorRouter';

export const organizationActorRouter = new Hono<AppBindings>();

// Middleware to ensure user is authenticated
organizationActorRouter.use('*', authMiddleware);

/**
 * WebSocket connection endpoint for Organization Actor
 * GET /api/org-actor/:orgId/websocket
 */
organizationActorRouter.get('/:orgId/websocket', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  // Generate client ID if not provided
  const clientId = c.req.header('x-client-id') || `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  try {
    // Get the Organization Actor for this org
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    // Create a new request with proper headers for the Actor
    const actorRequest = new Request(c.req.url.replace('/api/org-actor', ''), {
      method: 'GET',
      headers: {
        'upgrade': 'websocket',
        'x-user-id': user.id,
        'x-client-id': clientId,
        'x-org-id': orgId
      }
    });
    
    syncLogger.info('Routing WebSocket connection to Organization Actor', {
      orgId,
      userId: user.id,
      clientId,
      userEmail: user.email
    }, MODULE_NAME);
    
    // Forward to the Organization Actor
    const response = await orgActor.fetch(actorRequest);
    
    return response;
    
  } catch (error) {
    syncLogger.error('Failed to connect to Organization Actor', {
      orgId,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to establish WebSocket connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Table change notification endpoint (called by WAL poller)
 * POST /api/org-actor/:orgId/table-change
 */
organizationActorRouter.post('/:orgId/table-change', async (c) => {
  const orgId = c.req.param('orgId');
  
  try {
    const notification = await c.req.json();
    
    syncLogger.info('Forwarding table change notification to Organization Actor', {
      orgId,
      tables: notification.tables,
      lsn: notification.lsn
    }, MODULE_NAME);
    
    // Get the Organization Actor for this org
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    // Forward the notification
    const actorRequest = new Request('https://internal/table-change-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...notification,
        organizationId: orgId,
        timestamp: Date.now()
      })
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    syncLogger.info('Table change notification processed by Organization Actor', {
      orgId,
      result
    }, MODULE_NAME);
    
    return c.json(result);
    
  } catch (error) {
    syncLogger.error('Failed to forward table change notification', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to process table change notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Organization Actor status endpoint
 * GET /api/org-actor/:orgId/status
 */
organizationActorRouter.get('/:orgId/status', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    // Get the Organization Actor for this org
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    // Get status from the Actor
    const actorRequest = new Request('https://internal/status', {
      method: 'GET'
    });
    
    const response = await orgActor.fetch(actorRequest);
    const status = await response.json();
    
    return c.json({
      organization: {
        id: orgId,
        actorStatus: status
      }
    });
    
  } catch (error) {
    syncLogger.error('Failed to get Organization Actor status', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to get actor status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Check permission using Organization Actor cache
 * GET /api/org-actor/:orgId/permission-check
 */
organizationActorRouter.get('/:orgId/permission-check', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = c.req.query('userId');
  const resourceType = c.req.query('resourceType');
  const resourceId = c.req.query('resourceId');
  const action = c.req.query('action');
  
  if (!userId || !resourceType || !resourceId || !action) {
    return c.json({ 
      error: 'Missing required parameters: userId, resourceType, resourceId, action' 
    }, 400);
  }
  
  try {
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    const actorRequest = new Request(`https://internal/permission-check?userId=${userId}&resourceType=${resourceType}&resourceId=${resourceId}&action=${action}`, {
      method: 'GET'
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    return c.json(result);
    
  } catch (error) {
    syncLogger.error('Failed to check permission via Organization Actor', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to check permission',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Cache permission in Organization Actor
 * POST /api/org-actor/:orgId/cache-permission
 */
organizationActorRouter.post('/:orgId/cache-permission', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    const permissionData = await c.req.json();
    
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    const actorRequest = new Request('https://internal/cache-permission', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(permissionData)
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    return c.json(result);
    
  } catch (error) {
    syncLogger.error('Failed to cache permission via Organization Actor', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to cache permission',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Check schema using Organization Actor cache
 * GET /api/org-actor/:orgId/schema-check
 */
organizationActorRouter.get('/:orgId/schema-check', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const tableName = c.req.query('tableName');
  
  if (!tableName) {
    return c.json({ 
      error: 'Missing required parameter: tableName' 
    }, 400);
  }
  
  try {
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    const actorRequest = new Request(`https://internal/schema-check?tableName=${tableName}`, {
      method: 'GET'
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    return c.json(result);
    
  } catch (error) {
    syncLogger.error('Failed to check schema via Organization Actor', {
      orgId,
      tableName,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to check schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Cache schema in Organization Actor  
 * POST /api/org-actor/:orgId/cache-schema
 */
organizationActorRouter.post('/:orgId/cache-schema', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    const schemaData = await c.req.json();
    
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    const actorRequest = new Request('https://internal/cache-schema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schemaData)
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    return c.json(result);
    
  } catch (error) {
    syncLogger.error('Failed to cache schema via Organization Actor', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to cache schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Invalidate schema cache in Organization Actor
 * POST /api/org-actor/:orgId/invalidate-schema
 */
organizationActorRouter.post('/:orgId/invalidate-schema', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    const requestBody = await c.req.json().catch(() => ({}));
    
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    const actorRequest = new Request('https://internal/invalidate-schema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    syncLogger.info('Schema cache invalidated via Organization Actor', {
      orgId,
      userId: user.id,
      result
    }, MODULE_NAME);
    
    return c.json(result);
    
  } catch (error) {
    syncLogger.error('Failed to invalidate schema cache via Organization Actor', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to invalidate schema cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Clear organization schema cache in Organization Actor
 * DELETE /api/org-actor/:orgId/org-schema-cache
 */
organizationActorRouter.delete('/:orgId/org-schema-cache', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    const actorRequest = new Request('https://internal/clear-org-schema-cache', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': orgId
      }
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    syncLogger.info('Organization schema cache cleared via Organization Actor', {
      orgId,
      userId: user.id,
      result
    }, MODULE_NAME);
    
    return c.json(result);
    
  } catch (error) {
    syncLogger.error('Failed to clear organization schema cache via Organization Actor', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to clear organization schema cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Check role using Organization Actor cache
 * GET /api/org-actor/:orgId/role-check
 */
organizationActorRouter.get('/:orgId/role-check', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = c.req.query('userId') || user.id;
  const organizationId = c.req.query('organizationId') || orgId;
  
  try {
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    const actorRequest = new Request(`https://internal/role-check?userId=${userId}&organizationId=${organizationId}`, {
      method: 'GET'
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    return c.json(result);
    
  } catch (error) {
    syncLogger.error('Failed to check role via Organization Actor', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to check role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Refresh complete organization cache from PostgreSQL
 * POST /api/org-actor/:orgId/refresh-cache
 */
organizationActorRouter.post('/:orgId/refresh-cache', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    // Get fresh data from PostgreSQL
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    const organization = await kysely
      .selectFrom('organizations')
      .selectAll()
      .where('id', '=', orgId)
      .executeTakeFirst();
      
    if (!organization) {
      return c.json({ error: 'Organization not found' }, 404);
    }
    
    const members = await kysely
      .selectFrom('organization_members as m')
      .innerJoin('user as u', 'u.id', 'm.user_id')
      .select([
        'm.id',
        'm.organization_id',
        'm.user_id',
        'm.role',
        'm.created_at',
        'u.name as user_name',
        'u.email as user_email'
      ])
      .where('m.organization_id', '=', orgId)
      .execute();
    
    // Send to Organization Actor for bulk refresh
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    const roles = members.map(member => ({
      userId: member.user_id,
      organizationId: orgId,
      role: member.role,
      permissions: getRolePermissions(member.role)
    }));
    
    const actorRequest = new Request('https://internal/bulk-cache-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles })
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    return c.json({
      success: true,
      message: `Refreshed cache for ${members.length} members`,
      members: members.map(m => ({ email: m.user_email, role: m.role }))
    });
    
  } catch (error) {
    return c.json({ 
      error: 'Failed to refresh cache',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

function getRolePermissions(role: string): string[] {
  switch (role) {
    case 'owner':
      return [
        'org:read', 'org:write', 'org:admin', 'org:delete', 'org:billing',
        'members:read', 'members:write', 'members:admin',
        'entities:read', 'entities:write', 'entities:admin',
        'invitations:send', 'invitations:manage',
        'roles:assign', 'roles:revoke'
      ];
    case 'admin':
      return [
        'org:read', 'org:write', 'org:admin',
        'members:read', 'members:write', 'members:admin',
        'entities:read', 'entities:write', 'entities:admin',
        'invitations:send', 'invitations:manage',
        'roles:assign'
      ];
    case 'manager':
      return [
        'org:read', 'org:write',
        'members:read', 'members:invite',
        'entities:read', 'entities:write', 'entities:admin',
        'invitations:send'
      ];
    case 'member':
      return [
        'org:read',
        'members:read',
        'entities:read', 'entities:write'
      ];
    case 'viewer':
      return [
        'org:read',
        'members:read',
        'entities:read'
      ];
    default:
      return [];
  }
}

/**
 * Cache role in Organization Actor
 * POST /api/org-actor/:orgId/cache-role
 */
organizationActorRouter.post('/:orgId/cache-role', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    const roleData = await c.req.json();
    
    const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
    const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
    
    const actorRequest = new Request('https://internal/cache-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(roleData)
    });
    
    const response = await orgActor.fetch(actorRequest);
    const result = await response.json();
    
    return c.json(result);
    
  } catch (error) {
    syncLogger.error('Failed to cache role via Organization Actor', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to cache role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * MCP Agent Status for Organization
 * GET /api/org-actor/:orgId/mcp/status
 */
organizationActorRouter.get('/:orgId/mcp/status', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    return c.json({
      status: "ok",
      agent: "VibeStack Organization MCP Agent",
      version: "1.0.0",
      organizationId: orgId,
      endpoints: {
        mcp: `/api/org-actor/${orgId}/mcp/agent`,
        status: `/api/org-actor/${orgId}/mcp/status`
      },
      tools: [
        "get_organization_info",
        "get_projects", 
        "get_teams",
        "get_members",
        "get_context"
      ],
      context: {
        currentOrganization: orgId,
        authenticatedUser: {
          id: user.id,
          email: user.email
        }
      }
    });
  } catch (error) {
    syncLogger.error('Failed to get MCP status', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to get MCP status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * MCP Agent Tool Execution for Organization
 * POST /api/org-actor/:orgId/mcp/agent
 */
organizationActorRouter.post('/:orgId/mcp/agent', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const mcpRequest = await c.req.json();
    
    // Simple MCP tool execution - we'll implement the actual tools here
    const toolResult = await executeMCPTool(orgId, mcpRequest, user, c.env);
    
    return c.json({
      jsonrpc: "2.0",
      id: mcpRequest.id,
      result: toolResult
    });
    
  } catch (error) {
    syncLogger.error('Failed to execute MCP tool', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({
      jsonrpc: "2.0", 
      id: mcpRequest?.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    }, 500);
  }
});

/**
 * Test EmbeddingGeneratorDO functionality
 * GET /api/org-actor/:orgId/test-embedding
 */
organizationActorRouter.get('/:orgId/test-embedding', async (c) => {
  const orgId = c.req.param('orgId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    // Get EmbeddingGeneratorDO for this organization
    const embeddingGenId = c.env.EMBEDDING_GENERATOR.idFromName(`org:${orgId}`);
    const embeddingGen = c.env.EMBEDDING_GENERATOR.get(embeddingGenId);
    
    // Test basic embedding generation
    const testResponse = await embeddingGen.fetch(new Request('https://internal/test-embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: "Testing EmbeddingGemma model with VibeStack project descriptions and semantic search capabilities" 
      })
    }));
    
    const testResult = await testResponse.json();
    
    // Get status
    const statusResponse = await embeddingGen.fetch(new Request('https://internal/status'));
    const statusResult = await statusResponse.json();
    
    return c.json({
      organizationId: orgId,
      user: { id: user.id, email: user.email },
      embeddingTest: testResult,
      embeddingGeneratorStatus: statusResult
    });
    
  } catch (error) {
    syncLogger.error('Failed to test EmbeddingGeneratorDO', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to test embedding generator',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Generate embedding for a specific project
 * GET /api/org-actor/:orgId/generate-for-project/:projectId
 */
organizationActorRouter.get('/:orgId/generate-for-project/:projectId', async (c) => {
  const orgId = c.req.param('orgId');
  const projectId = c.req.param('projectId');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  try {
    // Get EmbeddingGeneratorDO for this organization
    const embeddingGenId = c.env.EMBEDDING_GENERATOR.idFromName(`org:${orgId}`);
    const embeddingGen = c.env.EMBEDDING_GENERATOR.get(embeddingGenId);
    
    // Generate embedding for the specific project
    const response = await embeddingGen.fetch(new Request('https://internal/generate-for-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        projectId,
        organizationId: orgId,
        updateDatabase: false
      })
    }));
    
    const result = await response.json();
    
    syncLogger.info('Project embedding generation completed', { 
      orgId, 
      projectId, 
      success: response.ok,
      dimensions: result?.embedding?.length
    }, MODULE_NAME);
    
    return c.json({
      success: true,
      projectId,
      organizationId: orgId,
      user: { id: user.id, email: user.email },
      generationResult: result
    });
    
  } catch (error) {
    syncLogger.error('Failed to generate project embedding', {
      orgId,
      projectId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Failed to generate project embedding',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Simple MCP tool execution function
 */
async function executeMCPTool(orgId: string, mcpRequest: any, user: any, env: any) {
  const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
  createDatabaseConnection(env);
  const db = getKysely();

  // Extract tool name - handle both direct method and MCP call_tool format
  const toolName = mcpRequest.params?.name || mcpRequest.method;
  const args = mcpRequest.params?.arguments || {};
  
  syncLogger.info('Executing MCP tool', { toolName, args, orgId }, MODULE_NAME);
  
  if (!toolName) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  switch (toolName) {
    case 'get_organization_info':
      const org = await db
        .selectFrom('organizations')
        .select(['id', 'name', 'slug', 'lore', 'subscription_tier', 'created_at'])
        .where('id', '=', orgId)
        .executeTakeFirst();

      return {
        content: [{
          type: "text",
          text: org ? 
            `Organization: ${org.name} (${org.slug})\nTier: ${org.subscription_tier}\nLore: ${org.lore || 'No lore defined'}\nID: ${org.id}` :
            `Organization ${orgId} not found`
        }]
      };

    case 'get_projects':
      const projects = await db
        .selectFrom('projects')
        .select(['id', 'name', 'description', 'status', 'priority', 'created_at'])
        .where('organization_id', '=', orgId)
        .limit(args.limit || 20)
        .execute();

      const projectList = projects.map(p => 
        `• ${p.name} (${p.status || 'No Status'}) - Priority: ${p.priority || 'None'}\n  ${p.description || 'No description'} - ID: ${p.id}`
      ).join('\n\n');

      return {
        content: [{
          type: "text",
          text: projects.length > 0 ? 
            `Found ${projects.length} projects:\n\n${projectList}` :
            `No projects found in organization ${orgId}`
        }]
      };

    case 'get_teams':
      const teams = await db
        .selectFrom('teams')
        .select(['id', 'name', 'description', 'created_at'])
        .where('organization_id', '=', orgId)
        .limit(args.limit || 20)
        .execute();

      const teamList = teams.map(t => 
        `• ${t.name}\n  ${t.description || 'No description'} - ID: ${t.id}`
      ).join('\n\n');

      return {
        content: [{
          type: "text",
          text: teams.length > 0 ?
            `Found ${teams.length} teams:\n\n${teamList}` :
            `No teams found in organization ${orgId}`
        }]
      };

    case 'get_members':
      const members = await db
        .selectFrom('organization_members as m')
        .innerJoin('user as u', 'u.id', 'm.user_id')  
        .select([
          'm.role',
          'u.name as user_name',
          'u.email as user_email',
          'm.created_at'
        ])
        .where('m.organization_id', '=', orgId)
        .limit(args.limit || 20)
        .execute();

      const memberList = members.map(m =>
        `• ${m.user_name || m.user_email} (${m.role}) - ${m.user_email}`
      ).join('\n');

      return {
        content: [{
          type: "text", 
          text: members.length > 0 ?
            `Found ${members.length} members:\n\n${memberList}` :
            `No members found in organization ${orgId}`
        }]
      };

    case 'get_context':
      return {
        content: [{
          type: "text",
          text: `Organization MCP Agent Context:\n\nCurrent Organization: ${orgId}\nAuthenticated User: ${user.email}\n\nAvailable tools:\n• get_organization_info - Get organization details\n• get_projects - Get projects in organization\n• get_teams - Get teams in organization  \n• get_members - Get organization members\n• get_context - Show current context`
        }]
      };

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * List all Organization Actors (for debugging)
 * GET /api/org-actor/list
 */
organizationActorRouter.get('/list', async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  // Note: This is a simplified version - in production you'd query your database
  // for organizations the user has access to
  return c.json({
    message: 'Organization Actor list endpoint',
    note: 'Would list organizations the user has access to',
    userId: user.id,
    userEmail: user.email
  });
});