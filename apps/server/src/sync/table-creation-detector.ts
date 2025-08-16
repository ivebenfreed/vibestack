/**
 * Table Creation Detector
 * 
 * Polls for new org tables and invalidates cache when found.
 * Integrates with existing WAL polling system for efficiency.
 */

import { syncLogger } from '../middleware/logger';
import { getTableCacheInvalidator } from './table-cache-invalidator';

const MODULE_NAME = 'table-creation-detector';

export class TableCreationDetector {
  private lastTableCount: number = 0;
  private lastCheck: Date = new Date();
  private kyselyDb: any = null;

  constructor(kyselyDb: any) {
    this.kyselyDb = kyselyDb;
  }

  /**
   * Check for new org tables and invalidate cache if found
   */
  async checkForNewTables(): Promise<void> {
    try {
      if (!this.kyselyDb) {
        return;
      }

      // Query current org table count
      const result = await this.kyselyDb
        .selectFrom('information_schema.tables')
        .select(({ fn }) => [fn.count<number>('table_name').as('count')])
        .where('table_schema', '=', 'public')
        .where('table_name', 'like', 'org_%')
        .executeTakeFirst();

      const currentTableCount = Number(result?.count || 0);

      // If this is the first check, just store the count
      if (this.lastTableCount === 0) {
        this.lastTableCount = currentTableCount;
        syncLogger.debug('Initial org table count recorded', {
          tableCount: currentTableCount
        }, MODULE_NAME);
        return;
      }

      // Check if table count changed
      if (currentTableCount !== this.lastTableCount) {
        syncLogger.info('Organization table count changed, invalidating cache', {
          previousCount: this.lastTableCount,
          currentCount: currentTableCount,
          change: currentTableCount - this.lastTableCount
        }, MODULE_NAME);

        // Invalidate cache
        const invalidator = getTableCacheInvalidator();
        await invalidator.invalidateCache();

        // Update stored count
        this.lastTableCount = currentTableCount;
      }

      this.lastCheck = new Date();

    } catch (error) {
      syncLogger.error('Error checking for new tables', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Get detailed info about new tables since last check
   */
  async getNewTablesSinceLastCheck(): Promise<string[]> {
    try {
      if (!this.kyselyDb) {
        return [];
      }

      // This is a more expensive query, only used for detailed logging
      const result = await this.kyselyDb
        .selectFrom('information_schema.tables')
        .select('table_name')
        .where('table_schema', '=', 'public')
        .where('table_name', 'like', 'org_%')
        .orderBy('table_name')
        .execute();

      return result.map((row: any) => row.table_name);

    } catch (error) {
      syncLogger.error('Error getting new tables list', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Force refresh table count (call after known table creation)
   */
  async refreshTableCount(): Promise<void> {
    this.lastTableCount = 0; // Force recount on next check
    await this.checkForNewTables();
  }
}

// Global instance
let detectorInstance: TableCreationDetector | null = null;

/**
 * Get the table creation detector instance
 */
export function getTableCreationDetector(kyselyDb: any): TableCreationDetector {
  if (!detectorInstance) {
    detectorInstance = new TableCreationDetector(kyselyDb);
  }
  return detectorInstance;
}

/**
 * Integration function for WAL polling system
 */
export async function checkForTableChanges(kyselyDb: any): Promise<void> {
  const detector = getTableCreationDetector(kyselyDb);
  await detector.checkForNewTables();
}