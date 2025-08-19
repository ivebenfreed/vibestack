/**
 * LiveStore Bridge Service
 * 
 * Bridges synced data from the existing sync system into LiveStore storage.
 * This service listens for incoming sync data and stores it in LiveStore
 * without interfering with the existing sync flow.
 */

import { syncLogger } from './utils/SyncLogger';
import { liveStoreSchemaClient } from '../lib/livestore-schema-client';

export interface LiveStoreBridgeConfig {
  organizationId: string;
  clientId: string;
}

export class LiveStoreBridge {
  private organizationId: string;
  private clientId: string;
  private liveStoreInstance: any = null;
  private initialized = false;

  constructor(config: LiveStoreBridgeConfig) {
    this.organizationId = config.organizationId;
    this.clientId = config.clientId;
    
    syncLogger.info('livestore-bridge', 'LiveStore bridge created', {
      organizationId: this.organizationId,
      clientId: this.clientId
    });
  }

  /**
   * Initialize LiveStore instance for this organization
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      syncLogger.info('livestore-bridge', 'Initializing LiveStore instance...');
      
      // Initialize LiveStore for this organization
      this.liveStoreInstance = await liveStoreSchemaClient.initializeLiveStore(
        this.organizationId,
        this.clientId
      );

      if (this.liveStoreInstance) {
        await this.liveStoreInstance.ready();
        this.initialized = true;
        
        // Make globally available for debugging
        if (typeof window !== 'undefined') {
          window.LiveStore = this.liveStoreInstance;
          window.dispatchEvent(new CustomEvent('livestore:bridge:ready', {
            detail: { 
              organizationId: this.organizationId,
              clientId: this.clientId
            }
          }));
        }

        syncLogger.info('livestore-bridge', 'LiveStore bridge initialized successfully');
        console.log('✅ LiveStore bridge ready for organization:', this.organizationId);
        return true;
      } else {
        throw new Error('LiveStore initialization returned null');
      }
    } catch (error) {
      syncLogger.error('livestore-bridge', 'Failed to initialize LiveStore bridge', {
        error: error instanceof Error ? error.message : String(error),
        organizationId: this.organizationId
      });
      console.error('❌ LiveStore bridge initialization failed:', error);
      return false;
    }
  }

  /**
   * Store incoming sync changes in LiveStore
   */
  async storeChanges(changes: any[]): Promise<void> {
    if (!this.initialized || !this.liveStoreInstance) {
      // Try to initialize if not already done
      const success = await this.initialize();
      if (!success) {
        syncLogger.warn('livestore-bridge', 'Cannot store changes - LiveStore not available');
        return;
      }
    }

    if (changes.length === 0) {
      return;
    }

    try {
      syncLogger.info('livestore-bridge', `Storing ${changes.length} changes in LiveStore`);
      
      // Group changes by table
      const changesByTable = new Map<string, any[]>();
      
      for (const change of changes) {
        const tableName = this.getTableName(change.table);
        if (!changesByTable.has(tableName)) {
          changesByTable.set(tableName, []);
        }
        changesByTable.get(tableName)!.push(change);
      }

      // Store changes for each table
      for (const [tableName, tableChanges] of changesByTable) {
        await this.storeTableChanges(tableName, tableChanges);
      }

      console.log(`✅ Stored ${changes.length} changes across ${changesByTable.size} tables in LiveStore`);
      
    } catch (error) {
      syncLogger.error('livestore-bridge', 'Failed to store changes in LiveStore', {
        error: error instanceof Error ? error.message : String(error),
        changeCount: changes.length
      });
      console.error('❌ Failed to store changes in LiveStore:', error);
    }
  }

  /**
   * Store changes for a specific table
   */
  private async storeTableChanges(tableName: string, changes: any[]): Promise<void> {
    for (const change of changes) {
      try {
        switch (change.operation) {
          case 'INSERT':
            // Store the inserted data
            await this.liveStoreInstance.query(
              `INSERT OR REPLACE INTO "${tableName}" VALUES (${this.buildPlaceholders(change.data)})`,
              Object.values(change.data)
            );
            break;
            
          case 'UPDATE':
            // Update the existing data
            if (change.data && change.data.id) {
              const setClause = Object.keys(change.data)
                .map(key => `"${key}" = ?`)
                .join(', ');
              
              await this.liveStoreInstance.query(
                `UPDATE "${tableName}" SET ${setClause} WHERE id = ?`,
                [...Object.values(change.data), change.data.id]
              );
            }
            break;
            
          case 'DELETE':
            // Delete the record
            if (change.data && change.data.id) {
              await this.liveStoreInstance.query(
                `DELETE FROM "${tableName}" WHERE id = ?`,
                [change.data.id]
              );
            }
            break;
        }
      } catch (error) {
        syncLogger.error('livestore-bridge', `Failed to store ${change.operation} for table ${tableName}`, {
          error: error instanceof Error ? error.message : String(error),
          changeId: change.id
        });
      }
    }
  }

  /**
   * Convert organization table name to LiveStore table name
   */
  private getTableName(orgTableName: string): string {
    // Remove organization prefix if present
    const prefix = `org_${this.organizationId.replace(/-/g, '_')}_`;
    if (orgTableName.startsWith(prefix)) {
      return orgTableName.replace(prefix, '');
    }
    return orgTableName;
  }

  /**
   * Build SQL placeholders for INSERT statements
   */
  private buildPlaceholders(data: any): string {
    return Object.keys(data).map(() => '?').join(', ');
  }

  /**
   * Query data from LiveStore
   */
  async query(sql: string, params?: any[]): Promise<any[]> {
    if (!this.initialized || !this.liveStoreInstance) {
      throw new Error('LiveStore bridge not initialized');
    }

    return await this.liveStoreInstance.query(sql, params);
  }

  /**
   * Check if LiveStore is available and ready
   */
  isReady(): boolean {
    return this.initialized && !!this.liveStoreInstance;
  }

  /**
   * Get table statistics from LiveStore
   */
  async getTableStats(): Promise<{ [tableName: string]: number }> {
    if (!this.isReady()) {
      return {};
    }

    try {
      // Get all tables
      const tables = await this.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );

      const stats: { [tableName: string]: number } = {};
      
      for (const table of tables) {
        const countResult = await this.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
        stats[table.name] = countResult[0]?.count || 0;
      }

      return stats;
    } catch (error) {
      syncLogger.error('livestore-bridge', 'Failed to get table stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.liveStoreInstance) {
      try {
        await this.liveStoreInstance.close();
        syncLogger.info('livestore-bridge', 'LiveStore bridge destroyed');
      } catch (error) {
        syncLogger.error('livestore-bridge', 'Error destroying LiveStore bridge', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    this.liveStoreInstance = null;
    this.initialized = false;
  }
}