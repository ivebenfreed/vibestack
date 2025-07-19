/**
 * DexieOutgoingChangeService - Dexie-based outgoing change service
 * 
 * Handles outgoing changes from Dexie's local_changes table for sync.
 * Reads pending changes and sends them to the server via WebSocket.
 * 
 * Part of Dexie parallel sync implementation
 */

import { TableChange } from '@repo/sync-types';
import { 
  getPendingChanges, 
  markChangesAsProcessed, 
  clearProcessedChanges,
  getPendingChangeCount 
} from '../db/dexie-change-tracking';
import { db } from '@repo/dataforge/dexie-schema';
import type { LocalChanges } from '@repo/dataforge/client-entities';

// Constants for retry logic
const INITIAL_TIMEOUT = 30000; // 30 seconds
const MAX_TIMEOUT = 300000; // 5 minutes
const TIMEOUT_MULTIPLIER = 2;
const MAX_RETRY_ATTEMPTS = 3;

// Tracking info for sent changes
interface SentChangeInfo {
  timestamp: number;
  attempt: number;
  timeout: number;
  changeIds: string[];
}

export interface DexieOutgoingChangeServiceConfig {
  clientId: string;
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface DexieOutgoingChangeServiceCallbacks {
  onChangesSent?: (changes: TableChange[], success: boolean) => void;
  onError?: (error: Error, context?: string) => void;
  onProgress?: (sent: number, total: number) => void;
  onSendRequest?: (changes: TableChange[]) => Promise<boolean>;
}

export class DexieOutgoingChangeService {
  private config: DexieOutgoingChangeServiceConfig;
  private callbacks: DexieOutgoingChangeServiceCallbacks = {};
  private isProcessing = false;
  private processInterval: NodeJS.Timeout | null = null;
  // Map to track which record IDs correspond to which change IDs
  private recordToChangeIdMap = new Map<string, string>();
  // Advanced tracking for retry logic
  private sentChanges = new Map<string, SentChangeInfo>();
  private retryTimer: NodeJS.Timeout | null = null;
  
  constructor(config: DexieOutgoingChangeServiceConfig) {
    this.config = config;
    console.log('[DexieOutgoingChangeService] Initialized with config:', config);
  }
  
  /**
   * Set callbacks for service events
   */
  setCallbacks(callbacks: DexieOutgoingChangeServiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
  
  /**
   * Start monitoring for pending changes
   */
  startMonitoring(intervalMs = 1000): void {
    if (this.processInterval) {
      console.log('[DexieOutgoingChangeService] Already monitoring');
      return;
    }
    
    console.log(`[DexieOutgoingChangeService] Starting monitoring with ${intervalMs}ms interval`);
    
    // Clear any stale tracking from previous sessions
    this.sentChanges.clear();
    this.recordToChangeIdMap.clear();
    
    // Note: Change tracking hooks are already initialized in dexie-init.ts
    // No need to reinitialize here as it would cause duplicate hooks
    
    // Initial check
    this.checkAndProcessChanges();
    
    // Set up interval
    this.processInterval = setInterval(() => {
      this.checkAndProcessChanges();
    }, intervalMs);
  }
  
  /**
   * Stop monitoring for changes
   */
  stopMonitoring(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      console.log('[DexieOutgoingChangeService] Stopped monitoring');
    }
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
  
  /**
   * Check for pending changes and process them
   */
  private async checkAndProcessChanges(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    
    try {
      const pendingCount = await getPendingChangeCount();
      
      if (pendingCount > 0) {
        console.log(`[DexieOutgoingChangeService] Found ${pendingCount} pending changes`);
        await this.processPendingChanges();
      }
    } catch (error) {
      console.error('[DexieOutgoingChangeService] Error checking for changes:', error);
      this.callbacks.onError?.(error as Error, 'check_changes');
    }
  }
  
  /**
   * Process all pending changes
   */
  async processPendingChanges(): Promise<void> {
    if (this.isProcessing) {
      console.log('[DexieOutgoingChangeService] Already processing, skipping');
      return;
    }
    
    this.isProcessing = true;
    const batchSize = this.config.batchSize || 100;
    
    try {
      let totalProcessed = 0;
      let hasMore = true;
      
      while (hasMore) {
        // Get next batch of pending changes
        const pendingChanges = await getPendingChanges(batchSize);
        
        if (pendingChanges.length === 0) {
          hasMore = false;
          break;
        }
        
        console.log(`[DexieOutgoingChangeService] Processing batch of ${pendingChanges.length} changes`);
        
        // Optimize changes by merging multiple changes to same entity
        const optimizedChanges = await this.optimizeOutgoingChanges(pendingChanges);
        console.log(`[DexieOutgoingChangeService] Optimized ${pendingChanges.length} changes to ${optimizedChanges.length}`);
        
        // Convert LocalChanges to TableChange format
        const tableChanges = this.convertToTableChanges(optimizedChanges);
        
        // Send changes via callback
        if (this.callbacks.onSendRequest) {
          try {
            const success = await this.callbacks.onSendRequest(tableChanges);
            
            if (success) {
              // Mark changes as processed
              const changeIds = optimizedChanges.map(c => c.id);
              await markChangesAsProcessed(changeIds);
              
              // Track sent changes for retry logic
              const now = Date.now();
              const messageId = `dexie_${now}_${Math.random().toString(36).substring(2, 9)}`;
              this.sentChanges.set(messageId, {
                timestamp: now,
                attempt: 1,
                timeout: INITIAL_TIMEOUT,
                changeIds
              });
              
              // Start retry check timer if not already running
              this.scheduleRetryCheck();
              
              totalProcessed += optimizedChanges.length;
              console.log(`[DexieOutgoingChangeService] Successfully sent ${optimizedChanges.length} changes`);
              
              this.callbacks.onChangesSent?.(tableChanges, true);
              this.callbacks.onProgress?.(totalProcessed, totalProcessed + (hasMore ? 1 : 0));
            } else {
              console.warn('[DexieOutgoingChangeService] Failed to send changes, will retry later');
              this.callbacks.onChangesSent?.(tableChanges, false);
              hasMore = false; // Stop processing on failure
            }
          } catch (error) {
            console.error('[DexieOutgoingChangeService] Error sending changes:', error);
            this.callbacks.onError?.(error as Error, 'send_changes');
            hasMore = false; // Stop processing on error
          }
        } else {
          console.warn('[DexieOutgoingChangeService] No send callback configured');
          hasMore = false;
        }
        
        // Small delay between batches
        if (hasMore && pendingChanges.length === batchSize) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`[DexieOutgoingChangeService] Processed ${totalProcessed} total changes`);
      
      // Cleanup old processed changes periodically
      if (totalProcessed > 0 && Math.random() < 0.1) { // 10% chance
        console.log('[DexieOutgoingChangeService] Running cleanup of old processed changes');
        await clearProcessedChanges();
      }
      
    } catch (error) {
      console.error('[DexieOutgoingChangeService] Error processing changes:', error);
      this.callbacks.onError?.(error as Error, 'process_changes');
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Convert LocalChanges to TableChange format for sync
   */
  private convertToTableChanges(localChanges: LocalChanges[]): TableChange[] {
    // Don't clear the map here - it needs to persist until changes are acknowledged
    // The map will be cleaned up after changes are marked as processed
    
    return localChanges.map(change => {
      // Map record ID to change ID
      const recordId = change.data.id as string;
      if (recordId) {
        this.recordToChangeIdMap.set(recordId, change.id);
      }
      
      // Ensure clientId is included in the data object for CRDT
      // Use the clientId from service config (which comes from sync context) instead of the one from change record
      const dataWithClientId = {
        ...change.data,
        clientId: this.config.clientId  // Use clientId from sync context
      };
      
      // Debug logging
      console.log('[DexieOutgoingChangeService] Converting change to TableChange:', {
        table: change.table,
        operation: change.operation,
        originalClientId: change.clientId,
        configClientId: this.config.clientId,
        dataHasClientId: !!dataWithClientId.clientId,
        clientIdValue: dataWithClientId.clientId
      });
      
      return {
        table: change.table,
        operation: change.operation,
        data: dataWithClientId,
        lsn: change.lsn,
        clientId: this.config.clientId,  // Use clientId from sync context
        updatedAt: change.updatedAt.toISOString()
      };
    });
  }
  
  /**
   * Mark changes as processed based on record IDs from server
   */
  async markChangesAsProcessedByRecordIds(recordIds: string[]): Promise<void> {
    const changeIds: string[] = [];
    const processedRecordIds = new Set<string>();
    
    for (const recordId of recordIds) {
      const changeId = this.recordToChangeIdMap.get(recordId);
      if (changeId) {
        changeIds.push(changeId);
        processedRecordIds.add(recordId);
      } else {
        console.warn(`[DexieOutgoingChangeService] No change ID found for record ID: ${recordId}`);
      }
    }
    
    if (changeIds.length > 0) {
      console.log(`[DexieOutgoingChangeService] Marking ${changeIds.length} changes as processed by record IDs`);
      await markChangesAsProcessed(changeIds);
      
      // Clean up the map for processed records
      processedRecordIds.forEach(recordId => {
        this.recordToChangeIdMap.delete(recordId);
      });
      
      // If map is getting too large, clean up old entries
      if (this.recordToChangeIdMap.size > 1000) {
        console.log(`[DexieOutgoingChangeService] Map size (${this.recordToChangeIdMap.size}) exceeds limit, clearing old entries`);
        // Keep only the most recent 500 entries
        const entries = Array.from(this.recordToChangeIdMap.entries());
        this.recordToChangeIdMap.clear();
        entries.slice(-500).forEach(([k, v]) => this.recordToChangeIdMap.set(k, v));
      }
    } else {
      console.warn('[DexieOutgoingChangeService] No change IDs found to mark as processed');
    }
  }
  
  /**
   * Force process pending changes (manual trigger)
   */
  async forceSyncPendingChanges(): Promise<void> {
    console.log('[DexieOutgoingChangeService] Force sync requested');
    await this.processPendingChanges();
  }
  
  /**
   * Get current status
   */
  async getStatus(): Promise<{
    isProcessing: boolean;
    isMonitoring: boolean;
    pendingCount: number;
  }> {
    const pendingCount = await getPendingChangeCount();
    
    return {
      isProcessing: this.isProcessing,
      isMonitoring: this.processInterval !== null,
      pendingCount
    };
  }
  
  /**
   * Find LocalChanges records by entity ID (for server response handling)
   */
  async findLocalChangesByEntityId(entityId: string): Promise<string[]> {
    try {
      // Dexie doesn't support querying nested JSON properties directly
      // We need to get all unprocessed changes and filter in memory
      const changes = await db.local_changes
        .where('processedSync')
        .equals(0)
        .toArray();
      
      // Filter for matching entity ID
      const matchingChanges = changes.filter(change => 
        change.data && (change.data as any).id === entityId
      );
      
      return matchingChanges.map(change => change.id);
    } catch (error) {
      console.error(`[DexieOutgoingChangeService] Error finding LocalChanges for entity ID ${entityId}:`, error);
      return [];
    }
  }
  
  /**
   * Optimize outgoing changes by merging multiple changes to same entity
   */
  private async optimizeOutgoingChanges(localChanges: LocalChanges[]): Promise<LocalChanges[]> {
    const entityChangeMap = new Map<string, LocalChanges[]>(); // key: table:entityId
    
    for (const change of localChanges) {
      const entityId = change.data?.id as string;
      if (!entityId) {
        console.warn(`[DexieOutgoingChangeService] Change ${change.id} missing entity id`);
        continue;
      }
      const key = `${change.table}:${entityId}`;
      if (!entityChangeMap.has(key)) {
        entityChangeMap.set(key, []);
      }
      entityChangeMap.get(key)!.push(change);
    }
    
    const finalChanges: LocalChanges[] = [];
    const processedChangeIds: string[] = [];
    
    for (const [_, entityChanges] of entityChangeMap.entries()) {
      // Sort by creation order
      entityChanges.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      let currentData: any = null;
      let firstOp = entityChanges[0].operation;
      const firstChangeId = entityChanges[0].id;
      
      // Process all changes for this entity
      for (let i = 0; i < entityChanges.length; i++) {
        const change = entityChanges[i];
        
        if (change.id !== firstChangeId) {
          processedChangeIds.push(change.id);
        }
        
        if (change.operation === 'insert') {
          currentData = { ...change.data };
          firstOp = 'insert';
        } else if (change.operation === 'update') {
          if (firstOp === 'insert') {
            // Merge update into insert
            currentData = { ...currentData, ...change.data };
          } else {
            // Apply update
            currentData = currentData || {};
            currentData = { ...currentData, ...change.data };
            if (firstOp !== 'insert') firstOp = 'update';
          }
        } else if (change.operation === 'delete') {
          if (firstOp === 'insert') {
            // Insert + delete = no operation
            currentData = null;
            processedChangeIds.push(firstChangeId);
            break;
          } else {
            // Just keep delete operation
            currentData = { id: change.data.id, clientId: change.data.clientId };
            firstOp = 'delete';
            // Mark all previous changes as processed
            for (let j = 0; j < i; j++) {
              if (!processedChangeIds.includes(entityChanges[j].id)) {
                processedChangeIds.push(entityChanges[j].id);
              }
            }
            break;
          }
        }
      }
      
      // Add the optimized change if it still exists
      if (currentData) {
        const optimizedChange = { ...entityChanges[0] };
        optimizedChange.id = firstChangeId;
        optimizedChange.operation = firstOp;
        optimizedChange.data = currentData;
        optimizedChange.updatedAt = entityChanges[entityChanges.length - 1].updatedAt;
        finalChanges.push(optimizedChange);
      }
    }
    
    // Mark optimized-out changes as processed
    if (processedChangeIds.length > 0) {
      console.log(`[DexieOutgoingChangeService] ${processedChangeIds.length} changes optimized out`);
      await markChangesAsProcessed(processedChangeIds);
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
    
    this.sentChanges.forEach((info, messageId) => {
      if (now - info.timestamp > info.timeout) {
        if (info.attempt >= MAX_RETRY_ATTEMPTS) {
          console.error(`[DexieOutgoingChangeService] Changes permanently failed after ${info.attempt} attempts`);
          this.sentChanges.delete(messageId);
          permanentlyFailed.push(...info.changeIds);
        } else {
          console.warn(`[DexieOutgoingChangeService] Changes timed out (attempt ${info.attempt}), will retry`);
          this.sentChanges.delete(messageId);
          toRetry.push(...info.changeIds);
        }
      }
    });
    
    // Handle retries and failures
    if (toRetry.length > 0) {
      // TODO: Implement retry logic by re-queuing changes
      console.log(`[DexieOutgoingChangeService] Would retry ${toRetry.length} changes`);
    }
    
    if (permanentlyFailed.length > 0) {
      markChangesAsProcessed(permanentlyFailed)
        .catch(error => console.error('[DexieOutgoingChangeService] Error marking failed changes:', error));
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
   * Destroy service and clean up
   */
  destroy(): void {
    console.log('[DexieOutgoingChangeService] Destroying...');
    this.stopMonitoring();
    this.sentChanges.clear();
    this.recordToChangeIdMap.clear();
    this.callbacks = {};
  }
}