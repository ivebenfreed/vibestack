/**
 * Organization Actor Cache Integration Service
 * 
 * Provides a bridge between existing RLS middleware and the new Organization Actor SQLite cache.
 * Enables zero-latency permission checks and schema validation.
 */

import { syncLogger } from '../middleware/logger';
import type { Env } from '../types/env';

const MODULE_NAME = 'OrgActorCache';

export interface PermissionCheckParams {
  userId: string;
  resourceType: string;
  resourceId: string;
  action: string;
}

export interface SchemaColumn {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  constraints?: string;
  relationships?: string;
}

export interface CacheStats {
  permissionHits: number;
  permissionMisses: number;
  schemaHits: number;
  schemaMisses: number;
  roleHits: number;
  roleMisses: number;
}

export interface RoleInfo {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
  updatedAt: number;
}

/**
 * Organization Actor Cache Service
 * Integrates SQLite caching with existing middleware
 */
export class OrganizationActorCacheService {
  private stats: CacheStats = {
    permissionHits: 0,
    permissionMisses: 0,
    schemaHits: 0,
    schemaMisses: 0,
    roleHits: 0,
    roleMisses: 0
  };

  constructor(private env: Env) {}

  /**
   * Get Organization Actor instance for an organization
   */
  private getOrgActor(organizationId: string) {
    const orgActorId = this.env.ORGANIZATION_ACTOR.idFromName(`org:${organizationId}`);
    return this.env.ORGANIZATION_ACTOR.get(orgActorId);
  }

  /**
   * Check permission using SQLite cache (zero-latency when cached)
   */
  async checkPermission(
    organizationId: string,
    params: PermissionCheckParams
  ): Promise<{ granted: boolean; cached: boolean }> {
    try {
      const orgActor = this.getOrgActor(organizationId);
      
      const request = new Request(`https://internal/permission-check?userId=${params.userId}&resourceType=${params.resourceType}&resourceId=${params.resourceId}&action=${params.action}`, {
        method: 'GET'
      });
      
      const response = await orgActor.fetch(request);
      const result = await response.json();
      
      if (result.granted !== undefined) {
        this.stats.permissionHits++;
        return { granted: result.granted, cached: true };
      } else {
        this.stats.permissionMisses++;
        return { granted: false, cached: false };
      }
      
    } catch (error) {
      syncLogger.error('Permission cache check failed', {
        organizationId,
        params,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      this.stats.permissionMisses++;
      return { granted: false, cached: false };
    }
  }

  /**
   * Cache permission result for future zero-latency lookups
   */
  async cachePermission(
    organizationId: string,
    params: PermissionCheckParams,
    granted: boolean,
    ttlMs: number = 300000 // 5 minutes default
  ): Promise<boolean> {
    try {
      const orgActor = this.getOrgActor(organizationId);
      
      const request = new Request('https://internal/cache-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...params,
          granted,
          ttlMs
        })
      });
      
      const response = await orgActor.fetch(request);
      const result = await response.json();
      
      if (result.success) {
        syncLogger.debug('Permission cached successfully', {
          organizationId,
          userId: params.userId.substring(0, 8) + '...',
          resourceType: params.resourceType,
          action: params.action,
          granted
        }, MODULE_NAME);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      syncLogger.error('Failed to cache permission', {
        organizationId,
        params,
        granted,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return false;
    }
  }

  /**
   * Get schema from SQLite cache (instant when cached)
   */
  async getSchema(
    organizationId: string,
    tableName: string
  ): Promise<{ schema: SchemaColumn[]; cached: boolean }> {
    try {
      const orgActor = this.getOrgActor(organizationId);
      
      const request = new Request(`https://internal/schema-check?tableName=${tableName}`, {
        method: 'GET'
      });
      
      const response = await orgActor.fetch(request);
      const result = await response.json();
      
      if (result.cached && result.schema && result.schema.length > 0) {
        this.stats.schemaHits++;
        
        // Convert SQLite result to our interface
        const schema: SchemaColumn[] = result.schema.map((row: any) => ({
          columnName: row.columnName,
          dataType: row.dataType,
          isNullable: row.isNullable,
          constraints: row.constraints,
          relationships: row.relationships
        }));
        
        return { schema, cached: true };
      } else {
        this.stats.schemaMisses++;
        return { schema: [], cached: false };
      }
      
    } catch (error) {
      syncLogger.error('Schema cache check failed', {
        organizationId,
        tableName,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      this.stats.schemaMisses++;
      return { schema: [], cached: false };
    }
  }

  /**
   * Cache schema for future instant lookups
   */
  async cacheSchema(
    organizationId: string,
    tableName: string,
    columns: SchemaColumn[],
    schemaVersion: number = 1
  ): Promise<boolean> {
    try {
      const orgActor = this.getOrgActor(organizationId);
      
      const request = new Request('https://internal/cache-schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tableName,
          columns,
          schemaVersion
        })
      });
      
      const response = await orgActor.fetch(request);
      const result = await response.json();
      
      if (result.success) {
        syncLogger.info('Schema cached successfully', {
          organizationId,
          tableName,
          columnCount: columns.length,
          schemaVersion
        }, MODULE_NAME);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      syncLogger.error('Failed to cache schema', {
        organizationId,
        tableName,
        columnCount: columns.length,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return false;
    }
  }

  /**
   * Combined permission check with automatic caching
   * First checks cache, then PostgreSQL if needed, then caches the result
   */
  async checkAndCachePermission(
    organizationId: string,
    params: PermissionCheckParams,
    postgresqlFetcher: () => Promise<boolean>,
    ttlMs: number = 300000
  ): Promise<boolean> {
    // First try cache
    const cacheResult = await this.checkPermission(organizationId, params);
    
    if (cacheResult.cached) {
      syncLogger.debug('Permission served from cache', {
        organizationId,
        userId: params.userId.substring(0, 8) + '...',
        action: params.action,
        granted: cacheResult.granted
      }, MODULE_NAME);
      
      return cacheResult.granted;
    }
    
    // Cache miss - fetch from PostgreSQL
    syncLogger.debug('Permission cache miss, fetching from PostgreSQL', {
      organizationId,
      userId: params.userId.substring(0, 8) + '...',
      action: params.action
    }, MODULE_NAME);
    
    try {
      const granted = await postgresqlFetcher();
      
      // Cache the result for future lookups
      await this.cachePermission(organizationId, params, granted, ttlMs);
      
      return granted;
      
    } catch (error) {
      syncLogger.error('PostgreSQL permission check failed', {
        organizationId,
        params,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return false;
    }
  }

  /**
   * Combined schema check with automatic caching
   * First checks cache, then PostgreSQL if needed, then caches the result
   */
  async getAndCacheSchema(
    organizationId: string,
    tableName: string,
    postgresqlFetcher: () => Promise<SchemaColumn[]>,
    schemaVersion: number = 1
  ): Promise<SchemaColumn[]> {
    // First try cache
    const cacheResult = await this.getSchema(organizationId, tableName);
    
    if (cacheResult.cached && cacheResult.schema.length > 0) {
      syncLogger.debug('Schema served from cache', {
        organizationId,
        tableName,
        columnCount: cacheResult.schema.length
      }, MODULE_NAME);
      
      return cacheResult.schema;
    }
    
    // Cache miss - fetch from PostgreSQL
    syncLogger.debug('Schema cache miss, fetching from PostgreSQL', {
      organizationId,
      tableName
    }, MODULE_NAME);
    
    try {
      const schema = await postgresqlFetcher();
      
      // Cache the result for future lookups
      if (schema.length > 0) {
        await this.cacheSchema(organizationId, tableName, schema, schemaVersion);
      }
      
      return schema;
      
    } catch (error) {
      syncLogger.error('PostgreSQL schema fetch failed', {
        organizationId,
        tableName,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      permissionHits: 0,
      permissionMisses: 0,
      schemaHits: 0,
      schemaMisses: 0
    };
  }

  /**
   * Get user role using SQLite cache (zero-latency when cached)
   */
  async getRole(
    organizationId: string,
    userId: string
  ): Promise<{ role: RoleInfo | null; cached: boolean }> {
    try {
      const orgActor = this.getOrgActor(organizationId);
      
      const request = new Request(`https://internal/role-check?userId=${userId}&organizationId=${organizationId}`, {
        method: 'GET'
      });
      
      const response = await orgActor.fetch(request);
      const result = await response.json();
      
      if (result.cached && result.role) {
        this.stats.roleHits++;
        return { role: result.role, cached: true };
      } else {
        this.stats.roleMisses++;
        return { role: null, cached: false };
      }
      
    } catch (error) {
      syncLogger.error('Role cache check failed', {
        organizationId,
        userId: userId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      this.stats.roleMisses++;
      return { role: null, cached: false };
    }
  }

  /**
   * Cache user role for future zero-latency lookups
   */
  async cacheRole(
    organizationId: string,
    userId: string,
    role: string,
    permissions: string[]
  ): Promise<boolean> {
    try {
      const orgActor = this.getOrgActor(organizationId);
      
      const request = new Request('https://internal/cache-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          organizationId,
          role,
          permissions
        })
      });
      
      const response = await orgActor.fetch(request);
      const result = await response.json();
      
      if (result.success) {
        syncLogger.debug('Role cached successfully', {
          organizationId,
          userId: userId.substring(0, 8) + '...',
          role,
          permissionCount: permissions.length
        }, MODULE_NAME);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      syncLogger.error('Failed to cache role', {
        organizationId,
        userId: userId.substring(0, 8) + '...',
        role,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return false;
    }
  }

  /**
   * Invalidate user role cache (when role changes)
   */
  async invalidateRole(
    organizationId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const orgActor = this.getOrgActor(organizationId);
      
      const request = new Request('https://internal/invalidate-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          organizationId
        })
      });
      
      const response = await orgActor.fetch(request);
      const result = await response.json();
      
      if (result.success) {
        syncLogger.info('Role cache invalidated successfully', {
          organizationId,
          userId: userId.substring(0, 8) + '...'
        }, MODULE_NAME);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      syncLogger.error('Failed to invalidate role cache', {
        organizationId,
        userId: userId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return false;
    }
  }

  /**
   * Bulk cache roles for multiple users (cache warming)
   */
  async bulkCacheRoles(
    organizationId: string,
    roles: Array<{
      userId: string;
      role: string;
      permissions: string[];
    }>
  ): Promise<{ successCount: number; totalCount: number }> {
    try {
      const orgActor = this.getOrgActor(organizationId);
      
      const rolesWithOrgId = roles.map(role => ({
        ...role,
        organizationId
      }));
      
      const request = new Request('https://internal/bulk-cache-roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roles: rolesWithOrgId
        })
      });
      
      const response = await orgActor.fetch(request);
      const result = await response.json();
      
      if (result.success) {
        syncLogger.info('Bulk role cache completed', {
          organizationId,
          totalRoles: result.totalRoles,
          successCount: result.successCount
        }, MODULE_NAME);
        
        return {
          successCount: result.successCount,
          totalCount: result.totalRoles
        };
      }
      
      return { successCount: 0, totalCount: roles.length };
      
    } catch (error) {
      syncLogger.error('Failed to bulk cache roles', {
        organizationId,
        roleCount: roles.length,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return { successCount: 0, totalCount: roles.length };
    }
  }

  /**
   * Combined role check with automatic caching
   * First checks cache, then PostgreSQL if needed, then caches the result
   */
  async getAndCacheRole(
    organizationId: string,
    userId: string,
    postgresqlFetcher: () => Promise<{ role: string; permissions: string[] } | null>
  ): Promise<RoleInfo | null> {
    // First try cache
    const cacheResult = await this.getRole(organizationId, userId);
    
    if (cacheResult.cached && cacheResult.role) {
      syncLogger.debug('Role served from cache', {
        organizationId,
        userId: userId.substring(0, 8) + '...',
        role: cacheResult.role.role
      }, MODULE_NAME);
      
      return cacheResult.role;
    }
    
    // Cache miss - fetch from PostgreSQL
    syncLogger.debug('Role cache miss, fetching from PostgreSQL', {
      organizationId,
      userId: userId.substring(0, 8) + '...'
    }, MODULE_NAME);
    
    try {
      const roleData = await postgresqlFetcher();
      
      if (roleData) {
        // Cache the result for future lookups
        await this.cacheRole(organizationId, userId, roleData.role, roleData.permissions);
        
        return {
          userId,
          organizationId,
          role: roleData.role,
          permissions: roleData.permissions,
          updatedAt: Date.now()
        };
      }
      
      return null;
      
    } catch (error) {
      syncLogger.error('PostgreSQL role fetch failed', {
        organizationId,
        userId: userId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return null;
    }
  }

  /**
   * Calculate cache hit rates
   */
  getCacheEfficiency(): { permissionHitRate: number; schemaHitRate: number; roleHitRate: number } {
    const totalPermissionChecks = this.stats.permissionHits + this.stats.permissionMisses;
    const totalSchemaChecks = this.stats.schemaHits + this.stats.schemaMisses;
    const totalRoleChecks = this.stats.roleHits + this.stats.roleMisses;
    
    return {
      permissionHitRate: totalPermissionChecks > 0 ? this.stats.permissionHits / totalPermissionChecks : 0,
      schemaHitRate: totalSchemaChecks > 0 ? this.stats.schemaHits / totalSchemaChecks : 0,
      roleHitRate: totalRoleChecks > 0 ? this.stats.roleHits / totalRoleChecks : 0
    };
  }
}

/**
 * Create Organization Actor Cache Service instance
 */
export function createOrgActorCache(env: Env): OrganizationActorCacheService {
  return new OrganizationActorCacheService(env);
}