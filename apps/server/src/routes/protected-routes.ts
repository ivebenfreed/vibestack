/**
 * Protected Route Groups with Mandatory Context Validation
 * 
 * All routes here MUST have user/org context or they fail.
 * This prevents accidental unprotected endpoints.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { 
  requireUser, 
  requireUserAndOrg, 
  requirePermission,
  getUserContext,
  getOrgContext,
  getBothContexts
} from '../middleware/context-validation';
import { apiLogger } from '../middleware/logger';

// Create route groups with different protection levels
export const userRoutes = new Hono<{ Bindings: Env }>();
export const orgRoutes = new Hono<{ Bindings: Env }>();
export const adminRoutes = new Hono<{ Bindings: Env }>();

// =============================================================================
// USER-ONLY ROUTES (require user context only)
// =============================================================================

// Apply user context validation to ALL user routes
userRoutes.use('*', requireUser());

userRoutes.get('/profile', async (c) => {
  const user = getUserContext(c);
  return c.json({
    message: 'User profile accessed successfully',
    userId: user.userId,
    email: user.userEmail,
    role: user.userRole
  });
});

userRoutes.get('/organizations', async (c) => {
  const user = getUserContext(c);
  
  // Get user's organizations using OrgAccessService
  // This is user-specific, not org-specific, so no org context needed
  return c.json({
    message: 'User organizations retrieved',
    userId: user.userId,
    organizations: [] // Implementation would fetch user's orgs
  });
});

// =============================================================================
// ORGANIZATION ROUTES (require user + org context)
// =============================================================================

// Apply user + org context validation to ALL org routes
orgRoutes.use('*', requireUserAndOrg());

orgRoutes.get('/dashboard', async (c) => {
  const { user, org } = getBothContexts(c);
  
  return c.json({
    message: 'Organization dashboard accessed',
    user: {
      id: user.userId,
      role: org.userOrgRole
    },
    organization: {
      id: org.organizationId,
      slug: org.organizationSlug,
      name: org.organizationName
    }
  });
});

orgRoutes.get('/projects', async (c) => {
  const { user, org } = getBothContexts(c);
  
  // All projects queries automatically scoped to user's org
  return c.json({
    message: 'Projects retrieved for organization',
    organizationId: org.organizationId,
    userRole: org.userOrgRole,
    projects: [] // Implementation would fetch org projects
  });
});

orgRoutes.post('/projects', requirePermission('entities:write'), async (c) => {
  const { user, org } = getBothContexts(c);
  
  // User has been validated to have entities:write permission
  return c.json({
    message: 'Project created',
    createdBy: user.userId,
    organizationId: org.organizationId
  });
});

orgRoutes.get('/members', requirePermission('members:read'), async (c) => {
  const { user, org } = getBothContexts(c);
  
  return c.json({
    message: 'Organization members retrieved',
    organizationId: org.organizationId,
    requestedBy: user.userId
  });
});

// =============================================================================
// ADMIN ROUTES (require admin permissions)
// =============================================================================

// Apply user + org context + admin permission to ALL admin routes
adminRoutes.use('*', requireUserAndOrg());
adminRoutes.use('*', requirePermission('org:admin'));

adminRoutes.get('/settings', async (c) => {
  const { user, org } = getBothContexts(c);
  
  return c.json({
    message: 'Admin settings accessed',
    organizationId: org.organizationId,
    adminUserId: user.userId
  });
});

adminRoutes.post('/invite-user', requirePermission('members:admin'), async (c) => {
  const { user, org } = getBothContexts(c);
  
  return c.json({
    message: 'User invitation sent',
    invitedBy: user.userId,
    organizationId: org.organizationId
  });
});

// =============================================================================
// SYNC ROUTES (special handling for WebSocket upgrades)
// =============================================================================

export const syncRoutes = new Hono<{ Bindings: Env }>();

// Sync routes need special handling because WebSocket upgrades
// happen before middleware can run in some cases
syncRoutes.get('/connect/:organizationSlug', async (c) => {
  // For sync connections, we validate context in the Durable Object
  // But we still do basic validation here
  const organizationSlug = c.req.param('organizationSlug');
  
  if (!organizationSlug) {
    return c.json({ 
      error: 'Organization slug required in path',
      code: 'NO_ORG_SLUG' 
    }, 400);
  }

  // Get Durable Object for sync handling
  const doId = c.env.SYNC_DO.idFromName(`sync-${organizationSlug}`);
  const doStub = c.env.SYNC_DO.get(doId);

  // Forward request to Durable Object which handles context validation
  return doStub.fetch(c.req.raw);
});

// =============================================================================
// ROUTE MOUNTING HELPER
// =============================================================================

export function mountProtectedRoutes(app: Hono<{ Bindings: Env }>) {
  // Mount route groups with their protection levels
  app.route('/api/user', userRoutes);
  app.route('/api/org', orgRoutes);  
  app.route('/api/admin', adminRoutes);
  app.route('/api/sync', syncRoutes);

  // Add global error handler for context validation failures
  app.onError((err, c) => {
    const requestId = c.get('requestId') || 'unknown';
    
    apiLogger.error('Request failed with context validation error', {
      error: err.message,
      path: c.req.path,
      method: c.req.method,
      requestId
    }, 'protected-routes');

    return c.json({
      error: 'Request processing failed',
      code: 'PROCESSING_ERROR',
      requestId
    }, 500);
  });
}

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// Example API calls that would work:

// ✅ User route - only needs authentication
GET /api/user/profile
Headers: Cookie: session=...

// ✅ Org route - needs user + org context  
GET /api/org/projects
Headers: 
  Cookie: session=...
  X-Organization-Slug: acme-corp

// ✅ Admin route - needs user + org + admin permission
POST /api/admin/invite-user
Headers:
  Cookie: session=...
  X-Organization-Slug: acme-corp

// ❌ These would fail:

// Missing session
GET /api/user/profile
// Returns: 401 Authentication required

// Missing org context
GET /api/org/projects  
Headers: Cookie: session=...
// Returns: 400 Organization context required

// Insufficient permissions
POST /api/admin/settings
Headers: 
  Cookie: session=...
  X-Organization-Slug: acme-corp
// Returns: 403 Permission denied (if user not admin)
*/