/**
 * OutgoingChangeService - Pure outgoing change service
 * 
 * Handles outgoing change detection, queuing, and transmission without state management.
 * Reports progress and results via callbacks rather than maintaining internal state.
 * 
 * Part of Phase 2: Pure Services Extraction
 */

import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { 
  TableChange, 
  ClientChangesMessage, 
  ServerMessage as BaseServerMessage,
  ServerAppliedMessage,
  ServerReceivedMessage 
} from '@repo/sync-types';
import { LocalChanges } from '@repo/dataforge/client-entities';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { syncLog } from '@/logger';

const log = syncLog('sync/OutgoingChangeService.ts');

// Constants for retry logic
const INITIAL_TIMEOUT = 30000; // 30 seconds
const MAX_TIMEOUT = 300000; // 5 minutes
const TIMEOUT_MULTIPLIER = 2;
const MAX_RETRY_ATTEMPTS = 3;

// Server error message interface
interface ServerErrorResponseMessage extends BaseServerMessage {
  type: 'srv_error';
  errorCode?: string | number;
  errorMessage?: string;
  originalMessageId?: string;
}

// Tracking info for sent changes
interface SentChangeInfo {
  timestamp: number;
  attempt: number;
  timeout: number;
}

export interface OutgoingChangeServiceConfig {
  clientId: string;
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeoutMs?: number;
}

export interface OutgoingChangeServiceCallbacks {
  onChangesQueued?: (changes: TableChange[], count: number) => void;
  onChangesSent?: (changes: TableChange[], messageId: string) => void;
  onChangesAcknowledged?: (changeIds: string[], serverResponse: any) => void;
  onError?: (error: Error, context?: string) => void;
  onProgress?: (processed: number, total: number) => void;
}

export interface PendingChange {
  id: string;
  change: TableChange;
  queuedAt: number;
  attempts: number;
  lastAttempt?: number;
}

export class OutgoingChangeService {
  private callbacks: OutgoingChangeServiceCallbacks = {};
  private pendingChanges = new Map<string, PendingChange>();
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private localChangesRepo: Repository<LocalChanges>;
  
  // Advanced tracking for retry logic
  private sentChanges = new Map<string, SentChangeInfo>();
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(
    private config: OutgoingChangeServiceConfig,
    private dataSource: NewPGliteDataSource,
    private messageSender?: { send: (message: any) => void }
  ) {
    if (!this.dataSource.isInitialized) {
      throw new Error("DataSource not initialized when OutgoingChangeService is constructed.");
    }
    
    this.localChangesRepo = this.dataSource.getRepository(LocalChanges);
    log.info('[OutgoingChangeService] Using shared DataSource from PGliteProvider context');
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: OutgoingChangeServiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Set message sender for transmitting changes
   */
  setMessageSender(sender: { send: (message: any) => void }): void {
    this.messageSender = sender;
  }

  /**
   * Track a single entity change immediately (for domain services)
   * This creates a LocalChanges record in the database and optionally sends immediately
   */
  async trackEntityChange(table: string, operation: 'insert' | 'update' | 'delete', entity: any): Promise<void> {
    const entityId = entity.id || 'unknown';
    log.info(`[OutgoingChangeService] Tracking entity change: ${table}:${operation}:${entityId}`);
    
    try {
      // Create the change data with clientId for anti-echo
      const changeData = {
        ...entity,
        clientId: this.config.clientId
      };

      // Create LocalChanges record in database
      const localChangeId = uuidv4();
      const now = new Date();
      const newChange = this.localChangesRepo.create({
        id: localChangeId,
        table: table,
        operation: operation,
        data: changeData,
        lsn: '', // LSN must be a string; use empty for client-originated changes
        updatedAt: now,
        processedSync: 0, // 0 for false, 1 for true
      });

      await this.localChangesRepo.save(newChange);
      
      log.info(`[OutgoingChangeService] Stored change in database: ${localChangeId} for ${table}:${entityId}`);
      
      // Create TableChange for immediate processing (if enabled)
      const tableChange: TableChange = {
        table,
        operation,
        data: changeData,
        updatedAt: now.toISOString(),
        clientId: this.config.clientId
      };
      
      // Also queue in memory for immediate sending if enabled
      this.pendingChanges.set(localChangeId, {
        id: localChangeId,
        change: tableChange,
        queuedAt: Date.now(),
        attempts: 0
      });
      
      // Trigger callbacks for sync machine integration
      this.callbacks.onChangesQueued?.([tableChange], 1);
      
      // Auto-send based on batching configuration (only if message sender is available)
      if (this.messageSender) {
        if (this.config.enableBatching !== false) {
          this.scheduleBatchSend();
        } else {
          // Send immediately if batching disabled
          await this.sendQueuedChanges();
        }
      } else {
        log.info(`[OutgoingChangeService] Change queued, will send when WebSocket is ready: ${localChangeId}`);
      }
      
    } catch (error) {
      log.error('[OutgoingChangeService] Error tracking change:', error);
      throw error;
    }
  }

  /**
   * Detect and queue local changes for transmission
   */
  async detectAndQueueChanges(): Promise<number> {
    if (this.isProcessing) {
      log.info('[OutgoingChangeService] Already processing changes, skipping');
      return 0;
    }

    this.isProcessing = true;

    try {
      log.info('[OutgoingChangeService] Detecting local changes...');

      // Get all unsynced changes from database
      const changes = await this.queryUnsyncedChanges();
      
      if (changes.length === 0) {
        log.info('[OutgoingChangeService] No unsynced changes found');
        return 0;
      }

      log.info(`[OutgoingChangeService] Found ${changes.length} unsynced changes`);

      // Load actual LocalChanges records to get their IDs
      const localChanges = await this.localChangesRepo.find({
        where: { processedSync: 0 },
        order: { createdAt: 'ASC' },
        take: this.config.batchSize || 50
      });

      log.info(`[OutgoingChangeService] Found ${localChanges.length} unprocessed LocalChanges`);

      // Optimize changes by merging multiple changes to same entity
      const optimizedChanges = await this.optimizeOutgoingChanges(localChanges);
      log.info(`[OutgoingChangeService] Optimized ${localChanges.length} changes to ${optimizedChanges.length}`);

      // Queue optimized changes using LocalChanges IDs  
      let queuedCount = 0;
      for (const localChange of optimizedChanges) {
        const localChangeId = localChange.id;
        
        if (!this.pendingChanges.has(localChangeId)) {
          // Convert LocalChanges to TableChange format
          let data = localChange.data;
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (e) {
              log.error(`[OutgoingChangeService] Failed to parse LocalChanges.data for change ${localChange.id}:`, e);
              data = {};
            }
          }

          const tableChange: TableChange = {
            table: localChange.table,
            operation: localChange.operation as 'insert' | 'update' | 'delete',
            data: data as Record<string, any>,
            updatedAt: localChange.updatedAt.toISOString(),
            clientId: (data as any)?.clientId || this.config.clientId
          };

          this.pendingChanges.set(localChangeId, {
            id: localChangeId,
            change: tableChange,
            queuedAt: Date.now(),
            attempts: 0
          });
          queuedCount++;
        }
      }

      if (queuedCount > 0) {
        this.callbacks.onChangesQueued?.(changes, queuedCount);
        
        // Start batch processing if enabled (only if message sender is available)
        if (this.messageSender) {
          if (this.config.enableBatching !== false) {
            this.scheduleBatchSend();
          } else {
            // Send immediately if batching disabled
            await this.sendQueuedChanges();
          }
        } else {
          log.info(`[OutgoingChangeService] ${queuedCount} changes queued, will send when WebSocket is ready`);
        }
      }

      return queuedCount;

    } catch (error) {
      log.error('[OutgoingChangeService] Error detecting changes:', error);
      this.callbacks.onError?.(error as Error, 'detect_changes');
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send all queued changes immediately
   */
  async sendQueuedChanges(): Promise<void> {
    if (this.pendingChanges.size === 0) {
      log.info('[OutgoingChangeService] No queued changes to send');
      return;
    }

    if (!this.messageSender) {
      throw new Error('Message sender not configured');
    }

    const changes = Array.from(this.pendingChanges.values());
    const batchSize = this.config.batchSize || 50;

    log.info(`[OutgoingChangeService] Sending ${changes.length} queued changes in batches of ${batchSize}`);

    // Send in batches
    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      await this.sendChangeBatch(batch);
      
      // Report progress
      this.callbacks.onProgress?.(Math.min(i + batchSize, changes.length), changes.length);
    }

    log.info('[OutgoingChangeService] All queued changes sent');
  }

  /**
   * Acknowledge changes that were successfully processed by server
   */
  async acknowledgeChanges(changeIds: string[], serverResponse: any): Promise<void> {
    log.info(`[OutgoingChangeService] Acknowledging ${changeIds.length} changes`);

    // Remove acknowledged changes from pending queue
    for (const changeId of changeIds) {
      this.pendingChanges.delete(changeId);
    }

    // Mark changes as synced in database
    try {
      await this.markChangesAsSynced(changeIds);
      this.callbacks.onChangesAcknowledged?.(changeIds, serverResponse);
    } catch (error) {
      log.error('[OutgoingChangeService] Error marking changes as synced:', error);
      this.callbacks.onError?.(error as Error, 'acknowledge_changes');
    }
  }

  /**
   * Retry failed changes
   */
  async retryFailedChanges(): Promise<void> {
    const failedChanges = Array.from(this.pendingChanges.values())
      .filter(pending => pending.attempts > 0);

    if (failedChanges.length === 0) {
      log.info('[OutgoingChangeService] No failed changes to retry');
      return;
    }

    log.info(`[OutgoingChangeService] Retrying ${failedChanges.length} failed changes`);

    for (const pending of failedChanges) {
      await this.sendChangeBatch([pending]);
    }
  }

  /**
   * Get pending changes count
   */
  getPendingChangesCount(): number {
    return this.pendingChanges.size;
  }

  /**
   * Get pending changes details
   */
  getPendingChanges(): PendingChange[] {
    return Array.from(this.pendingChanges.values());
  }

  /**
   * Clear all pending changes
   */
  clearPendingChanges(): void {
    log.info(`[OutgoingChangeService] Clearing ${this.pendingChanges.size} pending changes`);
    this.pendingChanges.clear();
    this.stopBatchTimer();
  }

  /**
   * Handle server acknowledgment of received changes
   */
  handleChangesReceived(message: BaseServerMessage): void {
    if (message.type !== 'srv_changes_received') return;
    const receivedMessage = message as ServerReceivedMessage;
    
    // Server has acknowledged receipt, but changes are not yet applied
    log.info(`[OutgoingChangeService] 📥 Server acknowledged receipt of ${receivedMessage.changeIds?.length || 0} changes`);
    log.info(`[OutgoingChangeService] 📥 Received message:`, receivedMessage);
  }

  /**
   * Handle server confirmation of applied changes
   * The server sends entity IDs, not LocalChanges IDs, so we need to find LocalChanges by entity ID
   */
  async handleChangesApplied(message: BaseServerMessage): Promise<void> {
    log.info(`[OutgoingChangeService] 🔄 handleChangesApplied called with message type: ${message.type}`);
    if (message.type !== 'srv_changes_applied') return;
    const appliedMessage = message as ServerAppliedMessage;

    const appliedEntityIds = appliedMessage.appliedChanges || []; // These are entity IDs from the server
    log.info(`[OutgoingChangeService] ✅ Server applied changes. Success: ${appliedMessage.success}. Applied: ${appliedEntityIds.length}. Error: ${appliedMessage.error || 'None'}`);
    log.info(`[OutgoingChangeService] ✅ Applied message:`, appliedMessage);

    const successfullyAppliedLocalChangeIds: string[] = [];
    const permanentlyFailedLocalChangeIds: string[] = [];

    if (appliedMessage.success) {
      // Convert entity IDs to LocalChanges IDs
      for (const entityId of appliedEntityIds) {
        const localChangeIds = await this.findLocalChangesByEntityId(entityId);
        successfullyAppliedLocalChangeIds.push(...localChangeIds);
        
        // Clean up tracking
        for (const localChangeId of localChangeIds) {
          this.sentChanges.delete(localChangeId);
          this.pendingChanges.delete(localChangeId);
        }
      }
    } else {
      // Convert entity IDs to LocalChanges IDs for failed changes
      for (const entityId of appliedEntityIds) {
        log.error(`[OutgoingChangeService] Server failed to apply change for entity ${entityId}: ${appliedMessage.error}`);
        const localChangeIds = await this.findLocalChangesByEntityId(entityId);
        permanentlyFailedLocalChangeIds.push(...localChangeIds);
        
        // Clean up tracking
        for (const localChangeId of localChangeIds) {
          this.sentChanges.delete(localChangeId);
          this.pendingChanges.delete(localChangeId);
        }
      }
    }
    
    if (successfullyAppliedLocalChangeIds.length > 0) {
      await this.markLocalChangesAsProcessed(successfullyAppliedLocalChangeIds, true, 'applied_by_server');
    }
    if (permanentlyFailedLocalChangeIds.length > 0) {
      await this.markLocalChangesAsProcessed(permanentlyFailedLocalChangeIds, true, `server_rejection: ${appliedMessage.error || 'Unknown error'}`);
    }

    // Trigger callback with LocalChanges IDs
    this.callbacks.onChangesAcknowledged?.(
      [...successfullyAppliedLocalChangeIds, ...permanentlyFailedLocalChangeIds], 
      appliedMessage
    );
  }

  /**
   * Handle server errors
   */
  handleServerError(message: ServerErrorResponseMessage | BaseServerMessage): void {
    if (message.type !== 'srv_error') return;
    const { errorCode, errorMessage, originalMessageId } = message as ServerErrorResponseMessage;
    log.error(`[OutgoingChangeService] Received server error: ${errorCode} - ${errorMessage}. Original Msg ID: ${originalMessageId}`);
    
    this.callbacks.onError?.(new Error(`Server error: ${errorMessage}`), 'server_error');
  }

  /**
   * Optimize outgoing changes by merging multiple changes to same entity
   */
  private async optimizeOutgoingChanges(localChanges: LocalChanges[]): Promise<LocalChanges[]> {
    const entityChangeMap = new Map<string, LocalChanges[]>(); // key: table:entityId
    
    for (const change of localChanges) {
      const entityId = (change.data as Record<string, any>)?.id;
      if (!entityId) {
        log.warn(`[OutgoingChangeService] Change ${change.id} missing entity_id in data during optimization.`);
        continue;
      }
      const key = `${change.table}:${entityId}`;
      if (!entityChangeMap.has(key)) {
        entityChangeMap.set(key, []);
      }
      entityChangeMap.get(key)!.push(change);
    }

    const finalChanges: LocalChanges[] = [];
    const processedDueToOptimization: string[] = [];

    for (const [_, entityChanges] of entityChangeMap.entries()) {
      entityChanges.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      let currentChangeData: Record<string, any> | null = null;
      let firstOpType = entityChanges[0].operation;
      const firstLocalChangeId = entityChanges[0].id;
      const entityIdForOp = (entityChanges[0].data as Record<string, any>)?.id;
      
      const clientId = (entityChanges[0].data as Record<string, any>)?.clientId;

      if (firstOpType === 'insert') {
        currentChangeData = { ...(entityChanges[0].data as Record<string, any>) };
      }

      for (let i = 0; i < entityChanges.length; i++) {
        const currentLocalChange = entityChanges[i];
        if (currentLocalChange.id !== firstLocalChangeId) {
          processedDueToOptimization.push(currentLocalChange.id);
        }

        if (currentLocalChange.operation === 'insert') {
          currentChangeData = { ...(currentLocalChange.data as Record<string, any>) };
          firstOpType = 'insert';
        } else if (currentLocalChange.operation === 'update') {
          if (firstOpType === 'insert') {
            currentChangeData = { ...currentChangeData, ...(currentLocalChange.data as Record<string, any>) };
          } else {
            if (currentChangeData === null) currentChangeData = {};
            currentChangeData = { ...currentChangeData, ...(currentLocalChange.data as Record<string, any>) };
            if (firstOpType !== 'insert') firstOpType = 'update';
          }
        } else if (currentLocalChange.operation === 'delete') {
          if (firstOpType === 'insert') {
            currentChangeData = null;
            if (!processedDueToOptimization.includes(firstLocalChangeId)) {
              processedDueToOptimization.push(firstLocalChangeId);
            }
            break;
          } else {
            currentChangeData = { 
              id: entityIdForOp,
              clientId: clientId || (currentLocalChange.data as Record<string, any>)?.clientId
            };
            firstOpType = 'delete';
            for(let j = 0; j < i; j++) {
              if (!processedDueToOptimization.includes(entityChanges[j].id)) {
                processedDueToOptimization.push(entityChanges[j].id);
              }
            }
            break; 
          }
        }
      }

      if (currentChangeData) {
        if (clientId && !currentChangeData.clientId) {
          currentChangeData.clientId = clientId;
        }
        
        const representativeChange = { ...entityChanges[0] };
        representativeChange.id = firstLocalChangeId;
        representativeChange.operation = firstOpType as 'insert' | 'update' | 'delete';
        representativeChange.data = currentChangeData;
        representativeChange.updatedAt = entityChanges[entityChanges.length - 1].updatedAt;
        finalChanges.push(representativeChange);
      }
    }
    
    if (processedDueToOptimization.length > 0) {
      log.info(`[OutgoingChangeService] ${processedDueToOptimization.length} changes were optimized out or merged.`);
      await this.markLocalChangesAsProcessed(processedDueToOptimization, true, 'optimized_merged');
    }
    
    return finalChanges;
  }

  /**
   * Check for timed out changes and retry them
   */
  private checkSentChanges(): void {
    const now = Date.now();
    const toRetry: string[] = [];
    const permanentlyFailed: string[] = [];
    
    this.sentChanges.forEach((info, localChangeId) => {
      if (now - info.timestamp > info.timeout) {
        if (info.attempt >= MAX_RETRY_ATTEMPTS) {
          log.error(`[OutgoingChangeService] Change ${localChangeId} permanently failed after ${info.attempt} attempts. Marking as failed.`);
          this.sentChanges.delete(localChangeId);
          permanentlyFailed.push(localChangeId);
        } else {
          log.warn(`[OutgoingChangeService] Change ${localChangeId} timed out (attempt ${info.attempt}). Will retry.`);
          this.sentChanges.delete(localChangeId);
          toRetry.push(localChangeId);
        }
      }
    });
    
    // Re-queue changes for retry
    if (toRetry.length > 0) {
      toRetry.forEach(id => this.pendingChanges.set(id, {
        id,
        change: { table: '', operation: 'update', data: {}, updatedAt: '', clientId: '' } as TableChange, // Will be reloaded
        queuedAt: Date.now(),
        attempts: 0
      }));
      this.scheduleBatchSend(); // Use existing method
    }
    
    // Mark permanently failed changes as processed
    if (permanentlyFailed.length > 0) {
      this.markLocalChangesAsProcessed(permanentlyFailed, false, `timeout_after_${MAX_RETRY_ATTEMPTS}_attempts`)
        .catch((error: Error) => {
          log.error('[OutgoingChangeService] Error marking permanently failed changes:', error);
        });
    }

    // Schedule next check if there are still sent changes
    if (this.sentChanges.size > 0) {
      this.scheduleRetryCheck();
    }
  }

  /**
   * Schedule the next retry check
   */
  private scheduleRetryCheck(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    this.retryTimer = setTimeout(() => {
      this.checkSentChanges();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Destroy service and clean up resources
   */
  destroy(): void {
    log.info('[OutgoingChangeService] Destroying...');
    this.clearPendingChanges();
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    
    this.sentChanges.clear();
    this.callbacks = {};
  }

  // Private methods

  private async queryUnsyncedChanges(): Promise<TableChange[]> {
    try {
      log.info('[OutgoingChangeService] Querying LocalChanges table for unsynced changes...');
      
      // Query LocalChanges table for unprocessed records
      const unprocessed = await this.localChangesRepo.find({
        where: { processedSync: 0 },
        order: { createdAt: 'ASC' },
        take: this.config.batchSize || 50
      });

      log.info(`[OutgoingChangeService] Found ${unprocessed.length} unsynced changes in LocalChanges table`);

      // Convert LocalChanges to TableChange format
      return unprocessed.map(localChange => {
        let data = localChange.data;
        
        // Parse data if it's stored as string
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {
            log.error(`[OutgoingChangeService] Failed to parse LocalChanges.data for change ${localChange.id}:`, e);
            data = {};
          }
        }

        return {
          table: localChange.table,
          operation: localChange.operation as 'insert' | 'update' | 'delete',
          data: data as Record<string, any>,
          updatedAt: localChange.updatedAt.toISOString(),
          clientId: (data as any)?.clientId || this.config.clientId
        } as TableChange;
      });
      
    } catch (error) {
      log.error('[OutgoingChangeService] Error querying unsynced changes:', error);
      throw error;
    }
  }

  private async markChangesAsSynced(changeIds: string[]): Promise<void> {
    if (changeIds.length === 0) return;

    try {
      log.info(`[OutgoingChangeService] Marking ${changeIds.length} LocalChanges as processed`);
      
      // Mark changes as processed in LocalChanges table
      await this.localChangesRepo.update(
        { id: In(changeIds) },
        { processedSync: 1 }
      );
      
      log.info(`[OutgoingChangeService] Successfully marked ${changeIds.length} changes as processed`);
      
    } catch (error) {
      log.error('[OutgoingChangeService] Error marking changes as synced:', error);
      throw error;
    }
  }

  /**
   * Find LocalChanges records by entity ID (using the same logic as OutgoingChangeProcessor)
   */
  private async findLocalChangesByEntityId(entityId: string): Promise<string[]> {
    try {
      // Use createQueryBuilder to correctly query against the JSONB field
      const changesToUpdate = await this.localChangesRepo.createQueryBuilder("LocalChanges")
        .where(`("LocalChanges"."data" ->> 'id') = :entityId`, { entityId })
        .andWhere('LocalChanges.processedSync = :processedSyncStatus', { processedSyncStatus: 0 })
        .getMany();

      return changesToUpdate.map(change => change.id);
    } catch (error) {
      log.error(`[OutgoingChangeService] Error finding LocalChanges for entity ID ${entityId}:`, error);
      return [];
    }
  }

  /**
   * Mark LocalChanges as processed in the database (enhanced version with reason tracking)
   */
  private async markLocalChangesAsProcessed(changeIds: string[], success: boolean, reason: string): Promise<void> {
    if (changeIds.length === 0) return;

    try {
      log.info(`[OutgoingChangeService] Marking ${changeIds.length} LocalChanges as processed due to: ${reason}`);
      
      const statusToSet = success ? 1 : 0;
      await this.localChangesRepo.update(
        { id: In(changeIds) },
        { processedSync: statusToSet }
      );
      
      log.info(`[OutgoingChangeService] Successfully marked ${changeIds.length} changes as processedSync=${statusToSet}`);
      
      // Clean up tracking for processed changes
      for (const changeId of changeIds) {
        this.sentChanges.delete(changeId);
        this.pendingChanges.delete(changeId);
      }
      
    } catch (error) {
      log.error(`[OutgoingChangeService] Error marking changes as processed (reason: ${reason}):`, error);
      throw error;
    }
  }

  private async sendChangeBatch(batch: PendingChange[]): Promise<void> {
    if (!this.messageSender) {
      throw new Error('Message sender not configured');
    }

    const messageId = `outgoing_changes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Update attempt counts and track sent changes
      const now = Date.now();
      for (const pending of batch) {
        pending.attempts++;
        pending.lastAttempt = now;
        
        // Track sent change for timeout/retry logic
        const existingInfo = this.sentChanges.get(pending.id);
        const attempt = existingInfo ? existingInfo.attempt + 1 : 1;
        const timeout = existingInfo ? 
          Math.min(existingInfo.timeout * TIMEOUT_MULTIPLIER, MAX_TIMEOUT) : 
          INITIAL_TIMEOUT;
          
        this.sentChanges.set(pending.id, { 
          timestamp: now, 
          attempt: attempt, 
          timeout: timeout 
        });
        
        log.info(`[OutgoingChangeService] Tracking change ${pending.id} (attempt ${attempt}, timeout ${timeout}ms)`);
      }

      const message: ClientChangesMessage = {
        type: 'clt_send_changes',
        messageId,
        clientId: this.config.clientId,
        timestamp: Date.now(),
        changes: batch.map(p => p.change)
      };

      this.messageSender.send(message);
      
      this.callbacks.onChangesSent?.(batch.map(p => p.change), messageId);
      
      log.info(`[OutgoingChangeService] Sent batch of ${batch.length} changes (${messageId})`);
      
      // Start retry check timer if not already running
      this.scheduleRetryCheck();
      
    } catch (error) {
      log.error('[OutgoingChangeService] Error sending change batch:', error);
      this.callbacks.onError?.(error as Error, 'send_batch');
      throw error;
    }
  }

  private generateChangeId(change: TableChange): string {
    // Generate unique ID for change tracking
    const recordId = change.data.id || 'unknown';
    return `${change.table}_${change.operation}_${recordId}_${change.updatedAt}`;
  }

  private scheduleBatchSend(): void {
    this.stopBatchTimer();
    
    const timeout = this.config.batchTimeoutMs || 5000; // 5 seconds default
    this.batchTimer = setTimeout(() => {
      this.sendQueuedChanges().catch(error => {
        log.error('[OutgoingChangeService] Error in scheduled batch send:', error);
        this.callbacks.onError?.(error, 'scheduled_send');
      });
    }, timeout);
  }

  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
} 