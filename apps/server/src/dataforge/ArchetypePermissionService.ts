/**
 * Archetype Permission Service
 * 
 * Integrates archetype-specific container permissions with the DataForge API.
 * Provides centralized permission checking based on archetype business logic.
 */

import { ArchetypeRegistry, type ArchetypeType } from './ArchetypeRegistry';
import { ContainerPermissionEngine, type ContainerContext, type AccessOperation } from './container-permissions';
import type { HybridSecurityContext } from '../middleware/hybrid-rls-org-actor';

export interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
  archetype: ArchetypeType;
  operation: AccessOperation;
  appliedRule?: string;
}

/**
 * Archetype Permission Service
 * Handles archetype-specific permission checking for DataForge operations
 */
export class ArchetypePermissionService {
  private permissionEngine: ContainerPermissionEngine;

  constructor() {
    this.permissionEngine = new ContainerPermissionEngine();
  }

  /**
   * Check if user can perform operation on entity based on its archetype
   */
  async checkPermission(
    archetype: ArchetypeType,
    operation: AccessOperation,
    entityRecord: any,
    securityContext: HybridSecurityContext,
    parentEntity?: any
  ): Promise<PermissionCheckResult> {
    // Get archetype definition
    const archetypeClass = ArchetypeRegistry.getArchetypeClass(archetype);
    if (!archetypeClass || !archetypeClass.containerPermissions) {
      return {
        allowed: false,
        reason: `Archetype ${archetype} not found or missing container permissions`,
        archetype,
        operation
      };
    }

    const containerPermissions = archetypeClass.containerPermissions;
    
    // Build container context
    const context: ContainerContext = {
      organizationId: securityContext.organizationId,
      userId: securityContext.userId,
      userRole: securityContext.roleInfo?.role || 'viewer',
      userPermissions: securityContext.roleInfo?.permissions || [],
      entityRecord,
      parentEntity,
      containerMemberships: [] // TODO: Implement container membership lookup
    };

    // Check permission using archetype-specific rules
    const result = await this.permissionEngine.checkAccess(
      containerPermissions,
      operation,
      context
    );

    return {
      allowed: result.allowed,
      reason: result.reason,
      archetype,
      operation,
      appliedRule: result.appliedRule?.description
    };
  }

  /**
   * Bulk permission check for multiple entities
   */
  async checkBulkPermissions(
    archetype: ArchetypeType,
    operation: AccessOperation,
    entityRecords: any[],
    securityContext: HybridSecurityContext
  ): Promise<{
    allowed: any[];
    denied: any[];
    results: PermissionCheckResult[];
  }> {
    const results = await Promise.all(
      entityRecords.map(record => 
        this.checkPermission(archetype, operation, record, securityContext)
      )
    );

    const allowed = entityRecords.filter((_, index) => results[index].allowed);
    const denied = entityRecords.filter((_, index) => !results[index].allowed);

    return { allowed, denied, results };
  }

  /**
   * Get permission summary for archetype
   */
  getArchetypePermissionSummary(archetype: ArchetypeType): {
    model: string;
    accessScope: string;
    allowsMultipleContainers: boolean;
    inheritsFromParent: boolean;
  } | null {
    const archetypeClass = ArchetypeRegistry.getArchetypeClass(archetype);
    if (!archetypeClass?.containerPermissions) {
      return null;
    }

    const permissions = archetypeClass.containerPermissions;
    return {
      model: permissions.model,
      accessScope: permissions.accessScope,
      allowsMultipleContainers: permissions.allowsMultipleContainers,
      inheritsFromParent: permissions.inheritsFromParent
    };
  }

  /**
   * Filter entities based on read permissions
   */
  async filterReadableEntities(
    archetype: ArchetypeType,
    entities: any[],
    securityContext: HybridSecurityContext
  ): Promise<any[]> {
    const bulkResult = await this.checkBulkPermissions(
      archetype,
      'read',
      entities,
      securityContext
    );

    return bulkResult.allowed;
  }

  /**
   * Check if user can create entity of specific archetype
   */
  async canCreate(
    archetype: ArchetypeType,
    entityData: any,
    securityContext: HybridSecurityContext
  ): Promise<PermissionCheckResult> {
    // For create operations, we check write permissions on a mock entity
    const mockEntity = {
      ...entityData,
      id: 'new',
      organization_id: securityContext.organizationId,
      created_by: securityContext.userId,
      owner_id: entityData.owner_id || securityContext.userId
    };

    return this.checkPermission(archetype, 'write', mockEntity, securityContext);
  }

  /**
   * Validate archetype permissions configuration
   */
  validateArchetypePermissions(): {
    valid: boolean;
    issues: string[];
    archetypes: { [key in ArchetypeType]?: boolean };
  } {
    const issues: string[] = [];
    const archetypeStatus: { [key in ArchetypeType]?: boolean } = {};

    for (const archetypeName of Object.keys(ArchetypeRegistry['archetypeClasses']) as ArchetypeType[]) {
      const archetypeClass = ArchetypeRegistry.getArchetypeClass(archetypeName);
      
      if (!archetypeClass) {
        issues.push(`Archetype class not found: ${archetypeName}`);
        archetypeStatus[archetypeName] = false;
        continue;
      }

      if (!archetypeClass.containerPermissions) {
        issues.push(`Missing container permissions: ${archetypeName}`);
        archetypeStatus[archetypeName] = false;
        continue;
      }

      const permissions = archetypeClass.containerPermissions;
      
      // Validate required properties
      if (!permissions.model) {
        issues.push(`Missing permission model: ${archetypeName}`);
        archetypeStatus[archetypeName] = false;
        continue;
      }

      if (!permissions.readAccess || !permissions.writeAccess || !permissions.deleteAccess) {
        issues.push(`Missing access rules: ${archetypeName}`);
        archetypeStatus[archetypeName] = false;
        continue;
      }

      archetypeStatus[archetypeName] = true;
    }

    return {
      valid: issues.length === 0,
      issues,
      archetypes: archetypeStatus
    };
  }
}

/**
 * Global instance for use across DataForge API
 */
export const archetypePermissionService = new ArchetypePermissionService();