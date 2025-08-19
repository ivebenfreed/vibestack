/**
 * Centralized Sync Table Registry
 * 
 * Provides a single source of truth for all trackable tables across the entire sync system.
 * Handles dynamic discovery of organization-specific tables and caching.
 */

import { syncLogger } from '../middleware/logger';
import type { Kysely } from 'kysely';
import { ContainerPermissionService } from './container-permission-service';

const MODULE_NAME = 'sync-table-registry';

// Base system tables (always tracked) - excluding sensitive auth/session data
const BASE_TRACKED_TABLES = [
  'organization'  // Only organization data is safe to sync to clients
  // Removed: 'session', 'account', 'verification' - these should never be synced to clients
];

// System tables (never tracked) - includes sensitive auth/session data
const SYSTEM_TABLES = [
  'change_history',
  'sync_statistics', 
  'system_logs',
  'replication_slot_status',
  // Authentication/session tables - never sync these to clients
  'session',
  'account', 
  'verification',
  'user'  // User data should also not be bulk synced
];

export interface SyncTableRegistry {
  getAllTrackableTables(): Promise<string[]>;
  getOrgSpecificTables(organizationId: string): Promise<string[]>;
  getTablesForOrganization(organizationId: string): Promise<string[]>;
  getTablesForUser(userId: string, organizationId: string, action?: 'read' | 'write'): Promise<string[]>;
  refreshTableCache(): Promise<void>;
  isTrackableTable(tableName: string): Promise<boolean>;
  setKyselyDb(db: any): void;
}

class SyncTableRegistryImpl implements SyncTableRegistry {
  private tableCache: string[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private kyselyDb: any = null;
  private containerPermissionService: ContainerPermissionService | null = null;

  constructor(
    private env: any
  ) {}

  setKyselyDb(db: any): void {
    this.kyselyDb = db;
    this.containerPermissionService = new ContainerPermissionService(db);
  }

  /**
   * Get all trackable tables (base + all org-specific tables)
   * WARNING: This should only be used for system-level operations
   * For organization-specific operations, use getTablesForOrganization()
   */
  async getAllTrackableTables(): Promise<string[]> {
    if (this.tableCache && Date.now() < this.cacheExpiry) {
      return this.tableCache;
    }

    try {
      // Discover all organization-specific tables from database
      const orgTables = await this.discoverOrgTables();
      
      // Combine base tables with discovered org tables
      const allTables = [...BASE_TRACKED_TABLES, ...orgTables];
      
      // Cache the results
      this.tableCache = allTables;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      
      syncLogger.info(`Discovered ${allTables.length} trackable tables`, {
        baseTables: BASE_TRACKED_TABLES.length,
        orgTables: orgTables.length,
        total: allTables.length
      }, MODULE_NAME);
      
      return allTables;
      
    } catch (error) {
      syncLogger.error('Failed to discover trackable tables', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Fallback to base tables only
      return BASE_TRACKED_TABLES;
    }
  }

  /**
   * Get organization-specific tables for a specific org
   * CRITICAL: This method NEVER uses global cache - it queries directly for the org
   */
  async getOrgSpecificTables(organizationId: string): Promise<string[]> {
    if (!organizationId) {
      throw new Error('Organization ID is required for sync operations');
    }

    // Convert org ID to table prefix format
    const tablePrefix = `org_${organizationId.replace(/-/g, '_')}_`;
    
    console.log(`DEBUG: Looking for tables with prefix: ${tablePrefix}`);

    try {
      if (!this.kyselyDb) {
        console.warn('DEBUG: No Kysely database available, cannot discover org tables');
        return [];
      }

      // Query database DIRECTLY for this organization's tables only
      const result = await this.kyselyDb
        .selectFrom('information_schema.tables')
        .select('table_name')
        .where('table_schema', '=', 'public')
        .where('table_name', 'like', `${tablePrefix}%`)
        .orderBy('table_name')
        .execute();
      
      const orgTables = result.map(row => row.table_name);
      
      console.log(`DEBUG: Found ${orgTables.length} tables for org ${organizationId}:`, orgTables);
      
      return orgTables;
      
    } catch (error) {
      console.error(`DEBUG: Error discovering tables for org ${organizationId}:`, error);
      return [];
    }
  }

  /**
   * Get all tables that an organization should see (only their org-specific business tables)
   * Returns tables in dependency order for safe initial sync
   */
  async getTablesForOrganization(organizationId: string): Promise<string[]> {
    const orgTables = await this.getOrgSpecificTables(organizationId);
    
    // Order tables by dependencies (parent entities first, junction tables last)
    const orderedTables = this.orderTablesByDependencies(orgTables, organizationId);
    
    console.log(`DEBUG: Found ${orgTables.length} business tables for organization ${organizationId}:`);
    console.log('DEBUG: Dependency-ordered tables:', orderedTables);  
    
    syncLogger.debug(`Found ${orgTables.length} business tables for organization`, {
      organizationId,
      businessTables: orgTables.length,
      tables: orderedTables,
      originalOrder: orgTables
    }, MODULE_NAME);
    
    return orderedTables;
  }

  /**
   * Get tables that a specific user can access based on container permissions
   */
  async getTablesForUser(
    userId: string, 
    organizationId: string, 
    action: 'read' | 'write' = 'read'
  ): Promise<string[]> {
    if (!this.containerPermissionService) {
      syncLogger.warn('Container permission service not available, falling back to organization tables', {
        userId,
        organizationId
      }, MODULE_NAME);
      return this.getTablesForOrganization(organizationId);
    }

    try {
      // Get all organization tables first
      const orgTables = await this.getTablesForOrganization(organizationId);
      
      // Filter based on container permissions
      const allowedTables = await this.containerPermissionService.filterTablesForUser(
        userId,
        organizationId,
        orgTables,
        action
      );

      console.log(`DEBUG: Container permission filtering for user ${userId}:`);
      console.log(`DEBUG: Original tables: ${orgTables.length}`);
      console.log(`DEBUG: Allowed tables: ${allowedTables.length}`);
      console.log('DEBUG: Allowed tables:', allowedTables);

      syncLogger.info('Applied container permission filtering', {
        userId,
        organizationId,
        action,
        originalCount: orgTables.length,
        allowedCount: allowedTables.length,
        tables: allowedTables
      }, MODULE_NAME);

      return allowedTables;

    } catch (error) {
      syncLogger.error('Failed to get user tables with container permissions', {
        userId,
        organizationId,
        action,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      // Fallback to organization tables on error
      return this.getTablesForOrganization(organizationId);
    }
  }

  /**
   * Check if a specific table should be tracked
   */
  async isTrackableTable(tableName: string): Promise<boolean> {
    const allTables = await this.getAllTrackableTables();
    return allTables.includes(tableName);
  }

  /**
   * Force refresh of the table cache
   */
  async refreshTableCache(): Promise<void> {
    this.tableCache = null;
    this.cacheExpiry = 0;
    await this.getAllTrackableTables();
  }

  /**
   * Discover organization-specific tables from the database
   */
  private async discoverOrgTables(): Promise<string[]> {
    console.log('DEBUG: Discovering org tables dynamically...');
    
    try {
      if (!this.kyselyDb) {
        console.warn('DEBUG: No Kysely database available, falling back to hardcoded tables');
        return this.getHardcodedOrgTables();
      }

      // Query information_schema for all org-specific tables
      const result = await this.kyselyDb
        .selectFrom('information_schema.tables')
        .select('table_name')
        .where('table_schema', '=', 'public')
        .where('table_name', 'like', 'org_%')
        .orderBy('table_name')
        .execute();
      
      const discoveredTables = result.map(row => row.table_name);
      
      console.log(`DEBUG: Discovered ${discoveredTables.length} org tables:`, discoveredTables);
      
      return discoveredTables;
      
    } catch (error) {
      console.error('DEBUG: Error discovering org tables:', error);
      console.log('DEBUG: Falling back to hardcoded tables');
      return this.getHardcodedOrgTables();
    }
  }

  /**
   * Order tables by dependencies to prevent foreign key constraint violations
   * during initial sync. Parent entities must be synced before child entities.
   */
  private orderTablesByDependencies(tables: string[], organizationId: string): string[] {
    const orgPrefix = `org_${organizationId.replace(/-/g, '_')}_`;
    
    // Define dependency levels (lower number = sync first)
    const dependencyLevels: Record<string, number> = {
      // Level 1: Base entities (no foreign keys)
      'client': 1,
      'resource': 1, 
      'skill': 1,
      
      // Level 2: Project-related (depends on client)
      'project': 2,
      'contract': 2,
      'proposal': 2,
      
      // Level 3: Time tracking (depends on project)
      'timesheet': 3,
      'expense': 3,
      
      // Level 4: Deliverables (depends on project)
      'invoice': 4,
      'document': 4,
      'meeting': 4,
      
      // Level 5: Junction tables (depends on multiple entities)
      'certification': 5, // resource + skill
      'task_dependencies': 5,
      'project_members': 5,
      'client_contacts': 5,
    };
    
    // Extract entity name from full table name and assign levels
    const tableWithLevels = tables.map(fullTableName => {
      const entityName = fullTableName.startsWith(orgPrefix) 
        ? fullTableName.substring(orgPrefix.length)
        : fullTableName;
      
      const level = dependencyLevels[entityName] || 999; // Unknown tables go last
      
      return {
        fullTableName,
        entityName,
        level
      };
    });
    
    // Sort by dependency level, then alphabetically within same level
    const sorted = tableWithLevels.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      return a.entityName.localeCompare(b.entityName);
    });
    
    const orderedTables = sorted.map(item => item.fullTableName);
    
    console.log(`DEBUG: Dependency ordering for org ${organizationId}:`);
    sorted.forEach(item => {
      console.log(`DEBUG:   Level ${item.level}: ${item.entityName} → ${item.fullTableName}`);
    });
    
    return orderedTables;
  }

  /**
   * Fallback hardcoded tables (for when discovery fails)
   */
  private getHardcodedOrgTables(): string[] {
    const knownOrgTables = [
      // TechFlow organization tables
      'org_108b0ac2_487f_4951_b295_b1924288daad_project',
      'org_108b0ac2_487f_4951_b295_b1924288daad_task', 
      'org_108b0ac2_487f_4951_b295_b1924288daad_time_entry',
      
      // Wide Corp organization tables (01920000-1000-7000-8000-000000000001)
      'org_01920000_1000_7000_8000_000000000001_client',
      'org_01920000_1000_7000_8000_000000000001_project',
      'org_01920000_1000_7000_8000_000000000001_contract',
      'org_01920000_1000_7000_8000_000000000001_invoice',
      'org_01920000_1000_7000_8000_000000000001_timesheet',
      'org_01920000_1000_7000_8000_000000000001_expense',
      'org_01920000_1000_7000_8000_000000000001_resource',
      'org_01920000_1000_7000_8000_000000000001_skill',
      'org_01920000_1000_7000_8000_000000000001_certification',
      'org_01920000_1000_7000_8000_000000000001_proposal',
      'org_01920000_1000_7000_8000_000000000001_meeting',
      'org_01920000_1000_7000_8000_000000000001_document'
    ];
    
    console.log('DEBUG: Using hardcoded fallback tables:', knownOrgTables);
    return knownOrgTables;
  }
}

// Singleton instance
let registryInstance: SyncTableRegistry | null = null;

/**
 * Get the singleton sync table registry
 */
export async function getSyncTableRegistry(env: any): Promise<SyncTableRegistry> {
  if (!registryInstance) {
    registryInstance = new SyncTableRegistryImpl(env);
    
    // Set up Kysely database connection for container permissions
    try {
      const { getKysely } = await import('../lib/kysely');
      const kyselyDb = getKysely(env);
      registryInstance.setKyselyDb(kyselyDb);
    } catch (error) {
      console.warn('Failed to set Kysely database on sync table registry:', error);
    }
    
    // Set up cache invalidator
    try {
      const { getTableCacheInvalidator } = await import('./table-cache-invalidator');
      const invalidator = getTableCacheInvalidator();
      (invalidator as any).setSyncTableRegistry(registryInstance);
    } catch (error) {
      console.warn('Failed to set up table cache invalidator:', error);
    }
    
    // Warm the cache on first access
    await registryInstance.getAllTrackableTables();
  }
  
  return registryInstance;
}

/**
 * Reset the registry (for testing)
 */
export function resetSyncTableRegistry(): void {
  registryInstance = null;
}