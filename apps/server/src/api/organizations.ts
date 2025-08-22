import { Hono } from 'hono';
import { dbLogger } from '../middleware/logger';
import { OrganizationService } from '../services/organization/OrganizationService';
import { OrganizationMemberService } from '../services/organization/OrganizationMemberService';
import { OrganizationInvitationService } from '../services/organization/OrganizationInvitationService';
import type { AppContext } from '../types/hono';
import { 
  hybridRLSOrgActorMiddleware,
  requirePermission,
  requireRole,
  requireAdmin,
  requireOwner
} from '../middleware/hybrid-rls-org-actor';
import type { 
  CreateOrganizationInput, 
  UpdateOrganizationInput,
  CreateInvitationInput,
  UpdateMemberInput,
  OrganizationRole
} from '../types/organization';

const organizationsRouter = new Hono<AppContext>();

// Apply hybrid security middleware to organization-scoped routes
organizationsRouter.use('/:orgId/*', hybridRLSOrgActorMiddleware);

// MIGRATED TO HYBRID SECURITY: Legacy custom middleware removed
// Now using:
// - hybridRLSOrgActorMiddleware for zero-latency permission checks
// - requireRole(), requireAdmin(), requireOwner() for declarative access control
// - PostgreSQL RLS for organization-level data isolation
// - Organization Actor SQLite cache for instant role validation

// ==============================================
// ORGANIZATION CRUD ENDPOINTS
// ==============================================

/**
 * POST /api/organizations
 * Create a new organization
 */
// Organization creation - requires authentication but no org context
organizationsRouter.post('/', async (c) => {
  try {
    // User already authenticated by global auth middleware
    const user = c.get('user');
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
// List user's organizations - requires authentication but no org context  
organizationsRouter.get('/', async (c) => {
  try {
    // User already authenticated by global auth middleware
    const user = c.get('user');
    
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
organizationsRouter.get('/:orgId', 
  requireRole('viewer'), 
  async (c) => {
  try {
    const security = c.get('security');
    const orgId = security.organizationId;
    
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
organizationsRouter.put('/:orgId', 
  requireRole('admin'),
  async (c) => {
  try {
    // Get hybrid security context (zero-latency)
    const security = c.get('security');
    const user = c.get('user');
    const orgId = security.organizationId;
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
organizationsRouter.delete('/:orgId', 
  requireOwner,
  async (c) => {
  try {
    // Get hybrid security context (zero-latency)
    const security = c.get('security');
    const user = c.get('user');
    const orgId = security.organizationId;
    
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
organizationsRouter.get('/:orgId/stats', 
  requireAdmin,
  async (c) => {
  try {
    // Get organization ID from security context
    const security = c.get('security');
    const orgId = security.organizationId;
    
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
organizationsRouter.get('/:orgId/members', 
  requireRole('viewer'),
  async (c) => {
  try {
    // Get organization ID from security context
    const security = c.get('security');
    const orgId = security.organizationId;
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
organizationsRouter.post('/:orgId/members', 
  requireAdmin,
  async (c) => {
  try {
    // Get hybrid security context (zero-latency)
    const security = c.get('security');
    const user = c.get('user');
    const orgId = security.organizationId;
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
organizationsRouter.put('/:orgId/members/:userId', 
  requireAdmin,
  async (c) => {
  try {
    // Get hybrid security context (zero-latency)
    const security = c.get('security');
    const user = c.get('user');
    const orgId = security.organizationId;
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
organizationsRouter.delete('/:orgId/members/:userId', 
  requireAdmin,
  async (c) => {
  try {
    // Get hybrid security context (zero-latency)
    const security = c.get('security');
    const user = c.get('user');
    const orgId = security.organizationId;
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
organizationsRouter.post('/:orgId/invitations', 
  requireAdmin,
  async (c) => {
  try {
    // Get hybrid security context (zero-latency)
    const security = c.get('security');
    const user = c.get('user');
    const orgId = security.organizationId;
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
organizationsRouter.get('/:orgId/invitations', 
  requireAdmin,
  async (c) => {
  try {
    // Get organization ID from security context
    const security = c.get('security');
    const orgId = security.organizationId;
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
organizationsRouter.delete('/:orgId/invitations/:invitationId', 
  requireAdmin,
  async (c) => {
  try {
    // User already authenticated by global auth middleware
    const user = c.get('user');
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
organizationsRouter.post('/:orgId/invitations/:invitationId/resend', 
  requireAdmin,
  async (c) => {
  try {
    // User already authenticated by global auth middleware
    const user = c.get('user');
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
// Accept invitation - requires authentication but no org context
organizationsRouter.post('/invitations/accept', async (c) => {
  try {
    // User already authenticated by global auth middleware
    const user = c.get('user');
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