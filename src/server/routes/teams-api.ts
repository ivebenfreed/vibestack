/**
 * Teams Management API
 * 
 * Dedicated API for Teams operations (core business logic)
 * Teams represent organizational units within a single organization that can have different members
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { hybridRLSOrgActorMiddleware } from '../middleware/hybrid-rls-org-actor';
import { db } from '../lib/kysely';

const teamsApi = new Hono();

// Validation schemas
const CreateTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  parent_team_id: z.string().uuid().openapi({
    example: '01920000-1000-7000-8000-000000000001'
  }).optional(),
  team_type: z.enum(['department', 'project', 'functional', 'cross_functional']).default('department')
});

const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  parent_team_id: z.string().uuid().openapi({
    example: '01920000-1000-7000-8000-000000000001'
  }).nullable().optional(),
  team_type: z.enum(['department', 'project', 'functional', 'cross_functional']).optional()
});

const AddMemberSchema = z.object({
  user_id: z.string().uuid().openapi({
    example: '01920000-2000-7000-8000-000000000001'
  }),
  role: z.enum(['member', 'lead', 'admin']).default('member')
});

const UpdateMemberRoleSchema = z.object({
  role: z.enum(['member', 'lead', 'admin'])
});

// Apply organization security middleware to all routes
teamsApi.use('*', hybridRLSOrgActorMiddleware);

/**
 * GET /api/teams/org/:orgId
 * Get all teams in organization (that user can access)
 */
teamsApi.get('/org/:orgId', async (c) => {
  const orgId = c.req.param('orgId');
  const security = c.get('security');

  // Verify user belongs to this organization
  if (orgId !== security.organizationId) {
    return c.json({ error: 'Forbidden: Can only access teams in own organization' }, 403);
  }

  try {
    // Get basic teams first
    const teams = await db(c.env)
      .selectFrom('teams')
      .select([
        'id',
        'organization_id',
        'name',
        'description',
        'parent_team_id',
        'team_type',
        'created_at',
        'updated_at',
        'created_by'
      ])
      .where('organization_id', '=', orgId)
      .orderBy('name', 'asc')
      .execute();

    // Get user memberships for these teams
    const userMemberships = await db(c.env)
      .selectFrom('team_memberships')
      .select(['team_id', 'role'])
      .where('user_id', '=', security.userId)
      .execute();

    const membershipMap = new Map(userMemberships.map(m => [m.team_id, m.role]));

    // Filter teams based on user permissions
    let filteredTeams = teams;
    if (security.role !== 'owner' && security.role !== 'admin') {
      filteredTeams = teams.filter(team => 
        membershipMap.has(team.id) || team.team_type === 'department'
      );
    }

    // Get team member counts for admin users
    let teamMemberCounts: Record<string, number> = {};
    if (security.role === 'owner' || security.role === 'admin') {
      const memberCounts = await db(c.env)
        .selectFrom('team_memberships')
        .select([
          'team_id',
          (eb) => eb.fn.count('user_id').as('member_count')
        ])
        .where('team_id', 'in', teams.map(t => t.id))
        .groupBy('team_id')
        .execute();

      teamMemberCounts = Object.fromEntries(
        memberCounts.map(count => [count.team_id, Number(count.member_count)])
      );
    }

    const teamsWithCounts = filteredTeams.map(team => ({
      ...team,
      user_role: membershipMap.get(team.id) || null,
      member_count: teamMemberCounts[team.id] || (membershipMap.has(team.id) ? 1 : 0),
      is_member: membershipMap.has(team.id)
    }));

    return c.json({
      success: true,
      data: teamsWithCounts
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return c.json({ error: 'Failed to fetch teams' }, 500);
  }
});

/**
 * POST /api/teams/org/:orgId
 * Create new team in organization (admin/owner only)
 */
teamsApi.post('/org/:orgId', zValidator('json', CreateTeamSchema), async (c) => {
  const orgId = c.req.param('orgId');
  const { name, description, parent_team_id, team_type } = c.req.valid('json');
  const security = c.get('security');

  // Verify user belongs to this organization and has admin rights
  if (orgId !== security.organizationId) {
    return c.json({ error: 'Forbidden: Can only create teams in own organization' }, 403);
  }

  if (!security.isOwner() && !security.isAdmin()) {
    return c.json({ error: 'Forbidden: Only admins can create teams' }, 403);
  }

  try {
    // Validate parent team exists if specified
    if (parent_team_id) {
      const parentTeam = await db(c.env)
        .selectFrom('teams')
        .select('id')
        .where('id', '=', parent_team_id)
        .where('organization_id', '=', orgId)
        .executeTakeFirst();

      if (!parentTeam) {
        return c.json({ error: 'Parent team not found' }, 400);
      }
    }

    const team = await db(c.env)
      .insertInto('teams')
      .values({
        organization_id: orgId,
        name: name,
        description: description || null,
        parent_team_id: parent_team_id || null,
        team_type: team_type,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: security.userId
      })
      .returningAll()
      .executeTakeFirst();

    // Automatically add creator as admin of the new team
    await db(c.env)
      .insertInto('team_memberships')
      .values({
        team_id: team!.id,
        user_id: security.userId,
        role: 'admin',
        created_at: new Date(),
        created_by: security.userId
      })
      .execute();

    return c.json({
      success: true,
      data: {
        ...team,
        user_role: 'admin',
        member_count: 1
      }
    }, 201);
  } catch (error) {
    console.error('Error creating team:', error);
    return c.json({ error: 'Failed to create team' }, 500);
  }
});

/**
 * PUT /api/teams/:teamId
 * Update team (admin/owner or team admin only)
 */
teamsApi.put('/:teamId', zValidator('json', UpdateTeamSchema), async (c) => {
  const teamId = c.req.param('teamId');
  const updateData = c.req.valid('json');
  const security = c.get('security');

  try {
    // Check team access
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
        'tm.role as user_role'
      ])
      .where('t.id', '=', teamId)
      .executeTakeFirst();

    if (!teamAccess) {
      return c.json({ error: 'Team not found' }, 404);
    }

    if (teamAccess.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Team not in your organization' }, 403);
    }

    // Check permissions: org admin/owner or team admin
    const canModify = security.role === 'owner' || 
                     security.role === 'admin' || 
                     teamAccess.user_role === 'admin';

    if (!canModify) {
      return c.json({ error: 'Forbidden: Only team admins can modify teams' }, 403);
    }

    // Validate parent team if being updated
    if (updateData.parent_team_id !== undefined && updateData.parent_team_id) {
      const parentTeam = await db(c.env)
        .selectFrom('teams')
        .select('id')
        .where('id', '=', updateData.parent_team_id)
        .where('organization_id', '=', teamAccess.organization_id)
        .executeTakeFirst();

      if (!parentTeam) {
        return c.json({ error: 'Parent team not found' }, 400);
      }

      // Prevent circular references
      if (updateData.parent_team_id === teamId) {
        return c.json({ error: 'Team cannot be its own parent' }, 400);
      }
    }

    const updatedTeam = await db(c.env)
      .updateTable('teams')
      .set({
        ...updateData,
        updated_at: new Date()
      })
      .where('id', '=', teamId)
      .returningAll()
      .executeTakeFirst();

    return c.json({
      success: true,
      data: updatedTeam
    });
  } catch (error) {
    console.error('Error updating team:', error);
    return c.json({ error: 'Failed to update team' }, 500);
  }
});

/**
 * DELETE /api/teams/:teamId
 * Delete team (admin/owner only)
 */
teamsApi.delete('/:teamId', async (c) => {
  const teamId = c.req.param('teamId');
  const security = c.get('security');

  try {
    // Check team access and organization
    const team = await db(c.env)
      .selectFrom('teams')
      .select(['id', 'organization_id', 'name'])
      .where('id', '=', teamId)
      .executeTakeFirst();

    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }

    if (team.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Team not in your organization' }, 403);
    }

    if (security.role !== 'owner' && security.role !== 'admin') {
      return c.json({ error: 'Forbidden: Only admins can delete teams' }, 403);
    }

    // Check for child teams
    const childTeams = await db(c.env)
      .selectFrom('teams')
      .select('id')
      .where('parent_team_id', '=', teamId)
      .execute();

    if (childTeams.length > 0) {
      return c.json({ 
        error: 'Cannot delete team with child teams. Delete or reassign child teams first.' 
      }, 400);
    }

    // Delete team (this will cascade delete team_memberships and set worlds.team_id to NULL)
    await db(c.env)
      .deleteFrom('teams')
      .where('id', '=', teamId)
      .execute();

    return c.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    return c.json({ error: 'Failed to delete team' }, 500);
  }
});

/**
 * POST /api/teams/:teamId/members
 * Add member to team (team admin/lead or org admin only)
 */
teamsApi.post('/:teamId/members', zValidator('json', AddMemberSchema), async (c) => {
  const teamId = c.req.param('teamId');
  const { user_id, role } = c.req.valid('json');
  const security = c.get('security');

  try {
    // Check team access and permissions
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
        'tm.role as user_role'
      ])
      .where('t.id', '=', teamId)
      .executeTakeFirst();

    if (!teamAccess) {
      return c.json({ error: 'Team not found' }, 404);
    }

    if (teamAccess.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Team not in your organization' }, 403);
    }

    // Check permissions: org admin/owner, team admin, or team lead (for member role only)
    const canAddMember = security.role === 'owner' || 
                        security.role === 'admin' ||
                        teamAccess.user_role === 'admin' ||
                        (teamAccess.user_role === 'lead' && role === 'member');

    if (!canAddMember) {
      return c.json({ error: 'Forbidden: Insufficient permissions to add members' }, 403);
    }

    // Verify target user belongs to the organization
    const targetUserInOrg = await db(c.env)
      .selectFrom('organization_members')
      .select('user_id')
      .where('user_id', '=', user_id)
      .where('organization_id', '=', teamAccess.organization_id)
      .executeTakeFirst();

    if (!targetUserInOrg) {
      return c.json({ error: 'User not found in organization' }, 400);
    }

    // Add member to team
    const membership = await db(c.env)
      .insertInto('team_memberships')
      .values({
        team_id: teamId,
        user_id: user_id,
        role: role,
        created_at: new Date(),
        created_by: security.userId
      })
      .returningAll()
      .executeTakeFirst();

    return c.json({
      success: true,
      data: membership,
      message: 'Member added to team successfully'
    }, 201);
  } catch (error) {
    if (error.message?.includes('unique constraint')) {
      return c.json({ error: 'User is already a member of this team' }, 409);
    }
    console.error('Error adding team member:', error);
    return c.json({ error: 'Failed to add team member' }, 500);
  }
});

/**
 * PUT /api/teams/:teamId/members/:userId
 * Update member role in team (team admin or org admin only)
 */
teamsApi.put('/:teamId/members/:userId', zValidator('json', UpdateMemberRoleSchema), async (c) => {
  const teamId = c.req.param('teamId');
  const userId = c.req.param('userId');
  const { role } = c.req.valid('json');
  const security = c.get('security');

  try {
    // Check team access and current membership
    const teamAndMembership = await db(c.env)
      .selectFrom('teams as t')
      .leftJoin('team_memberships as tm_auth', (join) =>
        join.on('tm_auth.team_id', '=', 't.id')
          .on('tm_auth.user_id', '=', security.userId)
      )
      .leftJoin('team_memberships as tm_target', (join) =>
        join.on('tm_target.team_id', '=', 't.id')
          .on('tm_target.user_id', '=', userId)
      )
      .select([
        't.id',
        't.organization_id',
        't.name',
        'tm_auth.role as auth_user_role',
        'tm_target.role as target_user_role',
        'tm_target.id as membership_id'
      ])
      .where('t.id', '=', teamId)
      .executeTakeFirst();

    if (!teamAndMembership || !teamAndMembership.membership_id) {
      return c.json({ error: 'Team or membership not found' }, 404);
    }

    if (teamAndMembership.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Team not in your organization' }, 403);
    }

    // Check permissions: org admin/owner or team admin
    const canUpdateRole = security.role === 'owner' || 
                         security.role === 'admin' ||
                         teamAndMembership.auth_user_role === 'admin';

    if (!canUpdateRole) {
      return c.json({ error: 'Forbidden: Only team admins can update member roles' }, 403);
    }

    // Update member role
    const updatedMembership = await db(c.env)
      .updateTable('team_memberships')
      .set({ role: role })
      .where('id', '=', teamAndMembership.membership_id)
      .returningAll()
      .executeTakeFirst();

    return c.json({
      success: true,
      data: updatedMembership,
      message: 'Member role updated successfully'
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    return c.json({ error: 'Failed to update member role' }, 500);
  }
});

/**
 * DELETE /api/teams/:teamId/members/:userId  
 * Remove member from team
 */
teamsApi.delete('/:teamId/members/:userId', async (c) => {
  const teamId = c.req.param('teamId');
  const userId = c.req.param('userId');
  const security = c.get('security');

  try {
    // Check team access and membership
    const teamAndMembership = await db(c.env)
      .selectFrom('teams as t')
      .leftJoin('team_memberships as tm_auth', (join) =>
        join.on('tm_auth.team_id', '=', 't.id')
          .on('tm_auth.user_id', '=', security.userId)
      )
      .leftJoin('team_memberships as tm_target', (join) =>
        join.on('tm_target.team_id', '=', 't.id')
          .on('tm_target.user_id', '=', userId)
      )
      .select([
        't.id',
        't.organization_id',
        't.name',
        'tm_auth.role as auth_user_role',
        'tm_target.id as membership_id'
      ])
      .where('t.id', '=', teamId)
      .executeTakeFirst();

    if (!teamAndMembership || !teamAndMembership.membership_id) {
      return c.json({ error: 'Team or membership not found' }, 404);
    }

    if (teamAndMembership.organization_id !== security.organizationId) {
      return c.json({ error: 'Forbidden: Team not in your organization' }, 403);
    }

    // Check permissions: self-removal, team admin, or org admin
    const canRemove = userId === security.userId || // Self removal
                     security.role === 'owner' ||
                     security.role === 'admin' ||
                     teamAndMembership.auth_user_role === 'admin';

    if (!canRemove) {
      return c.json({ error: 'Forbidden: Cannot remove this member' }, 403);
    }

    // Remove member from team
    await db(c.env)
      .deleteFrom('team_memberships')
      .where('id', '=', teamAndMembership.membership_id)
      .execute();

    return c.json({
      success: true,
      message: 'Member removed from team successfully'
    });
  } catch (error) {
    console.error('Error removing team member:', error);
    return c.json({ error: 'Failed to remove team member' }, 500);
  }
});

/**
 * GET /api/teams/user/:userId/memberships
 * Get user's team memberships across all organizations
 */
teamsApi.get('/user/:userId/memberships', async (c) => {
  const userId = c.req.param('userId');
  const security = c.get('security');

  // Verify user can access this user ID (self only for now)
  if (userId !== security.userId) {
    return c.json({ error: 'Forbidden: Can only access own team memberships' }, 403);
  }

  try {
    const memberships = await db(c.env)
      .selectFrom('team_memberships as tm')
      .innerJoin('teams as t', 't.id', 'tm.team_id')
      .innerJoin('organization_members as om', (join) =>
        join.on('om.organization_id', '=', 't.organization_id')
          .on('om.user_id', '=', security.userId)
      )
      .select([
        'tm.id as membership_id',
        'tm.role as team_role',
        'tm.created_at as joined_at',
        't.id as team_id',
        't.name as team_name',
        't.description as team_description',
        't.team_type',
        't.organization_id',
        'om.role as org_role'
      ])
      .where('tm.user_id', '=', userId)
      .orderBy('t.name', 'asc')
      .execute();

    return c.json({
      success: true,
      data: memberships
    });
  } catch (error) {
    console.error('Error fetching user team memberships:', error);
    return c.json({ error: 'Failed to fetch team memberships' }, 500);
  }
});

export { teamsApi };