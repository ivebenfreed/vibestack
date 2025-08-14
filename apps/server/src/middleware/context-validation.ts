/**
 * Context Validation Middleware
 * 
 * Ensures every request has valid user and organization context.
 * Fails fast if context is missing or invalid.
 */

import { Context, Next } from 'hono';
import type { Env } from '../types/env';
import { getAuth } from '../lib/auth';
import { OrgAccessService } from '../services/org-access-service';
import { getKysely } from '../lib/kysely';
import { apiLogger } from './logger';

const MODULE_NAME = 'context-validation';

export interface UserContext {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  sessionId: string;
}

export interface OrganizationContext {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  userOrgRole: string;
  userOrgPermissions: string[];
}

export interface RequestContext extends UserContext {
  organization?: OrganizationContext;
}

// Extend Hono context to include our validated context
declare module 'hono' {
  interface ContextVariableMap {
    userContext: UserContext;
    orgContext?: OrganizationContext;
    requestId: string;
  }
}

/**
 * Extract organization slug from request
 * Supports multiple patterns:
 * - Header: X-Organization-Slug
 * - Query param: ?org=slug
 * - Subdomain: slug.domain.com
 * - Path prefix: /org/slug/...
 */
function extractOrganizationSlug(c: Context): string | null {
  // 1. Check header (most reliable for API calls)
  const headerSlug = c.req.header('X-Organization-Slug');
  if (headerSlug) return headerSlug;

  // 2. Check query parameter
  const querySlug = c.req.query('org');
  if (querySlug) return querySlug;

  // 3. Check subdomain (if using subdomain routing)
  const host = c.req.header('Host');
  if (host && host.includes('.')) {
    const subdomain = host.split('.')[0];
    // Avoid common subdomains
    if (subdomain && !['www', 'api', 'app', 'admin'].includes(subdomain)) {
      return subdomain;
    }
  }

  // 4. Check path prefix pattern: /org/slug/...
  const path = c.req.path;
  const orgPathMatch = path.match(/^\/org\/([^\/]+)/);
  if (orgPathMatch) {
    return orgPathMatch[1];
  }

  return null;
}

/**
 * User authentication middleware - required for all protected routes
 */
export async function requireUser() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const requestId = crypto.randomUUID();
    c.set('requestId', requestId);

    try {
      // Get auth instance
      const auth = getAuth(c);
      
      // Get session from request
      const session = await auth.api.getSession({
        headers: c.req.raw.headers
      });

      if (!session || !session.user || !session.session) {
        apiLogger.warn('Request without valid session', {
          path: c.req.path,
          method: c.req.method,
          requestId,
          headers: Object.fromEntries(c.req.raw.headers.entries())
        }, MODULE_NAME);

        return c.json({ 
          error: 'Authentication required',
          code: 'NO_SESSION',
          requestId 
        }, 401);
      }

      // Create user context
      const userContext: UserContext = {
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.name || 'Unknown',
        userRole: session.user.role || 'member',
        sessionId: session.session.id
      };

      // Set user context in request
      c.set('userContext', userContext);

      apiLogger.debug('User context validated', {
        userId: userContext.userId,
        userEmail: userContext.userEmail,
        userRole: userContext.userRole,
        requestId
      }, MODULE_NAME);

      await next();
    } catch (error) {
      apiLogger.error('User authentication failed', {
        error: error instanceof Error ? error.message : String(error),
        path: c.req.path,
        method: c.req.method,
        requestId
      }, MODULE_NAME);

      return c.json({ 
        error: 'Authentication failed',
        code: 'AUTH_ERROR',
        requestId 
      }, 500);
    }
  };
}

/**
 * Organization context middleware - required for org-specific routes
 */
export async function requireOrganization() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const requestId = c.get('requestId');
    const userContext = c.get('userContext');

    if (!userContext) {
      return c.json({ 
        error: 'User context required before organization context',
        code: 'NO_USER_CONTEXT',
        requestId 
      }, 500);
    }

    try {
      // Extract organization slug from request
      const organizationSlug = extractOrganizationSlug(c);
      
      if (!organizationSlug) {
        apiLogger.warn('Request missing organization context', {
          path: c.req.path,
          method: c.req.method,
          userId: userContext.userId,
          requestId,
          extractedFrom: 'none'
        }, MODULE_NAME);

        return c.json({ 
          error: 'Organization context required',
          code: 'NO_ORG_CONTEXT',
          requestId,
          hint: 'Provide organization via X-Organization-Slug header, ?org query param, or path prefix'
        }, 400);
      }

      // Validate user has access to this organization
      const kysely = getKysely(c.env);
      const orgAccessService = new OrgAccessService(kysely, c.env);
      
      const orgAccess = await orgAccessService.checkUserOrgAccess(
        userContext.userId,
        organizationSlug
      );

      if (!orgAccess.hasAccess) {
        apiLogger.warn('User lacks organization access', {
          userId: userContext.userId,
          organizationSlug,
          requestId,
          fromCache: orgAccess.fromCache
        }, MODULE_NAME);

        return c.json({ 
          error: 'Organization access denied',
          code: 'ORG_ACCESS_DENIED',
          requestId,
          organizationSlug
        }, 403);
      }

      // Create organization context
      const orgContext: OrganizationContext = {
        organizationId: orgAccess.organization!.id,
        organizationSlug: orgAccess.organization!.slug,
        organizationName: orgAccess.organization!.name,
        userOrgRole: orgAccess.role!,
        userOrgPermissions: orgAccess.permissions || []
      };

      // Set organization context in request
      c.set('orgContext', orgContext);

      apiLogger.debug('Organization context validated', {
        userId: userContext.userId,
        organizationId: orgContext.organizationId,
        organizationSlug: orgContext.organizationSlug,
        userOrgRole: orgContext.userOrgRole,
        fromCache: orgAccess.fromCache,
        requestId
      }, MODULE_NAME);

      await next();
    } catch (error) {
      apiLogger.error('Organization context validation failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: userContext.userId,
        path: c.req.path,
        requestId
      }, MODULE_NAME);

      return c.json({ 
        error: 'Organization validation failed',
        code: 'ORG_VALIDATION_ERROR',
        requestId 
      }, 500);
    }
  };
}

/**
 * Combined middleware for routes requiring both user and organization context
 */
export function requireUserAndOrg() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Chain the middlewares
    const userMiddleware = requireUser();
    const orgMiddleware = requireOrganization();
    
    await userMiddleware(c, async () => {
      await orgMiddleware(c, next);
    });
  };
}

/**
 * Permission check middleware - requires specific permission
 */
export function requirePermission(permission: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const requestId = c.get('requestId');
    const userContext = c.get('userContext');
    const orgContext = c.get('orgContext');

    if (!userContext) {
      return c.json({ 
        error: 'User context required for permission check',
        code: 'NO_USER_CONTEXT',
        requestId 
      }, 500);
    }

    // Global admin bypass
    if (userContext.userRole === 'super_admin') {
      await next();
      return;
    }

    if (!orgContext) {
      return c.json({ 
        error: 'Organization context required for permission check',
        code: 'NO_ORG_CONTEXT',
        requestId 
      }, 500);
    }

    // Check if user has required permission
    const hasPermission = orgContext.userOrgPermissions.includes(permission) ||
                         orgContext.userOrgPermissions.includes('*');

    if (!hasPermission) {
      apiLogger.warn('Permission denied', {
        userId: userContext.userId,
        organizationSlug: orgContext.organizationSlug,
        requiredPermission: permission,
        userPermissions: orgContext.userOrgPermissions,
        requestId
      }, MODULE_NAME);

      return c.json({ 
        error: 'Permission denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId,
        requiredPermission: permission
      }, 403);
    }

    apiLogger.debug('Permission granted', {
      userId: userContext.userId,
      organizationSlug: orgContext.organizationSlug,
      permission,
      requestId
    }, MODULE_NAME);

    await next();
  };
}

/**
 * Context helper functions for use in route handlers
 */
export function getUserContext(c: Context): UserContext {
  const userContext = c.get('userContext');
  if (!userContext) {
    throw new Error('User context not available - ensure requireUser() middleware is applied');
  }
  return userContext;
}

export function getOrgContext(c: Context): OrganizationContext {
  const orgContext = c.get('orgContext');
  if (!orgContext) {
    throw new Error('Organization context not available - ensure requireOrganization() middleware is applied');
  }
  return orgContext;
}

export function getBothContexts(c: Context): { user: UserContext; org: OrganizationContext } {
  return {
    user: getUserContext(c),
    org: getOrgContext(c)
  };
}