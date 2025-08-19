/**
 * Pure LiveStore Sync Machine - Complete Dexie Replacement
 * 
 * Replaces sync-machine-v3.ts with a pure LiveStore implementation.
 * No Dexie dependencies - uses only LiveStore for all database operations.
 */

import { setup, assign, fromPromise, sendParent } from 'xstate'
import { getSyncWebSocketUrl } from '../../sync/config'
import { PureLiveStoreServiceCoordinator, type PureLiveStoreCoordinatorConfig } from '../../sync/utils/PureLiveStoreServiceCoordinator'
import { syncLogger } from '../../sync/utils/SyncLogger'
import type { SyncMachineEvent } from '../../sync/utils/EventTypes'

// Pure LiveStore context (no Dexie references)
export interface PureLiveStoreSyncContext {
  // Core sync state
  clientId: string
  currentLSN: string
  serverLSN: string | null
  syncPhase: 'initial' | 'catchup' | 'live' | 'validating' | null
  
  // Organization context
  organizationId: string | null
  userId: string | null
  
  // Connection state
  serverUrl: string | null
  isConnected: boolean
  
  // Error handling
  error: string | null
  reconnectAttempts: number
  
  // Service coordination - pure LiveStore only
  serviceCoordinator: PureLiveStoreServiceCoordinator | null
}

// Events remain the same as existing sync machine
export type PureLiveStoreSyncEvent = SyncMachineEvent

// Global services registry for pure LiveStore
let globalPureLiveStoreServices: {
  webSocketService: any | null
  liveStoreSync: any | null
  liveStore: any | null
} | null = null

// Getter for global services
export const getGlobalPureLiveStoreServices = () => {
  return globalPureLiveStoreServices
}

// Clean up function
export const destroyGlobalPureLiveStoreServices = () => {
  console.log('[PureLiveStoreSyncMachine] Destroying global services...')
  if (globalPureLiveStoreServices) {
    globalPureLiveStoreServices.webSocketService?.destroy()
    globalPureLiveStoreServices.liveStoreSync?.destroy()
    globalPureLiveStoreServices = null
  }
  console.log('[PureLiveStoreSyncMachine] Global services destroyed')
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[PureLiveStoreSyncMachine] 🔥 HMR: Cleaning up global sync services...')
    destroyGlobalPureLiveStoreServices()
  })
}

// Auth-aware cleanup
let authCleanupInitialized = false

export const initializeAuthAwarePureLiveStoreSyncCleanup = () => {
  if (authCleanupInitialized) return

  if (typeof window !== 'undefined') {
    // Listen for auth sign-out events
    window.addEventListener('auth:signout', () => {
      console.log('[PureLiveStoreSyncMachine] 🔐 Auth signout detected - destroying sync services')
      destroyGlobalPureLiveStoreServices()
    })

    // Listen for beforeunload to clean up
    window.addEventListener('beforeunload', () => {
      destroyGlobalPureLiveStoreServices()
    })

    authCleanupInitialized = true
    console.log('[PureLiveStoreSyncMachine] 🔐 Auth-aware sync cleanup initialized')
  }
}

// Initialize auth cleanup
initializeAuthAwarePureLiveStoreSyncCleanup()

// Service initialization actor
const initializeServicesActor = fromPromise(async ({ input }: { input: PureLiveStoreSyncContext }) => {
  const { clientId, organizationId, userId, currentLSN } = input
  
  if (!organizationId || !userId) {
    throw new Error('Organization ID and User ID required for sync initialization')
  }

  syncLogger.info('sync', 'Initializing pure LiveStore services', {
    clientId,
    organizationId,
    userId,
    currentLSN
  })

  try {
    // Create service coordinator
    const coordinator = new PureLiveStoreServiceCoordinator()
    
    // Determine server URL
    const serverUrl = getSyncWebSocketUrl()
    
    const config: PureLiveStoreCoordinatorConfig = {
      clientId,
      currentLSN,
      serverUrl,
      organizationId,
      userId,
      enableHeartbeat: true,
      heartbeatInterval: 30000,
      reconnectDelay: 1000,
      maxReconnectAttempts: 5
    }

    // Initialize all services
    const services = await coordinator.initialize(config)
    
    // Store globally for domain service access
    globalPureLiveStoreServices = {
      webSocketService: services.webSocket,
      liveStoreSync: services.liveStoreSync,
      liveStore: services.liveStore
    }

    syncLogger.info('sync', 'Pure LiveStore services initialized successfully')

    return {
      coordinator,
      services,
      serverUrl
    }

  } catch (error) {
    syncLogger.serviceError('PureLiveStoreSyncMachine', error as Error, 'service_initialization')
    throw error
  }
})

// Connection actor
const connectWebSocketActor = fromPromise(async ({ input }: { 
  input: { coordinator: PureLiveStoreServiceCoordinator, serverUrl: string }
}) => {
  const { coordinator } = input
  
  try {
    const services = coordinator.getServices()
    if (!services?.webSocket) {
      throw new Error('WebSocket service not available')
    }

    syncLogger.info('sync', 'Connecting to WebSocket server')
    await services.webSocket.connect()
    
    return { connected: true }

  } catch (error) {
    syncLogger.serviceError('WebSocket', error as Error, 'connection')
    throw error
  }
})

// Pure LiveStore sync machine
export const pureLiveStoreSyncMachine = setup({
  types: {
    context: {} as PureLiveStoreSyncContext,
    events: {} as PureLiveStoreSyncEvent,
  },
  
  actors: {
    initializeServices: initializeServicesActor,
    connectWebSocket: connectWebSocketActor,
  },
  
  actions: {
    initializeContext: assign({
      clientId: ({ context }) => context.clientId || `client_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      currentLSN: ({ context }) => context.currentLSN || '0/0',
      serverLSN: null,
      syncPhase: null,
      isConnected: false,
      error: null,
      reconnectAttempts: 0,
      serviceCoordinator: null,
    }),
    
    setOrganizationContext: assign({
      organizationId: ({ event }) => {
        if (event.type === 'CONNECT' && 'organizationId' in event) {
          return event.organizationId
        }
        return null
      },
      userId: ({ event }) => {
        if (event.type === 'CONNECT' && 'userId' in event) {
          return event.userId
        }
        return null
      },
    }),
    
    storeServiceCoordinator: assign({
      serviceCoordinator: ({ event }) => {
        if (event.type === 'SERVICE_COORDINATOR_READY' && 'coordinator' in event) {
          return event.coordinator
        }
        return null
      },
      serverUrl: ({ event }) => {
        if (event.type === 'SERVICE_COORDINATOR_READY' && 'serverUrl' in event) {
          return event.serverUrl
        }
        return null
      },
    }),
    
    markConnected: assign({
      isConnected: true,
      reconnectAttempts: 0,
      error: null,
    }),
    
    markDisconnected: assign({
      isConnected: false,
    }),
    
    updateSyncPhase: assign({
      syncPhase: ({ event }) => {
        if ('syncPhase' in event) {
          return event.syncPhase
        }
        return null
      },
    }),
    
    updateServerLSN: assign({
      serverLSN: ({ event }) => {
        if ('serverLSN' in event) {
          return event.serverLSN
        }
        return null
      },
    }),
    
    updateCurrentLSN: assign({
      currentLSN: ({ event, context }) => {
        console.log('[PureLiveStoreSyncMachine] updateCurrentLSN action triggered:', {
          eventType: event.type,
          currentContextLSN: context.currentLSN,
          eventServerLSN: 'serverLSN' in event ? event.serverLSN : 'none',
          eventCurrentLSN: 'currentLSN' in event ? event.currentLSN : 'none',
          eventLSN: 'lsn' in event ? event.lsn : 'none',
          eventPhase: 'phase' in event ? event.phase : 'none'
        });
        
        // For SYNC_PHASE_COMPLETE, use serverLSN field
        if (event.type === 'SYNC_PHASE_COMPLETE' && 'serverLSN' in event && event.serverLSN) {
          syncLogger.info('sync', `LSN updated from ${event.phase} completion: ${context.currentLSN} → ${event.serverLSN}`)
          console.log('[PureLiveStoreSyncMachine] LSN update successful:', event.serverLSN);
          return event.serverLSN
        }
        // For LSN_UPDATE events (like original sync-machine-v3)
        if (event.type === 'LSN_UPDATE' && 'lsn' in event && event.lsn) {
          syncLogger.info('sync', `LSN updated from ${event.source || 'unknown'}: ${context.currentLSN} → ${event.lsn}`)
          console.log('[PureLiveStoreSyncMachine] LSN_UPDATE successful:', event.lsn);
          return event.lsn
        }
        // For other events, use currentLSN field
        if ('currentLSN' in event) {
          console.log('[PureLiveStoreSyncMachine] Using currentLSN from event:', event.currentLSN);
          return event.currentLSN
        }
        console.log('[PureLiveStoreSyncMachine] No LSN update, keeping context LSN:', context.currentLSN);
        return context.currentLSN
      },
    }),
    
    // Add updateLSN action like original sync-machine-v3 (with WebSocket params update)
    updateLSN: assign(({ event, context }) => {
      if (event.type === 'LSN_UPDATE') {
        console.log(`[PureLiveStoreSyncMachine] 📊 LSN update: ${context.currentLSN} → ${event.lsn} (source: ${event.source || 'unknown'})`);
        
        // CRITICAL: Update WebSocketService for heartbeat consistency (from original v3)
        if (context.serviceCoordinator) {
          const services = context.serviceCoordinator.getServices();
          if (services?.webSocket && context.clientId) {
            services.webSocket.updateConnectionParams(context.clientId, event.lsn);
            console.log(`[PureLiveStoreSyncMachine] 🔄 Updated WebSocket connection params with new LSN: ${event.lsn}`);
          }
        }
        
        return {
          currentLSN: event.lsn
        };
      }
      return {};
    }),
    
    storeError: assign({
      error: ({ event }) => {
        if ('error' in event) {
          return event.error instanceof Error ? event.error.message : String(event.error)
        }
        return 'Unknown error'
      },
    }),
    
    incrementReconnectAttempts: assign({
      reconnectAttempts: ({ context }) => context.reconnectAttempts + 1,
    }),
    
    setupServiceCallbacks: ({ context, self }) => {
      if (context.serviceCoordinator) {
        // Setup callbacks to relay events to sync machine
        context.serviceCoordinator.setupCallbacks((event: any) => {
          console.log('[PureLiveStoreSyncMachine] Service event received:', {
            eventType: event.type,
            currentState: self.getSnapshot().value,
            event: event
          })
          // CRITICAL: Actually send the event to the machine
          self.send(event)
        })
      }
    },
    
    // Notify app-init machine when sync is live
    notifyAppInitSyncLive: sendParent({ type: 'SYNC_LIVE' }),
    
    // Persistence (same as existing)
    persistState: ({ context }) => {
      const stateToSave = {
        clientId: context.clientId,
        currentLSN: context.currentLSN
      }
      
      try {
        localStorage.setItem('pureLiveStoreSyncState', JSON.stringify(stateToSave))
        syncLogger.info('sync', 'Pure LiveStore sync state persisted')
      } catch (error) {
        syncLogger.serviceError('PureLiveStoreSyncMachine', error as Error, 'persistence')
      }
    }
  }
}).createMachine({
  id: 'pureLiveStoreSyncMachine',
  initial: 'idle',
  
  context: ({ input }: { input?: { persistedData?: Partial<PureLiveStoreSyncContext> } }) => {
    // Load persisted state
    let persistedState = null
    try {
      const saved = localStorage.getItem('pureLiveStoreSyncState')
      if (saved) {
        persistedState = JSON.parse(saved)
      }
    } catch (error) {
      console.warn('[PureLiveStoreSyncMachine] Failed to load persisted state:', error)
    }
    
    return {
      clientId: persistedState?.clientId || `client_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      currentLSN: persistedState?.currentLSN || '0/0',
      serverLSN: null,
      syncPhase: null,
      organizationId: null,
      userId: null,
      serverUrl: null,
      isConnected: false,
      error: null,
      reconnectAttempts: 0,
      serviceCoordinator: null,
    }
  },
  
  states: {
    idle: {
      entry: () => syncLogger.info('sync', 'Pure LiveStore sync machine idle'),
      on: {
        CONNECT: {
          target: 'initializing_services',
          actions: ['setOrganizationContext']
        }
      }
    },
    
    initializing_services: {
      entry: () => syncLogger.info('sync', 'Initializing pure LiveStore services'),
      
      invoke: {
        src: 'initializeServices',
        input: ({ context }) => context,
        onDone: {
          target: 'connecting',
          actions: [
            assign({
              serviceCoordinator: ({ event }) => event.output.coordinator,
              serverUrl: ({ event }) => event.output.serverUrl,
            }),
            'setupServiceCallbacks'
          ]
        },
        onError: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },
    
    connecting: {
      entry: () => syncLogger.info('sync', 'Connecting to WebSocket server'),
      
      invoke: {
        src: 'connectWebSocket',
        input: ({ context }) => ({
          coordinator: context.serviceCoordinator!,
          serverUrl: context.serverUrl!
        }),
        onDone: {
          target: 'initial_sync',
          actions: ['markConnected']
        },
        onError: {
          target: 'error',
          actions: ['storeError', 'incrementReconnectAttempts']
        }
      },
      
      on: {
        WS_CONNECTED: {
          target: 'initial_sync',
          actions: 'markConnected'
        },
        WS_ERROR: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },
    
    initial_sync: {
      entry: () => {
        syncLogger.info('sync', 'Starting initial sync phase')
        console.log('[PureLiveStoreSyncMachine] Entered initial_sync state - ready to handle SYNC_PHASE_COMPLETE events')
      },
      
      on: {
        '*': {
          actions: ({ event, context }) => {
            if (event.type !== 'WS_MESSAGE') { // Avoid spamming WS_MESSAGE logs
              console.log('[PureLiveStoreSyncMachine] Event received in initial_sync state:', {
                eventType: event.type,
                currentState: 'initial_sync',
                event: event
              });
            }
          }
        },
        WS_MESSAGE: {
          actions: [
            ({ event }) => {
              const message = event.message
              if (message.type === 'srv_init_start') {
                syncLogger.info('sync', 'Initial sync started by server')
              } else if (message.type === 'srv_init_changes') {
                syncLogger.info('sync', `Received initial sync batch: ${message.changes?.length || 0} changes`)
              } else if (message.type === 'srv_sync_status' && message.syncPhase === 'initial') {
                syncLogger.info('sync', 'Received initial sync status from server')
              }
            }
          ]
        },
        // CRITICAL: Add INCOMING_CHANGES handler like original sync-machine-v3 (line 663-665)
        INCOMING_CHANGES: {
          actions: [
            ({ event }) => {
              console.log(`[PureLiveStoreSyncMachine] Processing ${event.changes?.length || 0} incoming changes in initial_sync`)
            }
          ]
        },
        INCOMING_CHANGES_PROCESSED: {
          actions: [
            ({ event }) => {
              syncLogger.info('sync', `Processed ${event.results?.length || 0} initial sync changes`)
            }
          ]
        },
        // Use INITIAL_SYNC_COMPLETE like original sync-machine-v3 (line 675-680)
        INITIAL_SYNC_COMPLETE: {
          target: 'catchup_sync', // Simplified - go directly to catchup (can be live later)
          actions: [
            () => console.log('[PureLiveStoreSyncMachine] ✅ Initial sync completed - transitioning to catchup'),
            'updateSyncPhase', 
            'updateServerLSN', 
            'updateCurrentLSN', 
            'persistState'
          ]
        },
        LSN_UPDATE: {
          actions: ['updateLSN', 'persistState']
        },
        WS_DISCONNECTED: {
          target: 'connecting',
          actions: 'markDisconnected'
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },
    
    catchup_sync: {
      entry: () => syncLogger.info('sync', 'Starting catchup sync phase'),
      
      on: {
        WS_MESSAGE: {
          actions: [
            ({ event }) => {
              const message = event.message
              if (message.type === 'srv_sync_status' && message.syncPhase === 'catchup') {
                syncLogger.info('sync', 'Received catchup sync status from server')
              }
            }
          ]
        },
        // CRITICAL: Add INCOMING_CHANGES handler like original sync-machine-v3 (line 715-717)
        INCOMING_CHANGES: {
          actions: [
            ({ event }) => {
              console.log(`[PureLiveStoreSyncMachine] Processing ${event.changes?.length || 0} incoming changes in catchup_sync`)
            }
          ]
        },
        INCOMING_CHANGES_PROCESSED: {
          actions: [
            ({ event }) => {
              syncLogger.info('sync', `Processed ${event.results?.length || 0} catchup sync changes`)
            }
          ]
        },
        // Use CATCHUP_SYNC_COMPLETE like original sync-machine-v3 (line 727-733)
        CATCHUP_SYNC_COMPLETE: {
          target: 'live_sync',
          actions: [
            () => console.log('[PureLiveStoreSyncMachine] ✅ Catchup sync completed - transitioning to live'),
            'updateSyncPhase', 
            'updateServerLSN', 
            'updateCurrentLSN', 
            'persistState'
          ]
        },
        LSN_UPDATE: {
          actions: ['updateLSN', 'persistState']
        },
        WS_DISCONNECTED: {
          target: 'connecting',
          actions: 'markDisconnected'
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },
    
    live_sync: {
      entry: [
        () => syncLogger.info('sync', 'Entered live sync - pure LiveStore system ready'),
        'notifyAppInitSyncLive',
        'persistState'
      ],
      
      on: {
        WS_MESSAGE: {
          actions: [
            ({ event }) => {
              const message = event.message
              if (message.type === 'srv_send_changes') {
                syncLogger.info('sync', `Received ${message.changes?.length || 0} live changes`)
              }
            }
          ]
        },
        // CRITICAL: Add INCOMING_CHANGES handler like original sync-machine-v3 (line 865-867)
        INCOMING_CHANGES: {
          actions: [
            ({ event }) => {
              console.log(`[PureLiveStoreSyncMachine] Processing ${event.changes?.length || 0} incoming changes in live_sync`)
            }
          ]
        },
        INCOMING_CHANGES_PROCESSED: {
          actions: [
            ({ event }) => {
              syncLogger.info('sync', `Processed ${event.results?.length || 0} incoming changes`)
            },
            'persistState'
          ]
        },
        // CRITICAL: LSN_UPDATE handler in live_sync (from original sync-machine-v3 line 937-939)
        LSN_UPDATE: {
          actions: ['updateLSN', 'persistState']
        },
        DISCONNECT: 'idle',
        RESET: 'idle',
        WS_DISCONNECTED: {
          target: 'connecting',
          actions: 'markDisconnected'
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },
    
    error: {
      entry: ({ context }) => {
        syncLogger.serviceError('PureLiveStoreSyncMachine', new Error(context.error || 'Unknown error'), 'state_machine')
      },
      
      on: {
        RETRY: {
          target: 'idle',
          actions: assign({ error: null, reconnectAttempts: 0 })
        },
        CONNECT: {
          target: 'initializing_services',
          actions: ['setOrganizationContext', assign({ error: null })]
        }
      }
    }
  }
})

export default pureLiveStoreSyncMachine