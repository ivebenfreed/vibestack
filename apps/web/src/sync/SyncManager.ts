import { SyncEventEmitter } from './SyncEventEmitter';

// New Module Imports
import { OutgoingChangeProcessor } from './OutgoingChangeProcessor';
import { IncomingChangeProcessor } from './IncomingChangeProcessor';
import { WebSocketConnector } from './WebSocketConnector';
// Removed OrchestratorSyncInterface - accessing orchestrator directly
import { SyncMessageHandler } from './SyncMessageHandler';
import { IntegrityManager } from './IntegrityManager';
import { LSNManager } from './LSNManager';
import { 
  IOnlineStatusProvider,
  ISyncStateProvider,
  SyncStatus,
  ClientId,
  LSN,
  IMessageSender
} from './interfaces';
import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { TableChange, ClientMessage as SyncClientMessage } from '@repo/sync-types';

// Constants
export const WEBSOCKET_RECONNECT_INTERVAL = 3000;

// Type aliases for better readability
export type MessageId = string;
export type Timestamp = number;

// Legacy types for backward compatibility 
export type SyncState = 'disconnected' | 'connecting' | 'initial' | 'catchup' | 'live';

// Interfaces for better type safety and readability
export interface BaseMessage {
  type: string;
  clientId: ClientId; 
  messageId: string;
  timestamp: number;
}

export interface ClientMessage extends BaseMessage {
  inReplyTo?: string;
  lsn?: LSN; 
  resetSync?: boolean;
  changes?: Array<any>; 
  chunk?: number;
  changeIds?: string[];
  lastLSN?: LSN; 
  table?: string;
  error?: string;
  [key: string]: any;
}

export interface ServerMessage extends BaseMessage {
  state?: SyncStatus; 
  lsn?: LSN; 
  changes?: Array<any>; 
  serverLSN?: LSN; 
  changeIds?: string[];
  error?: any;
  sequence?: {
    table?: string;
    chunk?: number;
    total?: number;
    [key: string]: any;
  };
  lastLSN?: LSN; 
}

export interface ServerLiveStartMessage extends ServerMessage {
  finalLSN: LSN;
}

interface GlobalSyncManager {
  instance: SyncManager | null;
}

// Declare global scope for HMR-stable singleton
declare global {
  interface Window {
    __syncManager?: GlobalSyncManager;
  }
}

/**
 * SyncManager
 * 
 * @deprecated This class is being phased out in favor of pure services and XState machines.
 * 
 * Legacy: Orchestrates the different components of the synchronization process.
 * Acts as a facade for UI components and other parts of the application
 * to interact with the sync system.
 * 
 * NEW APPROACH: Use sync-machine with pure services (WebSocketService, IncomingChangeService, OutgoingChangeService)
 * 
 * Implements a HMR-stable singleton pattern.
 */
export class SyncManager implements IOnlineStatusProvider, ISyncStateProvider {
  public static readonly VERSION = '1.0.0';
  private static debugMode: boolean = process.env.NODE_ENV === 'development' && false;
  
  // Use global window scope for HMR-stable singleton
  private static getGlobalState(): GlobalSyncManager {
    if (typeof window !== 'undefined') {
      if (!window.__syncManager) {
        window.__syncManager = { instance: null };
      }
      return window.__syncManager;
    }
    // Fallback for SSR/Node environments
    return { instance: null };
  }

  private static get instance(): SyncManager | null {
    return this.getGlobalState().instance;
  }

  private static set instance(value: SyncManager | null) {
    this.getGlobalState().instance = value;
  }
  
  public readonly events = new SyncEventEmitter();

  // Core sync modules
  private outgoingChangeProcessor!: OutgoingChangeProcessor;
  private incomingChangeProcessor!: IncomingChangeProcessor;
  private webSocketConnector!: WebSocketConnector;
  // DEPRECATED: Temporarily keeping for compatibility during migration
  private syncStatePersister: any = {
    initialize: async () => {},
    getClientId: () => {
      // Avoid circular dependency - access orchestrator directly
      try {
        const snapshot = this.getOrchestratorSnapshot();
        return snapshot.context.syncState.clientId;
      } catch (error) {
        return '';
      }
    },
    getStatus: () => this.getStatus(),
    getPendingChangesCount: () => this.getPendingChangesCount(),
    resetSyncState: async () => {},
    close: async () => {}
  };
  private syncMessageHandler!: SyncMessageHandler;
  private integrityManager!: IntegrityManager;
  private lsnManager!: LSNManager;
  
  // Shared datasource from PGliteProvider (required)
  private sharedDataSource: NewPGliteDataSource | null = null;
  
  // Initialization state
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  
  // Configuration
  private autoConnect: boolean = true;

  private constructor() {
    if (SyncManager.debugMode) {
      console.log('[SyncManager] Constructor: Creating new SyncManager instance');
    }
    this.setupModules();
    this.registerEventHandlers();
  }

  // Helper methods to access orchestrator context directly
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

  // Helper methods to replace syncStatePersister functionality
  private async initializeSyncState(): Promise<void> {
    // No-op: orchestrator handles state initialization automatically
  }

  // getClientId is public (required by ISyncStateProvider interface) - implemented below

  private getCurrentLSN(): string {
    const snapshot = this.getOrchestratorSnapshot();
    return snapshot.context.syncState.currentLSN;
  }

  private getSyncStatus(): SyncStatus {
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
  }

  private getPendingChangesCountFromState(): number {
    const snapshot = this.getOrchestratorSnapshot();
    return snapshot.context.syncPendingChangesCount;
  }

  private async saveSyncState(data: { currentLsn?: string; syncState?: string }): Promise<void> {
    // Only save what orchestrator needs via events
    // LSN updates are handled via notifyXStateOfLSN
    // Status changes are handled by sync machine
  }

  private async resetSyncState(): Promise<void> {
    this.sendToOrchestrator({ type: 'SYNC_CLIENT_ID_RESET' });
  }

  private setupModules(): void {
    if (SyncManager.debugMode) {
      console.log('[SyncManager] setupModules: Initializing core sync modules');
    }

    // Note: LSNManager will be updated to be a pure utility in next phase
    this.lsnManager = new LSNManager(this.events, null as any); // Temporary until LSNManager refactor
    this.webSocketConnector = new WebSocketConnector(this.events);

    if (SyncManager.debugMode) {
      console.log('[SyncManager] setupModules: Core sync modules initialized');
    }
  }

  private registerEventHandlers(): void {
    if (SyncManager.debugMode) {
      console.log('[SyncManager] registerEventHandlers: Setting up global event listeners');
    }

    this.events.on('websocket:status', (status: 'connected' | 'disconnected' | 'connecting' | 'error') => {
      if (SyncManager.debugMode) {
        console.log(`[SyncManager] Event: websocket:status received: ${status}`);
      }
      
      const currentStatus = this.getStatus();
            this.events.emit('sync:statusChanged', currentStatus);
      this.events.emit('stateChange', currentStatus);

      if (status === 'disconnected' && this.autoConnect && this.isInitialized && !this.isInitializing) {
         if (SyncManager.debugMode) {
            console.log('[SyncManager] WebSocket disconnected, autoConnect is on. WebSocketConnector handles reconnection.');
        }
      }
    });
    
    this.events.on('outgoing:pendingCountChanged', (count: number) => {
        if (SyncManager.debugMode) {
            console.log(`[SyncManager] Event: outgoing:pendingCountChanged received: ${count}`);
        }
        this.events.emit('pendingChangesUpdate', count);
    });

    this.events.on('sync:error', (errorData: { type: string, message: string, error?: any }) => {
        console.error(`[SyncManager] Sync Error (${errorData.type}): ${errorData.message}`, errorData.error || '');
    });

    this.events.on('syncStatePersister:stateUpdated', (newState: { clientId: ClientId, lsn: LSN, status: SyncStatus }) => {
        if (SyncManager.debugMode) {
            console.log('[SyncManager] Event: syncStatePersister:stateUpdated', newState);
        }
    });

    // Heartbeat event handlers
    this.events.on('heartbeat:timeout', (data: { missedCount: number, lastPongReceived: number }) => {
        console.warn('[SyncManager] Heartbeat timeout detected', data);
        this.events.emit('sync:connection_degraded', {
          reason: 'heartbeat_timeout',
          missedHeartbeats: data.missedCount
        });
    });

    this.events.on('heartbeat:connection_lost', (data: { missedCount: number, lastPongReceived: number }) => {
        console.error('[SyncManager] Connection lost due to heartbeat failure', data);
        this.events.emit('sync:connection_lost', {
          reason: 'heartbeat_failure',
          missedHeartbeats: data.missedCount
        });
    });

    this.events.on('heartbeat:response', (data: { responseTime: number, wasRecovery: boolean }) => {
        if (SyncManager.debugMode) {
            console.log('[SyncManager] Heartbeat response received', data);
        }
        
        if (data.wasRecovery) {
            console.log('[SyncManager] Connection recovered after missed heartbeats');
            this.events.emit('sync:connection_recovered');
            
            // Notify XState machine for potential integrity validation
            this.notifyXStateOfConnectionRecovery(true);
        }
    });

    this.events.on('heartbeat:lsn_drift_detected', (data: { clientLSN: string, serverLSN: string }) => {
        console.warn('[SyncManager] LSN drift detected in heartbeat', data);
        this.events.emit('sync:lsn_drift_detected', data);
        
        // Notify XState machine for integrity validation
        this.notifyXStateOfLSNDrift(data.clientLSN, data.serverLSN);
    });

    this.events.on('heartbeat:error', () => {
        console.error('[SyncManager] Heartbeat error detected');
        this.events.emit('sync:error', {
          type: 'heartbeat_error',
          message: 'Failed to send or process heartbeat'
        });
    });

    // Handle integrity reset reconnection requests
    this.events.on('sync:reconnect_requested', async (data: { reason: string, newLSN: string }) => {
        console.log(`[SyncManager] Reconnection requested: ${data.reason} (LSN: ${data.newLSN})`);
        
        if (this.autoConnect && this.isInitialized) {
          try {
            // Disconnect first if connected
            if (this.isConnected()) {
              console.log('[SyncManager] Disconnecting before reconnection...');
              this.disconnect();
              // Wait for clean disconnection and state cleanup
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            // Ensure LSN is properly saved to state before reconnecting
            await this.saveSyncState({
              currentLsn: data.newLSN,
              syncState: 'disconnected'
            });
            
            // Update connection params with new LSN and reconnect
            const clientId = this.getClientId();
            this.webSocketConnector?.setConnectionParams(clientId, data.newLSN);
            
            console.log('[SyncManager] Attempting reconnection for automatic sync...');
            await this.connect();
            console.log('[SyncManager] ✅ Reconnection successful - automatic sync should begin');
          } catch (error) {
            console.error('[SyncManager] Failed to reconnect after integrity reset:', error);
          }
        } else {
          console.warn('[SyncManager] Cannot reconnect - autoConnect disabled or not initialized');
        }
    });

    // Forward sync status changes to XState machine
    this.events.on('sync:statusChanged', (status: string) => {
        if (SyncManager.debugMode) {
            console.log(`[SyncManager] Forwarding sync status change to XState: ${status}`);
        }
        
        // Notify XState machine about sync status changes
        try {
          const appActor = (window as any).appActor;
          if (appActor) {
            appActor.send({ 
              type: 'SYNC_STATUS_CHANGED', 
              status: status,
              timestamp: Date.now()
            });
            console.log(`[SyncManager] ✅ Notified XState machine: SYNC_STATUS_CHANGED (${status})`);
          } else if (SyncManager.debugMode) {
            console.warn('[SyncManager] XState app machine actor not available');
          }
        } catch (error) {
          console.error('[SyncManager] Error notifying XState machine:', error);
        }
    });
  }
  
  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      if (SyncManager.debugMode) console.log('[SyncManager.getInstance] Creating new SyncManager instance.');
      SyncManager.instance = new SyncManager();
    } else {
      if (SyncManager.debugMode) console.log('[SyncManager.getInstance] Returning existing SyncManager instance.');
      
      // During HMR, check if the instance is in a valid state
      if (import.meta.hot) {
        const instance = SyncManager.instance;
        
        // If the instance is in an invalid state (e.g., datasource is null but should be set),
        // we might need to reset some state
        if (instance.isInitialized && !instance.sharedDataSource) {
          console.warn('[SyncManager.getInstance] HMR detected: Instance is initialized but missing shared datasource');
          // Don't reset the instance, but log the issue - the setSharedDataSource method will handle this
        }
        
        // console.log('[SyncManager.getInstance] HMR: Reusing existing instance'); // DISABLED: Too noisy
      }
    }
    return SyncManager.instance;
  }
  
  /**
   * Set the shared datasource from PGliteProvider
   * Must be called before initialize() to use domain layer integration
   * During HMR, allows updating the datasource even if already initialized
   */
  public setSharedDataSource(dataSource: NewPGliteDataSource): void {
    // During HMR, we might need to update the datasource even if already initialized
    if (this.isInitialized || this.isInitializing) {
      if (import.meta.hot) {
        console.log('[SyncManager] HMR detected: Updating shared datasource on already initialized SyncManager');
        this.sharedDataSource = dataSource;
        
        // If we have an outgoing change processor, update its datasource reference
        if (this.outgoingChangeProcessor && dataSource.isInitialized) {
          console.log('[SyncManager] 🔥 HMR: Updating OutgoingChangeProcessor datasource reference');
          try {
            this.outgoingChangeProcessor.updateDataSource(dataSource);
            console.log('[SyncManager] 🔥 HMR: Successfully updated OutgoingChangeProcessor datasource');
          } catch (error) {
            console.error('[SyncManager] 🔥 HMR: Failed to update OutgoingChangeProcessor datasource:', error);
          }
        }
        return;
      }
      
      throw new Error('Cannot set shared datasource after SyncManager initialization has started');
    }
    
    this.sharedDataSource = dataSource;
    console.log('[SyncManager] Shared datasource set from PGliteProvider context');
  }

  /**
   * Initialize the SyncManager with improved HMR resilience
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      if (SyncManager.debugMode) console.log('[SyncManager.initialize] Already initialized.');
      
      // During HMR, verify that our components are still valid
      if (import.meta.hot && this.sharedDataSource) {
        console.log('[SyncManager] HMR detected: Verifying initialization state');
        
        // Defer HMR state verification to avoid blocking React's message handler
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Check if our datasource is still valid
        if (!this.sharedDataSource.isInitialized) {
          console.warn('[SyncManager] HMR: Shared datasource is no longer initialized, forcing re-initialization');
          this.isInitialized = false;
          this.isInitializing = false;
          this.initPromise = null;
          // Fall through to re-initialize
        } else {
          console.log('[SyncManager] HMR: Initialization state is valid, skipping re-initialization');
          return;
        }
      } else {
        return;
      }
    }
    
    if (this.isInitializing) {
      if (SyncManager.debugMode) console.log('[SyncManager.initialize] Already initializing, waiting for completion.');
      return this.initPromise!; 
    }

    if (!this.sharedDataSource) {
      throw new Error('Shared datasource must be set before initializing SyncManager. Call setSharedDataSource() first.');
    }
    
    // Additional check: ensure the shared datasource is actually initialized
    if (!this.sharedDataSource.isInitialized) {
      throw new Error('Shared datasource must be initialized before initializing SyncManager.');
    }
    
    this.isInitializing = true;
    if (SyncManager.debugMode) console.log('[SyncManager.initialize] Starting initialization sequence with shared datasource.');

    this.initPromise = (async () => {
      try {
        await this.syncStatePersister.initialize();
        await this.lsnManager.initialize();
        const clientId = this.syncStatePersister.getClientId();
        const lsn = this.lsnManager.getCurrentLSN();
        if (SyncManager.debugMode) console.log(`[SyncManager.initialize] SyncStatePersister and LSNManager initialized. ClientID: ${clientId}, LSN: ${lsn}`);

        // Initialize sync modules using shared datasource
        this.incomingChangeProcessor = new IncomingChangeProcessor(this.events);
        if (SyncManager.debugMode) console.log('[SyncManager.initialize] IncomingChangeProcessor instantiated.');

        this.outgoingChangeProcessor = new OutgoingChangeProcessor(
          this.sharedDataSource!,
          this.events,
          this.webSocketConnector
        );
        if (SyncManager.debugMode) console.log('[SyncManager.initialize] OutgoingChangeProcessor instantiated with shared datasource.');

        // Initialize IntegrityManager
        this.integrityManager = new IntegrityManager(
          this.events,
          this.syncStatePersister
        );
        this.integrityManager.setMessageSender(this.webSocketConnector);
        this.integrityManager.setLSNManager(this.lsnManager);
        this.integrityManager.setSyncManager(this);
        console.log('[SyncManager.initialize] ✅ IntegrityManager instantiated and configured.');

        this.syncMessageHandler = new SyncMessageHandler(
          this.events,
          this.webSocketConnector,
          this.incomingChangeProcessor,
          this.syncStatePersister,
          this.integrityManager,
          this.lsnManager
        );
        if (SyncManager.debugMode) console.log('[SyncManager.initialize] SyncMessageHandler instantiated.');
        
        this.webSocketConnector.setConnectionParams(clientId, lsn);
        if (SyncManager.debugMode) console.log('[SyncManager.initialize] WebSocketConnector connection params set.');

        // Register WebSocketConnector to listen for LSN changes
        this.lsnManager.onLSNChange((newLsn: string) => {
          console.log(`[SyncManager] 🔔 LSN change listener triggered: ${newLsn}`);
          console.log(`[SyncManager] 🔄 Updating WebSocketConnector params with new LSN: ${newLsn}`);
          this.webSocketConnector.setConnectionParams(this.getClientId(), newLsn);
          
          // Also notify XState machine about LSN changes
          console.log(`[SyncManager] 📤 About to notify XState of LSN change: ${newLsn}`);
          this.notifyXStateOfLSN(newLsn);
        });

        // 🔥 CRITICAL FIX: Send initial LSN to XState after initialization
        // This ensures XState gets the stored LSN value, not just updates
        const initialLSN = this.lsnManager.getCurrentLSN();
        console.log(`[SyncManager] 🎯 Sending initial LSN to XState: ${initialLSN}`);
        this.notifyXStateOfLSN(initialLSN);

        const initialStateData = {
            clientId,
            currentLsn: lsn,
            syncState: this.syncStatePersister.getStatus(),
            pendingChangesCount: this.syncStatePersister.getPendingChangesCount(),
            lastSyncTime: null
        };
        this.syncMessageHandler.syncInitialState(initialStateData);
        if (SyncManager.debugMode) console.log('[SyncManager.initialize] SyncMessageHandler initial state synced.');

        this.isInitialized = true;
        this.isInitializing = false;
        this.events.emit('sync:initialized', { clientId, lsn });
        if (SyncManager.debugMode) console.log(`[SyncManager.initialize] Initialization complete. ClientID: ${this.getClientId()}, LSN: ${this.getLSN()}`);

        if (this.autoConnect) {
          if (SyncManager.debugMode) console.log('[SyncManager.initialize] Auto-connecting to server post-initialization.');
          this.connect().catch(error => { 
            console.error('[SyncManager.initialize] Auto-connect post-initialization failed:', error);
          });
        }
      } catch (error) {
        console.error('[SyncManager.initialize] Initialization failed:', error);
        this.isInitializing = false;
        this.isInitialized = false; 
        this.events.emit('sync:error', { type: 'initialization', message: 'SyncManager initialization failed', error });
        throw error; 
      }
    })();
    
    return this.initPromise;
  }

  // --- Public API Methods ---

  public async connect(serverUrl?: string, suppressAuthErrors: boolean = false): Promise<boolean> {
    if (!this.isInitialized) {
      console.warn('[SyncManager.connect] SyncManager not initialized. Call initialize() first or await initialization.');
      if (this.isInitializing && this.initPromise) {
          if (SyncManager.debugMode) console.log('[SyncManager.connect] Waiting for ongoing initialization...');
          await this.initPromise;
          if (!this.isInitialized) {
              console.error('[SyncManager.connect] Initialization failed, cannot connect.');
              return false;
          }
      } else if (!this.isInitialized) {
          console.error('[SyncManager.connect] Not initialized and not initializing. Cannot connect.');
          return false;
      }
    }
    if (SyncManager.debugMode) {
      console.log(`[SyncManager.connect] Attempting to connect. Server URL: ${serverUrl || 'using default'}`);
    }
    return this.webSocketConnector.connect(serverUrl, suppressAuthErrors);
  }

  public disconnect(): void {
    if (SyncManager.debugMode) console.log('[SyncManager.disconnect] Attempting to disconnect.');
    if (this.webSocketConnector) {
      this.webSocketConnector.disconnect();
    } else {
      if (SyncManager.debugMode) console.warn('[SyncManager.disconnect] WebSocketConnector not available.');
    }
  }

  public isConnected(): boolean {
    return this.webSocketConnector?.isConnected() ?? false;
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public send(messageData: Omit<ClientMessage, 'clientId' | 'messageId' | 'timestamp'>): void {
    if (!this.isInitialized) {
        console.warn('[SyncManager.send] SyncManager not initialized. Cannot send message.');
        return;
    }
    if (!this.isConnected()) {
        console.warn('[SyncManager.send] Not connected. Message not sent:', messageData);
        return;
    }
    if (SyncManager.debugMode) console.log('[SyncManager.send] Sending message via WebSocketConnector:', messageData);
    this.webSocketConnector.send(messageData);
  }
  
  public getStatus(): SyncStatus {
    if (!this.isInitialized && !this.isInitializing) return 'disconnected';
    if (this.isInitializing) return 'connecting';

    const wsStatus = this.webSocketConnector?.getStatus();
    if (wsStatus) {
        if (wsStatus === 'connected') {
            return this.syncMessageHandler?.getCurrentSyncPhase() || 'live';
        }
        if (wsStatus === 'connecting') return 'connecting';
        return 'disconnected';
    }
    return this.syncStatePersister?.getStatus() || 'disconnected';
  }

  public getLSN(): LSN {
    if (!this.lsnManager) {
        if (SyncManager.debugMode) console.warn("[SyncManager.getLSN] LSNManager not initialized.");
        return '0/0'; 
    }
    return this.lsnManager.getCurrentLSN();
  }

  public getClientId(): ClientId {
    try {
      const snapshot = this.getOrchestratorSnapshot();
      return snapshot.context.syncState.clientId;
    } catch (error) {
      if (SyncManager.debugMode) {
        console.warn("[SyncManager.getClientId] Could not access orchestrator context:", error);
      }
      return '';
    }
  }

  public getPendingChangesCount(): number {
    if (!this.outgoingChangeProcessor) {
        if (SyncManager.debugMode) console.warn("[SyncManager.getPendingChangesCount] OutgoingChangeProcessor not initialized.");
        return 0;
    }
    return this.outgoingChangeProcessor.getQueueSize();
  }

public getOutgoingChangeProcessor(): OutgoingChangeProcessor {
    if (!this.outgoingChangeProcessor) {
      // This case should ideally not happen if SyncManager is initialized properly
      // and its components are constructed.
      throw new Error("OutgoingChangeProcessor not initialized in SyncManager.");
    }
    return this.outgoingChangeProcessor;
  }

  public getIncomingChangeProcessor(): IncomingChangeProcessor {
    if (!this.incomingChangeProcessor) {
      // This case should ideally not happen if SyncManager is initialized properly
      // and its components are constructed.
      throw new Error("IncomingChangeProcessor not initialized in SyncManager.");
    }
    return this.incomingChangeProcessor;
  }

  public getIntegrityManager(): IntegrityManager {
    if (!this.integrityManager) {
      throw new Error("IntegrityManager not initialized in SyncManager.");
    }
    return this.integrityManager;
  }

  public getLSNManager(): LSNManager {
    if (!this.lsnManager) {
      throw new Error("LSNManager not initialized in SyncManager.");
    }
    return this.lsnManager;
  }

  /**
   * Notify XState machine of LSN changes
   */
  private notifyXStateOfLSN(lsn: string): void {
    try {
      // Try orchestrator first (new architecture)
      const orchestratorActor = (window as any).orchestratorActor;
      if (orchestratorActor) {
        console.log(`[SyncManager] 📤 Sending LSN_UPDATE to Orchestrator: ${lsn}`);
        orchestratorActor.send({ type: 'LSN_UPDATE', lsn: lsn });
        return;
      }
      
      // Fallback to app machine (legacy)
      const appActor = (window as any).appActor;
      if (appActor) {
        console.log(`[SyncManager] 📤 Sending LSN_UPDATE to App Machine: ${lsn}`);
        appActor.send({ type: 'LSN_UPDATE', lsn: lsn });
        return;
      }
      
      // If no actor available, retry after a short delay (for initialization timing)
      console.warn('[SyncManager] ⚠️ Neither orchestratorActor nor appActor available for LSN update, retrying in 100ms');
      setTimeout(() => {
        this.notifyXStateOfLSNRetry(lsn, 1);
      }, 100);
      
    } catch (error) {
      console.warn('[SyncManager] Could not notify XState machine of LSN update:', error);
    }
  }
  
  /**
   * Retry mechanism for LSN notification during initialization timing issues
   */
  private notifyXStateOfLSNRetry(lsn: string, attempt: number): void {
    if (attempt > 5) {
      console.error(`[SyncManager] ❌ Failed to send LSN_UPDATE after ${attempt} attempts, giving up`);
      return;
    }
    
    try {
      // Try orchestrator first (new architecture)
      const orchestratorActor = (window as any).orchestratorActor;
      if (orchestratorActor) {
        console.log(`[SyncManager] 📤 Sending LSN_UPDATE to Orchestrator (retry ${attempt}): ${lsn}`);
        orchestratorActor.send({ type: 'LSN_UPDATE', lsn: lsn });
        return;
      }
      
      // Fallback to app machine (legacy)
      const appActor = (window as any).appActor;
      if (appActor) {
        console.log(`[SyncManager] 📤 Sending LSN_UPDATE to App Machine (retry ${attempt}): ${lsn}`);
        appActor.send({ type: 'LSN_UPDATE', lsn: lsn });
        return;
      }
      
      // Still not available, retry with exponential backoff
      const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000); // Max 1 second
      console.warn(`[SyncManager] ⚠️ XState actor still not available (attempt ${attempt}), retrying in ${delay}ms`);
      setTimeout(() => {
        this.notifyXStateOfLSNRetry(lsn, attempt + 1);
      }, delay);
      
    } catch (error) {
      console.warn(`[SyncManager] Error on LSN update retry ${attempt}:`, error);
    }
  }

  /**
   * Notify XState machine of LSN drift detection
   */
  private notifyXStateOfLSNDrift(clientLSN: string, serverLSN: string): void {
    try {
      // Try orchestrator first (new architecture)
      const orchestratorActor = (window as any).orchestratorActor;
      if (orchestratorActor) {
        console.log(`[SyncManager] 📤 Sending LSN_DRIFT_DETECTED to Orchestrator: client=${clientLSN}, server=${serverLSN}`);
        orchestratorActor.send({ type: 'LSN_DRIFT_DETECTED', clientLSN, serverLSN });
        return;
      }
      
      // Fallback to app machine (legacy)
      const appActor = (window as any).appActor;
      if (appActor) {
        console.log(`[SyncManager] 📤 Sending LSN_DRIFT_DETECTED to App Machine: client=${clientLSN}, server=${serverLSN}`);
        appActor.send({ type: 'LSN_DRIFT_DETECTED', clientLSN, serverLSN });
      } else {
        console.warn('[SyncManager] ⚠️ Neither orchestratorActor nor appActor available for LSN drift notification');
      }
    } catch (error) {
      console.warn('[SyncManager] Could not notify XState machine of LSN drift:', error);
    }
  }

  /**
   * Notify XState machine of connection recovery
   */
  private notifyXStateOfConnectionRecovery(wasOffline: boolean, durationMs?: number): void {
    try {
      // Try orchestrator first (new architecture)
      const orchestratorActor = (window as any).orchestratorActor;
      if (orchestratorActor) {
        console.log(`[SyncManager] 📤 Sending CONNECTION_RECOVERED to Orchestrator: wasOffline=${wasOffline}`);
        orchestratorActor.send({ type: 'CONNECTION_RECOVERED', disconnectedMs: durationMs || 0 });
        return;
      }
      
      // Fallback to app machine (legacy)
      const appActor = (window as any).appActor;
      if (appActor) {
        console.log(`[SyncManager] 📤 Sending CONNECTION_RECOVERED to App Machine: wasOffline=${wasOffline}`);
        appActor.send({ type: 'CONNECTION_RECOVERED', wasOffline, durationMs });
      } else {
        console.warn('[SyncManager] ⚠️ Neither orchestratorActor nor appActor available for connection recovery notification');
      }
    } catch (error) {
      console.warn('[SyncManager] Could not notify XState machine of connection recovery:', error);
    }
  }

  /** @deprecated Pending changes are managed internally. */
  public updatePendingChangesCount(_count: number): void {
    if (SyncManager.debugMode) {
        console.warn('[SyncManager.updatePendingChangesCount] This method is deprecated.');
    }
  }
  
  public async resetLSN(): Promise<void> {
    if (SyncManager.debugMode) console.warn('[SyncManager.resetLSN] Initiating LSN and client state reset.');
    
    if (this.webSocketConnector?.isConnected() || this.webSocketConnector?.getStatus() === 'connecting') {
      this.webSocketConnector.disconnect(); 
    }

    // Reset LSN through centralized manager
    await this.lsnManager.resetLSN('manual_reset');
    
    // Reset other sync state
    await this.syncStatePersister.resetSyncState(); 
    
    const newClientId = this.syncStatePersister.getClientId();
    const newLSN = this.lsnManager.getCurrentLSN();

    if (SyncManager.debugMode) console.log(`[SyncManager.resetLSN] State reset. New ClientID: ${newClientId}, New LSN: ${newLSN}`);
    
    this.webSocketConnector?.setConnectionParams(newClientId, newLSN);
    // Pass the full state object to syncInitialState after reset
    const resetStateData = {
        clientId: newClientId,
        currentLsn: newLSN,
        syncState: this.syncStatePersister.getStatus(), // Should be 'disconnected' after reset
        pendingChangesCount: this.syncStatePersister.getPendingChangesCount(), // Should be 0 after reset
        lastSyncTime: null
    };
    this.syncMessageHandler?.syncInitialState(resetStateData);
    await this.outgoingChangeProcessor?.handleLSNReset();

    this.events.emit('sync:stateReset', { clientId: newClientId, lsn: newLSN });
    if (SyncManager.debugMode) console.warn('[SyncManager.resetLSN] LSN reset complete. Re-sync on next connection.');

    if (this.autoConnect) {
      if (SyncManager.debugMode) console.log('[SyncManager.resetLSN] Auto-connecting after LSN reset.');
      this.connect().catch(err => console.error('[SyncManager.resetLSN] Error auto-connecting after LSN reset:', err));
    }
  }

  public on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }

  public off(event: string, listener: (...args: any[]) => void): void {
    this.events.off(event, listener);
  }

  public setAutoConnect(enabled: boolean): void {
    this.autoConnect = enabled;
    this.webSocketConnector?.setAutoReconnect(enabled); 

    if (SyncManager.debugMode) console.log(`[SyncManager.setAutoConnect] Auto-connect ${enabled ? 'enabled' : 'disabled'}.`);
    if (enabled && this.isInitialized && !this.isConnected() && this.webSocketConnector?.getStatus() === 'disconnected') {
      if (SyncManager.debugMode) console.log('[SyncManager.setAutoConnect] Auto-connect enabled, attempting to connect.');
      this.connect().catch(err => console.error('[SyncManager.setAutoConnect] Error on connect:', err));
    }
  }
  
  public getAutoConnect(): boolean {
    return this.autoConnect;
  }

  public async autoConnectToServer(): Promise<void> { 
    if (this.autoConnect && this.isInitialized && !this.isConnected() && this.webSocketConnector?.getStatus() === 'disconnected') {
      if (SyncManager.debugMode) console.log('[SyncManager.autoConnectToServer] Explicitly triggering auto-connect...');
      try {
        await this.connect();
      } catch (error) {
        console.error('[SyncManager.autoConnectToServer] Auto-connect trigger failed:', error);
      }
    } else {
      if (SyncManager.debugMode) {
        const reason = !this.autoConnect ? 'autoConnect is false' 
                     : !this.isInitialized ? 'not initialized' 
                     : this.isConnected() ? 'already connected' 
                     : `status is ${this.webSocketConnector?.getStatus()}`;
        console.log(`[SyncManager.autoConnectToServer] Auto-connect condition not met (${reason}).`);
      }
    }
  }

  public async destroy(): Promise<void> {
    if (SyncManager.debugMode) console.log('[SyncManager.destroy] Destroying SyncManager instance.');
    
    this.disconnect();
    
    // Flush and close the IndexedDB sync store
    await this.syncStatePersister?.close();
    
    // Clean up event listeners
    this.events.removeAllListeners();
    
    // Reset state
    this.isInitialized = false;
    this.isInitializing = false;
    this.initPromise = null;
    
    // Reset singleton instance
    SyncManager.instance = null;
    
    if (SyncManager.debugMode) console.log('[SyncManager.destroy] SyncManager destroyed.');
  }

  // --- IOnlineStatusProvider Implementation ---
  public isOnline(): boolean {
    return this.webSocketConnector?.isOnline() ?? navigator.onLine;
  }
  
  /**
   * Manually trigger LSN sync to XState (useful for ensuring orchestrator gets initial LSN)
   */
  public syncLSNToXState(): void {
    if (!this.isInitialized) {
      console.warn('[SyncManager.syncLSNToXState] SyncManager not initialized yet');
      return;
    }
    
    const currentLSN = this.lsnManager.getCurrentLSN();
    console.log(`[SyncManager] 🔄 Manually syncing current LSN to XState: ${currentLSN}`);
    this.notifyXStateOfLSN(currentLSN);
  }
}

// HMR: Accept hot updates for this module
if (import.meta.hot) {
  import.meta.hot.accept();
  
  // During HMR dispose, we could optionally preserve the SyncManager instance
  // For now, we'll let it persist naturally through the singleton pattern
  import.meta.hot.dispose((data) => {
    const instance = SyncManager.getInstance();
    console.log("🔥 [SyncManager] HMR Dispose: SyncManager instance exists:", !!instance);
    if (instance) {
      try {
        // Use public methods to check state
        const clientId = instance.getClientId();
        const isInitialized = !!clientId; // If we have a clientId, we're likely initialized
        console.log("🔥 [SyncManager] HMR Dispose: Instance state - initialized:", isInitialized);
      } catch (error) {
        console.log("🔥 [SyncManager] HMR Dispose: Instance state - not initialized");
      }
    }
    // Store reference for potential restoration (though we rely on singleton pattern)
    data.timestamp = Date.now();
  });
}