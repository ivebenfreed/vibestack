/**
 * IncomingChangeService - Pure incoming change service
 * 
 * Handles incoming change processing and application without state management.
 * Reports progress and results via callbacks rather than maintaining internal state.
 * 
 * Part of Phase 2: Pure Services Extraction
 */

import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { TableChange } from '@repo/sync-types';
import { createAllDomains } from '../domain/lib';

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
  private dataSource: NewPGliteDataSource;
  private callbacks: IncomingChangeServiceCallbacks = {};
  private isProcessing = false;
  private domainServices: Awaited<ReturnType<typeof createAllDomains>> | null = null;
  
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
    dataSource: NewPGliteDataSource
  ) {
    this.config = config;
    this.dataSource = dataSource;
    console.log('[IncomingChangeService] Initialized with config:', config);
  }

  /**
   * Initialize domain services
   */
  private async initializeDomainServices(): Promise<void> {
    if (!this.domainServices) {
      console.log('[IncomingChangeService] Initializing domain services...');
      
      // For incoming sync processing, we can pass null since we don't want to track outgoing changes
      const syncManager = null as any; // Domain services won't track outgoing changes for incoming sync
      
      this.domainServices = createAllDomains(this.dataSource, syncManager);
      console.log('[IncomingChangeService] Domain services initialized');
    }
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

      // Initialize domain services if needed
      await this.initializeDomainServices();

      const batchSize = this.config.batchSize || 50;
      
      // Process in batches
      for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);
        const batchResults = await this.processBatch(batch);
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

  /**
   * Get domain service for a table
   */
  private getDomainService(table: string): any {
    if (!this.domainServices) {
      throw new Error('Domain services not initialized');
    }

    switch (table) {
      case 'tasks':
        return this.domainServices.task.service;
      case 'projects':
        return this.domainServices.project.service;
      case 'users':
        return this.domainServices.user.service;
      case 'comments':
        return this.domainServices.comment.service;
      default:
        throw new Error(`No domain service found for table: ${table}`);
    }
  }

  // Private methods

  private async processBatch(batch: TableChange[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    try {
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
          // Add error results for all changes in this group
          for (const change of changes) {
            results.push({
              change,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    } catch (error) {
      console.error('[IncomingChangeService] Error in batch processing:', error);
      // Fallback: add error results for all changes
      for (const change of batch) {
        results.push({
          change,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
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
   * Process bulk inserts using domain service bulk operations
   */
  private async processBulkInserts(table: string, changes: TableChange[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    try {
      const domainService = this.getDomainService(table);
      
      // Check if domain service supports bulk operations
      if (typeof domainService.bulkCreateFromSync === 'function') {
        console.log(`[IncomingChangeService] Using bulkCreateFromSync for ${changes.length} ${table} entities`);
        
        // Extract data for bulk insert
        const entities = changes.map(change => change.data);
        const startTime = Date.now();
        
        // Perform bulk insert
        await domainService.bulkCreateFromSync(entities);
        
        const processingTime = Date.now() - startTime;
        const throughput = changes.length / (processingTime / 1000);
        console.log(`[IncomingChangeService] Successfully bulk inserted ${changes.length} ${table} entities in ${processingTime}ms (${throughput.toFixed(0)} entities/sec)`);
        
        // Create success results for all changes
        for (const change of changes) {
          results.push({
            change,
            success: true
          });
        }
      } else {
        console.warn(`[IncomingChangeService] Domain service for ${table} doesn't support bulkCreateFromSync, falling back to individual processing`);
        
        // Fallback to individual processing
        for (const change of changes) {
          try {
            await domainService.createFromSync(change.data);
            results.push({
              change,
              success: true
            });
          } catch (error) {
            console.error(`[IncomingChangeService] Individual insert failed for ${table}:${change.data.id}:`, error);
            results.push({
              change,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    } catch (error) {
      console.error(`[IncomingChangeService] Bulk insert failed for ${table}:`, error);
      
      // Create error results for all changes
      for (const change of changes) {
        results.push({
          change,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }

  private async applyChange(change: TableChange): Promise<ProcessingResult> {
    return await this.dataSource.manager.transaction(async (transactionalEntityManager: any) => {
      return await this.applyChangeInTransaction(change, transactionalEntityManager);
    });
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

      // Use domain services instead of direct repository access
      const domainService = this.getDomainService(change.table);
      
      console.log(`[IncomingChangeService] Applying ${change.operation} to ${change.table} for record ${change.data.id}`);
      
      switch (change.operation) {
        case 'insert':
          await domainService.createFromSync(change.data);
          break;
        
        case 'update':
          await domainService.updateFromSync(change.data.id, change.data);
          break;
        
        case 'delete':
          await domainService.deleteFromSync(change.data.id);
          break;
        
        default:
          throw new Error(`Unknown operation: ${change.operation}`);
      }

      console.log(`[IncomingChangeService] Successfully applied ${change.operation} to ${change.table} for record ${change.data.id}`);
      
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

} 