/**
 * Organization-Scoped Admin API Routes
 * 
 * Allows organization owners/admins to manage users within their organization only
 * Separate from Better Auth's global admin plugin
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';
import { dbLogger } from '../middleware/logger';
import { 
  simpleRLSMiddleware,
  requireRole,
  requireAdmin,
  requireOwner
} from '../middleware/simple-rls';
import { createDatabaseConnection, getKysely } from '../lib/database-manager';

const orgAdminRouter = new Hono<AppContext>();

// Apply organization security middleware to all routes
orgAdminRouter.use('/:orgId/*', simpleRLSMiddleware);

// ==============================================
// ORGANIZATION MEMBER ADMIN ACTIONS
// ==============================================

/**
 * GET /api/org-admin/:orgId/users
 * List users in the organization (admin+ only)
 */
orgAdminRouter.get('/:orgId/users', 
  requireRole('admin'), // Use requireRole which supports hierarchy
  async (c) => {
    try {
      const security = c.get('security');
      const orgId = security.organizationId;
      createDatabaseConnection(c.env);
      const db = getKysely();

      // Get organization members with user details
      const members = await db
        .selectFrom('organization_members')
        .innerJoin('user', 'user.id', 'organization_members.user_id')
        .select([
          'user.id',
          'user.email', 
          'user.name',
          'user.emailVerified',
          'user.image',
          'user.createdAt',
          'user.updatedAt',
          'user.role as better_auth_role', // Better Auth role (admin/user)
          'organization_members.role as org_role', // Organization role  
          'organization_members.created_at as joined_at',
          'organization_members.updated_at'
        ])
        .where('organization_members.organization_id', '=', orgId)
        .orderBy('organization_members.created_at', 'desc')
        .execute();

      dbLogger.info('Organization admin listed users', {
        organizationId: orgId,
        adminUserId: security.userId,
        memberCount: members.length
      });

      return c.json({
        users: members,
        total: members.length,
        organization_id: orgId
      });

    } catch (error) {
      dbLogger.error('Error listing organization users', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  }
);

/**
 * PUT /api/org-admin/:orgId/users/:userId/role
 * Update user's organization role (admin+ only)
 */
orgAdminRouter.put('/:orgId/users/:userId/role',
  requireRole('admin'),
  async (c) => {
    try {
      const security = c.get('security');
      const orgId = security.organizationId;
      const targetUserId = c.req.param('userId');
      const adminUserId = security.userId;
      const body = await c.req.json();
      const { role } = body;

      if (!role || !['viewer', 'member', 'manager', 'admin', 'owner'].includes(role)) {
        return c.json({ 
          error: 'Invalid role. Must be one of: viewer, member, manager, admin, owner' 
        }, 400);
      }

      createDatabaseConnection(c.env);
      const db = getKysely();

      // Additional security: Only owners can promote to admin/owner
      if (['admin', 'owner'].includes(role) && !security.isOwner()) {
        return c.json({ 
          error: 'Only organization owners can assign admin or owner roles' 
        }, 403);
      }

      // Additional security: Cannot change your own role (prevent lockout)
      if (targetUserId === adminUserId) {
        return c.json({ 
          error: 'You cannot change your own role' 
        }, 403);
      }

      // Verify target user is a member of this organization
      const existingMember = await db
        .selectFrom('organization_members')
        .select(['role', 'user_id'])
        .where('organization_id', '=', orgId)
        .where('user_id', '=', targetUserId)
        .executeTakeFirst();

      if (!existingMember) {
        return c.json({ 
          error: 'User is not a member of this organization' 
        }, 404);
      }

      // Update the role
      const updatedMember = await db
        .updateTable('organization_members')
        .set({ 
          role: role,
          updated_at: new Date()
        })
        .where('organization_id', '=', orgId)
        .where('user_id', '=', targetUserId)
        .returningAll()
        .executeTakeFirst();

      // Get updated user details
      const updatedUser = await db
        .selectFrom('organization_members')
        .innerJoin('user', 'user.id', 'organization_members.user_id')
        .select([
          'user.id',
          'user.email',
          'user.name', 
          'organization_members.role as org_role',
          'organization_members.updated_at'
        ])
        .where('organization_members.organization_id', '=', orgId)
        .where('organization_members.user_id', '=', targetUserId)
        .executeTakeFirst();

      dbLogger.info('Organization admin updated user role', {
        organizationId: orgId,
        adminUserId: adminUserId,
        targetUserId: targetUserId,
        oldRole: existingMember.role,
        newRole: role
      });

      return c.json({
        message: 'User role updated successfully',
        user: updatedUser
      });

    } catch (error) {
      dbLogger.error('Error updating user organization role', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  }
);

/**
 * DELETE /api/org-admin/:orgId/users/:userId
 * Remove user from organization (admin+ only)
 */
orgAdminRouter.delete('/:orgId/users/:userId',
  requireRole('admin'),
  async (c) => {
    try {
      const security = c.get('security');
      const orgId = security.organizationId;
      const targetUserId = c.req.param('userId');
      const adminUserId = security.userId;

      // Additional security: Cannot remove yourself (prevent lockout)
      if (targetUserId === adminUserId) {
        return c.json({ 
          error: 'You cannot remove yourself from the organization' 
        }, 403);
      }

      createDatabaseConnection(c.env);
      const db = getKysely();

      // Verify target user is a member of this organization
      const existingMember = await db
        .selectFrom('organization_members')
        .innerJoin('user', 'user.id', 'organization_members.user_id')
        .select([
          'organization_members.role',
          'user.email',
          'user.name'
        ])
        .where('organization_members.organization_id', '=', orgId)
        .where('organization_members.user_id', '=', targetUserId)
        .executeTakeFirst();

      if (!existingMember) {
        return c.json({ 
          error: 'User is not a member of this organization' 
        }, 404);
      }

      // Additional security: Only owners can remove other admins/owners
      if (['admin', 'owner'].includes(existingMember.role) && !security.isOwner()) {
        return c.json({ 
          error: 'Only organization owners can remove admin or owner members' 
        }, 403);
      }

      // Remove the user from the organization
      await db
        .deleteFrom('organization_members')
        .where('organization_id', '=', orgId)
        .where('user_id', '=', targetUserId)
        .execute();

      dbLogger.info('Organization admin removed user', {
        organizationId: orgId,
        adminUserId: adminUserId,
        removedUserId: targetUserId,
        removedUserEmail: existingMember.email,
        removedUserRole: existingMember.role
      });

      return c.json({
        message: 'User removed from organization successfully',
        removed_user: {
          id: targetUserId,
          email: existingMember.email,
          name: existingMember.name,
          role: existingMember.role
        }
      });

    } catch (error) {
      dbLogger.error('Error removing user from organization', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  }
);

// Status management not implemented (status column doesn't exist in schema)

/**
 * GET /api/org-admin/:orgId/activity
 * Get organization admin activity log (owner only)
 */
orgAdminRouter.get('/:orgId/activity',
  requireOwner,
  async (c) => {
    try {
      const security = c.get('security');
      const orgId = security.organizationId;
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      createDatabaseConnection(c.env);
      const db = getKysely();

      // Get recent organization member changes
      // Note: This would require an audit log table in a real implementation
      // For now, we'll return a placeholder structure
      const recentActivity = await db
        .selectFrom('organization_members')
        .innerJoin('user', 'user.id', 'organization_members.user_id')
        .select([
          'organization_members.updated_at',
          'organization_members.created_at',
          'organization_members.role',
          'user.email',
          'user.name'
        ])
        .where('organization_members.organization_id', '=', orgId)
        .orderBy('organization_members.updated_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();

      return c.json({
        activity: recentActivity.map(item => ({
          timestamp: item.updated_at,
          joined_at: item.created_at,
          action: 'member_updated', // In real implementation, this would come from audit log
          target_user: {
            email: item.email,
            name: item.name
          },
          current_role: item.role
        })),
        pagination: {
          limit,
          offset,
          total: recentActivity.length
        }
      });

    } catch (error) {
      dbLogger.error('Error fetching organization activity', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  }
);

export { orgAdminRouter };