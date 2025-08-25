/**
 * Organization Actor routing
 * 
 * Routes requests to the appropriate Organization Actor based on organization ID.
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
    const { getKysely } = await import('../lib/kysely');
    const kysely = getKysely(c.env);
    
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