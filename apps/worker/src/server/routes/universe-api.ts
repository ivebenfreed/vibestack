/**
 * User Workspace API - Simplified Org-Scoped Model
 * 
 * Cross-organization aggregation API for universe-centric navigation
 * Uses simplified model: each organization has its own worlds (no personal/business split)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/auth';
import { withKysely } from '../lib/database-manager';

const universeApi = new Hono();

// Validation schemas - handle string-to-boolean conversion for query parameters
const UniverseQuerySchema = z.object({
  includeInactive: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  includeArchived: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  includeCounts: z.preprocess((val) => val === 'true', z.boolean()).default(true)
});

const ActivityQuerySchema = z.object({
  days: z.preprocess((val) => val ? parseInt(String(val), 10) : 7, z.number().min(1).max(30)).default(7),
  limit: z.preprocess((val) => val ? parseInt(String(val), 10) : 20, z.number().min(1).max(100)).default(20)
});

// Apply basic auth middleware (cross-org API doesn't need org-specific middleware)
universeApi.use('*', authMiddleware);

/**
 * GET /api/universe/complete
 * Full user universe - simplified org-scoped model
 * Each organization has its own worlds, no personal/business distinction
 */
universeApi.get('/complete', zValidator('query', UniverseQuerySchema), async (c) => {
  const { includeInactive, includeArchived, includeCounts } = c.req.valid('query');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = user.id;

  try {
    // Get all organizations user belongs to
    const userOrganizations = await withKysely(async (db) => {
      return await db
        .selectFrom('organization_members as om')
        .innerJoin('organizations as o', 'o.id', 'om.organization_id')
        .select([
          'o.id',
          'o.name',
          'o.slug', 
          'o.type',
          'om.role',
          'om.created_at as joined_at'
        ])
        .where('om.user_id', '=', userId)
        .execute();
    });

    if (!userOrganizations.length) {
      return c.json({
        success: true,
        data: {
          userId: userId,
          organizations: {},
          summary: {
            totalOrganizations: 0,
            totalWorlds: 0,
            totalTeams: 0
          },
          lastUpdated: new Date().toISOString()
        }
      });
    }

    const orgIds = userOrganizations.map(org => org.id);

    // Get all worlds from organizations user belongs to (simplified org-scoped model)
    const allWorlds = await withKysely(async (db) => {
      let worldsQuery = db
        .selectFrom('worlds as w')
        .innerJoin('organizations as o', 'o.id', 'w.organization_id')
        .leftJoin('teams as t', (join) => join.on('t.id', '=', (eb) => eb.ref('w.team_id')))
        .leftJoin('team_memberships as tm', (join) =>
          join.on('tm.team_id', '=', (eb) => eb.ref('w.team_id'))
            .on('tm.user_id', '=', (eb) => eb.val(userId))
        )
        .innerJoin('organization_members as om', (join) =>
          join.on('om.organization_id', '=', (eb) => eb.ref('w.organization_id'))
            .on('om.user_id', '=', (eb) => eb.val(userId))
        )
        .select([
          'w.id',
          'w.organization_id',
          'w.team_id',
          'w.name', 
          'w.description',
          'w.state',
          'w.world_type',
          'w.priority',
          'w.created_at',
          'w.updated_at',
          't.name as team_name'
        ])
        .where('w.organization_id', 'in', orgIds);

      if (!includeInactive) {
        worldsQuery = worldsQuery.where('w.state', 'in', ['active', 'developing']);
      }
      if (!includeArchived) {
        worldsQuery = worldsQuery.where('w.state', '!=', 'archived');
      }

      return await worldsQuery.execute();
    });

    // Get team memberships for all organizations
    const teamMemberships = await withKysely(async (db) => {
      return await db
        .selectFrom('team_memberships as tm')
        .innerJoin('teams as t', 't.id', 'tm.team_id')
        .select([
          'tm.role as team_role',
          't.id as team_id',
          't.organization_id',
          't.name as team_name',
          't.description as team_description',
          't.team_type'
        ])
        .where('tm.user_id', '=', userId)
        .where('t.organization_id', 'in', orgIds)
        .execute();
    });

    // Build simplified workspace data structure
    const workspaceData = {
      userId: userId,
      organizations: {} as any,
      summary: {
        totalOrganizations: userOrganizations.length,
        totalWorlds: allWorlds.length,
        totalTeams: teamMemberships.length,
        activeWorlds: allWorlds.filter(w => w.state === 'active').length
      },
      lastUpdated: new Date().toISOString()
    };

    // Map organizations with their worlds and teams (simplified model)
    userOrganizations.forEach(org => {
      const orgWorlds = allWorlds.filter(w => w.organization_id === org.id);
      const orgTeams = teamMemberships.filter(t => t.organization_id === org.id);
      
      workspaceData.organizations[org.id] = {
        info: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          type: org.type,
          role: org.role,
          joinedAt: org.joined_at
        },
        worlds: orgWorlds,  // Simplified: just "worlds", not personal/business split
        teams: orgTeams
      };
    });

    return c.json({
      success: true,
      data: workspaceData
    });

  } catch (error) {
    console.error('Error fetching complete workspace:', error);
    return c.json({ error: 'Failed to fetch workspace data' }, 500);
  }
});

/**
 * GET /api/universe/personal
 * Get user's personal worlds only (for backward compatibility)
 */
universeApi.get('/personal', zValidator('query', UniverseQuerySchema), async (c) => {
  const { includeInactive, includeArchived } = c.req.valid('query');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = user.id;

  try {
    // Get user's personal worlds from their personal organization
    const personalWorlds = await withKysely(async (db) => {
      let personalWorldsQuery = db
        .selectFrom('worlds as w')
        .innerJoin('organizations as o', 'o.id', 'w.organization_id')
        .innerJoin('organization_members as om', (join) =>
          join.on('om.organization_id', '=', (eb) => eb.ref('w.organization_id'))
            .on('om.user_id', '=', (eb) => eb.val(userId))
        )
        .select([
          'w.id',
          'w.organization_id',
          'w.name',
          'w.description',
          'w.state',
          'w.world_type',
          'w.priority',
          'w.created_at',
          'w.updated_at'
        ])
        .where('o.type', '=', 'personal');

      if (!includeInactive) {
        personalWorldsQuery = personalWorldsQuery.where('w.state', 'in', ['active', 'developing']);
      }
      if (!includeArchived) {
        personalWorldsQuery = personalWorldsQuery.where('w.state', '!=', 'archived');
      }

      return await personalWorldsQuery.execute();
    });

    return c.json({
      success: true,
      data: {
        userId: userId,
        personalWorlds: personalWorlds,
        summary: {
          totalPersonalWorlds: personalWorlds.length,
          activePersonalWorlds: personalWorlds.filter(w => w.state === 'active').length
        },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching personal workspace:', error);
    return c.json({ error: 'Failed to fetch personal workspace data' }, 500);
  }
});

/**
 * GET /api/universe/activity
 * Get recent activity across all organizations
 */
universeApi.get('/activity', zValidator('query', ActivityQuerySchema), async (c) => {
  const { days, limit } = c.req.valid('query');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = user.id;
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Get recent world updates across all user's organizations
    const recentActivity = await withKysely(async (db) => {
      return await db
        .selectFrom('worlds as w')
        .innerJoin('organizations as o', 'o.id', 'w.organization_id')
        .innerJoin('organization_members as om', (join) =>
          join.on('om.organization_id', '=', (eb) => eb.ref('w.organization_id'))
            .on('om.user_id', '=', (eb) => eb.val(userId))
        )
        .select([
          'w.id',
          'w.organization_id',
          'w.name',
          'w.description',
          'w.state',
          'w.world_type',
          'w.updated_at',
          'o.name as organization_name',
          'o.type as organization_type'
        ])
        .where('w.updated_at', '>=', sinceDate.toISOString())
        .orderBy('w.updated_at', 'desc')
        .limit(limit)
        .execute();
    });

    return c.json({
      success: true,
      data: {
        userId: userId,
        recentActivity: recentActivity,
        filters: {
          days: days,
          limit: limit,
          since: sinceDate.toISOString()
        },
        summary: {
          totalRecentUpdates: recentActivity.length
        },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching workspace activity:', error);
    return c.json({ error: 'Failed to fetch workspace activity' }, 500);
  }
});

export { universeApi };