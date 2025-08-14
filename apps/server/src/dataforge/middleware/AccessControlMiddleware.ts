/**
 * Access Control Middleware - Permission Enforcement System
 * 
 * Provides request-level permission validation and enforcement for the multi-org DataForge platform.
 * Integrates with ContainerPermission and RoleManagementService for comprehensive access control.
 */

import type { Context, Next } from 'hono';
import { ContainerPermission } from '../entities/access/ContainerPermission';
import { RoleManagementService, Permission } from '../services/access/RoleManagementService';

export interface AccessControlContext {
  userId: string;
  organizationId: string;
  permissions: Permission[];
  containerPermissions: ContainerPermission[];
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
}

export interface PermissionCheck {
  resource: string;
  action: string;
  scope?: string;
  entityId?: string;
  containerType?: string;
  containerId?: string;
}

export interface AccessControlOptions {
  required?: PermissionCheck[];
  optional?: PermissionCheck[];
  requireAll?: boolean; // If true, all required permissions must be present
  allowSuperAdmin?: boolean; // If true, super admin bypasses all checks
  allowOwner?: boolean; // If true, entity owner bypasses checks
  customValidator?: (context: AccessControlContext, req: any) => Promise<boolean>;
}

export class AccessControlMiddleware {
  private roleService: RoleManagementService;

  constructor() {
    this.roleService = new RoleManagementService();
  }

  /**
   * Main access control middleware factory
   */
  requirePermissions(options: AccessControlOptions) {
    return async (c: Context, next: Next) => {
      try {
        // Extract user context from request
        const accessContext = await this.extractAccessContext(c);
        
        if (!accessContext.isAuthenticated) {
          return c.json({ error: 'Authentication required' }, 401);
        }

        // Check permissions
        const hasAccess = await this.validatePermissions(accessContext, options, c);
        
        if (!hasAccess) {
          return c.json({ 
            error: 'Insufficient permissions',
            required: options.required,
            message: 'You do not have the required permissions to perform this action'
          }, 403);
        }

        // Add access context to request for downstream use
        c.set('accessContext', accessContext);
        
        await next();
      } catch (error) {
        console.error('Access control error:', error);
        return c.json({ error: 'Access control validation failed' }, 500);
      }
    };
  }

  /**
   * Extract access context from request
   */
  private async extractAccessContext(c: Context): Promise<AccessControlContext> {
    // Extract user from session/JWT - this would integrate with Better Auth
    const session = c.get('session'); // Assumes session is set by auth middleware
    const user = c.get('user'); // Assumes user is set by auth middleware
    
    if (!session || !user) {
      return {
        userId: '',
        organizationId: '',
        permissions: [],
        containerPermissions: [],
        isAuthenticated: false,
        isSuperAdmin: false
      };
    }

    const userId = user.id;
    const organizationId = session.activeOrganizationId || user.defaultOrganizationId;

    // Get user's permissions and roles
    const permissions = await this.roleService.getUserPermissions(userId, organizationId);
    const containerPermissions = await this.getContainerPermissions(userId, organizationId);

    return {
      userId,
      organizationId,
      permissions,
      containerPermissions,
      isAuthenticated: true,
      isSuperAdmin: user.is_super_admin || false
    };
  }

  /**
   * Get container permissions for user
   */
  private async getContainerPermissions(userId: string, organizationId: string): Promise<ContainerPermission[]> {
    // This would query the database for user's container permissions
    // Placeholder implementation
    return [];
  }

  /**
   * Validate permissions against requirements
   */
  private async validatePermissions(
    context: AccessControlContext, 
    options: AccessControlOptions,
    c: Context
  ): Promise<boolean> {
    // Super admin bypass
    if (options.allowSuperAdmin && context.isSuperAdmin) {
      return true;
    }

    // Custom validator
    if (options.customValidator) {
      const customResult = await options.customValidator(context, c.req);
      if (!customResult) return false;
    }

    // Check required permissions
    if (options.required && options.required.length > 0) {
      const requiredResults = await Promise.all(
        options.required.map(check => this.checkSinglePermission(context, check, c))
      );

      if (options.requireAll) {
        // All permissions must be granted
        if (!requiredResults.every(result => result)) {
          return false;
        }
      } else {
        // At least one permission must be granted
        if (!requiredResults.some(result => result)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check a single permission
   */
  private async checkSinglePermission(
    context: AccessControlContext, 
    check: PermissionCheck,
    c: Context
  ): Promise<boolean> {
    // Check direct permissions
    const hasDirectPermission = context.permissions.some(permission => 
      this.matchesPermission(permission, check)
    );

    if (hasDirectPermission) return true;

    // Check container permissions
    if (check.containerType && check.containerId) {
      const containerPermission = context.containerPermissions.find(cp =>
        cp.grantsAccessTo(check.containerType!, check.containerId!) &&
        this.hasRequiredRole(cp, check.action)
      );

      if (containerPermission) return true;
    }

    // Check owner permissions if enabled
    if (options.allowOwner && check.entityId) {
      const isOwner = await this.checkOwnership(context.userId, check, c);
      if (isOwner) return true;
    }

    return false;
  }

  /**
   * Check if permission matches requirement
   */
  private matchesPermission(permission: Permission, check: PermissionCheck): boolean {
    // Resource match (exact or wildcard)
    if (permission.resource !== check.resource && permission.resource !== '*') {
      return false;
    }

    // Action match (exact or admin covers all)
    if (permission.action !== check.action && permission.action !== 'admin') {
      return false;
    }

    // Scope match (if specified)
    if (check.scope && permission.scope && permission.scope !== check.scope) {
      // Special scope logic
      if (!this.isScopeCompatible(permission.scope, check.scope)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if permission scope is compatible with required scope
   */
  private isScopeCompatible(permissionScope: string, requiredScope: string): boolean {
    const scopeHierarchy = {
      'organization': ['department', 'team', 'project', 'own', 'assigned'],
      'department': ['team', 'project', 'own', 'assigned'],
      'team': ['project', 'own', 'assigned'],
      'project': ['own', 'assigned'],
      'admin': ['organization', 'department', 'team', 'project', 'own', 'assigned']
    };

    return scopeHierarchy[permissionScope]?.includes(requiredScope) || false;
  }

  /**
   * Check if container permission role has required access level
   */
  private hasRequiredRole(containerPermission: ContainerPermission, action: string): boolean {
    const actionRequirements = {
      'read': ['viewer', 'contributor', 'member', 'manager', 'admin', 'owner'],
      'write': ['contributor', 'member', 'manager', 'admin', 'owner'],
      'manage': ['manager', 'admin', 'owner'],
      'admin': ['admin', 'owner'],
      'delete': ['owner']
    };

    const allowedRoles = actionRequirements[action] || actionRequirements['admin'];
    return allowedRoles.includes(containerPermission.role);
  }

  /**
   * Check entity ownership
   */
  private async checkOwnership(userId: string, check: PermissionCheck, c: Context): Promise<boolean> {
    if (!check.entityId) return false;

    // This would query the database to check if user owns the entity
    // Implementation depends on entity structure
    // Placeholder logic
    return false;
  }

  /**
   * Resource-specific middleware helpers
   */
  static requireProjectAccess(action: string = 'read') {
    const middleware = new AccessControlMiddleware();
    return middleware.requirePermissions({
      required: [{ resource: 'project', action }],
      allowSuperAdmin: true
    });
  }

  static requireTaskAccess(action: string = 'read') {
    const middleware = new AccessControlMiddleware();
    return middleware.requirePermissions({
      required: [{ resource: 'task', action }],
      allowSuperAdmin: true
    });
  }

  static requireFileAccess(action: string = 'read') {
    const middleware = new AccessControlMiddleware();
    return middleware.requirePermissions({
      required: [{ resource: 'file', action }],
      allowSuperAdmin: true
    });
  }

  static requireOrganizationAccess(action: string = 'read') {
    const middleware = new AccessControlMiddleware();
    return middleware.requirePermissions({
      required: [{ resource: 'organization', action }],
      allowSuperAdmin: true
    });
  }

  /**
   * Container-specific access control
   */
  static requireContainerAccess(containerType: string, role: string = 'viewer') {
    const middleware = new AccessControlMiddleware();
    return middleware.requirePermissions({
      required: [{ resource: containerType, action: 'read', containerType, scope: role }],
      allowSuperAdmin: true
    });
  }

  /**
   * Multi-resource access control
   */
  static requireAnyOf(checks: PermissionCheck[]) {
    const middleware = new AccessControlMiddleware();
    return middleware.requirePermissions({
      required: checks,
      requireAll: false,
      allowSuperAdmin: true
    });
  }

  static requireAllOf(checks: PermissionCheck[]) {
    const middleware = new AccessControlMiddleware();
    return middleware.requirePermissions({
      required: checks,
      requireAll: true,
      allowSuperAdmin: true
    });
  }

  /**
   * Custom permission validators
   */
  static requireCustom(validator: (context: AccessControlContext, req: any) => Promise<boolean>) {
    const middleware = new AccessControlMiddleware();
    return middleware.requirePermissions({
      customValidator: validator,
      allowSuperAdmin: true
    });
  }
}

/**
 * Permission Validation Utilities
 */
export class PermissionValidator {
  /**
   * Validate permission structure
   */
  static validatePermissionCheck(check: PermissionCheck): string[] {
    const errors: string[] = [];

    if (!check.resource) {
      errors.push('Resource is required');
    }

    if (!check.action) {
      errors.push('Action is required');
    }

    // Validate resource types
    const validResources = ['project', 'task', 'file', 'document', 'discussion', 'organization', 'user'];
    if (check.resource && !validResources.includes(check.resource)) {
      errors.push(`Invalid resource: ${check.resource}`);
    }

    // Validate actions
    const validActions = ['read', 'write', 'delete', 'admin', 'manage', 'create', 'update'];
    if (check.action && !validActions.includes(check.action)) {
      errors.push(`Invalid action: ${check.action}`);
    }

    return errors;
  }

  /**
   * Validate access control options
   */
  static validateAccessControlOptions(options: AccessControlOptions): string[] {
    const errors: string[] = [];

    if (options.required) {
      options.required.forEach((check, index) => {
        const checkErrors = this.validatePermissionCheck(check);
        errors.push(...checkErrors.map(err => `Required permission ${index}: ${err}`));
      });
    }

    if (options.optional) {
      options.optional.forEach((check, index) => {
        const checkErrors = this.validatePermissionCheck(check);
        errors.push(...checkErrors.map(err => `Optional permission ${index}: ${err}`));
      });
    }

    return errors;
  }

  /**
   * Check if user has sufficient permissions for operation
   */
  static async checkUserPermissions(
    userId: string, 
    organizationId: string, 
    checks: PermissionCheck[]
  ): Promise<{ hasAccess: boolean; missingPermissions: PermissionCheck[] }> {
    // This would implement the actual permission checking logic
    // Placeholder implementation
    return {
      hasAccess: true,
      missingPermissions: []
    };
  }
}

/**
 * Permission decorator for API endpoints
 */
export function RequirePermissions(options: AccessControlOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const middleware = new AccessControlMiddleware();

    descriptor.value = async function (c: Context, next: Next) {
      // Apply middleware
      const middlewareFunc = middleware.requirePermissions(options);
      await middlewareFunc(c, async () => {
        // Call original method
        return originalMethod.call(this, c, next);
      });
    };

    return descriptor;
  };
}

/**
 * Convenience decorators for common permissions
 */
export const RequireProjectRead = RequirePermissions({
  required: [{ resource: 'project', action: 'read' }],
  allowSuperAdmin: true
});

export const RequireProjectWrite = RequirePermissions({
  required: [{ resource: 'project', action: 'write' }],
  allowSuperAdmin: true
});

export const RequireTaskRead = RequirePermissions({
  required: [{ resource: 'task', action: 'read' }],
  allowSuperAdmin: true
});

export const RequireTaskWrite = RequirePermissions({
  required: [{ resource: 'task', action: 'write' }],
  allowSuperAdmin: true
});

export const RequireOrganizationAdmin = RequirePermissions({
  required: [{ resource: 'organization', action: 'admin' }],
  allowSuperAdmin: true
});

export default AccessControlMiddleware;