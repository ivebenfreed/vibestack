/**
 * DexieIntegrityReset - Dexie-based reset operations
 * 
 * Replaces the PGLite-based IntegrityReset with Dexie implementation.
 * This class handles:
 * - Full reset operations
 * - Table-specific reset operations  
 * - LSN reset coordination
 * - Service disconnection management
 * - Post-reset verification
 */

import { clearDomainDataOnly, clearAllData, resetDatabase } from '../../db/dexie-storage';
import { liveChangesManager } from '../../lib/live-changes-manager';
import { destroyGlobalSyncServicesV3 } from '../../state-machines/machines/sync-machine-v3';
import { db } from '@repo/dataforge/dexie-schema';

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

export class DexieIntegrityReset {
  private config: IntegrityResetConfig;
  private callbacks: IntegrityResetCallbacks = {};
  
  // Machine reference for event-driven communication
  private machineRef: any = null;

  constructor(config: IntegrityResetConfig) {
    this.config = config;
    
    console.log('[DexieIntegrityReset] Initialized with config:', config);
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
    console.log('[DexieIntegrityReset] Machine reference set for event-driven communication');
  }

  /**
   * Execute integrity reset with full service disconnection management
   */
  async executeReset(reason: string, resetType: 'full_reset' | 'table_reset' = 'full_reset'): Promise<IntegrityResetResult> {
    try {
      console.log(`[DexieIntegrityReset] Starting integrity reset: ${reason} (${resetType})`);
      
      this.callbacks.onResetStarted?.(reason, resetType);

      // Critical: Disconnect BEFORE reset to avoid sending messages over stale connections
      console.log('[DexieIntegrityReset] 🔌 Phase 1: Disconnecting services before reset...');
      await this.disconnectAllServices();

      // Execute the appropriate reset type
      console.log('[DexieIntegrityReset] 🗑️ Phase 2: Clearing data...');
      const result = resetType === 'full_reset' 
        ? await this.executeFullReset()
        : await this.executeDomainReset();

      // Reset LSN tracking
      console.log('[DexieIntegrityReset] 🔄 Phase 3: Resetting LSN tracking...');
      await this.resetLSNTracking();
      result.lsnReset = true;

      // Clear baseline to force re-establishment
      console.log('[DexieIntegrityReset] 📊 Phase 4: Clearing baseline...');
      localStorage.removeItem('integrity-baseline');

      // Send event to machine
      this.sendEventToMachine({ 
        type: 'INTEGRITY_RESET_COMPLETED', 
        result,
        reason 
      });

      console.log('[DexieIntegrityReset] ✅ Reset completed successfully:', result);
      this.callbacks.onResetCompleted?.(result);
      
      return result;

    } catch (error) {
      console.error('[DexieIntegrityReset] Reset failed:', error);
      
      const errorResult: IntegrityResetResult = {
        success: false,
        tablesCleared: [],
        lsnReset: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.callbacks.onResetError?.(error as Error, reason);
      
      // Send error event to machine
      this.sendEventToMachine({ 
        type: 'INTEGRITY_RESET_FAILED', 
        error: errorResult.error,
        reason 
      });
      
      return errorResult;
    }
  }

  /**
   * Execute full reset (clear all data including system tables)
   */
  private async executeFullReset(): Promise<IntegrityResetResult> {
    try {
      console.log('[DexieIntegrityReset] Executing full reset...');
      
      // Use Dexie-based reset function
      const success = await resetDatabase();
      
      if (!success) {
        throw new Error('Failed to reset database');
      }

      return {
        success: true,
        tablesCleared: ['all_tables'],
        lsnReset: false
      };

    } catch (error) {
      console.error('[DexieIntegrityReset] Full reset error:', error);
      throw error;
    }
  }

  /**
   * Execute domain reset (clear only domain data, preserve system tables)
   */
  private async executeDomainReset(): Promise<IntegrityResetResult> {
    try {
      console.log('[DexieIntegrityReset] Executing domain data reset...');
      
      // Use Dexie-based clear function
      const success = await clearDomainDataOnly();
      
      if (!success) {
        throw new Error('Failed to clear domain data');
      }

      return {
        success: true,
        tablesCleared: ['domain_tables_only'],
        lsnReset: false
      };

    } catch (error) {
      console.error('[DexieIntegrityReset] Domain reset error:', error);
      throw error;
    }
  }

  /**
   * Reset LSN tracking in sync metadata
   */
  private async resetLSNTracking(): Promise<void> {
    try {
      console.log('[DexieIntegrityReset] Resetting LSN tracking...');
      
      // Clear sync metadata from localStorage (deprecated table removed)
      // syncMetadata table no longer exists, only use localStorage
      
      // Clear any localStorage sync state
      const syncKeys = Object.keys(localStorage).filter(key => 
        key.includes('last-sync') || 
        key.includes('sync-state') ||
        key.includes('lsn')
      );
      
      syncKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[DexieIntegrityReset] Cleared localStorage key: ${key}`);
      });

      console.log('[DexieIntegrityReset] LSN tracking reset completed');
      
    } catch (error) {
      console.error('[DexieIntegrityReset] Error resetting LSN tracking:', error);
      // Don't throw - this is not critical to the reset operation
    }
  }

  /**
   * Disconnect all sync services before reset
   */
  private async disconnectAllServices(): Promise<void> {
    try {
      console.log('[DexieIntegrityReset] Disconnecting all sync services...');
      
      // Stop live changes manager
      if (liveChangesManager) {
        console.log('[DexieIntegrityReset] Stopping live changes manager...');
        liveChangesManager.stopTracking();
      }

      // Destroy global sync services
      console.log('[DexieIntegrityReset] Destroying global sync services...');
      await destroyGlobalSyncServicesV3();

      // Send disconnect event to machine if available
      this.sendEventToMachine({ type: 'SERVICES_DISCONNECTED' });
      
      console.log('[DexieIntegrityReset] All services disconnected');
      
    } catch (error) {
      console.error('[DexieIntegrityReset] Error disconnecting services:', error);
      // Continue with reset even if disconnect fails
    }
  }

  /**
   * Send event to state machine
   */
  private sendEventToMachine(event: any): void {
    if (this.machineRef) {
      try {
        this.machineRef.send(event);
        console.log('[DexieIntegrityReset] Event sent to machine:', event.type);
      } catch (error) {
        console.warn('[DexieIntegrityReset] Failed to send event to machine:', error);
      }
    }
  }

  /**
   * Quick reset method for emergency situations
   */
  async emergencyReset(): Promise<IntegrityResetResult> {
    console.log('[DexieIntegrityReset] 🚨 EMERGENCY RESET INITIATED');
    return this.executeReset('emergency_reset', 'full_reset');
  }

  /**
   * Reset only domain data, preserving system configuration
   */
  async resetDomainData(reason: string): Promise<IntegrityResetResult> {
    console.log('[DexieIntegrityReset] 📦 Domain data reset initiated');
    return this.executeReset(reason, 'table_reset');
  }
}