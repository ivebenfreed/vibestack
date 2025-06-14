import { useSelector } from '@xstate/react';
import { useContext, createContext, type ReactNode } from 'react';
import type { ActorRefFrom } from 'xstate';
import type { appMachine } from './app-machine';
import type { AppStateSnapshot, AppReadinessInfo, RouteLoadingInfo, UserInfo } from './types';
import { 
  isConnectionOnline, 
  isAuthenticated, 
  isDatabaseReady, 
  isSyncLive, 
  areLiveChangesActive,
  isAppReady,
  getAppReadinessInfo,
  canLoadRoutes,
  getRouteLoadingInfo,
  getSyncProgress,
  getDebugInfo,
  getUserDisplayInfo,
  getCurrentUser,
  getLastKnownUser,
  isOfflineMode,
  hasUserCache,
  isIntegrityResetInProgress,
  isIntegrityValidationInProgress,
  getIntegrityResetInfo
} from './selectors';

// ===== CONTEXT =====

type AppMachineActor = ActorRefFrom<typeof appMachine>;

const AppMachineContext = createContext<AppMachineActor | null>(null);

export function AppMachineProvider({ 
  children, 
  actor 
}: { 
  children: ReactNode; 
  actor: AppMachineActor; 
}) {
  return (
    <AppMachineContext.Provider value={actor}>
      {children}
    </AppMachineContext.Provider>
  );
}

export function useAppMachineActor() {
  const actor = useContext(AppMachineContext);
  if (!actor) {
    throw new Error('useAppMachineActor must be used within AppMachineProvider');
  }
  return actor;
}

// ===== BASIC HOOKS =====

export function useAppState() {
  const actor = useAppMachineActor();
  
  // Convert XState snapshot to our AppStateSnapshot format
  const snapshot = useSelector(actor, (state): AppStateSnapshot => {
    return {
      connection: state.value.connection as any,
      auth: state.value.auth as any,
      database: state.value.database as any,
      sync: state.value.sync as any,
      liveChanges: state.value.liveChanges as any,
      appReadiness: state.value.appReadiness as any,
      context: state.context,
    };
  });
  
  const send = actor.send;
  
  return {
    // Raw state
    snapshot,
    send,
    
    // Convenience state checks
    isConnectionOnline: isConnectionOnline(snapshot),
    isAuthenticated: isAuthenticated(snapshot),
    isDatabaseReady: isDatabaseReady(snapshot),
    isSyncLive: isSyncLive(snapshot),
    areLiveChangesActive: areLiveChangesActive(snapshot),
    isAppReady: isAppReady(snapshot),
    canLoadRoutes: canLoadRoutes(snapshot),
    
    // Complex state info
    readinessInfo: getAppReadinessInfo(snapshot),
    routeLoadingInfo: getRouteLoadingInfo(snapshot),
    syncProgress: getSyncProgress(snapshot),
    
    // Enhanced auth info
    userDisplay: getUserDisplayInfo(snapshot),
    currentUser: getCurrentUser(snapshot),
    lastKnownUser: getLastKnownUser(snapshot),
    isOfflineMode: isOfflineMode(snapshot),
    hasUserCache: hasUserCache(snapshot),
    
    // Debug info
    debug: getDebugInfo(snapshot),
    
    // Integrity reset state
    isIntegrityResetInProgress: snapshot.context.isIntegrityResetInProgress,
    isIntegrityValidationInProgress: snapshot.context.isIntegrityValidationInProgress,
    integrityResetInfo: getIntegrityResetInfo(snapshot),
    
    // Actions
    send: actor.send,
    
    // Convenience action creators for integrity reset
    startIntegrityReset: (reason: string, resetType: 'full_reset' | 'table_reset') =>
      actor.send({ type: 'INTEGRITY_RESET_START', reason, resetType }),
    completeIntegrityReset: (result: any) =>
      actor.send({ type: 'INTEGRITY_RESET_COMPLETE', result }),
    reportIntegrityResetError: (error: string) =>
      actor.send({ type: 'INTEGRITY_RESET_ERROR', error }),
    startIntegrityValidation: () =>
      actor.send({ type: 'INTEGRITY_VALIDATION_START' }),
    completeIntegrityValidation: (isValid: boolean, issues: any[]) =>
      actor.send({ type: 'INTEGRITY_VALIDATION_COMPLETE', isValid, issues }),
  };
}

// ===== SPECIFIC STATE HOOKS =====

export function useConnectionState() {
  const actor = useAppMachineActor();
  
  return useSelector(actor, (state) => ({
    status: state.value.connection as any,
    isOnline: state.value.connection === 'online',
    isOffline: state.value.connection === 'offline',
    isChecking: state.value.connection === 'checking',
    attempts: state.context.connectionAttempts,
    error: state.context.lastConnectionError,
    
    // Actions
    retry: () => actor.send({ type: 'RETRY_CONNECTION' }),
  }));
}

export function useAuthState() {
  const actor = useAppMachineActor();
  
  return useSelector(actor, (state) => ({
    status: state.value.auth as any,
    isAuthenticated: state.value.auth === 'authenticated',
    isUnauthenticated: state.value.auth === 'unauthenticated', 
    isChecking: state.value.auth === 'checking',
    
    // Enhanced auth data (from authStore)
    user: state.context.user,
    token: state.context.authToken,
    lastKnownUser: state.context.lastKnownUser,
    isOfflineMode: state.context.isOfflineMode,
    
    // Computed values (from authStore)
    displayName: (() => {
      const user = state.context.user || state.context.lastKnownUser;
      if (!user) return 'User';
      return user.name || user.email?.split('@')[0] || 'User';
    })(),
    
    initials: (() => {
      const user = state.context.user || state.context.lastKnownUser;
      if (!user) return 'U';
      const name = user.name || user.email?.split('@')[0] || 'User';
      return name.slice(0, 2).toUpperCase();
    })(),
    
    hasCache: !!state.context.lastKnownUser,
    
    // Actions (enhanced)
    login: (user: UserInfo, token: string) => 
      actor.send({ type: 'LOGIN_SUCCESS', user, token }),
    logout: () => 
      actor.send({ type: 'LOGOUT' }),
    updateToken: (token: string) => 
      actor.send({ type: 'AUTH_TOKEN_RECEIVED', token }),
    cacheUser: (user: UserInfo) => 
      actor.send({ type: 'CACHE_USER', user }),
    setOfflineMode: (offline: boolean) => 
      actor.send({ type: 'SET_OFFLINE_MODE', offline }),
    clearCache: () => 
      actor.send({ type: 'CLEAR_USER_CACHE' }),
  }));
}

export function useDatabaseState() {
  const actor = useAppMachineActor();
  
  return useSelector(actor, (state) => ({
    status: state.value.database as any,
    isReady: state.value.database === 'ready',
    isInitializing: state.value.database === 'initializing',
    isError: state.value.database === 'error',
    isReconnecting: state.value.database === 'reconnecting',
    error: state.context.databaseError,
    
    // Actions
    markReady: () => 
      actor.send({ type: 'DATABASE_READY' }),
    reportError: (error: string) => 
      actor.send({ type: 'DATABASE_ERROR', error }),
    retry: () => 
      actor.send({ type: 'RETRY_DATABASE' }),
  }));
}

export function useSyncState() {
  const actor = useAppMachineActor();
  
  return useSelector(actor, (state) => ({
    status: state.value.sync as any,
    isDisconnected: state.value.sync === 'disconnected',
    isConnecting: state.value.sync === 'connecting',
    isInitialSync: state.value.sync === 'initial_sync',
    isCatchupSync: state.value.sync === 'catchup_sync',
    isLive: state.value.sync === 'live',
    isError: state.value.sync === 'error',
    
    currentLSN: state.context.currentLSN,
    serverLSN: state.context.serverLSN,
    lastSyncTime: state.context.lastSyncTime,
    error: state.context.syncError,
    
    // Actions
    start: () => 
      actor.send({ type: 'START_SYNC' }),
    connected: (serverLSN: string) => 
      actor.send({ type: 'SYNC_CONNECTED', serverLSN }),
    initialComplete: (finalLSN: string) => 
      actor.send({ type: 'INITIAL_SYNC_COMPLETE', finalLSN }),
    catchupComplete: (finalLSN: string) => 
      actor.send({ type: 'CATCHUP_COMPLETE', finalLSN }),
    updateLSN: (lsn: string) => 
      actor.send({ type: 'LSN_UPDATE', lsn }),
    disconnect: () => 
      actor.send({ type: 'SYNC_DISCONNECTED' }),
    reportError: (error: string) => 
      actor.send({ type: 'SYNC_ERROR', error }),
    retry: () => 
      actor.send({ type: 'RETRY_SYNC' }),
  }));
}

export function useLiveChangesState() {
  const actor = useAppMachineActor();
  
  return useSelector(actor, (state) => ({
    status: state.value.liveChanges as any,
    isActive: state.value.liveChanges === 'active',
    isDisabled: state.value.liveChanges === 'disabled',
    enabled: state.context.isLiveChangesEnabled,
    lastChangeTime: state.context.lastLiveChangeTime,
    
    // Actions
    enable: () => 
      actor.send({ type: 'ENABLE_LIVE_CHANGES' }),
    disable: () => 
      actor.send({ type: 'DISABLE_LIVE_CHANGES' }),
    recordChange: (change: any) => 
      actor.send({ type: 'LIVE_CHANGE_RECEIVED', change }),
  }));
}

// ===== CONVENIENCE HOOKS =====

export function useAppReadiness(): AppReadinessInfo & { send: any } {
  const { readinessInfo, send } = useAppState();
  return { ...readinessInfo, send };
}

export function useRouteLoading(): RouteLoadingInfo & { send: any } {
  const { routeLoadingInfo, send } = useAppState();
  return { ...routeLoadingInfo, send };
}

// ===== AUTH CONVENIENCE HOOKS (replaces authStore functionality) =====

export function useUser() {
  const auth = useAuthState();
  return {
    user: auth.user,
    lastKnownUser: auth.lastKnownUser,
    displayName: auth.displayName,
    initials: auth.initials,
    isOfflineMode: auth.isOfflineMode,
    hasCache: auth.hasCache,
    
    // Actions
    cacheUser: auth.cacheUser,
    setOfflineMode: auth.setOfflineMode,
    clearCache: auth.clearCache,
  };
}

// ===== SYSTEM ACTIVITY HOOK =====

export function useSystemActivity() {
  const actor = useAppMachineActor();
  
  const recordActivity = () => {
    actor.send({ type: 'ACTIVITY' });
  };
  
  return { recordActivity };
}

// ===== DEBUG HOOK =====

export function useAppStateDebug() {
  const { debug } = useAppState();
  return debug;
}

// ===== MIGRATION HELPERS =====

/**
 * Migration helper hook that provides a unified interface for components
 * transitioning from multiple state hooks to XState.
 * 
 * Usage:
 * // Before:
 * const { isAuthenticated } = useAuth();
 * const { isReady } = usePGliteContext();
 * const { syncState } = useSyncContext();
 * const { isInitialized } = useAppInitialization({ isOnline });
 * 
 * // During migration:
 * const { isAuthenticated, isReady, syncState, isInitialized } = useUnifiedAppState();
 * 
 * // After migration:
 * const { isAppReady } = useAppState();
 */
export function useUnifiedAppState() {
  const xstate = useAppState();
  
  return {
    // XState-based properties (preferred)
    ...xstate,
    
    // Legacy-compatible aliases for easier migration
    isReady: xstate.isDatabaseReady,
    isInitialized: xstate.isAppReady,
    dbReady: xstate.isDatabaseReady,
    syncReady: xstate.isSyncLive,
    
    // Combined readiness check (most common use case)
    canRender: xstate.isAppReady,
    canLoadData: xstate.isDatabaseReady && xstate.isAuthenticated,
    
    // Migration status
    isUsingXState: true,
    migrationPhase: 'xstate-unified' as const,
  };
}

/**
 * Hook for components that need simple ready/loading state during migration
 */
export function useSimpleReadiness() {
  const { isAppReady, readinessInfo } = useAppState();
  
  return {
    isReady: isAppReady,
    isLoading: !isAppReady,
    loadingReason: readinessInfo.blockingReasons.join(', ') || 'Initializing...',
    readyPhase: readinessInfo.readyPhase,
  };
} 