import type { ClientId, LSN, SyncStatus } from './interfaces';
import type { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';

/**
 * SyncService - Clean domain layer integration for sync functionality
 * 
 * This service provides a clean interface to sync functionality without
 * the legacy compatibility layers and circular dependencies of SyncManager.
 * 
 * @deprecated SyncManager should be migrated to use this service
 */
export class SyncService {
  private static instance: SyncService | null = null;
  private static debugMode: boolean = process.env.NODE_ENV === 'development';
  
  private sharedDataSource: NewPGliteDataSource | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    if (SyncService.debugMode) {
      console.log('[SyncService] Creating new SyncService instance');
    }
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  public static resetInstance(): void {
    SyncService.instance = null;
  }

  // Orchestrator access helpers
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

  private sendToOrchestrator(event: any) {
    this.getOrchestrator().send(event);
  }

  // Core sync state access
  public getClientId(): ClientId {
    try {
      const snapshot = this.getOrchestratorSnapshot();
      return snapshot.context.syncState.clientId;
    } catch (error) {
      if (SyncService.debugMode) {
        console.warn("[SyncService.getClientId] Could not access orchestrator context:", error);
      }
      return '';
    }
  }

  public getCurrentLSN(): LSN {
    try {
      const snapshot = this.getOrchestratorSnapshot();
      return snapshot.context.syncState.currentLSN;
    } catch (error) {
      if (SyncService.debugMode) {
        console.warn("[SyncService.getCurrentLSN] Could not access orchestrator context:", error);
      }
      return '0/0';
    }
  }

  public getSyncStatus(): SyncStatus {
    try {
      const snapshot = this.getOrchestratorSnapshot();
      const syncState = snapshot.context.syncState;
      
      // Map orchestrator sync machine state to SyncStatus
      if (syncState.machineState === 'idle' && !syncState.phase) return 'disconnected';
      if (syncState.machineState === 'connecting') return 'connecting';
      if (syncState.phase === 'initial') return 'initial_sync';
      if (syncState.phase === 'catchup') return 'catchup';
      if (syncState.phase === 'live') return 'live';
      if (syncState.error) return 'error';
      return 'disconnected';
    } catch (error) {
      if (SyncService.debugMode) {
        console.warn("[SyncService.getSyncStatus] Could not access orchestrator context:", error);
      }
      return 'disconnected';
    }
  }

  public getPendingChangesCount(): number {
    try {
      const snapshot = this.getOrchestratorSnapshot();
      return snapshot.context.syncPendingChangesCount || 0;
    } catch (error) {
      if (SyncService.debugMode) {
        console.warn("[SyncService.getPendingChangesCount] Could not access orchestrator context:", error);
      }
      return 0;
    }
  }

  public isConnected(): boolean {
    try {
      const status = this.getSyncStatus();
      return ['connecting', 'initial_sync', 'catchup', 'live'].includes(status);
    } catch (error) {
      return false;
    }
  }

  public isOnline(): boolean {
    return navigator.onLine;
  }

  // Datasource management
  public setSharedDataSource(dataSource: NewPGliteDataSource): void {
    if (SyncService.debugMode) {
      console.log('[SyncService] Shared datasource set from PGliteProvider context');
    }
    this.sharedDataSource = dataSource;
  }

  public getSharedDataSource(): NewPGliteDataSource | null {
    return this.sharedDataSource;
  }

  // Initialization
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      if (SyncService.debugMode) {
        console.log('[SyncService] Already initialized, skipping');
      }
      return;
    }

    try {
      if (SyncService.debugMode) {
        console.log('[SyncService] Initializing...');
      }

      if (!this.sharedDataSource) {
        throw new Error('Shared datasource not set. Call setSharedDataSource() first.');
      }

      // SyncService doesn't initialize its own components - it's a thin wrapper
      // around orchestrator state. The orchestrator handles initialization.
      
      this.isInitialized = true;
      
      if (SyncService.debugMode) {
        console.log('[SyncService] ✅ Initialization complete');
      }
    } catch (error) {
      console.error('[SyncService] Initialization failed:', error);
      throw error;
    }
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  // Control operations (delegate to orchestrator)
  public async connect(serverUrl?: string): Promise<boolean> {
    try {
      if (SyncService.debugMode) {
        console.log(`[SyncService] Requesting connection${serverUrl ? ` to ${serverUrl}` : ''}`);
      }
      
      const event = serverUrl 
        ? { type: 'SYNC_CONNECT', serverUrl }
        : { type: 'SYNC_CONNECT' };
      
      this.sendToOrchestrator(event);
      
      // Return true immediately - actual connection status tracked via getSyncStatus()
      return true;
    } catch (error) {
      console.error('[SyncService] Connect request failed:', error);
      return false;
    }
  }

  public disconnect(): void {
    try {
      if (SyncService.debugMode) {
        console.log('[SyncService] Requesting disconnection');
      }
      this.sendToOrchestrator({ type: 'SYNC_DISCONNECT' });
    } catch (error) {
      console.error('[SyncService] Disconnect request failed:', error);
    }
  }

  public async resetLSN(): Promise<void> {
    try {
      if (SyncService.debugMode) {
        console.log('[SyncService] Requesting LSN reset');
      }
      this.sendToOrchestrator({ type: 'SYNC_RESET_LSN' });
    } catch (error) {
      console.error('[SyncService] LSN reset request failed:', error);
    }
  }

  // Event system - delegate to orchestrator's event system
  public onStatusChange(callback: (status: SyncStatus) => void): () => void {
    // TODO: Implement event subscription to orchestrator state changes
    // For now, consumers can poll getSyncStatus() or use orchestrator directly
    console.warn('[SyncService] onStatusChange not implemented yet - use orchestrator directly');
    return () => {};
  }

  public onPendingChangesUpdate(callback: (count: number) => void): () => void {
    // TODO: Implement event subscription to orchestrator state changes
    console.warn('[SyncService] onPendingChangesUpdate not implemented yet - use orchestrator directly');
    return () => {};
  }

  // Utility methods
  public syncLSNToXState(): void {
    try {
      const currentLSN = this.getCurrentLSN();
      if (SyncService.debugMode) {
        console.log(`[SyncService] Syncing LSN to XState: ${currentLSN}`);
      }
      this.sendToOrchestrator({ type: 'LSN_UPDATE', lsn: currentLSN });
    } catch (error) {
      console.warn('[SyncService] Could not sync LSN to XState:', error);
    }
  }

  // Cleanup
  public async destroy(): Promise<void> {
    if (SyncService.debugMode) {
      console.log('[SyncService] Destroying service');
    }
    
    this.sharedDataSource = null;
    this.isInitialized = false;
    SyncService.instance = null;
  }
}

// Export singleton instance for compatibility
export const syncService = SyncService.getInstance(); 