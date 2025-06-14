import { setup, assign, fromPromise, sendParent } from 'xstate';
import type { AppContext, AppEvent, UserInfo } from './types';
import { checkAuthActor, signInActor, signOutActor, validateTokenActor } from './auth-actors';

export const appMachine = setup({
  types: {
    context: {} as AppContext,
    events: {} as AppEvent,
  },
  actors: {
    // 🔥 Real auth actors using better-auth
    checkAuth: checkAuthActor,
    signIn: signInActor,
    signOut: signOutActor,
    validateAuth: validateTokenActor,
    
    // Database initialization - listens to PGlite provider events
    initializeDatabase: fromPromise(async () => {
      return new Promise((resolve, reject) => {
        const handleReady = (event: CustomEvent) => {
          cleanup();
          console.log('[XSTATE] Database ready event received:', event.detail);
          resolve({ success: true, ...event.detail });
        };
        
        const handleError = (event: CustomEvent) => {
          cleanup();
          console.error('[XSTATE] Database error event received:', event.detail);
          reject(new Error(event.detail.error || 'Database initialization failed'));
        };
        
        const cleanup = () => {
          window.removeEventListener('database:ready', handleReady as EventListener);
          window.removeEventListener('database:error', handleError as EventListener);
        };
        
        window.addEventListener('database:ready', handleReady as EventListener);
        window.addEventListener('database:error', handleError as EventListener);
        
        // Check if database is already ready (race condition protection)
        const dbReadyEvent = new CustomEvent('database:check');
        window.dispatchEvent(dbReadyEvent);
      });
    }),
    
    // Sync coordination - REAL sync actor that bridges with SyncManager
    runSync: fromPromise(async ({ input, self }: { input: { syncId: string }, self: any }) => {
      return new Promise(async (resolve, reject) => {
        try {
          // Get SyncManager instance
          const { SyncManager } = await import('@/sync/SyncManager');
          const syncManager = SyncManager.getInstance();
          
          const handleSyncStatusChange = (status: any) => {
            console.log('[XSTATE] Sync status changed to:', status);
            if (status === 'live') {
              cleanup();
              console.log('[XSTATE] Sync completed - reached live state');
              resolve({ syncId: input.syncId, status: 'live' });
            }
          };
          
          const handleSyncError = (error: any) => {
            cleanup();
            console.error('[XSTATE] Sync failed:', error);
            reject(new Error(error?.message || 'Sync failed'));
          };
          
          // 🔥 NEW: Handle granular sync events from websocket manager
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
          
          // 🔥 NEW: Listen for granular sync events
          syncManager.on('sync:message', handleSyncMessage);
          syncManager.on('incoming_changes_processed', handleIncomingChangesProcessed);
          
          // Check if sync is already live (race condition protection)
          const currentStatus = syncManager.getStatus();
          console.log('[XSTATE] Current sync status:', currentStatus);
          if (currentStatus === 'live') {
            cleanup();
            console.log('[XSTATE] Sync already live - resolving immediately');
            resolve({ syncId: input.syncId, status: 'live' });
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
    
    // Integrity validation after sync completion
    validateIntegrity: fromPromise(async ({ input }: { input: { context: AppContext } }) => {
      console.log('[XState] 🔍 Starting integrity validation after sync completion');
      
      // Safety check: skip if LSN is 0/0 (shouldn't reach here due to guard, but just in case)
      if (input.context.currentLSN === '0/0') {
        console.log('[XState] 🔄 Skipping integrity validation - LSN is 0/0 (fresh start)');
        return { validated: true, skipped: true };
      }
      
      try {
        // Get SyncManager instance to access IntegrityManager
        const { SyncManager } = await import('@/sync/SyncManager');
        const syncManager = SyncManager.getInstance();
        const integrityManager = syncManager.getIntegrityManager();
        
        // Request integrity validation from server
        const result = await integrityManager.requestIntegrityValidation();
        
        console.log('[XState] ✅ Integrity validation completed successfully', result);
        return { validated: true, result };
        
      } catch (error) {
        console.error('[XState] ❌ Integrity validation failed:', error);
        // Don't throw - we want to continue even if integrity check fails
        return { validated: false, error: error instanceof Error ? error.message : String(error) };
      }
    }),

    // Gap-triggered integrity validation (for heartbeat/reconnect scenarios)
    validateIntegrityFromGap: fromPromise(async ({ input }: { input: { reason: string; context: AppContext } }) => {
      console.log(`[XState] 🔍 Starting gap-triggered integrity validation: ${input.reason}`);
      
      try {
        // Get SyncManager instance to access IntegrityManager
        const { SyncManager } = await import('@/sync/SyncManager');
        const syncManager = SyncManager.getInstance();
        const integrityManager = syncManager.getIntegrityManager();
        
        // Request integrity validation from server
        const result = await integrityManager.requestIntegrityValidation();
        
        console.log(`[XState] ✅ Gap-triggered integrity validation completed: ${input.reason}`, result);
        
        // If validation failed and server recommends reset, trigger it
        if (!result.isValid && result.recommendedAction === 'reset') {
          console.warn('[XState] 🚨 Integrity issues detected - server recommends reset');
          // Trigger integrity reset with the gap reason
          return { 
            validated: false, 
            shouldReset: true, 
            resetReason: `Gap-triggered validation failed: ${input.reason}`,
            result 
          };
        }
        
        return { validated: result.isValid, result };
        
      } catch (error) {
        console.error(`[XState] ❌ Gap-triggered integrity validation failed (${input.reason}):`, error);
        return { validated: false, error: error instanceof Error ? error.message : String(error) };
      }
    }),

    // Live changes management
    manageLiveChanges: fromPromise(async () => {
      console.log('[XState] 🔄 Starting live changes initialization via LiveChangesManager...');
      
      try {
        // Import the live changes manager and config
        const { liveChangesManager } = await import('@/lib/live-changes-manager');
        const { getLiveChangesEntities } = await import('@/lib/live-changes-config');
        
        // Get the entity configs for all domain entities (Task, Project, User, Comment)
        const entityConfigs = await getLiveChangesEntities();
        console.log(`[XState] 🔍 Initializing live changes for ${entityConfigs.length} entities:`, 
          entityConfigs.map(config => config.entity.name).join(', '));
        
        // Get datasource from global datasource since XState has coordinated readiness
        const { getGlobalDataSource } = await import('@/db/global-datasource');
        const dataSource = await getGlobalDataSource();
        
        // Initialize live changes with all entities
        await liveChangesManager.initialize(entityConfigs, dataSource);
        
        console.log('[XState] ✅ Live changes initialization completed successfully');
        return { active: true };
        
      } catch (error) {
        console.error('[XState] ❌ Live changes initialization failed:', error);
        throw error;
      }
    }),
  },
  guards: {
    // Auth guards
    hasValidAuth: ({ context }: { context: AppContext }) => 
      !!context.user && !!context.authToken,
    
    hasUserCache: ({ context }: { context: AppContext }) => 
      !!context.lastKnownUser,
    
    // Check if database is ready for sync
    isDatabaseReady: ({ context }: { context: AppContext }) => 
      context.isDatabaseInitialized,
    
    // Check if sync can transition to live (needs auth + database + integrity validation)
    canEnableLiveChanges: ({ context }: { context: AppContext }) => 
      context.isDatabaseInitialized && 
      !!context.user && 
      !context.syncError &&
      context.isSyncLive &&
      !context.isIntegrityValidationInProgress,
    
    // Check overall app readiness (auth + database + sync)
    isAppReady: ({ context }: { context: AppContext }) => 
      context.isDatabaseInitialized && 
      !!context.user &&
      context.syncProgress >= 100,
    
    // Check if sync can start (needs auth + database + connection)
    canStartSync: ({ context }: { context: AppContext }) =>
      context.isOnline && context.isDatabaseInitialized && !!context.user,
    
    // Smart integrity validation conditions - ONLY skip if LSN is 0/0
    shouldSkipIntegrityValidation: ({ context }: { context: AppContext }) => {
      // ONLY skip if LSN is 0/0 (fresh start or post-reset)
      if (context.currentLSN === '0/0') {
        console.log('[XState] 🔄 Guard: Skipping integrity validation - fresh start (LSN 0/0)');
        return true;
      }
      
      // For any other LSN, run validation regardless of startup time or sync history
      const timeSinceStartup = Date.now() - (context.startupTime || Date.now());
      console.log(`[XState] 🔍 Guard: Running integrity validation - LSN: ${context.currentLSN}, startup age: ${timeSinceStartup}ms, lastSync: ${context.lastSyncTime ? 'exists' : 'null'}`);
      return false;
    },
    
    // Check if we should trigger integrity validation due to gaps
    shouldTriggerIntegrityFromGaps: ({ context }: { context: AppContext }) => {
      // Check time gap - if last sync was more than 1 hour ago
      const timeGapThreshold = 60 * 60 * 1000; // 1 hour
      if (context.lastSyncTime && (Date.now() - context.lastSyncTime) > timeGapThreshold) {
        console.log('[XState] ⏰ Large time gap detected - triggering integrity validation');
        return true;
      }
      
      // Could also check LSN gaps here if we have server LSN context
      // For now, rely on server-side heartbeat LSN drift detection
      
      return false;
    }
  },
  actions: {
    // Connection actions
    markOnline: assign({ 
      isOnline: true, 
      connectionRetries: 0,
      lastConnectAttempt: () => Date.now(),
      lastActivity: () => Date.now(),
    }),
    markOffline: assign({ 
      isOnline: false,
      lastConnectAttempt: () => Date.now(),
      lastActivity: () => Date.now(),
    }),
    incrementRetries: assign({ 
      connectionRetries: ({ context }) => context.connectionRetries + 1,
      connectionAttempts: ({ context }) => context.connectionAttempts + 1,
      lastActivity: () => Date.now(),
    }),
    
    // Auth actions (with persistence)
    storeAuthData: assign({
      user: ({ event }) => {
        if (event.type === 'LOGIN_SUCCESS') return event.user;
        return null;
      },
      authToken: ({ event }) => {
        if (event.type === 'LOGIN_SUCCESS') return event.token;
        return null;
      },
      lastKnownUser: ({ event }) => {
        if (event.type === 'LOGIN_SUCCESS') return event.user;
        return null;
      },
      isOfflineMode: false,
      authError: null,
      lastActivity: () => Date.now(),
    }),
    clearAuthData: assign({
      user: null,
      authToken: null,
      authError: null,
      lastActivity: () => Date.now(),
    }),
    updateAuthToken: assign({
      authToken: ({ event }) => {
        if (event.type === 'AUTH_TOKEN_RECEIVED') return event.token;
        return null;
      },
      lastActivity: () => Date.now(),
    }),
    cacheUser: assign({
      lastKnownUser: ({ event }) => {
        if (event.type === 'CACHE_USER') return event.user;
        return null;
      },
      lastActivity: () => Date.now(),
    }),
    setOfflineMode: assign({
      isOfflineMode: ({ event }) => {
        if (event.type === 'SET_OFFLINE_MODE') return event.offline;
        return false;
      },
      lastActivity: () => Date.now(),
    }),
    clearUserCache: assign({
      lastKnownUser: null,
      isOfflineMode: false,
      lastActivity: () => Date.now(),
    }),
    setAuthError: assign({
      authError: ({ event }) => {
        if (event.type === 'AUTH_ERROR') return event.error;
        return null;
      },
      lastActivity: () => Date.now(),
    }),
    
    // Database actions
    markDatabaseReady: assign({ 
      isDatabaseInitialized: true,
      dbInitialized: true, 
      dbError: null,
      databaseError: null,
      lastActivity: () => Date.now(),
    }),
    setDatabaseError: assign({ 
      isDatabaseInitialized: false,
      dbInitialized: false,
      dbError: ({ event }) => {
        if (event.type === 'DATABASE_ERROR') return event.error;
        if (event.type === 'DB_INIT_FAILED') return event.error;
        return null;
      },
      databaseError: ({ event }) => {
        if (event.type === 'DATABASE_ERROR') return event.error;
        if (event.type === 'DB_INIT_FAILED') return event.error;
        return null;
      },
      lastActivity: () => Date.now(),
    }),
    
    // Sync actions
    startSync: assign({
      currentSyncId: ({ event }) => {
        if (event.type === 'SYNC_START') return event.syncId;
        return null;
      },
      syncProgress: 0,
      completedTasks: 0,
      totalTasks: 0,
      syncError: null,
      // 🔥 NEW: Reset sync phase tracking
      syncPhase: null,
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
      lastActivity: () => Date.now(),
    }),
    updateSyncProgress: assign({
      syncProgress: ({ event }) => {
        if (event.type === 'SYNC_PROGRESS') {
          return Math.round((event.completed / event.total) * 100);
        }
        return 0;
      },
      completedTasks: ({ event }) => {
        if (event.type === 'SYNC_PROGRESS') return event.completed;
        return 0;
      },
      totalTasks: ({ event }) => {
        if (event.type === 'SYNC_PROGRESS') return event.total;
        return 0;
      },
      lastSyncTime: () => Date.now(),
      lastActivity: () => Date.now(),
    }),
    setSyncError: assign({
      syncError: ({ event }) => {
        if (event.type === 'SYNC_FAILED') return event.error;
        if (event.type === 'SYNC_ERROR') return event.error;
        return null;
      },
      currentSyncId: null,
      lastActivity: () => Date.now(),
    }),
    markSyncLive: assign({
      isSyncLive: true,
      syncPhase: 'live',
      lastActivity: () => Date.now(),
    }),
    resetSyncLive: assign({
      isSyncLive: false,
      syncPhase: null,
      lastActivity: () => Date.now(),
    }),
    
    // 🔥 NEW: Granular sync phase tracking actions
    setSyncPhase: assign({
      syncPhase: ({ event }) => {
        if (event.type === 'SYNC_PHASE_CHANGED') return event.phase;
        return null;
      },
      lastActivity: () => Date.now(),
    }),
    
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
      lastActivity: () => Date.now(),
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
      lastActivity: () => Date.now(),
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
      lastActivity: () => Date.now(),
    }),
    
    // Live changes actions
    enableLiveChanges: assign({ 
      liveChangesActive: true,
      isLiveChangesEnabled: true,
      liveChangesError: null,
      lastActivity: () => Date.now(),
    }),
    disableLiveChanges: assign({ 
      liveChangesActive: false,
      isLiveChangesEnabled: false,
      lastActivity: () => Date.now(),
    }),
    setLiveChangesError: assign({
      liveChangesError: ({ event }) => {
        if (event.type === 'LIVE_CHANGES_FAILED') return event.error;
        return null;
      },
      liveChangesActive: false,
      isLiveChangesEnabled: false,
      lastActivity: () => Date.now(),
    }),
    
    // Persistence actions
    persistAuthState: ({ context }) => {
      localStorage.setItem('auth-state', JSON.stringify({
        user: context.user,
        authToken: context.authToken,
        lastKnownUser: context.lastKnownUser,
        isOfflineMode: context.isOfflineMode,
      }));
    },
    
    // Notifications (for integration with existing systems)
    notifySystemReady: () => {
      window.dispatchEvent(new CustomEvent('app:ready'));
    },
    notifySyncComplete: () => {
      window.dispatchEvent(new CustomEvent('sync:complete'));
    },
    notifyLiveChangesActive: () => {
      window.dispatchEvent(new CustomEvent('live-changes:active'));
    },
    
    // Route loading coordination
    startRouteLoading: assign({
      isRouteLoading: true,
      lastActivity: () => Date.now(),
    }),
    completeRouteLoading: assign({
      isRouteLoading: false,
      lastActivity: () => Date.now(),
    }),
    
    // Integrity reset actions
    startIntegrityReset: assign({
      isIntegrityResetInProgress: true,
      integrityResetReason: ({ event }) => {
        if (event.type === 'INTEGRITY_RESET_START') return event.reason;
        return null;
      },
      integrityResetType: ({ event }) => {
        if (event.type === 'INTEGRITY_RESET_START') return event.resetType;
        return null;
      },
      integrityResetError: null,
      // Reset sync state since we're about to resync
      isSyncLive: false,
      syncPhase: null,
      currentLSN: '0/0',
      lastActivity: () => Date.now(),
    }),
    completeIntegrityReset: assign({
      // Don't clear isIntegrityResetInProgress yet - wait for post-reset validation
      integrityResetReason: null,
      integrityResetType: null,
      integrityResetError: null,
      lastActivity: () => Date.now(),
    }),
    triggerSyncReset: ({ self }) => {
      console.log('[XState] ✅ Integrity reset completed - resetting sync state for clean restart');
      
      // Reset sync state to allow clean restart
      self.send({ type: 'SYNC_RESET' });
    },
    setIntegrityResetError: assign({
      isIntegrityResetInProgress: false,
      integrityResetError: ({ event }) => {
        if (event.type === 'INTEGRITY_RESET_ERROR') return event.error;
        return null;
      },
      lastActivity: () => Date.now(),
    }),
    executeIntegrityReset: async ({ event }) => {
      if (event.type === 'INTEGRITY_RESET_START') {
        console.log('[XState] 🚨 Executing integrity reset:', event.reason);
        
        try {
          // Get SyncManager instance to access IntegrityManager
          const { SyncManager } = await import('@/sync/SyncManager');
          const syncManager = SyncManager.getInstance();
          const integrityManager = syncManager.getIntegrityManager();
          
          // Execute the reset
          const result = await integrityManager.executeFullReset(
            event.reason,
            false // Don't preserve user data for integrity resets
          );
          
          console.log('[XState] ✅ Integrity reset completed:', result);
          
        } catch (error) {
          console.error('[XState] ❌ Integrity reset failed:', error);
        }
      }
    },
    startIntegrityValidation: assign({
      isIntegrityValidationInProgress: true,
      lastActivity: () => Date.now(),
    }),
    completeIntegrityValidation: assign({
      isIntegrityValidationInProgress: false,
      // Clear reset flag if this validation was post-reset
      isIntegrityResetInProgress: false,
      lastActivity: () => Date.now(),
    }),

    // Gap-triggered validation actions
    startGapTriggeredValidation: assign({
      isIntegrityValidationInProgress: true,
      gapValidationReason: ({ event }) => {
        if (event.type === 'GAP_INTEGRITY_VALIDATION_START') return event.reason;
        return null;
      },
      lastActivity: () => Date.now(),
    }),

    completeGapTriggeredValidation: assign({
      isIntegrityValidationInProgress: false,
      gapValidationReason: null,
      lastActivity: () => Date.now(),
    }),
    
    // 🔥 NEW: Update abstracted readiness flags
    updateReadinessFlags: assign(({ context, self }) => {
      // Get current state to check if we're in a valid sync state
      const currentState = self.getSnapshot();
      const syncState = (currentState.value as any).sync;
      
      // Check if routes can be loaded (based on context only)
      const canLoadRoutes = Boolean(
        // Either authenticated user OR offline with cached user
        (context.user || (context.isOfflineMode && context.lastKnownUser)) &&
        // Database must be ready
        context.isDatabaseInitialized &&
        // Sync must be in a valid state: live, integrityValidated, or offline mode
        (context.isSyncLive || syncState === 'integrityValidated' || context.isOfflineMode) &&
        // Live changes must be active OR offline mode (or sync just validated)
        (context.liveChangesActive || syncState === 'integrityValidated' || context.isOfflineMode) &&
        // CRITICAL: Don't allow route loading during integrity operations
        !context.isIntegrityValidationInProgress &&
        !context.isIntegrityResetInProgress
      );
      
      // Overall system readiness (stricter check)
      const isSystemReady = Boolean(
        context.isDatabaseInitialized &&
        context.user &&
        context.authToken &&
        context.isSyncLive &&
        context.liveChangesActive
      );
      
      return {
        canLoadRoutes,
        isSystemReady,
        lastActivity: Date.now(),
      };
    }),
    
    // 🔥 NEW: Trigger live changes when sync is complete
    triggerLiveChanges: ({ self }) => {
      console.log('[XState] 🔥 Sync completed - triggering live changes check');
      // Send event to self to trigger live changes evaluation
      self.send({ type: 'LIVE_CHANGES_START' });
    },

    // LSN management
    updateLSN: assign({
      currentLSN: ({ event }) => {
        if (event.type === 'LSN_UPDATE') {
          console.log(`[XState] 📍 LSN updated: ${event.lsn}`);
          return event.lsn;
        }
        return '0/0';
      },
      lastActivity: () => Date.now(),
    }),
  },
}).createMachine({
  id: 'appCoordination',
  
  context: {
    // Connection
    isOnline: navigator.onLine,
    lastConnectAttempt: null,
    connectionRetries: 0,
    connectionAttempts: 0,
    lastConnectionError: null,
    lastActivity: Date.now(),
    
    // Auth state (with persistence)
    user: null,
    authToken: null,
    lastKnownUser: null,
    isOfflineMode: false,
    authError: null,
    
    // Database
    dbInitialized: false,
    isDatabaseInitialized: false,
    dbError: null,
    databaseError: null,
    
    // Sync
    currentSyncId: null,
    syncProgress: 0,
    syncError: null,
    totalTasks: 0,
    completedTasks: 0,
    serverLSN: null,
    currentLSN: '0/0',
    lastSyncTime: null,
    isSyncLive: false,
    
    // 🔥 NEW: Global sync granularity
    syncPhase: null, // 'initial' | 'catchup' | 'live' | null
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
    
    // Live changes
    liveChangesActive: false,
    isLiveChangesEnabled: false,
    liveChangesError: null,
    lastLiveChangeTime: null,
    
    // App readiness
    lastReadinessCheck: null,
    startupTime: Date.now(),
    
    // 🔥 NEW: Abstracted readiness flags
    isSystemReady: false,
    canLoadRoutes: false,
    isRouteLoading: false,
    currentRouteName: null,
    
    // Integrity reset state
    isIntegrityResetInProgress: false,
    integrityResetReason: null,
    integrityResetType: null,
    integrityResetError: null,
    isIntegrityValidationInProgress: false,
    gapValidationReason: null,
  },
  
  type: 'parallel',
  
  states: {
    // Connection management
    connection: {
      initial: 'checking',
      states: {
        checking: {
          always: [
            { target: 'online', guard: () => navigator.onLine },
            { target: 'offline' }
          ]
        },
        offline: {
          entry: 'markOffline',
          on: {
            GO_ONLINE: 'connecting',
            CONNECTION_SUCCESS: 'online',
          }
        },
        connecting: {
          entry: 'incrementRetries',
          on: {
            CONNECTION_SUCCESS: 'online',
            CONNECTION_FAILED: 'failed',
            GO_OFFLINE: 'offline',
          },
          after: {
            5000: 'failed'
          }
        },
        online: {
          entry: 'markOnline',
          on: {
            GO_OFFLINE: 'offline',
            CONNECTION_FAILED: 'failed',
          }
        },
        failed: {
          on: {
            CONNECTION_RETRY: 'connecting',
            GO_OFFLINE: 'offline',
          }
        }
      }
    },
    
    // 🔥 Auth management using better-auth actors
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
                  lastKnownUser: ({ event }) => event.output.user || null,
                  authError: null,
                  lastActivity: () => Date.now(),
                }),
              },
              { 
                target: 'unauthenticated',
                actions: assign({
                  user: null,
                  authToken: null,
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
                authError: ({ event }) => (event.error as Error)?.message || 'Auth check failed',
                lastActivity: () => Date.now(),
              }),
            },
          },
        },
        
        unauthenticated: {
          on: {
            SIGN_IN: {
              target: 'signing_in',
            },
            // Manual auth events for compatibility
            LOGIN_SUCCESS: {
              target: 'authenticated',
              actions: [assign({
                user: ({ event }) => event.user,
                authToken: ({ event }) => event.token,
                lastKnownUser: ({ event }) => event.user,
                authError: null,
                lastActivity: () => Date.now(),
              }), 'persistAuthState', 'updateReadinessFlags'],
            },
            CHECK_AUTH: 'checking',
            RESTORE_AUTH_STATE: {
              target: 'authenticated',
              actions: [assign({
                user: ({ event }) => event.user || null,
                authToken: ({ event }) => event.token || null,
                lastKnownUser: ({ event }) => event.lastKnownUser || null,
                lastActivity: () => Date.now(),
              }), 'persistAuthState'],
            }
          }
        },
        
        signing_in: {
          invoke: {
            src: 'signIn',
            input: ({ event }) => {
              if (event.type === 'SIGN_IN') {
                return {
                  email: event.email,
                  password: event.password,
                };
              }
              return { email: '', password: '' };
            },
            onDone: [
              {
                target: 'checking', // Re-check auth after sign-in
                guard: ({ event }) => event.output.success,
              },
              {
                target: 'unauthenticated',
                actions: assign({
                  authError: ({ event }) => event.output.error || null,
                  lastActivity: () => Date.now(),
                }),
              },
            ],
            onError: {
              target: 'unauthenticated',
              actions: assign({
                authError: ({ event }) => (event.error as Error)?.message || 'Sign-in failed',
                lastActivity: () => Date.now(),
              }),
            },
          },
        },
        
        authenticated: {
          on: {
            SIGN_OUT: {
              target: 'signing_out',
            },
            LOGOUT: {
              target: 'signing_out',
            },
            TOKEN_EXPIRED: 'checking',
            CHECK_AUTH: 'checking',
            AUTH_ERROR: {
              target: 'unauthenticated',
              actions: [assign({
                authError: ({ event }) => event.error,
                user: null,
                authToken: null,
                lastActivity: () => Date.now(),
              }), 'persistAuthState'],
            },
            // Enhanced auth actions
            CACHE_USER: {
              actions: [assign({
                lastKnownUser: ({ event }) => event.user,
                lastActivity: () => Date.now(),
              }), 'persistAuthState'],
            },
            SET_OFFLINE_MODE: {
              actions: [assign({
                isOfflineMode: ({ event }) => event.offline,
                lastActivity: () => Date.now(),
              }), 'persistAuthState'],
            },
            CLEAR_USER_CACHE: {
              actions: [assign({
                lastKnownUser: null,
                isOfflineMode: false,
                lastActivity: () => Date.now(),
              }), 'persistAuthState'],
            }
          }
        },
        
        signing_out: {
          invoke: {
            src: 'signOut',
            onDone: {
              target: 'unauthenticated',
              actions: [assign({
                user: null,
                authToken: null,
                authError: null,
                lastActivity: () => Date.now(),
              }), 'persistAuthState'],
            },
            onError: {
              target: 'unauthenticated', // Even if sign-out fails, treat as signed out
              actions: [assign({
                user: null,
                authToken: null,
                authError: null,
                lastActivity: () => Date.now(),
              }), 'persistAuthState'],
            },
          },
        },
      }
    },
    
    // Database management
    database: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            DB_INIT_START: 'initializing'
          }
        },
        initializing: {
          invoke: {
            src: 'initializeDatabase',
            onDone: {
              target: 'ready',
              actions: 'markDatabaseReady'
            },
            onError: {
              target: 'error',
              actions: assign({
                isDatabaseInitialized: false,
                dbInitialized: false,
                dbError: ({ event }) => (event.error as Error)?.message || 'Database initialization failed',
                databaseError: ({ event }) => (event.error as Error)?.message || 'Database initialization failed',
                lastActivity: () => Date.now(),
              })
            }
          }
        },
        ready: {
          entry: 'updateReadinessFlags',
          on: {
            DB_RESET: 'idle'
          }
        },
        error: {
          on: {
            DB_INIT_START: 'initializing'
          }
        }
      }
    },
    
    // Sync management (coordinated with auth + database)
    sync: {
      initial: 'idle',
      states: {
        idle: {
          entry: 'resetSyncLive',
          always: {
            target: 'syncing',
            guard: 'canStartSync'
          },
          on: {
            SYNC_START: {
              target: 'syncing',
              actions: assign({
                currentSyncId: ({ event }) => event.syncId,
                syncProgress: 0,
                completedTasks: 0,
                totalTasks: 0,
                syncError: null,
                lastActivity: () => Date.now(),
              })
            }
          }
        },
        syncing: {
          entry: 'resetSyncLive',
          invoke: {
            src: 'runSync',
            input: ({ context }) => ({ syncId: context.currentSyncId! }),
            onDone: 'live',
            onError: {
              target: 'error',
              actions: assign({
                syncError: ({ event }) => (event.error as Error)?.message || 'Sync failed',
                currentSyncId: null,
                lastActivity: () => Date.now(),
              })
            }
          },
          on: {
            SYNC_PROGRESS: {
              actions: 'updateSyncProgress'
            },
            SYNC_FAILED: {
              target: 'error',
              actions: assign({
                syncError: ({ event }) => event.error,
                currentSyncId: null,
                lastActivity: () => Date.now(),
              })
            },
            // 🔥 NEW: Granular sync event handlers
            SYNC_PHASE_CHANGED: {
              actions: 'setSyncPhase'
            },
            INITIAL_SYNC_PROGRESS: {
              actions: 'updateInitialSyncProgress'
            },
            CATCHUP_SYNC_PROGRESS: {
              actions: 'updateCatchupSyncProgress'
            },
            LIVE_SYNC_ACTIVITY: {
              actions: 'updateLiveSyncActivity'
            }
          }
        },
        live: {
          entry: ['markSyncLive', 'notifySyncComplete', 'updateReadinessFlags'],
          always: [
            {
              target: 'integrityValidated',
              guard: 'shouldSkipIntegrityValidation',
              actions: ({ context }) => {
                // Only reason to skip now is LSN 0/0
                console.log(`[XState] 🔄 Action: Skipping integrity validation - LSN: ${context.currentLSN} (fresh start)`);
              }
            },
            {
              target: 'validatingIntegrity',
              actions: ({ context }) => {
                console.log(`[XState] 🔍 Action: Starting integrity validation - LSN: ${context.currentLSN}, startup age: ${Date.now() - (context.startupTime || Date.now())}ms`);
              }
            }
          ],
          on: {
            SYNC_RESET: 'idle'
          }
        },
        validatingIntegrity: {
          entry: [
            'startIntegrityValidation', // Set the flag for loading screen coordination
            () => console.log('[XState] 🔍 Starting integrity validation after sync completion'),
            () => console.log('[XState] 📱 Setting isIntegrityValidationInProgress = true for loading screen')
          ],
          invoke: {
            src: 'validateIntegrity',
            input: ({ context }) => ({ context }),
            onDone: {
              target: 'integrityValidated',
              actions: [
                'completeIntegrityValidation', // Clear the flag for loading screen coordination
                ({ event, self }) => {
                  console.log('[XState] ✅ Integrity validation completed successfully', event.output);
                  console.log('[XState] 📱 Setting isIntegrityValidationInProgress = false to hide loading screen');
                  
                  // Check if server recommends reset due to integrity issues
                  const result = event.output?.result;
                  console.log('[XState] 🔍 Integrity validation result structure:', { 
                    hasOutput: !!event.output, 
                    hasResult: !!result,
                    resultStructure: result ? {
                      isValid: result.isValid,
                      recommendedAction: result.recommendedAction,
                      issueCount: result.issues?.length || 0
                    } : 'no result'
                  });
                  
                  if (result && !result.isValid && result.recommendedAction === 'reset') {
                    console.warn('[XState] 🚨 Server recommends reset due to integrity issues - auto-triggering reset');
                    console.log('[XState] Issues found:', result.issues);
                    console.table(result.issues);
                    
                    // Auto-trigger integrity reset
                    self.send({ 
                      type: 'INTEGRITY_RESET_START', 
                      reason: `Integrity validation failed with ${result.issues.length} issues`,
                      resetType: 'full_reset'
                    });
                  }
                }
              ]
            },
            onError: {
              target: 'integrityValidated', // Continue even if integrity check fails
              actions: [
                'completeIntegrityValidation', // Clear the flag even on error
                ({ event }) => {
                  console.warn('[XState] ⚠️ Integrity validation failed, continuing:', event.error);
                  console.log('[XState] 📱 Setting isIntegrityValidationInProgress = false to hide loading screen (error case)');
                }
              ]
            }
          },
          on: {
            SYNC_RESET: 'idle'
          }
        },
        integrityValidated: {
          entry: [
            () => console.log('[XState] 🔥 Integrity validation complete - triggering live changes'),
            'triggerLiveChanges',
            'updateReadinessFlags'
          ],
          on: {
            SYNC_RESET: 'idle',
            // Handle sync completion after integrity reset
            SYNC_STATUS_CHANGED: [
              {
                target: 'live',
                guard: ({ event }) => event.status === 'live',
                actions: [
                  ({ event }) => console.log(`[XState] 🔄 Sync status changed to ${event.status} after integrity reset`),
                  'markSyncLive',
                  'updateReadinessFlags'
                ]
              }
            ],
            // Handle gap-triggered validation while in live state
            GAP_INTEGRITY_VALIDATION_START: 'gapValidating'
          }
        },
        
        // New state for gap-triggered integrity validation
        gapValidating: {
          entry: 'startGapTriggeredValidation',
          invoke: {
            src: 'validateIntegrityFromGap',
            input: ({ event, context }) => ({ 
              reason: event.type === 'GAP_INTEGRITY_VALIDATION_START' ? event.reason : 'Unknown gap',
              context 
            }),
            onDone: {
              target: 'integrityValidated',
              actions: [
                'completeGapTriggeredValidation',
                ({ event, self }) => {
                  console.log('[XState] ✅ Gap-triggered integrity validation completed:', event);
                  
                  // If validation result indicates reset is needed, trigger it
                  if (event.output?.shouldReset) {
                    console.warn('[XState] 🚨 Gap validation failed - triggering integrity reset');
                    self.send({ 
                      type: 'INTEGRITY_RESET_START', 
                      reason: event.output.resetReason || 'Gap validation failed',
                      resetType: 'full_reset'
                    });
                  }
                }
              ]
            },
            onError: {
              target: 'integrityValidated', // Continue even if gap validation fails
              actions: [
                // Clear validation flag even on error
                assign({
                  isIntegrityValidationInProgress: false,
                  gapValidationReason: null,
                  lastActivity: () => Date.now(),
                }),
                ({ event }) => console.warn('[XState] ⚠️ Gap validation failed, continuing:', event.error)
              ]
            }
          },
          on: {
            SYNC_RESET: 'idle'
          }
        },
        error: {
          entry: 'resetSyncLive',
          on: {
            SYNC_START: 'syncing',
            SYNC_RESET: 'idle'
          }
        }
      }
    },
    
    // Live changes management (coordinated with sync)
    liveChanges: {
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            LIVE_CHANGES_START: {
              target: 'starting',
              guard: 'canEnableLiveChanges'
            }
          }
        },
        starting: {
          entry: () => console.log('[XState] 🔄 Live changes starting...'),
          invoke: {
            src: 'manageLiveChanges',
            onDone: {
              target: 'active',
              actions: ['enableLiveChanges', 'notifyLiveChangesActive']
            },
            onError: {
              target: 'error',
              actions: assign({
                liveChangesError: ({ event }) => (event.error as Error)?.message || 'Live changes failed',
                liveChangesActive: false,
                isLiveChangesEnabled: false,
                lastActivity: () => Date.now(),
              })
            }
          }
        },
        active: {
          entry: [
            () => console.log('[XState] ✅ Live changes active - system ready!'),
            'updateReadinessFlags'
          ],
          on: {
            LIVE_CHANGES_STOP: 'inactive',
            LIVE_CHANGES_FAILED: {
              target: 'error',
              actions: [assign({
                liveChangesError: ({ event }) => event.error,
                liveChangesActive: false,
                isLiveChangesEnabled: false,
                lastActivity: () => Date.now(),
              }), 'updateReadinessFlags']
            }
          }
        },
        error: {
          on: {
            LIVE_CHANGES_START: 'starting'
          }
        }
      }
    },
    
    // App readiness coordination (waits for all systems)
    appReadiness: {
      initial: 'loading',
      states: {
        loading: {
          always: {
            target: 'ready',
            guard: 'isAppReady'
          },
          on: {
            CHECK_READINESS: {
              target: 'ready',
              guard: 'isAppReady'
            }
          }
        },
        ready: {
          entry: ['notifySystemReady', assign({ 
            lastReadinessCheck: () => Date.now(),
            lastActivity: () => Date.now(),
          })],
          always: {
            target: 'loading',
            guard: ({ context }) => !context.isDatabaseInitialized || !context.user
          }
        },
        error: {
          on: {
            CHECK_READINESS: 'loading'
          }
        }
      }
    }
  },
  
  // Global event handlers
  on: {
    ROUTE_LOADING_START: {
      actions: assign({
        isRouteLoading: true,
        currentRouteName: ({ event }) => event.routeName || null,
        lastActivity: () => Date.now(),
      })
    },
    ROUTE_LOADING_COMPLETE: {
      actions: assign({
        isRouteLoading: false,
        currentRouteName: null,
        lastActivity: () => Date.now(),
      })
    },
    // Force readiness flag update
    UPDATE_READINESS_FLAGS: {
      actions: 'updateReadinessFlags'
    },
    // LSN management
    LSN_UPDATE: {
      actions: 'updateLSN'
    },
    // Integrity reset event handlers
    INTEGRITY_RESET_START: {
      actions: ['startIntegrityReset', 'executeIntegrityReset']
    },
    INTEGRITY_RESET_COMPLETE: {
      actions: ['completeIntegrityReset', 'triggerSyncReset']
    },
    INTEGRITY_RESET_ERROR: {
      actions: 'setIntegrityResetError'
    },
    // Remove global integrity validation handlers to avoid double-processing
    // These are now handled within the state machine transitions
    // INTEGRITY_VALIDATION_START: {
    //   actions: 'startIntegrityValidation'
    // },
    // INTEGRITY_VALIDATION_COMPLETE: {
    //   actions: 'completeIntegrityValidation'
    // },
    
    // Gap detection and heartbeat events
    LSN_DRIFT_DETECTED: {
      actions: ({ event, self }) => {
        console.warn('[XState] 🔀 LSN drift detected in heartbeat', event);
        
        // Trigger gap-based integrity validation
        self.send({
          type: 'GAP_INTEGRITY_VALIDATION_START',
          reason: `LSN drift: client=${event.clientLSN}, server=${event.serverLSN}`
        });
      }
    },
    
    TIME_GAP_DETECTED: [
      {
        // Only trigger if we should validate based on gap
        guard: 'shouldTriggerIntegrityFromGaps',
        actions: ({ event, self }) => {
          console.warn('[XState] ⏰ Time gap detected', event);
          
          // Trigger gap-based integrity validation
          self.send({
            type: 'GAP_INTEGRITY_VALIDATION_START',
            reason: `Time gap detected: ${event.gapMs}ms - ${event.reason}`
          });
        }
      },
      {
        // Log but don't trigger if gap is not significant enough
        actions: ({ event }) => {
          console.log('[XState] ⏰ Time gap detected but not triggering validation:', event);
        }
      }
    ],
    
    CONNECTION_RECOVERED: {
      actions: ({ event, context, self }) => {
        console.log('[XState] 🔄 Connection recovered after disconnection', event);
        
        // Check if we should trigger integrity validation due to time gap
        if (context.lastSyncTime) {
          const gapMs = Date.now() - context.lastSyncTime;
          if (gapMs > 60 * 60 * 1000) { // 1 hour
            console.log('[XState] 🔍 Large time gap during disconnection - triggering integrity validation');
            self.send({
              type: 'GAP_INTEGRITY_VALIDATION_START',
              reason: `Connection recovered after ${Math.round(gapMs / 1000)}s offline`
            });
          }
        }
      }
    }
  }
});

// Load persisted auth state on initialization
const loadPersistedAuth = () => {
  try {
    const stored = localStorage.getItem('auth-state');
    if (stored) {
      const authState = JSON.parse(stored);
      return authState;
    }
  } catch (error) {
    console.warn('[App] Failed to load persisted auth state:', error);
  }
  return null;
};

export { loadPersistedAuth };

console.log("[COORDINATION] App coordination machine created with auth state"); 