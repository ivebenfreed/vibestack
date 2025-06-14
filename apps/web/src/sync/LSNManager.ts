/**
 * LSNManager - Compatibility wrapper for LSN management
 * 
 * DEPRECATED: This class is being phased out in favor of direct orchestrator access.
 * Currently serves as a compatibility layer during refactor.
 */

import { SyncEventEmitter } from './SyncEventEmitter';
import { LSNService } from './LSNService';

export class LSNManager {
  private events: SyncEventEmitter;
  private listeners: Array<(lsn: string) => void> = [];

  constructor(eventEmitter: SyncEventEmitter, _syncStore: any) {
    this.events = eventEmitter;
    // Note: syncStore parameter ignored - using orchestrator state now
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
   * Initialize LSN - no-op since orchestrator handles initialization
   */
  async initialize(): Promise<void> {
    const currentLsn = this.getCurrentLSN();
    console.log(`[LSNManager] Initialized with orchestrator LSN: ${currentLsn}`);
  }

  /**
   * Get current LSN from orchestrator state
   */
  getCurrentLSN(): string {
    try {
      const snapshot = this.getOrchestratorSnapshot();
      return snapshot.context.syncState.currentLSN || '0/0';
    } catch (error) {
      console.warn('[LSNManager] Could not get LSN from orchestrator, using default:', error);
      return '0/0';
    }
  }

  /**
   * Update LSN via orchestrator
   */
  async updateLSN(newLsn: string, source: string = 'unknown'): Promise<void> {
    const currentLsn = this.getCurrentLSN();
    console.log(`[LSNManager] 🔍 updateLSN called: ${currentLsn} → ${newLsn} (source: ${source})`);
    
    if (newLsn === currentLsn) {
      console.log(`[LSNManager] 🔄 LSN update skipped (no change): ${newLsn} (source: ${source})`);
      return; // No change
    }

    console.log(`[LSNManager] 📍 LSN updated: ${currentLsn} → ${newLsn} (source: ${source})`);
    console.log(`[LSNManager] 🔔 Notifying ${this.listeners.length} listeners`);

    try {
      // Send LSN update to orchestrator
      this.getOrchestrator().send({ type: 'LSN_UPDATE', lsn: newLsn });
      console.log(`[LSNManager] 💾 LSN sent to orchestrator: ${newLsn}`);
    } catch (error) {
      console.error('[LSNManager] Failed to send LSN to orchestrator:', error);
    }

    // Notify local listeners (compatibility)
    this.notifyListeners(newLsn);

    // Emit global event (will be removed in Phase 2)
    this.events.emit('lsn:updated', { 
      previousLsn: currentLsn, 
      currentLsn: newLsn, 
      source,
      timestamp: Date.now() 
    });
    
    console.log(`[LSNManager] ✅ LSN update complete: ${newLsn}`);
  }

  /**
   * Reset LSN to 0/0 (for integrity resets)
   */
  async resetLSN(source: string = 'reset'): Promise<void> {
    await this.updateLSN(LSNService.reset(), source);
  }

  /**
   * Register a listener for LSN changes (compatibility)
   */
  onLSNChange(listener: (lsn: string) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Unregister a listener (compatibility)
   */
  offLSNChange(listener: (lsn: string) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of LSN change
   */
  private notifyListeners(newLsn: string): void {
    for (const listener of this.listeners) {
      try {
        listener(newLsn);
      } catch (error) {
        console.error('[LSNManager] Error in LSN change listener:', error);
      }
    }
  }

  /**
   * Get LSN with source tracking for debugging
   */
  getLSNWithDebugInfo(): { lsn: string; source: string; timestamp: number } {
    return {
      lsn: this.getCurrentLSN(),
      source: 'orchestrator',
      timestamp: Date.now()
    };
  }
} 