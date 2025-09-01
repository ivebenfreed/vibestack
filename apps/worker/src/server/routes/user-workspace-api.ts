/**
 * User Workspace API
 * 
 * Cross-organization aggregation API for universe-centric navigation
 * This is the main API that powers the unified "My Universe" experience
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/auth';
import { db } from '../lib/kysely';

const workspaceApi = new Hono();

// Validation schemas - handle string-to-boolean conversion for query parameters
const WorkspaceQuerySchema = z.object({
  includeInactive: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  includeArchived: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  includeCounts: z.preprocess((val) => val === 'true', z.boolean()).default(true)
});

const ActivityQuerySchema = z.object({
  days: z.preprocess((val) => val ? parseInt(String(val), 10) : 7, z.number().min(1).max(30)).default(7),
  limit: z.preprocess((val) => val ? parseInt(String(val), 10) : 20, z.number().min(1).max(100)).default(20)
});

// Apply basic auth middleware (cross-org API doesn't need org-specific middleware)
workspaceApi.use('*', authMiddleware);

/**
 * GET /api/workspace/complete
 * Full user workspace - the main endpoint for universe-centric navigation
 * Returns personal worlds, business worlds, teams, and activity across all organizations
 */
workspaceApi.get('/complete', zValidator('query', WorkspaceQuerySchema), async (c) => {
  const { includeInactive, includeArchived, includeCounts } = c.req.valid('query');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = user.id;

  try {
    // Get all organizations user belongs to
    const userOrganizations = await db(c.env)
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
      .orderBy('o.name', 'asc')
      .execute();

    if (userOrganizations.length === 0) {
      return c.json({
        success: true,
        data: {
          userId: userId,
          organizations: {},
          personal: { worlds: [] },
          summary: {
            totalOrganizations: 0,
            totalPersonalWorlds: 0,
            totalBusinessWorlds: 0,
            totalTeams: 0
          },
          lastUpdated: new Date().toISOString()
        }
      });
    }

    const orgIds = userOrganizations.map(org => org.id);

    // Get personal worlds (from user's personal organization)
    let personalWorldsQuery = db(c.env)
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
      .where('o.type', '=', 'personal')

    if (!includeInactive) {
      personalWorldsQuery = personalWorldsQuery.where('w.state', 'in', ['active', 'developing']);
    }
    if (!includeArchived) {
      personalWorldsQuery = personalWorldsQuery.where('w.state', '!=', 'archived');
    }

    const personalWorlds = await personalWorldsQuery.execute();

    // Get business worlds (from business organizations user belongs to)  
    let businessWorldsQuery = db(c.env)
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
      .where('o.type', '=', 'business')
      .where('w.organization_id', 'in', orgIds);

    if (!includeInactive) {
      businessWorldsQuery = businessWorldsQuery.where('w.state', 'in', ['active', 'developing']);
    }
    if (!includeArchived) {
      businessWorldsQuery = businessWorldsQuery.where('w.state', '!=', 'archived');
    }

    const businessWorlds = await businessWorldsQuery.execute();

    // Get team memberships
    const teamMemberships = await db(c.env)
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

    // Build the workspace data structure with actual data
    const workspaceData = {
      userId: userId,
      organizations: {},
      personal: {
        totalWorlds: personalWorlds.length,
        worlds: personalWorlds
      },
      business: {
        totalWorlds: businessWorlds.length,
        worlds: businessWorlds
      },
      teams: {
        totalMemberships: teamMemberships.length,
        memberships: teamMemberships
      },
      summary: {
        totalOrganizations: userOrganizations.length,
        totalPersonalWorlds: personalWorlds.length,
        totalBusinessWorlds: businessWorlds.length,
        totalTeams: teamMemberships.length,
        activeWorlds: [...personalWorlds, ...businessWorlds].filter(w => w.state === 'active').length
      },
      lastUpdated: new Date().toISOString()
    };

    // Map organizations with actual worlds and team data
    userOrganizations.forEach(org => {
      const orgPersonalWorlds = personalWorlds.filter(w => w.organization_id === org.id);
      const orgBusinessWorlds = businessWorlds.filter(w => w.organization_id === org.id);
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
        personalWorlds: orgPersonalWorlds,
        businessWorlds: orgBusinessWorlds,
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
 * GET /api/workspace/personal
 * Personal context only - universes and personal worlds across all organizations
 */
workspaceApi.get('/personal', zValidator('query', WorkspaceQuerySchema), async (c) => {
  const { includeInactive, includeArchived } = c.req.valid('query');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = user.id;

  try {
    // Get user's personal worlds from their personal organization
    let personalWorldsQuery = db(c.env)
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
      .where('o.type', '=', 'personal')

    if (!includeInactive) {
      personalWorldsQuery = personalWorldsQuery.where('w.state', 'in', ['active', 'developing']);
    }
    if (!includeArchived) {
      personalWorldsQuery = personalWorldsQuery.where('w.state', '!=', 'archived');
    }

    const personalWorlds = await personalWorldsQuery.execute();

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
 * GET /api/workspace/organizations
 * Business contexts - all organizations, teams, and business worlds
 */
workspaceApi.get('/organizations', zValidator('query', WorkspaceQuerySchema), async (c) => {
  const { includeInactive, includeArchived } = c.req.valid('query');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = user.id;

  try {
    // Get all organizations with user's role
    const organizations = await db(c.env)
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
      .orderBy('o.name', 'asc')
      .execute();

    if (organizations.length === 0) {
      return c.json({
        success: true,
        data: {
          organizations: [],
          summary: { totalOrganizations: 0 },
          lastUpdated: new Date().toISOString()
        }
      });
    }

    const orgIds = organizations.map(org => org.id);

    // Get business worlds and teams for all business organizations
    let businessWorldsQuery = db(c.env)
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
        't.name as team_name',
        'tm.role as team_role',
        'om.role as org_role'
      ])
      .where('o.type', '=', 'business')
      .where('w.organization_id', 'in', orgIds);

    if (!includeInactive) {
      businessWorldsQuery = businessWorldsQuery.where('w.state', 'in', ['active', 'developing']);
    }
    if (!includeArchived) {
      businessWorldsQuery = businessWorldsQuery.where('w.state', '!=', 'archived');
    }

    const businessWorlds = await businessWorldsQuery.execute();

    // Get team memberships
    const teamMemberships = await db(c.env)
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

    // Organize by organization
    const organizationsData = organizations.map(org => ({
      info: org,
      businessWorlds: businessWorlds.filter(w => w.organization_id === org.id),
      teams: teamMemberships.filter(t => t.organization_id === org.id)
    }));

    return c.json({
      success: true,
      data: {
        organizations: organizationsData,
        summary: {
          totalOrganizations: organizations.length,
          totalBusinessWorlds: businessWorlds.length,
          totalTeamMemberships: teamMemberships.length
        },
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching organizations workspace:', error);
    return c.json({ error: 'Failed to fetch organizations data' }, 500);
  }
});

/**
 * GET /api/workspace/activity
 * Recent activity feed across all organizations and contexts
 */
workspaceApi.get('/activity', zValidator('query', ActivityQuerySchema), async (c) => {
  const { days, limit } = c.req.valid('query');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = user.id;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Get recent updates across worlds and teams (simplified architecture)
    // This is a simplified version - in a real implementation, you'd have a dedicated activity log

    const recentWorldUpdates = await db(c.env)
      .selectFrom('worlds as w')
      .innerJoin('organizations as o', 'o.id', 'w.organization_id')
      .innerJoin('organization_members as om', (join) =>
        join.on('om.organization_id', '=', (eb) => eb.ref('w.organization_id'))
          .on('om.user_id', '=', (eb) => eb.val(userId))
      )
      .leftJoin('teams as t', (join) => join.on('t.id', '=', (eb) => eb.ref('w.team_id')))
      .select([
        'w.id',
        'w.name',
        'w.organization_id',
        'w.team_id',
        'w.updated_at',
        't.name as team_name',
        'o.type as org_type',
        (eb) => eb.lit('world_updated').as('activity_type')
      ])
      .where('w.updated_at', '>=', cutoffDate)
      // Apply org-scoped access control
      .where((eb) => eb.or([
        // Personal worlds: user's personal org (already filtered by organization membership)
        eb('o.type', '=', 'personal'),
        // Business worlds: accessible based on org membership and team access
        eb.and([
          eb('o.type', '=', 'business'),
          eb.or([
            eb.and([eb('w.team_id', 'is', null), eb('w.state', '=', 'active')]),
            eb('w.team_id', 'in', 
              eb.selectFrom('team_memberships')
                .select('team_id')
                .where('user_id', '=', userId)
            ),
            eb('om.role', 'in', ['admin', 'owner'])
          ])
        ])
      ]))
      .orderBy('w.updated_at', 'desc')
      .limit(limit)
      .execute();

    // Sort activity by most recent
    const allActivity = [...recentWorldUpdates]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);

    return c.json({
      success: true,
      data: {
        activity: allActivity,
        summary: {
          totalItems: allActivity.length,
          daysCovered: days,
          oldestActivity: allActivity.length > 0 ? allActivity[allActivity.length - 1].updated_at : null
        },
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return c.json({ error: 'Failed to fetch activity data' }, 500);
  }
});

export { workspaceApi };