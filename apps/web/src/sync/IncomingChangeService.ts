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
      
      // Call domain-specific bulk function
      let insertedEntities: any[] = [];
      
      switch (table) {
        case 'tasks':
          const { bulkCreateTasksIncoming } = await import('../domain/task');
          insertedEntities = await bulkCreateTasksIncoming(entitiesData as any);
          break;
          
        case 'comments':
          const { bulkCreateCommentsIncoming } = await import('../domain/comment');
          insertedEntities = await bulkCreateCommentsIncoming(entitiesData as any);
          break;
          
        case 'projects':
          const { bulkCreateProjectsIncoming } = await import('../domain/project');
          insertedEntities = await bulkCreateProjectsIncoming(entitiesData as any);
          break;
          
        case 'users':
          const { bulkCreateUsersIncoming } = await import('../domain/user');
          insertedEntities = await bulkCreateUsersIncoming(entitiesData as any);
          break;
          
        default:
          // Fallback to individual processing for unknown tables
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
      
      console.log(`[IncomingChangeService] ✅ Bulk inserted ${insertedEntities.length} ${table} entities`);
      
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
      // For now, fall back to individual processing since bulk update operations
      // are not yet implemented in domain services
      console.log(`[IncomingChangeService] No bulk update handler for ${table}, processing individually`);
      
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

      console.log(`[IncomingChangeService] Applying ${change.operation} to ${change.table} for record ${change.data.id}`);
      
      // Use incoming path functions for clean separation
      switch (change.table) {
        case 'tasks':
          await this.applyTaskChange(change);
          break;
        case 'projects':
          await this.applyProjectChange(change);
          break;
        case 'users':
          await this.applyUserChange(change);
          break;
        case 'comments':
          await this.applyCommentChange(change);
          break;
        case 'status_sets':
          await this.applyStatusSetChange(change);
          break;
        case 'status_definitions':
          await this.applyStatusDefinitionChange(change);
          break;
        case 'tags':
          await this.applyTagChange(change);
          break;
        case 'tag_sets':
          await this.applyTagSetChange(change);
          break;
        default:
          throw new Error(`No incoming function support for table: ${change.table}`);
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

  /**
   * Apply task changes using incoming path functions
   */
  private async applyTaskChange(change: TableChange): Promise<void> {
    const { createTaskIncoming, updateTaskIncoming, deleteTaskIncoming } = await import('../domain/task');
    
    switch (change.operation) {
      case 'insert':
        await createTaskIncoming(change.data as any);
        break;
      
      case 'update':
        await updateTaskIncoming(change.data.id, change.data);
        break;
      
      case 'delete':
        await deleteTaskIncoming(change.data.id);
        break;
      
      default:
        throw new Error(`Unknown task operation: ${change.operation}`);
    }
  }

  /**
   * Apply project changes using incoming path functions
   */
  private async applyProjectChange(change: TableChange): Promise<void> {
    const { createProjectIncoming, updateProjectIncoming, deleteProjectIncoming } = await import('../domain/project');
    
    switch (change.operation) {
      case 'insert':
        await createProjectIncoming(change.data as any);
        break;
      
      case 'update':
        await updateProjectIncoming(change.data.id, change.data);
        break;
      
      case 'delete':
        await deleteProjectIncoming(change.data.id);
        break;
      
      default:
        throw new Error(`Unknown project operation: ${change.operation}`);
    }
  }

  /**
   * Apply user changes using incoming path functions
   */
  private async applyUserChange(change: TableChange): Promise<void> {
    const { createUserIncoming, updateUserIncoming, deleteUserIncoming } = await import('../domain/user');
    
    switch (change.operation) {
      case 'insert':
        await createUserIncoming(change.data as any);
        break;
      
      case 'update':
        await updateUserIncoming(change.data.id, change.data);
        break;
      
      case 'delete':
        await deleteUserIncoming(change.data.id);
        break;
      
      default:
        throw new Error(`Unknown user operation: ${change.operation}`);
    }
  }

  /**
   * Apply comment changes using incoming path functions
   */
  private async applyCommentChange(change: TableChange): Promise<void> {
    const { createCommentIncoming, updateCommentIncoming, deleteCommentIncoming } = await import('../domain/comment');
    
    switch (change.operation) {
      case 'insert':
        await createCommentIncoming(change.data as any);
        break;
      
      case 'update':
        await updateCommentIncoming(change.data.id, change.data);
        break;
      
      case 'delete':
        await deleteCommentIncoming(change.data.id);
        break;
      
      default:
        throw new Error(`Unknown comment operation: ${change.operation}`);
    }
  }

  /**
   * Apply status set changes using incoming path functions
   */
  private async applyStatusSetChange(change: TableChange): Promise<void> {
    const { insertStatusSetIncoming, updateStatusSetIncoming, deleteStatusSetIncoming } = await import('../domain/status-set');
    
    switch (change.operation) {
      case 'insert':
        await insertStatusSetIncoming(change.data as any);
        break;
      
      case 'update':
        await updateStatusSetIncoming(change.data.id, change.data);
        break;
      
      case 'delete':
        await deleteStatusSetIncoming(change.data.id);
        break;
      
      default:
        throw new Error(`Unknown status set operation: ${change.operation}`);
    }
  }

  /**
   * Apply status definition changes using incoming path functions
   */
  private async applyStatusDefinitionChange(change: TableChange): Promise<void> {
    const { insertStatusDefinitionIncoming, updateStatusDefinitionIncoming, deleteStatusDefinitionIncoming } = await import('../domain/status-definition');
    
    switch (change.operation) {
      case 'insert':
        await insertStatusDefinitionIncoming(change.data as any);
        break;
      
      case 'update':
        await updateStatusDefinitionIncoming(change.data.id, change.data);
        break;
      
      case 'delete':
        await deleteStatusDefinitionIncoming(change.data.id);
        break;
      
      default:
        throw new Error(`Unknown status definition operation: ${change.operation}`);
    }
  }

  /**
   * Apply tag changes using incoming path functions
   */
  private async applyTagChange(change: TableChange): Promise<void> {
    const { insertTagIncoming, updateTagIncoming, deleteTagIncoming } = await import('../domain/tag');
    
    switch (change.operation) {
      case 'insert':
        await insertTagIncoming(change.data as any);
        break;
      
      case 'update':
        await updateTagIncoming(change.data.id, change.data);
        break;
      
      case 'delete':
        await deleteTagIncoming(change.data.id);
        break;
      
      default:
        throw new Error(`Unknown tag operation: ${change.operation}`);
    }
  }

  /**
   * Apply tag set changes using incoming path functions
   */
  private async applyTagSetChange(change: TableChange): Promise<void> {
    const { insertTagSetIncoming, updateTagSetIncoming, deleteTagSetIncoming } = await import('../domain/tag-set');
    
    switch (change.operation) {
      case 'insert':
        await insertTagSetIncoming(change.data as any);
        break;
      
      case 'update':
        await updateTagSetIncoming(change.data.id, change.data);
        break;
      
      case 'delete':
        await deleteTagSetIncoming(change.data.id);
        break;
      
      default:
        throw new Error(`Unknown tag set operation: ${change.operation}`);
    }
  }

} 