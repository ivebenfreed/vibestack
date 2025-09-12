/**
 * Worlds Management API (Org-Scoped) - OpenAPI Version
 * 
 * Unified API for Worlds operations using standard organization context.
 * All worlds are organization-scoped - personal worlds live in user's personal org,
 * business worlds live in business orgs. No more dual ownership patterns.
 * Can be org-wide (team_id = NULL) or team-specific (team_id = UUID)
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { sql } from 'kysely';
import { hybridRLSOrgActorMiddleware } from '../middleware/hybrid-rls-org-actor';
import { withKysely } from '../lib/database-manager';
import type { AppContext } from '../types/hono';

const worldsApi = new OpenAPIHono<AppContext>();

// Apply organization security middleware to all routes
worldsApi.use('*', hybridRLSOrgActorMiddleware);

// ===== SCHEMAS =====

const WorldStateEnum = z.enum(['exploring', 'developing', 'active', 'paused', 'archived']);
const WorldTypeEnum = z.enum(['personal', 'business', 'client', 'department', 'project_domain']);
const PriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);

const WorldSchema = z.object({
  id: z.string().uuid().openapi({
    example: '01920000-4000-7000-8000-000000000001',
    description: 'World unique identifier'
  }),
  organization_id: z.string().uuid().openapi({
    example: '01920000-1000-7000-8000-000000000001',
    description: 'Organization ID'
  }),
  team_id: z.string().uuid().nullable().openapi({
    example: '01920000-3000-7000-8000-000000000001',
    description: 'Team ID (null for org-wide worlds)'
  }),
  name: z.string().openapi({
    example: 'Product Development World',
    description: 'World name'
  }),
  description: z.string().nullable().openapi({
    example: 'Main product development and innovation hub',
    description: 'World description'
  }),
  state: WorldStateEnum.openapi({
    example: 'active',
    description: 'Current state of the world'
  }),
  world_type: WorldTypeEnum.openapi({
    example: 'business',
    description: 'Type of world'
  }),
  priority: PriorityEnum.openapi({
    example: 'high',
    description: 'Priority level'
  }),
  created_at: z.string().datetime().openapi({
    example: '2024-01-15T10:30:00Z',
    description: 'Creation timestamp'
  }),
  updated_at: z.string().datetime().openapi({
    example: '2024-01-15T10:30:00Z',
    description: 'Last update timestamp'
  }),
  team_name: z.string().nullable().optional().openapi({
    example: 'Engineering Team',
    description: 'Name of associated team'
  })
}).openapi('World');

const CreateWorldRequestSchema = z.object({
  name: z.string().min(1).max(255).openapi({
    example: 'Product Development World',
    description: 'World name'
  }),
  description: z.string().optional().openapi({
    example: 'Main product development hub',
    description: 'World description'
  }),
  team_id: z.string().uuid().optional().openapi({
    example: '01920000-3000-7000-8000-000000000001',
    description: 'Team ID (omit for org-wide world)'
  }),
  state: WorldStateEnum.default('active').openapi({
    example: 'active',
    description: 'Initial state'
  }),
  world_type: WorldTypeEnum.default('business').openapi({
    example: 'business',
    description: 'Type of world'
  }),
  priority: PriorityEnum.default('medium').openapi({
    example: 'medium',
    description: 'Priority level'
  })
}).openapi('CreateWorldRequest');

const UpdateWorldRequestSchema = z.object({
  name: z.string().min(1).max(255).optional().openapi({
    example: 'Updated World Name',
    description: 'World name'
  }),
  description: z.string().optional().openapi({
    example: 'Updated description',
    description: 'World description'
  }),
  team_id: z.string().uuid().nullable().optional().openapi({
    example: '01920000-3000-7000-8000-000000000001',
    description: 'Team ID (null for org-wide)'
  }),
  state: WorldStateEnum.optional().openapi({
    example: 'paused',
    description: 'World state'
  }),
  world_type: WorldTypeEnum.optional().openapi({
    example: 'project_domain',
    description: 'Type of world'
  }),
  priority: PriorityEnum.optional().openapi({
    example: 'critical',
    description: 'Priority level'
  })
}).openapi('UpdateWorldRequest');

// ===== ROUTES =====

// GET /api/worlds - List worlds
const listWorldsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Worlds'],
  summary: 'List worlds',
  description: 'Get all worlds in the organization that the user has access to',
  request: {
    query: z.object({
      includeInactive: z.string().optional().openapi({
        example: 'false',
        description: 'Include inactive worlds'
      }),
      includeArchived: z.string().optional().openapi({
        example: 'false',
        description: 'Include archived worlds'
      }),
      teamId: z.string().uuid().optional().openapi({
        example: '01920000-3000-7000-8000-000000000001',
        description: 'Filter by team ID'
      })
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            worlds: z.array(WorldSchema)
          }),
        },
      },
      description: 'List of worlds',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Internal server error',
    },
  },
});

worldsApi.openapi(listWorldsRoute, async (c) => {
  const security = c.get('security');
  const query = c.req.query();
  
  const includeInactive = query.includeInactive === 'true';
  const includeArchived = query.includeArchived === 'true';
  const teamId = query.teamId;

  try {
    const result = await withKysely(c.env, async (db) => {
      let worldsQuery = db
        .selectFrom('worlds as w')
        .leftJoin('teams as t', 't.id', 'w.team_id')
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
        .where('w.organization_id', '=', security.organizationId)
        .orderBy('w.priority', 'desc')
        .orderBy('w.name', 'asc');

      // Apply filters
      if (!includeInactive) {
        worldsQuery = worldsQuery.where('w.state', 'not in', ['paused']);
      }
      if (!includeArchived) {
        worldsQuery = worldsQuery.where('w.state', '!=', 'archived');
      }
      if (teamId) {
        worldsQuery = worldsQuery.where('w.team_id', '=', teamId);
      }

      return await worldsQuery.execute();
    });

    return c.json({ worlds: result });
  } catch (error) {
    console.error('Error fetching worlds:', error);
    return c.json({ error: 'Failed to fetch worlds' }, 500);
  }
});

// POST /api/worlds - Create world
const createWorldRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Worlds'],
  summary: 'Create world',
  description: 'Create a new world in the organization',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateWorldRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: WorldSchema,
        },
      },
      description: 'World created successfully',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Forbidden',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Internal server error',
    },
  },
});

worldsApi.openapi(createWorldRoute, async (c) => {
  const body = c.req.valid('json');
  const security = c.get('security');

  // Check permissions
  if (security.organizationRole !== 'owner' && 
      security.organizationRole !== 'admin' && 
      security.organizationRole !== 'manager') {
    return c.json({ error: 'Forbidden: Only owners, admins, and managers can create worlds' }, 403);
  }

  try {
    const result = await withKysely(c.env, async (db) => {
      const newWorld = {
        id: crypto.randomUUID(),
        organization_id: security.organizationId,
        team_id: body.team_id || null,
        name: body.name,
        description: body.description || null,
        state: body.state || 'active',
        world_type: body.world_type || 'business',
        priority: body.priority || 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await db
        .insertInto('worlds')
        .values(newWorld)
        .execute();

      // Fetch the created world with team name
      const created = await db
        .selectFrom('worlds as w')
        .leftJoin('teams as t', 't.id', 'w.team_id')
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
        .where('w.id', '=', newWorld.id)
        .executeTakeFirstOrThrow();

      return created;
    });

    return c.json(result, 201);
  } catch (error) {
    console.error('Error creating world:', error);
    return c.json({ error: 'Failed to create world' }, 500);
  }
});

// GET /api/worlds/by-team/:teamId - Get worlds by team
const getWorldsByTeamRoute = createRoute({
  method: 'get',
  path: '/by-team/{teamId}',
  tags: ['Worlds'],
  summary: 'Get worlds by team',
  description: 'Get all worlds associated with a specific team',
  request: {
    params: z.object({
      teamId: z.string().uuid().openapi({
        example: '01920000-3000-7000-8000-000000000001',
        description: 'Team ID'
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            worlds: z.array(WorldSchema)
          }),
        },
      },
      description: 'List of worlds for the team',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Forbidden',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Internal server error',
    },
  },
});

worldsApi.openapi(getWorldsByTeamRoute, async (c) => {
  const teamId = c.req.param('teamId');
  const security = c.get('security');

  try {
    const result = await withKysely(c.env, async (db) => {
      // First verify the team belongs to the user's organization
      const team = await db
        .selectFrom('teams')
        .select('organization_id')
        .where('id', '=', teamId)
        .executeTakeFirst();

      if (!team || team.organization_id !== security.organizationId) {
        throw new Error('Team not found or access denied');
      }

      // Get worlds for this team
      const worlds = await db
        .selectFrom('worlds as w')
        .leftJoin('teams as t', 't.id', 'w.team_id')
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
        .where('w.team_id', '=', teamId)
        .where('w.organization_id', '=', security.organizationId)
        .orderBy('w.priority', 'desc')
        .orderBy('w.name', 'asc')
        .execute();

      return worlds;
    });

    return c.json({ worlds: result });
  } catch (error) {
    console.error('Error fetching worlds by team:', error);
    if (error.message === 'Team not found or access denied') {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: 'Failed to fetch worlds' }, 500);
  }
});

// PUT /api/worlds/:id - Update world
const updateWorldRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Worlds'],
  summary: 'Update world',
  description: 'Update an existing world',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        example: '01920000-4000-7000-8000-000000000001',
        description: 'World ID'
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateWorldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: WorldSchema,
        },
      },
      description: 'World updated successfully',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Forbidden',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'World not found',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Internal server error',
    },
  },
});

worldsApi.openapi(updateWorldRoute, async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const security = c.get('security');

  try {
    const result = await withKysely(c.env, async (db) => {
      // Get world and verify organization
      const world = await db
        .selectFrom('worlds')
        .select(['organization_id'])
        .where('id', '=', id)
        .executeTakeFirst();

      if (!world) {
        throw new Error('World not found');
      }

      if (world.organization_id !== security.organizationId) {
        throw new Error('Access denied');
      }

      // Check permissions
      if (security.organizationRole !== 'owner' && 
          security.organizationRole !== 'admin' && 
          security.organizationRole !== 'manager') {
        throw new Error('Only owners, admins, and managers can update worlds');
      }

      // Update world
      await db
        .updateTable('worlds')
        .set({
          ...body,
          updated_at: new Date().toISOString()
        })
        .where('id', '=', id)
        .execute();

      // Fetch updated world
      const updated = await db
        .selectFrom('worlds as w')
        .leftJoin('teams as t', 't.id', 'w.team_id')
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
        .where('w.id', '=', id)
        .executeTakeFirstOrThrow();

      return updated;
    });

    return c.json(result);
  } catch (error) {
    console.error('Error updating world:', error);
    if (error.message === 'World not found') {
      return c.json({ error: error.message }, 404);
    }
    if (error.message === 'Access denied' || error.message.includes('Only owners')) {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: 'Failed to update world' }, 500);
  }
});

// DELETE /api/worlds/:id - Delete world
const deleteWorldRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Worlds'],
  summary: 'Delete world',
  description: 'Delete a world (soft delete by setting state to archived)',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        example: '01920000-4000-7000-8000-000000000001',
        description: 'World ID'
      }),
    }),
  },
  responses: {
    204: {
      description: 'World deleted successfully',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Forbidden',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'World not found',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Internal server error',
    },
  },
});

worldsApi.openapi(deleteWorldRoute, async (c) => {
  const id = c.req.param('id');
  const security = c.get('security');

  try {
    await withKysely(c.env, async (db) => {
      // Get world and verify organization
      const world = await db
        .selectFrom('worlds')
        .select(['organization_id'])
        .where('id', '=', id)
        .executeTakeFirst();

      if (!world) {
        throw new Error('World not found');
      }

      if (world.organization_id !== security.organizationId) {
        throw new Error('Access denied');
      }

      // Only org owners and admins can delete worlds
      if (security.organizationRole !== 'owner' && security.organizationRole !== 'admin') {
        throw new Error('Only organization owners and admins can delete worlds');
      }

      // Soft delete by archiving
      await db
        .updateTable('worlds')
        .set({
          state: 'archived',
          updated_at: new Date().toISOString()
        })
        .where('id', '=', id)
        .execute();
    });

    return c.body(null, 204);
  } catch (error) {
    console.error('Error deleting world:', error);
    if (error.message === 'World not found') {
      return c.json({ error: error.message }, 404);
    }
    if (error.message === 'Access denied' || error.message.includes('Only organization')) {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: 'Failed to delete world' }, 500);
  }
});

export default worldsApi;