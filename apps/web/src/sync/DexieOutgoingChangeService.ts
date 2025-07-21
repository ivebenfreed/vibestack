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
  getPendingChangeCount,
  trackOutgoingChange,
  clearProcessedChanges,
  setChangeProcessor
} from '../db/dexie-change-tracking';
import { db } from '@repo/dataforge/dexie-schema';
import type { LocalChanges } from '@repo/dataforge/client-entities';

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

// Track active instances to detect duplicates
let activeInstances = 0;

export class DexieOutgoingChangeService {
  private config: DexieOutgoingChangeServiceConfig;
  private callbacks: DexieOutgoingChangeServiceCallbacks = {};
  private isProcessing = false;
  private instanceId: string;
  private inFlightChangeIds = new Set<string>(); // Track changes being sent to prevent duplicates
  
  // Constants for retry logic
  private readonly MAX_SEND_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 30000; // 30 seconds
  
  constructor(config: DexieOutgoingChangeServiceConfig) {
    this.config = config;
    this.instanceId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    activeInstances++;
    console.log('[DexieOutgoingChangeService] Initialized with config:', config, {
      instanceId: this.instanceId,
      activeInstances,
      warning: activeInstances > 1 ? 'MULTIPLE INSTANCES DETECTED!' : 'Single instance'
    });
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
  startMonitoring(): void {
    console.log('[DexieOutgoingChangeService] Starting direct processing');
    
    // Register direct processor for when changes are tracked
    setChangeProcessor(() => {
      // Process changes immediately when they're tracked
      this.processPendingChanges();
    });
    
    // Process any existing pending changes on startup
    this.processPendingChanges();
  }
  
  /**
   * Stop monitoring for changes
   */
  stopMonitoring(): void {
    console.log('[DexieOutgoingChangeService] Stopped monitoring');
    setChangeProcessor(null); // Clear the processor
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
        // Get next batch of pending changes that haven't been sent too many times
        // AND are not currently being processed (in-flight)
        const pendingChanges = await db.local_changes
          .where('processedSync')
          .equals(0)
          .filter(change => {
            // Skip if too many send attempts
            if (change.sendAttempts && change.sendAttempts >= this.MAX_SEND_ATTEMPTS) {
              return false;
            }
            
            // Skip if already in-flight (being processed)
            if (this.inFlightChangeIds.has(change.id)) {
              return false;
            }
            
            return true;
          })
          .limit(batchSize)
          .toArray();
        
        if (pendingChanges.length === 0) {
          hasMore = false;
          break;
        }
        
        // Mark changes as in-flight IMMEDIATELY to prevent duplicate processing
        const changeIds = pendingChanges.map(c => c.id);
        changeIds.forEach(id => this.inFlightChangeIds.add(id));
        
        console.log(`[DexieOutgoingChangeService] Processing batch of ${pendingChanges.length} changes`, {
          instanceId: this.instanceId,
          inFlightCount: this.inFlightChangeIds.size,
          batchDetails: pendingChanges.map(c => ({
            id: c.id,
            table: c.table,
            operation: c.operation,
            entityId: c.data?.id,
            clientSequence: c.clientSequence
          }))
        });
        
        // Update send attempts before sending
        await db.local_changes
          .where('id')
          .anyOf(changeIds)
          .modify(change => {
            change.sendAttempts = (change.sendAttempts || 0) + 1;
            change.lastSendAttempt = new Date();
          });
        
        // Convert LocalChanges to TableChange format
        const tableChanges = this.convertToTableChanges(pendingChanges);
        
        // Send changes via callback
        if (this.callbacks.onSendRequest) {
          try {
            const success = await this.callbacks.onSendRequest(tableChanges);
            
            if (success) {
              // Don't mark as processed yet - wait for server acknowledgment
              totalProcessed += pendingChanges.length;
              console.log(`[DexieOutgoingChangeService] Successfully sent ${pendingChanges.length} changes`);
              
              this.callbacks.onChangesSent?.(tableChanges, true);
              this.callbacks.onProgress?.(totalProcessed, totalProcessed + (hasMore ? 1 : 0));
            } else {
              console.warn('[DexieOutgoingChangeService] Failed to send changes, will retry later');
              
              // Remove from in-flight since send failed
              changeIds.forEach(id => this.inFlightChangeIds.delete(id));
              
              // Update error in database
              await db.local_changes
                .where('id')
                .anyOf(changeIds)
                .modify({ lastError: 'Send failed' });
              
              this.callbacks.onChangesSent?.(tableChanges, false);
              hasMore = false; // Stop processing on failure
            }
          } catch (error) {
            console.error('[DexieOutgoingChangeService] Error sending changes:', error);
            
            // Update error in database
            await db.local_changes
              .where('id')
              .anyOf(changeIds)
              .modify({ lastError: (error as Error).message || 'Unknown error' });
            
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
    return localChanges.map(change => {
      // Ensure clientId is included in the data object for CRDT
      const dataWithClientId = {
        ...change.data,
        clientId: this.config.clientId  // Use clientId from sync context
      };
      
      return {
        table: change.table,
        operation: change.operation,
        data: dataWithClientId,
        clientId: this.config.clientId,
        updatedAt: change.updatedAt.toISOString()
      };
    });
  }
  
  /**
   * Mark changes as processed based on record IDs from server
   */
  async markChangesAsProcessedByRecordIds(recordIds: string[]): Promise<void> {
    console.log('[DexieOutgoingChangeService] markChangesAsProcessedByRecordIds called with:', recordIds);
    
    if (recordIds.length === 0) {
      console.warn('[DexieOutgoingChangeService] No record IDs provided');
      return;
    }
    
    // Find all unprocessed changes for these record IDs
    const changes = await db.local_changes
      .where('processedSync')
      .equals(0)
      .toArray();
    
    // Filter for matching entity IDs
    const matchingChanges = changes.filter(change => 
      change.data && recordIds.includes(change.data.id as string)
    );
    
    if (matchingChanges.length > 0) {
      const changeIds = matchingChanges.map(change => change.id);
      console.log(`[DexieOutgoingChangeService] Found ${changeIds.length} changes to mark as processed`);
      
      // Remove from in-flight tracking
      changeIds.forEach(id => this.inFlightChangeIds.delete(id));
      
      // Mark as processed in database
      await db.local_changes
        .where('id')
        .anyOf(changeIds)
        .modify({ processedSync: 1 });
      
      console.log(`[DexieOutgoingChangeService] Successfully marked ${changeIds.length} changes as processed`);
    } else {
      console.warn('[DexieOutgoingChangeService] No matching changes found for the provided record IDs');
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
      isMonitoring: true, // Always monitoring via direct processor
      pendingCount
    };
  }
  
  /**
   * Track an entity change for outgoing sync
   * This is the manual tracking method called by domain operations
   */
  async trackEntityChange(table: string, operation: 'insert' | 'update' | 'delete', entity: any): Promise<void> {
    try {
      console.log(`[DexieOutgoingChangeService] Tracking ${operation} for ${table}:`, entity.id);
      await trackOutgoingChange(table, operation, entity);
    } catch (error) {
      console.error(`[DexieOutgoingChangeService] Failed to track ${operation} for ${table}:`, error);
      this.callbacks.onError?.(error as Error, 'track_entity_change');
      throw error;
    }
  }

  
  
  
  /**
   * Destroy service and clean up
   */
  destroy(): void {
    activeInstances--;
    console.log('[DexieOutgoingChangeService] Destroying...', {
      instanceId: this.instanceId,
      remainingInstances: activeInstances
    });
    this.stopMonitoring();
    this.callbacks = {};
    this.inFlightChangeIds.clear();
  }
}