/**
 * Container Permission System
 * 
 * Implements archetype-specific container permissions based on business access patterns.
 * Each archetype defines its own permission model, access rules, and business logic.
 */

export type ContainerPermissionModel = 
  | 'org-wide'        // All org members can access (e.g., Record archetype)
  | 'owner-only'      // Only record owner can access
  | 'role-based'      // Access based on user role hierarchy
  | 'team-based'      // Access based on team/project membership (e.g., Project archetype)
  | 'assignment-based' // Access based on assignments (e.g., Task archetype)
  | 'attachment-based' // Inherits from parent entity (e.g., File, Discussion)
  | 'workspace-based' // Collaborative access (e.g., Document archetype)
  | 'context-dependent' // Variable based on context (e.g., Activity archetype)
  | 'custom';         // Custom business logic

export type AccessOperation = 'read' | 'write' | 'delete';
export type AccessResult = 'allow' | 'deny';

export interface PermissionRule {
  // SQL-like condition to evaluate
  condition?: string;
  
  // Required roles for this rule
  roles?: string[];
  
  // User relationship match
  userMatch?: 'owner' | 'assignee' | 'reporter' | 'creator' | 'any';
  
  // Custom field checks
  fieldChecks?: Record<string, any>;
  
  // Result if rule matches
  result: AccessResult;
  
  // Human-readable description
  description?: string;
}

export interface AccessRules {
  rules: PermissionRule[];
  defaultPolicy: AccessResult;
}

export interface ContainerPermissionSpec {
  // Permission model for this archetype
  model: ContainerPermissionModel;
  
  // Container behavior
  allowsMultipleContainers: boolean;
  inheritsFromParent: boolean;
  defaultContainerType?: string;
  
  // Access permissions
  readAccess: AccessRules;
  writeAccess: AccessRules;
  deleteAccess: AccessRules;
  
  // Custom permission logic reference
  customLogicFn?: string;
  
  // Access scope description
  accessScope: string;
}

export interface ContainerContext {
  organizationId: string;
  userId: string;
  userRole: string;
  userPermissions: string[];
  entityRecord?: any;
  parentEntity?: any;
  containerMemberships?: string[];
}

/**
 * Container Permission Engine
 * Evaluates archetype-specific access permissions
 */
export class ContainerPermissionEngine {
  /**
   * Check if user has access to perform operation on entity
   */
  async checkAccess(
    permissionSpec: ContainerPermissionSpec,
    operation: AccessOperation,
    context: ContainerContext
  ): Promise<{
    allowed: boolean;
    reason: string;
    appliedRule?: PermissionRule;
  }> {
    const accessRules = this.getAccessRules(permissionSpec, operation);
    
    // Evaluate each rule in order
    for (const rule of accessRules.rules) {
      if (await this.evaluateRule(rule, context)) {
        return {
          allowed: rule.result === 'allow',
          reason: rule.description || `Rule ${rule.result}: ${JSON.stringify(rule)}`,
          appliedRule: rule
        };
      }
    }
    
    // Apply default policy
    return {
      allowed: accessRules.defaultPolicy === 'allow',
      reason: `Default policy: ${accessRules.defaultPolicy}`
    };
  }
  
  /**
   * Get access rules for specific operation
   */
  private getAccessRules(spec: ContainerPermissionSpec, operation: AccessOperation): AccessRules {
    switch (operation) {
      case 'read':
        return spec.readAccess;
      case 'write':
        return spec.writeAccess;
      case 'delete':
        return spec.deleteAccess;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Evaluate a single permission rule
   */
  private async evaluateRule(rule: PermissionRule, context: ContainerContext): Promise<boolean> {
    // Check role requirements
    if (rule.roles && rule.roles.length > 0) {
      const hasRole = rule.roles.some(role => 
        context.userPermissions.includes(role) || 
        this.hasHierarchicalRole(context.userRole, role)
      );
      if (!hasRole) return false;
    }
    
    // Check user relationship match
    if (rule.userMatch && context.entityRecord) {
      const matches = this.checkUserMatch(rule.userMatch, context);
      if (!matches) return false;
    }
    
    // Check field conditions
    if (rule.fieldChecks && context.entityRecord) {
      const matches = this.checkFieldConditions(rule.fieldChecks, context.entityRecord);
      if (!matches) return false;
    }
    
    // Check SQL-like conditions (simplified)
    if (rule.condition) {
      const matches = await this.evaluateCondition(rule.condition, context);
      if (!matches) return false;
    }
    
    return true;
  }
  
  /**
   * Check hierarchical role access
   */
  private hasHierarchicalRole(userRole: string, requiredRole: string): boolean {
    const roleHierarchy: Record<string, number> = {
      'viewer': 1,
      'member': 2,
      'manager': 3,
      'admin': 4,
      'owner': 5
    };
    
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
  }
  
  /**
   * Check user relationship match
   */
  private checkUserMatch(userMatch: string, context: ContainerContext): boolean {
    if (!context.entityRecord) return false;
    
    switch (userMatch) {
      case 'owner':
        return context.entityRecord.owner_id === context.userId || 
               context.entityRecord.created_by === context.userId ||
               context.entityRecord.author_id === context.userId;
      case 'assignee':
        return context.entityRecord.assignee_id === context.userId;
      case 'reporter':
        return context.entityRecord.reporter_id === context.userId;
      case 'creator':
        return context.entityRecord.created_by === context.userId;
      case 'any':
        return true;
      default:
        return false;
    }
  }
  
  /**
   * Check field conditions
   */
  private checkFieldConditions(fieldChecks: Record<string, any>, record: any): boolean {
    for (const [field, expectedValue] of Object.entries(fieldChecks)) {
      if (record[field] !== expectedValue) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Evaluate SQL-like condition (simplified implementation)
   */
  private async evaluateCondition(condition: string, context: ContainerContext): Promise<boolean> {
    // For MVP, implement basic conditions
    // This would be expanded to support more complex SQL-like expressions
    
    if (condition.includes('current_user_id')) {
      const resolved = condition.replace('current_user_id', `'${context.userId}'`);
      // Simple equality check for now
      if (resolved.includes('=') && context.entityRecord) {
        const [field, value] = resolved.split('=').map(s => s.trim().replace(/'/g, ''));
        return context.entityRecord[field] === value;
      }
    }
    
    // Default to true for unimplemented conditions
    return true;
  }
}

/**
 * Predefined access patterns for common scenarios
 */
export const AccessPatterns = {
  // Organization-wide read access
  ORG_READ: {
    rules: [
      { roles: ['viewer', 'member', 'manager', 'admin', 'owner'], result: 'allow' as AccessResult }
    ],
    defaultPolicy: 'deny' as AccessResult
  },
  
  // Member-level write access
  MEMBER_WRITE: {
    rules: [
      { roles: ['member', 'manager', 'admin', 'owner'], result: 'allow' as AccessResult }
    ],
    defaultPolicy: 'deny' as AccessResult
  },
  
  // Admin-only delete access
  ADMIN_DELETE: {
    rules: [
      { roles: ['admin', 'owner'], result: 'allow' as AccessResult }
    ],
    defaultPolicy: 'deny' as AccessResult
  },
  
  // Owner-only access
  OWNER_ONLY: {
    rules: [
      { userMatch: 'owner' as const, result: 'allow' as AccessResult },
      { roles: ['admin'], result: 'allow' as AccessResult }
    ],
    defaultPolicy: 'deny' as AccessResult
  },
  
  // Assignment-based access (for tasks)
  ASSIGNMENT_BASED: {
    rules: [
      { userMatch: 'assignee' as const, result: 'allow' as AccessResult },
      { userMatch: 'reporter' as const, result: 'allow' as AccessResult },
      { roles: ['manager', 'admin'], result: 'allow' as AccessResult }
    ],
    defaultPolicy: 'deny' as AccessResult
  }
};