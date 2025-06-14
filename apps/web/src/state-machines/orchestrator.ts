import { setup, assign, sendTo, fromPromise } from 'xstate';
import { connectionMachine } from './machines/connection-machine';
import { syncMachine } from './machines/sync-machine'; // Legacy - will be replaced
import { syncMachineV2 } from './machines/sync-machine-v2'; // New pure services implementation
import { liveChangesMachine } from './machines/live-changes-machine';
// Integrity functionality now integrated into sync-machine-v2
import { checkAuthActor, signInActor, signOutActor } from './auth-actors';
import type { UserInfo } from './types';
import { getSyncWebSocketUrl } from '../sync/config';

export interface OrchestratorContext {
  // Core auth state
  user: UserInfo | null;
  authToken: string | null;
  authError: string | null;
  sessionExpiry: string | null;
  
  // Core system state
  isDatabaseInitialized: boolean;
  databaseError: string | null;
  isOnline: boolean;
  
  // High-level sync state (only what orchestrator needs)
  isSyncLive: boolean;
  liveChangesActive: boolean;
  
  // Sync client metadata (consolidated from IndexedDBSyncStore)
  syncClientId: string;
  syncPendingChangesCount: number;
  syncLastSyncTime: Date | null;
  
  // 🔥 NEW: Persistent integrity baseline tracking
  integrityBaseline: {
    lastInitialSyncCompletedAt: number | null;
    lastFullValidationAt: number | null;
    recordChangesSinceBaseline: number;
    maxRecordsBeforeReset: number;
    validationStrategy: 'baseline_with_threshold';
    tableChangeCounts: Record<string, number>;
    lastCountUpdateAt: number | null;
  };
  
  // Detailed sync state (synchronized from sync machine v2)
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
  
  // System readiness
  isSystemReady: boolean;
  
  // Coordination state
  startupTime: number;
  lastActivity: number;
}

export type OrchestratorEvent =
  // System lifecycle
  | { type: 'START_SYSTEM' }
  | { type: 'SYSTEM_READY' }
  
  // Auth events
  | { type: 'SIGN_IN'; email: string; password: string }
  | { type: 'SIGN_OUT' }
  | { type: 'AUTH_SUCCESS'; user: UserInfo; token: string }
  | { type: 'AUTH_ERROR'; error: string }
  | { type: 'LOGIN_SUCCESS'; user: UserInfo; token: string }
  | { type: 'LOGOUT' }
  
  // Database events  
  | { type: 'DATABASE_READY' }
  | { type: 'DATABASE_ERROR'; error: string }
  
  // Critical system events (only what orchestrator needs to coordinate)
  | { type: 'CONNECTION_ONLINE' }
  | { type: 'CONNECTION_OFFLINE' }
  | { type: 'SYNC_INITIAL_START' }
  | { type: 'SYNC_CATCHUP_START' }
  | { type: 'SYNC_LIVE' }
  | { type: 'SYNC_ERROR'; error: string }
  | { type: 'LIVE_CHANGES_ACTIVE' }
  | { type: 'LIVE_CHANGES_ERROR'; error: string }
  
  // LSN updates from SyncManager
  | { type: 'LSN_UPDATE'; lsn: string }
  
  // Sync metadata updates (consolidated from IndexedDBSyncStore)
  | { type: 'SYNC_PENDING_CHANGES_UPDATE'; count: number }
  | { type: 'SYNC_LAST_SYNC_TIME_UPDATE'; timestamp: Date }
  | { type: 'SYNC_CLIENT_ID_RESET' }
  
  // Integrity coordination (simplified)
  | { type: 'INTEGRITY_RESET_REQUIRED'; reason: string }
  | { type: 'INTEGRITY_RESET_COMPLETED' }
  | { type: 'INTEGRITY_VALIDATION_SUCCESS' }
  
  // 🔥 NEW: Integrity baseline events
  | { type: 'INTEGRITY_BASELINE_UPDATE'; baseline: {
      lastInitialSyncCompletedAt: number | null;
      lastFullValidationAt: number | null;
      recordChangesSinceBaseline: number;
      tableChangeCounts: Record<string, number>;
      lastCountUpdateAt: number | null;
    }};

export const orchestrator = setup({
  types: {
    context: {} as OrchestratorContext,
    events: {} as OrchestratorEvent,
  },
  
  actors: {
    // Child machines
    connectionMachine,
    syncMachine, // Legacy - deprecated
    syncMachineV2, // New pure services implementation - includes integrity functionality
    liveChangesMachine,
    
    // Auth actors
    checkAuth: checkAuthActor,
    signIn: signInActor,
    signOut: signOutActor,
    
    // Database initialization
    initializeDatabase: fromPromise(async () => {
      return new Promise((resolve, reject) => {
        const handleReady = (event: CustomEvent) => {
          cleanup();
          console.log('[Orchestrator] Database ready');
          resolve({ success: true });
        };
        
        const handleError = (event: CustomEvent) => {
          cleanup();
          console.error('[Orchestrator] Database error:', event.detail);
          reject(new Error(event.detail.error || 'Database initialization failed'));
        };
        
        const cleanup = () => {
          window.removeEventListener('database:ready', handleReady as EventListener);
          window.removeEventListener('database:error', handleError as EventListener);
        };
        
        window.addEventListener('database:ready', handleReady as EventListener);
        window.addEventListener('database:error', handleError as EventListener);
        
        // Check if database is already ready
        const dbReadyEvent = new CustomEvent('database:check');
        window.dispatchEvent(dbReadyEvent);
      });
    }),
  },
  
  guards: {
    hasAuth: ({ context }) => !!(context.user && context.authToken),
    isOnline: ({ context }) => context.isOnline,
    isDatabaseReady: ({ context }) => context.isDatabaseInitialized,
    
    // Always require integrity validation for app initialization - ensures data consistency
    needsIntegrityValidation: ({ context }) => {
      // Always validate integrity during app initialization to ensure system health
      // Even fresh installs should verify database schema and basic integrity
      return true;
    },
  },
  
  actions: {
    // Auth actions
    storeAuthSuccess: assign({
      user: ({ event }) => {
        if (event.type === 'AUTH_SUCCESS' || event.type === 'LOGIN_SUCCESS') return event.user;
        return null;
      },
      authToken: ({ event }) => {
        if (event.type === 'AUTH_SUCCESS' || event.type === 'LOGIN_SUCCESS') return event.token;
        return null;
      },
      sessionExpiry: ({ event }) => {
        if (event.type === 'AUTH_SUCCESS' || event.type === 'LOGIN_SUCCESS') return (event as any).sessionExpiry || null;
        return null;
      },
      authError: null,
      lastActivity: () => Date.now(),
    }),
    
    storeAuthError: assign({
      authError: ({ event }) => 
        event.type === 'AUTH_ERROR' ? event.error : null,
      user: null,
      authToken: null,
      sessionExpiry: null,
      lastActivity: () => Date.now(),
    }),
    
    clearAuth: assign({
      user: null,
      authToken: null,
      authError: null,
      sessionExpiry: null,
      lastActivity: () => Date.now(),
    }),
    
    // Enhanced clear auth that triggers route re-evaluation
    clearAuthAndTriggerRouteCheck: assign({
      user: null,
      authToken: null,
      authError: null,
      sessionExpiry: null,
      lastActivity: () => Date.now(),
    }),
    
    // Action to invalidate auth cache and trigger route re-evaluation
    invalidateAuthAndTriggerRecheck: () => {
      console.log('[Orchestrator] Invalidating auth and triggering route re-evaluation...');
      
      // Clear persisted XState
      try {
        localStorage.removeItem('orchestrator-state');
        console.log('[Orchestrator] Cleared persisted XState');
      } catch (error) {
        console.warn('[Orchestrator] Failed to clear persisted state:', error);
      }
      
      // Dispatch event to signal that auth state has changed
      window.dispatchEvent(new CustomEvent('auth:state-changed', { 
        detail: { authenticated: false, reason: 'invalidate' }
      }));
    },
    
    handleSignInSuccess: assign({
      user: ({ event }) => {
        if ('output' in event && event.output && typeof event.output === 'object' && 'success' in event.output && event.output.success) {
          const authUser = (event.output as any).user;
          const userInfo: UserInfo = {
            id: authUser.id,
            email: authUser.email,
            name: authUser.name || authUser.email?.split('@')[0] || 'User',
            role: 'member',
            emailVerified: authUser.emailVerified || false,
            image: authUser.image,
          };
          return userInfo;
        }
        return null;
      },
      authToken: ({ event }) => {
        if ('output' in event && event.output && typeof event.output === 'object' && 'success' in event.output && event.output.success) {
          return (event.output as any).token || 'authenticated';
        }
        return null;
      },
      authError: null,
      lastActivity: () => Date.now(),
    }),
    
    // Database actions
    markDatabaseReady: assign({
      isDatabaseInitialized: true,
      databaseError: null,
      lastActivity: () => Date.now(),
    }),
    
    storeDatabaseError: assign({
      isDatabaseInitialized: false,
      databaseError: ({ event }) => 
        event.type === 'DATABASE_ERROR' ? event.error : null,
      lastActivity: () => Date.now(),
    }),
    
    // Connection actions
    markOnline: assign({
      isOnline: true,
      lastActivity: () => Date.now(),
    }),
    
    markOffline: assign({
      isOnline: false,
      lastActivity: () => Date.now(),
    }),
    
    // Sync coordination
    markSyncLive: assign({
      isSyncLive: true,
      lastActivity: () => Date.now(),
    }),
    
    markLiveChangesActive: assign({
      liveChangesActive: true,
      lastActivity: () => Date.now(),
    }),
    
    // System readiness
    markSystemReady: assign({
      isSystemReady: true,
      lastActivity: () => Date.now(),
    }),
    
    notifySystemReady: () => {
      console.log('[Orchestrator] 🎉 System ready for use');
      window.dispatchEvent(new CustomEvent('app:ready'));
    },
    
    // Child machine coordination
    startSync: sendTo('syncMachine', ({ context }) => {
      const currentLSN = context.syncState.currentLSN || '0/0';
      console.log(`[Orchestrator] 🚀 Starting sync with LSN: ${currentLSN}`);
      return {
        type: 'CONNECT',
        serverUrl: 'ws://127.0.0.1:8787/ws', // Default server URL
        clientId: context.syncClientId,
        currentLSN: currentLSN,
      };
    }),
    
    startLiveChanges: sendTo('liveChangesMachine', {
      type: 'START',
      entities: ['Task', 'Project', 'User', 'Comment']
    }),
    
    resetSystem: sendTo('syncMachine', ({ event }) => ({
      type: 'INTEGRITY_RESET_START',
      reason: event.type === 'INTEGRITY_RESET_REQUIRED' ? event.reason : 'System reset',
      resetType: 'full_reset'
    })),
    
    // Forward LSN updates to sync machine
    forwardLSNUpdate: sendTo('syncMachine', ({ event }) => ({
      type: 'LSN_UPDATE',
      lsn: event.type === 'LSN_UPDATE' ? event.lsn : '0/0'
    })),
    
    // 🔥 NEW: Update orchestrator's own LSN context when receiving LSN updates
    updateOrchestratorLSN: assign({
      syncState: ({ context, event }) => {
        const newLSN = event.type === 'LSN_UPDATE' ? event.lsn : context.syncState.currentLSN;
        console.log(`[Orchestrator] 📍 LSN Update: ${context.syncState.currentLSN} → ${newLSN}`);
        return {
          ...context.syncState,
          currentLSN: newLSN
        };
      },
      lastActivity: () => Date.now()
    }),
    
    // Sync metadata update actions (consolidated from IndexedDBSyncStore)
    updateSyncPendingCount: assign({
      syncPendingChangesCount: ({ event }) => 
        event.type === 'SYNC_PENDING_CHANGES_UPDATE' ? event.count : 0
    }),
    
    updateSyncLastSyncTime: assign({
      syncLastSyncTime: ({ event }) => 
        event.type === 'SYNC_LAST_SYNC_TIME_UPDATE' ? event.timestamp : null
    }),
    
    resetSyncClientId: assign({
      syncClientId: () => crypto.randomUUID(),
      syncPendingChangesCount: 0,
      syncLastSyncTime: null
    }),
    
    // Send validation request to sync machine using sendTo
    triggerIntegrityValidation: sendTo('syncMachine', ({ context }) => ({
      type: 'INTEGRITY_VALIDATE',
      reason: 'post-sync validation'
    })),
    
    // Log the integrity validation trigger
    logIntegrityTrigger: ({ context }) => {
      const currentLSN = context.syncState.currentLSN || '0/0';
      console.log(`[Orchestrator] 🔍 Sync live with LSN ${currentLSN} - triggering integrity validation`);
    },
    
    // Log when skipping integrity validation
    logIntegritySkip: ({ context }) => {
      const currentLSN = context.syncState.currentLSN || '0/0';
      console.log(`[Orchestrator] 🔄 Sync live with fresh LSN ${currentLSN} - skipping integrity validation`);
    },
    
    // 🔥 NEW: Integrity baseline management
    updateIntegrityBaseline: assign(({ event, context }) => {
      if (event.type === 'INTEGRITY_BASELINE_UPDATE') {
        console.log('[Orchestrator] 📊 Updating persistent integrity baseline:', event.baseline);
        return {
          integrityBaseline: {
            ...context.integrityBaseline,
            ...event.baseline
          },
          lastActivity: Date.now()
        };
      }
      return {};
    }),
    
    initializeIntegrityBaseline: assign(({ context }) => {
      console.log('[Orchestrator] 🔧 Initializing integrity baseline from sync machine');
      // Send current baseline to sync machine for synchronization
      return {
        lastActivity: Date.now()
      };
    }),
    
    logIntegrityBaseline: ({ context }) => {
      const baseline = context.integrityBaseline;
      if (baseline.lastInitialSyncCompletedAt) {
        const ageMs = Date.now() - baseline.lastInitialSyncCompletedAt;
        const ageHours = Math.round(ageMs / (1000 * 60 * 60));
        console.log(`[Orchestrator] 📊 Persistent baseline: ${ageHours}h old, ${baseline.recordChangesSinceBaseline} changes, threshold: ${baseline.maxRecordsBeforeReset}`);
      } else {
        console.log(`[Orchestrator] 📊 No persistent integrity baseline established yet`);
      }
    },
  }
}).createMachine({
  id: 'orchestrator',
  
  // Factory function for default context to ensure fresh instances
  context: (input: any) => {
    console.log('[Orchestrator] 🔍 Context factory called with input:', input);
    
    // 🔥 FIX: The input is nested as input.input.snapshot, not input.snapshot
    const actualInput = input?.input;
    const snapshot = actualInput?.snapshot;
    
    // If we're restoring from persisted state, validate and merge
    if (snapshot) {
      try {
        console.log('[Orchestrator] 🔍 Raw snapshot received:', snapshot);
        const restoredContext = snapshot.context;
        
        if (restoredContext && typeof restoredContext === 'object') {
          console.log('[Orchestrator] 🔄 Restoring context from persisted state');
          console.log(`[Orchestrator] 📥 Restoring LSN: ${restoredContext.syncState?.currentLSN}, ClientID: ${restoredContext.syncClientId}`);
          
          // Merge restored context with defaults to ensure all properties exist
          const restoredCtx = {
            // Core state - use restored or defaults
            user: restoredContext.user || null,
            authToken: restoredContext.authToken || null,
            authError: restoredContext.authError || null,
            sessionExpiry: restoredContext.sessionExpiry || null,
            
            isDatabaseInitialized: restoredContext.isDatabaseInitialized || false,
            databaseError: restoredContext.databaseError || null,
            isOnline: navigator.onLine, // Always use current online status
            
            isSyncLive: restoredContext.isSyncLive || false,
            liveChangesActive: restoredContext.liveChangesActive || false,
            
            // Sync client metadata - use restored or generate new
            syncClientId: restoredContext.syncClientId || crypto.randomUUID(),
            syncPendingChangesCount: restoredContext.syncPendingChangesCount || 0,
            syncLastSyncTime: restoredContext.syncLastSyncTime ? new Date(restoredContext.syncLastSyncTime) : null,
            
            // Initialize sync state with restored values or defaults
            syncState: {
              phase: restoredContext.syncState?.phase || null,
              progress: restoredContext.syncState?.progress || 0,
              currentLSN: restoredContext.syncState?.currentLSN || '0/0',
              error: restoredContext.syncState?.error || null,
              machineState: restoredContext.syncState?.machineState || 'idle',
              phaseProgress: {
                initial: { 
                  completedTables: restoredContext.syncState?.phaseProgress?.initial?.completedTables || 0, 
                  totalTables: restoredContext.syncState?.phaseProgress?.initial?.totalTables || 0, 
                  currentTable: restoredContext.syncState?.phaseProgress?.initial?.currentTable || null,
                  tablesRemaining: restoredContext.syncState?.phaseProgress?.initial?.tablesRemaining || []
                },
                catchup: { 
                  batchesProcessed: restoredContext.syncState?.phaseProgress?.catchup?.batchesProcessed || 0, 
                  changesProcessed: restoredContext.syncState?.phaseProgress?.catchup?.changesProcessed || 0, 
                  estimatedRemaining: restoredContext.syncState?.phaseProgress?.catchup?.estimatedRemaining || 0 
                },
                live: { 
                  messagesProcessed: restoredContext.syncState?.phaseProgress?.live?.messagesProcessed || 0, 
                  lastActivity: restoredContext.syncState?.phaseProgress?.live?.lastActivity || null,
                  throughputPerSec: restoredContext.syncState?.phaseProgress?.live?.throughputPerSec || 0 
                }
              }
            },
            
            // 🔥 NEW: Initialize integrity baseline with environment-specific threshold
            integrityBaseline: {
              lastInitialSyncCompletedAt: restoredContext.integrityBaseline?.lastInitialSyncCompletedAt || null,
              lastFullValidationAt: restoredContext.integrityBaseline?.lastFullValidationAt || null,
              recordChangesSinceBaseline: restoredContext.integrityBaseline?.recordChangesSinceBaseline || 0,
              maxRecordsBeforeReset: restoredContext.integrityBaseline?.maxRecordsBeforeReset || (() => {
                const env = typeof window !== 'undefined' ? 
                  (window as any).__VIBESTACK_ENV__ || 'development' : 
                  process.env.NODE_ENV || 'development';
                switch (env) {
                  case 'development': return 1000;
                  case 'testing': return 5000;
                  case 'production': return 25000;
                  default: return 10000;
                }
              })(),
              validationStrategy: 'baseline_with_threshold' as const,
              tableChangeCounts: restoredContext.integrityBaseline?.tableChangeCounts || {},
              lastCountUpdateAt: restoredContext.integrityBaseline?.lastCountUpdateAt || null
            },
            
            isSystemReady: restoredContext.isSystemReady || false,
            
            startupTime: restoredContext.startupTime || Date.now(),
            lastActivity: Date.now(), // Always use current time
          };
          
          console.log(`[Orchestrator] ✅ Context restored successfully - LSN: ${restoredCtx.syncState.currentLSN}, ClientID: ${restoredCtx.syncClientId}`);
          return restoredCtx;
        } else {
          console.warn('[Orchestrator] ⚠️ Invalid restoredContext structure:', restoredContext);
        }
      } catch (error) {
        console.warn('[Orchestrator] ⚠️ Failed to restore context, using defaults:', error);
      }
    } else {
      console.log('[Orchestrator] 🔍 No snapshot provided in input, using default context');
    }
    
    // Default context (fresh start)
    console.log('[Orchestrator] 🆕 Using default context');
    const defaultCtx = {
      // Core state only
      user: null,
      authToken: null,
      authError: null,
      sessionExpiry: null,
      
      isDatabaseInitialized: false,
      databaseError: null,
      isOnline: navigator.onLine,
      
      isSyncLive: false,
      liveChangesActive: false,
      
      // Sync client metadata - generate new for fresh start
      syncClientId: crypto.randomUUID(),
      syncPendingChangesCount: 0,
      syncLastSyncTime: null,
      
      // 🔥 NEW: Initialize integrity baseline for fresh start
      integrityBaseline: {
        lastInitialSyncCompletedAt: null,
        lastFullValidationAt: null,
        recordChangesSinceBaseline: 0,
        maxRecordsBeforeReset: (() => {
          const env = typeof window !== 'undefined' ? 
            (window as any).__VIBESTACK_ENV__ || 'development' : 
            process.env.NODE_ENV || 'development';
          switch (env) {
            case 'development': return 1000;
            case 'testing': return 5000;
            case 'production': return 25000;
            default: return 10000;
          }
        })(),
        validationStrategy: 'baseline_with_threshold' as const,
        tableChangeCounts: {},
        lastCountUpdateAt: null
      },
      
      // Initialize sync state
      syncState: {
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
      
      isSystemReady: false,
      
      startupTime: Date.now(),
      lastActivity: Date.now(),
    };
    
    console.log(`[Orchestrator] 🆕 Default context created - LSN: ${defaultCtx.syncState.currentLSN}, ClientID: ${defaultCtx.syncClientId}`);
    return defaultCtx;
  },
  
  initial: 'initializing', // Always start with initialization, even when restoring from persisted state
  
  states: {
    // Sequential initialization flow
    initializing: {
      initial: 'auth',
      
      // Spawn child machines immediately but don't coordinate until ready
      entry: () => {
        console.log('[Orchestrator] 🚀 Starting system initialization');
      },
      
      // Handle LSN updates during initialization
      on: {
        LSN_UPDATE: {
          actions: ['updateOrchestratorLSN', 'forwardLSNUpdate']
        }
      },
      
      invoke: [
        {
          id: 'connectionMachine',
          src: 'connectionMachine',
          onSnapshot: {
            actions: assign({
              isOnline: ({ event }) => event.snapshot.value === 'online'
            })
          }
        },
        {
          id: 'liveChangesMachine',
          src: 'liveChangesMachine',
          onSnapshot: {
            actions: ({ event }) => {
              // Log live changes machine state for debugging
              console.log('[Orchestrator] 📸 Live changes machine snapshot:', event.snapshot.value);
            }
          }
        },
        {
          id: 'syncMachine',
          src: 'syncMachineV2',
          onSnapshot: {
            actions: assign({
              syncState: ({ event, context }) => {
                const syncContext = event.snapshot.context;
                const state = event.snapshot.value as string;
                const status = event.snapshot.status;
                
                // 🔥 ENHANCED LOGGING: Track sync machine lifecycle
                console.log(`[Orchestrator] 📸 onSnapshot from sync machine v2 - Status: ${status}, State: ${state}, LSN: ${syncContext.currentLSN}, phase: ${syncContext.syncPhase}`);
                
                // 🚨 CRITICAL: Log if sync machine is stopping/stopped
                if (status === 'stopped' || status === 'done') {
                  console.error(`[Orchestrator] 🛑 SYNC MACHINE STOPPED! Status: ${status}, Final state: ${state}`);
                  console.error('[Orchestrator] 🛑 This explains why heartbeat messages are failing!');
                  
                  // Also log the context for debugging
                  console.error('[Orchestrator] 🛑 Sync machine context when stopped:', {
                    serviceRegistryKey: syncContext.serviceRegistryKey,
                    error: syncContext.error,
                    reconnectAttempts: syncContext.reconnectAttempts,
                    syncPhase: syncContext.syncPhase
                  });
                }
                
                // CRITICAL FIX: Don't override orchestrator's restored LSN with sync machine's default 0/0
                // Only update LSN if sync machine has been properly initialized (not idle with 0/0)
                const shouldUpdateLSN = state !== 'idle' || syncContext.currentLSN !== '0/0';
                const newLSN = shouldUpdateLSN ? syncContext.currentLSN : context.syncState.currentLSN;
                
                if (!shouldUpdateLSN && context.syncState.currentLSN !== '0/0') {
                  console.log(`[Orchestrator] 🔒 Preserving orchestrator LSN (${context.syncState.currentLSN}) - sync machine not ready (${state}, ${syncContext.currentLSN})`);
                }
                
                return {
                  phase: syncContext.syncPhase,
                  progress: 0, // Removed from sync machine context - calculate from phaseProgress if needed
                  currentLSN: newLSN,
                  error: syncContext.error,
                  machineState: state,
                  phaseProgress: syncContext.phaseProgress
                };
              }
            })
          }
        }
      ],
      
      states: {
        auth: {
          initial: 'checking',
          states: {
            checking: {
              invoke: {
                src: 'checkAuth',
                onDone: [
                  {
                    target: 'authenticated',
                    guard: ({ event }) => event.output.authenticated,
                    actions: assign({
                      user: ({ event }) => event.output.user || null,
                      authToken: ({ event }) => event.output.token || null,
                      sessionExpiry: ({ event }) => event.output.sessionExpiry || null,
                      authError: null,
                      lastActivity: () => Date.now(),
                    }),
                  },
                  { 
                    target: 'unauthenticated',
                    actions: assign({
                      user: null,
                      authToken: null,
                      sessionExpiry: null,
                      authError: ({ event }) => event.output.error || null,
                      lastActivity: () => Date.now(),
                    }),
                  },
                ],
                onError: {
                  target: 'unauthenticated',
                  actions: assign({
                    user: null,
                    authToken: null,
                    sessionExpiry: null,
                    authError: ({ event }) => (event.error as Error)?.message || 'Auth check failed',
                    lastActivity: () => Date.now(),
                  }),
                },
              },
            },
            
            unauthenticated: {
              on: {
                SIGN_IN: 'signing_in',
                AUTH_SUCCESS: {
                  target: 'authenticated',
                  actions: 'storeAuthSuccess'
                },
                LOGIN_SUCCESS: {
                  target: 'authenticated',
                  actions: 'storeAuthSuccess'
                }
              }
            },
            
            signing_in: {
              invoke: {
                src: 'signIn',
                input: ({ event }) => ({
                  email: event.type === 'SIGN_IN' ? event.email : '',
                  password: event.type === 'SIGN_IN' ? event.password : '',
                }),
                onDone: [
                  {
                    target: 'authenticated',
                    guard: ({ event }) => event.output.success,
                    actions: 'handleSignInSuccess'
                  },
                  {
                    target: 'unauthenticated',
                    actions: assign({
                      authError: ({ event }) => event.output.error || 'Sign-in failed',
                    })
                  }
                ],
                onError: {
                  target: 'unauthenticated',
                  actions: assign({
                    authError: ({ event }) => (event.error as Error)?.message || 'Sign-in failed',
                  })
                }
              }
            },
            
            authenticated: {
              always: {
                target: '#orchestrator.initializing.database'
              }
            }
          }
        },
        
        database: {
          invoke: {
            src: 'initializeDatabase',
            onDone: {
              target: 'sync',
              actions: 'markDatabaseReady'
            },
            onError: {
              target: 'error',
              actions: 'storeDatabaseError'
            }
          }
        },
        
        sync: {
          // Send CONNECT event to the globally-invoked sync machine
          entry: sendTo('syncMachine', ({ context }) => {
            const currentLSN = context.syncState.currentLSN || '0/0';
            console.log(`[Orchestrator] 🚀 Starting sync with LSN: ${currentLSN}`);
            
            // Use the imported sync WebSocket URL function
            const serverUrl = getSyncWebSocketUrl();
            console.log(`[Orchestrator] 🔗 Using WebSocket URL: ${serverUrl}`);
            
            return {
              type: 'CONNECT',
              serverUrl: serverUrl,
              clientId: context.syncClientId,
              currentLSN: currentLSN,
            };
          }),
          
          // Transition to monitoring sync when sync goes live
          on: {
            SYNC_INITIAL_START: {
              actions: [
                assign({ syncState: ({ context }) => ({ ...context.syncState, phase: 'initial' }) }),
                ({ }) => console.log('[Orchestrator] 📊 Sync phase: Initial sync started')
              ]
            },
            SYNC_CATCHUP_START: {
              actions: [
                assign({ syncState: ({ context }) => ({ ...context.syncState, phase: 'catchup' }) }),
                ({ }) => console.log('[Orchestrator] 📊 Sync phase: Catchup sync started')
              ]
            },
            SYNC_LIVE: [
              {
                target: 'validating_integrity',
                guard: 'needsIntegrityValidation',
                actions: ['markSyncLive', 'logIntegrityTrigger', 'triggerIntegrityValidation']
              },
              {
                target: 'starting_live_changes',
                actions: ['markSyncLive', 'logIntegritySkip']
              }
            ],
            SYNC_ERROR: {
              target: 'error'
            },
            CONNECTION_OFFLINE: {
              actions: 'markOffline'
              // Stay in sync state to maintain machine
            }
          }
        },
        
        validating_integrity: {
          entry: () => {
            console.log('[Orchestrator] 🔍 Waiting for integrity validation to complete...');
          },
          
          on: {
            // Wait for integrity validation to complete
            INTEGRITY_VALIDATION_SUCCESS: {
              target: 'starting_live_changes',
              actions: () => {
                console.log('[Orchestrator] ✅ Integrity validation passed - starting live changes');
              }
            },
            INTEGRITY_RESET_REQUIRED: {
              target: '#orchestrator.resetting',
              actions: 'resetSystem'
            },
            // 🔥 NEW: Handle baseline updates during validation
            INTEGRITY_BASELINE_UPDATE: {
              actions: [
                'updateIntegrityBaseline',
                'logIntegrityBaseline',
                () => console.log('[Orchestrator] 📡 Baseline updated during validation')
              ]
            },
            CONNECTION_OFFLINE: {
              target: 'sync',
              actions: 'markOffline'
            }
          }
        },
        
        starting_live_changes: {
          entry: 'startLiveChanges',
          
          on: {
            LIVE_CHANGES_ACTIVE: {
              target: '#orchestrator.ready',
              actions: [
                'markLiveChangesActive',
                'markSystemReady',
                'notifySystemReady'
              ]
            },
            LIVE_CHANGES_ERROR: {
              target: 'error'
            }
          }
        },
        
        error: {
          on: {
            START_SYSTEM: {
              target: 'database'
            }
          }
        }
      }
    },
    
    ready: {
      entry: () => {
        console.log('[Orchestrator] ✅ System fully operational');
      },
      
      on: {
        // LSN updates from SyncManager
        LSN_UPDATE: {
          actions: ['updateOrchestratorLSN', 'forwardLSNUpdate']
        },
        
        // Sync metadata updates (consolidated from IndexedDBSyncStore)
        SYNC_PENDING_CHANGES_UPDATE: {
          actions: 'updateSyncPendingCount'
        },
        SYNC_LAST_SYNC_TIME_UPDATE: {
          actions: 'updateSyncLastSyncTime'
        },
        SYNC_CLIENT_ID_RESET: {
          actions: 'resetSyncClientId'
        },
        
        // Auth management
        SIGN_OUT: 'signing_out',
        LOGOUT: 'signing_out',
        AUTH_ERROR: {
          target: 'initializing.auth.unauthenticated',
          actions: 'storeAuthError'
        },
        
        // System failures
        DATABASE_ERROR: {
          target: 'initializing.database',
          actions: 'storeDatabaseError'
        },
        CONNECTION_OFFLINE: {
          actions: 'markOffline'
          // Stay in ready state - sync/live changes will handle offline gracefully
        },
        CONNECTION_ONLINE: {
          actions: 'markOnline'
        },
        
        // Integrity reset
        INTEGRITY_RESET_REQUIRED: {
          target: 'resetting',
          actions: 'resetSystem'
        },
        
        // 🔥 NEW: Handle baseline updates in ready state
        INTEGRITY_BASELINE_UPDATE: {
          actions: [
            'updateIntegrityBaseline',
            'logIntegrityBaseline',
            () => console.log('[Orchestrator] 📡 Baseline updated and persisted')
          ]
        }
      }
    },
    
    signing_out: {
      invoke: {
        src: 'signOut',
        onDone: {
          target: 'initializing.auth.unauthenticated',
          actions: ['clearAuthAndTriggerRouteCheck', 'invalidateAuthAndTriggerRecheck']
        },
        onError: {
          target: 'initializing.auth.unauthenticated',
          actions: ['clearAuthAndTriggerRouteCheck', 'invalidateAuthAndTriggerRecheck']
        }
      }
    },
    
    resetting: {
      entry: () => {
        console.log('[Orchestrator] 🔄 System reset in progress...');
      },
      
      on: {
        INTEGRITY_RESET_COMPLETED: {
          target: 'initializing.sync',
          actions: () => {
            console.log('[Orchestrator] ✅ Reset completed - restarting sync');
          }
        }
      }
    }
  }
}); 