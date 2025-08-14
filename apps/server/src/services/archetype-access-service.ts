/**
 * Archetype Access Service
 * 
 * Integrates Universal Archetype operations with ContainerPermission access control.
 * Week 2 Day 3-4: Provides role-based access control for archetype entities.
 */

import { ContainerPermission, ContainerPermissionUtilities } from '../dataforge/entities/foundation/access/ContainerPermission';
import type { Kysely } from 'kysely';

export interface ArchetypeAccessResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: string;
  userRole?: string;
  permission?: ContainerPermission;
}

export class ArchetypeAccessService {
  constructor(private kysely: Kysely<any>) {}

  /**
   * Check if user can create archetype entities in organization
   * Checks permissions in order: project -> department -> organization -> system
   */
  async canCreateEntity(userId: string, orgId: string, projectId?: string, departmentId?: string): Promise<ArchetypeAccessResult> {
    // Check permissions in hierarchical order (most specific to least specific)
    const permissionChecks = [
      ...(projectId ? [{ type: 'project', id: projectId }] : []),
      ...(departmentId ? [{ type: 'department', id: departmentId }] : []),
      { type: 'organization', id: orgId },
      { type: 'system', id: 'global' }
    ];

    for (const check of permissionChecks) {
      const permission = await this.getUserHighestPermission(userId, check.type, check.id);
      
      if (permission && permission.canWrite()) {
        return {
          allowed: true,
          permission
        };
      }
    }

    // No sufficient permissions found in any container
    return {
      allowed: false,
      reason: 'No sufficient permissions found in project, department, organization, or system containers',
      requiredRole: 'member'
    };
  }

  /**
   * Check if user can save data to archetype entities
   * Checks permissions in container hierarchy
   */
  async canSaveData(userId: string, orgId: string, entityName: string, projectId?: string, departmentId?: string): Promise<ArchetypeAccessResult> {
    const permissionChecks = [
      ...(projectId ? [{ type: 'project', id: projectId }] : []),
      ...(departmentId ? [{ type: 'department', id: departmentId }] : []),
      { type: 'organization', id: orgId },
      { type: 'system', id: 'global' }
    ];

    for (const check of permissionChecks) {
      const permission = await this.getUserHighestPermission(userId, check.type, check.id);
      
      if (permission && permission.canWrite()) {
        return {
          allowed: true,
          permission
        };
      }
    }

    return {
      allowed: false,
      reason: 'No sufficient permissions found in container hierarchy',
      requiredRole: 'contributor'
    };
  }

  /**
   * Check if user can query data from archetype entities
   */
  async canQueryData(userId: string, orgId: string, entityName: string): Promise<ArchetypeAccessResult> {
    // Require at least 'viewer' role to query data
    const permission = await this.getUserHighestPermission(userId, 'organization', orgId);
    
    if (!permission) {
      return {
        allowed: false,
        reason: 'No organization access found',
        requiredRole: 'viewer'
      };
    }

    if (!permission.canRead()) {
      return {
        allowed: false,
        reason: 'Insufficient permissions to query data',
        requiredRole: 'viewer',
        userRole: permission.role,
        permission
      };
    }

    return {
      allowed: true,
      permission
    };
  }

  /**
   * Check if user can delete archetype entities or data
   */
  async canDelete(userId: string, orgId: string, entityName: string): Promise<ArchetypeAccessResult> {
    // Require at least 'manager' role to delete
    const permission = await this.getUserHighestPermission(userId, 'organization', orgId);
    
    if (!permission) {
      return {
        allowed: false,
        reason: 'No organization access found',
        requiredRole: 'manager'
      };
    }

    if (!permission.canManage()) {
      return {
        allowed: false,
        reason: 'Insufficient permissions to delete',
        requiredRole: 'manager',
        userRole: permission.role,
        permission
      };
    }

    return {
      allowed: true,
      permission
    };
  }

  /**
   * Check if user can manage archetype schema (add/remove fields)
   */
  async canManageSchema(userId: string, orgId: string, entityName: string): Promise<ArchetypeAccessResult> {
    // Require at least 'admin' role to manage schema
    const permission = await this.getUserHighestPermission(userId, 'organization', orgId);
    
    if (!permission) {
      return {
        allowed: false,
        reason: 'No organization access found',
        requiredRole: 'admin'
      };
    }

    if (!permission.canAdminister()) {
      return {
        allowed: false,
        reason: 'Insufficient permissions to manage schema',
        requiredRole: 'admin',
        userRole: permission.role,
        permission
      };
    }

    return {
      allowed: true,
      permission
    };
  }

  /**
   * Get user's highest permission for a container
   */
  private async getUserHighestPermission(userId: string, containerType: string, containerId: string): Promise<ContainerPermission | null> {
    try {
      const results = await this.kysely
        .selectFrom('container_permission')
        .selectAll()
        .where('user_id', '=', userId)
        .where('permission_container_type', '=', containerType)
        .where('permission_container_id', '=', containerId)
        .where('status', '=', 'active')
        .where((eb) =>
          eb.or([
            eb('expires_at', 'is', null),
            eb('expires_at', '>', new Date())
          ])
        )
        .execute();

      if (results.length === 0) {
        return null;
      }

      // Convert to ContainerPermission instances and find highest
      const permissions = results.map(row => new ContainerPermission({
        id: row.id,
        user_id: row.user_id,
        permission_container_type: row.permission_container_type,
        permission_container_id: row.permission_container_id,
        role: row.role,
        granted_at: row.granted_at,
        granted_by_id: row.granted_by_id,
        expires_at: row.expires_at,
        restrictions: row.restrictions,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      return ContainerPermissionUtilities.getHighestPermission(permissions, userId, containerType, containerId);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return null;
    }
  }

  /**
   * Get all active permissions for user in organization
   */
  async getUserOrgPermissions(userId: string, orgId: string): Promise<ContainerPermission[]> {
    try {
      const results = await this.kysely
        .selectFrom('container_permission')
        .selectAll()
        .where('user_id', '=', userId)
        .where('permission_container_type', '=', 'organization')
        .where('permission_container_id', '=', orgId)
        .where('status', '=', 'active')
        .where((eb) =>
          eb.or([
            eb('expires_at', 'is', null),
            eb('expires_at', '>', new Date())
          ])
        )
        .execute();

      return results.map(row => new ContainerPermission({
        id: row.id,
        user_id: row.user_id,
        permission_container_type: row.permission_container_type,
        permission_container_id: row.permission_container_id,
        role: row.role,
        granted_at: row.granted_at,
        granted_by_id: row.granted_by_id,
        expires_at: row.expires_at,
        restrictions: row.restrictions,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('Error fetching user organization permissions:', error);
      return [];
    }
  }

  /**
   * Create a temporary permission for testing purposes
   */
  async createTestPermission(userId: string, orgId: string, role: string = 'member'): Promise<ContainerPermission> {
    const permission = ContainerPermissionUtilities.createPermission({
      user_id: userId,
      permission_container_type: 'organization',
      permission_container_id: orgId,
      role: role,
      granted_at: new Date(),
      granted_by_id: userId, // Self-granted for testing
      container_type: 'system',
      container_id: 'archetype-access-test',
      status: 'active'
    });

    const insertData = permission.prepareForInsert();
    
    const result = await this.kysely
      .insertInto('container_permission')
      .values(insertData)
      .returningAll()
      .executeTakeFirst();

    if (result) {
      return new ContainerPermission(result);
    }

    throw new Error('Failed to create test permission');
  }

  /**
   * Check archetype access and return detailed result
   */
  async checkArchetypeAccess(
    operation: 'create' | 'read' | 'write' | 'delete' | 'manage',
    userId: string,
    orgId: string,
    entityName?: string
  ): Promise<ArchetypeAccessResult> {
    switch (operation) {
      case 'create':
        return this.canCreateEntity(userId, orgId);
      case 'read':
        return this.canQueryData(userId, orgId, entityName || '');
      case 'write':
        return this.canSaveData(userId, orgId, entityName || '');
      case 'delete':
        return this.canDelete(userId, orgId, entityName || '');
      case 'manage':
        return this.canManageSchema(userId, orgId, entityName || '');
      default:
        return {
          allowed: false,
          reason: `Unknown operation: ${operation}`
        };
    }
  }

  /**
   * Generate comprehensive access summary for user across all container types
   */
  async getUserAccessSummary(userId: string, orgId: string, projectId?: string, departmentId?: string): Promise<{
    hasAccess: boolean;
    highestRole: string | null;
    highestContainer: { type: string; id: string } | null;
    permissions: {
      canCreate: boolean;
      canRead: boolean;
      canWrite: boolean;
      canDelete: boolean;
      canManage: boolean;
    };
    containerPermissions: Array<{
      containerType: string;
      containerId: string;
      role: string;
      permission: ContainerPermission;
    }>;
    details: ContainerPermission | null;
  }> {
    const containerTypes = [
      ...(projectId ? [{ type: 'project', id: projectId }] : []),
      ...(departmentId ? [{ type: 'department', id: departmentId }] : []),
      { type: 'organization', id: orgId },
      { type: 'system', id: 'global' }
    ];

    const containerPermissions = [];
    let highestPermission: ContainerPermission | null = null;
    let highestContainer: { type: string; id: string } | null = null;

    // Check all container types
    for (const container of containerTypes) {
      const permission = await this.getUserHighestPermission(userId, container.type, container.id);
      
      if (permission) {
        containerPermissions.push({
          containerType: container.type,
          containerId: container.id,
          role: permission.role,
          permission
        });

        // Track highest permission level
        if (!highestPermission || permission.getPermissionLevel() > highestPermission.getPermissionLevel()) {
          highestPermission = permission;
          highestContainer = container;
        }
      }
    }

    if (!highestPermission) {
      return {
        hasAccess: false,
        highestRole: null,
        highestContainer: null,
        permissions: {
          canCreate: false,
          canRead: false,
          canWrite: false,
          canDelete: false,
          canManage: false
        },
        containerPermissions: [],
        details: null
      };
    }

    return {
      hasAccess: true,
      highestRole: highestPermission.role,
      highestContainer,
      permissions: {
        canCreate: highestPermission.canWrite(),
        canRead: highestPermission.canRead(),
        canWrite: highestPermission.canWrite(),
        canDelete: highestPermission.canManage(),
        canManage: highestPermission.canAdminister()
      },
      containerPermissions,
      details: highestPermission
    };
  }

  /**
   * Test container permission inheritance patterns
   */
  async testPermissionInheritance(userId: string): Promise<{
    testResults: Array<{
      scenario: string;
      containerType: string;
      containerId: string;
      role: string;
      expectedInheritance: string[];
      actualPermissions: {
        canRead: boolean;
        canWrite: boolean;
        canManage: boolean;
        canAdminister: boolean;
      };
      passed: boolean;
    }>;
    summary: {
      totalTests: number;
      passed: number;
      failed: number;
    };
  }> {
    const testScenarios = [
      {
        scenario: 'System Admin Inherits Down',
        containerType: 'system',
        containerId: 'global',
        role: 'admin',
        expectedInheritance: ['organization', 'department', 'project', 'workspace']
      },
      {
        scenario: 'Organization Owner Inherits Down',
        containerType: 'organization',
        containerId: 'test-org',
        role: 'owner',
        expectedInheritance: ['department', 'project', 'workspace']
      },
      {
        scenario: 'Department Manager Inherits Down',
        containerType: 'department',
        containerId: 'test-dept',
        role: 'manager',
        expectedInheritance: ['project', 'workspace']
      },
      {
        scenario: 'Project Member Local Only',
        containerType: 'project',
        containerId: 'test-project',
        role: 'member',
        expectedInheritance: []
      }
    ];

    const testResults = [];
    
    for (const scenario of testScenarios) {
      // Create test permission
      const permission = ContainerPermissionUtilities.createPermission({
        user_id: userId,
        permission_container_type: scenario.containerType,
        permission_container_id: scenario.containerId,
        role: scenario.role,
        granted_at: new Date(),
        status: 'active'
      });

      const actualPermissions = {
        canRead: permission.canRead(),
        canWrite: permission.canWrite(),
        canManage: permission.canManage(),
        canAdminister: permission.canAdminister()
      };

      // Test passes if permission levels match expected role capabilities
      const passed = this.validatePermissionLevel(scenario.role, actualPermissions);

      testResults.push({
        scenario: scenario.scenario,
        containerType: scenario.containerType,
        containerId: scenario.containerId,
        role: scenario.role,
        expectedInheritance: scenario.expectedInheritance,
        actualPermissions,
        passed
      });
    }

    const summary = {
      totalTests: testResults.length,
      passed: testResults.filter(r => r.passed).length,
      failed: testResults.filter(r => !r.passed).length
    };

    return { testResults, summary };
  }

  private validatePermissionLevel(role: string, permissions: any): boolean {
    const expectedPermissions: Record<string, any> = {
      viewer: { canRead: true, canWrite: false, canManage: false, canAdminister: false },
      contributor: { canRead: true, canWrite: true, canManage: false, canAdminister: false },
      member: { canRead: true, canWrite: true, canManage: false, canAdminister: false },
      manager: { canRead: true, canWrite: true, canManage: true, canAdminister: false },
      admin: { canRead: true, canWrite: true, canManage: true, canAdminister: true },
      owner: { canRead: true, canWrite: true, canManage: true, canAdminister: true }
    };

    const expected = expectedPermissions[role];
    if (!expected) return false;

    return Object.keys(expected).every(key => permissions[key] === expected[key]);
  }
}