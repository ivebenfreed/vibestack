import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { BaseServerRepository } from './BaseServerRepository';
import { NeonService } from '../lib/neon-orm/neon-service';
import { ChangeHistory } from '@repo/dataforge/server-entities';
import type { TableChange } from '@repo/sync-types';
import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'change-history-repository';

/**
 * Repository for change_history table operations
 * Handles both read operations (for sync) and write operations (for replication)
 * Uses raw SQL for LSN-specific operations due to PostgreSQL pg_lsn type requirements
 */
export class ChangeHistoryRepository extends BaseServerRepository<ChangeHistory> {
  
  constructor(neonService: NeonService) {
    super(neonService, ChangeHistory);
  }

  // ========== READ OPERATIONS (for sync) ==========

  /**
   * Find changes after a given LSN for catchup sync
   * Replicates the query from performCatchupSync() in server-changes.ts
   */
  async findChangesAfterLSN(
    clientLSN: string, 
    clientId: string, 
    limit: number
  ): Promise<TableChange[]> {
    this.validateLSN(clientLSN);
    
    const query = `
      SELECT lsn, table_name as "table", operation, data, timestamp 
      FROM change_history 
      WHERE 
        lsn::pg_lsn > $1::pg_lsn 
        AND (data->>'clientId' IS NULL OR data->>'clientId' != $2)
      ORDER BY lsn::pg_lsn ASC
      LIMIT $3
    `;
    
    try {
      const result = await this.query(query, [clientLSN, clientId, limit]);
      const rows = result.records || result.raw || result || [];
      return this.mapRowsToTableChanges(rows);
    } catch (error) {
      syncLogger.error('Failed to find changes after LSN', {
        clientLSN,
        clientId,
        limit,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Find changes between two LSNs for live update notifications
   * Replicates the query from processLiveUpdateNotification() in server-changes.ts
   */
  async findChangesBetweenLSN(
    fromLSN: string, 
    toLSN: string, 
    clientId: string, 
    limit: number = 1000
  ): Promise<TableChange[]> {
    this.validateLSN(fromLSN);
    this.validateLSN(toLSN);
    
    const query = `
      SELECT lsn, table_name as "table", operation, data, timestamp 
      FROM change_history 
      WHERE 
        lsn::pg_lsn > $1::pg_lsn AND
        lsn::pg_lsn <= $2::pg_lsn
      ORDER BY lsn::pg_lsn ASC
      LIMIT $3
    `;
    
    try {
      const result = await this.query(query, [fromLSN, toLSN, limit]);
      const rows = result.records || result.raw || result || [];
      return this.mapRowsToTableChanges(rows);
    } catch (error) {
      syncLogger.error('Failed to find changes between LSNs', {
        fromLSN,
        toLSN,
        clientId,
        limit,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Get the latest LSN from change_history table
   * Replicates the query from getLatestChangeHistoryLSN() in sync-common.ts
   */
  async getLatestLSN(): Promise<string> {
    const query = 'SELECT MAX(lsn::pg_lsn)::text as latest_lsn FROM change_history';
    
    try {
      const result = await this.query(query, []);
      const rows = result.records || result.raw || result || [];
      const latestLSN = rows[0]?.latest_lsn;
      
      if (latestLSN) {
        return latestLSN;
      }
      
      return '0/0'; // Default when table is empty
    } catch (error) {
      syncLogger.error('Failed to get latest LSN', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return '0/0'; // Return default on error
    }
  }

  // ========== WRITE OPERATIONS (for replication) ==========

  /**
   * Bulk insert changes into change_history table
   * Replicates the logic from storeChangesInHistory() in process-changes.ts
   * Note: TableChange.data is now in camelCase format after WAL transformation
   */
  async bulkInsertChanges(
    changes: TableChange[], 
    batchSize: number = 1000
  ): Promise<boolean> {
    if (changes.length === 0) {
      return true;
    }

    try {
      let successCount = 0;
      let failureCount = 0;
      const totalBatches = Math.ceil(changes.length / batchSize);

      // Process in batches using raw SQL for optimal performance
      for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);
        
        // Create multi-row INSERT with pg_lsn casting
        const valueRows = batch.map((_, idx) => {
          const base = idx * 5;
          return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, $${base + 4}::pg_lsn, $${base + 5}::timestamptz)`;
        }).join(',\n');
        
        const params: any[] = [];
        batch.forEach(change => {
          // TableChange now uses camelCase format - get timestamp from updatedAt field
          const timestamp = change.updatedAt || new Date().toISOString();
          
          params.push(
            change.table,
            change.operation,
            JSON.stringify(change.data), // Now stores camelCase data in JSONB field
            change.lsn,
            timestamp
          );
        });
        
        const query = `
          INSERT INTO change_history 
            (table_name, operation, data, lsn, timestamp) 
          VALUES 
            ${valueRows}
        `;
        
        try {
          await this.query(query, params);
          successCount += batch.length;
        } catch (insertError) {
          failureCount += batch.length;
          syncLogger.error('Batch insert failed', {
            batchSize: batch.length,
            error: insertError instanceof Error ? insertError.message : String(insertError),
            batchNumber: Math.floor(i / batchSize) + 1
          }, MODULE_NAME);
          
          // Continue with next batch - don't fail entire operation
        }
      }
      
      syncLogger.info('Bulk insert completed', {
        success: successCount,
        failed: failureCount,
        totalBatches
      }, MODULE_NAME);
      
      return successCount > 0;
    } catch (error) {
      syncLogger.error('Bulk insert changes failed', {
        count: changes.length,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return false;
    }
  }

  // ========== LSN-SPECIFIC HELPERS ==========

  /**
   * Validate LSN format and throw immediately on invalid format (fail fast)
   */
  private validateLSN(lsn: string): void {
    if (!lsn || typeof lsn !== 'string') {
      throw new Error(`Invalid LSN: LSN must be a non-empty string, got: ${typeof lsn}`);
    }
    
    // PostgreSQL LSN format: hex/hex (e.g., "0/15D68C50")
    const lsnPattern = /^[0-9A-F]+\/[0-9A-F]+$/i;
    if (!lsnPattern.test(lsn)) {
      throw new Error(`Invalid LSN format: ${lsn}. Expected format: hex/hex (e.g., "0/15D68C50")`);
    }
  }

  /**
   * Map database rows to TableChange objects
   * Handles the transformation from change_history rows to sync types
   */
  private mapRowsToTableChanges(rows: any[]): TableChange[] {
    return rows.map((row: any) => ({
      table: row.table || 'unknown',
      operation: row.operation,
      data: row.data,
      lsn: row.lsn,
      updatedAt: row.timestamp || new Date().toISOString()
    }));
  }

  // ========== SPECIALIZED QUERY METHODS ==========

  /**
   * Count changes after a specific LSN (useful for sync metrics)
   */
  async countChangesAfterLSN(clientLSN: string, clientId?: string): Promise<number> {
    this.validateLSN(clientLSN);
    
    let query = 'SELECT COUNT(*) as count FROM change_history WHERE lsn::pg_lsn > $1::pg_lsn';
    const params: any[] = [clientLSN];
    
    if (clientId) {
      query += ' AND (data->>\'clientId\' IS NULL OR data->>\'clientId\' != $2)';
      params.push(clientId);
    }
    
    try {
      const result = await this.query(query, params);
      const rows = result.records || result.raw || result || [];
      return parseInt(rows[0]?.count || '0', 10);
    } catch (error) {
      syncLogger.error('Failed to count changes after LSN', {
        clientLSN,
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Find changes for a specific table after LSN (useful for table-specific sync)
   */
  async findTableChangesAfterLSN(
    tableName: string,
    clientLSN: string, 
    clientId: string, 
    limit: number = 1000
  ): Promise<TableChange[]> {
    this.validateLSN(clientLSN);
    
    const query = `
      SELECT lsn, table_name as "table", operation, data, timestamp 
      FROM change_history 
      WHERE 
        table_name = $1
        AND lsn::pg_lsn > $2::pg_lsn 
        AND (data->>'clientId' IS NULL OR data->>'clientId' != $3)
      ORDER BY lsn::pg_lsn ASC
      LIMIT $4
    `;
    
    try {
      const result = await this.query(query, [tableName, clientLSN, clientId, limit]);
      const rows = result.records || result.raw || result || [];
      return this.mapRowsToTableChanges(rows);
    } catch (error) {
      syncLogger.error('Failed to find table changes after LSN', {
        tableName,
        clientLSN,
        clientId,
        limit,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Get LSN range info for debugging/monitoring
   */
  async getLSNRange(): Promise<{ earliest: string; latest: string; count: number }> {
    const query = `
      SELECT 
        MIN(lsn::pg_lsn)::text as earliest_lsn,
        MAX(lsn::pg_lsn)::text as latest_lsn,
        COUNT(*) as total_count
      FROM change_history
    `;
    
    try {
      const result = await this.query(query, []);
      const rows = result.records || result.raw || result || [];
      const resultRow = rows[0];
      
      return {
        earliest: resultRow?.earliest_lsn || '0/0',
        latest: resultRow?.latest_lsn || '0/0',
        count: parseInt(resultRow?.total_count || '0', 10)
      };
    } catch (error) {
      syncLogger.error('Failed to get LSN range', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }
} 