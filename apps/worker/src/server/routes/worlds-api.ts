/**
 * Worlds Management API (Simplified)
 * 
 * Dedicated API for Worlds operations (core business logic)
 * Worlds represent life areas (personal) or business domains (organizational)
 * Can be org-wide (team_id = NULL) or team-specific (team_id = UUID)
 * Personal worlds: owner_user_id = user UUID, Business worlds: owner_user_id = NULL
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { sql } from 'kysely';
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
        'w.created_by'
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
        eb('tm.user_id', '=', eb.val(security.userId)) // Team-specific worlds user belongs to
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
  if (owner_user_id) {
    // Personal world: verify user is creating for themselves
    if (owner_user_id !== security.userId) {
      return c.json({ error: 'Forbidden: Can only create personal worlds for yourself' }, 403);
    }
  } else {
    // Business world: need appropriate permissions
    if (!security.isOwner() && !security.isAdmin() && !security.hasRole('manager')) {
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
        owner_user_id: owner_user_id || null,
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
      .innerJoin('organization_members as om', (join) =>
        join.on('om.organization_id', '=', (eb) => eb.ref('w.organization_id'))
          .on('om.user_id', '=', (eb) => eb.val(security.userId))
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
        'om.role as org_role',
sql.lit('personal').as('world_category')
      ])
      .where('w.owner_user_id', '=', (eb) => eb.val(userId));

    // Get accessible business worlds across all user's organizations  
    let businessQuery = db(c.env)
      .selectFrom('worlds as w')
      .leftJoin('teams as t', 't.id', 'w.team_id')
      .leftJoin('team_memberships as tm', (join) =>
        join.on('tm.team_id', '=', (eb) => eb.ref('w.team_id'))
          .on('tm.user_id', '=', (eb) => eb.val(security.userId))
      )
      .innerJoin('organization_members as om', (join) =>
        join.on('om.organization_id', '=', (eb) => eb.ref('w.organization_id'))
          .on('om.user_id', '=', (eb) => eb.val(security.userId))
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
        sql.lit('business').as('world_category')
      ])
      .where('w.owner_user_id', 'is', null)
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
        eb('tm.user_id', '=', eb.val(security.userId)),
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