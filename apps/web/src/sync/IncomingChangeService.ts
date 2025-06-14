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

  // Private methods

  private async processBatch(batch: TableChange[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    // Use database transaction for batch consistency
    await this.dataSource.manager.transaction(async (transactionalEntityManager: any) => {
      for (const change of batch) {
        try {
          const result = await this.applyChangeInTransaction(change, transactionalEntityManager);
          results.push(result);
        } catch (error) {
          console.error(`[IncomingChangeService] Error in batch processing for ${change.table}:`, error);
          results.push({
            change,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });

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

      const repository = entityManager.getRepository(change.table);
      
      switch (change.operation) {
        case 'insert':
          return await this.handleInsert(change, repository);
        
        case 'update':
          return await this.handleUpdate(change, repository);
        
        case 'delete':
          return await this.handleDelete(change, repository);
        
        default:
          throw new Error(`Unknown operation: ${change.operation}`);
      }

    } catch (error) {
      console.error(`[IncomingChangeService] Error applying ${change.operation} to ${change.table}:`, error);
      return {
        change,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async handleInsert(change: TableChange, repository: any): Promise<ProcessingResult> {
    try {
      // Check if record already exists (potential conflict)
      const existing = await repository.findOne({ where: { id: change.data.id } });
      
      if (existing) {
        // Handle conflict based on configuration
        const resolution = await this.resolveConflict(change, existing);
        
        if (resolution === 'server-wins') {
          // Server data wins, update the existing record
          await repository.update(change.data.id, change.data);
          this.callbacks.onConflictDetected?.(change, existing, 'server-wins');
          
          return {
            change,
            success: true,
            conflictResolved: true
          };
        } else {
          // Client data wins, skip the change
          this.callbacks.onConflictDetected?.(change, existing, 'client-wins');
          
          return {
            change,
            success: true,
            skipped: true,
            reason: 'conflict_client_wins'
          };
        }
      }

      // No conflict, insert the record
      await repository.insert(change.data);
      
      return {
        change,
        success: true
      };

    } catch (error) {
      return {
        change,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async handleUpdate(change: TableChange, repository: any): Promise<ProcessingResult> {
    try {
      // Check if record exists
      const existing = await repository.findOne({ where: { id: change.data.id } });
      
      if (!existing) {
        // Record doesn't exist, treat as insert
        await repository.insert(change.data);
        
        return {
          change,
          success: true,
          reason: 'update_as_insert'
        };
      }

      // Check for conflicts based on timestamp
      const resolution = await this.resolveConflict(change, existing);
      
      if (resolution === 'server-wins') {
        await repository.update(change.data.id, change.data);
        
        return {
          change,
          success: true,
          conflictResolved: true
        };
      } else if (resolution === 'no-conflict') {
        // No conflict, just update
        await repository.update(change.data.id, change.data);
        
        return {
          change,
          success: true,
          conflictResolved: false
        };
      } else {
        // Client data wins, skip the update
        this.callbacks.onConflictDetected?.(change, existing, 'client-wins');
        
        return {
          change,
          success: true,
          skipped: true,
          reason: 'conflict_client_wins'
        };
      }

    } catch (error) {
      return {
        change,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async handleDelete(change: TableChange, repository: any): Promise<ProcessingResult> {
    try {
      // Check if record exists
      const existing = await repository.findOne({ where: { id: change.data.id } });
      
      if (!existing) {
        // Record doesn't exist, consider it already deleted
        return {
          change,
          success: true,
          skipped: true,
          reason: 'already_deleted'
        };
      }

      // Check for conflicts
      const resolution = await this.resolveConflict(change, existing);
      
      if (resolution === 'server-wins') {
        await repository.delete(change.data.id);
        
        return {
          change,
          success: true,
          conflictResolved: true
        };
      } else if (resolution === 'no-conflict') {
        // No conflict, just delete
        await repository.delete(change.data.id);
        
        return {
          change,
          success: true,
          conflictResolved: false
        };
      } else {
        // Client data wins, keep the record
        this.callbacks.onConflictDetected?.(change, existing, 'client-wins');
        
        return {
          change,
          success: true,
          skipped: true,
          reason: 'conflict_client_wins'
        };
      }

    } catch (error) {
      return {
        change,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async resolveConflict(change: TableChange, existingData: any): Promise<'client-wins' | 'server-wins' | 'no-conflict'> {
    // Simple timestamp-based conflict resolution
    if (this.config.conflictResolution === 'server-wins') {
      return 'server-wins';
    }
    
    if (this.config.conflictResolution === 'client-wins') {
      return 'client-wins';
    }

    // Timestamp-based resolution (default)
    const changeTime = new Date(change.updatedAt);
    const existingTime = new Date(existingData.updatedAt || existingData.updated_at);
    
    if (changeTime > existingTime) {
      return 'server-wins'; // Server change is newer
    } else if (changeTime < existingTime) {
      return 'client-wins'; // Client data is newer
    } else {
      return 'no-conflict'; // Same timestamp, no conflict
    }
  }
} 