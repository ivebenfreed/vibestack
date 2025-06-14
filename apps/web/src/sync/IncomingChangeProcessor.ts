import { TableChange } from '@repo/sync-types';
/**
 * @deprecated This class is being replaced by IncomingChangeService in the pure services architecture.
 * Use IncomingChangeService instead for new implementations.
 */

import { SyncEventEmitter } from './SyncEventEmitter';
import { getNewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { createAllDomains } from '../domain/lib';

const INCOMING_BATCH_SIZE = 500; // 🔥 UPDATED: Match server WS_CHUNK_SIZE 
const INITIAL_SYNC_BATCH_SIZE = 500; // 🔥 UPDATED: Match server DEFAULT_CHUNK_SIZE for consistency

// Add this interface at the top before the class
interface GlobalIncomingChangeProcessor {
  instance: IncomingChangeProcessor | null;
  instanceCount: number;
}

// Declare global scope for HMR-stable singleton
declare global {
  interface Window {
    __incomingChangeProcessor?: GlobalIncomingChangeProcessor;
  }
}

/**
 * Enhanced IncomingChangeProcessor with "Server as Single Source of Truth" strategy
 * - Server changes always win over client state
 * - Optimistic updates are handled gracefully
 * - No client-side conflict resolution needed
 * - Calls domain services directly for cleaner architecture
 * - HMR-stable singleton pattern
 */
export class IncomingChangeProcessor {
  // Use global window scope for HMR-stable singleton
  private static getGlobalState(): GlobalIncomingChangeProcessor {
    if (typeof window !== 'undefined') {
      if (!window.__incomingChangeProcessor) {
        window.__incomingChangeProcessor = {
          instance: null,
          instanceCount: 0
        };
      }
      return window.__incomingChangeProcessor;
    }
    // Fallback for SSR/Node environments
    return { instance: null, instanceCount: 0 };
  }

  private static get instance(): IncomingChangeProcessor | null {
    return this.getGlobalState().instance;
  }

  private static set instance(value: IncomingChangeProcessor | null) {
    this.getGlobalState().instance = value;
  }

  private static get instanceCount(): number {
    return this.getGlobalState().instanceCount;
  }

  private static set instanceCount(value: number) {
    this.getGlobalState().instanceCount = value;
  }

  private instanceId: number;
  private isDisposed = false;
  
  private domainServices: Awaited<ReturnType<typeof createAllDomains>> | null = null;
  private events: SyncEventEmitter;
  private isProcessing: boolean = false;
  private pendingOptimisticUpdates: Map<string, TableChange> = new Map(); // Track optimistic updates
  private isInitialSync: boolean = false; // Track if we're in initial sync mode

  constructor(eventEmitter: SyncEventEmitter) {
    // Dispose existing instance to prevent multiple processors
    if (IncomingChangeProcessor.instance) {
      console.warn('[IncomingChangeProcessor] Disposing of existing instance due to HMR');
      IncomingChangeProcessor.instance.dispose();
    }

    this.instanceId = ++IncomingChangeProcessor.instanceCount;
    IncomingChangeProcessor.instance = this;
    this.events = eventEmitter;

    console.log(`[IncomingChangeProcessor] Created HMR-stable instance ${this.instanceId}`);
    
    // Add debugging to track active instances
    console.log(`[IncomingChangeProcessor] Active instance count: ${IncomingChangeProcessor.instanceCount}`);
    console.log(`[IncomingChangeProcessor] Current singleton instance ID: ${this.instanceId}`);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    
    this.isDisposed = true;
    this.isProcessing = false;
    this.pendingOptimisticUpdates.clear();
    
    if (IncomingChangeProcessor.instance === this) {
      IncomingChangeProcessor.instance = null;
    }
    
    console.log(`[IncomingChangeProcessor] Disposed instance ${this.instanceId}`);
  }

  private checkActive(): boolean {
    if (this.isDisposed) {
      console.warn(`[IncomingChangeProcessor] Instance ${this.instanceId} is disposed, ignoring operation`);
      return false;
    }
    return true;
  }

  private detectBulkSync(messageType: string): boolean {
    return messageType === 'srv_catchup_changes' || messageType === 'srv_init_changes';
  }

  private detectInitialSync(messageType: string): boolean {
    return messageType === 'srv_init_changes';
  }

  private getBatchSize(messageType: string): number {
    if (this.detectInitialSync(messageType)) {
      return INITIAL_SYNC_BATCH_SIZE;
    }
    return INCOMING_BATCH_SIZE;
  }

  /**
   * Initialize domain services
   */
  private async initializeDomainServices(): Promise<void> {
    if (!this.domainServices) {
      console.log('[IncomingChangeProcessor] Initializing domain services...');
      
      // Get the required dependencies
      const dataSource = await getNewPGliteDataSource();
      
      // We need an OutgoingChangeProcessor for the domain services
      // For incoming sync processing, we can pass null since we don't want to track outgoing changes
      const syncManager = null as any; // Domain services won't track outgoing changes for incoming sync
      
      this.domainServices = createAllDomains(dataSource, syncManager);
      console.log('[IncomingChangeProcessor] Domain services initialized');
    }
  }

  /**
   * Processes a batch of incoming changes from the server
   * Strategy: Server is single source of truth - all server changes are applied unconditionally
   * 🔥 NEW: Routes to optimized processing based on sync phase
   */
  public async processIncomingChanges(changes: TableChange[], messageType: string): Promise<boolean> {
    // Check if this instance is still active (not disposed due to HMR)
    if (!this.checkActive()) {
      return false;
    }
    
    if (this.isProcessing) {
      console.warn(`IncomingChangeProcessor[${this.instanceId}]: Already processing a batch, skipping new batch from ${messageType}`);
      return false;
    }
    if (!changes || changes.length === 0) {
      console.log(`IncomingChangeProcessor[${this.instanceId}]: No changes to process for ${messageType}.`);
      return true;
    }

    // Add debugging to detect potential double processing
    console.log(`IncomingChangeProcessor[${this.instanceId}]: STARTING to process ${changes.length} changes from ${messageType}`);
    console.log(`IncomingChangeProcessor[${this.instanceId}]: Current singleton instance: ${IncomingChangeProcessor.instance?.instanceId || 'null'}`);
    console.log(`IncomingChangeProcessor[${this.instanceId}]: Am I the singleton? ${IncomingChangeProcessor.instance === this}`);
    
    // Additional check: only the singleton instance should process
    if (IncomingChangeProcessor.instance !== this) {
      console.error(`IncomingChangeProcessor[${this.instanceId}]: ❌ NON-SINGLETON INSTANCE trying to process changes! This causes double processing.`);
      console.error(`IncomingChangeProcessor[${this.instanceId}]: Current singleton is instance ${IncomingChangeProcessor.instance?.instanceId}`);
      return false;
    }

    this.isProcessing = true;
    const batchSize = this.getBatchSize(messageType);
    const isInitialSync = this.detectInitialSync(messageType);
    const isBulkSync = this.detectBulkSync(messageType);
    
    console.log(`IncomingChangeProcessor[${this.instanceId}]: Processing ${changes.length} server changes with "server as truth" strategy (${messageType}) - ${isInitialSync ? 'INITIAL SYNC' : isBulkSync ? 'CATCHUP SYNC' : 'LIVE SYNC'} mode, batch size: ${batchSize}...`);
    const startTime = Date.now();

    try {
      // Check again if we're still active before proceeding
      if (!this.checkActive()) {
        return false;
      }
      
      // Initialize domain services if needed
      await this.initializeDomainServices();
      
      // Step 1: Handle optimistic updates that might conflict with incoming server changes
      // Skip this for bulk sync operations to save processing time
      if (!isBulkSync) {
        await this.handleOptimisticUpdateConflicts(changes);
      } else {
        console.log(`[${isInitialSync ? 'InitialSync' : 'CatchupSync'}] Skipping optimistic update conflict handling for bulk sync`);
      }

      // Check again if we're still active before proceeding
      if (!this.checkActive()) {
        return false;
      }

      // 🔥 NEW: Route to specialized processing based on sync type
      let processingResult: boolean;
      if (isInitialSync) {
        processingResult = await this.processInitialSyncBatch(changes);
      } else if (isBulkSync) {
        processingResult = await this.processCatchupSyncBatch(changes, batchSize);
      } else {
        processingResult = await this.processLiveSyncBatch(changes);
      }

      if (!processingResult) {
        throw new Error('Processing failed');
      }

      const processingTime = Date.now() - startTime;
      console.log(`IncomingChangeProcessor[${this.instanceId}]: Successfully applied ${changes.length} server changes in ${processingTime}ms (${messageType}) - ${(changes.length / (processingTime / 1000)).toFixed(0)} changes/sec.`);
      
      this.events.emit('incoming_changes_processed', { 
        success: true, 
        count: changes.length, 
        type: messageType,
        strategy: 'server_as_truth',
        isInitialSync,
        isBulkSync,
        syncMode: isInitialSync ? 'initial' : isBulkSync ? 'catchup' : 'live',
        processingTimeMs: processingTime,
        throughputPerSec: changes.length / (processingTime / 1000)
      });
      
      return true;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`IncomingChangeProcessor[${this.instanceId}]: Error processing incoming changes (${messageType}) after ${processingTime}ms:`, error);
      
      this.events.emit('incoming_changes_processed', { 
        success: false, 
        count: changes.length, 
        type: messageType,
        error: error instanceof Error ? error.message : String(error),
        strategy: 'server_as_truth',
        isInitialSync,
        isBulkSync,
        syncMode: isInitialSync ? 'initial' : isBulkSync ? 'catchup' : 'live',
        processingTimeMs: processingTime
      });
      
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  // 🔥 NEW: Specialized processing methods for each sync type

  /**
   * Process initial sync batch - OPTIMIZED for bulk operations
   * Initial sync has homogeneous batches (all same entity type) perfect for bulk operations
   */
  private async processInitialSyncBatch(changes: TableChange[]): Promise<boolean> {
    if (!changes.length) return true;
    
    // Verify assumption: all changes should be same entity type in initial sync
    const entityTypes = new Set(changes.map(change => change.table));
    if (entityTypes.size > 1) {
      console.warn(`[InitialSync] Unexpected: Initial sync batch contains multiple entity types: ${Array.from(entityTypes).join(', ')}`);
             // Fall back to individual processing if assumption is violated
       return await this.applyServerChanges(changes);
    }

    const entityType = changes[0].table;
    const operation = changes[0].operation;
    
    console.log(`[InitialSync] Processing ${changes.length} ${operation} operations for ${entityType} using bulk optimization`);
    
    try {
      if (operation === 'insert') {
        await this.processBulkInserts(entityType, changes);
      } else {
        // For updates/deletes, process individually (less common in initial sync)
        console.log(`[InitialSync] Falling back to individual processing for ${operation} operations`);
        return await this.applyServerChanges(changes);
      }
      return true;
    } catch (error) {
      console.error(`[InitialSync] Bulk processing failed for ${entityType}, falling back to individual processing:`, error);
      
      // Enhanced error logging for debugging bulk insert failures
      console.error(`[InitialSync] BULK INSERT ERROR DETAILS:`, {
        entityType,
        changeCount: changes.length,
        operation: changes[0]?.operation,
        firstChangeId: changes[0]?.data?.id,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        sampleData: changes.slice(0, 3).map(c => ({ id: c.data.id, table: c.table }))
      });
      
      // Fallback to individual processing
      return await this.applyServerChanges(changes);
    }
  }

  /**
   * Process catchup sync batch - ORDERED processing with mini-bulk optimization
   * Catchup sync must maintain WAL order but can optimize consecutive same-type operations
   */
  private async processCatchupSyncBatch(changes: TableChange[], batchSize: number): Promise<boolean> {
    console.log(`[CatchupSync] Processing ${changes.length} changes with ordered processing and mini-bulk optimization`);
    
    // Group consecutive changes by entity type to create mini-bulk opportunities
    const groups = this.groupConsecutiveByEntityType(changes);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (const group of groups) {
      try {
        if (group.length > 1 && group[0].operation === 'insert') {
          // Mini-bulk processing for consecutive inserts of same type
          console.log(`[CatchupSync] Mini-bulk processing ${group.length} ${group[0].operation} operations for ${group[0].table}`);
          await this.processBulkInserts(group[0].table, group);
          successCount += group.length;
        } else {
          // Individual processing for mixed operations or single changes
          for (const change of group) {
            try {
              await this.processServerChange(change);
              successCount++;
            } catch (error) {
              errorCount++;
              console.error(`[CatchupSync] Error processing ${change.table}:${change.data.id}:`, error);
            }
          }
        }
        processedCount += group.length;
      } catch (error) {
        errorCount += group.length;
        console.error(`[CatchupSync] Error processing group of ${group.length} changes:`, error);
      }
    }
    
    console.log(`[CatchupSync] Processed ${processedCount} changes: ${successCount} successful, ${errorCount} errors`);
    return errorCount === 0;
  }

  /**
   * Process live sync batch - INDIVIDUAL processing for low latency
   * Live sync prioritizes responsiveness over throughput
   */
  private async processLiveSyncBatch(changes: TableChange[]): Promise<boolean> {
    console.log(`[LiveSync] Processing ${changes.length} changes with individual processing for low latency`);
    
    // Process individually for immediate responsiveness
    return await this.applyServerChanges(changes);
  }

  /**
   * Group consecutive changes by entity type and operation for mini-bulk optimization
   * Maintains WAL order while creating bulk opportunities
   */
  private groupConsecutiveByEntityType(changes: TableChange[]): TableChange[][] {
    if (!changes.length) return [];
    
    const groups: TableChange[][] = [];
    let currentGroup: TableChange[] = [changes[0]];
    
    for (let i = 1; i < changes.length; i++) {
      const current = changes[i];
      const previous = changes[i - 1];
      
      // Group if same table and operation
      if (current.table === previous.table && current.operation === previous.operation) {
        currentGroup.push(current);
      } else {
        // Start new group
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }
    
    // Add the last group
    groups.push(currentGroup);
    
    const totalChanges = groups.reduce((sum, group) => sum + group.length, 0);
    console.log(`[CatchupSync] Grouped ${totalChanges} changes into ${groups.length} mini-batches`);
    
    return groups;
  }

  /**
   * Process bulk inserts for a single entity type using TypeORM bulk operations
   * Single transaction for maximum performance
   */
  private async processBulkInserts(entityType: string, changes: TableChange[]): Promise<void> {
    if (!this.domainServices) {
      throw new Error('Domain services not initialized');
    }

    console.log(`[BulkInsert] Processing ${changes.length} bulk inserts for ${entityType}`);
    const startTime = Date.now();
    
    try {
      const domainService = this.getDomainService(entityType);
      
      // Check if domain service supports bulk operations
      if (typeof domainService.bulkCreateFromSync === 'function') {
        // Use optimized bulk create method
        const entities = changes.map(change => change.data);
        await domainService.bulkCreateFromSync(entities);
        
        const processingTime = Date.now() - startTime;
        const throughput = changes.length / (processingTime / 1000);
        console.log(`[BulkInsert] Successfully bulk inserted ${changes.length} ${entityType} entities in ${processingTime}ms (${throughput.toFixed(0)} entities/sec)`);
      } else {
        // Fallback to individual processing if bulk method not available
        console.warn(`[BulkInsert] Domain service for ${entityType} doesn't support bulkCreateFromSync, falling back to individual processing`);
        for (const change of changes) {
          await domainService.createFromSync(change.data);
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`[BulkInsert] Fallback: individually processed ${changes.length} ${entityType} entities in ${processingTime}ms`);
      }
    } catch (error) {
      console.error(`[BulkInsert] Error in bulk insert for ${entityType}:`, error);
      
      // Enhanced error logging for domain service bulk insert failures
      console.error(`[BulkInsert] DOMAIN SERVICE ERROR DETAILS:`, {
        entityType,
        changeCount: changes.length,
        domainServiceExists: !!this.getDomainService(entityType),
        hasBulkMethod: typeof this.getDomainService(entityType).bulkCreateFromSync === 'function',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      throw error;
    }
  }

  /**
   * Handle optimistic updates that might conflict with incoming server changes
   * Strategy: Server changes take precedence, discard conflicting optimistic updates
   */
  private async handleOptimisticUpdateConflicts(serverChanges: TableChange[]): Promise<void> {
    const conflictingEntities = new Set<string>();
    
    // Identify entities that have both server changes and pending optimistic updates
    for (const serverChange of serverChanges) {
      const entityKey = `${serverChange.table}:${serverChange.data.id}`;
      
      if (this.pendingOptimisticUpdates.has(entityKey)) {
        conflictingEntities.add(entityKey);
        console.log(`[OptimisticConflict] Server change detected for entity with pending optimistic update: ${entityKey}`);
      }
    }

    // Remove conflicting optimistic updates (server wins)
    for (const entityKey of conflictingEntities) {
      const discardedUpdate = this.pendingOptimisticUpdates.get(entityKey);
      this.pendingOptimisticUpdates.delete(entityKey);
      
      console.log(`[OptimisticConflict] Discarded optimistic update for ${entityKey} - server change takes precedence`);
      
      // Emit event for UI to handle optimistic update cancellation
      this.events.emit('optimistic_update_discarded', {
        entityKey,
        discardedUpdate,
        reason: 'server_change_priority'
      });
    }

    console.log(`[OptimisticConflict] Handled ${conflictingEntities.size} optimistic update conflicts`);
  }

  /**
   * Apply server changes unconditionally using domain services directly
   * Server is the single source of truth
   */
  private async applyServerChanges(changes: TableChange[]): Promise<boolean> {
    if (!this.domainServices) {
      throw new Error('Domain services not initialized');
    }

    console.log(`[ServerChanges] Applying ${changes.length} server changes using domain services${this.isInitialSync ? ' (INITIAL SYNC)' : ''}`);
    
    // Process changes individually for better error handling
    let successCount = 0;
    let errorCount = 0;
    
    for (const change of changes) {
      try {
        await this.processServerChange(change);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`[ServerChanges] Failed to process change for ${change.table}:${change.data.id}:`, error);
        
        // Enhanced error logging for debugging
        if (this.isInitialSync) {
          console.error(`[InitialSync] ERROR DETAILS:`, {
            table: change.table,
            operation: change.operation,
            entityId: change.data.id,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            changeData: change.data
          });
        }
        
        // Continue processing other changes
      }
    }
    
    console.log(`[ServerChanges] Applied ${successCount}/${changes.length} server changes (${errorCount} errors)${this.isInitialSync ? ' (INITIAL SYNC)' : ''}`);
    return errorCount === 0;
  }

  /**
   * Process a single server change using domain services directly
   */
  private async processServerChange(change: TableChange): Promise<void> {
    if (!this.domainServices) {
      throw new Error('Domain services not initialized');
    }

    const { table, operation, data } = change;
    
    console.log(`[ServerChange] Processing ${operation} for ${table}:${data.id}`);
    
    try {
      const domainService = this.getDomainService(table);
      
      switch (operation) {
        case 'insert':
          await domainService.createFromSync(data);
          break;
        case 'update':
          await domainService.updateFromSync(data.id, data);
          break;
        case 'delete':
          await domainService.deleteFromSync(data.id);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
      
      console.log(`[ServerChange] Successfully processed ${operation} for ${table}:${data.id}`);
    } catch (error) {
      console.error(`[ServerChange] Error processing ${operation} for ${table}:${data.id}:`, error);
      throw error;
    }
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

  /**
   * Track an optimistic update for potential conflict handling
   * Call this when client makes optimistic updates
   */
  public trackOptimisticUpdate(change: TableChange): void {
    const entityKey = `${change.table}:${change.data.id}`;
    this.pendingOptimisticUpdates.set(entityKey, change);
    
    console.log(`[OptimisticUpdate] Tracking optimistic update for ${entityKey}`);
  }

  /**
   * Remove an optimistic update when it's confirmed by server
   * Call this when client receives acknowledgment from server
   */
  public confirmOptimisticUpdate(table: string, entityId: string): void {
    const entityKey = `${table}:${entityId}`;
    const wasTracking = this.pendingOptimisticUpdates.delete(entityKey);
    
    if (wasTracking) {
      console.log(`[OptimisticUpdate] Confirmed optimistic update for ${entityKey}`);
    }
  }

  /**
   * Get count of pending optimistic updates
   */
  public getPendingOptimisticUpdateCount(): number {
    return this.pendingOptimisticUpdates.size;
  }

  /**
   * Clear all pending optimistic updates (e.g., on reconnect)
   */
  public clearPendingOptimisticUpdates(): void {
    const count = this.pendingOptimisticUpdates.size;
    this.pendingOptimisticUpdates.clear();
    
    if (count > 0) {
      console.log(`[OptimisticUpdate] Cleared ${count} pending optimistic updates`);
      this.events.emit('optimistic_updates_cleared', { count });
    }
  }

  /**
   * Reset initial sync state (call when initial sync is complete)
   */
  public resetInitialSyncState(): void {
    if (this.isInitialSync) {
      console.log(`[InitialSync] Resetting initial sync state - switching to live sync mode`);
      this.isInitialSync = false;
      this.events.emit('initial_sync_mode_ended', { timestamp: Date.now() });
    }
  }

  /**
   * Get current processing statistics
   */
  public getProcessingStats(): {
    isProcessing: boolean;
    isInitialSync: boolean;
    pendingOptimisticUpdates: number;
  } {
    return {
      isProcessing: this.isProcessing,
      isInitialSync: this.isInitialSync,
      pendingOptimisticUpdates: this.pendingOptimisticUpdates.size
    };
  }
}