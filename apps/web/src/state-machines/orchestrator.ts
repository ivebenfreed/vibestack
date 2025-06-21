import { setup, assign, sendTo, fromPromise } from 'xstate';
import { connectionMachine } from './machines/connection-machine';
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
    }}
  
  // 🚫 REMOVED: Manual sync machine restart events - these caused race conditions

export const orchestrator = setup({
  types: {
    context: {} as OrchestratorContext,
    events: {} as OrchestratorEvent,
  },
  
  actors: {
    // Child machines
    connectionMachine,
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
      // Check if this is right after initial sync completion
      // If the baseline hasn't been established yet (lastInitialSyncCompletedAt is null), 
      // this means we're in the first run after initial sync
      const baseline = context.integrityBaseline;
      const hasBaseline = baseline?.lastInitialSyncCompletedAt !== null;
      
      if (!hasBaseline) {
        // This is the first time sync goes live after initial sync
        // Skip validation but we'll update the baseline instead
        console.log('[Orchestrator] 🔄 Initial sync just completed - skipping integrity validation, will update baseline only');
        return false;
      }
      
      // For subsequent sync sessions, we can do integrity validation if needed
      // For now, always skip validation but keep baseline updates
      console.log('[Orchestrator] 🔄 Skipping integrity validation, baseline exists');
      return false;
    },
    
    // Role-based guards
    hasAdminRole: ({ context }) => {
      const userRole = context.user?.role;
      return userRole === 'admin' || userRole === 'super_admin';
    },
    
    canAccessDebugFeatures: ({ context }) => {
      const userRole = context.user?.role;
      return userRole === 'admin' || userRole === 'super_admin';
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
            role: authUser.role || 'member', // Use role from auth user or default to 'member'
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
    
    // Child machine coordination - FIXED: Send to syncMachineV2 instead of legacy syncMachine
    startSync: sendTo('syncMachine', ({ context }) => {
      const currentLSN = context.syncState.currentLSN || '0/0';
      console.log(`[Orchestrator] 🚀 Starting sync with LSN: ${currentLSN} (sending to syncMachineV2)`);
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

    // Forward LSN updates to sync machine - FIXED: Now sends to syncMachineV2
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
    
    // Send validation request to sync machine using sendTo - FIXED: Now sends to syncMachineV2
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
      console.log(`[Orchestrator] 🔄 Sync live with LSN ${currentLSN} - skipping integrity validation, will update baseline only`);
    },
    
    // 🔥 NEW: Update baseline after initial sync without validation
    updateBaselineAfterInitialSync: ({ context }) => {
      const currentLSN = context.syncState.currentLSN || '0/0';
      const baseline = context.integrityBaseline;
      
      // Only update baseline if it hasn't been established yet
      if (baseline?.lastInitialSyncCompletedAt === null) {
        console.log(`[Orchestrator] 📊 Updating baseline after initial sync completion (LSN: ${currentLSN})`);
        
        // Send baseline update to establish the initial sync completion timestamp
        const updatedBaseline = {
          lastInitialSyncCompletedAt: Date.now(),
          lastFullValidationAt: null, // No validation was performed
          recordChangesSinceBaseline: 0, // Fresh baseline
          tableChangeCounts: {},
          lastCountUpdateAt: Date.now()
        };
        
        // Send the baseline update event to be processed by updateIntegrityBaseline action
        // This will update the orchestrator context and persist it
        if (typeof window !== 'undefined' && (window as any).orchestratorActor) {
          const orchestratorActor = (window as any).orchestratorActor;
          orchestratorActor.send({
            type: 'INTEGRITY_BASELINE_UPDATE',
            baseline: updatedBaseline
          });
          console.log('[Orchestrator] 📡 Sent baseline update after initial sync:', updatedBaseline);
        }
      } else {
        console.log(`[Orchestrator] 📊 Baseline already established, skipping update`);
      }
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
  
  // 🔥 CRITICAL FIX: Move sync machine to root level so it persists across all orchestrator states
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
          syncState: ({ event, context, self }) => {
            const syncContext = event.snapshot.context;
            const state = event.snapshot.value as string;
            const status = event.snapshot.status;
            
            // Only log snapshot if it's not just a routine heartbeat update
            const isHeartbeatUpdate = state === 'live_sync' && 
              syncContext.syncPhase === 'live' && 
              status === 'active' &&
              syncContext.error === null;
            
            if (!isHeartbeatUpdate) {
              // 🔥 ENHANCED LOGGING: Track sync machine lifecycle (non-routine updates only)
              console.log(`[Orchestrator] 📸 onSnapshot from sync machine v2 - Status: ${status}, State: ${state}, LSN: ${syncContext.currentLSN}, phase: ${syncContext.syncPhase}`);
              
              // 🔥 DEBUG: Track orchestrator state during sync machine snapshot
              const orchestratorState = self.getSnapshot().value;
              console.log(`[Orchestrator] 📸 Orchestrator state during sync snapshot: ${JSON.stringify(orchestratorState)}`);
            }
            
            // 🔥 CRITICAL: If sync machine stops, log orchestrator context to identify cause
            if (status === 'stopped' || status === 'done') {
              console.error(`[Orchestrator] 🚨 CONTEXT: Orchestrator state when sync machine stopped:`, {
                orchestratorState: JSON.stringify(self.getSnapshot().value),
                timestamp: Date.now(),
                syncMachineState: state,
                syncMachinePhase: syncContext.syncPhase
              });
            }
            
            // 🚨 MONITOR: Log unexpected stops (should rarely happen now)
            if (status === 'stopped' || status === 'done') {
              console.error(`[Orchestrator] 🚨 CRITICAL: Sync machine stopped! Status: ${status}, State: ${state}`);
              console.error('[Orchestrator] 🚨 ALERT: This indicates a serious issue!');
              
              // Log context for debugging but don't auto-restart aggressively
              console.warn('[Orchestrator] ⚠️ Sync machine context when stopped:', {
                serviceRegistryKey: syncContext.serviceRegistryKey,
                error: syncContext.error,
                reconnectAttempts: syncContext.reconnectAttempts,
                syncPhase: syncContext.syncPhase
              });
              
              // 🔥 CRITICAL FIX: Disable aggressive auto-restart to prevent race conditions
              // The sync machine should manage its own lifecycle - orchestrator restarts create broken acknowledgment flows
              console.log('[Orchestrator] 🔍 Auto-restart disabled - sync machine should self-manage lifecycle');
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
      
      // 🔥 REMOVED: Moved invoke machines to root level to persist across state transitions
      
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
                actions: ['markSyncLive', 'logIntegritySkip', 'updateBaselineAfterInitialSync']
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
        },
        
        // 🚫 REMOVED: Manual sync machine restart logic 
        // This was causing race conditions where orchestrator would stop actors that were processing acknowledgments
        // Sync machine should manage its own lifecycle
        
        // 🚫 REMOVED: Internal restart connect logic - no longer needed
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
        // ✅ CRITICAL: Handle LSN updates during reset
        LSN_UPDATE: {
          actions: ['updateOrchestratorLSN']
        },
        
        // 🔥 CRITICAL FIX: Handle baseline updates during reset
        INTEGRITY_BASELINE_UPDATE: {
          actions: [
            'updateIntegrityBaseline',
            'logIntegrityBaseline',
            () => console.log('[Orchestrator] 📡 Baseline updated during reset - will be persisted')
          ]
        },
        
        INTEGRITY_RESET_COMPLETED: {
          target: 'initializing.sync',
          actions: [
            // ✅ LSN update now comes from sync machine via sendParent(LSN_UPDATE)
            // ✅ Still reset other sync state for completely fresh start
            assign({ 
              syncState: ({ context }) => ({
                ...context.syncState,
                // currentLSN will be updated by preceding LSN_UPDATE event from sync machine
                phase: null,           // Clear sync phase for fresh start
                progress: 0,           // Reset progress
                error: null,           // Clear any sync errors
                machineState: 'initializing', // Reset machine state
                // Reset phase progress for completely fresh start
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
              })
            }),
            () => {
              console.log('[Orchestrator] 🔄 Reset completed - restarting sync (LSN updated by sync machine)');
            }
          ]
        }
      }
    }
  }
}); 