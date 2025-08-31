/**
 * Hybrid RLS + Organization Actor Middleware
 * 
 * STRATEGY:
 * - PostgreSQL RLS: Simple organization-level filtering (fast, reliable)
 * - Organization Actor: Complex role-based permissions (zero-latency SQLite cache)
 * 
 * This provides the best of both worlds:
 * - Database-level security isolation at org level
 * - Zero-latency role checks via SQLite cache
 * - Massive performance improvement over complex PostgreSQL RLS
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { AppBindings } from '../types/hono';
import { syncLogger } from './logger';
import { createOrgActorCache, type OrganizationActorCacheService, type RoleInfo } from '../lib/organization-actor-cache';
import { db } from '../lib/kysely';
import { sql } from 'kysely';

const MODULE_NAME = 'HybridRLSOrgActor';

export interface HybridSecurityContext {
  organizationId: string;
  userId: string;
  roleInfo: RoleInfo | null;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  isOwner: () => boolean;
}

/**
 * Extract organization ID from the request
 * Supports multiple extraction methods for flexibility
 */
function extractOrganizationId(c: Context<AppBindings>): string | null {
  // Method 1: Path parameter (preferred for API routes)
  const pathOrgId = c.req.param('orgId');
  if (pathOrgId) return pathOrgId;
  
  // Method 2: Query parameter
  const queryOrgId = c.req.query('orgId') || c.req.query('organizationId');
  if (queryOrgId) return queryOrgId;
  
  // Method 3: Header (for WebSocket or special requests)
  const headerOrgId = c.req.header('x-organization-id');
  if (headerOrgId) return headerOrgId;
  
  // Method 4: Request body (for POST/PUT requests)
  try {
    const contentType = c.req.header('content-type');
    if (contentType?.includes('application/json')) {
      // Note: This is a simplified approach - in practice you might want to cache the body
      // For now, we'll skip body parsing to avoid consuming the stream
    }
  } catch (error) {
    // Ignore body parsing errors
  }
  
  return null;
}

/**
 * Set simplified PostgreSQL RLS context (organization-level only)
 */
async function setPostgreSQLContext(
  organizationId: string,
  userId: string,
  env: any
): Promise<void> {
  try {
    const database = db(env);
    
    // Set simplified RLS context (no role needed)
    // Use sql template with proper parameterized query
    await sql`select set_simplified_rls_context(${organizationId}, ${userId}) as result limit 1`.execute(database);
    
    syncLogger.debug('PostgreSQL RLS context set', {
      organizationId: organizationId.substring(0, 8) + '...',
      userId: userId.substring(0, 8) + '...'
    }, MODULE_NAME);
    
  } catch (error) {
    syncLogger.error('Failed to set PostgreSQL RLS context', {
      organizationId: organizationId.substring(0, 8) + '...',
      userId: userId.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    throw new Error('Database security context setup failed');
  }
}

/**
 * Get user role from Organization Actor cache with PostgreSQL fallback
 */
async function getUserRole(
  cacheService: OrganizationActorCacheService,
  organizationId: string,
  userId: string,
  env: any
): Promise<RoleInfo | null> {
  return await cacheService.getAndCacheRole(
    organizationId,
    userId,
    async () => {
      // Fallback: Fetch role from PostgreSQL
      try {
        const database = db(env);
        
        const member = await database
          .selectFrom('organization_members')
          .select(['role'])
          .where('organization_id', '=', organizationId)
          .where('user_id', '=', userId)
          .executeTakeFirst();
        
        if (member) {
          // Map role to permissions
          const permissions = mapRoleToPermissions(member.role);
          return { role: member.role, permissions };
        }
        
        return null;
        
      } catch (error) {
        syncLogger.error('Failed to fetch role from PostgreSQL', {
          organizationId: organizationId.substring(0, 8) + '...',
          userId: userId.substring(0, 8) + '...',
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
        
        return null;
      }
    }
  );
}

/**
 * Role hierarchy definition (higher roles include all lower role permissions)
 */
const ROLE_HIERARCHY: Record<string, number> = {
  'viewer': 1,
  'member': 2, 
  'manager': 3,
  'admin': 4,
  'owner': 5
};

/**
 * Map role to permissions array
 */
function mapRoleToPermissions(role: string): string[] {
  switch (role) {
    case 'owner':
      return ['admin', 'write', 'read', 'invite', 'manage_billing', 'delete'];
    case 'admin':
      return ['admin', 'write', 'read', 'invite', 'delete'];
    case 'manager':
      return ['write', 'read', 'invite'];
    case 'member':
      return ['read', 'write'];
    case 'viewer':
      return ['read'];
    default:
      return ['read'];
  }
}

/**
 * Check if a user role has access to a required role (hierarchical)
 */
function hasHierarchicalRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Create security context helper
 */
function createSecurityContext(
  organizationId: string,
  userId: string,
  roleInfo: RoleInfo | null
): HybridSecurityContext {
  return {
    organizationId,
    userId,
    roleInfo,
    
    hasRole: (role: string): boolean => {
      if (!roleInfo?.role) return false;
      return hasHierarchicalRole(roleInfo.role, role);
    },
    
    hasPermission: (permission: string): boolean => {
      if (!roleInfo?.permissions) return false;
      
      // Check for exact permission match
      if (roleInfo.permissions.includes(permission)) return true;
      
      // Check for hierarchical permissions
      // Admin permission grants access to all entity operations
      if (roleInfo.permissions.includes('admin') && permission.startsWith('entities:')) {
        return true;
      }
      
      // Read permission grants access to entities:read
      if (roleInfo.permissions.includes('read') && permission === 'entities:read') {
        return true;
      }
      
      // Write permission grants access to entities:write and entities:read
      if (roleInfo.permissions.includes('write') && (permission === 'entities:write' || permission === 'entities:read')) {
        return true;
      }
      
      return false;
    },
    
    isAdmin: (): boolean => {
      return roleInfo?.permissions.includes('admin') || false;
    },
    
    isOwner: (): boolean => {
      return roleInfo?.role === 'owner';
    }
  };
}

/**
 * Hybrid RLS + Organization Actor Middleware
 * 
 * Sets up both PostgreSQL RLS context and Organization Actor role caching
 */
export const hybridRLSOrgActorMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const user = c.get('user');
  
  if (!user) {
    syncLogger.warn('Hybrid security middleware called without authenticated user', {}, MODULE_NAME);
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  // Extract organization ID from request
  const organizationId = extractOrganizationId(c);
  
  if (!organizationId) {
    syncLogger.warn('Organization ID not found in request', {
      path: c.req.path,
      method: c.req.method,
      userId: user.id.substring(0, 8) + '...'
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Organization context required',
      details: 'Organization ID must be provided in path, query, or header'
    }, 400);
  }
  
  try {
    // 1. Set PostgreSQL RLS context (simple org-level filtering)
    await setPostgreSQLContext(organizationId, user.id, c.env);
    
    // 2. Get user role from Organization Actor cache
    const cacheService = createOrgActorCache(c.env);
    const roleInfo = await getUserRole(cacheService, organizationId, user.id, c.env);
    
    if (!roleInfo) {
      syncLogger.warn('User role not found', {
        organizationId: organizationId.substring(0, 8) + '...',
        userId: user.id.substring(0, 8) + '...'
      }, MODULE_NAME);
      
      return c.json({ 
        error: 'Access denied',
        details: 'User is not a member of this organization'
      }, 403);
    }
    
    // 3. Create security context and attach to request
    const securityContext = createSecurityContext(organizationId, user.id, roleInfo);
    c.set('security', securityContext);
    c.set('orgActorCache', cacheService);
    
    syncLogger.debug('Hybrid security context established', {
      organizationId: organizationId.substring(0, 8) + '...',
      userId: user.id.substring(0, 8) + '...',
      role: roleInfo.role,
      permissionCount: roleInfo.permissions.length
    }, MODULE_NAME);
    
    // Continue to next middleware/handler
    await next();
    
  } catch (error) {
    syncLogger.error('Hybrid security middleware failed', {
      organizationId: organizationId ? organizationId.substring(0, 8) + '...' : 'unknown',
      userId: user.id.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, MODULE_NAME);
    
    return c.json({ 
      error: 'Security context setup failed',
      details: 'Unable to establish secure database context'
    }, 500);
  }
});

/**
 * Role-based access control middleware
 * Uses Organization Actor cache for zero-latency permission checks
 */
export function requireRole(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return createMiddleware<AppBindings>(async (c, next) => {
    const security = c.get('security') as HybridSecurityContext | undefined;
    
    if (!security) {
      syncLogger.error('Security context not found - hybrid middleware must run first', {}, MODULE_NAME);
      return c.json({ error: 'Security context not established' }, 500);
    }
    
    const hasRequiredRole = roles.some(role => security.hasRole(role));
    
    if (!hasRequiredRole) {
      syncLogger.warn('Role-based access denied', {
        userId: security.userId.substring(0, 8) + '...',
        userRole: security.roleInfo?.role || 'none',
        requiredRoles: roles
      }, MODULE_NAME);
      
      return c.json({ 
        error: 'Insufficient permissions',
        details: `Requires one of: ${roles.join(', ')}`
      }, 403);
    }
    
    await next();
  });
}

/**
 * Permission-based access control middleware
 * Uses Organization Actor cache for zero-latency permission checks
 */
export function requirePermission(requiredPermissions: string | string[]) {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  
  return createMiddleware<AppBindings>(async (c, next) => {
    const security = c.get('security') as HybridSecurityContext | undefined;
    
    if (!security) {
      syncLogger.error('Security context not found - hybrid middleware must run first', {}, MODULE_NAME);
      return c.json({ error: 'Security context not established' }, 500);
    }
    
    const hasRequiredPermission = permissions.some(permission => security.hasPermission(permission));
    
    if (!hasRequiredPermission) {
      syncLogger.warn('Permission-based access denied', {
        userId: security.userId.substring(0, 8) + '...',
        userPermissions: security.roleInfo?.permissions || [],
        requiredPermissions: permissions
      }, MODULE_NAME);
      
      return c.json({ 
        error: 'Insufficient permissions',
        details: `Requires one of: ${permissions.join(', ')}`
      }, 403);
    }
    
    await next();
  });
}

/**
 * Admin-only access middleware
 */
export const requireAdmin = requirePermission('admin');

/**
 * Owner-only access middleware  
 */
export const requireOwner = requireRole('owner');