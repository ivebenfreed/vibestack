/**
 * Sync Machine V2 - Pure Services Architecture
 * 
 * Phase 3: Enhanced sync machine using pure services
 * 
 * This machine coordinates:
 * - WebSocketService for connections
 * - IncomingChangeService for processing server changes
 * - OutgoingChangeService for sending local changes
 * - LSNService for LSN utilities
 * 
 * No circular dependencies, no global event emitters, pure XState coordination
 */

import { setup, assign, fromPromise, sendParent, log } from 'xstate';
import { WebSocketService, WebSocketServiceConfig } from '../../sync/WebSocketService';
import { IncomingChangeService, IncomingChangeServiceConfig } from '../../sync/IncomingChangeService';
import { OutgoingChangeService, OutgoingChangeServiceConfig } from '../../sync/OutgoingChangeService';
import { IntegrityService, IntegrityServiceConfig } from '../../sync/IntegrityService';
import { LSNService } from '../../sync/LSNService';
import { NewPGliteDataSource } from '../../db/newtypeorm/NewDataSource';
import { getSyncWebSocketUrl } from '../../sync/config';

// Service registry outside of XState context to prevent serialization issues
const serviceRegistry = new Map<string, {
  webSocketService: WebSocketService | null;
  incomingChangeService: IncomingChangeService | null;
  outgoingChangeService: OutgoingChangeService | null;
  integrityService: IntegrityService | null;
}>();

// Global persistent services - survive sync machine recreation
let globalServices: {
  webSocketService: WebSocketService | null;
  incomingChangeService: IncomingChangeService | null;
  outgoingChangeService: OutgoingChangeService | null;
  integrityService: IntegrityService | null;
} | null = null;

// Function to destroy global services (called on app shutdown)
export const destroyGlobalSyncServices = () => {
  console.log('[SyncMachineV2] Destroying global services...');
  if (globalServices) {
    globalServices.webSocketService?.destroy();
    globalServices.incomingChangeService?.destroy();
    globalServices.outgoingChangeService?.destroy();
    globalServices = null;
  }
  serviceRegistry.clear();
  console.log('[SyncMachineV2] Global services destroyed');
};

// 🔥 HMR FIX: Clean up global services on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[SyncMachineV2] 🔥 HMR: Cleaning up global sync services...');
    destroyGlobalSyncServices();
  });
}

// 🔥 AUTH-AWARE CLEANUP: Automatically destroy sync services when user signs out
let authCleanupInitialized = false;

export const initializeAuthAwareSyncCleanup = () => {
  if (authCleanupInitialized) return;
  authCleanupInitialized = true;

  console.log('[SyncMachineV2] 🔐 Initializing auth-aware sync cleanup...');
  
  const authActor = (window as any).authMachineActor;
  if (!authActor) {
    console.warn('[SyncMachineV2] AuthMachine actor not available for cleanup subscription');
    return;
  }

  // Subscribe to auth state changes
  const subscription = authActor.subscribe((snapshot: any) => {
    const isAuthenticated = snapshot.matches('authenticated');
    const isSigningOut = snapshot.matches('signingOut');
    
    console.log('[SyncMachineV2] 🔐 Auth state change:', { 
      state: snapshot.value, 
      isAuthenticated, 
      isSigningOut,
      hasGlobalServices: !!globalServices 
    });
    
    // If user is signing out or no longer authenticated, destroy sync services
    if ((isSigningOut || !isAuthenticated) && globalServices) {
      console.log('[SyncMachineV2] 🔐 User signed out, destroying sync services and resetting machine state');
      destroyGlobalSyncServices();
      
      // Also reset the sync machine state to idle for clean restart
      const orchestratorActor = (window as any).orchestratorV2Actor;
      console.log('[SyncMachineV2] 🔐 Attempting to find sync actor for reset...', {
        hasOrchestrator: !!orchestratorActor
      });
      
      if (orchestratorActor) {
        const orchestratorSnapshot = orchestratorActor.getSnapshot();
        const appInitMachine = orchestratorSnapshot?.children?.appInitMachine;
        console.log('[SyncMachineV2] 🔐 App init machine check:', {
          hasAppInit: !!appInitMachine
        });
        
        if (appInitMachine) {
          const appInitSnapshot = appInitMachine.getSnapshot();
          const syncActor = appInitSnapshot?.children?.syncMachine;
          console.log('[SyncMachineV2] 🔐 Sync actor check:', {
            hasSyncActor: !!syncActor,
            syncActorState: syncActor?.getSnapshot()?.value
          });
          
          if (syncActor) {
            console.log('[SyncMachineV2] 🔐 Sending DISCONNECT to reset sync machine state');
            syncActor.send({ type: 'DISCONNECT' });
          } else {
            console.warn('[SyncMachineV2] 🔐 Sync actor not found for reset');
          }
        } else {
          console.warn('[SyncMachineV2] 🔐 App init machine not found');
        }
      } else {
        console.warn('[SyncMachineV2] 🔐 Orchestrator actor not found');
      }
    }
  });

  // Clean up subscription on sign-out
  window.addEventListener('auth:signout', () => {
    subscription?.unsubscribe?.();
    authCleanupInitialized = false;
  });

  console.log('[SyncMachineV2] ✅ Auth-aware cleanup initialized');
};

// Function to access global OutgoingChangeService for domain functions
export const getGlobalOutgoingChangeService = (): OutgoingChangeService | null => {
  return globalServices?.outgoingChangeService || null;
};

// Function to access all global services for debugging
export const getGlobalServices = () => {
  return globalServices;
};

export interface SyncMachineContext {
  // Service registry key instead of direct service instances
  serviceRegistryKey: string | null;
  
  // Connection info
  serverUrl: string | null;
  clientId: string | null;
  currentLSN: string;
  serverLSN: string | null;
  
  // Sync progress
  syncPhase: 'initial' | 'catchup' | 'live' | null;
  
  // Error handling
  error: string | null;
  lastError: any;
  reconnectAttempts: number;
  integrityRetryAttempts: number;
  
  // Connection management
  shouldReconnectAfterDisconnect: boolean;
  autoReconnectDisabled: boolean;
  
  // Stats (minimal - services handle their own detailed metrics)
  lastSyncTime: number | null;
  messagesProcessed: number;
  
  // Granular phase tracking
  phaseProgress: {
    initial: {
      completedTables: number;
      totalTables: number;
      currentTable: string | null;
      tablesRemaining: string[];
    };
    catchup: {
      batchesProcessed: number;
      changesProcessed: number;
      estimatedRemaining: number;
    };
    live: {
      messagesProcessed: number;
      lastActivity: number | null;
      throughputPerSec: number;
    };
  };
}

// Helper functions to access services
const getServices = (context: SyncMachineContext) => {
  if (!context.serviceRegistryKey) return null;
  return serviceRegistry.get(context.serviceRegistryKey) || null;
};

const setServices = (context: SyncMachineContext, services: {
  webSocketService: WebSocketService | null;
  incomingChangeService: IncomingChangeService | null;
  outgoingChangeService: OutgoingChangeService | null;
  integrityService: IntegrityService | null;
}) => {
  const key = context.serviceRegistryKey || crypto.randomUUID();
  serviceRegistry.set(key, services);
  return key;
};

export type SyncMachineEvent =
  // Lifecycle
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'RECONNECT' }
  | { type: 'RESET' }
  
  // Phase transition events (internal)
  | { type: 'START_INITIAL_SYNC' }
  | { type: 'START_CATCHUP_SYNC' }
  | { type: 'START_LIVE_SYNC' }
  
  // WebSocket events (from service callbacks)
  | { type: 'WS_CONNECTED'; serverLSN: string }
  | { type: 'WS_DISCONNECTED'; reason: string }
  | { type: 'WS_ERROR'; error: Error }
  | { type: 'WS_MESSAGE'; message: any }
  | { type: 'WS_CONNECTION_RECOVERY'; wasOffline: boolean; durationMs: number }
  
  // Sync phase events (handled by state transitions)
  | { type: 'INITIAL_SYNC_COMPLETE' }
  | { type: 'CATCHUP_SYNC_COMPLETE' }
  
  // Change processing events
  | { type: 'INCOMING_CHANGES'; changes: any[]; messageType: string; sequence?: any }
  | { type: 'INCOMING_CHANGES_PROCESSED'; results: any[] }
  | { type: 'INCOMING_CHANGES_ERROR'; error: Error; changes: any[] }
  | { type: 'OUTGOING_CHANGES_QUEUED'; count: number }
  | { type: 'OUTGOING_CHANGES_SENT'; count: number; messageId: string }
  | { type: 'OUTGOING_CHANGES_ACKNOWLEDGED'; changeIds: string[] }
  
  // LSN events
  | { type: 'LSN_UPDATE'; lsn: string; source: string }
  | { type: 'LSN_SYNC_REQUIRED'; clientLSN: string; serverLSN: string }
  
  // Integrity events
  | { type: 'INTEGRITY_VALIDATE'; reason?: string }
  | { type: 'INTEGRITY_VALIDATION_SUCCESS'; result: any }
  | { type: 'INTEGRITY_VALIDATION_ERROR'; error: Error; reason?: string }
  | { type: 'INTEGRITY_VALIDATION_COMPLETED'; result: any }  // ✅ NEW: Event-driven response from service
  | { type: 'INTEGRITY_VALIDATION_FAILED'; error: Error }   // ✅ NEW: Event-driven error from service
  | { type: 'INTEGRITY_RESET_REQUIRED'; reason: string }
  | { type: 'INTEGRITY_RESET_START'; reason: string; resetType?: 'full_reset' | 'table_reset' }
  | { type: 'INTEGRITY_RESET_COMPLETE'; result: any }
  | { type: 'INTEGRITY_RESET_COMPLETED'; result: any }      // ✅ NEW: Event-driven response from service
  | { type: 'INTEGRITY_RESET_ERROR'; error: Error }
  | { type: 'RESET_INTEGRITY_BASELINE' }
  
  // ✅ MISSING: Server-initiated integrity events
  | { type: 'SERVER_INTEGRITY_RESET_COMMAND'; command: any; reason: string }
  | { type: 'SERVER_INTEGRITY_RESET_COMPLETED'; result: any; command: any }
  
  // ✅ MISSING: Validation progress/lifecycle events  
  | { type: 'INTEGRITY_VALIDATION_STARTED'; reason: string }
  | { type: 'INTEGRITY_RESET_STARTED'; reason: string; resetType: string }
  
  // ✅ NEW: Auto-reconnect control events from IntegrityService
  | { type: 'DISABLE_AUTO_RECONNECT_FOR_RESET'; reason: string }
  | { type: 'ENABLE_AUTO_RECONNECT_AFTER_RESET'; reason: string }
  | { type: 'INTEGRITY_RESET_DISCONNECTION_COMPLETE'; timestamp: number }
  
  // Error events
  | { type: 'SERVICE_ERROR'; service: string; error: Error; context?: string }
  | { type: 'RETRY' }
  | { type: 'MAX_RETRIES_REACHED' }
  
  // XState invoke completion events (required for proper typing)
  | { type: 'done.invoke.initializeServices'; output: { webSocketService: WebSocketService; incomingChangeService: IncomingChangeService; outgoingChangeService: OutgoingChangeService; integrityService: IntegrityService } }
  | { type: 'done.invoke.connectWebSocket'; output: { serverLSN: string } }
  | { type: 'done.invoke.processIncomingChanges'; output: { results: any[]; successCount: number; errorCount: number } }
  | { type: 'done.invoke.detectAndSendChanges'; output: { changesSent: number } }
  | { type: 'error.platform.initializeServices'; error: Error }
  | { type: 'error.platform.connectWebSocket'; error: Error }
  | { type: 'error.platform.processIncomingChanges'; error: Error }
  | { type: 'error.platform.detectAndSendChanges'; error: Error }
  // XState v5 actor completion events
  | { type: 'xstate.done.actor.initializeServices'; output: { webSocketService: WebSocketService; incomingChangeService: IncomingChangeService; outgoingChangeService: OutgoingChangeService; integrityService: IntegrityService } }
  | { type: 'xstate.done.actor.connectWebSocket'; output: { serverLSN: string } }
  | { type: 'xstate.done.actor.processIncomingChanges'; output: { results: any[]; successCount: number; errorCount: number } }
  | { type: 'xstate.done.actor.detectAndSendChanges'; output: { changesSent: number } }
  | { type: 'xstate.error.actor.initializeServices'; error: Error }
  | { type: 'xstate.error.actor.connectWebSocket'; error: Error }
  | { type: 'xstate.error.actor.processIncomingChanges'; error: Error }
  | { type: 'xstate.error.actor.detectAndSendChanges'; error: Error };

export const syncMachineV2 = setup({
  types: {
    context: {} as SyncMachineContext,
    events: {} as SyncMachineEvent,
  },
  
  actors: {
    initializeServices: fromPromise(async ({ input }: {
      input: { serverUrl: string; clientId: string; currentLSN: string } 
    }): Promise<{
      webSocketService: WebSocketService;
      incomingChangeService: IncomingChangeService;
      outgoingChangeService: OutgoingChangeService;
      integrityService: IntegrityService;
    }> => {
      console.log('[SyncMachineV2] 🔧 Initializing services...');
      
      // Check if we can reuse existing global services
      if (globalServices && 
          globalServices.webSocketService && 
          globalServices.incomingChangeService && 
          globalServices.outgoingChangeService &&
          globalServices.integrityService) {
        console.log('[SyncMachineV2] ♻️ Reusing existing global services');
        
        // Update WebSocket service configuration if needed
        globalServices.webSocketService.updateConnectionParams(input.clientId, input.currentLSN);
        
        return {
          webSocketService: globalServices.webSocketService,
          incomingChangeService: globalServices.incomingChangeService,
          outgoingChangeService: globalServices.outgoingChangeService,
          integrityService: globalServices.integrityService
        };
      }
      
      console.log('[SyncMachineV2] 🆕 Creating new services...');
      
      // Get dataSource (should be ready since orchestrator only invokes us after database init)
      const { getNewPGliteDataSource } = await import('../../db/newtypeorm/NewDataSource');
      const dataSource = await getNewPGliteDataSource();
      if (!dataSource || !dataSource.isInitialized) {
        throw new Error('DataSource not available - orchestrator should only invoke sync after database is ready');
      }
      
      // Create service configurations
      const wsConfig: WebSocketServiceConfig = {
        serverUrl: input.serverUrl,
        clientId: input.clientId,
        lsn: input.currentLSN,
        enableHeartbeat: true,
        heartbeatInterval: 30000,
        reconnectDelay: 1000,
        maxReconnectAttempts: 5
      };
      
      const incomingConfig: IncomingChangeServiceConfig = {
        clientId: input.clientId,
        enableOptimisticUpdates: true,
        batchSize: 50,
        conflictResolution: 'timestamp' as const
      };
      
      const outgoingConfig: OutgoingChangeServiceConfig = {
        clientId: input.clientId,
        enableBatching: true,
        batchSize: 50,
        batchTimeoutMs: 1000
      };
      
      const webSocketService = new WebSocketService(wsConfig);
      const incomingChangeService = new IncomingChangeService(incomingConfig, dataSource);
      const outgoingChangeService = new OutgoingChangeService(outgoingConfig, dataSource);
      
      // Create integrity service configuration
      const integrityConfig: IntegrityServiceConfig = {
        clientId: input.clientId,
        enableServerValidation: true, // Re-enabled with adapter
        validationTimeoutMs: 30000,
        autoResetOnFailure: false
      };
      
      const integrityService = new IntegrityService(integrityConfig, dataSource);
      
      // Store as global services for reuse
      globalServices = {
        webSocketService,
        incomingChangeService,
        outgoingChangeService,
        integrityService
      };
      
      // Initialize auth-aware cleanup for the first time services are created
      initializeAuthAwareSyncCleanup();
      
      console.log('[SyncMachineV2] Services initialized successfully');
      
      return {
        webSocketService,
        incomingChangeService,
        outgoingChangeService,
        integrityService
      };
    }),
    
    connectWebSocket: fromPromise(async ({ input }: {
      input: { context: SyncMachineContext; serverUrl: string }
    }): Promise<{ serverLSN: string }> => {
      console.log('[SyncMachineV2] Connecting to WebSocket...');
      
      const services = getServices(input.context);
      if (!services?.webSocketService) {
        throw new Error('WebSocketService not available');
      }
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        services.webSocketService!.setCallbacks({
          onStatusChange: (status: any) => {
            console.log('[SyncMachineV2] WebSocket status:', status);
            if (status === 'connected') {
              clearTimeout(timeoutId);
              resolve({ serverLSN: '0/0' }); // Placeholder
            } else if (status === 'error') {
              clearTimeout(timeoutId);
              reject(new Error('WebSocket connection failed'));
            }
          },
          onError: (error: any) => {
            clearTimeout(timeoutId);
            reject(error);
          }
        });
        
        services.webSocketService!.connect(input.serverUrl);
      });
    }),
    

    
    detectAndSendChanges: fromPromise(async ({ input }: {
      input: { 
        outgoingChangeService: OutgoingChangeService;
        webSocketService: WebSocketService;
      }
    }): Promise<{ changesSent: number }> => {
      console.log('[SyncMachineV2] Detecting and sending outgoing changes...');
      
      // Message sender is already set up in setupServiceCallbacks
      const changesQueued = await input.outgoingChangeService.detectAndQueueChanges();
      
      if (changesQueued > 0) {
        await input.outgoingChangeService.sendQueuedChanges();
      }
      
      console.log(`[SyncMachineV2] Sent ${changesQueued} changes`);
      
      return { changesSent: changesQueued };
    }),

    // Removed complex invoke actors - using simple event-driven communication instead
  },
  
  guards: {
    hasReconnectAttempts: ({ context }) => context.reconnectAttempts < 5,
    hasIntegrityRetryAttempts: ({ context }) => context.integrityRetryAttempts < 3,
    isValidLSN: ({ event }) => {
      if (event.type !== 'LSN_UPDATE') return false;
      return LSNService.isValid(event.lsn);
    },
    servicesReady: ({ context }) => {
      const services = getServices(context);
      return !!(services?.webSocketService && services?.incomingChangeService && services?.outgoingChangeService);
    },
    canAutoReconnect: ({ context }) => {
      const canReconnect = !context.autoReconnectDisabled && context.reconnectAttempts < 5;
      if (!canReconnect && context.autoReconnectDisabled) {
        console.log('[SyncMachineV2] 🚫 Auto-reconnect disabled - not attempting reconnection');
      }
      return canReconnect;
    }
  },
  
  actions: {
    initializeContext: assign(({ event, context }) => {
      if (event.type === 'CONNECT') {
        const serverUrl = getSyncWebSocketUrl();
        
        console.log('[SyncMachineV2] CONNECT event received - sync machine handles everything:', {
          clientId: context.clientId,
          currentLSN: context.currentLSN,
          serverUrl
        });
        
        return {
          serverUrl,
          serviceRegistryKey: null, // Will be set when services are initialized
          syncPhase: null,
          error: null,
          reconnectAttempts: 0
        };
      }
      return {};
    }),
    
    storeServices: assign(({ event }) => {
      if (event.type === 'xstate.done.actor.initializeServices' || event.type === 'done.invoke.initializeServices') {
        const services = event.output;
        const key = crypto.randomUUID();
        serviceRegistry.set(key, {
          webSocketService: services.webSocketService,
          incomingChangeService: services.incomingChangeService,
          outgoingChangeService: services.outgoingChangeService,
          integrityService: services.integrityService
        });
        return { serviceRegistryKey: key };
      }
      return {};
    }),
    
    setupServiceCallbacks: ({ context, self }) => {
      const services = getServices(context);
      if (!services?.webSocketService || !services?.incomingChangeService || !services?.outgoingChangeService || !services?.integrityService) {
        console.error('[SyncMachineV2] Cannot setup callbacks - services not initialized');
        return;
      }
      
      console.log('[SyncMachineV2] Setting up service callbacks for actor:', self.id);
      
      // 🔥 CRITICAL FIX: Clear any existing callbacks to prevent stale actor references
      console.log('[SyncMachineV2] 🧹 Clearing any existing service callbacks...');
      services.webSocketService.setCallbacks({});
      services.incomingChangeService.setCallbacks({});
      services.outgoingChangeService.setCallbacks({});
      services.integrityService.setCallbacks({});
      
      // 🔥 FIX: Add actor state checking to prevent sending to stopped actors
      const safeActorSend = (event: any) => {
        try {
          // More robust check - just try to send and catch if failed
          if (!self || typeof self.send !== 'function') {
            console.log(`[SyncMachineV2] 🚫 safeActorSend failed: self=${!!self}, send=${typeof self?.send}`);
            return false;
          }
          
          // Check if actor is stopped before sending
          try {
            const snapshot = self.getSnapshot();
            if (snapshot?.status === 'stopped') {
              // Only log stopped actor warnings for non-heartbeat messages to reduce noise
              if (event.type !== 'WS_MESSAGE' || event.message?.type !== 'srv_heartbeat') {
                console.log(`[SyncMachineV2] 🚫 safeActorSend failed: actor stopped (status: ${snapshot.status})`);
              }
              return false;
            }
            // Actor status check passed - only log for non-heartbeat events
          } catch (snapshotError) {
            console.log(`[SyncMachineV2] 🚫 safeActorSend failed: snapshot error:`, snapshotError);
            return false;
          }
          
          self.send(event);
          
          // Clean, informative logging for heartbeats
          if (event.type === 'WS_MESSAGE' && event.message?.type === 'srv_heartbeat') {
            const hasLSN = !!event.message?.serverLSN;
            const lsnInfo = hasLSN ? ` (LSN: ${event.message.serverLSN})` : '';
            console.log(`[SyncMachineV2] 💓 Heartbeat processed${lsnInfo}`);
          } else {
            console.log(`[SyncMachineV2] ✅ Successfully sent ${event.type}`);
          }
          return true;
        } catch (error: any) {
          // Handle various stopped actor error patterns
          const errorMessage = error?.message || '';
          const isStoppedError = errorMessage.includes('stopped') || 
                                errorMessage.includes('final state') ||
                                errorMessage.includes('reached its final state') ||
                                errorMessage.includes('already reached its final state') ||
                                error?.name === 'Error';
          
          if (isStoppedError) {
            // Only log stopped actor errors for non-heartbeat messages to reduce noise
            if (event.type !== 'WS_MESSAGE' || event.message?.type !== 'srv_heartbeat') {
              console.log(`[SyncMachineV2] 🚫 safeActorSend failed: stopped actor error:`, errorMessage);
            }
            return false;
          } else {
            console.warn(`[SyncMachineV2] Failed to send ${event.type}:`, error);
            return false;
          }
        }
      };
      
      // WebSocket service callbacks
      services.webSocketService.setCallbacks({
        onMessage: (message: any) => {
          // Silent heartbeat processing - no logging for routine heartbeats
          if (message.type === 'srv_heartbeat') {
            const sendResult = safeActorSend({ type: 'WS_MESSAGE', message });
            // Skip verbose logging for heartbeats
          } else {
            console.log('[SyncMachineV2] WebSocket message received:', message.type);
            const sendResult = safeActorSend({ type: 'WS_MESSAGE', message });
            console.log('[SyncMachineV2] 🎯 safeActorSend result:', sendResult);
          }
        },
        onStatusChange: (status: any) => {
          console.log('[SyncMachineV2] WebSocket status change:', status);
          if (status === 'connected') {
            safeActorSend({ type: 'WS_CONNECTED', serverLSN: '0/0' });
          } else if (status === 'disconnected') {
            safeActorSend({ type: 'WS_DISCONNECTED', reason: 'connection_lost' });
          }
        },
        onError: (error: any) => {
          console.error('[SyncMachineV2] WebSocket error:', error);
          safeActorSend({ type: 'WS_ERROR', error });
        },
        onConnectionRecovery: (wasOffline: boolean, durationMs?: number) => {
          console.log('[SyncMachineV2] WebSocket connection recovered');
          safeActorSend({ type: 'WS_CONNECTION_RECOVERY', wasOffline, durationMs: durationMs || 0 });
        }
      });
      
      // Incoming change service callbacks
      services.incomingChangeService.setCallbacks({
        onChangesProcessed: (changes: any, results: any) => {
          const successCount = results.filter((r: any) => r.success).length;
          const errorCount = results.filter((r: any) => !r.success).length;
          console.log(`[SyncMachineV2] Changes processed: ${successCount} success, ${errorCount} errors`);
          safeActorSend({ type: 'INCOMING_CHANGES_PROCESSED', results });
        },
        onError: (error: any, context: any) => {
          console.error('[SyncMachineV2] Incoming change service error:', error);
          safeActorSend({ type: 'INCOMING_CHANGES_ERROR', error, changes: [] });
        }
      });
      
      // Outgoing change service callbacks
      services.outgoingChangeService.setCallbacks({
        onChangesQueued: (changes: any, count: number) => {
          console.log(`[SyncMachineV2] Outgoing changes queued: ${count}`);
          safeActorSend({ type: 'OUTGOING_CHANGES_QUEUED', count });
        },
        onChangesSent: (changes: any, messageId: string) => {
          console.log(`[SyncMachineV2] Outgoing changes sent: ${changes.length}, messageId: ${messageId}`);
          safeActorSend({ type: 'OUTGOING_CHANGES_SENT', count: changes.length, messageId });
        },
        onChangesAcknowledged: (changeIds: string[], serverResponse: any) => {
          console.log(`[SyncMachineV2] Outgoing changes acknowledged: ${changeIds.length}`);
          safeActorSend({ type: 'OUTGOING_CHANGES_ACKNOWLEDGED', changeIds });
        },
        onError: (error: any, context: any) => {
          console.error('[SyncMachineV2] Outgoing change service error:', error);
          safeActorSend({ type: 'SERVICE_ERROR', service: 'outgoing', error, context });
        }
      });

      // Integrity service callbacks
      services.integrityService.setCallbacks({
        onValidationStarted: (reason: string) => {
          console.log(`[SyncMachineV2] Integrity validation started: ${reason}`);
        },
        onValidationCompleted: (result: any) => {
          console.log(`[SyncMachineV2] Integrity validation completed:`, result);
          safeActorSend({ type: 'INTEGRITY_VALIDATION_SUCCESS', result });
        },
        onValidationError: (error: Error, context?: string) => {
          console.error('[SyncMachineV2] Integrity validation error:', error);
          safeActorSend({ type: 'INTEGRITY_VALIDATION_ERROR', error, reason: context });
        },
        onResetStarted: (reason: string, resetType: any) => {
          console.log(`[SyncMachineV2] Integrity reset started: ${reason} (${resetType})`);
        },
        onResetCompleted: (result: any) => {
          console.log(`[SyncMachineV2] Integrity reset completed:`, result);
          safeActorSend({ type: 'INTEGRITY_RESET_COMPLETE', result });
        },
        onResetError: (error: Error, context?: string) => {
          console.error('[SyncMachineV2] Integrity reset error:', error);
          safeActorSend({ type: 'INTEGRITY_RESET_ERROR', error });
        }
      });

      // Set up outgoing change service with WebSocket connection for immediate sending
      if (services.webSocketService && services.outgoingChangeService) {
        console.log('[SyncMachineV2] Setting up outgoing change service with WebSocket sender');
        services.outgoingChangeService.setMessageSender({
          send: (message: any) => services.webSocketService!.send(message)
        });
      }

      // ✅ SIMPLE: Set up integrity service with machine reference for event-driven communication
      if (services.integrityService) {
        console.log('[SyncMachineV2] Setting up integrity service with machine reference');
        services.integrityService.setMachineRef(self);
        
        // Still set up WebSocket for server validation
        if (services.webSocketService) {
          const wsAdapter = {
            send: (message: any) => services.webSocketService!.send(message),
            isConnected: () => services.webSocketService!.isConnected(),
            getStatus: () => services.webSocketService!.getStatus(),
            on: () => {}, // Not used by IntegrityService
            off: () => {}, // Not used by IntegrityService
            setConnectionParams: () => {}, // Not used by IntegrityService
            setAutoReconnect: () => {}, // Not used by IntegrityService
            isOnline: () => navigator.onLine,
            getClientId: () => context.clientId || ''
          };
          
          services.integrityService.setMessageSender(wsAdapter as any);
        }
      }
    },
    
    updateLSN: assign(({ event, context }) => {
      const updates: Partial<SyncMachineContext> = {};
      if (event.type === 'LSN_UPDATE') {
        updates.currentLSN = event.lsn;
        
        // ✅ CRITICAL FIX: Update WebSocketService with new LSN for heartbeats
        const services = getServices(context);
        if (services?.webSocketService && context.clientId) {
          console.log(`[SyncMachineV2] Updating WebSocketService LSN for heartbeats: ${context.currentLSN} → ${event.lsn}`);
          services.webSocketService.updateConnectionParams(context.clientId, event.lsn);
        }
      }
      if (event.type === 'WS_CONNECTED') {
        updates.serverLSN = event.serverLSN;
      }
      if (event.type === 'LSN_UPDATE' && event.source === 'server') {
        updates.serverLSN = event.lsn;
      }
      return updates;
    }),
    
    saveSyncState: ({ context }) => {
      // Sync machine saves its own state
      const SYNC_STATE_KEY = 'sync-machine-state';
      try {
        const stateToSave = {
          clientId: context.clientId,
          currentLSN: context.currentLSN
        };
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(stateToSave));
        console.log('[SyncMachineV2] Saved own state:', stateToSave);
      } catch (error) {
        console.warn('[SyncMachineV2] Failed to save state:', error);
      }
    },
    
    incrementReconnectAttempts: assign({
      reconnectAttempts: ({ context }) => context.reconnectAttempts + 1
    }),
    
    resetReconnectAttempts: assign({
      reconnectAttempts: 0
    }),
    
    // Handle WebSocket messages by sending appropriate events instead of calling services directly
    handleWebSocketMessage: ({ context, event, self }) => {
      // Only log non-heartbeat messages to reduce noise
      if (event.type === 'WS_MESSAGE' && event.message?.type !== 'srv_heartbeat') {
        console.log(`[SyncMachineV2] 🔍 handleWebSocketMessage called with event:`, event.type);
      }
      
      if (event.type !== 'WS_MESSAGE') {
        console.log(`[SyncMachineV2] ⚠️ Not a WS_MESSAGE event:`, event.type);
        return;
      }
      
      if (!event.message) {
        console.log(`[SyncMachineV2] ⚠️ WS_MESSAGE event missing message property`);
        return;
      }
      
      const services = getServices(context);
      if (!services) {
        console.log(`[SyncMachineV2] ❌ No services available`);
        return;
      }
      
      const message = event.message;
      const messageType = message.type || 'unknown';
      
      // Only log non-heartbeat message types to reduce noise
      if (messageType !== 'srv_heartbeat') {
        console.log(`[SyncMachineV2] 📨 Handling message type: ${messageType}`);
      }
      
      // 🔍 DEBUG: Check if this message should be routed to SyncMessageHandler
      if (messageType === 'srv_integrity_validation_response') {
        console.log(`[SyncMachineV2] 🔍 DEBUG: Received integrity validation response, checking routing...`);
        console.log(`[SyncMachineV2] Message details:`, message);
      }
      
      // Send events for change processing instead of calling services directly
      if (messageType === 'srv_init_changes' || 
          messageType === 'srv_catchup_changes' || 
          messageType === 'srv_live_changes') {
        
        const changes = message.changes || [];
        if (changes.length > 0) {
          console.log(`[SyncMachineV2] Sending INCOMING_CHANGES event for ${changes.length} changes`);
          self.send({ 
            type: 'INCOMING_CHANGES', 
            changes, 
            messageType,
            sequence: message.sequence 
          });
        }
      }
      
      // ✅ SIMPLE: Handle integrity validation responses - route to IntegrityService
      if (messageType === 'srv_integrity_validation_response') {
        console.log(`[SyncMachineV2] 🔍 Processing integrity validation response`);
        
        if (services?.integrityService) {
          console.log(`[SyncMachineV2] ✅ Routing integrity validation response to IntegrityService`);
          try {
            // Simple delegation to service - service will send events back to machine
            services.integrityService.handleValidationResponse(message);
          } catch (error) {
            console.error('[SyncMachineV2] ❌ Error routing integrity validation response:', error);
          }
        } else {
          console.error('[SyncMachineV2] ❌ IntegrityService not available for routing validation response');
        }
      }
      
      // ✅ MISSING: Handle server-initiated integrity reset commands
      if (messageType === 'srv_integrity_reset') {
        console.log(`[SyncMachineV2] 🚨 Received server-initiated integrity reset command`);
        
        // Route to IntegrityService for handling AND send event to machine
        if (services?.integrityService) {
          console.log(`[SyncMachineV2] ✅ Routing server reset command to IntegrityService`);
          try {
            services.integrityService.handleServerResetCommand(message);
          } catch (error) {
            console.error('[SyncMachineV2] ❌ Error routing server reset command:', error);
          }
        }
        
        self.send({ 
          type: 'SERVER_INTEGRITY_RESET_COMMAND', 
          command: message.resetCommand || message,
          reason: message.reason || 'Server-initiated reset'
        });
      }
      
      // Handle server responses for outgoing changes using specific message handlers
      // Only log non-heartbeat messages to reduce noise
      if (messageType !== 'srv_heartbeat') {
        console.log(`[SyncMachineV2] 🔍 Checking outgoing handlers for messageType: ${messageType}`);
        console.log(`[SyncMachineV2] 🔍 OutgoingChangeService available:`, !!services.outgoingChangeService);
      }
      
      if (services.outgoingChangeService) {
        if (messageType === 'srv_changes_received') {
          console.log(`[SyncMachineV2] 📥 Server acknowledged receipt of changes - calling handler`);
          try {
            services.outgoingChangeService.handleChangesReceived(message);
          } catch (error: any) {
            console.error('[SyncMachineV2] Error processing changes received message:', error);
            self.send({ type: 'SERVICE_ERROR', service: 'outgoing', error, context: 'handle_changes_received' });
          }
        } else if (messageType === 'srv_changes_applied') {
          console.log(`[SyncMachineV2] ✅ Server confirmed changes were applied - calling handler`);
          services.outgoingChangeService.handleChangesApplied(message)
            .catch((error: any) => {
              console.error('[SyncMachineV2] Error processing changes applied message:', error);
              self.send({ type: 'SERVICE_ERROR', service: 'outgoing', error, context: 'handle_changes_applied' });
            });
        } else if (messageType === 'srv_error' && message.context === 'outgoing_changes') {
          console.log(`[SyncMachineV2] ❌ Server reported error for outgoing changes`);
          try {
            services.outgoingChangeService.handleServerError(message);
          } catch (error: any) {
            console.error('[SyncMachineV2] Error processing server error message:', error);
            self.send({ type: 'SERVICE_ERROR', service: 'outgoing', error, context: 'handle_server_error' });
          }
        } else if (messageType !== 'srv_heartbeat' && 
                   messageType !== 'srv_integrity_validation_response' && 
                   messageType !== 'srv_integrity_reset' &&
                   messageType !== 'srv_init_start' &&
                   messageType !== 'srv_init_changes' &&
                   messageType !== 'srv_init_complete' &&
                   messageType !== 'srv_catchup_changes' &&
                   messageType !== 'srv_catchup_completed' &&
                   messageType !== 'srv_live_changes' &&
                   messageType !== 'srv_live_start' &&
                   messageType !== 'srv_lsn_update' &&
                   messageType !== 'srv_sync_completed') {
          // Only log unhandled messages that aren't heartbeats, handled by other services, or incoming sync messages
          console.log(`[SyncMachineV2] 🤷 Unhandled messageType for outgoing service: ${messageType}`);
        }
      } else if (messageType !== 'srv_heartbeat' && 
                 messageType !== 'srv_integrity_validation_response' && 
                 messageType !== 'srv_integrity_reset' &&
                 messageType !== 'srv_init_start' &&
                 messageType !== 'srv_init_changes' &&
                 messageType !== 'srv_init_complete' &&
                 messageType !== 'srv_catchup_changes' &&
                 messageType !== 'srv_catchup_completed' &&
                 messageType !== 'srv_live_changes' &&
                 messageType !== 'srv_live_start' &&
                 messageType !== 'srv_lsn_update' &&
                 messageType !== 'srv_sync_completed') {
        // Only log missing service errors for non-heartbeat messages, messages handled by other services, and incoming sync messages
        console.error(`[SyncMachineV2] ❌ OutgoingChangeService not available for message: ${messageType}`);
      }
      
      // Update LSN from server messages that contain LSN information
      let lsnToUpdate: string | null = null;
      let lsnSource = messageType;
      
      if (messageType === 'srv_init_start' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      } else if (messageType === 'srv_init_complete' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      } else if ((messageType === 'srv_catchup_changes' || messageType === 'srv_live_changes') && message.lastLSN) {
        lsnToUpdate = message.lastLSN;
      } else if (messageType === 'srv_catchup_completed' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      } else if (messageType === 'srv_live_start' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      } else if (messageType === 'srv_lsn_update' && message.lsn) {
        lsnToUpdate = message.lsn;
      } else if (messageType === 'srv_heartbeat' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
        // Only log heartbeats with LSN drift (important for debugging)
        if (message.serverLSN !== context.currentLSN) {
          console.log(`[SyncMachineV2] 💓 Heartbeat LSN drift - Server: ${message.serverLSN}, Client: ${context.currentLSN}`);
        }
      } else if (messageType === 'srv_heartbeat') {
        // Silent heartbeat - no action needed for routine heartbeats
        // FIXED: Removed recursive self.send that was causing infinite loops
      } else if (messageType === 'srv_sync_completed' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      }
      
      if (lsnToUpdate && lsnToUpdate !== context.currentLSN) {
        console.log(`[SyncMachineV2] Updating LSN from ${context.currentLSN} to ${lsnToUpdate} (source: ${lsnSource})`);
        self.send({ type: 'LSN_UPDATE', lsn: lsnToUpdate, source: lsnSource });
      }

      // Send WebSocket acknowledgments
      if (services.webSocketService && context.clientId) {
        let ackMessage: any = null;
        
        if (messageType === 'srv_init_start') {
          ackMessage = {
            type: 'clt_init_received',
            messageId: `init_start_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: context.clientId,
            table: 'start',
            chunk: 0
          };
        } else if (messageType === 'srv_init_changes') {
          const sequence = message.sequence;
          if (sequence) {
            ackMessage = {
              type: 'clt_init_received',
              messageId: `init_ack_${Date.now()}`,
              timestamp: Date.now(),
              clientId: context.clientId,
              table: sequence.table,
              chunk: sequence.chunk,
              lsn: context.currentLSN
            };
          }
        } else if (messageType === 'srv_catchup_changes') {
          const sequence = message.sequence;
          if (sequence) {
            ackMessage = {
              type: 'clt_catchup_received',
              messageId: `catchup_ack_${Date.now()}`,
              timestamp: Date.now(),
              clientId: context.clientId,
              chunk: sequence.chunk,
              lsn: context.currentLSN
            };
          }
        } else if (messageType === 'srv_live_changes') {
          const changes = message.changes || [];
          const changeIds = changes.map((change: any, index: number) => 
            `${change.table}_${change.data?.id || index}_${Date.now()}`
          );
          
          ackMessage = {
            type: 'clt_changes_received',
            messageId: `live_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: context.clientId,
            changeIds,
            lastLSN: context.currentLSN
          };
        } else if (messageType === 'srv_init_complete') {
          console.log('[SyncMachineV2] Initial sync complete message received');
          
          // Send the INITIAL_SYNC_COMPLETE event to trigger state transition
          self.send({ type: 'INITIAL_SYNC_COMPLETE' });
          
          // Send acknowledgment for the completion message
          ackMessage = {
            type: 'clt_init_processed',
            messageId: `init_complete_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: context.clientId,
            serverLSN: message.serverLSN || context.currentLSN
          };
        } else if (messageType === 'srv_live_start' && context.syncPhase === 'initial') {
          console.log('[SyncMachineV2] Live sync start received during initial sync - treating as initial sync complete');
          
          // Send the INITIAL_SYNC_COMPLETE event to trigger state transition
          self.send({ type: 'INITIAL_SYNC_COMPLETE' });
          
          // No acknowledgment needed for srv_live_start - it's a notification
        } else if (messageType === 'srv_catchup_completed') {
          console.log('[SyncMachineV2] Catchup sync completed message received');
          
          // Send the CATCHUP_SYNC_COMPLETE event to trigger state transition
          self.send({ type: 'CATCHUP_SYNC_COMPLETE' });
          
          // Send acknowledgment for the completion message
          ackMessage = {
            type: 'clt_catchup_received',
            messageId: `catchup_complete_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: context.clientId,
            serverLSN: message.serverLSN || context.currentLSN
          };
        }
        
        if (ackMessage) {
          console.log(`[SyncMachineV2] Sending acknowledgment for ${messageType}`);
          services.webSocketService.send(ackMessage);
        }
      }
    },

    // Process incoming changes using the service's internal queuing
    processIncomingChanges: ({ context, event, self }) => {
      if (event.type !== 'INCOMING_CHANGES') return;
      
      const services = getServices(context);
      if (!services?.incomingChangeService) {
        console.error('[SyncMachineV2] IncomingChangeService not available');
        self.send({ type: 'SERVICE_ERROR', service: 'incoming', error: new Error('Service not available'), context: 'process_changes' });
        return;
      }
      
      console.log(`[SyncMachineV2] Processing ${event.changes.length} incoming changes (${event.messageType})`);
      
      // Use the service's processChanges method which now handles queuing internally
      services.incomingChangeService.processChanges(event.changes, event.messageType)
        .then((results: any) => {
          const successCount = results.filter((r: any) => r.success).length;
          const errorCount = results.filter((r: any) => !r.success).length;
          console.log(`[SyncMachineV2] Processing complete: ${successCount} success, ${errorCount} errors`);
          self.send({ type: 'INCOMING_CHANGES_PROCESSED', results });
        })
        .catch((error: any) => {
          console.error('[SyncMachineV2] Error processing changes:', error);
          self.send({ type: 'INCOMING_CHANGES_ERROR', error, changes: event.changes });
        });
    },

    recordError: assign(({ event }) => {
      const updates: Partial<SyncMachineContext> = {};
      if (event.type === 'WS_ERROR') {
        updates.error = event.error.message;
        updates.lastError = event.error;
      }
      if (event.type === 'SERVICE_ERROR') {
        updates.error = `${event.service}: ${event.error.message}`;
        updates.lastError = event.error;
      }
      return updates;
    }),

    // Clear initial sync messages from queue when transitioning to live sync
    clearInitialSyncQueue: ({ context }) => {
      const services = getServices(context);
      if (services?.incomingChangeService) {
        console.log('[SyncMachineV2] Clearing initial sync messages from queue');
        services.incomingChangeService.clearQueueByMessageType('srv_init_changes');
      }
    },

    // Clear catchup sync messages from queue when transitioning to live sync
    clearCatchupSyncQueue: ({ context }) => {
      const services = getServices(context);
      if (services?.incomingChangeService) {
        console.log('[SyncMachineV2] Clearing catchup sync messages from queue');
        services.incomingChangeService.clearQueueByMessageType('srv_catchup_changes');
      }
    },
    
         updateStats: assign(({ context, event }) => {
       const updates: Partial<SyncMachineContext> = {};
       
       if (event.type === 'WS_MESSAGE') {
         const messageType = event.message?.type || 'unknown';
         
         // Skip state updates for routine heartbeats (no meaningful changes)
         if (messageType === 'srv_heartbeat' && !event.message?.serverLSN) {
           // Routine heartbeat with no LSN - no state update needed
           return {};
         }
         
         updates.messagesProcessed = context.messagesProcessed + 1;
         
         // Silent heartbeat processing - only log every 10,000th heartbeat to reduce noise
         if (messageType === 'srv_heartbeat') {
           const heartbeatCount = context.messagesProcessed + 1;
           if (heartbeatCount % 10000 === 0) {
             console.log(`[SyncMachineV2] 💓 Heartbeat milestone: ${heartbeatCount} processed`);
           }
         }
         
         // Update live sync activity
         if (context.syncPhase === 'live') {
           updates.phaseProgress = {
             ...context.phaseProgress,
             live: {
               ...context.phaseProgress.live,
               messagesProcessed: context.messagesProcessed + 1,
               lastActivity: Date.now(),
               throughputPerSec: 0 // Calculate if needed
             }
           };
         }
       }
       
       if (event.type === 'INCOMING_CHANGES_PROCESSED' || event.type === 'LSN_UPDATE') {
         updates.lastSyncTime = Date.now();
       }
       
       // Log outgoing activity
       if (event.type === 'OUTGOING_CHANGES_QUEUED') {
         console.log(`[SyncMachineV2] 📤 Outgoing changes queued: ${event.count || 'unknown'}`);
       }
       if (event.type === 'OUTGOING_CHANGES_SENT') {
         console.log(`[SyncMachineV2] 📤 Outgoing changes sent: ${event.count || 'unknown'}, messageId: ${event.messageId || 'unknown'}`);
       }
       if (event.type === 'OUTGOING_CHANGES_ACKNOWLEDGED') {
         console.log(`[SyncMachineV2] ✅ Outgoing changes acknowledged: ${event.changeIds?.length || 'unknown'} changes`);
       }
       
       return updates;
     }),
    
    cleanupServices: ({ context }) => {
      console.log('[SyncMachineV2] 🧹 Cleaning up service registry entry...');
      
      // Only remove from registry, don't destroy global services
      if (context.serviceRegistryKey) {
        serviceRegistry.delete(context.serviceRegistryKey);
        console.log('[SyncMachineV2] ✅ Removed service registry entry:', context.serviceRegistryKey);
      }
      
      // Note: Global services persist across sync machine recreations
      // They will only be destroyed when the app shuts down or explicitly reset
    },
    
    // 🔥 NEW: Enhanced logging for lifecycle tracking
    logState: ({ context, event }) => {
      console.log(`[SyncMachineV2] 🔄 State transition triggered by: ${event.type}`, {
        currentPhase: context.syncPhase,
        serviceKey: context.serviceRegistryKey ? 'present' : 'none',
        reconnectAttempts: context.reconnectAttempts,
        error: context.error
      });
    },
    
    logActorStart: () => {
      console.log('[SyncMachineV2] 🚀 Actor started - machine is now active');
    },
    
    logActorStop: () => {
      console.log('[SyncMachineV2] 🛑 Actor stopping - machine will be inactive');
    },
    
    // 🔥 NEW: Detailed lifecycle logging for debugging
    logStateEntry: ({ context }) => ({ state }: { state: string }) => {
      console.log(`[SyncMachineV2] ➡️ ENTERING state: ${state}`, {
        phase: context.syncPhase,
        lsn: context.currentLSN,
        servicesActive: context.serviceRegistryKey ? 'yes' : 'no',
        error: context.error || 'none'
      });
    },
    
    logStateExit: ({ context }) => ({ state }: { state: string }) => {
      console.log(`[SyncMachineV2] ⬅️ EXITING state: ${state}`, {
        phase: context.syncPhase,
        lsn: context.currentLSN,
        nextReason: 'transition pending'
      });
    },
    
    // 🔥 NEW: Log when actor receives events
    logEventReceived: ({ event }) => {
      if (event.type !== 'WS_MESSAGE') {
        console.log(`[SyncMachineV2] 📨 Event received: ${event.type}`, {
          timestamp: Date.now(),
          eventData: event.type === 'LSN_UPDATE' ? { lsn: event.lsn } : 'other'
        });
      }
    },
    
    // 🔥 NEW: Log actor lifecycle events
    logActorLifecycle: () => {
      console.log('[SyncMachineV2] 🔍 Actor lifecycle checkpoint:', {
        timestamp: Date.now(),
        status: 'active',
        checkpoint: 'lifecycle_log'
      });
    },
    
    logEvent: log(({ event }) => `[SyncMachineV2] Event: ${event.type}`),
    
    // ✅ SIMPLE: Event-driven integrity actions
    requestIntegrityValidation: ({ context, event }) => {
      const services = getServices(context);
      if (services?.integrityService) {
        const reason = event.type === 'INTEGRITY_VALIDATE' ? (event as any).reason || 'routine_check' : 'unknown';
        console.log(`[SyncMachineV2] 📤 Requesting integrity validation: ${reason}`);
        
        // Simple command to service - service will send events back
        services.integrityService.startValidation({
          reason,
          clientId: context.clientId!,
          currentLSN: context.currentLSN
        });
      } else {
        console.error('[SyncMachineV2] ❌ IntegrityService not available for validation request');
      }
    },
    
    requestIntegrityReset: ({ context, event }) => {
      const services = getServices(context);
      if (services?.integrityService) {
        const reason = event.type === 'INTEGRITY_RESET_START' ? (event as any).reason : 'Integrity issues detected';
        const resetType = event.type === 'INTEGRITY_RESET_START' ? (event as any).resetType || 'full_reset' : 'full_reset';
        console.log(`[SyncMachineV2] 📤 Requesting integrity reset: ${reason} (${resetType})`);
        
        // Simple command to service - service will send events back
        services.integrityService.startReset({
          reason,
          resetType,
          clientId: context.clientId!
        });
      } else {
        console.error('[SyncMachineV2] ❌ IntegrityService not available for reset request');
      }
    },
    
    // ✅ NEW: Auto-reconnect control actions
    disableAutoReconnect: assign(({ event }) => {
      console.log(`[SyncMachineV2] 🚫 Disabling auto-reconnect: ${(event as any).reason}`);
      return { autoReconnectDisabled: true };
    }),
    
    enableAutoReconnect: assign(({ event }) => {
      console.log(`[SyncMachineV2] ✅ Enabling auto-reconnect: ${(event as any).reason}`);
      return { autoReconnectDisabled: false };
    }),
    
    logDisconnectionComplete: ({ event }) => {
      console.log(`[SyncMachineV2] 🔌 Integrity reset disconnection completed at ${new Date((event as any).timestamp).toISOString()}`);
    }
  }
}).createMachine({
  id: 'syncV2',
  initial: 'idle',
  
  // 🔥 NEW: Add entry/exit logging for the entire machine
  entry: ['logActorStart'],
  exit: ['logActorStop'],
  
  // 🔥 NEW: Global event handlers for debugging and auto-reconnect control
  on: {
    '*': {
      actions: [
        'logEventReceived',
        'logActorLifecycle'
      ]
    },
    DISABLE_AUTO_RECONNECT_FOR_RESET: {
      actions: ['disableAutoReconnect']
    },
    ENABLE_AUTO_RECONNECT_AFTER_RESET: {
      actions: ['enableAutoReconnect']
    },
    INTEGRITY_RESET_DISCONNECTION_COMPLETE: {
      actions: ['logDisconnectionComplete']
    },
  },
  
  context: () => {
    // Load own persisted state - sync machine owns its persistence completely
    const SYNC_STATE_KEY = 'sync-machine-state';
    let persistedClientId: string | null = null;
    let persistedLSN = '0/0';
    
    try {
      const stored = localStorage.getItem(SYNC_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        if (parsedState.clientId && parsedState.currentLSN) {
          persistedClientId = parsedState.clientId;
          persistedLSN = parsedState.currentLSN;
          console.log('[SyncMachineV2] Loaded own persisted state:', {
            clientId: persistedClientId,
            currentLSN: persistedLSN
          });
        }
      }
    } catch (error) {
      console.warn('[SyncMachineV2] Failed to load persisted state:', error);
      localStorage.removeItem(SYNC_STATE_KEY);
    }
    
    // Generate client ID if none persisted
    if (!persistedClientId) {
      persistedClientId = crypto.randomUUID();
      console.log('[SyncMachineV2] Generated new client ID:', persistedClientId);
    }
    
    console.log('[SyncMachineV2] Initializing with state:', {
      clientId: persistedClientId,
      currentLSN: persistedLSN
    });
    
    return {
      serviceRegistryKey: null,
      serverUrl: null, // Will be set when CONNECT is called
      clientId: persistedClientId,
      currentLSN: persistedLSN,
      syncPhase: null,
      error: null,
      lastError: null,
      reconnectAttempts: 0,
      integrityRetryAttempts: 0,
      shouldReconnectAfterDisconnect: false,
      autoReconnectDisabled: false,
      lastSyncTime: null,
      messagesProcessed: 0,
      phaseProgress: {
        initial: {
          completedTables: 0,
          totalTables: 0,
          currentTable: null,
          tablesRemaining: []
        },
        catchup: {
          batchesProcessed: 0,
          changesProcessed: 0,
          estimatedRemaining: 0
        },
        live: {
          messagesProcessed: 0,
          lastActivity: null,
          throughputPerSec: 0
        }
      }
    };
  },
  
  states: {
    idle: {
      entry: [
        () => console.log('[SyncMachineV2] 💤 Entered idle state'),
        ({ context }) => console.log('[SyncMachineV2] 🔍 Idle state context:', {
          phase: context.syncPhase,
          lsn: context.currentLSN,
          serviceKey: context.serviceRegistryKey,
          error: context.error
        }),
        'logActorLifecycle'
      ],
      exit: [
        () => console.log('[SyncMachineV2] 🔄 Exiting idle state'),
        'logActorLifecycle'
      ],
      on: {
        CONNECT: {
          target: 'initializing',
          actions: ['initializeContext', 'logState']
        }
      }
    },
    
    initializing: {
      entry: [
        () => console.log('[SyncMachineV2] 🔧 Entered initializing state'),
        'logActorLifecycle'
      ],
      exit: [
        () => console.log('[SyncMachineV2] 🔄 Exiting initializing state'),
        'logActorLifecycle'
      ],
      invoke: {
        id: 'initializeServices',
        src: 'initializeServices',
        input: ({ context, event }) => ({
          serverUrl: context.serverUrl!,
          clientId: context.clientId!,
          currentLSN: context.currentLSN
        }),
        onDone: {
          target: 'services_ready',
          actions: ['storeServices', 'logState']
        },
        onError: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      }
    },
    
    services_ready: {
      entry: ['setupServiceCallbacks', () => console.log('[SyncMachineV2] ⚙️ Entered services_ready state')],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting services_ready state'),
      always: {
        target: 'connecting',
        guard: 'servicesReady'
      },
      after: {
        1000: {
          target: 'error',
          actions: assign({ error: 'Services initialization timeout' })
        }
      }
    },
    
    connecting: {
      entry: () => console.log('[SyncMachineV2] 🌐 Entered connecting state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting connecting state'),
      invoke: {
        id: 'connectWebSocket',
        src: 'connectWebSocket',
        input: ({ context }) => ({
          context,
          serverUrl: context.serverUrl!
        }),
        onDone: {
          target: 'determining_sync_phase',
          actions: ['updateLSN', 'resetReconnectAttempts', 'logState']
        },
        onError: {
          target: 'reconnecting',
          actions: ['recordError', 'incrementReconnectAttempts', 'logState']
        }
      },
      on: {
        DISCONNECT: {
          target: 'disconnecting',
          actions: ['logState']
        }
      }
    },
    
    determining_sync_phase: {
      entry: [
        () => console.log('[SyncMachineV2] 🎯 Entered determining_sync_phase state'),
        ({ context, self }) => {
          console.log('[SyncMachineV2] Determining sync phase...', {
            currentLSN: context.currentLSN,
            serverLSN: context.serverLSN
          });
          
          // Determine phase and send appropriate event
          if (LSNService.compare(context.currentLSN, '0/0') === 0) {
            console.log('[SyncMachineV2] Starting initial sync (LSN is 0/0)');
            self.send({ type: 'START_INITIAL_SYNC' });
          } else if (context.serverLSN && LSNService.compare(context.currentLSN, context.serverLSN) < 0) {
            console.log('[SyncMachineV2] Starting catchup sync (client LSN behind server)');
            self.send({ type: 'START_CATCHUP_SYNC' });
          } else {
            console.log('[SyncMachineV2] Starting live sync (client LSN up to date)');
            self.send({ type: 'START_LIVE_SYNC' });
          }
        }
      ],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting determining_sync_phase state'),
      
      on: {
        START_INITIAL_SYNC: {
          target: 'initial_sync',
          actions: [
            assign({ syncPhase: 'initial' }),
            sendParent({ type: 'SYNC_INITIAL_START' }),
            'logState'
          ]
        },
        START_CATCHUP_SYNC: {
          target: 'catchup_sync',
          actions: [
            assign({ syncPhase: 'catchup' }),
            sendParent({ type: 'SYNC_CATCHUP_START' }),
            'logState'
          ]
        },
        START_LIVE_SYNC: {
          target: 'live_sync',
          actions: [
            assign({ syncPhase: 'live' }),
            'clearInitialSyncQueue',
            sendParent({ type: 'SYNC_LIVE' }),
            'logState'
          ]
        }
      }
    },
    
    initial_sync: {
      entry: () => console.log('[SyncMachineV2] 📥 Entered initial_sync state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting initial_sync state'),
      
      on: {
        WS_MESSAGE: {
          actions: ['handleWebSocketMessage', 'updateStats']
        },
        INCOMING_CHANGES: {
          actions: 'processIncomingChanges'
        },
        INCOMING_CHANGES_PROCESSED: {
          actions: ['updateStats']
        },
        INCOMING_CHANGES_ERROR: {
          actions: 'recordError'
        },
        INITIAL_SYNC_COMPLETE: {
          target: 'live_sync',
          actions: [
            assign({ syncPhase: 'live' }),
            'clearInitialSyncQueue',
            sendParent({ type: 'SYNC_LIVE' }),
            'logState'
          ]
        },
        LSN_UPDATE: {
          actions: ['updateLSN', 'saveSyncState']
        },
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: ['logState']
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      }
    },
    
    catchup_sync: {
      entry: () => console.log('[SyncMachineV2] ⏳ Entered catchup_sync state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting catchup_sync state'),
      
      on: {
        WS_MESSAGE: {
          actions: ['handleWebSocketMessage', 'updateStats']
        },
        INCOMING_CHANGES: {
          actions: 'processIncomingChanges'
        },
        INCOMING_CHANGES_PROCESSED: {
          actions: ['updateStats']
        },
        INCOMING_CHANGES_ERROR: {
          actions: 'recordError'
        },
        CATCHUP_SYNC_COMPLETE: {
          target: 'live_sync',
          actions: [
            assign({ syncPhase: 'live' }),
            'clearCatchupSyncQueue',
            sendParent({ type: 'SYNC_LIVE' }),
            'logState'
          ]
        },
        LSN_UPDATE: {
          actions: ['updateLSN', 'saveSyncState']
        },
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: ['logState']
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      }
    },
    
    live_sync: {
      entry: [
        () => console.log('[SyncMachineV2] 🟢 Entered live_sync state'),
        ({ context }) => {
          // Log operational status when entering live sync
          console.log('[SyncMachineV2] 📊 Live sync operational status:', {
            phase: context.syncPhase,
            lsn: context.currentLSN,
            messagesProcessed: context.messagesProcessed,
            lastSyncTime: context.lastSyncTime ? new Date(context.lastSyncTime).toISOString() : 'none',
            serviceKey: context.serviceRegistryKey ? 'active' : 'none'
          });
        }
      ],
      exit: [
        () => console.log('[SyncMachineV2] 🔄 Exiting live_sync state'),
        ({ context, event }) => {
          console.log('[SyncMachineV2] 🚨 CRITICAL: Live sync state exiting!', {
            triggerEvent: event.type,
            currentPhase: context.syncPhase,
            currentLSN: context.currentLSN,
            error: context.error,
            servicesActive: context.serviceRegistryKey ? 'yes' : 'no',
            timestamp: Date.now()
          });
        },
        'logActorLifecycle'
      ],
      
      // 🔄 ADD: Periodic status reporting every 60 seconds
      after: {
        60000: {
          target: 'live_sync', // Stay in same state
          actions: [
            ({ context }) => {
              const uptime = context.lastSyncTime ? Date.now() - context.lastSyncTime : 0;
              const services = getServices(context);
              console.log('[SyncMachineV2] 📊 Periodic operational status:', {
                state: 'live_sync',
                phase: context.syncPhase,
                lsn: context.currentLSN,
                messagesProcessed: context.messagesProcessed,
                uptimeMinutes: Math.floor(uptime / 60000),
                servicesHealthy: !!(services?.webSocketService && services?.outgoingChangeService),
                reconnectAttempts: context.reconnectAttempts,
                lastError: context.error || 'none'
              });
            }
          ]
        }
      },
      
      on: {
        WS_MESSAGE: {
          actions: [
            ({ event, context }) => {
              // Only log non-heartbeat WS_MESSAGE processing to reduce noise
              const messageType = event.message?.type || 'unknown';
              if (messageType !== 'srv_heartbeat') {
                console.log('[SyncMachineV2] 🔄 Processing WS_MESSAGE in live_sync:', {
                  messageType,
                  currentState: 'live_sync',
                  timestamp: Date.now(),
                  actorStatus: 'processing'
                });
              }
            },
            'handleWebSocketMessage', 
            'updateStats'
          ]
        },
        INCOMING_CHANGES: {
          actions: [
            ({ event }) => console.log('[SyncMachineV2] 📥 Processing INCOMING_CHANGES in live_sync:', event.changes?.length || 0),
            'processIncomingChanges'
          ]
        },
        INCOMING_CHANGES_PROCESSED: {
          actions: [
            ({ event }) => console.log('[SyncMachineV2] ✅ INCOMING_CHANGES_PROCESSED in live_sync'),
            'updateStats'
          ]
        },
        INCOMING_CHANGES_ERROR: {
          actions: [
            ({ event }) => console.log('[SyncMachineV2] ❌ INCOMING_CHANGES_ERROR in live_sync:', event.error),
            'recordError'
          ]
        },
        OUTGOING_CHANGES_QUEUED: {
          actions: [
            ({ event }) => console.log('[SyncMachineV2] 📤 OUTGOING_CHANGES_QUEUED in live_sync:', event.count),
            'updateStats'
          ]
        },
        OUTGOING_CHANGES_SENT: {
          actions: [
            ({ event }) => console.log('[SyncMachineV2] 🚀 OUTGOING_CHANGES_SENT in live_sync:', event.count),
            'updateStats'
          ]
        },
        OUTGOING_CHANGES_ACKNOWLEDGED: {
          actions: [
            ({ event }) => console.log('[SyncMachineV2] ✅ OUTGOING_CHANGES_ACKNOWLEDGED in live_sync:', event.changeIds?.length),
            'updateStats'
          ]
        },
        LSN_UPDATE: {
          actions: [
            ({ event }) => console.log('[SyncMachineV2] 📍 LSN_UPDATE in live_sync:', { from: 'unknown', to: event.lsn }),
            'updateLSN',
            'saveSyncState'
          ]
        },
        // Integrity validation events
        INTEGRITY_VALIDATE: {
          target: 'validating_integrity',
          actions: [
            ({ event }) => console.log('[SyncMachineV2] 🔍 INTEGRITY_VALIDATE - transitioning to validating_integrity:', (event as any).reason),
            'logState'
          ]
        },
        INTEGRITY_RESET_REQUIRED: {
          target: 'resetting_integrity',
          actions: ['logState']
        },
        // ✅ CRITICAL: Handle orchestrator-initiated integrity reset
        INTEGRITY_RESET_START: {
          target: 'resetting_integrity',
          actions: [
            ({ event }) => console.log('[SyncMachineV2] 🚨 INTEGRITY_RESET_START - transitioning to resetting_integrity:', (event as any).reason),
            'logState'
          ]
        },
        
        // ✅ MISSING: Handle server-initiated reset commands
        SERVER_INTEGRITY_RESET_COMMAND: {
          target: 'resetting_integrity',
          actions: [
            ({ event }) => {
              console.warn('[SyncMachineV2] 🚨 Server-initiated integrity reset:', (event as any).command);
              // Store command details for reset execution
            },
            ({ event }) => sendParent({ 
              type: 'SERVER_INTEGRITY_RESET_REQUIRED', 
              command: (event as any).command, 
              reason: (event as any).reason 
            })
          ]
        },

        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: ['logState']
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        },
        
        // Handle disconnect (e.g., user sign-out) to reset machine state
        DISCONNECT: {
          target: 'idle',
          actions: [
            () => console.log('[SyncMachineV2] 🔐 DISCONNECT received in live_sync - resetting to idle'),
            'logState'
          ]
        }
      }
    },

    validating_integrity: {
      entry: [
        () => console.log('[SyncMachineV2] 🔍 Entered validating_integrity state'),
        'requestIntegrityValidation'  // ✅ Simple action call
      ],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting validating_integrity state'),
      
      on: {
        WS_MESSAGE: {
          actions: ['handleWebSocketMessage', 'updateStats']
        },
        
        // ✅ MISSING: Handle validation started event
        INTEGRITY_VALIDATION_STARTED: {
          actions: [
            ({ event }) => console.log('[SyncMachineV2] 🚀 Integrity validation started:', (event as any).reason)
          ]
        },
        
        // ✅ SIMPLE: Event-driven responses from service
        INTEGRITY_VALIDATION_COMPLETED: [
          {
            target: 'resetting_integrity',
            guard: ({ event }) => !event.result.isValid && event.result.recommendedAction === 'reset',
            actions: [
              ({ event }) => {
                console.error('[SyncMachineV2] 🚨 Integrity validation failed - triggering reset:', event.result);
                if (event.result.issues && event.result.issues.length > 0) {
                  console.error('[SyncMachineV2] 🚨 Integrity issues that triggered reset:');
                  event.result.issues.forEach((issue: any, index: number) => {
                    console.error(`[SyncMachineV2] Reset Issue ${index + 1}:`, issue);
                  });
                }
              },
              sendParent({ type: 'INTEGRITY_RESET_REQUIRED', reason: 'Integrity validation failed' })
            ]
          },
          {
            target: 'validating_integrity',
            guard: ({ event }) => !event.result.isValid && event.result.recommendedAction === 'retry',
            actions: [
              ({ event }) => {
                console.warn('[SyncMachineV2] ⚠️ Integrity validation failed - retrying:', event.result);
                if (event.result.issues && event.result.issues.length > 0) {
                  console.warn('[SyncMachineV2] ⚠️ Integrity issues that triggered retry:');
                  event.result.issues.forEach((issue: any, index: number) => {
                    console.warn(`[SyncMachineV2] Retry Issue ${index + 1}:`, issue);
                  });
                }
              },
              'requestIntegrityValidation'  // Retry validation
            ]
          },
          {
            target: 'resetting_integrity',
            guard: ({ event }) => !event.result.isValid && event.result.recommendedAction === 'none',
            actions: [
              ({ event }) => {
                console.error('[SyncMachineV2] 🚨 CRITICAL: Integrity validation failed with no recommended action - forcing reset:', event.result);
                console.error('[SyncMachineV2] 🚨 This indicates a serious integrity issue that requires manual intervention');
                if (event.result.issues && event.result.issues.length > 0) {
                  console.error('[SyncMachineV2] 🚨 Critical integrity issues found:');
                  event.result.issues.forEach((issue: any, index: number) => {
                    console.error(`[SyncMachineV2] Critical Issue ${index + 1}:`, issue);
                  });
                }
              },
              sendParent({ type: 'INTEGRITY_RESET_REQUIRED', reason: 'Critical integrity issues found with no clear resolution path' })
            ]
          },
          {
            target: 'live_sync',
            guard: ({ event }) => event.result.isValid === true,
            actions: [
              ({ event }) => {
                console.log('[SyncMachineV2] ✅ Integrity validation passed:', event.result);
                if (event.result.issues && event.result.issues.length > 0) {
                  console.log('[SyncMachineV2] ℹ️ Non-critical issues found but validation passed:');
                  event.result.issues.forEach((issue: any, index: number) => {
                    console.log(`[SyncMachineV2] Info Issue ${index + 1}:`, issue);
                  });
                }
              },
              sendParent({ type: 'INTEGRITY_VALIDATION_SUCCESS' })
            ]
          },
          {
            // Fallback case for completely unknown validation results - trigger reset for safety
            target: 'resetting_integrity',
            actions: [
              ({ event }) => {
                console.error('[SyncMachineV2] 🚨 UNKNOWN integrity validation result - forcing reset for safety:', event.result);
                console.error('[SyncMachineV2] 🚨 This may indicate a bug in the validation logic');
              },
              sendParent({ type: 'INTEGRITY_RESET_REQUIRED', reason: 'Unknown integrity validation result - safety reset' })
            ]
          }
        ],
        
        INTEGRITY_VALIDATION_FAILED: {
          target: 'live_sync',
          actions: [
            ({ event }) => console.error('[SyncMachineV2] Integrity validation error:', event.error),
            'recordError'
          ]
        },
        
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: ['logState']
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      },
      
      // Add timeout for integrity validation
      after: {
        30000: {
          target: 'live_sync',
          actions: [
            () => console.warn('[SyncMachineV2] ⚠️ Integrity validation timeout - proceeding anyway'),
            sendParent({ type: 'INTEGRITY_VALIDATION_SUCCESS' })
          ]
        }
      },
      
      // ✅ REMOVED: Complex invoke pattern replaced with simple event-driven approach
    },

    resetting_integrity: {
      entry: [
        () => console.log('[SyncMachineV2] 🚨 Entered resetting_integrity state'),
        'requestIntegrityReset'  // ✅ Simple action call
      ],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting resetting_integrity state'),
      
      on: {
        // ✅ MISSING: Handle reset started event
        INTEGRITY_RESET_STARTED: {
          actions: [
            ({ event }) => console.log('[SyncMachineV2] 🚀 Integrity reset started:', (event as any).reason, (event as any).resetType)
          ]
        },
        
        // ✅ FIXED: After integrity reset, database is empty - need full initial sync
        INTEGRITY_RESET_COMPLETED: {
          target: 'initializing', // Database is empty - need to start fresh with services & initial sync
          actions: [
            ({ event }) => console.log('[SyncMachineV2] 🔄 Integrity reset completed! Database cleared, starting fresh with initial sync:', (event as any).result),
            assign({ 
              reconnectAttempts: 0,         // Reset reconnect counter
              currentLSN: '0/0',           // Reset LSN context after DB reset
              serverLSN: null,             // Clear server LSN for fresh sync
              autoReconnectDisabled: false, // Re-enable auto-reconnect after reset completion
              syncPhase: null,             // Clear sync phase - will be set to 'initial' in initial_sync
              // Reset phase progress for fresh start
              phaseProgress: {
                initial: {
                  completedTables: 0,
                  totalTables: 0,
                  currentTable: null,
                  tablesRemaining: []
                },
                catchup: {
                  batchesProcessed: 0,
                  changesProcessed: 0,
                  estimatedRemaining: 0
                },
                live: {
                  messagesProcessed: 0,
                  lastActivity: null,
                  throughputPerSec: 0
                }
              }
            }),
            // ✅ CRITICAL: Send LSN reset to orchestrator so it updates its context
            sendParent({ type: 'LSN_UPDATE', lsn: '0/0' }),
            sendParent({ type: 'INTEGRITY_RESET_COMPLETED' }),
            'saveSyncState' // Save the reset state
          ]
        },
        
        INTEGRITY_RESET_ERROR: {
          target: 'error',
          actions: [
            ({ event }) => console.error('[SyncMachineV2] Integrity reset failed:', (event as any).error),
            'recordError'
          ]
        },
        
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: ['logState']
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      },
      
      // Simple timeout for reset operations
      after: {
        60000: {
          target: 'error',
          actions: [
            () => console.error('[SyncMachineV2] ⚠️ Integrity reset timeout'),
            assign({ error: 'Integrity reset timeout' })
          ]
        }
      }
    },
    
    reconnecting: {
      entry: () => console.log('[SyncMachineV2] 🔄 Entered reconnecting state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting reconnecting state'),
      
      after: {
        2000: [
          {
            target: 'connecting',
            guard: 'canAutoReconnect',
            actions: [
              ({ context }) => console.log(`[SyncMachineV2] 🔄 Auto-reconnecting (attempt ${context.reconnectAttempts + 1}/5)`),
              'logState'
            ]
          },
          {
            target: 'error',
            actions: [
              ({ context }) => {
                const reason = context.autoReconnectDisabled 
                  ? 'Auto-reconnect disabled for integrity reset'
                  : 'Max reconnection attempts reached';
                console.log(`[SyncMachineV2] 🚫 Cannot reconnect: ${reason}`);
                return assign({ error: reason });
              },
              'logState'
            ]
          }
        ]
      },
      
      on: {
        RETRY: {
          target: 'connecting',
          actions: ['logState']
        },
        DISCONNECT: {
          target: 'disconnecting',
          actions: ['logState']
        },
        ENABLE_AUTO_RECONNECT_AFTER_RESET: {
          actions: ['enableAutoReconnect']
        }
      }
    },
    
    disconnecting: {
      entry: [
        () => console.log('[SyncMachineV2] 🔌 Entered disconnecting state'),
        'cleanupServices'
      ],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting disconnecting state'),
      always: [
        {
          target: 'connecting',
          guard: ({ context }) => context.shouldReconnectAfterDisconnect,
          actions: [
            ({ context }) => console.log('[SyncMachineV2] 🔄 Auto-reconnecting after integrity reset with fresh LSN:', context.currentLSN),
            assign({ shouldReconnectAfterDisconnect: false }), // Clear the flag
            'logState'
          ]
        },
        {
          target: 'idle',
          actions: ['logState']
        }
      ]
    },
    
    error: {
      entry: [
        () => console.error('[SyncMachineV2] ❌ Entered error state'),
        'cleanupServices'
      ],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting error state'),
      
      on: {
        RETRY: {
          target: 'connecting',
          actions: ['logState']
        },
        RESET: {
          target: 'idle',
          actions: ['logState']
        },
        CONNECT: {
          target: 'initializing',
          actions: ['initializeContext', 'logState']
        }
      }
    }
  }
});