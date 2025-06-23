import { setup, assign, fromPromise, sendTo } from 'xstate';
import { getSyncWebSocketUrl } from '../../sync/config';
import { syncMachineV2 } from './sync-machine-v2';
import { liveChangesMachine } from './live-changes-machine';

export interface AppInitContext {
  // Database state
  isDatabaseInitialized: boolean;
  databaseError: string | null;
  
  // Connection state
  isOnline: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // Sync state
  isSyncReady: boolean;
  syncError: string | null;
  liveChangesStatus: 'idle' | 'connecting' | 'connected' | 'error';
  
  // System ready state derived from machine state (not persisted)
  
  // Sync configuration
  syncClientId: string;
  syncState: {
    phase: 'initial' | 'catchup' | 'live' | null;
    progress: number;
    currentLSN: string;
    error: string | null;
    machineState: string;
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
  };
  integrityBaseline: {
    lastInitialSyncCompletedAt: string | null;
    lastFullValidationAt: string | null;
    recordChangesSinceBaseline: number;
    maxRecordsBeforeReset: number;
    validationStrategy: 'baseline_with_threshold' | 'full_validation_periodic' | 'hybrid';
  };
  
  // Timing
  initStartTime: number;
  lastActivity: number;
}

export type AppInitEvent =
  | { type: 'START_INIT' }
  | { type: 'RETRY_INIT' }
  | { type: 'RESTART_SYNC' }
  | { type: 'RESET' }
  | { type: 'DATABASE_READY' }
  | { type: 'DATABASE_ERROR'; error: string }
  | { type: 'CONNECTION_ONLINE' }
  | { type: 'CONNECTION_OFFLINE' }
  | { type: 'SYNC_LIVE' }
  | { type: 'SYNC_ERROR'; error: string }
  | { type: 'LIVE_CHANGES_ACTIVE' }
  | { type: 'LIVE_CHANGES_ERROR'; error: string };

// No auth-aware reset needed - machine will start fresh each login through events

// Real actor for waiting for database ready event
const waitForDatabaseActor = fromPromise(async () => {
  console.log('[AppInitMachine] Waiting for database initialization...');
  
  return new Promise((resolve, reject) => {
    const handleReady = (event: CustomEvent) => {
      cleanup();
      console.log('[AppInitMachine] Database ready event received');
      resolve({ success: true });
    };
    
    const handleError = (event: CustomEvent) => {
      cleanup();
      console.error('[AppInitMachine] Database error event received:', event.detail);
      reject(new Error(event.detail.error || 'Database initialization failed'));
    };
    
    const cleanup = () => {
      window.removeEventListener('database:ready', handleReady as EventListener);
      window.removeEventListener('database:error', handleError as EventListener);
    };
    
    window.addEventListener('database:ready', handleReady as EventListener);
    window.addEventListener('database:error', handleError as EventListener);
    
    // Check if database is already ready by dispatching a check event
    const dbCheckEvent = new CustomEvent('database:check');
    window.dispatchEvent(dbCheckEvent);
  });
});

export const appInitMachine = setup({
  types: {
    context: {} as AppInitContext,
    events: {} as AppInitEvent,
  },
  
  actors: {
    waitForDatabase: waitForDatabaseActor,
    syncMachine: syncMachineV2,
    liveChangesMachine,
  },
  
  actions: {
    markDatabaseReady: assign({
      isDatabaseInitialized: true,
      databaseError: null,
      lastActivity: () => Date.now(),
    }),
    
    storeDatabaseError: assign({
      databaseError: ({ event }) => 
        event.type === 'DATABASE_ERROR' ? event.error : 'Database initialization failed',
      lastActivity: () => Date.now(),
    }),
    
    markSyncReady: assign({
      isSyncReady: true,
      syncError: null,
      lastActivity: () => Date.now(),
    }),
    
    storeSyncError: assign({
      syncError: ({ event }) => 
        event.type === 'SYNC_ERROR' ? event.error : 'Sync initialization failed',
      lastActivity: () => Date.now(),
    }),
    
    markOnline: assign({
      isOnline: true,
      connectionStatus: () => 'connected' as const,
      lastActivity: () => Date.now(),
    }),
    
    markOffline: assign({
      isOnline: false,
      connectionStatus: () => 'disconnected' as const,
      lastActivity: () => Date.now(),
    }),
    
    markSystemReady: assign({
      // System ready is determined by reaching 'ready' state
      lastActivity: () => Date.now(),
    }),
    
    resetSystem: assign({
      isDatabaseInitialized: false,
      databaseError: null,
      isSyncReady: false,
      syncError: null,
      lastActivity: () => Date.now(),
    }),
    
    // Child machines automatically stopped when leaving states

    // No longer needed - using event-driven initialization
    
    startSync: sendTo('syncMachine', { type: 'CONNECT' }),
    
    startLiveChanges: sendTo('liveChangesMachine', {
      type: 'START',
      entities: ['Task', 'Project', 'User', 'Comment']
    }),
  },
}).createMachine({
  id: 'appInitMachine',
  initial: 'idle',
  
  // Machine starts in idle and waits for START_INIT event
  
  context: ({ input }: { input?: { persistedData?: Partial<AppInitContext> } }) => ({
    isDatabaseInitialized: false,
    databaseError: null,
    isOnline: navigator.onLine,
    connectionStatus: 'disconnected' as const,
    isSyncReady: false,
    syncError: null,
    liveChangesStatus: 'idle' as const,
    syncClientId: input?.persistedData?.syncClientId || crypto.randomUUID(),
    syncState: input?.persistedData?.syncState || {
      phase: null,
      progress: 0,
      currentLSN: '0/0',
      error: null,
      machineState: 'idle',
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
    },
    integrityBaseline: input?.persistedData?.integrityBaseline || {
      lastInitialSyncCompletedAt: null,
      lastFullValidationAt: null,
      recordChangesSinceBaseline: 0,
      maxRecordsBeforeReset: 10000,
      validationStrategy: 'baseline_with_threshold' as const,
    },
    initStartTime: Date.now(),
    lastActivity: Date.now(),
  }),
  
  // Invoke child machines at root level to persist across state transitions
  invoke: [
    {
      id: 'syncMachine',
      src: 'syncMachine',
      input: ({ context }) => ({
        // Pass sync client data to sync machine
        syncClientId: context.syncClientId,
        currentLSN: context.syncState.currentLSN,
      }),
      // Receive events directly from sync machine
      onDone: {
        actions: () => console.log('[AppInitMachine] Sync machine completed')
      },
      onError: {
        actions: () => console.log('[AppInitMachine] Sync machine error')
      }
    },
    {
      id: 'liveChangesMachine',
      src: 'liveChangesMachine',
      // Receive events directly from live changes machine
      onDone: {
        actions: () => console.log('[AppInitMachine] Live changes machine completed')
      },
      onError: {
        actions: () => console.log('[AppInitMachine] Live changes machine error')
      }
    }
  ],
  
  on: {
    CONNECTION_ONLINE: {
      actions: 'markOnline'
    },
    
    CONNECTION_OFFLINE: {
      actions: 'markOffline'
    },
  },
  
  states: {
    idle: {
      entry: () => console.log('[AppInitMachine] Waiting for initialization trigger'),
      on: {
        START_INIT: 'database',
        RESET: {
          actions: ['resetSystem', () => console.log('[AppInitMachine] 🔄 System reset to idle state')]
        }
      }
    },
    
    database: {
      entry: () => console.log('[AppInitMachine] Waiting for database initialization'),
      
      invoke: {
        src: 'waitForDatabase',
        onDone: {
          target: 'sync',
          actions: 'markDatabaseReady'
        },
        onError: {
          target: 'error',
          actions: assign({
            databaseError: ({ event }) => (event.error as Error)?.message || 'Database initialization failed'
          })
        }
      },
      
      on: {
        DATABASE_READY: {
          target: 'sync',
          actions: 'markDatabaseReady'
        },
        DATABASE_ERROR: {
          target: 'error',
          actions: 'storeDatabaseError'
        },
        RETRY_INIT: {
          target: 'idle',
          actions: 'resetSystem'
        },
        RESET: {
          target: 'idle',
          actions: ['stopChildMachines', 'resetSystem', () => console.log('[AppInitMachine] 🔄 System reset to idle state')]
        }
      }
    },
    
    sync: {
      entry: [
        () => console.log('[AppInitMachine] Starting sync machine'),
        'startSync'
      ],
      
      on: {
        SYNC_LIVE: {
          target: 'live_changes',
          actions: [
            'markSyncReady',
            () => console.log('[AppInitMachine] Received SYNC_LIVE from sync machine')
          ]
        },
        SYNC_ERROR: {
          target: 'error',
          actions: 'storeSyncError'
        },
        RETRY_INIT: {
          target: 'idle',
          actions: 'resetSystem'
        },
        RESET: {
          target: 'idle',
          actions: ['resetSystem', () => console.log('[AppInitMachine] 🔄 System reset to idle state')]
        }
      }
    },
    
    live_changes: {
      entry: [
        () => console.log('[AppInitMachine] Starting live changes'),
        'startLiveChanges'
      ],
      
      on: {
        LIVE_CHANGES_ACTIVE: {
          target: 'ready',
          actions: [
            'markSystemReady',
            () => console.log('[AppInitMachine] Received LIVE_CHANGES_ACTIVE from live changes machine')
          ]
        },
        LIVE_CHANGES_ERROR: {
          target: 'error'
        },
        RETRY_INIT: {
          target: 'idle',
          actions: 'resetSystem'
        },
        RESET: {
          target: 'idle',
          actions: ['resetSystem', () => console.log('[AppInitMachine] 🔄 System reset to idle state')]
        }
      }
    },
    
    ready: {
      entry: () => console.log('[AppInitMachine] System fully ready'),
      
      on: {
        RESTART_SYNC: 'sync',
        RETRY_INIT: {
          target: 'idle',
          actions: 'resetSystem'
        },
        RESET: {
          target: 'idle',
          actions: ['stopChildMachines', 'resetSystem', () => console.log('[AppInitMachine] 🔄 System reset to idle state')]
        }
      }
    },
    
    error: {
      entry: () => console.log('[AppInitMachine] Initialization error'),
      
      on: {
        RETRY_INIT: {
          target: 'idle',
          actions: 'resetSystem'
        },
        START_INIT: 'database',
        RESET: {
          target: 'idle',
          actions: ['stopChildMachines', 'resetSystem', () => console.log('[AppInitMachine] 🔄 System reset to idle state')]
        }
      }
    }
  },
});