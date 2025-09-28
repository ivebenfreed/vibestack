/**
 * Platform Admin API Routes
 * 
 * SEPARATE from entity management - handles org creation, user management, billing
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';
import { platformAdminAuth, requireSuperAdmin, auditAction } from '../middleware/platform-admin-auth';

export const adminRouter = new Hono<AppContext>();

// Apply platform admin authentication to all admin routes
adminRouter.use('/*', platformAdminAuth);

// Platform admin endpoints using direct database operations

adminRouter.post('/organizations', async (c) => {
  try {
    const body = await c.req.json();
    const { name, slug, ownerId, planType, settings } = body;
    
    if (!name || !slug || !ownerId) {
      return c.json({ error: 'name, slug, and ownerId required' }, 400);
    }

    // Use OrganizationActor for org creation
    const orgId = c.env.ORGANIZATION_ACTORS.idFromName(slug);
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgId);
    
    const response = await orgActor.fetch(new Request('http://localhost/admin/create', {
      method: 'POST',
      body: JSON.stringify({ name, slug, ownerId, planType, settings })
    }));
    
    const result = await response.json();
    
    return c.json(result, response.status);
  } catch (error) {
    console.error('Admin org creation error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

adminRouter.get('/organizations/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    // Use OrganizationActor
    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName(orgId || 'platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);
    
    const response = await orgActor.fetch(new Request(`http://localhost/organizations/${orgId}`));
    const organization = await response.json();
    
    return c.json(organization, response.status);
  } catch (error) {
    console.error('Admin org fetch error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

adminRouter.get('/users/:userId/organizations', async (c) => {
  try {
    const userId = c.req.param('userId');
    
    // Use OrganizationActor
    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName(orgId || 'platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);
    
    const response = await orgActor.fetch(new Request(`http://localhost/users/${userId}/organizations`));
    const organizations = await response.json();
    
    return c.json(organizations);
  } catch (error) {
    console.error('Admin user orgs fetch error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

adminRouter.post('/organizations/:orgId/members', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const body = await c.req.json();
    const { userId, role } = body;
    
    if (!userId || !role) {
      return c.json({ error: 'userId and role required' }, 400);
    }

    // Use OrganizationActor
    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName(orgId || 'platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);
    
    const response = await orgActor.fetch(new Request(`http://localhost/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role })
    }));
    
    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Admin add member error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

adminRouter.get('/stats', async (c) => {
  try {
    // Use OrganizationActor
    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName(orgId || 'platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);
    
    const response = await orgActor.fetch(new Request('http://localhost/stats'));
    const stats = await response.json();
    
    return c.json(stats);
  } catch (error) {
    console.error('Admin stats error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

adminRouter.delete('/organizations/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');

    // Use OrganizationActor
    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName(orgId || 'platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);

    const response = await orgActor.fetch(new Request(`http://localhost/organizations/${orgId}`, {
      method: 'DELETE'
    }));

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Admin org deletion error:', error);
    return c.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Feature Flag Management Routes
adminRouter.get('/feature-flags', async (c) => {
  try {
    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName('platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);

    const response = await orgActor.fetch(new Request('http://localhost/feature-flags'));
    const flags = await response.json();

    return c.json(flags);
  } catch (error) {
    console.error('Admin feature flags fetch error:', error);
    return c.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

adminRouter.put('/organizations/:orgId/feature-flags', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const body = await c.req.json();
    const { enabled_features } = body;

    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName(orgId);
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);

    const response = await orgActor.fetch(new Request(`http://localhost/organizations/${orgId}/feature-flags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled_features })
    }));

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Admin feature flags update error:', error);
    return c.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

adminRouter.post('/feature-flags/:flagKey/rollout', async (c) => {
  try {
    const flagKey = c.req.param('flagKey');
    const body = await c.req.json();
    const { percentage, target_plans } = body;

    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName('platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);

    const response = await orgActor.fetch(new Request(`http://localhost/feature-flags/${flagKey}/rollout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentage, target_plans })
    }));

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Admin feature rollout error:', error);
    return c.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// User Management Routes
adminRouter.get('/users', async (c) => {
  try {
    const searchParams = new URL(c.req.url).searchParams;
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') || '100';
    const offset = searchParams.get('offset') || '0';

    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName('platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);

    const queryParams = new URLSearchParams({
      ...(search && { search }),
      ...(role && { role }),
      ...(status && { status }),
      limit,
      offset
    });

    const response = await orgActor.fetch(
      new Request(`http://localhost/users?${queryParams.toString()}`)
    );
    const users = await response.json();

    return c.json(users);
  } catch (error) {
    console.error('Admin users fetch error:', error);
    return c.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

adminRouter.get('/users/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');

    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName('platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);

    const response = await orgActor.fetch(new Request(`http://localhost/users/${userId}`));
    const user = await response.json();

    return c.json(user);
  } catch (error) {
    console.error('Admin user fetch error:', error);
    return c.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

adminRouter.put('/users/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();

    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName('platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);

    const response = await orgActor.fetch(new Request(`http://localhost/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }));

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Admin user update error:', error);
    return c.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

adminRouter.post('/users/:userId/impersonate', async (c) => {
  try {
    const userId = c.req.param('userId');
    const adminUserId = c.get('user')?.id;

    if (!adminUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName('platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);

    const response = await orgActor.fetch(new Request(`http://localhost/users/${userId}/impersonate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_user_id: adminUserId })
    }));

    const result = await response.json();
    return c.json(result, response.status);
  } catch (error) {
    console.error('Admin user impersonation error:', error);
    return c.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Platform Statistics
adminRouter.get('/platform-stats', async (c) => {
  try {
    const orgActorId = c.env.ORGANIZATION_ACTORS.idFromName('platform');
    const orgActor = c.env.ORGANIZATION_ACTORS.get(orgActorId);

    const response = await orgActor.fetch(new Request('http://localhost/platform-stats'));
    const stats = await response.json();

    return c.json(stats);
  } catch (error) {
    console.error('Admin platform stats error:', error);
    return c.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});