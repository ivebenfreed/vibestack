/**
 * Simplified RLS Middleware
 * 
 * Direct PostgreSQL queries with proper RLS context.
 * Relies on WAL polling for real-time updates instead of complex caching.
 * 
 * Benefits:
 * - Single source of truth (PostgreSQL)
 * - No cache staleness issues
 * - Simpler to maintain and debug
 * - Real-time updates via WAL polling
 * - Still fast enough (5-15ms vs <1ms cache)
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { AppBindings } from '../types/hono';
import { syncLogger } from './logger';
import { withKysely } from '../lib/database-manager';
import { sql } from 'kysely';

const MODULE_NAME = 'SimpleRLS';

export interface SimpleSecurityContext {
  organizationId: string;
  userId: string;
  role: string | null;
  permissions: string[];
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  isOwner: () => boolean;
}

/**
 * Extract organization ID from the request
 */
function extractOrganizationId(c: Context<AppBindings>): string | null {
  // Method 1: Path parameter (preferred)
  const pathOrgId = c.req.param('orgId');
  if (pathOrgId) return pathOrgId;
  
  // Method 2: Query parameter
  const queryOrgId = c.req.query('orgId') || c.req.query('organizationId');
  if (queryOrgId) return queryOrgId;
  
  // Method 3: Header
  const headerOrgId = c.req.header('x-organization-id');
  if (headerOrgId) return headerOrgId;
  
  return null;
}

/**
 * Set PostgreSQL RLS context
 */
async function setPostgreSQLContext(
  organizationId: string,
  userId: string
): Promise<void> {
  try {
    await withKysely(async (database) => {
      // Set RLS context with organization and user
      await sql`select set_simplified_rls_context(${organizationId}, ${userId})`.execute(database);
    });
    
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
 * Get user role and permissions directly from PostgreSQL
 */
async function getUserRoleAndPermissions(
  organizationId: string,
  userId: string
): Promise<{ role: string; permissions: string[] } | null> {
  try {
    const result = await withKysely(async (database) => {
      const member = await database
        .selectFrom('organization_members')
        .select(['role'])
        .where('organization_id', '=', organizationId)
        .where('user_id', '=', userId)
        .executeTakeFirst();
      
      if (member) {
        const permissions = mapRoleToPermissions(member.role);
        return { role: member.role, permissions };
      }
      return null;
    });
    
    return result;
    
  } catch (error) {
    syncLogger.error('Failed to fetch role from PostgreSQL', {
      organizationId: organizationId.substring(0, 8) + '...',
      userId: userId.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    return null;
  }
}

/**
 * Role hierarchy definition
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
  role: string | null,
  permissions: string[]
): SimpleSecurityContext {
  return {
    organizationId,
    userId,
    role,
    permissions,
    
    hasRole: (requiredRole: string): boolean => {
      if (!role) return false;
      return hasHierarchicalRole(role, requiredRole);
    },
    
    hasPermission: (permission: string): boolean => {
      // Check for exact permission match
      if (permissions.includes(permission)) return true;
      
      // Check for hierarchical permissions
      if (permissions.includes('admin') && permission.startsWith('entities:')) {
        return true;
      }
      
      if (permissions.includes('read') && permission === 'entities:read') {
        return true;
      }
      
      if (permissions.includes('write') && (permission === 'entities:write' || permission === 'entities:read')) {
        return true;
      }
      
      return false;
    },
    
    isAdmin: (): boolean => {
      return permissions.includes('admin');
    },
    
    isOwner: (): boolean => {
      return role === 'owner';
    }
  };
}

/**
 * Simplified RLS Middleware
 * 
 * Sets up PostgreSQL RLS context and fetches user permissions directly from DB.
 * No caching - relies on WAL polling for real-time updates.
 */
export const simpleRLSMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const user = c.get('user');
  
  if (!user) {
    syncLogger.warn('RLS middleware called without authenticated user', {}, MODULE_NAME);
    return c.json({ error: 'Authentication required' }, 401);
  }
  
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
    // 1. Set PostgreSQL RLS context
    await setPostgreSQLContext(organizationId, user.id);
    
    // 2. Get user role and permissions directly from PostgreSQL
    const roleData = await getUserRoleAndPermissions(organizationId, user.id);
    
    if (!roleData) {
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
    const securityContext = createSecurityContext(
      organizationId, 
      user.id, 
      roleData.role, 
      roleData.permissions
    );
    
    c.set('security', securityContext);
    
    syncLogger.debug('Simple security context established', {
      organizationId: organizationId.substring(0, 8) + '...',
      userId: user.id.substring(0, 8) + '...',
      role: roleData.role,
      permissionCount: roleData.permissions.length
    }, MODULE_NAME);
    
    // Continue to next middleware/handler
    await next();
    
  } catch (error) {
    syncLogger.error('RLS middleware failed', {
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
 */
export function requireRole(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return createMiddleware<AppBindings>(async (c, next) => {
    const security = c.get('security') as SimpleSecurityContext | undefined;
    
    if (!security) {
      syncLogger.error('Security context not found - RLS middleware must run first', {}, MODULE_NAME);
      return c.json({ error: 'Security context not established' }, 500);
    }
    
    const hasRequiredRole = roles.some(role => security.hasRole(role));
    
    if (!hasRequiredRole) {
      syncLogger.warn('Role-based access denied', {
        userId: security.userId.substring(0, 8) + '...',
        userRole: security.role || 'none',
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
 */
export function requirePermission(requiredPermissions: string | string[]) {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  
  return createMiddleware<AppBindings>(async (c, next) => {
    const security = c.get('security') as SimpleSecurityContext | undefined;
    
    if (!security) {
      syncLogger.error('Security context not found - RLS middleware must run first', {}, MODULE_NAME);
      return c.json({ error: 'Security context not established' }, 500);
    }
    
    const hasRequiredPermission = permissions.some(permission => security.hasPermission(permission));
    
    if (!hasRequiredPermission) {
      syncLogger.warn('Permission-based access denied', {
        userId: security.userId.substring(0, 8) + '...',
        userPermissions: security.permissions,
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