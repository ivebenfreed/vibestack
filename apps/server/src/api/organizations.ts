import { Hono } from 'hono';
import { dbLogger } from '../middleware/logger';
import { OrganizationService } from '../services/organization/OrganizationService';
import { OrganizationMemberService } from '../services/organization/OrganizationMemberService';
import { OrganizationInvitationService } from '../services/organization/OrganizationInvitationService';
import type { 
  CreateOrganizationInput, 
  UpdateOrganizationInput,
  CreateInvitationInput,
  UpdateMemberInput,
  OrganizationRole
} from '../types/organization';

const organizationsRouter = new Hono();

// Middleware to require authentication
const requireAuth = async (c: any, next: any) => {
  const user = c.var.user;
  const session = c.var.session;

  if (!user || !session) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  await next();
};

// Middleware to check organization membership and permissions
const requireOrgPermission = (requiredRole: OrganizationRole) => {
  return async (c: any, next: any) => {
    const user = c.var.user;
    const orgId = c.req.param('orgId') || c.req.query('orgId');

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const memberService = new OrganizationMemberService(db);
    const permission = await memberService.hasPermission(orgId, user.id, requiredRole);

    if (!permission.allowed) {
      return c.json({ 
        error: 'Insufficient permissions',
        required: requiredRole,
        current: permission.currentRole,
        reason: permission.reason
      }, 403);
    }

    // Set organization context
    c.set('organizationId', orgId);
    c.set('userRole', permission.currentRole);
    
    await next();
  };
};

// ==============================================
// ORGANIZATION CRUD ENDPOINTS
// ==============================================

/**
 * POST /api/organizations
 * Create a new organization
 */
organizationsRouter.post('/', requireAuth, async (c) => {
  try {
    const user = c.var.user;
    const body = await c.req.json();

    // Generate slug from name if not provided
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    };

    const data: CreateOrganizationInput = {
      name: body.name,
      slug: body.slug || generateSlug(body.name),
      description: body.description || null,
      industry: body.industry || null,
      company_size: body.company_size || null,
      website_url: body.website_url || null,
      country: body.country || null,
      timezone: body.timezone || null,
      subscription_tier: body.subscription_tier || 'trial',
      billing_email: body.billing_email || null,
      settings: body.settings || {},
      allowed_domains: body.domain ? [body.domain] : [],
      logo_url: body.logo_url || null
    };

    const orgService = new OrganizationService(c);
    const result = await orgService.createOrganization(data, user.id);

    if (!result.success) {
      return c.json({ 
        error: result.error,
        errors: result.errors 
      }, 400);
    }

    return c.json(result.data, 201);

  } catch (error) {
    dbLogger.error('Error in POST /organizations', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/organizations
 * List user's organizations
 */
organizationsRouter.get('/', requireAuth, async (c) => {
  try {
    const user = c.var.user;
    
    const orgService = new OrganizationService(c);
    const result = await orgService.getOrganizationsByUser(user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);

  } catch (error) {
    dbLogger.error('Error in GET /organizations', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/organizations/:orgId
 * Get organization details
 */
organizationsRouter.get('/:orgId', requireAuth, requireOrgPermission('viewer'), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    const orgService = new OrganizationService(c);
    const result = await orgService.getOrganizationById(orgId);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result.data);

  } catch (error) {
    dbLogger.error('Error in GET /organizations/:orgId', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/organizations/:orgId
 * Update organization
 */
organizationsRouter.put('/:orgId', requireAuth, requireOrgPermission('admin'), async (c) => {
  try {
    const user = c.var.user;
    const orgId = c.req.param('orgId');
    const body = await c.req.json();

    const data: UpdateOrganizationInput = {
      name: body.name,
      slug: body.slug,
      description: body.description,
      industry: body.industry,
      company_size: body.company_size,
      website_url: body.website_url,
      country: body.country,
      timezone: body.timezone,
      subscription_tier: body.subscription_tier,
      subscription_status: body.subscription_status,
      billing_email: body.billing_email,
      trial_ends_at: body.trial_ends_at ? new Date(body.trial_ends_at) : undefined,
      max_users: body.max_users,
      max_projects: body.max_projects,
      storage_limit_gb: body.storage_limit_gb,
      api_rate_limit: body.api_rate_limit,
      settings: body.settings,
      sso_enabled: body.sso_enabled,
      enforce_2fa: body.enforce_2fa,
      allowed_domains: body.allowed_domains,
      logo_url: body.logo_url
    };

    const orgService = new OrganizationService(c);
    const result = await orgService.updateOrganization(orgId, data, user.id);

    if (!result.success) {
      return c.json({ 
        error: result.error,
        errors: result.errors 
      }, 400);
    }

    return c.json(result.data);

  } catch (error) {
    dbLogger.error('Error in PUT /organizations/:orgId', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/organizations/:orgId
 * Delete organization (owner only)
 */
organizationsRouter.delete('/:orgId', requireAuth, requireOrgPermission('owner'), async (c) => {
  try {
    const user = c.var.user;
    const orgId = c.req.param('orgId');
    
    const orgService = new OrganizationService(c);
    const result = await orgService.deleteOrganization(orgId, user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ message: 'Organization deleted successfully' });

  } catch (error) {
    dbLogger.error('Error in DELETE /organizations/:orgId', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/organizations/:orgId/stats
 * Get organization statistics
 */
organizationsRouter.get('/:orgId/stats', requireAuth, requireOrgPermission('admin'), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    const orgService = new OrganizationService(c);
    const result = await orgService.getOrganizationStats(orgId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);

  } catch (error) {
    dbLogger.error('Error in GET /organizations/:orgId/stats', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ==============================================
// MEMBER MANAGEMENT ENDPOINTS
// ==============================================

/**
 * GET /api/organizations/:orgId/members
 * List organization members
 */
organizationsRouter.get('/:orgId/members', requireAuth, requireOrgPermission('viewer'), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;
    const role = c.req.query('role') as OrganizationRole;
    const status = c.req.query('status');
    const search = c.req.query('search');

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const memberService = new OrganizationMemberService(db);
    const result = await memberService.listMembers({
      organization_id: orgId,
      role,
      status,
      search,
      limit,
      offset
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);

  } catch (error) {
    dbLogger.error('Error in GET /organizations/:orgId/members', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/organizations/:orgId/members
 * Add member to organization
 */
organizationsRouter.post('/:orgId/members', requireAuth, requireOrgPermission('admin'), async (c) => {
  try {
    const user = c.var.user;
    const orgId = c.req.param('orgId');
    const body = await c.req.json();

    if (!body.user_id || !body.role) {
      return c.json({ error: 'user_id and role are required' }, 400);
    }

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const memberService = new OrganizationMemberService(db);
    const result = await memberService.addMember(orgId, body.user_id, body.role, user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);

  } catch (error) {
    dbLogger.error('Error in POST /organizations/:orgId/members', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/organizations/:orgId/members/:userId
 * Update member role or details
 */
organizationsRouter.put('/:orgId/members/:userId', requireAuth, requireOrgPermission('admin'), async (c) => {
  try {
    const user = c.var.user;
    const orgId = c.req.param('orgId');
    const userId = c.req.param('userId');
    const body = await c.req.json();

    const updates: UpdateMemberInput = {
      role: body.role,
      status: body.status,
      title: body.title,
      department: body.department,
      notes: body.notes
    };

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const memberService = new OrganizationMemberService(db);
    const result = await memberService.updateMember(orgId, userId, updates, user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);

  } catch (error) {
    dbLogger.error('Error in PUT /organizations/:orgId/members/:userId', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/organizations/:orgId/members/:userId
 * Remove member from organization
 */
organizationsRouter.delete('/:orgId/members/:userId', requireAuth, requireOrgPermission('admin'), async (c) => {
  try {
    const user = c.var.user;
    const orgId = c.req.param('orgId');
    const userId = c.req.param('userId');

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const memberService = new OrganizationMemberService(db);
    const result = await memberService.removeMember(orgId, userId, user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ message: 'Member removed successfully' });

  } catch (error) {
    dbLogger.error('Error in DELETE /organizations/:orgId/members/:userId', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ==============================================
// INVITATION ENDPOINTS
// ==============================================

/**
 * POST /api/organizations/:orgId/invitations
 * Create invitation
 */
organizationsRouter.post('/:orgId/invitations', requireAuth, requireOrgPermission('admin'), async (c) => {
  try {
    const user = c.var.user;
    const orgId = c.req.param('orgId');
    const body = await c.req.json();

    const data: CreateInvitationInput = {
      organization_id: orgId,
      email: body.email,
      role: body.role,
      personal_message: body.personal_message,
      expires_in_hours: body.expires_in_hours
    };

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const invitationService = new OrganizationInvitationService(db, c.env);
    const result = await invitationService.createInvitation(data, user.id);

    if (!result.success) {
      return c.json({ 
        error: result.error,
        errors: result.errors 
      }, 400);
    }

    // Don't return the token in the response for security
    const { token, ...invitation } = result.data!;
    return c.json(invitation, 201);

  } catch (error) {
    dbLogger.error('Error in POST /organizations/:orgId/invitations', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/organizations/:orgId/invitations
 * List organization invitations
 */
organizationsRouter.get('/:orgId/invitations', requireAuth, requireOrgPermission('admin'), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;
    const status = c.req.query('status');
    const role = c.req.query('role') as OrganizationRole;

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const invitationService = new OrganizationInvitationService(db, c.env);
    const result = await invitationService.listInvitations({
      organization_id: orgId,
      status,
      role,
      limit,
      offset
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Remove tokens from response for security
    const sanitizedInvitations = result.data!.map(inv => {
      const { token, ...invitation } = inv;
      return invitation;
    });

    return c.json(sanitizedInvitations);

  } catch (error) {
    dbLogger.error('Error in GET /organizations/:orgId/invitations', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/organizations/:orgId/invitations/:invitationId
 * Cancel invitation
 */
organizationsRouter.delete('/:orgId/invitations/:invitationId', requireAuth, requireOrgPermission('admin'), async (c) => {
  try {
    const user = c.var.user;
    const invitationId = c.req.param('invitationId');

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const invitationService = new OrganizationInvitationService(db, c.env);
    const result = await invitationService.cancelInvitation(invitationId, user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ message: 'Invitation cancelled successfully' });

  } catch (error) {
    dbLogger.error('Error in DELETE /organizations/:orgId/invitations/:invitationId', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/organizations/:orgId/invitations/:invitationId/resend
 * Resend invitation
 */
organizationsRouter.post('/:orgId/invitations/:invitationId/resend', requireAuth, requireOrgPermission('admin'), async (c) => {
  try {
    const user = c.var.user;
    const invitationId = c.req.param('invitationId');

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const invitationService = new OrganizationInvitationService(db, c.env);
    const result = await invitationService.resendInvitation(invitationId, user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Don't return the token
    const { token, ...invitation } = result.data!;
    return c.json(invitation);

  } catch (error) {
    dbLogger.error('Error in POST /organizations/:orgId/invitations/:invitationId/resend', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ==============================================
// PUBLIC INVITATION ACCEPTANCE ENDPOINTS
// ==============================================

/**
 * POST /api/invitations/accept
 * Accept invitation (public endpoint)
 */
organizationsRouter.post('/invitations/accept', requireAuth, async (c) => {
  try {
    const user = c.var.user;
    const body = await c.req.json();

    if (!body.token) {
      return c.json({ error: 'Invitation token is required' }, 400);
    }

    // Get Kysely instance
    const { getKysely } = require('../lib/kysely');
    const db = getKysely(c.env);
    
    const invitationService = new OrganizationInvitationService(db, c.env);
    const result = await invitationService.acceptInvitation(body.token, user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);

  } catch (error) {
    dbLogger.error('Error in POST /invitations/accept', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default organizationsRouter;