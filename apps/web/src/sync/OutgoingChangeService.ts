/**
 * OutgoingChangeService - Pure outgoing change service
 * 
 * Handles outgoing change detection, queuing, and transmission without state management.
 * Reports progress and results via callbacks rather than maintaining internal state.
 * 
 * Part of Phase 2: Pure Services Extraction
 */

import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { TableChange, ClientChangesMessage } from '@repo/sync-types';

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

  constructor(
    private config: OutgoingChangeServiceConfig,
    private dataSource: NewPGliteDataSource,
    private messageSender?: { send: (message: any) => void }
  ) {
    // Pure service - no state initialization needed
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
   * Detect and queue local changes for transmission
   */
  async detectAndQueueChanges(): Promise<number> {
    if (this.isProcessing) {
      console.log('[OutgoingChangeService] Already processing changes, skipping');
      return 0;
    }

    this.isProcessing = true;

    try {
      console.log('[OutgoingChangeService] Detecting local changes...');

      // Get all unsynced changes from database
      const changes = await this.queryUnsyncedChanges();
      
      if (changes.length === 0) {
        console.log('[OutgoingChangeService] No unsynced changes found');
        return 0;
      }

      console.log(`[OutgoingChangeService] Found ${changes.length} unsynced changes`);

      // Queue changes
      let queuedCount = 0;
      for (const change of changes) {
        const changeId = this.generateChangeId(change);
        
        if (!this.pendingChanges.has(changeId)) {
          this.pendingChanges.set(changeId, {
            id: changeId,
            change,
            queuedAt: Date.now(),
            attempts: 0
          });
          queuedCount++;
        }
      }

      if (queuedCount > 0) {
        this.callbacks.onChangesQueued?.(changes, queuedCount);
        
        // Start batch processing if enabled
        if (this.config.enableBatching !== false) {
          this.scheduleBatchSend();
        } else {
          // Send immediately if batching disabled
          await this.sendQueuedChanges();
        }
      }

      return queuedCount;

    } catch (error) {
      console.error('[OutgoingChangeService] Error detecting changes:', error);
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
      console.log('[OutgoingChangeService] No queued changes to send');
      return;
    }

    if (!this.messageSender) {
      throw new Error('Message sender not configured');
    }

    const changes = Array.from(this.pendingChanges.values());
    const batchSize = this.config.batchSize || 50;

    console.log(`[OutgoingChangeService] Sending ${changes.length} queued changes in batches of ${batchSize}`);

    // Send in batches
    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      await this.sendChangeBatch(batch);
      
      // Report progress
      this.callbacks.onProgress?.(Math.min(i + batchSize, changes.length), changes.length);
    }

    console.log('[OutgoingChangeService] All queued changes sent');
  }

  /**
   * Acknowledge changes that were successfully processed by server
   */
  async acknowledgeChanges(changeIds: string[], serverResponse: any): Promise<void> {
    console.log(`[OutgoingChangeService] Acknowledging ${changeIds.length} changes`);

    // Remove acknowledged changes from pending queue
    for (const changeId of changeIds) {
      this.pendingChanges.delete(changeId);
    }

    // Mark changes as synced in database
    try {
      await this.markChangesAsSynced(changeIds);
      this.callbacks.onChangesAcknowledged?.(changeIds, serverResponse);
    } catch (error) {
      console.error('[OutgoingChangeService] Error marking changes as synced:', error);
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
      console.log('[OutgoingChangeService] No failed changes to retry');
      return;
    }

    console.log(`[OutgoingChangeService] Retrying ${failedChanges.length} failed changes`);

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
    console.log(`[OutgoingChangeService] Clearing ${this.pendingChanges.size} pending changes`);
    this.pendingChanges.clear();
    this.stopBatchTimer();
  }

  /**
   * Destroy service and clean up resources
   */
  destroy(): void {
    console.log('[OutgoingChangeService] Destroying...');
    this.clearPendingChanges();
    this.callbacks = {};
  }

  // Private methods

  private async queryUnsyncedChanges(): Promise<TableChange[]> {
    // This would query the database for unsynced changes
    // Implementation depends on your change tracking mechanism
    
    try {
      // Example: Query changes table for unsynced records
      const query = `
        SELECT table_name, operation_type, record_id, change_data, created_at
        FROM sync_changes 
        WHERE synced = false 
        ORDER BY created_at ASC
      `;
      
      const results = await this.dataSource.query(query);
      
             return results.map((row: any) => ({
         table: row.table_name,
         operation: row.operation_type,
         data: { id: row.record_id, ...row.change_data },
         updatedAt: row.created_at,
         clientId: this.config.clientId
       })) as TableChange[];
      
    } catch (error) {
      console.error('[OutgoingChangeService] Error querying unsynced changes:', error);
      throw error;
    }
  }

  private async markChangesAsSynced(changeIds: string[]): Promise<void> {
    if (changeIds.length === 0) return;

    try {
      // Mark changes as synced in database
      const placeholders = changeIds.map(() => '?').join(',');
      const query = `UPDATE sync_changes SET synced = true WHERE id IN (${placeholders})`;
      
      await this.dataSource.query(query, changeIds);
      
    } catch (error) {
      console.error('[OutgoingChangeService] Error marking changes as synced:', error);
      throw error;
    }
  }

  private async sendChangeBatch(batch: PendingChange[]): Promise<void> {
    if (!this.messageSender) {
      throw new Error('Message sender not configured');
    }

    const messageId = `outgoing_changes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Update attempt counts
      for (const pending of batch) {
        pending.attempts++;
        pending.lastAttempt = Date.now();
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
      
      console.log(`[OutgoingChangeService] Sent batch of ${batch.length} changes (${messageId})`);
      
    } catch (error) {
      console.error('[OutgoingChangeService] Error sending change batch:', error);
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
        console.error('[OutgoingChangeService] Error in scheduled batch send:', error);
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