/**
 * Teams Management API - OpenAPI Version
 * 
 * Dedicated API for Teams operations (core business logic)
 * Teams represent organizational units within a single organization that can have different members
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { hybridRLSOrgActorMiddleware } from '../middleware/hybrid-rls-org-actor';
import { db } from '../lib/kysely';
import type { AppContext } from '../types/hono';

const teamsApi = new OpenAPIHono<AppContext>();

// Apply organization security middleware to routes with orgId parameter
teamsApi.use('/org/:orgId', hybridRLSOrgActorMiddleware);
teamsApi.use('/org/:orgId/*', hybridRLSOrgActorMiddleware);
// For routes that use teamId, we need to extract orgId from the team
// These routes will handle organization context internally

// ===== SCHEMAS =====

const TeamTypeEnum = z.enum(['department', 'project', 'functional', 'cross_functional']);

const TeamSchema = z.object({
  id: z.string().uuid().openapi({
    example: '01920000-3000-7000-8000-000000000001',
    description: 'Team unique identifier'
  }),
  organization_id: z.string().uuid().openapi({
    example: '01920000-1000-7000-8000-000000000001',
    description: 'Organization ID'
  }),
  name: z.string().openapi({
    example: 'Engineering Team',
    description: 'Team name'
  }),
  description: z.string().nullable().openapi({
    example: 'Core engineering team responsible for product development',
    description: 'Team description'
  }),
  parent_team_id: z.string().uuid().nullable().openapi({
    example: '01920000-3000-7000-8000-000000000002',
    description: 'Parent team ID for hierarchical structure'
  }),
  team_type: TeamTypeEnum.openapi({
    example: 'department',
    description: 'Type of team'
  }),
  created_at: z.string().datetime().openapi({
    example: '2024-01-15T10:30:00Z',
    description: 'Creation timestamp'
  }),
  updated_at: z.string().datetime().openapi({
    example: '2024-01-15T10:30:00Z',
    description: 'Last update timestamp'
  }),
  user_role: z.enum(['member', 'lead', 'admin']).nullable().openapi({
    example: 'admin',
    description: 'Current user role in the team'
  })
}).openapi('Team');

const CreateTeamRequestSchema = z.object({
  name: z.string().min(1).max(255).openapi({
    example: 'Engineering Team',
    description: 'Team name'
  }),
  description: z.string().optional().openapi({
    example: 'Core engineering team',
    description: 'Team description'
  }),
  parent_team_id: z.string().uuid().optional().openapi({
    example: '01920000-3000-7000-8000-000000000002',
    description: 'Parent team ID'
  }),
  team_type: TeamTypeEnum.default('department').openapi({
    example: 'department',
    description: 'Type of team'
  })
}).openapi('CreateTeamRequest');

const UpdateTeamRequestSchema = z.object({
  name: z.string().min(1).max(255).optional().openapi({
    example: 'Updated Team Name',
    description: 'Team name'
  }),
  description: z.string().optional().openapi({
    example: 'Updated description',
    description: 'Team description'
  }),
  parent_team_id: z.string().uuid().nullable().optional().openapi({
    example: '01920000-3000-7000-8000-000000000002',
    description: 'Parent team ID'
  }),
  team_type: TeamTypeEnum.optional().openapi({
    example: 'project',
    description: 'Type of team'
  })
}).openapi('UpdateTeamRequest');

const AddMemberRequestSchema = z.object({
  user_id: z.string().uuid().openapi({
    example: '01920000-2000-7000-8000-000000000001',
    description: 'User ID to add to team'
  }),
  role: z.enum(['member', 'lead', 'admin']).default('member').openapi({
    example: 'member',
    description: 'Role for the user in the team'
  })
}).openapi('AddMemberRequest');

const UpdateMemberRoleRequestSchema = z.object({
  role: z.enum(['member', 'lead', 'admin']).openapi({
    example: 'lead',
    description: 'New role for the user'
  })
}).openapi('UpdateMemberRoleRequest');

const TeamMembershipSchema = z.object({
  team_id: z.string().uuid(),
  team_name: z.string(),
  role: z.enum(['member', 'lead', 'admin']),
  joined_at: z.string().datetime()
}).openapi('TeamMembership');

// ===== ROUTES =====

// GET /api/teams/org/:orgId - List teams in organization
export const listTeamsRoute = createRoute({
  method: 'get',
  path: '/org/{orgId}',
  tags: ['Teams'],
  summary: 'List teams in organization',
  description: 'Get all teams in an organization that the user has access to',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        example: '01920000-1000-7000-8000-000000000001',
        description: 'Organization ID'
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            teams: z.array(TeamSchema)
          }),
        },
      },
      description: 'List of teams',
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

teamsApi.openapi(listTeamsRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const security = c.get('security');

  // Verify user belongs to this organization
  if (orgId !== security.organizationId) {
    return c.json({ error: 'Forbidden: Can only access teams in own organization' }, 403);
  }

  try {
    const database = db(c.env);
    
    // Get all teams in the organization
    const teams = await database
      .selectFrom('teams')
      .selectAll()
      .where('organization_id', '=', orgId)
      .orderBy('name', 'asc')
      .execute();

    // Get user's team memberships
    const memberships = await database
      .selectFrom('team_memberships')
      .select(['team_id', 'role'])
      .where('user_id', '=', security.userId)
      .execute();

    const membershipMap = new Map(memberships.map(m => [m.team_id, m.role]));

    // Add user role to each team
    const teamsWithRoles = teams.map(team => ({
      ...team,
      user_role: membershipMap.get(team.id) || null,
    }));

    return c.json({ teams: teamsWithRoles });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return c.json({ error: 'Failed to fetch teams' }, 500);
  }
});

// POST /api/teams/org/:orgId - Create new team
export const createTeamRoute = createRoute({
  method: 'post',
  path: '/org/{orgId}',
  tags: ['Teams'],
  summary: 'Create new team',
  description: 'Create a new team in the organization',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        example: '01920000-1000-7000-8000-000000000001',
        description: 'Organization ID'
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateTeamRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: TeamSchema,
        },
      },
      description: 'Team created successfully',
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

teamsApi.openapi(createTeamRoute, async (c) => {
  const orgId = c.req.param('orgId');
  const body = c.req.valid('json');
  const security = c.get('security');

  // Check organization match and permissions
  if (orgId !== security.organizationId) {
    return c.json({ error: 'Forbidden: Can only create teams in own organization' }, 403);
  }

  if (security.organizationRole !== 'owner' && security.organizationRole !== 'admin') {
    return c.json({ error: 'Forbidden: Only owners and admins can create teams' }, 403);
  }

  try {
    const database = db(c.env);
    
    const newTeam = {
      id: crypto.randomUUID(),
      organization_id: orgId,
      name: body.name,
      description: body.description || null,
      parent_team_id: body.parent_team_id || null,
      team_type: body.team_type || 'department',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_role: 'admin' // Creator becomes admin
    };

    await database.transaction().execute(async (trx) => {
      // Create the team
      await trx
        .insertInto('teams')
        .values({
          ...newTeam,
          user_role: undefined // Remove user_role from DB insert
        })
        .execute();

      // Add creator as admin
      await trx
        .insertInto('team_memberships')
        .values({
          id: crypto.randomUUID(),
          team_id: newTeam.id,
          user_id: security.userId,
          role: 'admin',
          joined_at: new Date().toISOString()
        })
        .execute();
    });

    return c.json(newTeam, 201);
  } catch (error) {
    console.error('Error creating team:', error);
    return c.json({ error: 'Failed to create team' }, 500);
  }
});

// PUT /api/teams/:teamId - Update team
export const updateTeamRoute = createRoute({
  method: 'put',
  path: '/{teamId}',
  tags: ['Teams'],
  summary: 'Update team',
  description: 'Update an existing team',
  request: {
    params: z.object({
      teamId: z.string().uuid().openapi({
        example: '01920000-3000-7000-8000-000000000001',
        description: 'Team ID'
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateTeamRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TeamSchema,
        },
      },
      description: 'Team updated successfully',
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
      description: 'Team not found',
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

teamsApi.openapi(updateTeamRoute, async (c) => {
  const teamId = c.req.param('teamId');
  const body = c.req.valid('json');
  const security = c.get('security');

  try {
    const database = db(c.env);
    
    // Get team and verify organization
    const team = await database
      .selectFrom('teams')
      .selectAll()
      .where('id', '=', teamId)
      .executeTakeFirst();

    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }

    if (team.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Can only update teams in own organization' }, 403);
    }

    // Check user permissions
    const membership = await database
      .selectFrom('team_memberships')
      .select('role')
      .where('team_id', '=', teamId)
      .where('user_id', '=', security.userId)
      .executeTakeFirst();

    const canUpdate = 
      security.organizationRole === 'owner' ||
      security.organizationRole === 'admin' ||
      membership?.role === 'admin';

    if (!canUpdate) {
      return c.json({ error: 'Forbidden: Only team admins can update teams' }, 403);
    }

    // Update team
    const updatedTeam = await database
      .updateTable('teams')
      .set({
        ...body,
        updated_at: new Date().toISOString()
      })
      .where('id', '=', teamId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return c.json({
      ...updatedTeam,
      user_role: membership?.role || null
    });
  } catch (error) {
    console.error('Error updating team:', error);
    return c.json({ error: 'Failed to update team' }, 500);
  }
});

// DELETE /api/teams/:teamId - Delete team
export const deleteTeamRoute = createRoute({
  method: 'delete',
  path: '/{teamId}',
  tags: ['Teams'],
  summary: 'Delete team',
  description: 'Delete a team and all its memberships',
  request: {
    params: z.object({
      teamId: z.string().uuid().openapi({
        example: '01920000-3000-7000-8000-000000000001',
        description: 'Team ID'
      }),
    }),
  },
  responses: {
    204: {
      description: 'Team deleted successfully',
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
      description: 'Team not found',
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

teamsApi.openapi(deleteTeamRoute, async (c) => {
  const teamId = c.req.param('teamId');
  const security = c.get('security');

  try {
    const database = db(c.env);
    
    // Get team and verify organization
    const team = await database
      .selectFrom('teams')
      .selectAll()
      .where('id', '=', teamId)
      .executeTakeFirst();

    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }

    if (team.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Can only delete teams in own organization' }, 403);
    }

    // Only org owners and admins can delete teams
    if (security.organizationRole !== 'owner' && security.organizationRole !== 'admin') {
      return c.json({ error: 'Forbidden: Only organization owners and admins can delete teams' }, 403);
    }

    // Delete team and all memberships (cascade)
    await database.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('team_memberships')
        .where('team_id', '=', teamId)
        .execute();

      await trx
        .deleteFrom('teams')
        .where('id', '=', teamId)
        .execute();
    });

    return c.body(null, 204);
  } catch (error) {
    console.error('Error deleting team:', error);
    return c.json({ error: 'Failed to delete team' }, 500);
  }
});

// POST /api/teams/:teamId/members - Add team member
export const addTeamMemberRoute = createRoute({
  method: 'post',
  path: '/{teamId}/members',
  tags: ['Teams'],
  summary: 'Add team member',
  description: 'Add a user to a team with specified role',
  request: {
    params: z.object({
      teamId: z.string().uuid().openapi({
        example: '01920000-3000-7000-8000-000000000001',
        description: 'Team ID'
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: AddMemberRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            member: z.object({
              user_id: z.string().uuid(),
              role: z.enum(['member', 'lead', 'admin']),
              joined_at: z.string().datetime()
            })
          }),
        },
      },
      description: 'Member added successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          }),
        },
      },
      description: 'Bad request',
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
      description: 'Team or user not found',
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

teamsApi.openapi(addTeamMemberRoute, async (c) => {
  const teamId = c.req.param('teamId');
  const body = c.req.valid('json');
  const security = c.get('security');

  try {
    const database = db(c.env);
    
    // Get team and verify organization
    const team = await database
      .selectFrom('teams')
      .selectAll()
      .where('id', '=', teamId)
      .executeTakeFirst();

    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }

    if (team.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Can only manage teams in own organization' }, 403);
    }

    // Check user permissions
    const membership = await database
      .selectFrom('team_memberships')
      .select('role')
      .where('team_id', '=', teamId)
      .where('user_id', '=', security.userId)
      .executeTakeFirst();

    const canAddMembers = 
      security.organizationRole === 'owner' ||
      security.organizationRole === 'admin' ||
      membership?.role === 'admin' ||
      membership?.role === 'lead';

    if (!canAddMembers) {
      return c.json({ error: 'Forbidden: Only team admins and leads can add members' }, 403);
    }

    // Check if user is already a member
    const existingMember = await database
      .selectFrom('team_memberships')
      .select('id')
      .where('team_id', '=', teamId)
      .where('user_id', '=', body.user_id)
      .executeTakeFirst();

    if (existingMember) {
      return c.json({ error: 'User is already a member of this team' }, 400);
    }

    // Add the member
    const newMember = {
      id: crypto.randomUUID(),
      team_id: teamId,
      user_id: body.user_id,
      role: body.role || 'member',
      joined_at: new Date().toISOString()
    };

    await database
      .insertInto('team_memberships')
      .values(newMember)
      .execute();

    return c.json({
      message: 'Member added successfully',
      member: {
        user_id: newMember.user_id,
        role: newMember.role,
        joined_at: newMember.joined_at
      }
    }, 201);
  } catch (error) {
    console.error('Error adding team member:', error);
    return c.json({ error: 'Failed to add team member' }, 500);
  }
});

// GET /api/teams/user/:userId/memberships - Get user team memberships
export const getUserMembershipsRoute = createRoute({
  method: 'get',
  path: '/user/{userId}/memberships',
  tags: ['Teams'],
  summary: 'Get user team memberships',
  description: 'Get all team memberships for a specific user',
  request: {
    params: z.object({
      userId: z.string().uuid().openapi({
        example: '01920000-2000-7000-8000-000000000001',
        description: 'User ID'
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            memberships: z.array(TeamMembershipSchema)
          }),
        },
      },
      description: 'List of team memberships',
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

teamsApi.openapi(getUserMembershipsRoute, async (c) => {
  const userId = c.req.param('userId');
  const security = c.get('security');

  // Users can only view their own memberships unless they're org admin
  if (userId !== security.userId && 
      security.organizationRole !== 'owner' && 
      security.organizationRole !== 'admin') {
    return c.json({ error: 'Forbidden: Can only view own memberships' }, 403);
  }

  try {
    const database = db(c.env);
    
    const memberships = await database
      .selectFrom('team_memberships as tm')
      .innerJoin('teams as t', 't.id', 'tm.team_id')
      .select([
        'tm.team_id',
        't.name as team_name',
        'tm.role',
        'tm.joined_at'
      ])
      .where('tm.user_id', '=', userId)
      .where('t.organization_id', '=', security.organizationId)
      .orderBy('t.name', 'asc')
      .execute();

    return c.json({ memberships });
  } catch (error) {
    console.error('Error fetching user memberships:', error);
    return c.json({ error: 'Failed to fetch memberships' }, 500);
  }
});

// Add doc endpoint for this router
teamsApi.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Teams API',
  },
});

export default teamsApi;