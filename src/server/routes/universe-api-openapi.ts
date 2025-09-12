/**
 * Universe API - Cross-organization aggregation endpoints with OpenAPI
 * 
 * Provides access to user's complete universe data across all organizations/worlds
 * using OpenAPIHono for automatic documentation generation.
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth';
import { withKysely } from '../lib/database-manager';
import type { Bindings } from '../types';
import type { Variables } from '../types';

// Create OpenAPI router
const universeApi = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Apply authentication middleware
universeApi.use('/*', authMiddleware);

// ================== Schemas ==================

// Activity query schema
const ActivityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7).openapi({
    example: 7,
    description: 'Number of days to look back for activity'
  }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    example: 20,
    description: 'Maximum number of activity items to return'
  })
});

// Team member schema
const TeamMemberSchema = z.object({
  id: z.string().uuid().openapi({ example: '01920000-3000-7000-8000-000000000001' }),
  organization_id: z.string().uuid().openapi({ example: '01920000-1000-7000-8000-000000000001' }),
  name: z.string().openapi({ example: 'Development Team' }),
  description: z.string().nullable().openapi({ example: 'Core development team' }),
  team_type: z.string().nullable().openapi({ example: 'development' }),
  user_role: z.string().nullable().openapi({ example: 'member' })
});

// Organization context schema
const OrganizationContextSchema = z.object({
  id: z.string().uuid().openapi({ example: '01920000-1000-7000-8000-000000000001' }),
  name: z.string().openapi({ example: 'Wide Corp Solutions' }),
  type: z.string().openapi({ example: 'business' }),
  purpose: z.string().nullable().openapi({ example: 'Technology solutions provider' }),
  settings: z.any().nullable(),
  role: z.string().openapi({ example: 'owner' }),
  permissions: z.array(z.string()).openapi({ example: ['create', 'read', 'update', 'delete'] }),
  joinedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  teamMemberships: z.array(TeamMemberSchema),
  businessWorlds: z.array(z.any()).openapi({ example: [] }),
  personalWorlds: z.array(z.any()).openapi({ example: [] })
});

// World schema
const WorldSchema = z.object({
  id: z.string().uuid().openapi({ example: '01920000-1000-7000-8000-000000000001' }),
  name: z.string().openapi({ example: 'Wide Corp Solutions' }),
  type: z.enum(['personal', 'business']).openapi({ example: 'business' }),
  lore: z.string().nullable().openapi({ example: 'Leading technology solutions' }),
  canon: z.any().nullable(),
  role: z.string().openapi({ example: 'owner' })
});

// Summary schema
const SummarySchema = z.object({
  totalOrganizations: z.number().int().openapi({ example: 3 }),
  totalPersonalWorlds: z.number().int().openapi({ example: 1 }),
  totalBusinessWorlds: z.number().int().openapi({ example: 2 }),
  totalTeams: z.number().int().openapi({ example: 5 }),
  totalActiveWorlds: z.number().int().openapi({ example: 3 })
});

// Complete universe response schema
const CompleteUniverseResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.object({
    userId: z.string().uuid().openapi({ example: '01920000-2000-7000-8000-000000000001' }),
    organizations: z.record(z.string().uuid(), OrganizationContextSchema),
    personal: z.object({
      worlds: z.array(WorldSchema),
      activeWorlds: z.array(WorldSchema)
    }),
    business: z.object({
      worlds: z.array(WorldSchema),
      activeWorlds: z.array(WorldSchema)
    }),
    summary: SummarySchema,
    lastUpdated: z.string().datetime().openapi({ example: '2024-01-01T12:00:00.000Z' })
  })
});

// Activity item schema
const ActivityItemSchema = z.object({
  id: z.string().uuid().openapi({ example: '01920000-4000-7000-8000-000000000001' }),
  type: z.string().openapi({ example: 'project' }),
  name: z.string().openapi({ example: 'Q1 Launch' }),
  status: z.string().nullable().openapi({ example: 'active' }),
  world_name: z.string().openapi({ example: 'Wide Corp Solutions' }),
  world_id: z.string().uuid().openapi({ example: '01920000-1000-7000-8000-000000000001' }),
  updated_at: z.string().datetime().nullable().openapi({ example: '2024-01-01T12:00:00.000Z' })
});

// Activity response schema
const ActivityResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.object({
    activity: z.array(ActivityItemSchema),
    period_days: z.number().int().openapi({ example: 7 }),
    total_items: z.number().int().openapi({ example: 10 })
  })
});

// Health metrics schema
const HealthMetricsSchema = z.object({
  momentum: z.number().int().min(0).max(100).openapi({ example: 75 }),
  satisfaction: z.number().int().min(0).max(100).openapi({ example: 80 }),
  alignment: z.number().int().min(0).max(100).openapi({ example: 85 })
});

// World health schema
const WorldHealthSchema = z.object({
  world_id: z.string().uuid().openapi({ example: '01920000-1000-7000-8000-000000000001' }),
  world_name: z.string().openapi({ example: 'Wide Corp Solutions' }),
  world_type: z.string().nullable().openapi({ example: 'business' }),
  health: HealthMetricsSchema,
  metrics: z.object({
    total_projects: z.number().int().openapi({ example: 10 }),
    active_projects: z.number().int().openapi({ example: 7 })
  })
});

// Health response schema
const HealthResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.object({
    overall_health: HealthMetricsSchema,
    worlds: z.array(WorldHealthSchema),
    last_calculated: z.string().datetime().openapi({ example: '2024-01-01T12:00:00.000Z' })
  })
});

// Error response schema
const ErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  error: z.string().openapi({ example: 'Failed to fetch data' }),
  details: z.string().optional().openapi({ example: 'Database connection error' })
});

// Auth error response
const AuthErrorResponseSchema = z.object({
  error: z.string().openapi({ example: 'Authentication required' })
});

// ================== Routes ==================

/**
 * GET /api/universe/complete
 * Get user's complete universe data across all organizations/worlds
 */
const getCompleteUniverseRoute = createRoute({
  method: 'get',
  path: '/complete',
  tags: ['Universe'],
  summary: 'Get complete universe data',
  description: 'Fetches all organizations, teams, and worlds for the authenticated user',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Complete universe data',
      content: {
        'application/json': {
          schema: CompleteUniverseResponseSchema
        }
      }
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: AuthErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

universeApi.openapi(getCompleteUniverseRoute, async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const userId = user.id;

  try {
    // Get all user's organizations with their settings
    const userOrganizations = await withKysely(async (db) => {
      return await db
        .selectFrom('organization_members as om')
        .innerJoin('organizations as o', 'o.id', 'om.organization_id')
        .select([
          'o.id',
          'o.name',
          'o.type',
          'o.lore as purpose',
          'o.settings',
          'om.role',
          'om.permissions',
          'om.created_at as joined_at'
        ])
        .where('om.user_id', '=', userId)
        .execute();
    });

    if (!userOrganizations.length) {
      return c.json({
        success: true,
        data: {
          userId,
          organizations: {},
          personal: {
            worlds: [],
            activeWorlds: []
          },
          business: {
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

    // Get all team memberships for all user's organizations
    const orgIds = userOrganizations.map(o => o.id);
    const userTeamMemberships = await withKysely(async (db) => {
      return await db
        .selectFrom('team_memberships as tm')
        .innerJoin('teams as t', 't.id', 'tm.team_id')
        .select([
          't.id',
          't.organization_id',
          't.name as team_name',
          't.description as team_description',
          't.team_type',
          'tm.role as team_role'
        ])
        .where('tm.user_id', '=', userId)
        .where('t.organization_id', 'in', orgIds)
        .execute();
    });

    // Build the comprehensive organization contexts
    const organizationContexts: Record<string, any> = {};
    const personalWorlds: any[] = [];
    const businessWorlds: any[] = [];

    for (const org of userOrganizations) {
      // Create a simplified world view
      const world = {
        id: org.id,
        name: org.name,
        type: org.type as 'personal' | 'business',
        lore: org.purpose,
        canon: org.settings?.canon || null,
        role: org.role
      };

      // Full organization context
      const orgContext = {
        id: org.id,
        name: org.name,
        type: org.type,
        purpose: org.purpose,
        settings: org.settings,
        role: org.role,
        permissions: org.permissions || [],
        joinedAt: org.joined_at,
        teamMemberships: userTeamMemberships.filter(t => t.organization_id === org.id).map(t => ({
          id: t.id,
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
const getActivityRoute = createRoute({
  method: 'get',
  path: '/activity',
  tags: ['Universe'],
  summary: 'Get recent activity',
  description: 'Fetches recent activity across all user organizations',
  security: [{ BearerAuth: [] }],
  request: {
    query: ActivityQuerySchema
  },
  responses: {
    200: {
      description: 'Recent activity data',
      content: {
        'application/json': {
          schema: ActivityResponseSchema
        }
      }
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: AuthErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

universeApi.openapi(getActivityRoute, async (c) => {
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
const getHealthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Universe'],
  summary: 'Get health metrics',
  description: 'Fetches health metrics across all user organizations',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Health metrics data',
      content: {
        'application/json': {
          schema: HealthResponseSchema
        }
      }
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: AuthErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

universeApi.openapi(getHealthRoute, async (c) => {
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

export default universeApi;
export { universeApi };