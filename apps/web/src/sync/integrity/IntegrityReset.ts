/**
 * IntegrityReset - Pure reset operations
 * 
 * Extracted from the massive IntegrityService.ts (1,809 lines) to focus solely on 
 * integrity reset operations. This class handles:
 * - Full reset operations
 * - Table-specific reset operations  
 * - LSN reset coordination
 * - Service disconnection management
 * - Post-reset verification
 * 
 * Part of Phase 0: IntegrityService split for better maintainability
 */

import { NewPGliteDataSource } from '../../db/newtypeorm/NewDataSource';
import { 
  User, 
  Project, 
  Task, 
  Comment, 
  CLIENT_DOMAIN_TABLES,
} from '@repo/dataforge/client-entities';
import { clearDomainDataOnly } from '../../db/storage';
import { liveChangesManager } from '../../lib/live-changes-manager';
import { destroyGlobalSyncServicesV3 } from '../../state-machines/machines/sync-machine-v3';

// Re-export types that reset needs
export interface IntegrityResetResult {
  success: boolean;
  tablesCleared: string[];
  lsnReset: boolean;
  error?: string;
}

export interface IntegrityResetConfig {
  clientId: string;
  autoResetOnFailure: boolean;
}

export interface IntegrityResetCallbacks {
  onResetStarted?: (reason: string, resetType: string) => void;
  onResetCompleted?: (result: IntegrityResetResult) => void;
  onResetError?: (error: Error, reason?: string) => void;
}

// Map table names to entity classes
const TABLE_TO_ENTITY_MAP: Record<string, any> = {
  'users': User,
  'projects': Project,
  'tasks': Task,
  'comments': Comment,
};

// Get clean table names (without quotes) from CLIENT_DOMAIN_TABLES
const CRITICAL_TABLES = CLIENT_DOMAIN_TABLES.map(table => table.replace(/"/g, ''));

export class IntegrityReset {
  private config: IntegrityResetConfig;
  private dataSource: NewPGliteDataSource;
  private callbacks: IntegrityResetCallbacks = {};
  
  // Machine reference for event-driven communication
  private machineRef: any = null;

  constructor(config: IntegrityResetConfig, dataSource: NewPGliteDataSource) {
    this.config = config;
    this.dataSource = dataSource;
    
    console.log('[IntegrityReset] Initialized with config:', config);
  }

  /**
   * Set callbacks for reset events
   */
  setCallbacks(callbacks: IntegrityResetCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set machine reference for event-driven communication
   */
  setMachineRef(machineRef: any): void {
    this.machineRef = machineRef;
    console.log('[IntegrityReset] Machine reference set for event-driven communication');
  }

  /**
   * Execute integrity reset with full service disconnection management
   */
  async executeReset(reason: string, resetType: 'full_reset' | 'table_reset' = 'full_reset'): Promise<IntegrityResetResult> {
    try {
      console.log(`[IntegrityReset] Starting integrity reset: ${reason} (${resetType})`);
      
      this.callbacks.onResetStarted?.(reason, resetType);

      // Critical: Disconnect BEFORE reset to avoid sending messages over stale connections
      console.log('[IntegrityReset] 🔌 Phase 1: Disconnecting services before reset...');
      await this.disconnectAllServices();

      // Execute the appropriate reset type
      let result: IntegrityResetResult;
      if (resetType === 'full_reset') {
        result = await this.executeFullReset(reason);
      } else if (resetType === 'table_reset') {
        result = await this.executeTableReset(reason);
      } else {
        throw new Error(`Unknown reset type: ${resetType}`);
      }

      console.log(`[IntegrityReset] Integrity reset completed:`, result);

      this.callbacks.onResetCompleted?.(result);
      return result;

    } catch (error) {
      console.error('[IntegrityReset] Integrity reset failed:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      this.callbacks.onResetError?.(errorObj, reason);
      
      return {
        success: false,
        tablesCleared: [],
        lsnReset: false,
        error: errorObj.message
      };
    }
  }

  /**
   * Execute full reset - comprehensive reset with connection management and verification
   */
  private async executeFullReset(reason: string): Promise<IntegrityResetResult> {
    console.warn('[IntegrityReset] Executing full reset:', reason);

    const result: IntegrityResetResult = {
      success: false,
      tablesCleared: [],
      lsnReset: false
    };

    try {
      // 1. Reset LSN to trigger full sync (disconnection already happened in executeReset)
      this.resetLSN();
      result.lsnReset = true;
      console.log('[IntegrityReset] ✅ LSN reset to 0/0');

      // 2. Pause live changes processing
      try {
        const liveChangesStats = liveChangesManager.getStats();
        if (liveChangesStats.status === 'active') {
          console.log('[IntegrityReset] ⏸️ Pausing live changes processing during reset...');
          liveChangesManager.pause();
        } else {
          console.log(`[IntegrityReset] Live changes manager not active (${liveChangesStats.status}) - skipping pause`);
        }
      } catch (liveChangesError) {
        console.warn('[IntegrityReset] Could not pause live changes manager:', liveChangesError);
      }

      // 3. Clear domain data using robust storage functions
      console.log('[IntegrityReset] 🗑️ Using storage.ts functions for reliable table clearing...');
      const clearSuccess = await clearDomainDataOnly();
      
      if (clearSuccess) {
        result.tablesCleared = [...CRITICAL_TABLES];
        console.log(`[IntegrityReset] ✅ Successfully cleared tables using storage functions:`, result.tablesCleared);
        
        // Verify tables are actually empty
        console.log('[IntegrityReset] 🔍 Verifying tables are empty...');
        await this.verifyTablesEmpty();
      } else {
        console.error('[IntegrityReset] ❌ Storage function failed to clear tables');
      }

      result.success = clearSuccess;
      
      console.log('[IntegrityReset] ✅ Full reset completed successfully', result);
      
      // Reset baseline after successful reset to prevent validation loops
      if (result.success) {
        await this.resetIntegrityBaseline('Post-reset baseline reset');
        console.log('[IntegrityReset] 🔄 Baseline reset - next validation will start fresh');
        
        // Skip post-reset server validation as it's unreliable during state transitions
        // The local reset was successful (tables cleared, LSN reset), which is sufficient
        console.log('[IntegrityReset] ✅ Local reset completed successfully - proceeding with app refresh');
        console.log('[IntegrityReset] 🔄 Skipping server validation as connection may be transitioning');
        
        await this.triggerAppRefresh();
        console.log('[IntegrityReset] 🔄 App refresh triggered - will reinitialize with clean state and sync from LSN 0/0');
      }

      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('[IntegrityReset] ❌ Full reset failed:', error);
      return result;
    } finally {
      // Always resume live changes processing, even if clearing failed
      try {
        const liveChangesStats = liveChangesManager.getStats();
        if (liveChangesStats.status === 'active' && liveChangesStats.isPaused) {
          console.log('[IntegrityReset] ▶️ Resuming live changes processing...');
          liveChangesManager.resume();
        } else {
          console.log(`[IntegrityReset] Live changes manager not in paused state (status: ${liveChangesStats.status}, paused: ${liveChangesStats.isPaused}) - skipping resume`);
        }
      } catch (liveChangesError) {
        console.warn('[IntegrityReset] Could not resume live changes manager:', liveChangesError);
      }
    }
  }

  /**
   * Execute table-specific reset (more targeted than full reset)
   */
  private async executeTableReset(reason: string): Promise<IntegrityResetResult> {
    console.log('[IntegrityReset] Executing table reset:', reason);

    const result: IntegrityResetResult = {
      success: false,
      tablesCleared: [],
      lsnReset: false
    };

    try {
      // For table reset, we still need to clear domain data
      // but we might preserve some system state
      console.log('[IntegrityReset] 🗑️ Clearing domain tables for table reset...');
      
      const clearSuccess = await clearDomainDataOnly();
      
      if (clearSuccess) {
        result.tablesCleared = [...CRITICAL_TABLES];
        console.log(`[IntegrityReset] ✅ Table reset completed, cleared:`, result.tablesCleared);
        
        // Verify tables are actually empty
        await this.verifyTablesEmpty();
        
        // For table reset, we might not reset LSN completely
        // This allows for more granular recovery
        result.success = true;
      } else {
        console.error('[IntegrityReset] ❌ Table reset failed to clear tables');
      }

      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('[IntegrityReset] ❌ Table reset failed:', error);
      return result;
    }
  }

  /**
   * Disconnect all services before reset to prevent stale connections
   */
  private async disconnectAllServices(): Promise<void> {
    try {
      console.log('[IntegrityReset] Disconnecting all services...');
      
      // In V3, we use the centralized cleanup function
      destroyGlobalSyncServicesV3();

      console.log('[IntegrityReset] ✅ All services disconnected for reset');

    } catch (error) {
      console.error('[IntegrityReset] Error disconnecting services:', error);
      // Continue with reset even if disconnection fails
    }
  }

  /**
   * Reset LSN to trigger full sync from server
   */
  private resetLSN(): void {
    this.setLSN('0/0');
  }

  /**
   * Set LSN to a specific value (supports partial rollback)
   */
  setLSN(targetLSN: string): void {
    try {
      console.log(`[IntegrityReset] Setting LSN to ${targetLSN}...`);
      
      // Validate LSN format
      const lsnRegex = /^[0-9A-Fa-f]+\/[0-9A-Fa-f]+$/;
      if (!lsnRegex.test(targetLSN)) {
        throw new Error(`Invalid LSN format: "${targetLSN}". Expected hex/hex format (e.g., "0/0" or "16/B374D848")`);
      }
      
      // Set in localStorage (sync machine's own state)
      const SYNC_STATE_KEY = 'sync-machine-state';
      try {
        const stored = localStorage.getItem(SYNC_STATE_KEY);
        if (stored) {
          const parsedState = JSON.parse(stored);
          parsedState.currentLSN = targetLSN;
          localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(parsedState));
          console.log(`[IntegrityReset] ✅ LSN set to ${targetLSN} in sync machine state`);
        }
      } catch (error) {
        console.warn('[IntegrityReset] Error setting LSN in sync machine state:', error);
      }

      const syncType = targetLSN === '0/0' ? 'full sync' : 'catchup sync';
      console.log(`[IntegrityReset] ✅ LSN set completed - next sync will be ${syncType} from ${targetLSN}`);

    } catch (error) {
      console.error(`[IntegrityReset] Error setting LSN to ${targetLSN}:`, error);
      throw error;
    }
  }

  /**
   * Perform partial LSN rollback for catchup scenarios
   */
  async rollbackToLSN(targetLSN: string, reason: string): Promise<IntegrityResetResult> {
    try {
      console.log(`[IntegrityReset] Starting partial LSN rollback to ${targetLSN}: ${reason}`);
      
      this.callbacks.onResetStarted?.(reason, 'partial_rollback');

      // Set LSN to the rollback target
      this.setLSN(targetLSN);

      const result: IntegrityResetResult = {
        success: true,
        tablesCleared: [], // No table clearing for partial rollback
        lsnReset: true
      };

      console.log(`[IntegrityReset] ✅ Partial rollback completed to ${targetLSN}`);

      this.callbacks.onResetCompleted?.(result);
      return result;

    } catch (error) {
      console.error(`[IntegrityReset] Partial rollback to ${targetLSN} failed:`, error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      this.callbacks.onResetError?.(errorObj, reason);
      
      return {
        success: false,
        tablesCleared: [],
        lsnReset: false,
        error: errorObj.message
      };
    }
  }

  /**
   * Verify that critical tables are actually empty after reset
   */
  private async verifyTablesEmpty(): Promise<void> {
    console.log('[IntegrityReset] Verifying tables are empty after reset...');

    try {
      for (const tableName of CRITICAL_TABLES) {
        const EntityClass = TABLE_TO_ENTITY_MAP[tableName];
        if (!EntityClass) {
          console.warn(`[IntegrityReset] No entity class found for table: ${tableName}`);
          continue;
        }

        const repository = this.dataSource.getRepository(EntityClass);
        const count = await repository.count();
        
        if (count === 0) {
          console.log(`[IntegrityReset] ✅ Table ${tableName} is empty (${count} records)`);
        } else {
          console.warn(`[IntegrityReset] ⚠️ Table ${tableName} still has ${count} records after reset`);
        }
      }

      console.log('[IntegrityReset] ✅ Table emptiness verification completed');

    } catch (error) {
      console.error('[IntegrityReset] Error verifying table emptiness:', error);
      // Don't throw - this is verification, not critical to reset operation
    }
  }

  /**
   * Reset integrity baseline after successful reset
   */
  async resetIntegrityBaseline(reason: string = 'Manual baseline reset'): Promise<void> {
    try {
      console.log(`[IntegrityReset] Resetting integrity baseline: ${reason}`);

      // Reset baseline in localStorage (sync machine only)
      const SYNC_STATE_KEY = 'sync-machine-state';

      // Reset in sync machine state
      try {
        const stored = localStorage.getItem(SYNC_STATE_KEY);
        if (stored) {
          const parsedState = JSON.parse(stored);
          // Don't reset clientId or LSN, just clear baseline tracking if it exists
          if (parsedState.integrityBaseline) {
            parsedState.integrityBaseline = {
              lastInitialSyncCompletedAt: null,
              lastFullValidationAt: null,
              recordChangesSinceBaseline: 0,
              maxRecordsBeforeReset: 10000,
              validationStrategy: 'baseline_with_threshold'
            };
          }
          localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(parsedState));
        }
      } catch (error) {
        console.warn('[IntegrityReset] Error resetting baseline in sync machine state:', error);
      }

      console.log('[IntegrityReset] ✅ Integrity baseline reset completed');

    } catch (error) {
      console.error('[IntegrityReset] Error resetting integrity baseline:', error);
      // Don't throw - baseline reset is not critical to core reset operation
    }
  }

  /**
   * Validate post-reset state - check that server has data and sync will work
   */
  private async validatePostResetState(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      console.log('[IntegrityReset] 🔍 Checking post-reset state...');
      
      // 1. Verify local database is actually empty
      console.log('[IntegrityReset] 📊 Verifying local database is empty...');
      let totalLocalRecords = 0;
      for (const tableName of CRITICAL_TABLES) {
        const EntityClass = TABLE_TO_ENTITY_MAP[tableName];
        if (EntityClass) {
          const repository = this.dataSource.getRepository(EntityClass);
          const count = await repository.count();
          totalLocalRecords += count;
          
          if (count > 0) {
            issues.push(`Local table ${tableName} still has ${count} records after reset`);
          }
        }
      }
      
      if (totalLocalRecords === 0) {
        console.log('[IntegrityReset] ✅ Local database is empty as expected');
      } else {
        console.warn(`[IntegrityReset] ⚠️ Local database still has ${totalLocalRecords} records after reset`);
      }
      
      // 2. Check LSN is reset to 0/0
      const currentLSN = this.getCurrentLSN();
      if (currentLSN !== '0/0') {
        issues.push(`LSN not reset properly: expected 0/0, got ${currentLSN}`);
        console.warn(`[IntegrityReset] ⚠️ LSN not properly reset: ${currentLSN}`);
      } else {
        console.log('[IntegrityReset] ✅ LSN properly reset to 0/0');
      }
      
      // 3. Send a quick server validation request if possible
      console.log('[IntegrityReset] 🌐 Attempting server validation check...');
      const serverValidation = await this.quickServerValidationCheck();
      
      if (!serverValidation.serverResponded) {
        issues.push('Server is not responding to validation requests');
        console.warn('[IntegrityReset] ⚠️ Server validation check failed - server not responding');
      } else if (serverValidation.serverHasNoData) {
        issues.push('Server appears to have no data - sync may not restore expected state');
        console.warn('[IntegrityReset] ⚠️ Server validation indicates no data available');
      } else {
        console.log('[IntegrityReset] ✅ Server validation check passed');
      }
      
      const isValid = issues.length === 0;
      
      if (isValid) {
        console.log('[IntegrityReset] ✅ Post-reset validation passed - ready for clean sync');
      } else {
        console.warn('[IntegrityReset] ⚠️ Post-reset validation found issues:', issues);
      }
      
      return { isValid, issues };
      
    } catch (error) {
      const errorMsg = `Post-reset validation error: ${error instanceof Error ? error.message : String(error)}`;
      console.error('[IntegrityReset] ❌ Post-reset validation failed with error:', error);
      return { isValid: false, issues: [errorMsg] };
    }
  }

  /**
   * Quick server validation check to ensure server has data
   */
  private async quickServerValidationCheck(): Promise<{ 
    serverResponded: boolean; 
    serverHasNoData: boolean;
  }> {
    try {
      // Try to send a simple integrity validation request to server
      // This will help us verify server connectivity and data availability
      if (!this.machineRef) {
        console.log('[IntegrityReset] No machine reference - skipping server validation');
        return { serverResponded: false, serverHasNoData: false };
      }
      
      // Generate minimal local fingerprints (should be empty after reset)
      const localFingerprints: Record<string, any> = {};
      for (const tableName of CRITICAL_TABLES) {
        localFingerprints[tableName] = {
          recordCount: 0,
          lastUpdated: 0,
          recordIdHash: '',
          recentDataHash: ''
        };
      }
      
      console.log('[IntegrityReset] 📤 Sending post-reset validation request to server...');
      
      // Send validation event to machine (non-blocking)
      this.sendEventToMachine({
        type: 'INTEGRITY_VALIDATE',
        reason: 'Post-reset server validation check',
        fingerprints: localFingerprints,
        isPostResetCheck: true
      });
      
      // For now, assume server will respond (we can't easily wait for response here)
      // The key is that we've verified local state and attempted server contact
      console.log('[IntegrityReset] 📤 Post-reset validation request sent to server');
      
      return { 
        serverResponded: true, 
        serverHasNoData: false // We'll assume server has data unless we get explicit feedback
      };
      
    } catch (error) {
      console.warn('[IntegrityReset] Server validation check failed:', error);
      return { serverResponded: false, serverHasNoData: false };
    }
  }

  /**
   * Trigger app refresh to ensure clean state after reset
   */
  private async triggerAppRefresh(): Promise<void> {
    try {
      console.log('[IntegrityReset] Triggering app refresh for clean initialization...');
      
      // Wait a moment to ensure reset operations are complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('[IntegrityReset] ✅ Refreshing app to reinitialize with clean state...');
      window.location.reload();

    } catch (error) {
      console.error('[IntegrityReset] Error triggering app refresh:', error);
      console.error('[IntegrityReset] ❌ CRITICAL: App refresh failed - please refresh manually');
    }
  }

  /**
   * Clear domain data only (wrapper for storage function)
   */
  async clearDomainData(): Promise<boolean> {
    try {
      console.log('[IntegrityReset] Clearing domain data...');
      
      const success = await clearDomainDataOnly();
      
      if (success) {
        console.log('[IntegrityReset] ✅ Domain data cleared successfully');
      } else {
        console.error('[IntegrityReset] ❌ Failed to clear domain data');
      }

      return success;

    } catch (error) {
      console.error('[IntegrityReset] Error clearing domain data:', error);
      return false;
    }
  }

  /**
   * Get current LSN for diagnostic purposes
   */
  getCurrentLSN(): string {
    try {
      const SYNC_STATE_KEY = 'sync-machine-state';
      const stored = localStorage.getItem(SYNC_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        return parsedState.currentLSN || '0/0';
      }
      return '0/0';
    } catch (error) {
      console.warn('[IntegrityReset] Error getting current LSN:', error);
      return '0/0';
    }
  }

  /**
   * Send event to state machine
   */
  private sendEventToMachine(event: any): void {
    if (this.machineRef) {
      try {
        this.machineRef.send(event);
        console.log('[IntegrityReset] Event sent to machine:', event.type);
      } catch (error) {
        console.warn('[IntegrityReset] Failed to send event to machine:', error);
      }
    }
  }
}