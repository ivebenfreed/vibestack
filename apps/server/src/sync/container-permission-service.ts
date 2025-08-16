/**
 * Container Permission Service for Sync System
 * 
 * Integrates the ContainerPermission entity with sync operations
 * to provide fine-grained, container-based access control.
 */

import type { Kysely } from 'kysely';
import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'ContainerPermissionService';

export interface UserContainerAccess {
  userId: string;
  containerType: string;
  containerId: string;
  role: string;
  permissionLevel: number;
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
  canAdminister: boolean;
  restrictions: Record<string, any>;
  expiresAt: Date | null;
}

export interface TableAccessResult {
  hasAccess: boolean;
  tableName: string;
  containerPermissions: UserContainerAccess[];
  effectiveRole: string | null;
  reason?: string;
}

export class ContainerPermissionService {
  constructor(private kysely: Kysely<any>) {}

  /**
   * Get all active container permissions for a user in an organization
   */
  async getUserContainerPermissions(
    userId: string, 
    organizationId: string
  ): Promise<UserContainerAccess[]> {
    try {
      const permissions = await this.kysely
        .selectFrom('container_permission as cp')
        .select([
          'cp.user_id as userId',
          'cp.permission_container_type as containerType', 
          'cp.permission_container_id as containerId',
          'cp.role',
          'cp.restrictions',
          'cp.expires_at as expiresAt'
        ])
        .where('cp.user_id', '=', userId)
        .where('cp.status', '=', 'active')
        .where((eb) => 
          eb.or([
            eb('cp.expires_at', 'is', null),
            eb('cp.expires_at', '>', new Date())
          ])
        )
        .execute();

      return permissions.map(p => ({
        userId: p.userId,
        containerType: p.containerType,
        containerId: p.containerId,
        role: p.role,
        permissionLevel: this.getPermissionLevel(p.role),
        canRead: this.canRead(p.role),
        canWrite: this.canWrite(p.role),
        canManage: this.canManage(p.role),
        canAdminister: this.canAdminister(p.role),
        restrictions: p.restrictions || {},
        expiresAt: p.expiresAt
      }));

    } catch (error) {
      syncLogger.error('Failed to get user container permissions', {
        userId,
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Check if user has access to a specific table based on container permissions
   */
  async checkTableAccess(
    userId: string,
    organizationId: string,
    tableName: string,
    action: 'read' | 'write' = 'read'
  ): Promise<TableAccessResult> {
    try {
      // Get all container permissions for user
      const permissions = await this.getUserContainerPermissions(userId, organizationId);
      
      if (permissions.length === 0) {
        return {
          hasAccess: false,
          tableName,
          containerPermissions: [],
          effectiveRole: null,
          reason: 'No container permissions found for user'
        };
      }

      // Extract container info from table name
      const tableInfo = this.parseTableName(tableName, organizationId);
      
      // Find relevant permissions for this table's container
      const relevantPermissions = permissions.filter(p => {
        // Check if permission applies to this table's container
        if (tableInfo.containerType && tableInfo.containerId) {
          return p.containerType === tableInfo.containerType && p.containerId === tableInfo.containerId;
        }
        
        // For org-level tables, check organization permissions
        if (tableInfo.isOrgLevel) {
          return p.containerType === 'organization' && p.containerId === organizationId;
        }
        
        return false;
      });

      if (relevantPermissions.length === 0) {
        return {
          hasAccess: false,
          tableName,
          containerPermissions: permissions,
          effectiveRole: null,
          reason: `No container permissions for ${tableInfo.containerType}:${tableInfo.containerId}`
        };
      }

      // Get highest permission level
      const highestPermission = relevantPermissions.reduce((highest, current) => 
        current.permissionLevel > highest.permissionLevel ? current : highest
      );

      // Check if user can perform the requested action
      const hasAccess = action === 'read' ? highestPermission.canRead : highestPermission.canWrite;

      return {
        hasAccess,
        tableName,
        containerPermissions: relevantPermissions,
        effectiveRole: highestPermission.role,
        reason: hasAccess ? undefined : `Insufficient permissions for ${action} on ${tableName}`
      };

    } catch (error) {
      syncLogger.error('Failed to check table access', {
        userId,
        organizationId,
        tableName,
        action,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      return {
        hasAccess: false,
        tableName,
        containerPermissions: [],
        effectiveRole: null,
        reason: 'Error checking permissions'
      };
    }
  }

  /**
   * Filter tables based on user's container permissions
   */
  async filterTablesForUser(
    userId: string,
    organizationId: string,
    tables: string[],
    action: 'read' | 'write' = 'read'
  ): Promise<string[]> {
    const allowedTables: string[] = [];

    for (const table of tables) {
      const access = await this.checkTableAccess(userId, organizationId, table, action);
      if (access.hasAccess) {
        allowedTables.push(table);
      } else {
        syncLogger.debug('Table access denied', {
          userId,
          organizationId,
          table,
          action,
          reason: access.reason
        }, MODULE_NAME);
      }
    }

    syncLogger.info('Filtered tables by container permissions', {
      userId,
      organizationId,
      originalCount: tables.length,
      allowedCount: allowedTables.length,
      action
    }, MODULE_NAME);

    return allowedTables;
  }

  /**
   * Parse table name to extract container information
   */
  private parseTableName(tableName: string, organizationId: string): {
    isOrgLevel: boolean;
    containerType: string | null;
    containerId: string | null;
    entityName: string | null;
  } {
    // Check if it's an organization-specific table
    const orgPrefix = `org_${organizationId.replace(/-/g, '_')}_`;
    
    if (tableName.startsWith(orgPrefix)) {
      // Extract entity name from org table
      const entityName = tableName.substring(orgPrefix.length);
      
      // For now, treat all org tables as project-level containers
      // In the future, we could have more sophisticated parsing
      // e.g., org_uuid_project_uuid_task vs org_uuid_workspace_uuid_doc
      
      if (entityName.includes('project')) {
        return {
          isOrgLevel: false,
          containerType: 'project',
          containerId: null, // We'd need to extract from record data
          entityName
        };
      } else if (entityName.includes('workspace')) {
        return {
          isOrgLevel: false,
          containerType: 'workspace', 
          containerId: null,
          entityName
        };
      } else {
        // Default to organization level for org tables
        return {
          isOrgLevel: true,
          containerType: 'organization',
          containerId: organizationId,
          entityName
        };
      }
    }

    // Base system tables (organization, session, account, verification)
    return {
      isOrgLevel: true,
      containerType: 'organization',
      containerId: organizationId,
      entityName: tableName
    };
  }

  /**
   * Get numeric permission level for role
   */
  private getPermissionLevel(role: string): number {
    const levels = {
      viewer: 10,
      contributor: 20,
      member: 30,
      manager: 40,
      admin: 50,
      owner: 60
    };
    return levels[role as keyof typeof levels] || 0;
  }

  /**
   * Check if role can read
   */
  private canRead(role: string): boolean {
    return this.getPermissionLevel(role) >= 10; // viewer and above
  }

  /**
   * Check if role can write
   */
  private canWrite(role: string): boolean {
    return this.getPermissionLevel(role) >= 20; // contributor and above
  }

  /**
   * Check if role can manage
   */
  private canManage(role: string): boolean {
    return this.getPermissionLevel(role) >= 40; // manager and above
  }

  /**
   * Check if role can administer
   */
  private canAdminister(role: string): boolean {
    return this.getPermissionLevel(role) >= 50; // admin and above
  }

  /**
   * Create container permissions for a user in a project
   */
  async grantProjectAccess(
    userId: string,
    projectId: string,
    role: string,
    grantedBy?: string
  ): Promise<boolean> {
    try {
      const permissionId = crypto.randomUUID();
      
      await this.kysely
        .insertInto('container_permission')
        .values({
          id: permissionId,
          user_id: userId,
          permission_container_type: 'project',
          permission_container_id: projectId,
          role,
          granted_at: new Date(),
          granted_by_id: grantedBy,
          expires_at: null,
          restrictions: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          archetype: 'permission',
          container_type: 'system',
          container_id: 'permissions'
        })
        .execute();

      syncLogger.info('Granted project access', {
        userId,
        projectId,
        role,
        grantedBy
      }, MODULE_NAME);

      return true;
    } catch (error) {
      syncLogger.error('Failed to grant project access', {
        userId,
        projectId,
        role,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return false;
    }
  }

  /**
   * Create organization-level container permissions for a user
   */
  async grantOrganizationAccess(
    userId: string,
    organizationId: string,
    role: string,
    grantedBy?: string
  ): Promise<boolean> {
    try {
      const permissionId = crypto.randomUUID();
      
      await this.kysely
        .insertInto('container_permission')
        .values({
          id: permissionId,
          user_id: userId,
          permission_container_type: 'organization',
          permission_container_id: organizationId,
          role,
          granted_at: new Date(),
          granted_by_id: grantedBy,
          expires_at: null,
          restrictions: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          archetype: 'permission',
          container_type: 'system',
          container_id: 'permissions'
        })
        .execute();

      syncLogger.info('Granted organization access', {
        userId,
        organizationId,
        role,
        grantedBy
      }, MODULE_NAME);

      return true;
    } catch (error) {
      syncLogger.error('Failed to grant organization access', {
        userId,
        organizationId,
        role,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return false;
    }
  }
}