import { BaseDomainEntity } from '../../entities/BaseDomainEntity.js';

/**
 * Abstract base class for archetype-specific access control services
 * Provides common permission checking patterns for all archetype entities
 * Co-located with entities for type safety and maintainability
 */
export abstract class ArchetypeAccessControlService<T extends BaseDomainEntity> {
  /**
   * Check if a user can read an entity
   * @param userId - The user attempting to read
   * @param entity - The entity being accessed
   * @param context - Additional context (organization, request info, etc.)
   */
  abstract canRead(userId: string, entity: T, context?: AccessContext): boolean;

  /**
   * Check if a user can write/update an entity
   * @param userId - The user attempting to write
   * @param entity - The entity being modified
   * @param context - Additional context
   */
  abstract canWrite(userId: string, entity: T, context?: AccessContext): boolean;

  /**
   * Check if a user can delete an entity
   * @param userId - The user attempting to delete
   * @param entity - The entity being deleted
   * @param context - Additional context
   */
  abstract canDelete(userId: string, entity: T, context?: AccessContext): boolean;

  /**
   * Check if a user can perform admin operations on an entity
   * @param userId - The user attempting admin operations
   * @param entity - The entity being administered
   * @param context - Additional context
   */
  abstract canAdmin(userId: string, entity: T, context?: AccessContext): boolean;

  /**
   * Filter entity fields based on user permissions
   * Removes sensitive fields that the user shouldn't see
   * @param userId - The user accessing the entity
   * @param entity - The entity being filtered
   * @param context - Additional context
   */
  abstract filterFields(userId: string, entity: T, context?: AccessContext): Partial<T>;

  // Common helper methods that all archetype services can use

  /**
   * Check if user is in the same organization as the entity
   * @param userId - User to check
   * @param entity - Entity to check against
   * @param context - Access context with organization info
   */
  protected isOrganizationMember(userId: string, entity: T, context?: AccessContext): boolean {
    // Basic organization membership check
    // In production, this would validate against organization membership
    return context?.organizationId ? true : false;
  }

  /**
   * Check if user has a specific role in the organization
   * @param userId - User to check
   * @param requiredRoles - Roles that grant access
   * @param context - Access context with user roles
   */
  protected hasOrganizationRole(userId: string, requiredRoles: string[], context?: AccessContext): boolean {
    if (!context?.userRoles) return false;
    return requiredRoles.some(role => context.userRoles!.includes(role));
  }

  /**
   * Check if user is the owner/creator of the entity
   * @param userId - User to check
   * @param entity - Entity to check ownership
   */
  protected isEntityOwner(userId: string, entity: T): boolean {
    // Check common ownership patterns
    const entityAny = entity as any;
    return entityAny.ownerId === userId || 
           entityAny.createdBy === userId || 
           entityAny.authorId === userId;
  }

  /**
   * Check if entity allows public/open access
   * @param entity - Entity to check
   */
  protected isPubliclyAccessible(entity: T): boolean {
    const entityAny = entity as any;
    return entityAny.visibility === 'public' || 
           entityAny.accessLevel === 'public' ||
           entityAny.isPublic === true;
  }

  /**
   * Get the container type for the entity (project, department, etc.)
   * @param entity - Entity to get container for
   */
  protected getEntityContainer(entity: T): ContainerInfo | null {
    return {
      type: entity.containerType,
      id: entity.containerId
    };
  }

  /**
   * Check if user has container-level permissions
   * @param userId - User to check
   * @param container - Container information
   * @param permission - Required permission level
   * @param context - Access context
   */
  protected hasContainerPermission(
    userId: string, 
    container: ContainerInfo | null, 
    permission: PermissionLevel,
    context?: AccessContext
  ): boolean {
    if (!container) return false;
    
    // In production, this would check ContainerPermission entities
    // For now, return basic logic based on context
    return context?.containerPermissions?.[container.id]?.includes(permission) || false;
  }

  /**
   * Apply field-level filtering based on user roles and permissions
   * @param fields - Raw entity fields
   * @param userPermissions - User's permission set
   * @param sensitiveFields - Fields that require special permissions
   */
  protected applySensitiveFieldFiltering<F extends Record<string, any>>(
    fields: F,
    userPermissions: string[],
    sensitiveFields: SensitiveFieldConfig[]
  ): Partial<F> {
    const filtered = { ...fields };

    sensitiveFields.forEach(config => {
      const hasRequiredPermission = config.requiredPermissions.some(perm => 
        userPermissions.includes(perm)
      );

      if (!hasRequiredPermission) {
        delete filtered[config.fieldName as keyof F];
      }
    });

    return filtered;
  }
}

/**
 * Context information passed to access control methods
 */
export interface AccessContext {
  /** Organization ID the request is scoped to */
  organizationId?: string;
  /** User's roles in the organization */
  userRoles?: string[];
  /** User's container permissions */
  containerPermissions?: Record<string, PermissionLevel[]>;
  /** Request metadata (IP, user agent, etc.) */
  requestMetadata?: {
    ipAddress?: string;
    userAgent?: string;
    timestamp?: Date;
  };
  /** Additional context specific to the operation */
  operationContext?: Record<string, any>;
}

/**
 * Container information for permission checking
 */
export interface ContainerInfo {
  type: string;
  id: string;
}

/**
 * Permission levels for access control
 */
export type PermissionLevel = 'read' | 'write' | 'delete' | 'admin' | 'owner';

/**
 * Configuration for sensitive field filtering
 */
export interface SensitiveFieldConfig {
  fieldName: string;
  requiredPermissions: string[];
  description?: string;
}