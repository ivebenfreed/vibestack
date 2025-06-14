import { setup, assign, fromPromise, sendParent } from 'xstate';

export interface SyncContext {
  clientId: string | null;
  currentLSN: string;
  serverLSN: string | null;
  syncProgress: number;
  totalTables: number;
  completedTables: number;
  currentTable: string | null;
  syncPhase: 'initial' | 'catchup' | 'live' | null;
  lastSyncTime: number | null;
  error: string | null;
  integrityValidated: boolean;
  validationInProgress: boolean;
  
  // 🔥 Granular sync phase tracking from original
  syncPhaseProgress: {
    initial: { 
      completed: number;
      total: number;
      tables: string[];
      currentTable: string | null;
      completedTables: number;
      totalTables: number;
    };
    catchup: { 
      completed: number;
      total: number;
      batches: number;
      currentBatch: number;
      estimatedRemaining: number;
    };
    live: { 
      messagesProcessed: number;
      lastActivity: number | null;
      throughputPerSec: number;
    };
  };
}

export type SyncEvent =
  | { type: 'START_SYNC'; clientId: string; lsn: string }
  | { type: 'CONNECTION_ESTABLISHED'; serverLSN: string }
  | { type: 'SYNC_PROGRESS'; completed: number; total: number; table?: string }
  | { type: 'PHASE_CHANGED'; phase: 'initial' | 'catchup' | 'live' }
  | { type: 'INTEGRITY_VALIDATION_COMPLETE'; isValid: boolean }
  | { type: 'SYNC_COMPLETE' }
  | { type: 'SYNC_ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'INTEGRITY_RESET_START'; reason: string }
  | { type: 'LSN_UPDATE'; lsn: string }
  // 🔥 NEW: Granular sync events from original
  | { type: 'SYNC_PHASE_CHANGED'; phase: 'initial' | 'catchup' | 'live' }
  | { type: 'INITIAL_SYNC_PROGRESS'; currentTable?: string; completed: number; total: number; completedTables?: number; totalTables?: number; tables?: string[] }
  | { type: 'CATCHUP_SYNC_PROGRESS'; completed: number; total: number; currentBatch?: number; batches?: number; estimatedRemaining?: number }
  | { type: 'LIVE_SYNC_ACTIVITY'; increment: number; throughputPerSec?: number };

export interface SyncActorOutput {
  syncId: string;
  status: 'connected' | 'connecting' | 'error' | 'disconnected';
  phase?: 'initial' | 'catchup' | 'live';
}

export const syncMachine = setup({
  types: {
    context: {} as SyncContext,
    events: {} as SyncEvent,
  },
  
  actors: {
    runSync: fromPromise(async ({ input, self }: { input: { syncId: string }, self: any }): Promise<SyncActorOutput> => {
      return new Promise<SyncActorOutput>(async (resolve, reject) => {
        try {
          const { SyncManager } = await import('@/sync/SyncManager');
          const syncManager = SyncManager.getInstance();
          
          const handleSyncStatusChange = (status: any) => {
            console.log('[XSTATE] Sync status changed:', status);
            if (status === 'live') {
              cleanup();
              console.log('[XSTATE] WebSocket connected and sync live - resolving');
              resolve({ syncId: input.syncId, status: 'connected', phase: 'live' });
            }
          };
          
          const handleSyncError = (error: any) => {
            console.error('[XSTATE] Sync error:', error);
            cleanup();
            reject(new Error(error?.message || 'Sync failed'));
          };
          
          // 🔥 Handle granular sync events from websocket manager
          const handleSyncMessage = (data: any) => {
            const { messageType, changes, sequence, progress } = data;
            
            console.log('[XSTATE] Sync message received:', { messageType, changesCount: changes?.length, sequence });
            
            // Determine and emit sync phase changes
            if (messageType === 'srv_init_changes') {
              // Initial sync phase - table by table processing
              self.send({ 
                type: 'SYNC_PHASE_CHANGED', 
                phase: 'initial'
              });
              
              if (sequence) {
                self.send({
                  type: 'INITIAL_SYNC_PROGRESS',
                  currentTable: sequence.table,
                  completed: sequence.chunk || 0,
                  total: sequence.total || 0,
                  completedTables: sequence.completedTables || 0,
                  totalTables: sequence.totalTables || 0,
                  tables: sequence.tables || []
                });
              }
            } else if (messageType === 'srv_catchup_changes') {
              // Catchup sync phase - WAL processing
              self.send({ 
                type: 'SYNC_PHASE_CHANGED', 
                phase: 'catchup'
              });
              
              if (sequence) {
                self.send({
                  type: 'CATCHUP_SYNC_PROGRESS',
                  completed: sequence.chunk || 0,
                  total: sequence.total || 0,
                  currentBatch: sequence.currentBatch || 0,
                  batches: sequence.batches || 0,
                  estimatedRemaining: sequence.estimatedRemaining || 0
                });
              }
            } else if (messageType?.includes('live') || messageType?.includes('change')) {
              // Live sync phase - real-time processing
              self.send({ 
                type: 'SYNC_PHASE_CHANGED', 
                phase: 'live'
              });
              
              self.send({
                type: 'LIVE_SYNC_ACTIVITY',
                increment: changes?.length || 1,
                throughputPerSec: progress?.throughputPerSec || 0
              });
            }
          };
          
          const handleIncomingChangesProcessed = (data: any) => {
            const { success, count, type, syncMode, processingTimeMs, throughputPerSec } = data;
            
            console.log('[XSTATE] Incoming changes processed:', { success, count, type, syncMode });
            
            // Update appropriate sync phase progress
            if (syncMode === 'initial') {
              self.send({
                type: 'INITIAL_SYNC_PROGRESS',
                completed: count,
                total: count // Will be updated by sequence info
              });
            } else if (syncMode === 'catchup') {
              self.send({
                type: 'CATCHUP_SYNC_PROGRESS',
                completed: count,
                total: count // Will be updated by sequence info
              });
            } else if (syncMode === 'live') {
              self.send({
                type: 'LIVE_SYNC_ACTIVITY',
                increment: count,
                throughputPerSec: throughputPerSec || 0
              });
            }
          };
          
          const cleanup = () => {
            // Remove SyncManager event listeners
            syncManager.off('sync:statusChanged', handleSyncStatusChange);
            syncManager.off('sync:error', handleSyncError);
            syncManager.off('sync:message', handleSyncMessage);
            syncManager.off('incoming_changes_processed', handleIncomingChangesProcessed);
          };
          
          // Listen for sync status changes from SyncManager
          syncManager.on('sync:statusChanged', handleSyncStatusChange);
          syncManager.on('sync:error', handleSyncError);
          
          // 🔥 Listen for granular sync events
          syncManager.on('sync:message', handleSyncMessage);
          syncManager.on('incoming_changes_processed', handleIncomingChangesProcessed);
          
          // Check if sync is already live (race condition protection)
          const currentStatus = syncManager.getStatus();
          console.log('[XSTATE] Current sync status:', currentStatus);
          if (currentStatus === 'live') {
            cleanup();
            console.log('[XSTATE] WebSocket already connected and sync live - sending SYNC_PHASE_CHANGED and resolving');
            // Send the live phase event so orchestrator knows we're live
            self.send({ 
              type: 'SYNC_PHASE_CHANGED', 
              phase: 'live'
            });
            resolve({ syncId: input.syncId, status: 'connected', phase: 'live' });
            return;
          }
          
          // Start sync if it's not already running
          console.log('[XSTATE] Starting sync connection...');
          await syncManager.autoConnectToServer();
          
        } catch (error) {
          console.error('[XSTATE] Error setting up sync:', error);
          reject(error);
        }
      });
    }),
  },
  
  guards: {
    canStartSync: ({ context }) => !!context.clientId,
    isInitialPhase: ({ context }) => {
      const result = context.syncPhase === 'initial';
      console.log('[SyncMachine] isInitialPhase guard:', { syncPhase: context.syncPhase, result });
      return result;
    },
    isCatchupPhase: ({ context }) => {
      const result = context.syncPhase === 'catchup';
      console.log('[SyncMachine] isCatchupPhase guard:', { syncPhase: context.syncPhase, result });
      return result;
    },
    isLivePhase: ({ context }) => {
      const result = context.syncPhase === 'live';
      console.log('[SyncMachine] isLivePhase guard:', { syncPhase: context.syncPhase, result });
      return result;
    },
  },
  
  actions: {
    // 🔥 Granular sync phase tracking actions from original
    setSyncPhase: assign({
      syncPhase: ({ event }) => {
        if (event.type === 'SYNC_PHASE_CHANGED') {
          console.log('[SyncMachine] ✅ setSyncPhase action called, setting phase to:', event.phase);
          return event.phase;
        }
        console.log('[SyncMachine] ❌ setSyncPhase called but event type is not SYNC_PHASE_CHANGED:', event.type);
        return null;
      }
    }),
    
    resetSyncState: assign({
      clientId: null,
      currentLSN: '0/0',
      serverLSN: null,
      syncProgress: 0,
      totalTables: 0,
      completedTables: 0,
      currentTable: null,
      syncPhase: null,
      lastSyncTime: null,
      error: null,
      integrityValidated: false,
      validationInProgress: false,
      
      // Reset granular sync phase tracking
      syncPhaseProgress: {
        initial: { 
          completed: 0, 
          total: 0, 
          tables: [],
          currentTable: null,
          completedTables: 0,
          totalTables: 0
        },
        catchup: { 
          completed: 0, 
          total: 0, 
          batches: 0,
          currentBatch: 0,
          estimatedRemaining: 0
        },
        live: { 
          messagesProcessed: 0, 
          lastActivity: null,
          throughputPerSec: 0
        }
      },
    }),
    
    disconnectSync: async () => {
      try {
        console.log('[SyncMachine] 🔌 Disconnecting sync for integrity reset...');
        const { SyncManager } = await import('@/sync/SyncManager');
        const syncManager = SyncManager.getInstance();
        
        if (syncManager.isConnected()) {
          syncManager.disconnect();
          console.log('[SyncMachine] ✅ Sync disconnected for integrity reset');
        }
      } catch (error) {
        console.error('[SyncMachine] ❌ Error disconnecting sync:', error);
      }
    },
    
    updateInitialSyncProgress: assign({
      syncPhaseProgress: ({ context, event }) => ({
        ...context.syncPhaseProgress,
        initial: {
          completed: (event.type === 'INITIAL_SYNC_PROGRESS' ? event.completed : undefined) || 0,
          total: (event.type === 'INITIAL_SYNC_PROGRESS' ? event.total : undefined) || 0,
          tables: (event.type === 'INITIAL_SYNC_PROGRESS' ? event.tables : undefined) || context.syncPhaseProgress.initial.tables,
          currentTable: (event.type === 'INITIAL_SYNC_PROGRESS' ? event.currentTable : undefined) || context.syncPhaseProgress.initial.currentTable,
          completedTables: (event.type === 'INITIAL_SYNC_PROGRESS' ? event.completedTables : undefined) || context.syncPhaseProgress.initial.completedTables,
          totalTables: (event.type === 'INITIAL_SYNC_PROGRESS' ? event.totalTables : undefined) || context.syncPhaseProgress.initial.totalTables
        }
      }),
      // Update overall sync progress based on initial sync
      syncProgress: ({ event }) => {
        if (event.type === 'INITIAL_SYNC_PROGRESS' && event.total && event.total > 0) {
          return Math.round(((event.completed || 0) / event.total) * 100);
        }
        return 0;
      },
    }),
    
    updateCatchupSyncProgress: assign({
      syncPhaseProgress: ({ context, event }) => ({
        ...context.syncPhaseProgress,
        catchup: {
          completed: (event.type === 'CATCHUP_SYNC_PROGRESS' ? event.completed : undefined) || 0,
          total: (event.type === 'CATCHUP_SYNC_PROGRESS' ? event.total : undefined) || 0,
          batches: (event.type === 'CATCHUP_SYNC_PROGRESS' ? event.batches : undefined) || context.syncPhaseProgress.catchup.batches,
          currentBatch: (event.type === 'CATCHUP_SYNC_PROGRESS' ? event.currentBatch : undefined) || context.syncPhaseProgress.catchup.currentBatch,
          estimatedRemaining: (event.type === 'CATCHUP_SYNC_PROGRESS' ? event.estimatedRemaining : undefined) || context.syncPhaseProgress.catchup.estimatedRemaining
        }
      }),
      // Update overall sync progress based on catchup sync
      syncProgress: ({ event }) => {
        if (event.type === 'CATCHUP_SYNC_PROGRESS' && event.total && event.total > 0) {
          return Math.round(((event.completed || 0) / event.total) * 100);
        }
        return 0;
      },
    }),
    
    updateLiveSyncActivity: assign({
      syncPhaseProgress: ({ context, event }) => ({
        ...context.syncPhaseProgress,
        live: {
          messagesProcessed: (context.syncPhaseProgress.live?.messagesProcessed || 0) + ((event.type === 'LIVE_SYNC_ACTIVITY' ? event.increment : undefined) || 1),
          lastActivity: Date.now(),
          throughputPerSec: (event.type === 'LIVE_SYNC_ACTIVITY' ? event.throughputPerSec : undefined) || context.syncPhaseProgress.live?.throughputPerSec || 0
        }
      }),
    }),
    
    notifyParent: sendParent(({ event }) => event),
    notifyLive: sendParent({ type: 'SYNC_LIVE' }),
    
    // Update LSN from SyncManager
    updateLSN: assign({
      currentLSN: ({ event }) => {
        if (event.type === 'LSN_UPDATE') {
          console.log('[SyncMachine] 📍 LSN updated to:', event.lsn);
          return event.lsn;
        }
        return '0/0';
      }
    }),
  }
}).createMachine({
  id: 'syncMachine',
  context: {
    clientId: null,
    currentLSN: '0/0',
    serverLSN: null,
    syncProgress: 0,
    totalTables: 0,
    completedTables: 0,
    currentTable: null,
    syncPhase: null,
    lastSyncTime: null,
    error: null,
    integrityValidated: false,
    validationInProgress: false,
    
    // 🔥 Granular sync phase tracking from original
    syncPhaseProgress: {
      initial: { 
        completed: 0, 
        total: 0, 
        tables: [],
        currentTable: null,
        completedTables: 0,
        totalTables: 0
      },
      catchup: { 
        completed: 0, 
        total: 0, 
        batches: 0,
        currentBatch: 0,
        estimatedRemaining: 0
      },
      live: { 
        messagesProcessed: 0, 
        lastActivity: null,
        throughputPerSec: 0
      }
    },
  },
  
  initial: 'idle',
  states: {
    idle: {
      entry: () => {
        console.log('[SyncMachine] 💤 Entering idle state');
      },
      on: {
        START_SYNC: {
          target: 'connecting',
          actions: [
            ({ event }) => console.log('[SyncMachine] 🚀 Received START_SYNC, transitioning to connecting:', event),
            assign({
              clientId: ({ event }) => event.clientId,
              currentLSN: ({ event }) => event.lsn,
              error: null,
              syncProgress: 0,
            })
          ]
        },
        INTEGRITY_RESET_START: {
          // Already idle, just reset state to be clean
          actions: ['resetSyncState', 'notifyParent']
        },
        LSN_UPDATE: {
          actions: 'updateLSN'
        }
      }
    },
    
    // New connecting state to handle the initial connection setup
    connecting: {
      entry: () => {
        console.log('[SyncMachine] 🔄 Entering connecting state');
      },
      invoke: {
        src: 'runSync',
        input: ({ context }) => ({ syncId: context.clientId! }),
        onDone: [
          {
            // If runSync resolved with connected status and live phase, go directly to live state
            target: 'live',
            guard: ({ event }) => event.output?.status === 'connected' && event.output?.phase === 'live',
            actions: [
              assign({
                syncPhase: 'live'
              }),
              'notifyLive'
            ]
          },
          {
            // If runSync resolved with connected status and initial phase, go to initial sync
            target: 'initialSync',
            guard: ({ event }) => event.output?.status === 'connected' && event.output?.phase === 'initial',
            actions: assign({
              syncPhase: 'initial'
            })
          },
          {
            // If runSync resolved with connected status and catchup phase, go to catchup sync
            target: 'catchupSync',
            guard: ({ event }) => event.output?.status === 'connected' && event.output?.phase === 'catchup',
            actions: assign({
              syncPhase: 'catchup'
            })
          },
          {
            // If we already have a sync phase set, go directly to that state
            target: 'live',
            guard: 'isLivePhase',
            actions: 'notifyLive'
          },
          {
            target: 'initialSync',
            guard: 'isInitialPhase'
          },
          {
            target: 'catchupSync',
            guard: 'isCatchupPhase'
          },
          {
            // Default to determining if no phase is set
            target: 'determining'
          }
        ],
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => (event.error as Error)?.message || 'Sync failed',
          })
        }
      },
      
      on: {
        // Handle phase changes during connection
        SYNC_PHASE_CHANGED: [
          {
            target: 'initialSync',
            guard: ({ event }) => event.phase === 'initial',
            actions: ['setSyncPhase', 'notifyParent']
          },
          {
            target: 'catchupSync', 
            guard: ({ event }) => event.phase === 'catchup',
            actions: ['setSyncPhase', 'notifyParent']
          },
          {
            target: 'live',
            guard: ({ event }) => event.phase === 'live',
            actions: [
              ({ event, context }) => console.log('[SyncMachine] 🟢 Transitioning to live state via SYNC_PHASE_CHANGED:', event.phase, 'current context.syncPhase:', context.syncPhase),
              'setSyncPhase', 
              ({ context }) => console.log('[SyncMachine] 🔍 After setSyncPhase, context.syncPhase:', context.syncPhase),
              'notifyParent', 
              'notifyLive'
            ]
          }
        ],
        INTEGRITY_RESET_START: {
          target: 'resetting',
          actions: ['disconnectSync', 'notifyParent']
        },
        LSN_UPDATE: {
          actions: 'updateLSN'
        }
      }
    },
    
    // Temporary state to handle server strategy determination
    determining: {
      always: [
        {
          target: 'initialSync',
          guard: 'isInitialPhase'
        },
        {
          target: 'catchupSync',
          guard: 'isCatchupPhase'
        },
        {
          target: 'live',
          guard: 'isLivePhase'
        }
      ],
      
      on: {
        SYNC_PHASE_CHANGED: [
          {
            target: 'initialSync',
            guard: ({ event }) => event.phase === 'initial',
            actions: ['setSyncPhase', 'notifyParent']
          },
          {
            target: 'catchupSync',
            guard: ({ event }) => event.phase === 'catchup', 
            actions: ['setSyncPhase', 'notifyParent']
          },
          {
            target: 'live',
            guard: ({ event }) => event.phase === 'live',
            actions: ['setSyncPhase', 'notifyParent', 'notifyLive']
          }
        ],
        LSN_UPDATE: {
          actions: 'updateLSN'
        }
      }
    },
    
    // Initial sync state - only active during initial sync phase
    initialSync: {
      on: {
        INITIAL_SYNC_PROGRESS: {
          actions: ['updateInitialSyncProgress', 'notifyParent']
        },
        SYNC_PHASE_CHANGED: [
          {
            target: 'catchupSync',
            guard: ({ event }) => event.phase === 'catchup',
            actions: ['setSyncPhase', 'notifyParent']
          },
          {
            target: 'live',
            guard: ({ event }) => event.phase === 'live',
            actions: ['setSyncPhase', 'notifyParent']
          }
        ],
        SYNC_ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error,
          })
        },
        INTEGRITY_RESET_START: {
          target: 'resetting',
          actions: ['disconnectSync', 'notifyParent']
        },
        LSN_UPDATE: {
          actions: 'updateLSN'
        }
      }
    },
    
    // Catchup sync state - only active during catchup sync phase
    catchupSync: {
      on: {
        CATCHUP_SYNC_PROGRESS: {
          actions: ['updateCatchupSyncProgress', 'notifyParent']
        },
        SYNC_PHASE_CHANGED: [
          {
            target: 'live',
            guard: ({ event }) => event.phase === 'live',
            actions: ['setSyncPhase', 'notifyParent']
          }
        ],
        SYNC_ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error,
          })
        },
        INTEGRITY_RESET_START: {
          target: 'resetting',
          actions: ['disconnectSync', 'notifyParent']
        },
        LSN_UPDATE: {
          actions: 'updateLSN'
        }
      }
    },
    
    // Live sync state - only reached when actually in live sync phase
    live: {
      entry: [
        ({ context }) => console.log('[SyncMachine] 🟢 Entering live state, context.syncPhase:', context.syncPhase),
        'notifyLive',
        assign({
          lastSyncTime: () => Date.now(),
        })
      ],
      on: {
        RESET: 'idle',
        SYNC_ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error,
          })
        },
        LIVE_SYNC_ACTIVITY: {
          actions: ['updateLiveSyncActivity', 'notifyParent']
        },
        INTEGRITY_RESET_START: {
          target: 'resetting',
          actions: ['disconnectSync', 'notifyParent']
        },
        LSN_UPDATE: {
          actions: 'updateLSN'
        }
      }
    },
    
    resetting: {
      entry: [
        ({ event }) => {
          console.log('[SyncMachine] 🚨 Entering reset state for integrity reset:', 
            event.type === 'INTEGRITY_RESET_START' ? event.reason : 'Unknown reason');
        }
      ],
      
      // Wait for reset completion signal from orchestrator
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetSyncState'
        },
        START_SYNC: {
          target: 'connecting',
          actions: assign({
            clientId: ({ event }) => event.clientId,
            currentLSN: ({ event }) => event.lsn,
            error: null,
            syncProgress: 0,
          })
        },
        LSN_UPDATE: {
          actions: 'updateLSN'
        }
      }
    },
    
    error: {
      on: {
        RESET: 'idle',
        START_SYNC: 'connecting',
        INTEGRITY_RESET_START: {
          target: 'resetting',
          actions: ['disconnectSync', 'resetSyncState', 'notifyParent']
        },
        LSN_UPDATE: {
          actions: 'updateLSN'
        }
      }
    }
  }
}); 