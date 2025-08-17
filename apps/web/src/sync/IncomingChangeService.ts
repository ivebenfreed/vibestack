/**
 * IncomingChangeService - Pure incoming change service
 * 
 * Handles incoming change processing and application without state management.
 * Reports progress and results via callbacks rather than maintaining internal state.
 * 
 * Part of Phase 2: Pure Services Extraction
 */

import { TableChange } from '@repo/sync-types';
import { CLIENT_DOMAIN_TABLES, CLIENT_JUNCTION_TABLE_MAPPING } from '../db/client-entities';
import { getLiveStoreClient } from '../lib/livestore-client';

export interface IncomingChangeServiceConfig {
  clientId: string;
  enableOptimisticUpdates?: boolean;
  batchSize?: number;
  conflictResolution?: 'client-wins' | 'server-wins' | 'timestamp';
}

export interface IncomingChangeServiceCallbacks {
  onChangesProcessed?: (changes: TableChange[], results: ProcessingResult[]) => void;
  onConflictDetected?: (change: TableChange, existingData: any, resolution: 'client-wins' | 'server-wins') => void;
  onError?: (error: Error, context?: string, change?: TableChange) => void;
  onProgress?: (processed: number, total: number) => void;
}

export interface ProcessingResult {
  change: TableChange;
  success: boolean;
  error?: string;
  conflictResolved?: boolean;
  skipped?: boolean;
  reason?: string;
}

export class IncomingChangeService {
  private config: IncomingChangeServiceConfig;
  private callbacks: IncomingChangeServiceCallbacks = {};
  private isProcessing = false;
  
  // Internal queue for handling concurrent requests
  private processingQueue: Array<{
    changes: TableChange[];
    messageType: string;
    resolve: (results: ProcessingResult[]) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  constructor(
    config: IncomingChangeServiceConfig,
    dataSource?: any // Kept for compatibility but not used
  ) {
    this.config = config;
    console.log('[IncomingChangeService] Initialized with config:', config);
    console.log('[IncomingChangeService] Using Dexie-only mode (TypeORM removed)');
  }


  /**
   * Set callbacks for service events
   */
  setCallbacks(callbacks: IncomingChangeServiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Process incoming changes from server with proper queuing
   */
  async processChanges(changes: TableChange[], messageType: string): Promise<ProcessingResult[]> {
    return new Promise((resolve, reject) => {
      console.log(`[IncomingChangeService] Queuing ${changes.length} changes (${messageType})`);
      
      // Add to queue
      this.processingQueue.push({
        changes,
        messageType,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the internal queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[IncomingChangeService] Starting queue processing: ${this.processingQueue.length} items`);

    while (this.processingQueue.length > 0) {
      const item = this.processingQueue.shift()!;
      
      try {
        console.log(`[IncomingChangeService] Processing ${item.changes.length} changes (${item.messageType})`);
        const results = await this.doProcessChanges(item.changes, item.messageType);
        item.resolve(results);
      } catch (error) {
        console.error('[IncomingChangeService] Error processing queued changes:', error);
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessing = false;
    console.log('[IncomingChangeService] Queue processing completed');
  }

  /**
   * Actually process the changes (renamed from processChanges)
   */
  private async doProcessChanges(changes: TableChange[], messageType: string): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    try {
      console.log(`[IncomingChangeService] Processing ${changes.length} incoming changes (${messageType})`);

      // Handle empty changes array (common for junction tables with no data)
      if (changes.length === 0) {
        console.log(`[IncomingChangeService] Empty changes array for ${messageType} - will still send acknowledgment`);
        
        // Report completion with empty arrays
        this.callbacks.onChangesProcessed?.(changes, results);
        
        console.log(`[IncomingChangeService] Empty processing complete - returning empty results`);
        return results;
      }

      const batchSize = this.config.batchSize || 50;
      
      // Process in batches
      for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);
        const batchResults = await this.processBatch(batch, messageType);
        results.push(...batchResults);
        
        // Report progress
        this.callbacks.onProgress?.(Math.min(i + batchSize, changes.length), changes.length);
      }

      // Report completion
      this.callbacks.onChangesProcessed?.(changes, results);
      
      const successCount = results.filter(r => r.success).length;
      const conflictCount = results.filter(r => r.conflictResolved).length;
      const errorCount = results.filter(r => !r.success).length;
      
      console.log(`[IncomingChangeService] Processing complete: ${successCount} successful, ${conflictCount} conflicts resolved, ${errorCount} errors`);

      return results;

    } catch (error) {
      console.error('[IncomingChangeService] Error processing changes:', error);
      this.callbacks.onError?.(error as Error, 'process_changes');
      throw error;
    }
  }

  /**
   * Apply a single change to the database
   */
  async applySingleChange(change: TableChange): Promise<ProcessingResult> {
    try {
      console.log(`[IncomingChangeService] Applying ${change.operation} to ${change.table} for record ${change.data.id}`);

      const result = await this.applyChange(change);
      
      if (result.success) {
        console.log(`[IncomingChangeService] Successfully applied change to ${change.table}`);
      } else {
        console.warn(`[IncomingChangeService] Failed to apply change to ${change.table}: ${result.error}`);
      }

      return result;

    } catch (error) {
      console.error('[IncomingChangeService] Error applying single change:', error);
      this.callbacks.onError?.(error as Error, 'apply_single_change', change);
      
      return {
        change,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if service is currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Clear the processing queue (e.g., when sync phase changes)
   */
  clearQueue(): void {
    console.log(`[IncomingChangeService] Clearing queue with ${this.processingQueue.length} pending items`);
    
    // Reject all pending promises to prevent memory leaks
    this.processingQueue.forEach(item => {
      item.reject(new Error('Queue cleared due to sync phase change'));
    });
    
    this.processingQueue = [];
  }

  /**
   * Clear queue of specific message types (e.g., clear initial sync messages when going live)
   */
  clearQueueByMessageType(messageType: string): void {
    const originalLength = this.processingQueue.length;
    const itemsToResolve: typeof this.processingQueue = [];
    
    this.processingQueue = this.processingQueue.filter(item => {
      if (item.messageType === messageType) {
        itemsToResolve.push(item);
        return false;
      }
      return true;
    });
    
    // Resolve the filtered out items with empty results instead of rejecting
    // This prevents error propagation when clearing queues during normal operation
    itemsToResolve.forEach(item => {
      console.log(`[IncomingChangeService] Resolving cleared queue item (${messageType}) with empty results`);
      item.resolve([]); // Resolve with empty results instead of rejecting
    });
    
    if (itemsToResolve.length > 0) {
      console.log(`[IncomingChangeService] Cleared ${itemsToResolve.length} items of type '${messageType}' from queue (${originalLength} -> ${this.processingQueue.length})`);
    }
  }

  /**
   * Destroy service and clean up resources
   */
  destroy(): void {
    console.log('[IncomingChangeService] Destroying...');
    this.clearQueue(); // Clear queue on destroy
    this.callbacks = {};
  }


  // Private methods

  private async processBatch(batch: TableChange[], messageType?: string): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    try {
      // Determine if this is live sync (needs individual operations with flags)
      // or initial/catchup sync (can use bulk operations with disabled tracking)
      const isLiveSync = messageType === 'srv_live_changes';
      
      if (isLiveSync) {
        // LIVE SYNC: Process individually with SYNC_TRANSACTION flags
        // This allows concurrent user operations while preventing sync loops
        console.log(`[IncomingChangeService] 🔄 LIVE SYNC: Processing ${batch.length} changes individually with SYNC_TRANSACTION flags`);
        
        for (const change of batch) {
          try {
            // For live sync, we need to handle it differently
            const result = await this.applyChangeInTransactionLiveSync(change);
            results.push(result);
          } catch (error) {
            console.error(`[IncomingChangeService] Error processing live sync change for ${change.table}:`, error);
            results.push({
              change,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        return results;
      }
      
      // INITIAL/CATCHUP SYNC: Use bulk operations for performance
      // Group changes by table and operation for bulk optimization
      const grouped = this.groupChangesByTableAndOperation(batch);
      
      // Process each group
      for (const [key, changes] of grouped.entries()) {
        const [table, operation] = key.split(':');
        
        try {
          if (operation === 'insert' && changes.length > 1) {
            // Use bulk insert for multiple inserts of same entity type
            console.log(`[IncomingChangeService] Processing ${changes.length} bulk inserts for ${table}`);
            const bulkResults = await this.processBulkInserts(table, changes);
            results.push(...bulkResults);
          } else if (operation === 'update' && changes.length > 1) {
            // Use bulk update for multiple updates of same entity type
            console.log(`[IncomingChangeService] Processing ${changes.length} bulk updates for ${table}`);
            const bulkResults = await this.processBulkUpdates(table, changes);
            results.push(...bulkResults);
          } else {
            // Process individually for other operations or single changes
            for (const change of changes) {
              try {
                const result = await this.applyChangeInTransaction(change, null);
                results.push(result);
              } catch (error) {
                console.error(`[IncomingChangeService] Error processing individual change for ${change.table}:`, error);
                results.push({
                  change,
                  success: false,
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }
          }
        } catch (error) {
          console.error(`[IncomingChangeService] Error processing group ${key}:`, error);
          console.log(`[IncomingChangeService] Falling back to individual processing for ${changes.length} changes in group ${key}`);
          
          // Fallback to individual processing for this group
          for (const change of changes) {
            try {
              const result = await this.applyChangeInTransaction(change, null);
              results.push(result);
            } catch (individualError) {
              console.error(`[IncomingChangeService] Individual processing also failed for ${change.table}:${change.data.id}:`, individualError);
              results.push({
                change,
                success: false,
                error: individualError instanceof Error ? individualError.message : String(individualError)
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('[IncomingChangeService] Error in batch processing:', error);
      console.log(`[IncomingChangeService] Falling back to individual processing for entire batch of ${batch.length} changes`);
      
      // Fallback to individual processing for entire batch
      for (const change of batch) {
        try {
          const result = await this.applyChangeInTransaction(change, null);
          results.push(result);
        } catch (individualError) {
          console.error(`[IncomingChangeService] Individual processing also failed for ${change.table}:${change.data.id}:`, individualError);
          results.push({
            change,
            success: false,
            error: individualError instanceof Error ? individualError.message : String(individualError)
          });
        }
      }
    }

    return results;
  }

  /**
   * Group changes by table and operation for bulk optimization
   */
  private groupChangesByTableAndOperation(changes: TableChange[]): Map<string, TableChange[]> {
    const grouped = new Map<string, TableChange[]>();
    
    for (const change of changes) {
      const key = `${change.table}:${change.operation}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(change);
    }
    
    console.log(`[IncomingChangeService] Grouped ${changes.length} changes into ${grouped.size} operation groups`);
    return grouped;
  }

  /**
   * Process bulk inserts - currently processes individually
   * TODO: Add bulk operations to generated CRUD functions
   */
  private async processBulkInserts(table: string, changes: TableChange[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    console.log(`[IncomingChangeService] Processing ${changes.length} bulk inserts for ${table}`);
    
    try {
      // Extract entities data from changes
      const entitiesData = changes.map(change => change.data);
      
      // Perform bulk insert - change tracking is managed at sync phase level
      const { db } = await import('../db/dexie-schema');
      
      // Check if it's a domain table
      const tableWithQuotes = `"${table}"`;
      if (CLIENT_DOMAIN_TABLES.includes(tableWithQuotes)) {
        // Use table name directly - Dexie tables use snake_case
        const dexieTable = (db as any)[table];
        if (dexieTable) {
          console.log(`[IncomingChangeService] 🗄️ Dexie: Bulk inserting ${entitiesData.length} ${table} into IndexedDB`);
          
          // Change tracking is controlled at sync phase level by sync-machine-v3
          // Initial/catchup sync: tracking disabled for entire phase
          // Live sync: uses individual operations with SYNC_TRANSACTION flag
          await dexieTable.bulkPut(entitiesData);
          
          console.log(`[IncomingChangeService] ✅ Bulk inserted ${entitiesData.length} ${table} entities`);
        } else {
          throw new Error(`Dexie table not found for: ${table}`);
        }
      } 
      // Check if it's a junction table
      else if (CLIENT_JUNCTION_TABLE_MAPPING[table]) {
        const dexieTable = (db as any)[table];
        if (dexieTable) {
          console.log(`[IncomingChangeService] 🗄️ Dexie: Bulk inserting ${entitiesData.length} ${table} into IndexedDB`);
          
          // Change tracking is controlled at sync phase level by sync-machine-v3
          // Initial/catchup sync: tracking disabled for entire phase
          // Live sync: uses individual operations with SYNC_TRANSACTION flag
          await dexieTable.bulkPut(entitiesData);
          
          console.log(`[IncomingChangeService] ✅ Bulk inserted ${entitiesData.length} ${table} entities`);
        } else {
          throw new Error(`Dexie junction table not found for: ${table}`);
        }
      }
      // Unknown table - fallback to individual processing
      else {
        console.warn(`[IncomingChangeService] No bulk handler for ${table}, falling back to individual processing`);
        for (const change of changes) {
          try {
            const result = await this.applyChangeInTransaction(change, null);
            results.push(result);
          } catch (error) {
            console.error(`[IncomingChangeService] Insert failed for ${table}:${change.data.id}:`, error);
            results.push({
              change,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        return results;
      }
        
      // Create success results for all bulk inserted entities
      changes.forEach((change, index) => {
        results.push({
          change,
          success: true,
          error: undefined
        });
      });
      
      console.log(`[IncomingChangeService] ✅ Bulk inserted ${changes.length} ${table} entities`);
      
    } catch (error) {
      console.error(`[IncomingChangeService] ❌ Bulk insert failed for ${table}:`, error);
      console.log(`[IncomingChangeService] Falling back to individual processing for ${changes.length} changes`);
      
      // Fallback to individual processing when bulk insert fails
      for (const change of changes) {
        try {
          const result = await this.applyChangeInTransaction(change, null);
          results.push(result);
        } catch (individualError) {
          console.error(`[IncomingChangeService] Individual insert also failed for ${table}:${change.data.id}:`, individualError);
          results.push({
            change,
            success: false,
            error: individualError instanceof Error ? individualError.message : String(individualError)
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Process bulk updates with fallback to individual operations
   */
  private async processBulkUpdates(table: string, changes: TableChange[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    console.log(`[IncomingChangeService] Processing ${changes.length} bulk updates for ${table}`);
    
    try {
      // Extract entities data from changes
      const entitiesData = changes.map(change => change.data);
      
      // Perform bulk update - change tracking is managed at sync phase level
      const { db } = await import('../db/dexie-schema');
      
      // Check if it's a domain table
      const tableWithQuotes = `"${table}"`;
      if (CLIENT_DOMAIN_TABLES.includes(tableWithQuotes)) {
        // Use table name directly - Dexie tables use snake_case
        const dexieTable = (db as any)[table];
        if (dexieTable) {
          console.log(`[IncomingChangeService] 🗄️ Dexie: Bulk updating ${entitiesData.length} ${table} in IndexedDB`);
          
          // Change tracking is controlled at sync phase level by sync-machine-v3
          // Initial/catchup sync: tracking disabled for entire phase
          // Live sync: uses individual operations with SYNC_TRANSACTION flag
          await dexieTable.bulkPut(entitiesData);
          
          console.log(`[IncomingChangeService] ✅ Bulk updated ${entitiesData.length} ${table} entities`);
        } else {
          throw new Error(`Dexie table not found for: ${table}`);
        }
      } else {
        console.warn(`[IncomingChangeService] Unknown table ${table} for Dexie bulk update, falling back to individual processing`);
        for (const change of changes) {
          try {
            const result = await this.applyChangeInTransaction(change, null);
            results.push(result);
          } catch (error) {
            console.error(`[IncomingChangeService] Update failed for ${table}:${change.data.id}:`, error);
            results.push({
              change,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        return results;
      }
        
      // Create success results for all bulk updated entities
      changes.forEach((change) => {
        results.push({
          change,
          success: true,
          error: undefined
        });
      });
      
    } catch (error) {
      console.error(`[IncomingChangeService] ❌ Bulk update failed for ${table}:`, error);
      console.log(`[IncomingChangeService] Falling back to individual processing for ${changes.length} changes`);
      
      // Fallback to individual processing when bulk update fails
      for (const change of changes) {
        try {
          const result = await this.applyChangeInTransaction(change, null);
          results.push(result);
        } catch (individualError) {
          console.error(`[IncomingChangeService] Individual update also failed for ${table}:${change.data.id}:`, individualError);
          results.push({
            change,
            success: false,
            error: individualError instanceof Error ? individualError.message : String(individualError)
          });
        }
      }
    }
    
    return results;
  }

  private async applyChange(change: TableChange): Promise<ProcessingResult> {
    // TypeORM removed - call applyChangeInTransaction directly
    return await this.applyChangeInTransaction(change, null);
  }

  private async applyChangeInTransaction(change: TableChange, entityManager: any): Promise<ProcessingResult> {
    try {
      // Skip our own changes to prevent loops
      if (change.clientId === this.config.clientId) {
        return {
          change,
          success: true,
          skipped: true,
          reason: 'own_change'
        };
      }

      console.log(`[IncomingChangeService] Applying ${change.operation} to ${change.table} for record ${change.data.id}`);
      
      // Check if it's a domain table
      // CLIENT_DOMAIN_TABLES contains table names without quotes
      if (CLIENT_DOMAIN_TABLES.includes(change.table)) {
        await this.applyDomainTableChange(change, false); // false = not live sync
      } 
      // Check if it's a junction table
      else if (CLIENT_JUNCTION_TABLE_MAPPING[change.table]) {
        console.log(`[IncomingChangeService] 🔧 Processing junction table ${change.table} with data:`, change.data);
        await this.applyJunctionTableChange(change);
      }
      // Unknown table
      else {
        throw new Error(`No incoming function support for table: ${change.table}`);
      }

      console.log(`[IncomingChangeService] Successfully applied ${change.operation} to ${change.table} for record ${change.data.id}`);
      
      // Bridge to LiveStore tables
      await this.bridgeToLiveStore(change);
      
      // Process relationship updates if present
      if (change.relationshipUpdates && change.relationshipUpdates.length > 0) {
        console.log(`[IncomingChangeService] Processing ${change.relationshipUpdates.length} relationship updates for ${change.table}:${change.data.id}`);
        await this.applyRelationshipUpdates(change);
      }
      
      return {
        change,
        success: true
      };

    } catch (error) {
      console.error(`[IncomingChangeService] Error applying ${change.operation} to ${change.table}:`, error);
      return {
        change,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Apply changes during live sync using SYNC_TRANSACTION flag
   */
  private async applyChangeInTransactionLiveSync(change: TableChange): Promise<ProcessingResult> {
    try {
      // Skip our own changes to prevent loops
      if (change.clientId === this.config.clientId) {
        return {
          change,
          success: true,
          skipped: true,
          reason: 'own_change'
        };
      }

      console.log(`[IncomingChangeService] 🔄 Live sync: Applying ${change.operation} to ${change.table} for record ${change.data.id}`);
      
      // Check if it's a domain table
      // CLIENT_DOMAIN_TABLES contains table names without quotes
      if (CLIENT_DOMAIN_TABLES.includes(change.table)) {
        await this.applyDomainTableChange(change, true); // true = live sync
      } 
      // Check if it's a junction table
      else if (CLIENT_JUNCTION_TABLE_MAPPING[change.table]) {
        console.log(`[IncomingChangeService] 🔧 Processing junction table ${change.table} with data:`, change.data);
        await this.applyJunctionTableChange(change);
      }
      // Unknown table
      else {
        throw new Error(`No incoming function support for table: ${change.table}`);
      }

      console.log(`[IncomingChangeService] ✅ Live sync: Successfully applied ${change.operation} to ${change.table} for record ${change.data.id}`);
      
      // Bridge to LiveStore tables
      await this.bridgeToLiveStore(change);
      
      // Process relationship updates if present
      if (change.relationshipUpdates && change.relationshipUpdates.length > 0) {
        console.log(`[IncomingChangeService] Processing ${change.relationshipUpdates.length} relationship updates for ${change.table}:${change.data.id}`);
        await this.applyRelationshipUpdates(change);
      }
      
      return {
        change,
        success: true
      };

    } catch (error) {
      console.error(`[IncomingChangeService] Error applying live sync ${change.operation} to ${change.table}:`, error);
      return {
        change,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Helper to merge incoming update data with existing record
   * This prevents partial updates from clearing existing fields
   */
  private async mergeUpdateData(table: any, id: string, incomingData: any): Promise<any> {
    const existing = await table.get(id);
    if (existing) {
      // Merge incoming data with existing, preserving client-side fields
      return {
        ...existing,
        ...incomingData
      };
    }
    return incomingData;
  }


  /**
   * Generic handler for domain table changes
   * Works for any table that follows the standard CRUD pattern
   * @param change - The change to apply
   * @param isLiveSync - If true, uses SYNC_TRANSACTION flag; if false, assumes tracking is already disabled
   */
  private async applyDomainTableChange(change: TableChange, isLiveSync: boolean = false): Promise<void> {
    const { db } = await import('../db/dexie-schema');
    // Use table name directly - Dexie tables use snake_case
    const dexieTable = (db as any)[change.table];
    
    if (!dexieTable) {
      throw new Error(`Dexie table not found for: ${change.table}`);
    }
    
    if (isLiveSync) {
      // LIVE SYNC: Use SYNC_TRANSACTION flag for individual operations
      const { SYNC_TRANSACTION } = await import('../db/dexie-change-tracking');
      
      await db.transaction('rw', dexieTable, async (trans) => {
        (trans as any)[SYNC_TRANSACTION] = true;
        
        switch (change.operation.toLowerCase()) {
          case 'insert':
            console.log(`[IncomingChangeService] 🔄 Live sync: Inserting ${change.table} ${change.data.id} with SYNC_TRANSACTION`);
            await dexieTable.put(change.data as any);
            break;
          
          case 'update':
            console.log(`[IncomingChangeService] 🔄 Live sync: Updating ${change.table} ${change.data.id} with SYNC_TRANSACTION`);
            const mergedData = await this.mergeUpdateData(dexieTable, change.data.id, change.data);
            await dexieTable.put(mergedData);
            break;
          
          case 'delete':
            console.log(`[IncomingChangeService] 🔄 Live sync: Deleting ${change.table} ${change.data.id} with SYNC_TRANSACTION`);
            await dexieTable.delete(change.data.id);
            break;
          
          default:
            throw new Error(`Unknown operation for ${change.table}: ${change.operation}`);
        }
      });
    } else {
      // INITIAL/CATCHUP SYNC: Change tracking is already disabled at sync phase level
      // Just apply the changes directly
      switch (change.operation.toLowerCase()) {
        case 'insert':
          console.log(`[IncomingChangeService] 📥 Initial/catchup: Inserting ${change.table} ${change.data.id}`);
          await dexieTable.put(change.data as any);
          break;
        
        case 'update':
          console.log(`[IncomingChangeService] 📥 Initial/catchup: Updating ${change.table} ${change.data.id}`);
          const mergedData = await this.mergeUpdateData(dexieTable, change.data.id, change.data);
          await dexieTable.put(mergedData);
          break;
        
        case 'delete':
          console.log(`[IncomingChangeService] 📥 Initial/catchup: Deleting ${change.table} ${change.data.id}`);
          await dexieTable.delete(change.data.id);
          break;
        
        default:
          throw new Error(`Unknown operation for ${change.table}: ${change.operation}`);
      }
    }
  }



  /**
   * Helper to match table names with entity names
   * Handles various formats: 'tasks' -> 'Task', '"tasks"' -> 'Task', etc.
   */
  private matchTableToEntity(tableName: string, entityName: string): boolean {
    // Remove quotes if present
    const cleanTable = tableName.replace(/^"(.*)"$/, '$1');
    
    // Special case handling for known irregular plurals and naming patterns
    const specialCases: Record<string, string[]> = {
      'StatusDefinition': ['status_definitions', 'statusdefinitions'],
      'StatusSet': ['status_sets', 'statussets'],
      'TagSet': ['tag_sets', 'tagsets'],
      'ChangeHistory': ['change_history', 'changehistory'],
    };
    
    // Check special cases first
    if (specialCases[entityName]) {
      if (specialCases[entityName].includes(cleanTable)) {
        return true;
      }
    }
    
    // Convert entity name to table name format (e.g., 'Task' -> 'tasks')
    const entityAsTable = entityName.toLowerCase() + 's';
    const entityAsTableAlt = entityName.toLowerCase();
    
    // Convert camelCase/PascalCase to snake_case
    const entityAsSnakeCase = entityName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
    const entityAsSnakeCasePlural = entityAsSnakeCase + 's';
    
    // Check various matching patterns
    return cleanTable === entityAsTable ||           // tasks === tasks
           cleanTable === entityAsTableAlt ||         // task === task
           cleanTable === entityName ||               // Task === Task
           cleanTable === entityName.toLowerCase() || // task === task
           cleanTable === entityAsSnakeCase ||        // status_definition === status_definition
           cleanTable === entityAsSnakeCasePlural;    // status_definitions === status_definitions
  }

  /**
   * Apply relationship updates for a change
   */
  private async applyRelationshipUpdates(change: TableChange): Promise<void> {
    if (!change.relationshipUpdates || change.relationshipUpdates.length === 0) {
      return;
    }
    
    const { db } = await import('../db/dexie-schema');
    const { RelationshipSyncHelper } = await import('./RelationshipSyncHelper');
    const { CLIENT_JUNCTION_TABLE_MAPPING } = await import('../db/client-entities');
    
    for (const update of change.relationshipUpdates) {
      // Find the junction table configuration with flexible matching
      const junctionConfig = Object.entries(CLIENT_JUNCTION_TABLE_MAPPING).find(
        ([_, config]) => {
          // Match table name flexibly
          const tableMatches = this.matchTableToEntity(change.table, config.sourceEntity) ||
                              config.sourceTable === `"${change.table}"` ||
                              config.sourceTable === change.table;
          
          return tableMatches && config.relationName === update.relationName;
        }
      );
      
      if (!junctionConfig) {
        console.warn(`[IncomingChangeService] No junction table config found for ${change.table}.${update.relationName}`);
        console.warn(`[IncomingChangeService] Available configs:`, Object.entries(CLIENT_JUNCTION_TABLE_MAPPING).map(([k, v]) => `${v.sourceEntity}.${v.relationName}`));
        continue;
      }
      
      const [junctionTable, config] = junctionConfig;
      
      try {
        await RelationshipSyncHelper.processIncomingRelationshipUpdates(
          change,
          junctionTable,
          config.sourceColumn,
          config.targetColumn,
          db
        );
        
        console.log(`[IncomingChangeService] Successfully processed relationship update for ${change.table}.${update.relationName}`);
      } catch (error) {
        console.error(`[IncomingChangeService] Error processing relationship update for ${change.table}.${update.relationName}:`, error);
        throw error;
      }
    }
  }
  

  /**
   * Convert snake_case field names to camelCase
   */
  private convertJunctionTableFieldNames(data: any, table: string): any {
    const converted = { ...data };
    
    // Convert all snake_case fields to camelCase
    for (const [key, value] of Object.entries(converted)) {
      if (key.includes('_')) {
        const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        converted[camelCaseKey] = value;
        delete converted[key];
      }
    }
    
    return converted;
  }
  
  /**
   * Apply junction table changes using Dexie only
   */
  private async applyJunctionTableChange(change: TableChange): Promise<void> {
    const { db } = await import('../db/dexie-schema');
    const table = change.table;
    
    // Convert snake_case field names to camelCase for Dexie
    const convertedData = this.convertJunctionTableFieldNames(change.data, table);
    
    switch (change.operation.toLowerCase()) {
      case 'insert':
        console.log(`[IncomingChangeService] 🗄️ Dexie: Inserting into junction table ${table}`, convertedData);
        await (db as any)[table].put(convertedData);
        break;
      
      case 'update':
        console.log(`[IncomingChangeService] 🗄️ Dexie: Updating junction table ${table}`, convertedData);
        await (db as any)[table].put(convertedData);
        break;
      
      case 'delete':
        console.log(`[IncomingChangeService] 🗄️ Dexie: Deleting from junction table ${table}`);
        // Junction tables typically use composite keys, so we need to handle deletion differently
        const junctionData = change.data as any;
        if (table === 'project_members' && junctionData.projectId && junctionData.userId) {
          await db.projectMembers.where('[projectId+userId]').equals([junctionData.projectId, junctionData.userId]).delete();
        } else if (table === 'task_tags' && junctionData.taskId && junctionData.tagId) {
          await db.taskTags.where('[taskId+tagId]').equals([junctionData.taskId, junctionData.tagId]).delete();
        } else if (table === 'project_status_sets' && junctionData.projectId && junctionData.statusSetId) {
          await db.projectStatusSets.where('[projectId+statusSetId]').equals([junctionData.projectId, junctionData.statusSetId]).delete();
        } else if (table === 'project_tag_sets' && junctionData.projectId && junctionData.tagSetId) {
          await db.projectTagSets.where('[projectId+tagSetId]').equals([junctionData.projectId, junctionData.tagSetId]).delete();
        } else if (table === 'task_dependencies' && junctionData.dependentTaskId && junctionData.dependencyTaskId) {
          await db.taskDependencies.where('[dependentTaskId+dependencyTaskId]').equals([junctionData.dependentTaskId, junctionData.dependencyTaskId]).delete();
        } else {
          console.warn(`[IncomingChangeService] Unable to delete from junction table ${table} - missing key fields`);
        }
        break;
      
      default:
        throw new Error(`Unknown junction table operation: ${change.operation}`);
    }
  }

  /**
   * Bridge incoming changes to LiveStore tables
   * This populates LiveStore tables when sync messages are received
   */
  private async bridgeToLiveStore(change: TableChange): Promise<void> {
    try {
      const liveStoreClient = getLiveStoreClient();
      if (!liveStoreClient) {
        // LiveStore not available - this is fine, just skip
        return;
      }

      // Map table names to LiveStore entity types
      const tableToEntityMapping: Record<string, string> = {
        'project': 'project',
        'task': 'task', 
        'comment': 'comment',
        'user': 'user',
        'client': 'client',
        'timesheet': 'timesheet',
        'skill': 'skill'
      };

      const entityType = tableToEntityMapping[change.table];
      if (!entityType) {
        // Table not mapped to LiveStore - skip
        console.log(`[IncomingChangeService] 📡 Skipping LiveStore bridge for unmapped table: ${change.table}`);
        return;
      }

      // Get organization ID from the data
      const organizationId = change.data.organizationId || change.data.organization_id;
      if (!organizationId) {
        console.warn(`[IncomingChangeService] 📡 No organization ID found for LiveStore bridge: ${change.table}:${change.data.id}`);
        return;
      }

      // Apply change to LiveStore table
      const liveStoreTableName = `org_${organizationId.replace(/-/g, '_')}_${entityType}`;
      
      console.log(`[IncomingChangeService] 📡 Bridging ${change.operation} to LiveStore table: ${liveStoreTableName}`);

      switch (change.operation.toLowerCase()) {
        case 'insert':
          await liveStoreClient.insert(liveStoreTableName, change.data);
          console.log(`[IncomingChangeService] ✅ LiveStore: Inserted ${entityType} ${change.data.id}`);
          break;
          
        case 'update':
          await liveStoreClient.update(liveStoreTableName, change.data.id, change.data);
          console.log(`[IncomingChangeService] ✅ LiveStore: Updated ${entityType} ${change.data.id}`);
          break;
          
        case 'delete':
          await liveStoreClient.delete(liveStoreTableName, change.data.id);
          console.log(`[IncomingChangeService] ✅ LiveStore: Deleted ${entityType} ${change.data.id}`);
          break;
          
        default:
          console.warn(`[IncomingChangeService] 📡 Unknown operation for LiveStore bridge: ${change.operation}`);
      }

      // Emit event for debug/monitoring
      window.dispatchEvent(new CustomEvent('livestore:sync:bridged', {
        detail: {
          table: liveStoreTableName,
          operation: change.operation,
          entityId: change.data.id,
          entityType,
          organizationId
        }
      }));

    } catch (error) {
      // Don't fail the entire sync process if LiveStore bridge fails
      console.error(`[IncomingChangeService] ⚠️ LiveStore bridge failed for ${change.table}:${change.data.id}:`, error);
    }
  }

} 