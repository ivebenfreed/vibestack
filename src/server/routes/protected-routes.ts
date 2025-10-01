/**
 * Protected Route Groups with Mandatory Context Validation
 * 
 * All routes here MUST have user/org context or they fail.
 * This prevents accidental unprotected endpoints.
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';
import { 
  hybridRLSOrgActorMiddleware,
  requirePermission,
  requireRole,
  requireAdmin,
  requireOwner
} from '../middleware/hybrid-rls-org-actor';
import { apiLogger } from '../middleware/logger';
import statusSetsApi from './status-sets-api';

// Legacy context validation imports kept for backward compatibility
import { 
  requireUser, 
  requireUserAndOrg, 
  getUserContext,
  getOrgContext,
  getBothContexts
} from '../middleware/context-validation';

// Create route groups with hybrid security middleware
export const userRoutes = new Hono<AppContext>();
export const orgRoutes = new Hono<AppContext>();
export const adminRoutes = new Hono<AppContext>();

// Apply hybrid security to organization-scoped routes
// Routes will be mounted as /api/org/:orgId/* to enable automatic context extraction
orgRoutes.use('/:orgId/*', hybridRLSOrgActorMiddleware);
adminRoutes.use('/:orgId/*', hybridRLSOrgActorMiddleware);

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

// Organization dashboard - requires organization context
orgRoutes.get('/:orgId/dashboard', async (c) => {
  // Hybrid security context provides zero-latency access
  const security = c.get('security');
  const user = c.get('user');
  
  return c.json({
    message: 'Organization dashboard accessed via hybrid security',
    user: {
      id: security.userId,
      email: user?.email,
      role: security.roleInfo?.role
    },
    organization: {
      id: security.organizationId,
      permissions: security.roleInfo?.permissions || []
    }
  });
});

orgRoutes.get('/:orgId/projects', 
  requirePermission('entities:read'),
  async (c) => {
    // Zero-latency permission check already performed
    const security = c.get('security');
    
    return c.json({
      message: 'Projects retrieved with hybrid security',
      organizationId: security.organizationId,
      userRole: security.roleInfo?.role,
      permissions: security.roleInfo?.permissions,
      projects: [] // Implementation would fetch org projects with RLS filtering
    });
  }
);

orgRoutes.post('/:orgId/projects', 
  requirePermission('entities:write'), 
  async (c) => {
    // Zero-latency permission validation already performed
    const security = c.get('security');
    
    return c.json({
      message: 'Project created with hybrid security',
      createdBy: security.userId,
      organizationId: security.organizationId,
      userRole: security.roleInfo?.role
    });
  }
);

orgRoutes.get('/:orgId/members', 
  requirePermission('members:read'), 
  async (c) => {
    // Instant permission check via SQLite cache
    const security = c.get('security');
    
    return c.json({
      message: 'Organization members retrieved with hybrid security',
      organizationId: security.organizationId,
      requestedBy: security.userId,
      requestedByRole: security.roleInfo?.role
    });
  }
);

// =============================================================================
// ADMIN ROUTES (require admin permissions)
// =============================================================================

// Admin settings - requires admin role
adminRoutes.get('/:orgId/settings', 
  requireAdmin,
  async (c) => {
    // Zero-latency admin permission check via SQLite cache
    const security = c.get('security');
    
    return c.json({
      message: 'Admin settings accessed with hybrid security',
      organizationId: security.organizationId,
      adminUserId: security.userId,
      adminRole: security.roleInfo?.role,
      isAdmin: security.isAdmin()
    });
  }
);

adminRoutes.post('/:orgId/invite-user', 
  requirePermission('members:admin'), 
  async (c) => {
    // Instant permission validation for member management
    const security = c.get('security');
    
    return c.json({
      message: 'User invitation sent with hybrid security',
      invitedBy: security.userId,
      organizationId: security.organizationId,
      invitedByRole: security.roleInfo?.role
    });
  }
);

// =============================================================================
// SYNC ROUTES (special handling for WebSocket upgrades)
// =============================================================================

export const syncRoutes = new Hono<AppContext>();

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

export function mountProtectedRoutes(app: Hono<AppContext>) {
  // Mount route groups with hybrid security middleware
  // User routes remain unchanged (no org context needed)
  app.route('/api/user', userRoutes);
  
  // Organization and admin routes now use /:orgId pattern for automatic context extraction
  app.route('/api/org', orgRoutes);  
  app.route('/api/admin', adminRoutes);
  
  // Status set management API (requires organization context)
  app.route('/api', statusSetsApi);

  // Sync routes use special handling for WebSocket upgrades
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