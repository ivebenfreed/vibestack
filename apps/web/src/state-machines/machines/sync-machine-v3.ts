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

import { setup, assign, fromPromise, sendParent, sendTo } from 'xstate';
import { WebSocketService } from '../../sync/WebSocketService';
import { IncomingChangeService } from '../../sync/IncomingChangeService';
import { OutgoingChangeService } from '../../sync/OutgoingChangeService';
import { IntegrityService } from '../../sync/IntegrityService';
import { getSyncWebSocketUrl } from '../../sync/config';
import { integrityMachine } from './integrity-machine';

// Phase 2: Clean event types and logging
import { SyncMachineEvent } from '../../sync/utils/EventTypes';
import { syncLogger } from '../../sync/utils/SyncLogger';

// Phase 4: Optimization - Extracted components
import { MessageProcessor } from '../../sync/utils/MessageProcessor';
import { StateValidators, Guards } from '../../sync/utils/StateValidators';
import { syncActors } from '../../sync/utils/SyncActors';

// Phase 3: Streamlined service management
import { ServiceCoordinator, Services } from '../../sync/utils/ServiceCoordinator';

// Track last saved state to avoid redundant saves
let lastSavedState: { clientId: string; currentLSN: string } | null = null;

// Streamlined context for V3 - essential state only (Phase 3 optimization)
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
  
  // Service coordination - simplified to single coordinator
  serviceCoordinator: ServiceCoordinator | null;
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

// Getter for global services (for domain service integration)
export const getGlobalServicesV3 = () => {
  return globalServicesV3;
};

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

// 🔥 AUTH-AWARE CLEANUP: Automatically destroy sync services when user signs out
let authCleanupInitialized = false;

export const initializeAuthAwareSyncCleanupV3 = () => {
  if (authCleanupInitialized) return;
  authCleanupInitialized = true;

  console.log('[SyncMachineV3] 🔐 Initializing auth-aware sync cleanup...');
  
  const authActor = (window as any).authMachineActor;
  if (!authActor) {
    console.warn('[SyncMachineV3] AuthMachine actor not available for cleanup subscription');
    return;
  }

  // Subscribe to auth state changes
  const subscription = authActor.subscribe((snapshot: any) => {
    const isAuthenticated = snapshot.matches('authenticated');
    const isSigningOut = snapshot.matches('signingOut');
    
    console.log('[SyncMachineV3] 🔐 Auth state change:', { 
      state: snapshot.value, 
      isAuthenticated, 
      isSigningOut,
      hasGlobalServices: !!globalServicesV3 
    });
    
    // If user is signing out or no longer authenticated, destroy sync services
    if ((isSigningOut || !isAuthenticated) && globalServicesV3) {
      console.log('[SyncMachineV3] 🔐 User signed out, destroying sync services');
      destroyGlobalSyncServicesV3();
      
      // Also reset the sync machine state to idle for clean restart
      const appInitActor = (window as any).appInitActor;
      if (appInitActor) {
        const appInitSnapshot = appInitActor.getSnapshot();
        const syncActor = appInitSnapshot?.children?.syncMachine;
        
        if (syncActor) {
          console.log('[SyncMachineV3] 🔐 Sending DISCONNECT to sync machine after auth cleanup');
          syncActor.send({ type: 'DISCONNECT', reason: 'User signed out' });
        }
      }
    }
  });
};

// Helper functions moved to MessageProcessor and StateValidators

export const syncMachineV3 = setup({
  types: {
    context: {} as SyncMachineV3Context,
    events: {} as SyncMachineV3Event, // Clean typed events from Phase 2
  },
  
  actors: {
    // Phase 4: Use extracted actor implementations
    simulateDelay: syncActors.simulateDelay,
    initializeServices: syncActors.initializeServices,
    connectWebSocket: syncActors.connectWebSocket,
    performPreLiveValidation: syncActors.performPreLiveValidation,
    establishBaseline: syncActors.establishBaseline,
    loadPersistedState: syncActors.loadPersistedState,
    saveState: syncActors.saveState,
    cleanupServices: syncActors.cleanupServices,
    
    // Integrity machine for validation and reset operations
    integrityMachine: integrityMachine,
  },
  
  actions: {
    // Same localStorage pattern as V2 (lines 730-741)
    saveOwnState: ({ context }) => {
      try {
        syncLogger.debug('machine', 'saveOwnState: starting save process', {
          clientId: context.clientId,
          currentLSN: context.currentLSN
        });
        
        const SYNC_STATE_KEY = 'sync-machine-state';
        const stateToSave = {
          clientId: context.clientId,
          currentLSN: context.currentLSN
        };
        
        // Only save if state has actually changed
        if (lastSavedState && 
            lastSavedState.clientId === stateToSave.clientId && 
            lastSavedState.currentLSN === stateToSave.currentLSN) {
          syncLogger.debug('machine', 'saveOwnState: no change, skipping save');
          return;
        }
        
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(stateToSave));
        lastSavedState = { ...stateToSave }; // Update cached state
        syncLogger.debug('machine', 'saveOwnState: state saved successfully', stateToSave);
      } catch (error) {
        syncLogger.error('machine', `saveOwnState: error during save: ${error}`);
        syncLogger.serviceError('SyncMachine', error as Error, 'state-save');
        throw error; // Re-throw to see if this is causing the action.exec error
      }
    },
    
    // Initialize context with loaded state
    initializeContext: assign(({ context }) => {
      console.log('[SyncMachineV3] 🔧 Initializing context...');
      return {
        serverUrl: getSyncWebSocketUrl(),
        isConnected: false
      };
    }),
    
    // Update LSN and save state
    updateLSN: assign(({ event, context }) => {
      if (event.type === 'LSN_UPDATE') {
        console.log(`[SyncMachineV3] 📊 LSN update: ${context.currentLSN} → ${event.lsn} (source: ${event.source || 'unknown'})`);
        
        // Critical: Update WebSocketService for heartbeat consistency
        const services = context.serviceCoordinator?.getServices();
        if (services?.webSocket && context.clientId) {
          console.log(`[SyncMachineV3] 🔄 Updating WebSocketService connection params with new LSN: ${event.lsn}`);
          services.webSocket.updateConnectionParams(context.clientId, event.lsn);
        } else {
          console.warn(`[SyncMachineV3] ⚠️ Cannot update WebSocketService - missing service or clientId`);
        }
        
        return {
          currentLSN: event.lsn
        };
      }
      console.log(`[SyncMachineV3] 🔍 updateLSN called with non-LSN_UPDATE event: ${event.type}`);
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
    
    // Send SYNC_LIVE to app init machine - now using global communication
    notifyParentLive: () => {
      console.log('[SyncMachineV3] 📢 Notifying app init machine: SYNC_LIVE');
      const appInitActor = (window as any).appInitActor;
      if (appInitActor) {
        appInitActor.send({ type: 'SYNC_LIVE' });
      } else {
        console.warn('[SyncMachineV3] AppInit actor not available for SYNC_LIVE notification');
      }
    },
    
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

    // Reusable actions to reduce repetition
    
    logProcessedChanges: ({ event }: { event: any }) => {
      try {
        syncLogger.debug('machine', 'logProcessedChanges: starting', {
          eventType: event.type,
          hasResults: 'results' in event,
          hasCount: 'count' in event,
          eventKeys: Object.keys(event)
        });
        
        if ('results' in event) {
          console.log(`[SyncMachineV3] ✅ Processed ${event.results.length} incoming changes`);
        } else if ('count' in event) {
          const count = Array.isArray(event.count) ? event.count.length : event.count;
          console.log(`[SyncMachineV3] ✅ Sent ${count} outgoing changes`);
        }
        
        syncLogger.debug('machine', 'logProcessedChanges: completed successfully', {
          eventType: event.type
        });
      } catch (error) {
        syncLogger.error('machine', `logProcessedChanges: error during execution: ${error}`);
        throw error; // Re-throw to see if this is causing the action.exec error
      }
    },
    
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
    
    // Process WebSocket messages using extracted MessageProcessor
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
      
      // Delegate to MessageProcessor for clean separation
      MessageProcessor.processWebSocketMessage(
        event.message,
        context,
        services,
        (event) => self.send(event)
      );
    },
    
    // Log state for debugging
    logState: ({ context }) => {
      console.log('[SyncMachineV3] 📊 Current state:', {
        phase: context.syncPhase,
        lsn: context.currentLSN,
        connected: context.isConnected,
        error: context.error
      });
    },

    // Process incoming changes using the service's internal queuing (from V2)
    processIncomingChanges: ({ context, event, self }) => {
      if (event.type !== 'INCOMING_CHANGES') return;
      
      const services = context.serviceCoordinator?.getServices();
      if (!services?.incoming) {
        console.error('[SyncMachineV3] IncomingChangeService not available');
        self.send({ type: 'SERVICE_ERROR', service: 'incoming', error: new Error('Service not available'), context: 'process_changes' });
        return;
      }
      
      console.log(`[SyncMachineV3] Processing ${event.changes.length} incoming changes (${event.messageType})`);
      
      // Use the service's processChanges method which handles queuing internally
      services.incoming.processChanges(event.changes, event.messageType)
        .then((results: any) => {
          const successCount = results.filter((r: any) => r.success).length;
          const errorCount = results.filter((r: any) => !r.success).length;
          console.log(`[SyncMachineV3] Processing complete: ${successCount} success, ${errorCount} errors`);
          self.send({ type: 'INCOMING_CHANGES_PROCESSED', results });
          
          // Send acknowledgment after processing like V2
          const ackMessage = MessageProcessor.createAckMessage(event.messageType, { 
            sequence: event.sequence,
            changes: event.changes,
            lastLSN: event.lastLSN // Include the LSN from the original message
          }, context);
          if (ackMessage && services.webSocket) {
            services.webSocket.send(ackMessage);
            console.log(`[SyncMachineV3] 📤 Sent acknowledgment: ${ackMessage.type}`);
          }
        })
        .catch((error: any) => {
          console.error('[SyncMachineV3] Error processing changes:', error);
          self.send({ type: 'INCOMING_CHANGES_ERROR', error, changes: event.changes });
        });
    },
    
    // Delegate integrity validation to child integrity machine
    delegateIntegrityValidation: sendTo('integrityMachine', ({ event }) => ({
      type: 'VALIDATE',
      reason: (event as any).reason || 'sync_requested_validation'
    })),
    
    // Delegate integrity reset to child integrity machine
    delegateIntegrityReset: sendTo('integrityMachine', ({ event }) => ({
      type: 'RESET',
      reason: (event as any).reason || 'sync_requested_reset',
      resetType: (event as any).resetType || 'full_reset'
    }))
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
          // Initialize lastSavedState to prevent redundant save on startup
          lastSavedState = {
            clientId: persistedClientId,
            currentLSN: persistedLSN
          };
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
      serviceCoordinator: null
    };
  },
  
  // Invoke integrity machine as child actor for validation and reset operations
  invoke: {
    id: 'integrityMachine',
    src: 'integrityMachine',
    input: ({ context }) => ({
      serviceCoordinator: context.serviceCoordinator,
      clientId: context.clientId
    })
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
                  
                  // Populate global services registry for domain service access
                  globalServicesV3 = {
                    webSocketService: event.output.services.webSocket,
                    incomingChangeService: event.output.services.incoming,
                    outgoingChangeService: event.output.services.outgoing,
                    integrityService: event.output.services.integrity
                  };
                  
                  // Domain services are deprecated - services are now available globally
                  // No need to reinitialize domains as they use the 3-path architecture
                  
                  return {
                    serviceCoordinator: event.output.serviceCoordinator
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
                  serverLSN: event.output.serverLSN
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
        // Handle WebSocket messages  
        WS_MESSAGE: {
          actions: 'processWebSocketMessage'
        },
        
        // Process incoming changes (from V2)
        INCOMING_CHANGES: {
          actions: 'processIncomingChanges'
        },
        
        INCOMING_CHANGES_PROCESSED: {
          actions: 'logProcessedChanges'
        },
        
        INCOMING_CHANGES_ERROR: {
          actions: 'recordError'
        },
        
        INITIAL_SYNC_COMPLETE: {
          target: 'establishing_baseline',
          actions: [
            () => console.log('[SyncMachineV3] ✅ Initial sync completed - establishing baseline')
          ]
        },
        
        LSN_UPDATE: {
          actions: ['updateLSN', 'saveOwnState']
        },
        
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: [
            assign({ 
              isConnected: false,
              error: ({ event }) => `WebSocket disconnected: ${event.reason}`
            })
          ]
        },
        
        SERVICE_ERROR: {
          target: 'error',
          actions: 'recordError'
        }
      }
    },
    
    catchup_sync: {
      entry: [
        () => syncLogger.stateEntry('catchup_sync', 'Running catchup synchronization')
      ],
      
      on: {
        // Handle WebSocket messages
        WS_MESSAGE: {
          actions: 'processWebSocketMessage'
        },
        
        // Process incoming changes (from V2)
        INCOMING_CHANGES: {
          actions: 'processIncomingChanges'
        },
        
        INCOMING_CHANGES_PROCESSED: {
          actions: 'logProcessedChanges'
        },
        
        INCOMING_CHANGES_ERROR: {
          actions: 'recordError'
        },
        
        CATCHUP_SYNC_COMPLETE: {
          target: 'pre_live_validation',
          actions: [
            assign({ syncPhase: 'validating' as const }),
            () => console.log('[SyncMachineV3] ✅ Catchup sync completed - validating before live')
          ]
        },
        
        LSN_UPDATE: {
          actions: ['updateLSN', 'saveOwnState']
        },
        
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: [
            assign({ 
              isConnected: false,
              error: ({ event }) => `WebSocket disconnected: ${event.reason}`
            })
          ]
        },
        
        SERVICE_ERROR: {
          target: 'error',
          actions: 'recordError'
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
              syncPhase: 'live' as const
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
              syncPhase: 'live' as const
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
      
      // Periodic status reporting
      after: {
        60000: {
          target: 'live_sync',
          actions: [
            ({ context }) => {
              const services = context.serviceCoordinator?.getServices();
              console.log('[SyncMachineV3] 📊 Periodic operational status:', {
                state: 'live_sync',
                phase: context.syncPhase,
                lsn: context.currentLSN,
                servicesHealthy: !!context.serviceCoordinator
              });
            }
          ]
        }
      },
      
      on: {
        DISCONNECT: 'idle',
        RESET: 'idle',
        
        // WebSocket events
        WS_MESSAGE: {
          actions: [
            'processWebSocketMessage', // Route message to appropriate services
            'saveOwnState'
          ]
        },
        
        // Process incoming changes (needed for live sync!)
        INCOMING_CHANGES: {
          actions: 'processIncomingChanges'
        },
        
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: [
            assign({ 
              isConnected: false,
              error: ({ event }) => `WebSocket disconnected: ${event.reason}`
            })
          ]
        },
        
        WS_ERROR: {
          target: 'error',
          actions: 'recordError'
        },
        
        // Service processing events
        INCOMING_CHANGES_PROCESSED: {
          actions: ['logProcessedChanges', 'saveOwnState']
        },
        
        OUTGOING_CHANGES_SENT: {
          actions: [
            'logProcessedChanges',
            'saveOwnState'
          ]
        },
        
        // Service error handling
        SERVICE_ERROR: {
          target: 'error',
          actions: [
            ({ event }) => {
              console.error(`[SyncMachineV3] ❌ Service error in ${event.service}:`, event.error);
            },
            'recordError'
          ]
        },
        
        // Delegate integrity operations to child integrity machine
        INTEGRITY_VALIDATE: {
          actions: 'delegateIntegrityValidation'
        },
        
        INTEGRITY_RESET_REQUIRED: {
          actions: 'delegateIntegrityReset'
        },
        
        OUTGOING_CHANGES_QUEUED: {
          actions: [
            ({ event }) => {
              const count = Array.isArray(event.count) ? event.count.length : event.count;
              console.log(`[SyncMachineV3] 📤 Queued ${count} outgoing changes`);
            },
            'saveOwnState'
          ]
        },
        
        OUTGOING_CHANGES_ACKNOWLEDGED: {
          actions: [
            ({ event }) => {
              const count = Array.isArray(event.changeIds) ? event.changeIds.length : (event.changeIds || 0);
              console.log(`[SyncMachineV3] ✅ Server acknowledged ${count} outgoing changes`);
            },
            'saveOwnState'
          ]
        },
        
        // LSN updates - CRITICAL: Must save state to persist LSN changes
        LSN_UPDATE: {
          actions: ['updateLSN', 'saveOwnState']
        }
      }
    },
    
    reconnecting: {
      entry: [
        ({ context }) => console.log(`[SyncMachineV3] 🔄 Attempting reconnection (attempt ${context.reconnectAttempts})`),
        'incrementReconnectAttempts'
      ],
      
      always: [
        {
          target: 'error',
          guard: Guards.maxReconnectAttemptsReached,
          actions: assign({ error: 'Max reconnection attempts exceeded' })
        }
      ],
      
      after: {
        // Dynamic delay based on attempt count: Math.min(1000 * 2^attempt, 16000)
        1000: { target: 'connecting', guard: ({ context }) => context.reconnectAttempts === 1 },
        2000: { target: 'connecting', guard: ({ context }) => context.reconnectAttempts === 2 },
        4000: { target: 'connecting', guard: ({ context }) => context.reconnectAttempts === 3 },
        8000: { target: 'connecting', guard: ({ context }) => context.reconnectAttempts === 4 },
        16000: { target: 'connecting', guard: ({ context }) => context.reconnectAttempts >= 5 }
      },
      
      on: {
        RESET: {
          target: 'idle',
          actions: ['clearError', 'resetReconnectAttempts']
        },
        DISCONNECT: {
          target: 'idle',
          actions: ['clearError', 'resetReconnectAttempts']
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