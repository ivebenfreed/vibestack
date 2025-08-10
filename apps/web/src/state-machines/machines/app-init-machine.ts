import { setup, assign, fromPromise, sendTo } from 'xstate';
import { getSyncWebSocketUrl } from '../../sync/config';
import { getDomainEntityNames } from '@/lib/entity-registry';

export interface AppInitContext {
  // Database state
  isDatabaseInitialized: boolean;
  databaseError: string | null;
  
  // Connection state
  isOnline: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // Simplified sync coordination (keep only what's needed for startup sequence)
  isSyncReady: boolean;
  syncError: string | null;
  liveChangesStatus: 'idle' | 'connecting' | 'connected' | 'error';
  
  // System ready state derived from machine state (not persisted)
  // All detailed sync state now managed by independent sync machine
  
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
    
    startSync: () => {
      console.log('[AppInitMachine] Starting global sync machine')
      const syncMachineActor = (window as any).syncMachineActor
      if (syncMachineActor) {
        syncMachineActor.send({ type: 'CONNECT' })
      } else {
        console.warn('[AppInitMachine] Sync machine actor not available')
      }
    },
    
    startLiveChanges: () => {
      // Live changes handled by Dexie
      console.log('[AppInitMachine] Live changes handled by Dexie');
    },
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
    initStartTime: Date.now(),
    lastActivity: Date.now(),
  }),
  
  // DISABLED - TypeORM removal
  // Invoke child machines at root level to persist across state transitions
  // invoke: [
  //   {
  //     id: 'liveChangesMachine',
  //     src: 'liveChangesMachine',
  //     // Receive events directly from live changes machine
  //     onDone: {
  //       actions: () => console.log('[AppInitMachine] Live changes machine completed')
  //     },
  //     onError: {
  //       actions: () => console.log('[AppInitMachine] Live changes machine error')
  //     }
  //   }
  // ],
  
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
          // Skip live_changes state (TypeORM disabled) and go directly to ready
          target: 'ready',
          actions: [
            'markSyncReady',
            'markSystemReady',
            () => console.log('[AppInitMachine] Received SYNC_LIVE from sync machine - skipping live changes (TypeORM disabled)')
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