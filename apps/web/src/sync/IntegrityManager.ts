/**
 * @deprecated This IntegrityManager is being replaced by IntegrityService.
 * Use IntegrityService for new implementations.
 * 
 * IntegrityManager - Client-side data integrity validation and reset execution
 * 
 * Handles:
 * - Local data integrity checks
 * - Full reset execution (LSN + table clearing)
 * - Server integrity validation requests
 * - Data fingerprint generation
 */

import { SyncEventEmitter } from './SyncEventEmitter';
import { LSNManager } from './LSNManager';
import { getGlobalDataSourceSync, waitForGlobalDataSource } from '../db/global-datasource';
import { 
  User, 
  Project, 
  Task, 
  Comment, 
  CLIENT_DOMAIN_TABLES,
  CLIENT_DOMAIN_TABLE_HIERARCHY
} from '@repo/dataforge/client-entities';
import type { IMessageSender } from './interfaces';
import { clearAllDataKeepSchema, clearDomainDataOnly, dropAllTables } from '../db/storage';
import { liveChangesManager } from '../lib/live-changes-manager';

const MODULE_NAME = 'IntegrityManager';

// Map table names to entity classes
const TABLE_TO_ENTITY_MAP: Record<string, any> = {
  'users': User,
  'projects': Project,
  'tasks': Task,
  'comments': Comment,
};

// Get clean table names (without quotes) from CLIENT_DOMAIN_TABLES
const CRITICAL_TABLES = CLIENT_DOMAIN_TABLES.map(table => table.replace(/"/g, ''));

console.log(`[${MODULE_NAME}] Initialized with domain tables:`, CRITICAL_TABLES);

export interface TableFingerprint {
  recordCount: number;
  lastUpdated: number;
  recordIdHash: string; // Hash of all record IDs sorted
  recentDataHash: string; // Hash of most recent 10 records
}

export interface IntegrityValidationRequest {
  clientId: string;
  currentLSN: string;
  tableFingerprints: Record<string, TableFingerprint>;
  timestamp: number;
}

export interface ResetCommand {
  type: 'full_reset' | 'table_reset';
  reason: string;
  affectedTables?: string[];
  preserveUserData?: boolean;
}

export interface ResetResult {
  success: boolean;
  tablesCleared: string[];
  lsnReset: boolean;
  error?: string;
}

/**
 * Client-side integrity management
 */
export class IntegrityManager {
  private events: SyncEventEmitter;
  private lsnManager: LSNManager | null = null;
  private messageSender: IMessageSender | null = null;
  private syncManager: any = null; // Reference to SyncManager for connection control
  
  constructor(
    eventEmitter: SyncEventEmitter,
    _syncStore?: any // DEPRECATED: No longer used, accessing orchestrator directly
  ) {
    this.events = eventEmitter;
    // Note: syncStore parameter is ignored - using orchestrator state now
    
    // Listen for reset commands from server
    this.events.on('server_message:srv_integrity_reset', this.handleServerResetCommand.bind(this));
    
    // Listen for validation responses
    this.events.on('server_message:srv_integrity_validation_response', this.handleValidationResponse.bind(this));
  }

  /**
   * Get orchestrator actor
   */
  private getOrchestrator() {
    const orchestrator = (window as any).orchestratorActor;
    if (!orchestrator) {
      throw new Error('Orchestrator actor not available');
    }
    return orchestrator;
  }

  private getOrchestratorSnapshot() {
    return this.getOrchestrator().getSnapshot();
  }

  /**
   * Get client ID from orchestrator state
   */
  private getClientId(): string {
    try {
      const snapshot = this.getOrchestratorSnapshot();
      return snapshot.context.syncClientId || 'unknown';
    } catch (error) {
      console.warn('[IntegrityManager] Could not get clientId from orchestrator:', error);
      return 'unknown';
    }
  }

  /**
   * Get current LSN from orchestrator state or LSNManager
   */
  private getCurrentLSN(): string {
    try {
      // Prefer LSNManager if available, fallback to orchestrator
      if (this.lsnManager) {
        return this.lsnManager.getCurrentLSN();
      }
      
      const snapshot = this.getOrchestratorSnapshot();
      return snapshot.context.syncState.currentLSN || '0/0';
    } catch (error) {
      console.warn('[IntegrityManager] Could not get LSN from orchestrator:', error);
      return '0/0';
    }
  }

  /**
   * Set the message sender for server communication
   */
  setMessageSender(messageSender: IMessageSender): void {
    this.messageSender = messageSender;
  }

  /**
   * Set the LSN manager for centralized LSN state
   */
  setLSNManager(lsnManager: LSNManager): void {
    this.lsnManager = lsnManager;
  }

  /**
   * Set the sync manager for connection control
   */
  setSyncManager(syncManager: any): void {
    this.syncManager = syncManager;
  }

  /**
   * Get datasource from global datasource manager (sync, no waiting)
   */
  private getDataSource() {
    const dataSource = getGlobalDataSourceSync();
    if (!dataSource) {
      throw new Error('Global datasource not ready. Wait for PGLite initialization to complete.');
    }
    return dataSource;
  }

  /**
   * Wait for datasource to be ready
   */
  private async waitForDataSource() {
    return await waitForGlobalDataSource();
  }

  /**
   * Notify orchestrator about integrity reset completion via custom events
   */
  private notifyOrchestrator(eventType: string, data?: any): void {
    try {
      // Use custom events to communicate with orchestrator
      const event = new CustomEvent(eventType, { detail: data });
      window.dispatchEvent(event);
      console.log(`[IntegrityManager] Notified orchestrator via custom event: ${eventType}`, data);
    } catch (error) {
      console.error('[IntegrityManager] Error notifying orchestrator:', error);
    }
  }

  /**
   * Generate fingerprints for local tables
   */
  async generateLocalFingerprints(): Promise<Record<string, TableFingerprint>> {
    console.log('[IntegrityManager] Generating local fingerprints for integrity check');
    const fingerprints: Record<string, TableFingerprint> = {};

    try {
      // Wait for datasource to be ready
      const dataSource = await this.waitForDataSource();

      for (const tableName of CRITICAL_TABLES) {
        fingerprints[tableName] = await this.generateTableFingerprint(tableName, dataSource);
      }

      console.log('[IntegrityManager] Generated fingerprints for', Object.keys(fingerprints).length, 'tables');
      return fingerprints;

    } catch (error) {
      console.error('[IntegrityManager] Error generating local fingerprints:', error);
      throw new Error(`Failed to generate local fingerprints: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate fingerprint for a specific table
   */
  private async generateTableFingerprint(tableName: string, dataSource?: any): Promise<TableFingerprint> {
    try {
      // Use provided datasource or get from global manager
      const ds = dataSource || await this.waitForDataSource();

      // Get repository for the table using entity class mapping
      let repository: any;
      try {
        // Wait a bit to ensure the data source is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const entityClass = TABLE_TO_ENTITY_MAP[tableName];
        if (!entityClass) {
          console.warn(`[IntegrityManager] Unknown table: ${tableName}`);
          return {
            recordCount: 0,
            lastUpdated: 0,
            recordIdHash: '',
            recentDataHash: ''
          };
        }

        repository = ds.getRepository(entityClass);
        
        // Verify repository is properly initialized
        if (!repository || !repository.metadata) {
          throw new Error(`Repository for ${tableName} is not properly initialized`);
        }
        
      } catch (error) {
        console.error(`[IntegrityManager] Error getting repository for ${tableName}:`, error);
        return {
          recordCount: 0,
          lastUpdated: 0,
          recordIdHash: '',
          recentDataHash: ''
        };
      }

      // Get record count
      const recordCount = await repository.count();

      // Get all record IDs for hash calculation
      const allRecords = await repository.find({
        select: ['id'],
        order: { id: 'ASC' }
      });
      
      const recordIds = allRecords.map((record: any) => record.id);
      const recordIdHash = this.hashArray(recordIds);

      console.log(`[IntegrityManager] Table ${tableName} record ID debug:`, {
        totalRecords: recordIds.length,
        sampleIds: recordIds.slice(0, 5),
        allIds: recordIds.length > 10 ? `${recordIds.slice(0, 10)}... (${recordIds.length} total)` : recordIds,
        hash: recordIdHash
      });

      // Get recent records for data integrity hash
      const recentRecords = await repository.find({
        select: ['id', 'updatedAt', 'createdAt'],
        order: { updatedAt: 'DESC' },
        take: 10
      });

      const recentData = recentRecords.map((record: any) => 
        `${record.id}:${record.updatedAt?.getTime() || record.createdAt?.getTime() || 0}`
      );
      const recentDataHash = this.hashArray(recentData);

      console.log(`[IntegrityManager] Table ${tableName} recent data debug:`, {
        recentRecords: recentRecords.length,
        sampleData: recentData.slice(0, 3),
        allData: recentData,
        hash: recentDataHash
      });

      // Get last updated timestamp
      const lastUpdated = recentRecords[0] ? 
        (recentRecords[0].updatedAt?.getTime() || recentRecords[0].createdAt?.getTime() || 0) : 0;

      return {
        recordCount,
        lastUpdated,
        recordIdHash,
        recentDataHash
      };

    } catch (error) {
      console.error(`[IntegrityManager] Error generating fingerprint for ${tableName}:`, error);
      
      // Return empty fingerprint on error
      return {
        recordCount: 0,
        lastUpdated: 0,
        recordIdHash: '',
        recentDataHash: ''
      };
    }
  }

  /**
   * Request integrity validation from server
   */
  async requestIntegrityValidation(): Promise<{ isValid: boolean; issues: any[]; recommendedAction: string }> {
    return this.requestIntegrityValidationInternal(true);
  }

  /**
   * Request integrity validation from server (debug version - no app machine notifications)
   */
  async requestIntegrityValidationDebug(): Promise<{ isValid: boolean; issues: any[]; recommendedAction: string }> {
    return this.requestIntegrityValidationInternal(false);
  }

  /**
   * Internal method for integrity validation with optional app machine notifications
   */
  private async requestIntegrityValidationInternal(notifyAppMachine: boolean): Promise<{ isValid: boolean; issues: any[]; recommendedAction: string }> {
    if (!this.messageSender) {
      throw new Error('Message sender not set');
    }

    console.log('[IntegrityManager] Requesting integrity validation from server', { notifyAppMachine });

    // Only notify app machine if requested (not for debug usage)
    // DISABLED: State machine now handles validation start internally
    // if (notifyAppMachine) {
    //   console.log('[IntegrityManager] 📱 Sending INTEGRITY_VALIDATION_START to app machine');
    //   this.notifyAppMachine('INTEGRITY_VALIDATION_START');
    // }

    return new Promise(async (resolve, reject) => {
      // Set up a timeout for the validation request (shorter timeout for better UX)
      const timeout = setTimeout(() => {
        console.warn('[IntegrityManager] Integrity validation timed out after 10 seconds');
        console.log('[IntegrityManager] Removing timeout listener');
        this.events.off('integrity:validation_response', handleResponse);
        // DISABLED: State machine now handles validation completion internally
        // if (notifyAppMachine) {
        //   this.notifyAppMachine('INTEGRITY_VALIDATION_COMPLETE', { 
        //     isValid: true, // Default to valid on timeout to not block the app
        //     issues: [],
        //     recommendedAction: 'none',
        //     timedOut: true
        //   });
        // }
        resolve({ isValid: true, issues: [], recommendedAction: 'none' });
      }, 10000); // 10 second timeout

      // Set up one-time listener for validation response
      const handleResponse = (data: any) => {
        console.log('[IntegrityManager] handleResponse called with data:', data);
        console.log('[IntegrityManager] Clearing timeout and removing listener');
        clearTimeout(timeout);
        this.events.off('integrity:validation_response', handleResponse); // Remove listener after first call
        console.log('[IntegrityManager] Received validation response:', data);
        
        // Only notify app machine if requested (not for debug usage)
        // DISABLED: State machine now handles validation completion internally
        // if (notifyAppMachine) {
        //   console.log('[IntegrityManager] 📱 Sending INTEGRITY_VALIDATION_COMPLETE to app machine');
        //   this.notifyAppMachine('INTEGRITY_VALIDATION_COMPLETE', { 
        //     isValid: data.isValid, 
        //     issues: data.issues || [],
        //     recommendedAction: data.recommendedAction || 'none'
        //   });
        // }
        
        resolve({
          isValid: data.isValid,
          issues: data.issues || [],
          recommendedAction: data.recommendedAction || 'none'
        });
      };

      // Listen for validation response (manual one-time implementation)
      console.log('[IntegrityManager] Setting up validation response listener');
      this.events.on('integrity:validation_response', handleResponse);
      console.log('[IntegrityManager] Listener registered successfully');

      try {
              // Get current state
      const clientId = this.getClientId();
      const currentLSN = this.getCurrentLSN();
        
        // Generate local fingerprints
        const tableFingerprints = await this.generateLocalFingerprints();

        // Send validation request to server
        const validationRequest: IntegrityValidationRequest = {
          clientId: clientId || 'unknown',
          currentLSN: currentLSN || '0/0',
          tableFingerprints,
          timestamp: Date.now()
        };

        this.messageSender!.send({
          type: 'clt_integrity_validation',
          ...validationRequest
        });

        console.log('[IntegrityManager] Integrity validation request sent to server');

      } catch (error) {
        clearTimeout(timeout);
        this.events.off('integrity:validation_response', handleResponse);
        
        console.error('[IntegrityManager] Error requesting integrity validation:', error);
        
        // Only notify app machine if requested (not for debug usage)
        // DISABLED: State machine now handles validation completion internally
        // if (notifyAppMachine) {
        //   this.notifyAppMachine('INTEGRITY_VALIDATION_COMPLETE', { 
        //     isValid: false, 
        //     issues: [{ error: error instanceof Error ? error.message : String(error) }],
        //     recommendedAction: 'none'
        //   });
        // }
        
        this.events.emit('integrity:validation_error', {
          error: error instanceof Error ? error.message : String(error)
        });

        reject(error);
      }
    });
  }

  /**
   * Execute a full reset (clear LSN and tables)
   */
  async executeFullReset(reason: string, preserveUserData: boolean = false): Promise<ResetResult> {
    return this.executeFullResetInternal(reason, preserveUserData, true);
  }

  /**
   * Execute a full reset (debug version - no app machine notifications)
   */
  async executeFullResetDebug(reason: string, preserveUserData: boolean = false): Promise<ResetResult> {
    return this.executeFullResetInternal(reason, preserveUserData, false);
  }

  /**
   * Internal method for full reset with optional app machine notifications
   */
  private async executeFullResetInternal(reason: string, preserveUserData: boolean, notifyAppMachine: boolean): Promise<ResetResult> {
    console.warn('[IntegrityManager] Executing full reset', { reason, preserveUserData, notifyAppMachine });

    // Note: Don't call notifyAppMachine('INTEGRITY_RESET_START') here as it creates a loop
    // The XState machine already handles this event and calls this method

    const result: ResetResult = {
      success: false,
      tablesCleared: [],
      lsnReset: false
    };

    try {
      // 0. Disconnect from sync first to ensure fresh connection and proper initial sync
      const wasConnected = this.syncManager?.isConnected() || false;
      if (wasConnected && this.syncManager) {
        console.log('[IntegrityManager] Disconnecting from sync before reset to ensure fresh initial sync...');
        this.syncManager.disconnect();
        
        // Wait for disconnection to complete
        let disconnectAttempts = 0;
        const maxDisconnectAttempts = 10;
        while (this.syncManager.isConnected() && disconnectAttempts < maxDisconnectAttempts) {
          await new Promise(resolve => setTimeout(resolve, 200));
          disconnectAttempts++;
        }
        
        if (this.syncManager.isConnected()) {
          console.warn('[IntegrityManager] Warning: Still connected after disconnect attempts, proceeding anyway');
        } else {
          console.log('[IntegrityManager] ✅ Successfully disconnected from sync');
        }
      } else {
        console.log('[IntegrityManager] Sync not connected or SyncManager not available - proceeding with reset');
      }

      // 1. Reset LSN to trigger full sync
      if (this.lsnManager) {
        await this.lsnManager.resetLSN('integrity_reset');
      } else {
        // Send LSN reset to orchestrator directly
        try {
          this.getOrchestrator().send({ type: 'LSN_UPDATE', lsn: '0/0' });
        } catch (error) {
          console.warn('[IntegrityManager] Could not send LSN reset to orchestrator:', error);
        }
      }
      result.lsnReset = true;
      console.log('[IntegrityManager] LSN reset to 0/0');

      // 2. Clear tables using robust storage functions that handle foreign key constraints
      try {
        console.log('[IntegrityManager] Using storage.ts functions for reliable table clearing...');
        
        if (preserveUserData) {
          console.log('[IntegrityManager] Preserve user data mode not implemented with storage functions - clearing all data');
        }
        
        // Pause live changes processing to avoid overhead during bulk operations
        // Only if live changes manager is active
        try {
          const liveChangesStats = liveChangesManager.getStats();
          if (liveChangesStats.status === 'active') {
            console.log('[IntegrityManager] Pausing live changes processing during table clearing...');
            liveChangesManager.pause();
          } else {
            console.log(`[IntegrityManager] Live changes manager not active (${liveChangesStats.status}) - skipping pause`);
          }
        } catch (liveChangesError) {
          console.warn('[IntegrityManager] Could not pause live changes manager:', liveChangesError);
        }
        
        // Use the robust clearDomainDataOnly function from storage.ts
        // This handles foreign key constraints properly and clears domain data only (preserves system tables)
        const clearSuccess = await clearDomainDataOnly();
        
        if (clearSuccess) {
          // Mark all critical tables as cleared
          result.tablesCleared = [...CRITICAL_TABLES];
          console.log(`[IntegrityManager] ✅ Successfully cleared all tables using storage functions:`, result.tablesCleared);
          
          // Verify tables are actually empty
          console.log('[IntegrityManager] Verifying tables are empty...');
          try {
            const dataSource = await this.waitForDataSource();
            for (const tableName of CRITICAL_TABLES) {
              try {
                const entityClass = TABLE_TO_ENTITY_MAP[tableName];
                if (entityClass) {
                  const repository = dataSource.getRepository(entityClass);
                  const count = await repository.count();
                  if (count > 0) {
                    console.warn(`[IntegrityManager] ⚠️ Table ${tableName} still has ${count} records after clearing`);
                  } else {
                    console.log(`[IntegrityManager] ✅ Verified table ${tableName} is empty`);
                  }
                }
              } catch (verifyError) {
                console.warn(`[IntegrityManager] Could not verify table ${tableName} is empty:`, verifyError);
              }
            }
          } catch (dsError) {
            console.warn('[IntegrityManager] Could not verify table clearing due to datasource error:', dsError);
          }
        } else {
          console.error('[IntegrityManager] ❌ Storage function failed to clear tables');
        }
        
      } catch (storageError) {
        console.error('[IntegrityManager] ❌ Error using storage functions for table clearing:', storageError);
      } finally {
        // Always resume live changes processing, even if clearing failed
        // Only if live changes manager is active and was paused
        try {
          const liveChangesStats = liveChangesManager.getStats();
          if (liveChangesStats.status === 'active' && liveChangesStats.isPaused) {
            console.log('[IntegrityManager] Resuming live changes processing...');
            liveChangesManager.resume();
          } else {
            console.log(`[IntegrityManager] Live changes manager not in paused state (status: ${liveChangesStats.status}, paused: ${liveChangesStats.isPaused}) - skipping resume`);
          }
        } catch (liveChangesError) {
          console.warn('[IntegrityManager] Could not resume live changes manager:', liveChangesError);
        }
      }

      result.success = true;
      
      console.log('[IntegrityManager] Full reset completed successfully', result);
      
      // Only notify orchestrator if requested (not for debug usage)
      if (notifyAppMachine) {
        this.notifyOrchestrator('integrity:reset_completed', { result });
      }
      
      // Emit reset completion event
      this.events.emit('integrity:reset_completed', {
        reason,
        result,
        timestamp: Date.now()
      });
      
      // 3. Only trigger automatic reconnection if notifying app machine (not for debug usage)
      if (notifyAppMachine && wasConnected) {
        setTimeout(() => {
          try {
            console.log('[IntegrityManager] All database cleanup completed - triggering fresh connection for initial sync...');
            // Use connect instead of reconnect_requested to ensure fresh connection
            if (this.syncManager && this.syncManager.getAutoConnect()) {
              this.syncManager.connect().then(() => {
                console.log('[IntegrityManager] ✅ Fresh connection established - should trigger initial sync with LSN 0/0');
              }).catch((connectError: any) => {
                console.warn('[IntegrityManager] Failed to establish fresh connection:', connectError);
              });
            } else {
              console.log('[IntegrityManager] Auto-connect disabled - manual reconnection required');
            }
          } catch (reconnectError) {
            console.warn('[IntegrityManager] Failed to trigger fresh connection, but reset was successful:', reconnectError);
          }
        }, 1000); // Longer delay to ensure both state machine processing AND database cleanup complete
      } else {
        console.log('[IntegrityManager] Debug mode or was not connected - skipping automatic reconnection');
      }

      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('[IntegrityManager] Full reset failed:', error);
      
      // Only notify orchestrator if requested (not for debug usage)
      if (notifyAppMachine) {
        this.notifyOrchestrator('integrity:reset_error', { 
          error: result.error 
        });
      }
      
      this.events.emit('integrity:reset_error', {
        reason,
        error: result.error
      });

      return result;
    }
  }

  /**
   * Clear a specific table using direct SQL (DEPRECATED - use storage functions instead)
   * This method is kept for compatibility but should not be used due to foreign key constraint issues
   */
  private async clearTable(tableName: string): Promise<void> {
    console.warn(`[IntegrityManager] clearTable() is deprecated - use storage functions instead for table: ${tableName}`);
    throw new Error('clearTable() is deprecated - use storage functions to avoid foreign key constraint violations');
  }

  /**
   * Handle reset command from server
   */
  private async handleServerResetCommand(message: any): Promise<void> {
    console.warn('[IntegrityManager] Received reset command from server', message);

    const resetCommand: ResetCommand = message.resetCommand;
    const reason = message.reason || 'Server-initiated reset';

    try {
      let result: ResetResult;

      if (resetCommand.type === 'full_reset') {
        result = await this.executeFullReset(reason, resetCommand.preserveUserData);
      } else if (resetCommand.type === 'table_reset') {
        // Partial reset - only specific tables
        result = await this.executeTableReset(resetCommand.affectedTables || [], reason);
      } else {
        throw new Error(`Unknown reset type: ${resetCommand.type}`);
      }

      // Send acknowledgment to server
      if (this.messageSender) {
        this.messageSender.send({
          type: 'clt_integrity_reset_ack',
          success: result.success,
          result,
          inReplyTo: message.messageId
        });
      }

      // Emit event for application to handle (e.g., trigger reconnection)
      this.events.emit('integrity:server_reset_completed', {
        command: resetCommand,
        result,
        reason
      });

    } catch (error) {
      console.error('[IntegrityManager] Error executing server reset command:', error);

      // Send error acknowledgment
      if (this.messageSender) {
        this.messageSender.send({
          type: 'clt_integrity_reset_ack',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          inReplyTo: message.messageId
        });
      }
    }
  }

  /**
   * Execute table-specific reset
   */
  private async executeTableReset(tablesToReset: string[], reason: string): Promise<ResetResult> {
    console.log('[IntegrityManager] Executing table reset', { tables: tablesToReset, reason });

    const result: ResetResult = {
      success: false,
      tablesCleared: [],
      lsnReset: false
    };

    try {
      console.log('[IntegrityManager] Table-specific reset using storage functions...');
      
      // For partial table resets, we'll use clearDomainDataOnly since it's more reliable
      // than trying to selectively clear tables with foreign key constraints
      console.warn('[IntegrityManager] Partial table reset not supported with storage functions - clearing domain tables only');
      
              // Pause live changes processing to avoid overhead during bulk operations
        // Only if live changes manager is active
        try {
          const liveChangesStats = liveChangesManager.getStats();
          if (liveChangesStats.status === 'active') {
            console.log('[IntegrityManager] Pausing live changes processing during table reset...');
            liveChangesManager.pause();
          } else {
            console.log(`[IntegrityManager] Live changes manager not active (${liveChangesStats.status}) - skipping pause`);
          }
        } catch (liveChangesError) {
          console.warn('[IntegrityManager] Could not pause live changes manager:', liveChangesError);
        }
      
      const clearSuccess = await clearDomainDataOnly();
      
      if (clearSuccess) {
        // Mark the requested tables as cleared (even though we cleared all)
        result.tablesCleared = tablesToReset.filter(tableName => CRITICAL_TABLES.includes(tableName));
        console.log(`[IntegrityManager] ✅ Successfully cleared tables using storage functions:`, result.tablesCleared);
      } else {
        console.error('[IntegrityManager] ❌ Storage function failed to clear tables');
      }

      result.success = clearSuccess;
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('[IntegrityManager] Table reset failed:', error);
      return result;
    } finally {
      // Always resume live changes processing, even if clearing failed
      // Only if live changes manager is active and was paused
      try {
        const liveChangesStats = liveChangesManager.getStats();
        if (liveChangesStats.status === 'active' && liveChangesStats.isPaused) {
          console.log('[IntegrityManager] Resuming live changes processing...');
          liveChangesManager.resume();
        } else {
          console.log(`[IntegrityManager] Live changes manager not in paused state (status: ${liveChangesStats.status}, paused: ${liveChangesStats.isPaused}) - skipping resume`);
        }
      } catch (liveChangesError) {
        console.warn('[IntegrityManager] Could not resume live changes manager:', liveChangesError);
      }
    }
  }

  /**
   * Handle validation response from server
   */
  private handleValidationResponse(message: any): void {
    console.log('[IntegrityManager] Received validation response from server', message);
    console.log('[IntegrityManager] About to emit integrity:validation_response event');
    
    // Emit the event synchronously to ensure immediate processing
    const responseData = {
      isValid: message.isValid,
      issues: message.issues || [],
      recommendedAction: message.recommendedAction,
      timestamp: Date.now()
    };
    
    console.log('[IntegrityManager] Emitting event with data:', responseData);
    this.events.emit('integrity:validation_response', responseData);
    console.log('[IntegrityManager] Event emitted successfully');
  }

  /**
   * Create hash of array elements
   */
  private hashArray(items: any[]): string {
    const content = items.join('|');
    
    // Debug logging to see what content is being hashed
    if (items.length <= 10) {
      console.log(`[IntegrityManager] Hashing content:`, {
        items,
        joinedContent: content,
        contentLength: content.length
      });
    } else {
      console.log(`[IntegrityManager] Hashing content:`, {
        itemCount: items.length,
        sampleItems: items.slice(0, 5),
        joinedContentPrefix: content.substring(0, 200) + '...',
        contentLength: content.length
      });
    }
    
    // Simple hash function for client-side use
    let hash = 0;
    if (content.length === 0) return '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const result = Math.abs(hash).toString(16);
    console.log(`[IntegrityManager] Hash result: ${result} for content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
    
    return result;
  }

  /**
   * Check if integrity manager is ready
   */
  isReady(): boolean {
    try {
      return !!(getGlobalDataSourceSync() && this.messageSender);
    } catch {
      return false;
    }
  }

  /**
   * Quick local integrity check
   */
  async quickLocalCheck(): Promise<{
    hasIssues: boolean;
    issueCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const dataSource = getGlobalDataSourceSync();
      if (!dataSource) {
        issues.push('Data source not available');
      }

      if (!this.messageSender) {
        issues.push('Message sender not available');
      }

      // Check if essential tables exist and are accessible
      if (dataSource) {
        for (const tableName of CRITICAL_TABLES) {
          try {
            const fingerprint = await this.generateTableFingerprint(tableName, dataSource);
            if (fingerprint.recordCount < 0) {
              issues.push(`Invalid record count for table ${tableName}`);
            }
          } catch (error) {
            issues.push(`Cannot access table ${tableName}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      return {
        hasIssues: issues.length > 0,
        issueCount: issues.length,
        issues
      };

    } catch (error) {
      issues.push(`Quick check failed: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        hasIssues: true,
        issueCount: issues.length,
        issues
      };
    }
  }
} 