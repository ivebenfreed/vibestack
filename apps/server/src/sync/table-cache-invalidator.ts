/**
 * Table Cache Invalidator
 * 
 * Handles invalidation of the sync table registry cache when schema changes occur.
 * Integrates with table creation/deletion events to ensure immediate cache updates.
 */

import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'table-cache-invalidator';

export interface TableCacheInvalidator {
  invalidateCache(): Promise<void>;
  onTableCreated(tableName: string): Promise<void>;
  onTableDropped(tableName: string): Promise<void>;
}

class TableCacheInvalidatorImpl implements TableCacheInvalidator {
  private syncTableRegistry: any = null;

  setSyncTableRegistry(registry: any): void {
    this.syncTableRegistry = registry;
  }

  /**
   * Invalidate the table cache immediately
   */
  async invalidateCache(): Promise<void> {
    if (!this.syncTableRegistry) {
      syncLogger.warn('No sync table registry available for cache invalidation', {}, MODULE_NAME);
      return;
    }

    try {
      await this.syncTableRegistry.refreshTableCache();
      syncLogger.info('Table cache invalidated successfully', {}, MODULE_NAME);
    } catch (error) {
      syncLogger.error('Failed to invalidate table cache', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Handle table creation event
   */
  async onTableCreated(tableName: string): Promise<void> {
    // Only invalidate for org-specific tables
    if (tableName.startsWith('org_')) {
      syncLogger.info('Organization table created, invalidating cache', {
        tableName
      }, MODULE_NAME);
      
      await this.invalidateCache();
      
      // TODO: Could also broadcast cache invalidation to other server instances
      // via Redis pub/sub or similar mechanism
    }
  }

  /**
   * Handle table deletion event
   */
  async onTableDropped(tableName: string): Promise<void> {
    // Only invalidate for org-specific tables
    if (tableName.startsWith('org_')) {
      syncLogger.info('Organization table dropped, invalidating cache', {
        tableName
      }, MODULE_NAME);
      
      await this.invalidateCache();
    }
  }
}

// Singleton instance
let invalidatorInstance: TableCacheInvalidator | null = null;

/**
 * Get the singleton table cache invalidator
 */
export function getTableCacheInvalidator(): TableCacheInvalidator {
  if (!invalidatorInstance) {
    invalidatorInstance = new TableCacheInvalidatorImpl();
  }
  return invalidatorInstance;
}

/**
 * Helper function to be called whenever org tables are created
 */
export async function notifyTableCreated(tableName: string): Promise<void> {
  const invalidator = getTableCacheInvalidator();
  await invalidator.onTableCreated(tableName);
}

/**
 * Helper function to be called whenever org tables are dropped
 */
export async function notifyTableDropped(tableName: string): Promise<void> {
  const invalidator = getTableCacheInvalidator();
  await invalidator.onTableDropped(tableName);
}