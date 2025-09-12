/**
 * Worlds Management API
 * 
 * Dedicated API for Worlds operations (core business logic)
 * Worlds represent life areas (personal) or business domains (organizational)
 * Can be org-wide (team_id = NULL) or team-specific (team_id = UUID)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { hybridRLSOrgActorMiddleware } from '../middleware/hybrid-rls-org-actor';
import { db } from '../lib/kysely';

const worldsApi = new Hono();

// Validation schemas
const CreateWorldSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  team_id: z.string().uuid().optional(), // NULL = org-wide, UUID = team-specific
  owner_user_id: z.string().uuid().optional(), // NULL = business world, UUID = personal world
  state: z.enum(['exploring', 'developing', 'active', 'paused', 'archived']).default('active'),
  world_type: z.enum(['personal', 'business', 'client', 'department', 'project_domain']).default('business'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
});

const UpdateWorldSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  team_id: z.string().uuid().nullable().optional(),
  state: z.enum(['exploring', 'developing', 'active', 'paused', 'archived']).optional(),
  world_type: z.enum(['personal', 'business', 'client', 'department', 'project_domain']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional()
});

const CrossOrgQuerySchema = z.object({
  includeInactive: z.boolean().default(false),
  includeArchived: z.boolean().default(false)
});

// Apply organization security middleware to all routes
worldsApi.use('*', hybridRLSOrgActorMiddleware);

/**
 * GET /api/worlds/personal/:userId
 * Get personal worlds across all organizations for a user
 */
worldsApi.get('/personal/:userId', zValidator('query', CrossOrgQuerySchema), async (c) => {
  const userId = c.req.param('userId');
  const { includeInactive, includeArchived } = c.req.valid('query');
  const security = c.get('security');

  // Verify user can access this user ID (self only for now)
  if (userId !== security.userId) {
    return c.json({ error: 'Forbidden: Can only access own personal worlds' }, 403);
  }

  try {
    let query = db(c.env)
      .selectFrom('worlds as w')
      .innerJoin('organization_members as om', (join) =>
        join.on('om.organization_id', '=', 'w.organization_id')
          .on('om.user_id', '=', security.userId)
      )
      .select([
        'w.id',
        'w.organization_id',
        'w.team_id',
        'w.name',
        'w.description',
        'w.owner_user_id',
        'w.state',
        'w.world_type',
        'w.priority',
        'w.created_at',
        'w.updated_at',
        'w.created_by',
        'om.role as org_role'
      ])
      .where('w.owner_user_id', '=', userId) // Personal worlds only
      .orderBy('w.updated_at', 'desc');

    // Apply filters
    if (!includeInactive) {
      query = query.where('w.state', 'in', ['active', 'developing']);
    }
    
    if (!includeArchived) {
      query = query.where('w.state', '!=', 'archived');
    }

    const personalWorlds = await query.execute();

    return c.json({
      success: true,
      data: personalWorlds
    });
  } catch (error) {
    console.error('Error fetching personal worlds:', error);
    return c.json({ error: 'Failed to fetch personal worlds' }, 500);
  }
});

/**
 * GET /api/worlds/business/org/:orgId
 * Get business worlds in organization (org-wide and team-specific based on user access)
 */
worldsApi.get('/business/org/:orgId', zValidator('query', CrossOrgQuerySchema), async (c) => {
  const orgId = c.req.param('orgId');
  const { includeInactive, includeArchived } = c.req.valid('query');
  const security = c.get('security');

  // Verify user belongs to this organization
  if (orgId !== security.organizationId) {
    return c.json({ error: 'Forbidden: Can only access worlds in own organization' }, 403);
  }

  try {
    let query = db(c.env)
      .selectFrom('worlds as w')
      .leftJoin('teams as t', 't.id', 'w.team_id')
      .leftJoin('team_memberships as tm', (join) =>
        join.on('tm.team_id', '=', (eb) => eb.ref('w.team_id'))
          .on('tm.user_id', '=', (eb) => eb.val(security.userId))
      )
      .select([
        'w.id',
        'w.organization_id',
        'w.team_id',
        'w.name',
        'w.description',
        'w.owner_user_id',
        'w.state',
        'w.world_type',
        'w.priority',
        'w.created_at',
        'w.updated_at',
        'w.created_by',
        't.name as team_name',
        't.team_type',
        'tm.role as team_role'
      ])
      .where('w.organization_id', '=', orgId)
      .where('w.owner_user_id', 'is', null) // Business worlds only
      .orderBy('w.updated_at', 'desc');

    // Apply access control: 
    // - Org-wide worlds (team_id = NULL): any org member can see active worlds
    // - Team-specific worlds: only team members can see
    // - Admins/owners can see all business worlds
    if (security.role !== 'owner' && security.role !== 'admin') {
      query = query.where((eb) => eb.or([
        eb.and([
          eb('w.team_id', 'is', null), // Org-wide worlds
          eb('w.state', '=', 'active')  // Only active org-wide worlds for members
        ]),
        eb('tm.user_id', '=', security.userId) // Team-specific worlds user belongs to
      ]));
    }

    // Apply filters
    if (!includeInactive) {
      query = query.where('w.state', 'in', ['active', 'developing']);
    }
    
    if (!includeArchived) {
      query = query.where('w.state', '!=', 'archived');
    }

    const businessWorlds = await query.execute();

    return c.json({
      success: true,
      data: businessWorlds
    });
  } catch (error) {
    console.error('Error fetching business worlds:', error);
    return c.json({ error: 'Failed to fetch business worlds' }, 500);
  }
});

/**
 * GET /api/worlds/business/team/:teamId
 * Get business worlds for specific team
 */
worldsApi.get('/business/team/:teamId', zValidator('query', CrossOrgQuerySchema), async (c) => {
  const teamId = c.req.param('teamId');
  const { includeInactive, includeArchived } = c.req.valid('query');
  const security = c.get('security');

  try {
    // Verify user has access to this team
    const teamAccess = await db(c.env)
      .selectFrom('teams as t')
      .leftJoin('team_memberships as tm', (join) =>
        join.on('tm.team_id', '=', 't.id')
          .on('tm.user_id', '=', security.userId)
      )
      .select([
        't.id',
        't.organization_id',
        't.name',
        'tm.role as team_role'
      ])
      .where('t.id', '=', teamId)
      .executeTakeFirst();

    if (!teamAccess) {
      return c.json({ error: 'Team not found' }, 404);
    }

    if (teamAccess.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Team not in your organization' }, 403);
    }

    // Check access: team member, or org admin/owner
    const hasAccess = teamAccess.team_role || 
                     security.role === 'owner' || 
                     security.role === 'admin';

    if (!hasAccess) {
      return c.json({ error: 'Forbidden: No access to this team' }, 403);
    }

    let query = db(c.env)
      .selectFrom('worlds as w')
      .innerJoin('teams as t', 't.id', 'w.team_id')
      .select([
        'w.id',
        'w.organization_id',
        'w.team_id',
        'w.name',
        'w.description',
        'w.owner_user_id',
        'w.state',
        'w.world_type',
        'w.priority',
        'w.created_at',
        'w.updated_at',
        'w.created_by',
        't.name as team_name',
        't.team_type'
      ])
      .where('w.team_id', '=', teamId)
      .where('w.owner_user_id', 'is', null) // Business worlds only
      .orderBy('w.updated_at', 'desc');

    // Apply filters
    if (!includeInactive) {
      query = query.where('w.state', 'in', ['active', 'developing']);
    }
    
    if (!includeArchived) {
      query = query.where('w.state', '!=', 'archived');
    }

    const teamWorlds = await query.execute();

    return c.json({
      success: true,
      data: teamWorlds
    });
  } catch (error) {
    console.error('Error fetching team worlds:', error);
    return c.json({ error: 'Failed to fetch team worlds' }, 500);
  }
});

/**
 * POST /api/worlds/org/:orgId
 * Create org-wide world (team_id = NULL)
 */
worldsApi.post('/org/:orgId', zValidator('json', CreateWorldSchema), async (c) => {
  const orgId = c.req.param('orgId');
  const { name, description, owner_user_id, state, world_type, priority } = c.req.valid('json');
  const security = c.get('security');

  // Verify user belongs to this organization
  if (orgId !== security.organizationId) {
    return c.json({ error: 'Forbidden: Can only create worlds in own organization' }, 403);
  }

  // Validate permissions for world creation
  if (universe_id) {
    // Personal world: verify user owns the universe
    const universeOwnership = await db(c.env)
      .selectFrom('universes')
      .select('id')
      .where('id', '=', universe_id)
      .where('user_id', '=', security.userId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!universeOwnership) {
      return c.json({ error: 'Forbidden: Can only create personal worlds in own universe' }, 403);
    }
  } else {
    // Business world: need appropriate permissions
    if (security.role !== 'owner' && security.role !== 'admin' && security.role !== 'manager') {
      return c.json({ error: 'Forbidden: Insufficient permissions to create business worlds' }, 403);
    }
  }

  try {
    const world = await db(c.env)
      .insertInto('worlds')
      .values({
        organization_id: orgId,
        team_id: null, // Org-wide world
        name: name,
        description: description || null,
        universe_id: universe_id || null,
        state: state,
        world_type: world_type,
        priority: priority,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: security.userId
      })
      .returningAll()
      .executeTakeFirst();

    return c.json({
      success: true,
      data: world
    }, 201);
  } catch (error) {
    console.error('Error creating org world:', error);
    return c.json({ error: 'Failed to create world' }, 500);
  }
});

/**
 * POST /api/worlds/team/:teamId
 * Create team-specific world
 */
worldsApi.post('/team/:teamId', zValidator('json', CreateWorldSchema), async (c) => {
  const teamId = c.req.param('teamId');
  const { name, description, owner_user_id, state, world_type, priority } = c.req.valid('json');
  const security = c.get('security');

  try {
    // Verify team access and permissions
    const teamAccess = await db(c.env)
      .selectFrom('teams as t')
      .leftJoin('team_memberships as tm', (join) =>
        join.on('tm.team_id', '=', 't.id')
          .on('tm.user_id', '=', security.userId)
      )
      .select([
        't.id',
        't.organization_id',
        't.name',
        'tm.role as team_role'
      ])
      .where('t.id', '=', teamId)
      .executeTakeFirst();

    if (!teamAccess) {
      return c.json({ error: 'Team not found' }, 404);
    }

    if (teamAccess.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Team not in your organization' }, 403);
    }

    // Personal worlds: any team member can create in their universe
    // Business worlds: team leads/admins or org admins
    if (universe_id) {
      // Personal world: verify user owns the universe and is team member
      const universeOwnership = await db(c.env)
        .selectFrom('universes')
        .select('id')
        .where('id', '=', universe_id)
        .where('user_id', '=', security.userId)
        .where('organization_id', '=', teamAccess.organization_id)
        .executeTakeFirst();

      if (!universeOwnership) {
        return c.json({ error: 'Forbidden: Can only create personal worlds in own universe' }, 403);
      }

      if (!teamAccess.team_role) {
        return c.json({ error: 'Forbidden: Must be team member to create personal world in team' }, 403);
      }
    } else {
      // Business world: need team lead/admin or org admin permissions
      const canCreateBusinessWorld = security.role === 'owner' ||
                                   security.role === 'admin' ||
                                   teamAccess.team_role === 'admin' ||
                                   teamAccess.team_role === 'lead';

      if (!canCreateBusinessWorld) {
        return c.json({ error: 'Forbidden: Need team lead/admin permissions to create business worlds' }, 403);
      }
    }

    const world = await db(c.env)
      .insertInto('worlds')
      .values({
        organization_id: teamAccess.organization_id,
        team_id: teamId,
        name: name,
        description: description || null,
        universe_id: universe_id || null,
        state: state,
        world_type: world_type,
        priority: priority,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: security.userId
      })
      .returningAll()
      .executeTakeFirst();

    return c.json({
      success: true,
      data: {
        ...world,
        team_name: teamAccess.name
      }
    }, 201);
  } catch (error) {
    console.error('Error creating team world:', error);
    return c.json({ error: 'Failed to create world' }, 500);
  }
});

/**
 * PUT /api/worlds/:worldId
 * Update world
 */
worldsApi.put('/:worldId', zValidator('json', UpdateWorldSchema), async (c) => {
  const worldId = c.req.param('worldId');
  const updateData = c.req.valid('json');
  const security = c.get('security');

  try {
    // Check world access and permissions
    const worldAccess = await db(c.env)
      .selectFrom('worlds as w')
      .leftJoin('universes as u', 'u.id', 'w.universe_id')
      .leftJoin('teams as t', 't.id', 'w.team_id')
      .leftJoin('team_memberships as tm', (join) =>
        join.on('tm.team_id', '=', 'w.team_id')
          .on('tm.user_id', '=', security.userId)
      )
      .select([
        'w.id',
        'w.organization_id',
        'w.team_id',
        'w.owner_user_id',
        'w.name',
        'u.user_id as universe_owner',
        't.name as team_name',
        'tm.role as team_role'
      ])
      .where('w.id', '=', worldId)
      .executeTakeFirst();

    if (!worldAccess) {
      return c.json({ error: 'World not found' }, 404);
    }

    if (worldAccess.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: World not in your organization' }, 403);
    }

    // Permission check
    let canModify = false;

    if (worldAccess.universe_id) {
      // Personal world: only universe owner can modify
      canModify = worldAccess.universe_owner === security.userId;
    } else {
      // Business world: team leads/admins or org admins
      canModify = security.role === 'owner' ||
                 security.role === 'admin' ||
                 (worldAccess.team_id && (worldAccess.team_role === 'admin' || worldAccess.team_role === 'lead')) ||
                 (!worldAccess.team_id && (security.role === 'manager')); // Org-wide worlds
    }

    if (!canModify) {
      return c.json({ error: 'Forbidden: Insufficient permissions to modify this world' }, 403);
    }

    // If updating team_id, validate new team access
    if (updateData.team_id !== undefined) {
      if (updateData.team_id) {
        const newTeamAccess = await db(c.env)
          .selectFrom('teams as t')
          .leftJoin('team_memberships as tm', (join) =>
            join.on('tm.team_id', '=', 't.id')
              .on('tm.user_id', '=', security.userId)
          )
          .select(['t.id', 't.organization_id', 'tm.role as team_role'])
          .where('t.id', '=', updateData.team_id)
          .executeTakeFirst();

        if (!newTeamAccess || newTeamAccess.organization_id !== security.organizationId) {
          return c.json({ error: 'New team not found or not accessible' }, 400);
        }

        // Need permissions in the new team for business worlds
        if (!worldAccess.universe_id) {
          const canMoveToTeam = security.role === 'owner' ||
                               security.role === 'admin' ||
                               newTeamAccess.team_role === 'admin' ||
                               newTeamAccess.team_role === 'lead';

          if (!canMoveToTeam) {
            return c.json({ error: 'Forbidden: Insufficient permissions for target team' }, 403);
          }
        }
      }
    }

    const updatedWorld = await db(c.env)
      .updateTable('worlds')
      .set({
        ...updateData,
        updated_at: new Date()
      })
      .where('id', '=', worldId)
      .returningAll()
      .executeTakeFirst();

    return c.json({
      success: true,
      data: updatedWorld
    });
  } catch (error) {
    console.error('Error updating world:', error);
    return c.json({ error: 'Failed to update world' }, 500);
  }
});

/**
 * DELETE /api/worlds/:worldId
 * Delete world
 */
worldsApi.delete('/:worldId', async (c) => {
  const worldId = c.req.param('worldId');
  const security = c.get('security');

  try {
    // Check world access and permissions (same logic as update)
    const worldAccess = await db(c.env)
      .selectFrom('worlds as w')
      .leftJoin('universes as u', 'u.id', 'w.universe_id')
      .leftJoin('team_memberships as tm', (join) =>
        join.on('tm.team_id', '=', 'w.team_id')
          .on('tm.user_id', '=', security.userId)
      )
      .select([
        'w.id',
        'w.organization_id',
        'w.team_id',
        'w.owner_user_id',
        'w.name',
        'u.user_id as universe_owner',
        'tm.role as team_role'
      ])
      .where('w.id', '=', worldId)
      .executeTakeFirst();

    if (!worldAccess) {
      return c.json({ error: 'World not found' }, 404);
    }

    if (worldAccess.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: World not in your organization' }, 403);
    }

    // Permission check (stricter for deletion)
    let canDelete = false;

    if (worldAccess.universe_id) {
      // Personal world: only universe owner can delete
      canDelete = worldAccess.universe_owner === security.userId;
    } else {
      // Business world: team admins or org admins only (not team leads for deletion)
      canDelete = security.role === 'owner' ||
                 security.role === 'admin' ||
                 (worldAccess.team_id && worldAccess.team_role === 'admin');
    }

    if (!canDelete) {
      return c.json({ error: 'Forbidden: Insufficient permissions to delete this world' }, 403);
    }

    await db(c.env)
      .deleteFrom('worlds')
      .where('id', '=', worldId)
      .execute();

    return c.json({
      success: true,
      message: 'World deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting world:', error);
    return c.json({ error: 'Failed to delete world' }, 500);
  }
});

/**
 * GET /api/worlds/user/:userId/cross-org
 * Get all accessible worlds for user across organizations (personal + business)
 */
worldsApi.get('/user/:userId/cross-org', zValidator('query', CrossOrgQuerySchema), async (c) => {
  const userId = c.req.param('userId');
  const { includeInactive, includeArchived } = c.req.valid('query');
  const security = c.get('security');

  // Verify user can access this user ID (self only for now)
  if (userId !== security.userId) {
    return c.json({ error: 'Forbidden: Can only access own cross-org world data' }, 403);
  }

  try {
    // Get personal worlds across all user's organizations
    let personalQuery = db(c.env)
      .selectFrom('worlds as w')
      .innerJoin('universes as u', 'u.id', 'w.universe_id')
      .innerJoin('organization_members as om', (join) =>
        join.on('om.organization_id', '=', 'w.organization_id')
          .on('om.user_id', '=', security.userId)
      )
      .select([
        'w.id',
        'w.organization_id',
        'w.team_id',
        'w.name',
        'w.description',
        'w.owner_user_id',
        'w.state',
        'w.world_type',
        'w.priority',
        'w.created_at',
        'w.updated_at',
        'w.created_by',
        'u.name as universe_name',
        'om.role as org_role',
        (eb) => eb.lit('personal').as('world_category')
      ])
      .where('u.user_id', '=', userId);

    // Get accessible business worlds across all user's organizations  
    let businessQuery = db(c.env)
      .selectFrom('worlds as w')
      .leftJoin('teams as t', 't.id', 'w.team_id')
      .leftJoin('team_memberships as tm', (join) =>
        join.on('tm.team_id', '=', 'w.team_id')
          .on('tm.user_id', '=', security.userId)
      )
      .innerJoin('organization_members as om', (join) =>
        join.on('om.organization_id', '=', 'w.organization_id')
          .on('om.user_id', '=', security.userId)
      )
      .select([
        'w.id',
        'w.organization_id', 
        'w.team_id',
        'w.name',
        'w.description',
        'w.owner_user_id',
        'w.state',
        'w.world_type',
        'w.priority',
        'w.created_at',
        'w.updated_at',
        'w.created_by',
        't.name as team_name',
        'om.role as org_role',
        (eb) => eb.lit('business').as('world_category')
      ])
      .where('w.universe_id', 'is', null)
      .where((eb) => eb.or([
        // Org-wide worlds: any member can see active ones, admins see all
        eb.and([
          eb('w.team_id', 'is', null),
          eb.or([
            eb('w.state', '=', 'active'),
            eb('om.role', 'in', ['admin', 'owner'])
          ])
        ]),
        // Team-specific worlds: team members can see
        eb('tm.user_id', '=', security.userId),
        // Org admins can see all business worlds
        eb('om.role', 'in', ['admin', 'owner'])
      ]));

    // Apply filters to both queries
    if (!includeInactive) {
      personalQuery = personalQuery.where('w.state', 'in', ['active', 'developing']);
      businessQuery = businessQuery.where('w.state', 'in', ['active', 'developing']);
    }
    
    if (!includeArchived) {
      personalQuery = personalQuery.where('w.state', '!=', 'archived');
      businessQuery = businessQuery.where('w.state', '!=', 'archived');
    }

    const [personalWorlds, businessWorlds] = await Promise.all([
      personalQuery.execute(),
      businessQuery.execute()
    ]);

    // Combine and organize results
    const crossOrgData = {
      userId: userId,
      personal: personalWorlds,
      business: businessWorlds,
      summary: {
        totalPersonal: personalWorlds.length,
        totalBusiness: businessWorlds.length,
        totalWorlds: personalWorlds.length + businessWorlds.length,
        organizationsCount: new Set([
          ...personalWorlds.map(w => w.organization_id),
          ...businessWorlds.map(w => w.organization_id)
        ]).size
      },
      lastUpdated: new Date().toISOString()
    };

    return c.json({
      success: true,
      data: crossOrgData
    });
  } catch (error) {
    console.error('Error fetching cross-org world data:', error);
    return c.json({ error: 'Failed to fetch cross-org world data' }, 500);
  }
});

export { worldsApi };