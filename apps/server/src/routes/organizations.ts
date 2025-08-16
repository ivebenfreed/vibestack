import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getAuth } from '../lib/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../types/env.js';
import { apiLogger } from '../middleware/logger.js';

const MODULE_NAME = 'organizations';

const app = new Hono<{ 
  Bindings: Env;
  Variables: { 
    user: any;
    session: any;
  } 
}>();

// Apply authentication middleware to all organization routes
app.use('*', authMiddleware);

// Organization creation schema
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  logo: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

// Organization update schema
const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logo: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

// Member invitation schema
const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'member', 'viewer']).default('member'),
  message: z.string().optional()
});

// Member role update schema
const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'member', 'viewer'])
});

/**
 * CREATE ORGANIZATION
 * POST /organizations
 */
app.post('/', zValidator('json', createOrganizationSchema), async (c) => {
  const user = c.get('user');
  const session = c.get('session');
  
  if (!user || !session) {
    return c.json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    }, 401);
  }
  
  try {
    const { name, slug, logo, metadata } = c.req.valid('json');
    const auth = getAuth(c);

    apiLogger.info('Creating organization', {
      name,
      slug,
      userId: user.id
    }, MODULE_NAME);

    // Create organization using Better Auth
    const result = await auth.api.createOrganization({
      body: {
        name,
        slug,
        logo,
        metadata
      },
      headers: c.req.raw.headers
    });

    if (!result.data) {
      apiLogger.error('Organization creation failed', {
        error: result.error
      }, MODULE_NAME);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Failed to create organization',
        code: 'CREATION_FAILED'
      }, 400);
    }

    apiLogger.info('Organization created successfully', {
      organizationId: result.data.organization.id,
      organizationSlug: result.data.organization.slug,
      userId: user.id
    }, MODULE_NAME);

    return c.json({
      success: true,
      data: {
        organization: result.data.organization,
        member: result.data.member
      }
    }, 201);

  } catch (error) {
    apiLogger.error('Organization creation error', {
      error: error instanceof Error ? error.message : String(error),
      userId: user.id
    }, MODULE_NAME);
    
    return c.json({
      success: false,
      error: 'Failed to create organization',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'CREATION_FAILED'
    }, 500);
  }
});

/**
 * GET USER'S ORGANIZATIONS
 * GET /organizations
 */
app.get('/', requireUser(), async (c) => {
  const requestId = c.get('requestId');
  const userContext = c.get('userContext');
  
  try {
    const auth = getAuth(c);

    apiLogger.debug('Fetching user organizations', {
      userId: userContext.userId,
      requestId
    }, MODULE_NAME);

    // Get user's organizations using Better Auth
    const result = await auth.api.listUserOrganizations({
      headers: c.req.raw.headers
    });

    if (!result.data) {
      apiLogger.error('Failed to fetch organizations', {
        error: result.error,
        requestId
      }, MODULE_NAME);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Failed to fetch organizations',
        code: 'FETCH_FAILED',
        requestId
      }, 400);
    }

    apiLogger.debug('Organizations fetched successfully', {
      count: result.data.length,
      userId: userContext.userId,
      requestId
    }, MODULE_NAME);

    return c.json({
      success: true,
      data: {
        organizations: result.data.map(item => ({
          ...item.organization,
          userRole: item.member.role,
          memberSince: item.member.createdAt
        }))
      },
      requestId
    });

  } catch (error) {
    apiLogger.error('Error fetching organizations', {
      error: error instanceof Error ? error.message : String(error),
      userId: userContext.userId,
      requestId
    }, MODULE_NAME);
    
    return c.json({
      success: false,
      error: 'Failed to fetch organizations',
      code: 'FETCH_FAILED',
      requestId
    }, 500);
  }
});

/**
 * GET ORGANIZATION BY ID
 * GET /organizations/:id
 */
app.get('/:id', requireUserAndOrg(), async (c) => {
  const requestId = c.get('requestId');
  const userContext = c.get('userContext');
  const orgContext = c.get('orgContext')!;
  
  try {
    const organizationId = c.req.param('id');
    const auth = getAuth(c);

    // Verify the requested organization matches the context
    if (organizationId !== orgContext.organizationId) {
      return c.json({
        success: false,
        error: 'Organization ID mismatch',
        code: 'INVALID_ORG_ID',
        requestId
      }, 400);
    }

    apiLogger.debug('Fetching organization details', {
      organizationId,
      userId: userContext.userId,
      requestId
    }, MODULE_NAME);

    // Get organization details using Better Auth
    const result = await auth.api.getOrganization({
      body: { organizationId },
      headers: c.req.raw.headers
    });

    if (!result.data) {
      apiLogger.error('Failed to fetch organization', {
        error: result.error,
        organizationId,
        requestId
      }, MODULE_NAME);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Organization not found',
        code: 'NOT_FOUND',
        requestId
      }, 404);
    }

    // Get organization members if user is admin or owner
    let members = undefined;
    if (['admin', 'owner'].includes(orgContext.userOrgRole)) {
      const membersResult = await auth.api.getOrganizationMembers({
        body: { organizationId },
        headers: c.req.raw.headers
      });
      
      if (membersResult.data) {
        members = membersResult.data;
      }
    }

    apiLogger.debug('Organization details fetched', {
      organizationId,
      memberCount: members?.length,
      userRole: orgContext.userOrgRole,
      requestId
    }, MODULE_NAME);

    return c.json({
      success: true,
      data: {
        organization: {
          ...result.data,
          userRole: orgContext.userOrgRole
        },
        members: members?.map(member => ({
          id: member.id,
          userId: member.userId,
          email: member.email,
          name: member.name,
          role: member.role,
          createdAt: member.createdAt
        }))
      },
      requestId
    });

  } catch (error) {
    apiLogger.error('Error fetching organization', {
      error: error instanceof Error ? error.message : String(error),
      organizationId: c.req.param('id'),
      requestId
    }, MODULE_NAME);
    
    return c.json({
      success: false,
      error: 'Failed to fetch organization',
      code: 'FETCH_FAILED',
      requestId
    }, 500);
  }
});

/**
 * UPDATE ORGANIZATION
 * PUT /organizations/:id
 */
app.put('/:id', requireUserAndOrg(), zValidator('json', updateOrganizationSchema), async (c) => {
  const requestId = c.get('requestId');
  const userContext = c.get('userContext');
  const orgContext = c.get('orgContext')!;
  
  try {
    const organizationId = c.req.param('id');
    const updates = c.req.valid('json');

    // Verify the requested organization matches the context
    if (organizationId !== orgContext.organizationId) {
      return c.json({
        success: false,
        error: 'Organization ID mismatch',
        code: 'INVALID_ORG_ID',
        requestId
      }, 400);
    }

    // Check admin/owner access
    if (!['admin', 'owner'].includes(orgContext.userOrgRole)) {
      return c.json({
        success: false,
        error: 'Administrative access required',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId
      }, 403);
    }

    const auth = getAuth(c);

    apiLogger.info('Updating organization', {
      organizationId,
      updates,
      userId: userContext.userId,
      requestId
    }, MODULE_NAME);

    // Update organization using Better Auth
    const result = await auth.api.updateOrganization({
      body: {
        organizationId,
        ...updates
      },
      headers: c.req.raw.headers
    });

    if (!result.data) {
      apiLogger.error('Organization update failed', {
        error: result.error,
        organizationId,
        requestId
      }, MODULE_NAME);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Failed to update organization',
        code: 'UPDATE_FAILED',
        requestId
      }, 400);
    }

    apiLogger.info('Organization updated successfully', {
      organizationId,
      userId: userContext.userId,
      requestId
    }, MODULE_NAME);

    return c.json({
      success: true,
      data: {
        organization: result.data
      },
      requestId
    });

  } catch (error) {
    apiLogger.error('Organization update error', {
      error: error instanceof Error ? error.message : String(error),
      organizationId: c.req.param('id'),
      requestId
    }, MODULE_NAME);
    
    return c.json({
      success: false,
      error: 'Failed to update organization',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'UPDATE_FAILED',
      requestId
    }, 500);
  }
});

/**
 * INVITE MEMBER TO ORGANIZATION
 * POST /organizations/:id/members
 */
app.post('/:id/members', requireUserAndOrg(), zValidator('json', inviteMemberSchema), async (c) => {
  const requestId = c.get('requestId');
  const userContext = c.get('userContext');
  const orgContext = c.get('orgContext')!;
  
  try {
    const organizationId = c.req.param('id');
    const { email, role } = c.req.valid('json');

    // Verify the requested organization matches the context
    if (organizationId !== orgContext.organizationId) {
      return c.json({
        success: false,
        error: 'Organization ID mismatch',
        code: 'INVALID_ORG_ID',
        requestId
      }, 400);
    }

    // Check admin/owner access
    if (!['admin', 'owner'].includes(orgContext.userOrgRole)) {
      return c.json({
        success: false,
        error: 'Administrative access required',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId
      }, 403);
    }

    const auth = getAuth(c);

    apiLogger.info('Inviting member to organization', {
      organizationId,
      email,
      role,
      invitedBy: userContext.userId,
      requestId
    }, MODULE_NAME);

    // Invite member using Better Auth
    const result = await auth.api.inviteToOrganization({
      body: {
        organizationId,
        email,
        role
      },
      headers: c.req.raw.headers
    });

    if (!result.data) {
      apiLogger.error('Member invitation failed', {
        error: result.error,
        organizationId,
        email,
        requestId
      }, MODULE_NAME);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Failed to invite member',
        code: 'INVITATION_FAILED',
        requestId
      }, 400);
    }

    apiLogger.info('Member invited successfully', {
      organizationId,
      email,
      role,
      invitationId: result.data.id,
      requestId
    }, MODULE_NAME);

    return c.json({
      success: true,
      data: {
        invitation: result.data
      },
      requestId
    }, 201);

  } catch (error) {
    apiLogger.error('Member invitation error', {
      error: error instanceof Error ? error.message : String(error),
      organizationId: c.req.param('id'),
      requestId
    }, MODULE_NAME);
    
    return c.json({
      success: false,
      error: 'Failed to invite member',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'INVITATION_FAILED',
      requestId
    }, 500);
  }
});

/**
 * UPDATE MEMBER ROLE
 * PUT /organizations/:id/members/:userId
 */
app.put('/:id/members/:userId', requireUserAndOrg(), zValidator('json', updateMemberRoleSchema), async (c) => {
  const requestId = c.get('requestId');
  const userContext = c.get('userContext');
  const orgContext = c.get('orgContext')!;
  
  try {
    const organizationId = c.req.param('id');
    const targetUserId = c.req.param('userId');
    const { role } = c.req.valid('json');

    // Verify the requested organization matches the context
    if (organizationId !== orgContext.organizationId) {
      return c.json({
        success: false,
        error: 'Organization ID mismatch',
        code: 'INVALID_ORG_ID',
        requestId
      }, 400);
    }

    // Check admin/owner access
    if (!['admin', 'owner'].includes(orgContext.userOrgRole)) {
      return c.json({
        success: false,
        error: 'Administrative access required',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId
      }, 403);
    }

    // Cannot change own role
    if (targetUserId === userContext.userId) {
      return c.json({
        success: false,
        error: 'Cannot modify your own role',
        code: 'CANNOT_MODIFY_SELF',
        requestId
      }, 400);
    }

    const auth = getAuth(c);

    apiLogger.info('Updating member role', {
      organizationId,
      targetUserId,
      newRole: role,
      updatedBy: userContext.userId,
      requestId
    }, MODULE_NAME);

    // Update member role using Better Auth
    const result = await auth.api.updateMemberRole({
      body: {
        organizationId,
        userId: targetUserId,
        role
      },
      headers: c.req.raw.headers
    });

    if (!result.data) {
      apiLogger.error('Member role update failed', {
        error: result.error,
        organizationId,
        targetUserId,
        requestId
      }, MODULE_NAME);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Failed to update member role',
        code: 'UPDATE_FAILED',
        requestId
      }, 400);
    }

    apiLogger.info('Member role updated successfully', {
      organizationId,
      targetUserId,
      newRole: role,
      requestId
    }, MODULE_NAME);

    return c.json({
      success: true,
      data: {
        member: result.data
      },
      requestId
    });

  } catch (error) {
    apiLogger.error('Member role update error', {
      error: error instanceof Error ? error.message : String(error),
      organizationId: c.req.param('id'),
      targetUserId: c.req.param('userId'),
      requestId
    }, MODULE_NAME);
    
    return c.json({
      success: false,
      error: 'Failed to update member role',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'UPDATE_FAILED',
      requestId
    }, 500);
  }
});

/**
 * REMOVE MEMBER FROM ORGANIZATION
 * DELETE /organizations/:id/members/:userId
 */
app.delete('/:id/members/:userId', requireUserAndOrg(), async (c) => {
  const requestId = c.get('requestId');
  const userContext = c.get('userContext');
  const orgContext = c.get('orgContext')!;
  
  try {
    const organizationId = c.req.param('id');
    const targetUserId = c.req.param('userId');

    // Verify the requested organization matches the context
    if (organizationId !== orgContext.organizationId) {
      return c.json({
        success: false,
        error: 'Organization ID mismatch',
        code: 'INVALID_ORG_ID',
        requestId
      }, 400);
    }

    // Check admin/owner access
    if (!['admin', 'owner'].includes(orgContext.userOrgRole)) {
      return c.json({
        success: false,
        error: 'Administrative access required',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId
      }, 403);
    }

    // Cannot remove self
    if (targetUserId === userContext.userId) {
      return c.json({
        success: false,
        error: 'Cannot remove yourself from organization',
        code: 'CANNOT_REMOVE_SELF',
        requestId
      }, 400);
    }

    const auth = getAuth(c);

    apiLogger.info('Removing member from organization', {
      organizationId,
      targetUserId,
      removedBy: userContext.userId,
      requestId
    }, MODULE_NAME);

    // Remove member using Better Auth
    const result = await auth.api.removeMember({
      body: {
        organizationId,
        userId: targetUserId
      },
      headers: c.req.raw.headers
    });

    if (!result.data) {
      apiLogger.error('Member removal failed', {
        error: result.error,
        organizationId,
        targetUserId,
        requestId
      }, MODULE_NAME);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Failed to remove member',
        code: 'REMOVAL_FAILED',
        requestId
      }, 400);
    }

    apiLogger.info('Member removed successfully', {
      organizationId,
      targetUserId,
      requestId
    }, MODULE_NAME);

    return c.json({
      success: true,
      message: 'Member removed successfully',
      requestId
    });

  } catch (error) {
    apiLogger.error('Member removal error', {
      error: error instanceof Error ? error.message : String(error),
      organizationId: c.req.param('id'),
      targetUserId: c.req.param('userId'),
      requestId
    }, MODULE_NAME);
    
    return c.json({
      success: false,
      error: 'Failed to remove member',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'REMOVAL_FAILED',
      requestId
    }, 500);
  }
});

/**
 * DELETE ORGANIZATION
 * DELETE /organizations/:id
 */
app.delete('/:id', requireUserAndOrg(), async (c) => {
  const requestId = c.get('requestId');
  const userContext = c.get('userContext');
  const orgContext = c.get('orgContext')!;
  
  try {
    const organizationId = c.req.param('id');

    // Verify the requested organization matches the context
    if (organizationId !== orgContext.organizationId) {
      return c.json({
        success: false,
        error: 'Organization ID mismatch',
        code: 'INVALID_ORG_ID',
        requestId
      }, 400);
    }

    // Only owner can delete organization
    if (orgContext.userOrgRole !== 'owner') {
      return c.json({
        success: false,
        error: 'Only organization owner can delete organization',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId
      }, 403);
    }

    const auth = getAuth(c);

    apiLogger.info('Deleting organization', {
      organizationId,
      deletedBy: userContext.userId,
      requestId
    }, MODULE_NAME);

    // Delete organization using Better Auth
    const result = await auth.api.deleteOrganization({
      body: { organizationId },
      headers: c.req.raw.headers
    });

    if (!result.data) {
      apiLogger.error('Organization deletion failed', {
        error: result.error,
        organizationId,
        requestId
      }, MODULE_NAME);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Failed to delete organization',
        code: 'DELETION_FAILED',
        requestId
      }, 400);
    }

    apiLogger.info('Organization deleted successfully', {
      organizationId,
      requestId
    }, MODULE_NAME);

    return c.json({
      success: true,
      message: 'Organization deleted successfully',
      requestId
    });

  } catch (error) {
    apiLogger.error('Organization deletion error', {
      error: error instanceof Error ? error.message : String(error),
      organizationId: c.req.param('id'),
      requestId
    }, MODULE_NAME);
    
    return c.json({
      success: false,
      error: 'Failed to delete organization',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'DELETION_FAILED',
      requestId
    }, 500);
  }
});

export default app;