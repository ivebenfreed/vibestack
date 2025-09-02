/**
 * Worlds Management API (Org-Scoped)
 * 
 * Unified API for Worlds operations using standard organization context.
 * All worlds are organization-scoped - personal worlds live in user's personal org,
 * business worlds live in business orgs. No more dual ownership patterns.
 * Can be org-wide (team_id = NULL) or team-specific (team_id = UUID)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { sql } from 'kysely';
import { hybridRLSOrgActorMiddleware } from '../middleware/hybrid-rls-org-actor';
import { withKysely } from '../lib/database-manager';

const worldsApi = new Hono();

// Validation schemas
const CreateWorldSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  team_id: z.string().uuid().optional(), // NULL = org-wide, UUID = team-specific
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

const WorldQuerySchema = z.object({
  includeInactive: z.boolean().default(false),
  includeArchived: z.boolean().default(false),
  teamId: z.string().uuid().optional() // Filter by specific team
});

// Apply organization security middleware to all routes
worldsApi.use('*', hybridRLSOrgActorMiddleware);

/**
 * GET /api/worlds
 * Get all worlds in current organization context with standard RLS
 */
worldsApi.get('/', zValidator('query', WorldQuerySchema), async (c) => {
  const { includeInactive, includeArchived, teamId } = c.req.valid('query');
  const security = c.get('security');

  try {
    return await withKysely(async (db) => {
      let query = db
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
        .where('w.organization_id', '=', security.organizationId)
        .orderBy('w.updated_at', 'desc');

      // Apply team filter if specified
      if (teamId) {
        query = query.where('w.team_id', '=', teamId);
      }

      // Apply access control based on organization role and team membership
      if (security.role !== 'owner' && security.role !== 'admin') {
        query = query.where((eb) => eb.or([
          // Org-wide worlds: members can see active ones
          eb.and([
            eb('w.team_id', 'is', null),
            eb('w.state', '=', 'active')
          ]),
          // Team-specific worlds: only team members can see
          eb('tm.user_id', '=', eb.val(security.userId))
        ]));
      }

      // Apply state filters
      if (!includeInactive) {
        query = query.where('w.state', 'in', ['active', 'developing']);
      }
      
      if (!includeArchived) {
        query = query.where('w.state', '!=', 'archived');
      }

      const worlds = await query.execute();

      return c.json({
        success: true,
        data: worlds
      });
    });
  } catch (error) {
    console.error('Error fetching worlds:', error);
    return c.json({ error: 'Failed to fetch worlds' }, 500);
  }
});

/**
 * GET /api/worlds/:id  
 * Get a specific world by ID with org-scoped access control
 */
worldsApi.get('/:id', async (c) => {
  const worldId = c.req.param('id');
  const security = c.get('security');

  try {
    return await withKysely(async (db) => {
      const world = await db
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
        .where('w.id', '=', worldId)
        .where('w.organization_id', '=', security.organizationId)
        .executeTakeFirst();

      if (!world) {
        return c.json({ error: 'World not found or access denied' }, 404);
      }

      // Apply access control
      if (security.role !== 'owner' && security.role !== 'admin') {
        // Check if user has access to this world
        const hasAccess = (
          // Org-wide active worlds
          (world.team_id === null && world.state === 'active') ||
          // Team worlds where user is a member
          (world.team_id !== null && world.team_role !== null)
        );

        if (!hasAccess) {
          return c.json({ error: 'Access denied to this world' }, 403);
        }
      }

      return c.json({
        success: true,
        data: world
      });
    });
  } catch (error) {
    console.error('Error fetching world:', error);
    return c.json({ error: 'Failed to fetch world' }, 500);
  }
});

/**
 * POST /api/worlds
 * Create new world in current organization context
 */
worldsApi.post('/', zValidator('json', CreateWorldSchema), async (c) => {
  const { name, description, team_id, state, world_type, priority } = c.req.valid('json');
  const security = c.get('security');

  try {
    return await withKysely(async (db) => {
      // Validate permissions for world creation
      if (team_id) {
        // Team-specific world: verify user is member of the team
        const teamMember = await db
          .selectFrom('team_memberships')
          .select(['role'])
          .where('team_id', '=', team_id)
          .where('user_id', '=', security.userId)
          .executeTakeFirst();

        if (!teamMember && security.role !== 'owner' && security.role !== 'admin') {
          return c.json({ error: 'Forbidden: Must be team member to create team-specific worlds' }, 403);
        }
      } else {
        // Org-wide world: need manager+ permissions
        if (!security.isOwner() && !security.isAdmin() && !security.hasRole('manager')) {
          return c.json({ error: 'Forbidden: Insufficient permissions to create org-wide worlds' }, 403);
        }
      }

      const world = await db
        .insertInto('worlds')
        .values({
          organization_id: security.organizationId,
          team_id: team_id || null,
          name: name,
          description: description || null,
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
    });
  } catch (error) {
    console.error('Error creating world:', error);
    return c.json({ error: 'Failed to create world' }, 500);
  }
});

/**
 * PUT /api/worlds/:id
 * Update an existing world
 */
worldsApi.put('/:id', zValidator('json', UpdateWorldSchema), async (c) => {
  const worldId = c.req.param('id');
  const updateData = c.req.valid('json');
  const security = c.get('security');

  try {
    return await withKysely(async (db) => {
      // Check if world exists and user has access
      const existingWorld = await db
        .selectFrom('worlds as w')
        .leftJoin('team_memberships as tm', (join) =>
          join.on('tm.team_id', '=', (eb) => eb.ref('w.team_id'))
            .on('tm.user_id', '=', (eb) => eb.val(security.userId))
        )
        .select([
          'w.id',
          'w.organization_id',
          'w.team_id',
          'w.state',
          'tm.role as team_role'
        ])
        .where('w.id', '=', worldId)
        .where('w.organization_id', '=', security.organizationId)
        .executeTakeFirst();

      if (!existingWorld) {
        return c.json({ error: 'World not found or access denied' }, 404);
      }

      // Check edit permissions
      const canEdit = (
        security.role === 'owner' || 
        security.role === 'admin' || 
        (security.role === 'manager') ||
        (existingWorld.team_id && existingWorld.team_role) // Team member can edit team worlds
      );

      if (!canEdit) {
        return c.json({ error: 'Insufficient permissions to edit this world' }, 403);
      }

      // Update the world
      const updatedWorld = await db
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
    });
  } catch (error) {
    console.error('Error updating world:', error);
    return c.json({ error: 'Failed to update world' }, 500);
  }
});

/**
 * DELETE /api/worlds/:id
 * Delete a world (soft delete by setting state to archived)
 */
worldsApi.delete('/:id', async (c) => {
  const worldId = c.req.param('id');
  const security = c.get('security');

  try {
    return await withKysely(async (db) => {
      // Check if world exists and user has delete permissions
      const existingWorld = await db
        .selectFrom('worlds as w')
        .select([
          'w.id',
          'w.organization_id',
          'w.team_id',
          'w.name'
        ])
        .where('w.id', '=', worldId)
        .where('w.organization_id', '=', security.organizationId)
        .executeTakeFirst();

      if (!existingWorld) {
        return c.json({ error: 'World not found or access denied' }, 404);
      }

      // Only owners and admins can delete worlds
      if (security.role !== 'owner' && security.role !== 'admin') {
        return c.json({ error: 'Insufficient permissions to delete worlds' }, 403);
      }

      // Soft delete by archiving
      await db
        .updateTable('worlds')
        .set({
          state: 'archived',
          updated_at: new Date()
        })
        .where('id', '=', worldId)
        .execute();

      return c.json({
        success: true,
        message: `World "${existingWorld.name}" has been archived`
      });
    });
  } catch (error) {
    console.error('Error deleting world:', error);
    return c.json({ error: 'Failed to delete world' }, 500);
  }
});

export { worldsApi };