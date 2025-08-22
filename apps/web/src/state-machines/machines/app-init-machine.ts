import { setup, assign, fromPromise, sendTo } from 'xstate';
import { getSyncWebSocketUrl } from '../../sync/config';
import { getDomainEntityNames } from '@/lib/entity-registry';
// TODO: Replace with Legend State local data checking
// import { checkLocalLiveStoreData, shouldUseLocalDataImmediately, createLocalSchemaObject } from '@/lib/livestore-local-introspection';

export interface AppInitContext {
  // Database state
  isDatabaseInitialized: boolean;
  databaseError: string | null;
  
  // Connection state
  isOnline: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // Organization context
  organizationId: string | null;
  
  // Local data state
  hasLocalData: boolean;
  localDataChecked: boolean;
  localSchemaAvailable: boolean;
  
  // Simplified sync coordination (keep only what's needed for startup sequence)
  isSyncReady: boolean;
  syncError: string | null;
  liveChangesStatus: 'idle' | 'connecting' | 'connected' | 'error';
  
  // LiveStore state
  isLiveStoreReady: boolean;
  liveStoreError: string | null;
  
  // System ready state derived from machine state (not persisted)
  // All detailed sync state now managed by independent sync machine
  
  // Timing
  initStartTime: number;
  lastActivity: number;
}

export type AppInitEvent =
  | { type: 'START_INIT'; organizationId?: string }
  | { type: 'UPDATE_ORGANIZATION'; organizationId: string }
  | { type: 'RETRY_INIT' }
  | { type: 'RESTART_SYNC' }
  | { type: 'RESET' }
  | { type: 'SCHEMA_READY' }
  | { type: 'SCHEMA_ERROR'; error: string }
  | { type: 'DATABASE_READY' }
  | { type: 'DATABASE_ERROR'; error: string }
  | { type: 'CONNECTION_ONLINE' }
  | { type: 'CONNECTION_OFFLINE' }
  | { type: 'SYNC_LIVE' }
  | { type: 'SYNC_ERROR'; error: string }
  | { type: 'LIVESTORE_READY' }
  | { type: 'LIVESTORE_ERROR'; error: string }
  | { type: 'LIVE_CHANGES_ACTIVE' }
  | { type: 'LIVE_CHANGES_ERROR'; error: string };

// No auth-aware reset needed - machine will start fresh each login through events

// Actor for checking local LiveStore data
const checkLocalDataActor = fromPromise(async ({ input }: { input: { organizationId: string } }) => {
  // console.log('[AppInitMachine] 🔍 Checking for local LiveStore data...');
  
  if (!input.organizationId) {
    throw new Error('Organization ID required for local data check');
  }

  // TODO: Replace with Legend State local data checking
  // console.log(`[AppInitMachine] 📊 Skipping local data check - LiveStore removed, transitioning to Legend State`);
  
  // Create placeholder local data object for compatibility
  const localData = {
    hasLocalData: false,
    schema: { entityCount: 0, tables: [], exists: false, lastModified: null, storeVersion: null }
  };
  
  // For now, always indicate no local data (we'll implement Legend State local cache later)
  const shouldUseLocal = false;

  // Skip local schema dispatch since we're removing LiveStore
  if (shouldUseLocal) {
    // TODO: Implement Legend State local schema
    // console.log(`[AppInitMachine] ✅ Using local schema immediately`);
    
    // Dispatch local schema ready event so components can use it
    window.dispatchEvent(new CustomEvent('schema:local-ready', {
      detail: { 
        schema: null, // TODO: Replace with Legend State schema
        localData: null, // TODO: Replace with Legend State data
        source: 'local-cache'
      }
    }));
    
    return {
      hasLocalData: true,
      localSchema,
      localDataSummary: localData,
      shouldUseLocal: true
    };
  } else {
    console.log(`[AppInitMachine] ⏳ No usable local data found, will need to wait for API schema`);
    return {
      hasLocalData: false,
      localSchema: null,
      localDataSummary: localData,
      shouldUseLocal: false
    };
  }
});

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

// Actor for waiting for LiveStore ready event
const waitForLiveStoreActor = fromPromise(async () => {
  console.log('[AppInitMachine] Waiting for LiveStore initialization...');
  
  return new Promise((resolve, reject) => {
    const handleReady = (event: CustomEvent) => {
      cleanup();
      console.log('[AppInitMachine] LiveStore ready event received');
      resolve({ success: true });
    };
    
    const handleError = (event: CustomEvent) => {
      cleanup();
      console.error('[AppInitMachine] LiveStore error event received:', event.detail);
      reject(new Error(event.detail.error || 'LiveStore initialization failed'));
    };
    
    const cleanup = () => {
      window.removeEventListener('livestore:ready', handleReady as EventListener);
      window.removeEventListener('livestore:error', handleError as EventListener);
    };
    
    window.addEventListener('livestore:ready', handleReady as EventListener);
    window.addEventListener('livestore:error', handleError as EventListener);
    
    // Trigger LiveStore initialization
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('livestore:init'));
    }, 100);
  });
});

export const appInitMachine = setup({
  types: {
    context: {} as AppInitContext,
    events: {} as AppInitEvent,
  },
  
  actors: {
    checkLocalData: checkLocalDataActor,
    waitForDatabase: waitForDatabaseActor,
    waitForLiveStore: waitForLiveStoreActor,
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
    
    markLiveStoreReady: assign({
      isLiveStoreReady: true,
      liveStoreError: null,
      lastActivity: () => Date.now(),
    }),
    
    storeLiveStoreError: assign({
      liveStoreError: ({ event }) => 
        event.type === 'LIVESTORE_ERROR' ? event.error : 'LiveStore initialization failed',
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
    
    markLocalDataChecked: assign({
      localDataChecked: true,
      hasLocalData: ({ event }) => event.output?.hasLocalData || false,
      localSchemaAvailable: ({ event }) => event.output?.shouldUseLocal || false,
      lastActivity: () => Date.now(),
    }),

    resetSystem: assign({
      isDatabaseInitialized: false,
      databaseError: null,
      hasLocalData: false,
      localDataChecked: false,
      localSchemaAvailable: false,
      isSyncReady: false,
      syncError: null,
      isLiveStoreReady: false,
      liveStoreError: null,
      lastActivity: () => Date.now(),
    }),
    
    // Child machines automatically stopped when leaving states

    // No longer needed - using event-driven initialization
    
    startSync: ({ context }: { context: AppInitContext }) => {
      // console.log('[AppInitMachine] Starting pure LiveStore sync machine with org context:', {
      //   organizationId: context.organizationId
      // })
      
      // Get user ID from auth machine
      const authMachineActor = (window as any).authMachineActor
      let userId = 'current-user-id' // fallback
      
      if (authMachineActor) {
        const authSnapshot = authMachineActor.getSnapshot()
        userId = authSnapshot?.context?.user?.id || userId
        // console.log('[AppInitMachine] Got user ID from auth machine:', userId)
      } else {
        console.warn('[AppInitMachine] Auth machine actor not available, using fallback user ID')
      }
      
      const simpleNotificationSyncMachineActor = (window as any).simpleNotificationSyncMachineActor
      if (simpleNotificationSyncMachineActor) {
        console.log('[AppInitMachine] 🔗 Sending CONNECT event to simple notification sync machine', {
          organizationId: context.organizationId,
          userId: userId
        })
        simpleNotificationSyncMachineActor.send({ 
          type: 'CONNECT', 
          organizationId: context.organizationId,
          userId: userId
        })
      } else {
        console.warn('[AppInitMachine] Simple notification sync machine actor not available')
      }
    },
    
    setOrganizationId: assign({
      organizationId: ({ event }: { event: AppInitEvent }) => {
        const orgId = (event as any).organizationId || null
        console.log('[AppInitMachine] Setting organization ID:', orgId)
        return orgId
      }
    }),
    
    updateOrganizationId: assign({
      organizationId: ({ event }: { event: AppInitEvent }) => {
        const orgId = (event as any).organizationId
        console.log('[AppInitMachine] Updating organization ID:', orgId)
        return orgId
      }
    }),
    
    startLiveStore: () => {
      // console.log('[AppInitMachine] Starting LiveStore initialization');
      // Dispatch event to trigger LiveStore initialization
      window.dispatchEvent(new CustomEvent('livestore:init'));
    },
    
    startLiveChanges: () => {
      // Live changes handled by Dexie
      console.log('[AppInitMachine] Live changes handled by Dexie');
    },

    loadOrgSchemaIfNeeded: async ({ context }) => {
      if (!context.organizationId) {
        console.log('[AppInitMachine] 🚫 No organization ID - cannot load schema');
        return;
      }

      try {
        console.log('[AppInitMachine] 📋 Loading organization schema...', context.organizationId);
        
        // Import the schema client dynamically to avoid import cycles
        const { orgSchemaClient } = await import('@/lib/schema-client');
        
        // Load schema - this will trigger the SCHEMA_READY event notification
        const result = await orgSchemaClient.loadOrgSchema(context.organizationId);
        
        if (!result.success) {
          console.error('[AppInitMachine] ❌ Schema loading failed:', result.error);
          // The schema client should have already dispatched SCHEMA_ERROR event
        } else {
          console.log('[AppInitMachine] ✅ Schema loading initiated for org:', context.organizationId);
        }
      } catch (error) {
        console.error('[AppInitMachine] ❌ Schema loading error:', error);
        // Dispatch error event if schema client didn't handle it
        const appInitActor = (window as any).appInitActor;
        if (appInitActor) {
          appInitActor.send({ type: 'SCHEMA_ERROR', error: 'Schema loading failed' });
        }
      }
    },
    
    startBackgroundInitialization: ({ context }) => {
      console.log('[AppInitMachine] 🚀 Starting background processes (DB + Sync) in parallel');
      
      // Start database initialization in background
      setTimeout(() => {
        console.log('[AppInitMachine] 📊 Background: Starting database initialization');
        window.dispatchEvent(new CustomEvent('database:init'));
      }, 0);
      
      // Start sync after a brief delay to allow database to begin
      setTimeout(() => {
        console.log('[AppInitMachine] 🔄 Background: Starting sync with org context');
        
        // Get user ID from auth machine
        const authMachineActor = (window as any).authMachineActor
        let userId = 'current-user-id' // fallback
        
        if (authMachineActor) {
          const authSnapshot = authMachineActor.getSnapshot()
          userId = authSnapshot?.context?.user?.id || userId
          console.log('[AppInitMachine] Background sync - Got user ID from auth machine:', userId)
        }
        
        const simpleNotificationSyncMachineActor = (window as any).simpleNotificationSyncMachineActor;
        if (simpleNotificationSyncMachineActor && context.organizationId) {
          console.log('[AppInitMachine] 🔗 Background sync - Sending CONNECT event to simple notification sync machine', {
            organizationId: context.organizationId,
            userId: userId
          })
          simpleNotificationSyncMachineActor.send({ 
            type: 'CONNECT', 
            organizationId: context.organizationId,
            userId: userId
          });
        }
      }, 100);
    },
  },
}).createMachine({
  id: 'appInitMachine',
  initial: 'idle',
  
  // Machine starts in idle and waits for START_INIT event
  
  context: ({ input }: { input?: { persistedData?: Partial<AppInitContext> } }) => {
    // 🚀 OPTIMIZED: Check for cached org data to skip some initialization steps
    let cachedOrgId = null;
    let hasLocalSchema = false;
    
    try {
      // Check if we have cached organization schema
      const authState = localStorage.getItem('auth-machine-state');
      if (authState) {
        const parsed = JSON.parse(authState);
        cachedOrgId = parsed?.context?.currentOrganization?.id;
      }
      
      // Check if we have cached schema for this org
      if (cachedOrgId) {
        const schemaKey = `vibestack-schema-${cachedOrgId}`;
        const cachedSchema = localStorage.getItem(schemaKey);
        if (cachedSchema) {
          const schema = JSON.parse(cachedSchema);
          // Check if schema is recent (less than 1 hour old)
          if (schema.timestamp && Date.now() - schema.timestamp < 60 * 60 * 1000) {
            hasLocalSchema = true;
            console.log('[AppInitMachine] Found cached schema for org:', cachedOrgId);
          }
        }
      }
    } catch (error) {
      // Ignore cache errors
    }
    
    return {
      isDatabaseInitialized: false,
      databaseError: null,
      isOnline: navigator.onLine,
      connectionStatus: 'disconnected' as const,
      organizationId: cachedOrgId,
      hasLocalData: false,
      localDataChecked: false,
      localSchemaAvailable: hasLocalSchema,
      isSyncReady: false,
      syncError: null,
      isLiveStoreReady: false,
      liveStoreError: null,
      liveChangesStatus: 'idle' as const,
      initStartTime: Date.now(),
      lastActivity: Date.now(),
    };
  },
  
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
    
    UPDATE_ORGANIZATION: {
      actions: 'updateOrganizationId'
    },
  },
  
  states: {
    idle: {
      entry: () => console.log('[AppInitMachine] Waiting for initialization trigger'),
      on: {
        START_INIT: {
          target: 'checkingLocalData',
          actions: 'setOrganizationId'
        },
        RESET: {
          actions: ['resetSystem', () => console.log('[AppInitMachine] 🔄 System reset to idle state')]
        }
      }
    },

    checkingLocalData: {
      entry: () => console.log('[AppInitMachine] 🔍 Checking for local LiveStore data...'),
      invoke: {
        src: 'checkLocalData',
        input: ({ context }) => ({ organizationId: context.organizationId! }),
        onDone: [
          {
            // Local data available - go to ready immediately
            target: 'ready',
            guard: ({ event }) => event.output?.shouldUseLocal === true,
            actions: [
              'markLocalDataChecked',
              () => console.log('[AppInitMachine] 🚀 Local data available! Dashboard ready immediately'),
              'startBackgroundInitialization',
              'markSystemReady'
            ]
          },
          {
            // No local data - need to wait for API schema
            target: 'waitingForSchema',
            actions: [
              'markLocalDataChecked',
              () => console.log('[AppInitMachine] ⏳ No local data, waiting for API schema...')
            ]
          }
        ],
        onError: {
          // Error checking local data - fallback to API schema
          target: 'waitingForSchema',
          actions: [
            () => console.warn('[AppInitMachine] ⚠️ Error checking local data, falling back to API schema'),
            assign({
              localDataChecked: true,
              hasLocalData: false,
              localSchemaAvailable: false
            })
          ]
        }
      }
    },

    waitingForSchema: {
      entry: ['loadOrgSchemaIfNeeded', () => console.log('[AppInitMachine] 📋 Loading API schema...')],
      on: {
        SCHEMA_READY: {
          target: 'ready',
          actions: [
            () => console.log('[AppInitMachine] ✅ API schema loaded - starting background initialization'),
            'startBackgroundInitialization',
            'markSystemReady'
          ]
        },
        SCHEMA_ERROR: {
          target: 'error',
          actions: assign({
            syncError: ({ event }) => event.error || 'Schema loading failed - cannot proceed'
          })
        }
      }
    },
    
    livestore: {
      entry: () => console.log('[AppInitMachine] Starting LiveStore initialization'),
      
      invoke: {
        src: 'waitForLiveStore',
        onDone: {
          target: 'ready',
          actions: [
            'markLiveStoreReady',
            'markSystemReady',
            () => console.log('[AppInitMachine] LiveStore initialization completed - system fully ready')
          ]
        },
        onError: {
          target: 'error',
          actions: assign({
            liveStoreError: ({ event }) => (event.error as Error)?.message || 'LiveStore initialization failed'
          })
        }
      },
      
      on: {
        LIVESTORE_READY: {
          target: 'ready',
          actions: [
            'markLiveStoreReady',
            'markSystemReady',
            () => console.log('[AppInitMachine] Received LIVESTORE_READY event - system fully ready')
          ]
        },
        LIVESTORE_ERROR: {
          target: 'error',
          actions: 'storeLiveStoreError'
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
      entry: () => console.log('[AppInitMachine] 🎉 System ready! Dashboard can show with loading states for background processes'),
      
      on: {
        // Background processes can complete at any time
        DATABASE_READY: {
          actions: ['markDatabaseReady', () => console.log('[AppInitMachine] 📊 Background: Database ready')]
        },
        DATABASE_ERROR: {
          actions: ['storeDatabaseError', () => console.log('[AppInitMachine] ⚠️ Background: Database error (continuing with cached data)')]
        },
        SYNC_LIVE: {
          actions: ['markSyncReady', () => console.log('[AppInitMachine] 🔄 Background: Sync live')]
        },
        SYNC_ERROR: {
          actions: ['storeSyncError', () => console.log('[AppInitMachine] ⚠️ Background: Sync error (showing offline mode)')]
        },
        LIVESTORE_READY: {
          actions: ['markLiveStoreReady', () => console.log('[AppInitMachine] 📦 Background: LiveStore ready')]
        },
        LIVESTORE_ERROR: {
          actions: ['storeLiveStoreError', () => console.log('[AppInitMachine] ⚠️ Background: LiveStore error')]
        },
        
        RESTART_SYNC: {
          actions: ['startSync', () => console.log('[AppInitMachine] 🔄 Restarting sync in background')]
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
    
    error: {
      entry: () => console.log('[AppInitMachine] Initialization error'),
      
      on: {
        RETRY_INIT: {
          target: 'idle',
          actions: 'resetSystem'
        },
        START_INIT: {
          target: 'checkingLocalData',
          actions: 'setOrganizationId'
        },
        RESET: {
          target: 'idle',
          actions: ['resetSystem', () => console.log('[AppInitMachine] 🔄 System reset to idle state')]
        }
      }
    }
  },
});