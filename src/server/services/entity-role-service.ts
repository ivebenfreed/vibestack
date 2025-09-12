/**
 * Entity Role Service
 * 
 * Handles archetype-specific role assignments using the minimum floor inheritance model.
 * Organization role provides baseline permissions, entity roles can only grant additional access.
 */

import type { Kysely } from 'kysely';
import type { HardcodedDatabase } from '../dataforge/base/hardcoded-database';

export interface EntityRole {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  role: string;
  permissions: Record<string, any>;
  grantedBy?: string;
  grantedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityPermissionCheck {
  hasAccess: boolean;
  organizationRole?: string;
  entityRole?: string;
  effectivePermissions: string[];
  source: 'organization' | 'entity' | 'combined';
}

export class EntityRoleService {
  constructor(private kysely: Kysely<HardcodedDatabase>) {}

  /**
   * Assign role to user for specific entity
   * Validates that new role doesn't violate organization minimum floor
   */
  async assignEntityRole(
    entityType: string,
    entityId: string,
    userId: string,
    role: string,
    grantedBy: string,
    permissions: Record<string, any> = {},
    expiresAt?: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user already has role for this entity
      const existingRole = await this.kysely
        .selectFrom('entity_roles')
        .selectAll()
        .where('entity_type', '=', entityType)
        .where('entity_id', '=', entityId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      const now = new Date();
      const roleData = {
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId,
        role,
        permissions: JSON.stringify(permissions),
        granted_by: grantedBy,
        granted_at: now,
        expires_at: expiresAt,
        updated_at: now
      };

      if (existingRole) {
        // Update existing role
        await this.kysely
          .updateTable('entity_roles')
          .set(roleData)
          .where('id', '=', existingRole.id)
          .execute();
      } else {
        // Create new role
        await this.kysely
          .insertInto('entity_roles')
          .values({
            id: crypto.randomUUID(),
            ...roleData,
            created_at: now
          })
          .execute();
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to assign entity role:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Role assignment failed' 
      };
    }
  }

  /**
   * Remove entity role from user
   */
  async removeEntityRole(
    entityType: string,
    entityId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.kysely
        .deleteFrom('entity_roles')
        .where('entity_type', '=', entityType)
        .where('entity_id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();

      return { success: true };
    } catch (error) {
      console.error('Failed to remove entity role:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Role removal failed' 
      };
    }
  }

  /**
   * Get user's role for specific entity
   */
  async getUserEntityRole(
    entityType: string,
    entityId: string,
    userId: string
  ): Promise<EntityRole | null> {
    try {
      const role = await this.kysely
        .selectFrom('entity_roles')
        .selectAll()
        .where('entity_type', '=', entityType)
        .where('entity_id', '=', entityId)
        .where('user_id', '=', userId)
        .where(eb => eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date())
        ]))
        .executeTakeFirst();

      if (!role) return null;

      return {
        id: role.id,
        entityType: role.entity_type,
        entityId: role.entity_id,
        userId: role.user_id,
        role: role.role,
        permissions: typeof role.permissions === 'string' 
          ? JSON.parse(role.permissions) 
          : role.permissions || {},
        grantedBy: role.granted_by || undefined,
        grantedAt: role.granted_at,
        expiresAt: role.expires_at || undefined,
        createdAt: role.created_at,
        updatedAt: role.updated_at
      };
    } catch (error) {
      console.error('Failed to get user entity role:', error);
      return null;
    }
  }

  /**
   * Get all users with roles for specific entity
   */
  async getEntityRoles(
    entityType: string,
    entityId: string
  ): Promise<Array<EntityRole & { userName: string; userEmail: string }>> {
    try {
      const roles = await this.kysely
        .selectFrom('entity_roles as er')
        .innerJoin('users as u', 'u.id', 'er.user_id')
        .select([
          'er.id',
          'er.entity_type',
          'er.entity_id', 
          'er.user_id',
          'er.role',
          'er.permissions',
          'er.granted_by',
          'er.granted_at',
          'er.expires_at',
          'er.created_at',
          'er.updated_at',
          'u.name as userName',
          'u.email as userEmail'
        ])
        .where('er.entity_type', '=', entityType)
        .where('er.entity_id', '=', entityId)
        .where(eb => eb.or([
          eb('er.expires_at', 'is', null),
          eb('er.expires_at', '>', new Date())
        ]))
        .execute();

      return roles.map(role => ({
        id: role.id,
        entityType: role.entity_type,
        entityId: role.entity_id,
        userId: role.user_id,
        role: role.role,
        permissions: typeof role.permissions === 'string' 
          ? JSON.parse(role.permissions) 
          : role.permissions || {},
        grantedBy: role.granted_by || undefined,
        grantedAt: role.granted_at,
        expiresAt: role.expires_at || undefined,
        createdAt: role.created_at,
        updatedAt: role.updated_at,
        userName: role.userName || '',
        userEmail: role.userEmail || ''
      }));
    } catch (error) {
      console.error('Failed to get entity roles:', error);
      return [];
    }
  }

  /**
   * Check if user can perform action on entity using minimum floor inheritance
   * Organization role provides baseline, entity role can elevate permissions
   */
  async checkEntityPermission(
    entityType: string,
    entityId: string,
    userId: string,
    action: string,
    organizationRole: string,
    organizationPermissions: string[]
  ): Promise<EntityPermissionCheck> {
    try {
      // 1. Start with organization baseline permissions
      let effectivePermissions = [...organizationPermissions];
      let hasAccess = organizationPermissions.includes(action);
      let source: 'organization' | 'entity' | 'combined' = 'organization';

      // 2. Check entity-specific role for additional permissions
      const entityRole = await this.getUserEntityRole(entityType, entityId, userId);
      
      if (entityRole) {
        // Get entity-specific permissions for this role
        const entityPermissions = this.getEntityRolePermissions(entityType, entityRole.role);
        
        // Combine permissions (entity can only add, not remove)
        const combinedPermissions = new Set([...effectivePermissions, ...entityPermissions]);
        effectivePermissions = Array.from(combinedPermissions);
        
        // Check if entity role grants the requested action
        if (!hasAccess && entityPermissions.includes(action)) {
          hasAccess = true;
          source = 'entity';
        } else if (hasAccess && entityPermissions.includes(action)) {
          source = 'combined';
        }
      }

      return {
        hasAccess,
        organizationRole,
        entityRole: entityRole?.role,
        effectivePermissions,
        source
      };
    } catch (error) {
      console.error('Failed to check entity permission:', error);
      return {
        hasAccess: false,
        organizationRole,
        effectivePermissions: organizationPermissions,
        source: 'organization'
      };
    }
  }

  /**
   * Get permissions for entity-specific role
   * Maps archetype roles to permission sets
   */
  private getEntityRolePermissions(entityType: string, role: string): string[] {
    const roleKey = `${entityType}:${role}`;
    
    switch (roleKey) {
      // Project archetype roles
      case 'project:owner':
        return ['project:read', 'project:write', 'project:delete', 'project:admin', 'project:share'];
      case 'project:manager':
        return ['project:read', 'project:write', 'project:admin', 'project:share'];
      case 'project:contributor':
        return ['project:read', 'project:write'];
      case 'project:viewer':
        return ['project:read'];

      // Task archetype roles  
      case 'task:owner':
        return ['task:read', 'task:write', 'task:delete', 'task:assign', 'task:review'];
      case 'task:assignee':
        return ['task:read', 'task:write', 'task:complete'];
      case 'task:reviewer':
        return ['task:read', 'task:review', 'task:approve'];
      case 'task:watcher':
        return ['task:read', 'task:comment'];

      // Document archetype roles
      case 'document:author':
        return ['document:read', 'document:write', 'document:delete', 'document:publish'];
      case 'document:editor':
        return ['document:read', 'document:write', 'document:review'];
      case 'document:reviewer':
        return ['document:read', 'document:review', 'document:comment'];
      case 'document:reader':
        return ['document:read'];

      // File archetype roles
      case 'file:manager':
        return ['file:read', 'file:write', 'file:delete', 'file:share', 'file:version'];
      case 'file:contributor':
        return ['file:read', 'file:write', 'file:version'];
      case 'file:viewer':
        return ['file:read', 'file:download'];

      // Discussion archetype roles
      case 'discussion:moderator':
        return ['discussion:read', 'discussion:write', 'discussion:delete', 'discussion:moderate'];
      case 'discussion:participant':
        return ['discussion:read', 'discussion:write', 'discussion:react'];
      case 'discussion:observer':
        return ['discussion:read'];

      default:
        return [];
    }
  }

  /**
   * Get all entity roles for a user across all entities
   */
  async getUserEntityRoles(userId: string): Promise<Array<{
    entityType: string;
    entityId: string;
    role: string;
    permissions: string[];
  }>> {
    try {
      const roles = await this.kysely
        .selectFrom('entity_roles')
        .select(['entity_type', 'entity_id', 'role'])
        .where('user_id', '=', userId)
        .where(eb => eb.or([
          eb('expires_at', 'is', null),
          eb('expires_at', '>', new Date())
        ]))
        .execute();

      return roles.map(role => ({
        entityType: role.entity_type,
        entityId: role.entity_id,
        role: role.role,
        permissions: this.getEntityRolePermissions(role.entity_type, role.role)
      }));
    } catch (error) {
      console.error('Failed to get user entity roles:', error);
      return [];
    }
  }

  /**
   * Bulk assign entity roles (for entity creation scenarios)
   */
  async bulkAssignEntityRoles(assignments: Array<{
    entityType: string;
    entityId: string;
    userId: string;
    role: string;
    grantedBy: string;
  }>): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date();
      const roleData = assignments.map(assignment => ({
        id: crypto.randomUUID(),
        entity_type: assignment.entityType,
        entity_id: assignment.entityId,
        user_id: assignment.userId,
        role: assignment.role,
        permissions: '{}',
        granted_by: assignment.grantedBy,
        granted_at: now,
        created_at: now,
        updated_at: now
      }));

      await this.kysely
        .insertInto('entity_roles')
        .values(roleData)
        .execute();

      return { success: true };
    } catch (error) {
      console.error('Failed to bulk assign entity roles:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Bulk assignment failed' 
      };
    }
  }
}