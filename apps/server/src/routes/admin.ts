/**
 * Platform Admin API Routes
 * 
 * SEPARATE from entity management - handles org creation, user management, billing
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';

export const adminRouter = new Hono<AppContext>();

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