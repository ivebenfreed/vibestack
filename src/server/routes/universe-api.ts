/**
 * User Workspace API - Organization-as-World Model
 * 
 * Cross-organization aggregation API for universe-centric navigation
 * Organizations ARE worlds now, projects are what were formerly worlds
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
 * Full user universe - organizations as worlds model
 * Each organization IS a world with lore/canon, projects are the work items within
 */
universeApi.get('/complete', zValidator('query', UniverseQuerySchema), async (c) => {
  const { includeInactive, includeArchived, includeCounts } = c.req.valid('query');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  const userId = user.id;

  try {
    // Get all organizations user belongs to (these ARE worlds now)
    const userOrganizations = await withKysely(async (db) => {
      return await db
        .selectFrom('organization_members as om')
        .innerJoin('organizations as o', 'o.id', 'om.organization_id')
        .select([
          'o.id',
          'o.name',
          'o.slug', 
          'o.type',
          'o.lore',        // World lore
          'o.canon',       // World canon
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
          personal: {
            worlds: [],
            activeWorlds: []
          },
          summary: {
            totalOrganizations: 0,
            totalPersonalWorlds: 0,
            totalBusinessWorlds: 0,
            totalTeams: 0,
            totalActiveWorlds: 0
          },
          lastUpdated: new Date().toISOString()
        }
      });
    }

    const orgIds = userOrganizations.map(org => org.id);

    // Get project counts per organization (projects are what were formerly worlds)
    const projectCounts = includeCounts ? await withKysely(async (db) => {
      const counts = await db
        .selectFrom('projects as p')
        .select([
          'p.organization_id',
          (eb) => eb.fn.count('p.id').as('project_count')
        ])
        .where('p.organization_id', 'in', orgIds)
        .groupBy('p.organization_id')
        .execute();
      
      return counts.reduce((acc, count) => {
        acc[count.organization_id] = parseInt(count.project_count as string);
        return acc;
      }, {} as Record<string, number>);
    }) : {};

    // Get team memberships for the user
    const userTeamMemberships = await withKysely(async (db) => {
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

    // Build organization contexts (each org is a world)
    const organizationContexts: Record<string, any> = {};
    const personalWorlds: any[] = [];
    const businessWorlds: any[] = [];

    for (const org of userOrganizations) {
      const teams = userTeamMemberships.filter(tm => tm.organization_id === org.id);
      const projectCount = projectCounts[org.id] || 0;
      
      // Transform organization to world format
      const world = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type || 'business',
        lore: org.lore,
        canon: org.canon,
        role: org.role,
        project_count: projectCount,
        created_at: org.joined_at,
        updated_at: org.joined_at
      };

      const orgContext = {
        info: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          type: org.type || 'business',
          role: org.role,
          joinedAt: org.joined_at
        },
        teams: teams.map(t => ({
          id: t.team_id,
          organization_id: t.organization_id,
          name: t.team_name,
          description: t.team_description,
          team_type: t.team_type,
          user_role: t.team_role
        })),
        // Legacy fields for backward compatibility
        businessWorlds: [], // Projects will go here in UI
        personalWorlds: []  // Personal projects within org
      };
      
      organizationContexts[org.id] = orgContext;
      
      // Categorize worlds by type
      if (org.type === 'personal') {
        personalWorlds.push(world);
      } else {
        businessWorlds.push(world);
      }
    }

    // Calculate summary
    const summary = {
      totalOrganizations: userOrganizations.length,
      totalPersonalWorlds: personalWorlds.length,
      totalBusinessWorlds: businessWorlds.length,
      totalTeams: userTeamMemberships.length,
      totalActiveWorlds: userOrganizations.length // All orgs are considered active worlds
    };

    return c.json({
      success: true,
      data: {
        userId: userId,
        organizations: organizationContexts,
        personal: {
          worlds: personalWorlds,
          activeWorlds: personalWorlds // All personal worlds are active
        },
        business: {
          worlds: businessWorlds,
          activeWorlds: businessWorlds // All business worlds are active
        },
        summary: summary,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching complete workspace:', error);
    return c.json({ 
      success: false,
      error: 'Failed to fetch workspace data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/universe/activity
 * Get recent activity across all user's organizations/worlds
 */
universeApi.get('/activity', zValidator('query', ActivityQuerySchema), async (c) => {
  const { days, limit } = c.req.valid('query');
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    // Get recent project activity (projects are the active work items)
    const recentActivity = await withKysely(async (db) => {
      return await db
        .selectFrom('projects as p')
        .innerJoin('organizations as o', 'o.id', 'p.organization_id')
        .innerJoin('organization_members as om', (join) =>
          join.on('om.organization_id', '=', 'o.id')
            .on('om.user_id', '=', user.id)
        )
        .select([
          'p.id',
          'p.name',
          'p.status',
          'p.updated_at',
          'o.name as organization_name',
          'o.id as organization_id'
        ])
        .where('p.updated_at', '>=', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .orderBy('p.updated_at', 'desc')
        .limit(limit)
        .execute();
    });

    return c.json({
      success: true,
      data: {
        activity: recentActivity.map(item => ({
          id: item.id,
          type: 'project',
          name: item.name,
          status: item.status,
          world_name: item.organization_name, // Organization is the world
          world_id: item.organization_id,
          updated_at: item.updated_at
        })),
        period_days: days,
        total_items: recentActivity.length
      }
    });

  } catch (error) {
    console.error('Error fetching universe activity:', error);
    return c.json({ 
      success: false,
      error: 'Failed to fetch activity data'
    }, 500);
  }
});

/**
 * GET /api/universe/health
 * Get health metrics across all user's worlds/organizations
 */
universeApi.get('/health', async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    // Get basic health metrics for organizations/worlds
    const worldHealth = await withKysely(async (db) => {
      const orgs = await db
        .selectFrom('organization_members as om')
        .innerJoin('organizations as o', 'o.id', 'om.organization_id')
        .leftJoin('projects as p', 'p.organization_id', 'o.id')
        .select([
          'o.id',
          'o.name',
          'o.type',
          (eb) => eb.fn.count('p.id').as('project_count'),
          (eb) => eb.fn.count(
            eb.case()
              .when('p.status', '=', 'active')
              .then(eb.val(1))
              .end()
          ).as('active_projects')
        ])
        .where('om.user_id', '=', user.id)
        .groupBy(['o.id', 'o.name', 'o.type'])
        .execute();

      return orgs.map(org => ({
        world_id: org.id,
        world_name: org.name,
        world_type: org.type,
        health: {
          momentum: Math.min(100, (parseInt(org.active_projects as string) * 25)), // Simple calculation
          satisfaction: 75, // Default - would be calculated from actual metrics
          alignment: 85     // Default - would check lore/canon alignment
        },
        metrics: {
          total_projects: parseInt(org.project_count as string),
          active_projects: parseInt(org.active_projects as string)
        }
      }));
    });

    const overallHealth = worldHealth.reduce((acc, world) => {
      acc.momentum += world.health.momentum;
      acc.satisfaction += world.health.satisfaction;
      acc.alignment += world.health.alignment;
      return acc;
    }, { momentum: 0, satisfaction: 0, alignment: 0 });

    if (worldHealth.length > 0) {
      overallHealth.momentum = Math.round(overallHealth.momentum / worldHealth.length);
      overallHealth.satisfaction = Math.round(overallHealth.satisfaction / worldHealth.length);
      overallHealth.alignment = Math.round(overallHealth.alignment / worldHealth.length);
    }

    return c.json({
      success: true,
      data: {
        overall_health: overallHealth,
        worlds: worldHealth,
        last_calculated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching universe health:', error);
    return c.json({ 
      success: false,
      error: 'Failed to fetch health data'
    }, 500);
  }
});

export { universeApi };