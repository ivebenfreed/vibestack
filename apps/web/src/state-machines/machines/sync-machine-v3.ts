/**
 * Sync Machine V3 - Clean Minimal Shell
 * 
 * Minimal implementation focusing on core sync functionality without bloat.
 * Built from scratch using lessons learned from V2 but with clean architecture.
 * 
 * Key improvements:
 * - Direct localStorage persistence (no external persister)
 * - Simplified service coordination
 * - Autonomous operation with clean boundaries
 * - Clean event types and state flow
 */

import { setup, assign, fromPromise, sendParent } from 'xstate';
import { WebSocketService } from '../../sync/WebSocketService';
import { IncomingChangeService } from '../../sync/IncomingChangeService';
import { OutgoingChangeService } from '../../sync/OutgoingChangeService';
import { IntegrityService } from '../../sync/IntegrityService';
import { getSyncWebSocketUrl } from '../../sync/config';

// Phase 2: Clean event types and logging
import { SyncMachineEvent } from '../../sync/utils/EventTypes';
import { syncLogger } from '../../sync/utils/SyncLogger';

// Phase 3: Streamlined service management
import { ServiceCoordinator, Services } from '../../sync/utils/ServiceCoordinator';

// Simplified context for V3 - focus on essential state only
export interface SyncMachineV3Context {
  // Core sync state
  clientId: string;
  currentLSN: string;
  serverLSN: string | null;
  syncPhase: 'initial' | 'catchup' | 'live' | 'validating' | null;
  
  // Connection state
  serverUrl: string | null;
  isConnected: boolean;
  
  // Error handling
  error: string | null;
  reconnectAttempts: number;
  
  // Service coordination (Phase 3: Streamlined with ServiceCoordinator)
  servicesInitialized: boolean;
  serviceCoordinator: ServiceCoordinator | null;
  services: Services | null;
  
  // Stats (minimal)
  lastSyncTime: number | null;
  messagesProcessed: number;
}

// Clean event types from Phase 2 - replaces the massive union type
export type SyncMachineV3Event = SyncMachineEvent;

// Global services registry for V3 (simplified)
let globalServicesV3: {
  webSocketService: WebSocketService | null;
  incomingChangeService: IncomingChangeService | null;
  outgoingChangeService: OutgoingChangeService | null;
  integrityService: IntegrityService | null;
} | null = null;

// Clean up function for V3
export const destroyGlobalSyncServicesV3 = () => {
  console.log('[SyncMachineV3] Destroying global services...');
  if (globalServicesV3) {
    globalServicesV3.webSocketService?.destroy();
    globalServicesV3.incomingChangeService?.destroy();
    globalServicesV3.outgoingChangeService?.destroy();
    globalServicesV3 = null;
  }
  console.log('[SyncMachineV3] Global services destroyed');
};

// HMR cleanup for V3
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[SyncMachineV3] 🔥 HMR: Cleaning up global sync services...');
    destroyGlobalSyncServicesV3();
  });
}

export const syncMachineV3 = setup({
  types: {
    context: {} as SyncMachineV3Context,
    events: {} as SyncMachineV3Event, // Clean typed events from Phase 2
  },
  
  actors: {
    // Minimal delay actor for testing the shell
    simulateDelay: fromPromise(async () => {
      console.log('[SyncMachineV3] 🕐 Shell simulation: starting 1.5 second delay...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('[SyncMachineV3] ✅ Shell simulation: delay complete');
      return { success: true };
    }),
    
    // Phase 3: Streamlined service initialization with ServiceCoordinator
    initializeServices: fromPromise(async ({ input }: {
      input: { serverUrl: string; clientId: string; currentLSN: string }
    }): Promise<{ serviceCoordinator: ServiceCoordinator; services: Services }> => {
      syncLogger.info('service', 'Phase 3: Initializing services with ServiceCoordinator...', input);
      
      const serviceCoordinator = new ServiceCoordinator();
      
      const coordinatorConfig = {
        clientId: input.clientId,
        currentLSN: input.currentLSN,
        serverUrl: input.serverUrl,
        enableBatching: true,
        batchSize: 50,
        batchTimeoutMs: 1000,
        heartbeatInterval: 30000,
        reconnectDelay: 1000,
        maxReconnectAttempts: 5,
        enableServerValidation: true,
        validationTimeoutMs: 30000,
        autoResetOnFailure: false
      };
      
      const services = await serviceCoordinator.initialize(coordinatorConfig);
      
      syncLogger.serviceInitialized('ServiceCoordinator', {
        autonomous: true,
        servicesCreated: Object.keys(services)
      });
      
      return { serviceCoordinator, services };
    }),

    // Phase 3: Streamlined WebSocket connection with ServiceCoordinator
    connectWebSocket: fromPromise(async ({ input }: {
      input: { 
        serverUrl: string; 
        serviceCoordinator: ServiceCoordinator;
      }
    }): Promise<{ serverLSN: string }> => {
      syncLogger.connectionAttempt(input.serverUrl);
      
      const services = input.serviceCoordinator.getServices();
      if (!services) {
        throw new Error('Services not available from ServiceCoordinator');
      }
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        // Simple status callbacks for connection establishment
        services.webSocket.setCallbacks({
          onStatusChange: (status: any) => {
            syncLogger.info('connection', `WebSocket status: ${status}`);
            if (status === 'connected') {
              clearTimeout(timeoutId);
              syncLogger.connectionEstablished('0/0');
              resolve({ serverLSN: '0/0' }); // Placeholder - real LSN comes from server
            } else if (status === 'error') {
              clearTimeout(timeoutId);
              reject(new Error('WebSocket connection failed'));
            }
          },
          onError: (error: any) => {
            clearTimeout(timeoutId);
            syncLogger.serviceError('WebSocket', error as Error, 'connection');
            reject(error);
          }
        });
        
        services.webSocket.connect(input.serverUrl);
      });
    }),

    // Enhanced Pre-Live Validation Process - Step 1.4 with ServiceCoordinator
    performPreLiveValidation: fromPromise(async ({ input }: {
      input: { 
        serviceCoordinator: ServiceCoordinator;
        clientId: string;
      }
    }): Promise<{ validationPassed: boolean }> => {
      syncLogger.validationStarted('Enhanced pre-live validation process');
      
      const services = input.serviceCoordinator.getServices();
      if (!services) {
        throw new Error('Services not available from ServiceCoordinator');
      }
      
      try {
        // Step 1: Check and send pending outgoing changes
        syncLogger.info('validation', 'Step 1: Checking for pending outgoing changes...');
        
        const pendingCount = await services.outgoing.getPendingChangesCount();
        if (pendingCount > 0) {
          syncLogger.info('validation', `Found ${pendingCount} pending changes, sending them first...`);
          await services.outgoing.sendQueuedChanges();
          syncLogger.info('validation', 'All pending changes sent successfully');
        } else {
          syncLogger.info('validation', 'No pending outgoing changes found');
        }
        
        // Step 2: Run integrity validation using the new split IntegrityService
        syncLogger.info('validation', 'Step 2: Running integrity validation...');
        
        const integrityResult = await services.integrity.validateIntegrity('pre-live-sync-check');
        
        if (!integrityResult.isValid) {
          syncLogger.error('validation', 'Integrity validation failed', {
            issues: integrityResult.issues,
            recommendedAction: integrityResult.recommendedAction,
            resetReason: integrityResult.resetReason
          });
          
          if (integrityResult.recommendedAction === 'reset') {
            throw new Error(`Integrity validation failed with reset recommendation: ${integrityResult.resetReason}`);
          } else {
            syncLogger.warn('validation', 'Integrity validation failed but allowing continuation');
          }
        } else {
          syncLogger.validationCompleted(true, 0);
        }
        
        syncLogger.info('validation', 'Enhanced pre-live validation completed successfully');
        return { validationPassed: true };
        
      } catch (error) {
        syncLogger.validationError(error as Error, 'pre-live validation');
        throw error;
      }
    }),

    // Establish baseline after initial sync (no validation needed)
    establishBaseline: fromPromise(async ({ input }: {
      input: { 
        serviceCoordinator: ServiceCoordinator;
        clientId: string;
      }
    }): Promise<{ baselineEstablished: boolean }> => {
      syncLogger.info('validation', 'Establishing baseline after initial sync completion');
      
      const services = input.serviceCoordinator.getServices();
      if (!services) {
        throw new Error('Services not available from ServiceCoordinator');
      }
      
      try {
        // Call the new establishBaseline method (to be added to IntegrityValidator)
        await services.integrity.establishBaseline('post-initial-sync');
        
        syncLogger.info('validation', 'Baseline successfully established after initial sync');
        return { baselineEstablished: true };
        
      } catch (error) {
        syncLogger.serviceError('IntegrityService', error as Error, 'baseline establishment');
        throw error;
      }
    })
  },
  
  actions: {
    // Same localStorage pattern as V2 (lines 730-741)
    saveOwnState: ({ context }) => {
      const SYNC_STATE_KEY = 'sync-machine-state';
      try {
        const stateToSave = {
          clientId: context.clientId,
          currentLSN: context.currentLSN
        };
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(stateToSave));
        console.log('[SyncMachineV3] 💾 Shell saved state:', stateToSave);
      } catch (error) {
        console.warn('[SyncMachineV3] Failed to save state:', error);
      }
    },
    
    // Initialize context with loaded state
    initializeContext: assign(({ context }) => {
      console.log('[SyncMachineV3] 🔧 Initializing context...');
      return {
        serverUrl: getSyncWebSocketUrl(),
        isConnected: false,
        servicesInitialized: false,
        lastSyncTime: Date.now()
      };
    }),
    
    // Update LSN and save state
    updateLSN: assign(({ event, context }) => {
      if (event.type === 'LSN_UPDATE') {
        console.log(`[SyncMachineV3] 📊 LSN update: ${context.currentLSN} → ${event.lsn}`);
        return {
          currentLSN: event.lsn
        };
      }
      return {};
    }),
    
    // Record error
    recordError: assign(({ event }) => {
      const error = 'error' in event ? event.error : 'Unknown error';
      console.error('[SyncMachineV3] ❌ Error recorded:', error);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }),
    
    // Clear error
    clearError: assign({
      error: null
    }),
    
    // Increment reconnect attempts
    incrementReconnectAttempts: assign({
      reconnectAttempts: ({ context }) => context.reconnectAttempts + 1
    }),
    
    // Reset reconnect attempts
    resetReconnectAttempts: assign({
      reconnectAttempts: 0
    }),
    
    // Send SYNC_LIVE to parent - key behavior matching V2
    notifyParentLive: sendParent({ type: 'SYNC_LIVE' }),
    
    // Update sync phase
    updateSyncPhase: assign(({ event }) => {
      if (event.type === 'START_INITIAL_SYNC') {
        return { syncPhase: 'initial' as const };
      }
      if (event.type === 'START_CATCHUP_SYNC') {
        return { syncPhase: 'catchup' as const };
      }
      if (event.type === 'START_LIVE_SYNC') {
        return { syncPhase: 'live' as const };
      }
      return {};
    }),
    
    // Phase 3: Streamlined service callback setup with ServiceCoordinator
    setupServiceCallbacks: assign(({ context, self }) => {
      syncLogger.info('service', 'Setting up streamlined service callbacks...');
      
      if (!context.serviceCoordinator) {
        syncLogger.serviceError('ServiceCoordinator', new Error('ServiceCoordinator not available for callback setup'), 'setup');
        return {};
      }
      
      // Simple delegation to ServiceCoordinator - no complex manual setup
      context.serviceCoordinator.setupCallbacks((event: any) => {
        syncLogger.debug('service', `Callback event: ${event.type}`, event);
        self.send(event);
      });
      
      syncLogger.serviceInitialized('ServiceCallbacks', {
        coordinator: true,
        autonomous: true,
        eventHandler: true
      });
      
      return {};
    }),
    
    // Process WebSocket messages and route to appropriate services (V2 pattern)
    processWebSocketMessage: ({ context, event, self }) => {
      if (event.type !== 'WS_MESSAGE') {
        console.log(`[SyncMachineV3] ⚠️ Not a WS_MESSAGE event:`, event.type);
        return;
      }
      
      if (!event.message) {
        console.log(`[SyncMachineV3] ⚠️ WS_MESSAGE event missing message property`);
        return;
      }
      
      const services = context.serviceCoordinator?.getServices();
      if (!services) {
        syncLogger.error('service', 'No services available for message routing from ServiceCoordinator');
        return;
      }
      
      const message = event.message;
      const messageType = message.type || 'unknown';
      
      // Only log non-heartbeat message types to reduce noise
      if (messageType !== 'srv_heartbeat') {
        console.log(`[SyncMachineV3] 📨 Processing message type: ${messageType}`);
        if (messageType === 'srv_integrity_validation_response') {
          console.log(`[SyncMachineV3] 🔍 Integrity validation response received:`, {
            isValid: message.isValid,
            issues: message.issues?.length || 0,
            recommendedAction: message.recommendedAction,
            messageId: message.messageId
          });
        }
      }
      
      // Route incoming change messages to IncomingChangeService
      if (messageType === 'srv_init_changes' || 
          messageType === 'srv_catchup_changes' || 
          messageType === 'srv_live_changes') {
        
        const changes = message.changes || [];
        if (changes.length > 0) {
          console.log(`[SyncMachineV3] 📥 Routing ${changes.length} incoming changes to IncomingChangeService`);
          
          try {
            // Route to service for processing via ServiceCoordinator
            services.incoming.processIncomingChanges(changes, messageType);
          } catch (error) {
            syncLogger.serviceError('IncomingChanges', error as Error, 'message routing');
            self.send({ type: 'SERVICE_ERROR', service: 'incoming', error: error as Error });
          }
        }
      }
      
      // Route integrity validation responses to IntegrityService
      if (messageType === 'srv_integrity_validation_response') {
        console.log(`[SyncMachineV3] 🔍 Routing integrity validation response to IntegrityService`);
        console.log(`[SyncMachineV3] 🔍 Response details:`, {
          isValid: message.isValid,
          issueCount: message.issues?.length || 0,
          recommendedAction: message.recommendedAction,
          hasServerFingerprints: !!message.serverFingerprints
        });
        
        try {
          services.integrity.handleValidationResponse(message).then(result => {
            console.log(`[SyncMachineV3] ✅ Integrity validation response processed:`, {
              isValid: result.isValid,
              issueCount: result.issues.length,
              recommendedAction: result.recommendedAction
            });
          }).catch(error => {
            console.error(`[SyncMachineV3] ❌ Error handling validation response:`, error);
            syncLogger.serviceError('IntegrityService', error as Error, 'validation response routing');
            self.send({ type: 'SERVICE_ERROR', service: 'integrity', error: error as Error });
          });
        } catch (error) {
          console.error(`[SyncMachineV3] ❌ Error handling validation response:`, error);
          syncLogger.serviceError('IntegrityService', error as Error, 'validation response routing');
          self.send({ type: 'SERVICE_ERROR', service: 'integrity', error: error as Error });
        }
      }
      
      // Route server integrity reset commands
      if (messageType === 'srv_integrity_reset') {
        console.log(`[SyncMachineV3] 🚨 Received server-initiated integrity reset command`);
        
        try {
          services.integrity.handleServerResetCommand(message);
        } catch (error) {
          syncLogger.serviceError('IntegrityService', error as Error, 'server reset command routing');
        }
        
        self.send({ 
          type: 'INTEGRITY_RESET_REQUIRED', 
          reason: message.reason || 'Server-initiated reset'
        });
      }
      
      // Route outgoing change acknowledgments to OutgoingChangeService
      if (messageType === 'srv_changes_received') {
        syncLogger.info('message', 'Server acknowledged receipt of changes');
        try {
          services.outgoing.handleChangesReceived(message);
        } catch (error) {
          syncLogger.serviceError('OutgoingChanges', error as Error, 'changes received');
          self.send({ type: 'SERVICE_ERROR', service: 'outgoing', error: error as Error });
        }
      } else if (messageType === 'srv_changes_applied') {
        syncLogger.info('message', 'Server confirmed changes were applied');
        services.outgoing.handleChangesApplied(message)
          .catch((error: any) => {
            syncLogger.serviceError('OutgoingChanges', error, 'changes applied');
            self.send({ type: 'SERVICE_ERROR', service: 'outgoing', error });
          });
      } else if (messageType === 'srv_error' && message.context === 'outgoing_changes') {
        syncLogger.warn('message', 'Server reported error for outgoing changes');
        try {
          services.outgoing.handleServerError(message);
        } catch (error) {
          syncLogger.serviceError('OutgoingChanges', error as Error, 'server error');
          self.send({ type: 'SERVICE_ERROR', service: 'outgoing', error: error as Error });
        }
      }
      
      // Handle sync phase transitions
      if (messageType === 'srv_init_start') {
        console.log('[SyncMachineV3] 🚀 Server started initial sync');
        self.send({ type: 'START_INITIAL_SYNC' });
      } else if (messageType === 'srv_init_complete') {
        console.log('[SyncMachineV3] ✅ Initial sync completed');
        self.send({ type: 'INITIAL_SYNC_COMPLETE' });
      } else if (messageType === 'srv_catchup_completed') {
        console.log('[SyncMachineV3] ✅ Catchup sync completed');
        self.send({ type: 'CATCHUP_SYNC_COMPLETE' });
      }
      
      // Handle LSN updates
      if (messageType === 'srv_lsn_update') {
        const newLSN = message.lsn;
        if (newLSN && newLSN !== context.currentLSN) {
          console.log(`[SyncMachineV3] 📊 LSN update: ${context.currentLSN} → ${newLSN}`);
          self.send({ type: 'LSN_UPDATE', lsn: newLSN, source: 'server' });
        }
      }
    },
    
    // Log state for debugging
    logState: ({ context }) => {
      console.log('[SyncMachineV3] 📊 Current state:', {
        phase: context.syncPhase,
        lsn: context.currentLSN,
        connected: context.isConnected,
        error: context.error
      });
    }
  }
}).createMachine({
  id: 'syncMachineV3',
  initial: 'idle',
  
  // Context initialization using same pattern as V2 (lines 1296-1328)
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
          console.log('[SyncMachineV3] Loaded own persisted state:', {
            clientId: persistedClientId,
            currentLSN: persistedLSN
          });
        }
      }
    } catch (error) {
      console.warn('[SyncMachineV3] Failed to load persisted state:', error);
      localStorage.removeItem(SYNC_STATE_KEY);
    }
    
    // Generate client ID if none persisted
    if (!persistedClientId) {
      persistedClientId = crypto.randomUUID();
      console.log('[SyncMachineV3] Generated new client ID:', persistedClientId);
    }
    
    console.log('[SyncMachineV3] Initializing with state:', {
      clientId: persistedClientId,
      currentLSN: persistedLSN
    });
    
    return {
      clientId: persistedClientId,
      currentLSN: persistedLSN,
      serverLSN: null,
      syncPhase: null,
      serverUrl: null,
      isConnected: false,
      error: null,
      reconnectAttempts: 0,
      servicesInitialized: false,
      serviceCoordinator: null, // Phase 3: ServiceCoordinator pattern
      services: null,
      lastSyncTime: null,
      messagesProcessed: 0
    };
  },
  
  states: {
    idle: {
      entry: [
        () => syncLogger.stateEntry('idle', 'Shell mode - awaiting connection request'),
        'logState'
      ],
      on: {
        CONNECT: {
          target: 'connecting',
          actions: ['initializeContext', 'clearError', 'logState']
        }
      }
    },
    
    connecting: {
      entry: [
        () => syncLogger.stateEntry('connecting', 'Phase 1: Real service initialization and connection'),
        'saveOwnState'
      ],
      
      initial: 'initializing_services',
      
      states: {
        initializing_services: {
          entry: () => console.log('[SyncMachineV3] 🔧 Initializing services...'),
          
          invoke: {
            src: 'initializeServices',
            input: ({ context }) => ({
              serverUrl: context.serverUrl!,
              clientId: context.clientId,
              currentLSN: context.currentLSN
            }),
            onDone: {
              target: 'connecting_websocket',
              actions: [
                assign(({ event }) => {
                  syncLogger.serviceInitialized('Phase 3 ServiceCoordinator', {
                    autonomous: true,
                    servicesCount: Object.keys(event.output.services).length
                  });
                  return {
                    serviceCoordinator: event.output.serviceCoordinator,
                    services: event.output.services,
                    servicesInitialized: true
                  };
                }),
                'setupServiceCallbacks'
              ]
            },
            onError: {
              target: '#syncMachineV3.error',
              actions: 'recordError'
            }
          }
        },
        
        connecting_websocket: {
          entry: () => console.log('[SyncMachineV3] 🔌 Connecting WebSocket...'),
          
          invoke: {
            src: 'connectWebSocket',
            input: ({ context }) => ({
              serverUrl: context.serverUrl!,
              serviceCoordinator: context.serviceCoordinator!
            }),
            onDone: {
              target: '#syncMachineV3.determining_sync_phase',
              actions: [
                assign(({ event }) => ({
                  isConnected: true,
                  serverLSN: event.output.serverLSN,
                  lastSyncTime: Date.now()
                })),
                'saveOwnState',
                () => console.log('[SyncMachineV3] ✅ WebSocket connected - determining sync phase')
              ]
            },
            onError: {
              target: '#syncMachineV3.error',
              actions: 'recordError'
            }
          }
        }
      },
      
      on: {
        DISCONNECT: 'idle',
        RESET: 'idle',
        WS_CONNECTED: {
          // Handle direct WebSocket status events from callbacks
          actions: [
            assign({ isConnected: true }),
            () => console.log('[SyncMachineV3] ✅ WebSocket connected via callback')
          ]
        },
        WS_DISCONNECTED: {
          target: 'error',
          actions: [
            assign({ isConnected: false }),
            'recordError'
          ]
        },
        WS_ERROR: {
          target: 'error',
          actions: 'recordError'
        }
      }
    },
    
    determining_sync_phase: {
      entry: [
        () => syncLogger.stateEntry('determining_sync_phase', 'Waiting for server to determine sync phase')
      ],
      
      on: {
        // Process WebSocket messages to determine sync phase
        WS_MESSAGE: {
          actions: 'processWebSocketMessage'
        },
        
        // Server determines what sync phase is needed
        START_INITIAL_SYNC: {
          target: 'initial_sync',
          actions: [
            assign({ syncPhase: 'initial' as const }),
            () => console.log('[SyncMachineV3] 🚀 Server determined: Initial sync required')
          ]
        },
        
        START_CATCHUP_SYNC: {
          target: 'catchup_sync', 
          actions: [
            assign({ syncPhase: 'catchup' as const }),
            () => console.log('[SyncMachineV3] 🔄 Server determined: Catchup sync required')
          ]
        },
        
        START_LIVE_SYNC: {
          target: 'pre_live_validation',
          actions: [
            assign({ syncPhase: 'validating' as const }),
            () => console.log('[SyncMachineV3] ✅ Server determined: Already current, validating before live')
          ]
        },
        
        // Handle sync completion events that come directly (sync already done)
        INITIAL_SYNC_COMPLETE: {
          target: 'establishing_baseline',
          actions: [
            () => console.log('[SyncMachineV3] ✅ Server says initial sync already completed - establishing baseline')
          ]
        },
        
        CATCHUP_SYNC_COMPLETE: {
          target: 'pre_live_validation',
          actions: [
            assign({ syncPhase: 'validating' as const }),
            () => console.log('[SyncMachineV3] ✅ Server says catchup sync already completed - validating before live')
          ]
        }
      }
    },
    
    initial_sync: {
      entry: [
        () => syncLogger.stateEntry('initial_sync', 'Running initial synchronization')
      ],
      
      on: {
        INITIAL_SYNC_COMPLETE: {
          target: 'establishing_baseline',
          actions: [
            () => console.log('[SyncMachineV3] ✅ Initial sync completed - establishing baseline')
          ]
        },
        
        // Handle sync messages during initial sync
        WS_MESSAGE: {
          actions: 'processWebSocketMessage'
        }
      }
    },
    
    catchup_sync: {
      entry: [
        () => syncLogger.stateEntry('catchup_sync', 'Running catchup synchronization')
      ],
      
      on: {
        CATCHUP_SYNC_COMPLETE: {
          target: 'pre_live_validation',
          actions: [
            assign({ syncPhase: 'validating' as const }),
            () => console.log('[SyncMachineV3] ✅ Catchup sync completed - validating before live')
          ]
        },
        
        // Handle sync messages during catchup sync
        WS_MESSAGE: {
          actions: 'processWebSocketMessage'
        }
      }
    },
    
    establishing_baseline: {
      entry: [
        () => syncLogger.stateEntry('establishing_baseline', 'Establishing integrity baseline after initial sync')
      ],
      
      invoke: {
        src: 'establishBaseline',
        input: ({ context }) => ({
          serviceCoordinator: context.serviceCoordinator!,
          clientId: context.clientId
        }),
        onDone: {
          target: 'live_sync',
          actions: [
            assign({ 
              syncPhase: 'live' as const,
              lastSyncTime: () => Date.now()
            }),
            'notifyParentLive',
            'saveOwnState',
            () => console.log('[SyncMachineV3] ✅ Baseline established - sent SYNC_LIVE to parent')
          ]
        },
        onError: {
          target: 'error',
          actions: 'recordError'
        }
      }
    },
    
    pre_live_validation: {
      entry: [
        () => syncLogger.stateEntry('pre_live_validation', 'Enhanced Step 1.4 validation process')
      ],
      
      invoke: {
        src: 'performPreLiveValidation',
        input: ({ context }) => ({
          serviceCoordinator: context.serviceCoordinator!,
          clientId: context.clientId
        }),
        onDone: {
          target: 'live_sync',
          actions: [
            assign({ 
              syncPhase: 'live' as const,
              lastSyncTime: () => Date.now()
            }),
            'notifyParentLive', // ONLY send SYNC_LIVE after successful validation
            'saveOwnState',
            () => console.log('[SyncMachineV3] ✅ Pre-live validation passed - sent SYNC_LIVE to parent')
          ]
        },
        onError: {
          target: 'error',
          actions: [
            'recordError',
            ({ event }) => {
              console.error('[SyncMachineV3] ❌ Pre-live validation failed:', event.error);
              console.warn('[SyncMachineV3] 🚨 SYNC_LIVE event NOT sent due to validation failure');
            }
          ]
        }
      },
      
      on: {
        // Handle WebSocket messages during validation (needed for integrity responses)
        WS_MESSAGE: {
          actions: 'processWebSocketMessage'
        },
        DISCONNECT: 'idle',
        RESET: 'idle'
      }
    },
    
    live_sync: {
      entry: [
        () => syncLogger.stateEntry('live_sync', 'Enhanced validation complete, system ready for real-time sync')
      ],
      
      on: {
        DISCONNECT: 'idle',
        RESET: 'idle',
        
        // WebSocket events
        WS_MESSAGE: {
          actions: [
            'processWebSocketMessage', // Route message to appropriate services
            assign({
              messagesProcessed: ({ context }) => context.messagesProcessed + 1,
              lastSyncTime: () => Date.now()
            }),
            'saveOwnState'
          ]
        },
        
        WS_DISCONNECTED: {
          target: 'error',
          actions: [
            assign({ 
              isConnected: false,
              error: ({ event }) => `WebSocket disconnected: ${event.reason}`
            }),
            'saveOwnState'
          ]
        },
        
        WS_ERROR: {
          target: 'error',
          actions: 'recordError'
        },
        
        // Service processing events
        INCOMING_CHANGES_PROCESSED: {
          actions: [
            ({ event }) => {
              console.log(`[SyncMachineV3] ✅ Processed ${event.results.length} incoming changes`);
            },
            assign({ lastSyncTime: () => Date.now() }),
            'saveOwnState'
          ]
        },
        
        OUTGOING_CHANGES_SENT: {
          actions: [
            ({ event }) => {
              console.log(`[SyncMachineV3] ✅ Sent ${event.count} outgoing changes`);
            },
            assign({ lastSyncTime: () => Date.now() }),
            'saveOwnState'
          ]
        },
        
        OUTGOING_CHANGES_QUEUED: {
          actions: [
            ({ event }) => {
              console.log(`[SyncMachineV3] 📤 Queued ${event.count} outgoing changes`);
            },
            assign({ lastSyncTime: () => Date.now() }),
            'saveOwnState'
          ]
        },
        
        OUTGOING_CHANGES_ACKNOWLEDGED: {
          actions: [
            ({ event }) => {
              console.log(`[SyncMachineV3] ✅ Server acknowledged ${event.changeIds?.length || 0} outgoing changes`);
            },
            assign({ lastSyncTime: () => Date.now() }),
            'saveOwnState'
          ]
        },
        
        // LSN updates
        LSN_UPDATE: {
          actions: ['updateLSN', 'saveOwnState']
        },
        
        // Integrity events
        INTEGRITY_VALIDATION_COMPLETED: {
          actions: [
            ({ event }) => {
              console.log('[SyncMachineV3] 🔍 Integrity validation result:', event.result.isValid);
              if (!event.result.isValid && event.result.recommendedAction === 'reset') {
                console.warn('[SyncMachineV3] ⚠️ Integrity validation recommends reset');
                // Could trigger reset flow here
              }
            }
          ]
        },
        
        INTEGRITY_RESET_REQUIRED: {
          actions: [
            ({ event }) => {
              console.warn('[SyncMachineV3] 🚨 Integrity reset required:', event.reason);
              // For now just log - full reset flow will be implemented later
            }
          ]
        },
        
        // Service errors
        SERVICE_ERROR: {
          actions: [
            ({ event }) => {
              console.error(`[SyncMachineV3] ❌ Service error in ${event.service}:`, event.error);
            },
            'recordError'
          ]
        }
      }
    },
    
    error: {
      entry: [
        () => console.log('[SyncMachineV3] ❌ Entered error state')
      ],
      
      on: {
        RETRY: 'connecting',
        RESET: {
          target: 'idle',
          actions: ['clearError', 'resetReconnectAttempts']
        },
        CONNECT: {
          target: 'connecting',
          actions: ['clearError']
        }
      }
    }
  }
});