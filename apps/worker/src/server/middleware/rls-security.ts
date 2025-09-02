/**
 * Row Level Security (RLS) Middleware
 * Implements enterprise-grade multi-tenant security by setting database context
 */

import { Context, Next } from 'hono';
import { getKysely } from '../lib/database-manager';
import { dbLogger } from './logger';
import { sql } from 'kysely';

export interface RLSContext {
  organizationId: string;
  userId: string;
  userRole: string;
}

/**
 * Extract organization context from request
 */
async function extractOrganizationContext(c: Context): Promise<RLSContext | null> {
  const user = c.get('user');
  const session = c.get('session');
  
  console.log('[RLS DEBUG] Extracting context:', {
    hasUser: !!user,
    hasSession: !!session,
    userId: user?.id,
    path: c.req.path
  });
  
  if (!user || !session) {
    console.log('[RLS DEBUG] No user or session found');
    return null;
  }

  // Method 1: From URL path (e.g., /api/organizations/{orgId}/...)
  const orgIdFromPath = c.req.param('orgId');
  console.log('[RLS DEBUG] OrgId from path param:', orgIdFromPath);
  
  // Method 1b: Parse directly from URL path for archetype routes
  let orgIdFromArchetypePath = null;
  if (c.req.path.includes('/api/archetype/orgs/')) {
    const pathMatch = c.req.path.match(/\/api\/archetype\/orgs\/([^\/]+)/);
    if (pathMatch) {
      orgIdFromArchetypePath = pathMatch[1];
    }
  }
  console.log('[RLS DEBUG] OrgId from archetype path:', orgIdFromArchetypePath);
  
  // Method 2: From request headers
  const orgIdFromHeader = c.req.header('X-Organization-ID');
  
  // Method 3: From request body
  let orgIdFromBody = null;
  try {
    const body = await c.req.json().catch(() => null);
    orgIdFromBody = body?.organization_id || body?.organizationId;
  } catch {
    // Ignore parsing errors
  }

  // Method 4: From query parameters
  const orgIdFromQuery = c.req.query('organization_id') || c.req.query('org_id');

  // Determine organization ID (prefer explicit path parameter)
  const organizationId = orgIdFromPath || orgIdFromArchetypePath || orgIdFromHeader || orgIdFromBody || orgIdFromQuery;

  if (!organizationId) {
    // For organization listing endpoints, we don't need org context
    if (c.req.path === '/api/organizations' && c.req.method === 'GET') {
      return null; // Allow - will use user membership policy
    }
    
    dbLogger.warn('No organization context found in request', {
      path: c.req.path,
      method: c.req.method,
      userId: user.id,
      headers: Object.fromEntries(c.req.raw.headers.entries())
    }, 'rls-security');
    
    return null;
  }

  // Check user's membership in this organization
  const db = getKysely();
  const membership = await db
    .selectFrom('organization_members')
    .select(['role'])
    .where('organization_id', '=', organizationId)
    .where('user_id', '=', user.id)
    .executeTakeFirst();

  if (!membership) {
    dbLogger.warn('User attempted to access organization without membership', {
      userId: user.id,
      organizationId,
      membership: 'not_found',
      path: c.req.path
    }, 'rls-security');
    
    return null;
  }

  return {
    organizationId,
    userId: user.id,
    userRole: membership.role // This will be used as fallback, but RLS will calculate effective role
  };
}

/**
 * Set RLS context in database session
 */
async function setRLSContext(c: Context, context: RLSContext): Promise<void> {
  const db = getKysely();
  
  try {
    // Set RLS context variables
    await db.executeQuery(
      sql`SELECT set_rls_context(
        ${context.organizationId}::uuid,
        ${context.userId},
        ${context.userRole}
      )`.compile(db)
    );

    dbLogger.debug('RLS context set successfully', {
      organizationId: context.organizationId,
      userId: context.userId,
      userRole: context.userRole,
      path: c.req.path
    }, 'rls-security');

  } catch (error) {
    dbLogger.error('Failed to set RLS context', {
      error: error instanceof Error ? error.message : 'Unknown error',
      organizationId: context.organizationId,
      userId: context.userId,
      path: c.req.path
    }, 'rls-security');
    
    throw new Error('Security context initialization failed');
  }
}

/**
 * Clear RLS context after request
 */
async function clearRLSContext(c: Context): Promise<void> {
  const db = getKysely();
  
  try {
    await db.executeQuery(
      sql`SELECT clear_rls_context()`.compile(db)
    );

    dbLogger.debug('RLS context cleared', {
      path: c.req.path
    }, 'rls-security');

  } catch (error) {
    dbLogger.warn('Failed to clear RLS context', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: c.req.path
    }, 'rls-security');
    
    // Don't throw - this is cleanup, shouldn't fail the request
  }
}

/**
 * Main RLS security middleware
 */
export async function rlsSecurityMiddleware(c: Context, next: Next) {
  const startTime = Date.now();
  let rlsContext: RLSContext | null = null;

  try {
    // Skip RLS for public endpoints
    const publicEndpoints = [
      '/api/health',
      '/api/auth/',
      '/api/organizations/invitations/accept', // Public invitation acceptance
    ];

    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      c.req.path.startsWith(endpoint)
    );

    if (isPublicEndpoint) {
      dbLogger.debug('Skipping RLS for public endpoint', {
        path: c.req.path
      }, 'rls-security');
      
      await next();
      return;
    }

    // Extract organization context
    rlsContext = await extractOrganizationContext(c);

    if (rlsContext) {
      // Set RLS context for tenant isolation
      await setRLSContext(c, rlsContext);
      
      // Store context in Hono context for use by handlers
      c.set('rlsContext', rlsContext);
      
      dbLogger.info('RLS security active', {
        organizationId: rlsContext.organizationId,
        userId: rlsContext.userId,
        userRole: rlsContext.userRole,
        path: c.req.path,
        method: c.req.method
      }, 'rls-security');
      
    } else {
      // Some endpoints don't require organization context
      const allowedWithoutOrgContext = [
        '/api/organizations', // User's organization list
      ];

      const isAllowed = allowedWithoutOrgContext.some(path => 
        c.req.path === path && c.req.method === 'GET'
      );

      if (!isAllowed) {
        dbLogger.warn('Request blocked - no valid organization context', {
          path: c.req.path,
          method: c.req.method,
          userId: c.get('user')?.id || 'anonymous'
        }, 'rls-security');
        
        return c.json({
          error: 'Organization context required',
          code: 'ORG_CONTEXT_REQUIRED',
          message: 'This operation requires a valid organization context'
        }, 400);
      }
    }

    // Process the request
    await next();

  } catch (error) {
    dbLogger.error('RLS middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: c.req.path,
      method: c.req.method,
      organizationId: rlsContext?.organizationId
    }, 'rls-security');

    return c.json({
      error: 'Security middleware error',
      code: 'RLS_ERROR',
      message: 'Request processing failed due to security constraints'
    }, 500);

  } finally {
    // Always clear RLS context after request
    if (rlsContext) {
      await clearRLSContext(c);
    }

    // Log timing
    const duration = Date.now() - startTime;
    if (duration > 50) { // Log slow RLS operations
      dbLogger.warn('Slow RLS operation', {
        duration,
        path: c.req.path,
        organizationId: rlsContext?.organizationId
      }, 'rls-security');
    }
  }
}

/**
 * Get RLS context from Hono context
 */
export function getRLSContext(c: Context): RLSContext | null {
  return c.get('rlsContext') || null;
}

/**
 * Require organization context middleware
 */
export async function requireOrganizationContext(c: Context, next: Next) {
  const rlsContext = getRLSContext(c);
  
  if (!rlsContext) {
    dbLogger.warn('Organization context required but not found', {
      path: c.req.path,
      method: c.req.method,
      userId: c.var.user?.id
    }, 'rls-security');
    
    return c.json({
      error: 'Organization access required',
      code: 'ORG_ACCESS_REQUIRED',
      message: 'This operation requires organization membership'
    }, 403);
  }

  await next();
}

/**
 * Require admin permissions middleware
 */
export async function requireOrganizationAdmin(c: Context, next: Next) {
  const rlsContext = getRLSContext(c);
  
  if (!rlsContext || !['owner', 'admin'].includes(rlsContext.userRole)) {
    dbLogger.warn('Admin permissions required but not granted', {
      path: c.req.path,
      method: c.req.method,
      userId: c.var.user?.id,
      userRole: rlsContext?.userRole || 'none',
      organizationId: rlsContext?.organizationId
    }, 'rls-security');
    
    return c.json({
      error: 'Admin permissions required',
      code: 'ADMIN_REQUIRED',
      message: 'This operation requires organization admin privileges'
    }, 403);
  }

  await next();
}

/**
 * Manual RLS context setting for special cases
 */
export async function setManualRLSContext(
  c: Context, 
  organizationId: string, 
  userId: string, 
  userRole: string
): Promise<void> {
  const context: RLSContext = { organizationId, userId, userRole };
  await setRLSContext(c, context);
  c.set('rlsContext', context);
  
  dbLogger.info('Manual RLS context set', {
    organizationId,
    userId,
    userRole,
    path: c.req.path
  }, 'rls-security');
}

/**
 * Validate RLS is working correctly
 */
export async function validateRLSSecurity(c: Context): Promise<boolean> {
  const db = getKysely();
  
  try {
    // Test that RLS is enforcing isolation
    const result = await db.executeQuery(
      sql`SELECT test_rls_isolation()`.compile(db)
    );
    
    dbLogger.info('RLS security validation completed', {
      result: result.rows
    }, 'rls-security');
    
    return true;
    
  } catch (error) {
    dbLogger.error('RLS security validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'rls-security');
    
    return false;
  }
}