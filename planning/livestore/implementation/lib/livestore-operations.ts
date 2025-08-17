/**
 * LiveStore Operations with Change Tracking
 * 
 * Provides CRUD operations for LiveStore that automatically integrate
 * with our existing change tracking system. This replaces direct
 * LiveStore operations with tracked operations.
 */

import { nanoid } from 'nanoid';
import type { LiveStoreInstance } from './livestore-schema-client';
import { getLiveStoreChangeTracker, type LiveStoreChangeEvent } from './livestore-change-tracking';

export interface LiveStoreOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface LiveStoreQueryOptions {
  organizationId: string;
  tableName: string;
  trackChanges?: boolean;
}

export interface LiveStoreInsertOptions extends LiveStoreQueryOptions {
  data: Record<string, any>;
}

export interface LiveStoreUpdateOptions extends LiveStoreQueryOptions {
  id: string;
  data: Record<string, any>;
}

export interface LiveStoreDeleteOptions extends LiveStoreQueryOptions {
  id: string;
}

/**
 * LiveStore Operations Manager with Change Tracking
 */
export class LiveStoreOperationsManager {
  private instance: LiveStoreInstance;
  private orgId: string;

  constructor(instance: LiveStoreInstance, orgId: string) {
    this.instance = instance;
    this.orgId = orgId;
  }

  /**
   * Insert a record into LiveStore with change tracking
   */
  async insert(options: LiveStoreInsertOptions): Promise<LiveStoreOperationResult> {
    try {
      const { organizationId, tableName, data, trackChanges = true } = options;
      
      // Ensure record has required fields
      const recordData = {
        id: data.id || nanoid(),
        organization_id: organizationId,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        ...data
      };

      // Execute SQL INSERT
      const sql = this.generateInsertSQL(tableName, recordData);
      const params = Object.values(recordData);
      
      await this.instance.query(sql, params);
      
      // Track the change if enabled
      if (trackChanges) {
        await this.trackChange({
          operation: 'insert',
          tableName,
          entityId: recordData.id,
          data: recordData,
          organizationId,
          timestamp: Date.now()
        });
      }

      console.log(`✅ LiveStore insert: ${tableName}/${recordData.id}`);
      
      return {
        success: true,
        data: recordData
      };

    } catch (error) {
      console.error('❌ LiveStore insert failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update a record in LiveStore with change tracking
   */
  async update(options: LiveStoreUpdateOptions): Promise<LiveStoreOperationResult> {
    try {
      const { organizationId, tableName, id, data, trackChanges = true } = options;
      
      // Get old data if tracking changes
      let oldData: any = null;
      if (trackChanges) {
        const oldResult = await this.findById(tableName, id, organizationId);
        oldData = oldResult.data;
      }

      // Prepare update data
      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      };

      // Execute SQL UPDATE
      const sql = this.generateUpdateSQL(tableName, updateData, id, organizationId);
      const params = [...Object.values(updateData), id, organizationId];
      
      await this.instance.query(sql, params);
      
      // Track the change if enabled
      if (trackChanges) {
        await this.trackChange({
          operation: 'update',
          tableName,
          entityId: id,
          data: updateData,
          oldData,
          organizationId,
          timestamp: Date.now()
        });
      }

      console.log(`✅ LiveStore update: ${tableName}/${id}`);
      
      return {
        success: true,
        data: updateData
      };

    } catch (error) {
      console.error('❌ LiveStore update failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a record from LiveStore with change tracking
   */
  async delete(options: LiveStoreDeleteOptions): Promise<LiveStoreOperationResult> {
    try {
      const { organizationId, tableName, id, trackChanges = true } = options;
      
      // Get old data if tracking changes
      let oldData: any = null;
      if (trackChanges) {
        const oldResult = await this.findById(tableName, id, organizationId);
        oldData = oldResult.data;
      }

      // Execute SQL DELETE
      const sql = `DELETE FROM ${tableName} WHERE id = ? AND organization_id = ?`;
      await this.instance.query(sql, [id, organizationId]);
      
      // Track the change if enabled
      if (trackChanges) {
        await this.trackChange({
          operation: 'delete',
          tableName,
          entityId: id,
          oldData,
          organizationId,
          timestamp: Date.now()
        });
      }

      console.log(`✅ LiveStore delete: ${tableName}/${id}`);
      
      return {
        success: true,
        data: { id }
      };

    } catch (error) {
      console.error('❌ LiveStore delete failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find a record by ID
   */
  async findById(tableName: string, id: string, organizationId: string): Promise<LiveStoreOperationResult> {
    try {
      const sql = `SELECT * FROM ${tableName} WHERE id = ? AND organization_id = ? LIMIT 1`;
      const results = await this.instance.query(sql, [id, organizationId]);
      
      return {
        success: true,
        data: results[0] || null
      };

    } catch (error) {
      console.error('❌ LiveStore findById failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find multiple records with optional filtering
   */
  async find(
    tableName: string, 
    organizationId: string, 
    where?: Record<string, any>,
    orderBy?: string,
    limit?: number
  ): Promise<LiveStoreOperationResult> {
    try {
      let sql = `SELECT * FROM ${tableName} WHERE organization_id = ?`;
      const params: any[] = [organizationId];

      // Add WHERE conditions
      if (where) {
        for (const [field, value] of Object.entries(where)) {
          sql += ` AND ${field} = ?`;
          params.push(value);
        }
      }

      // Add ORDER BY
      if (orderBy) {
        sql += ` ORDER BY ${orderBy}`;
      }

      // Add LIMIT
      if (limit) {
        sql += ` LIMIT ?`;
        params.push(limit);
      }

      const results = await this.instance.query(sql, params);
      
      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('❌ LiveStore find failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute raw SQL query
   */
  async query(sql: string, params?: any[]): Promise<LiveStoreOperationResult> {
    try {
      const results = await this.instance.query(sql, params);
      
      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('❌ LiveStore raw query failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Bulk insert records with change tracking
   */
  async bulkInsert(
    tableName: string,
    organizationId: string,
    records: Record<string, any>[],
    trackChanges = true
  ): Promise<LiveStoreOperationResult> {
    try {
      const processedRecords = records.map(record => ({
        id: record.id || nanoid(),
        organization_id: organizationId,
        created_at: record.created_at || new Date().toISOString(),
        updated_at: record.updated_at || new Date().toISOString(),
        ...record
      }));

      // Use a transaction-like approach for bulk operations
      for (const record of processedRecords) {
        await this.insert({
          organizationId,
          tableName,
          data: record,
          trackChanges
        });
      }

      console.log(`✅ LiveStore bulk insert: ${processedRecords.length} records in ${tableName}`);
      
      return {
        success: true,
        data: processedRecords
      };

    } catch (error) {
      console.error('❌ LiveStore bulk insert failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods

  /**
   * Generate INSERT SQL statement
   */
  private generateInsertSQL(tableName: string, data: Record<string, any>): string {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    
    return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
  }

  /**
   * Generate UPDATE SQL statement
   */
  private generateUpdateSQL(
    tableName: string, 
    data: Record<string, any>, 
    id: string, 
    organizationId: string
  ): string {
    const setClause = Object.keys(data)
      .map(column => `${column} = ?`)
      .join(', ');
    
    return `UPDATE ${tableName} SET ${setClause} WHERE id = ? AND organization_id = ?`;
  }

  /**
   * Track a change using the global change tracker
   */
  private async trackChange(event: LiveStoreChangeEvent): Promise<void> {
    const tracker = getLiveStoreChangeTracker();
    if (tracker) {
      await tracker.trackChange(event);
    }
  }
}

/**
 * Create LiveStore operations manager for an organization
 */
export function createLiveStoreOperations(
  instance: LiveStoreInstance, 
  orgId: string
): LiveStoreOperationsManager {
  return new LiveStoreOperationsManager(instance, orgId);
}

/**
 * React hook for LiveStore operations
 */
export function useLiveStoreOperations(instance: LiveStoreInstance | null, orgId: string | null) {
  const React = (globalThis as any).React;
  
  const operations = React.useMemo(() => {
    if (!instance || !orgId) {
      return null;
    }
    return createLiveStoreOperations(instance, orgId);
  }, [instance, orgId]);

  return operations;
}