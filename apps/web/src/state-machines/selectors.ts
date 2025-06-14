import type { AppStateSnapshot, AppReadinessInfo, RouteLoadingInfo, UserDisplayInfo } from './types';

// ===== BASIC STATE SELECTORS =====

export const createAppSelector = <T>(selector: (snapshot: AppStateSnapshot) => T) => selector;

export const isConnectionOnline = (snapshot: AppStateSnapshot) => 
  snapshot.connection === 'online';

export const isAuthenticated = (snapshot: AppStateSnapshot) => 
  snapshot.auth === 'authenticated';

export const isDatabaseReady = (snapshot: AppStateSnapshot) => 
  snapshot.database === 'ready';

export const isSyncLive = (snapshot: AppStateSnapshot) => 
  snapshot.sync === 'live';

export const areLiveChangesActive = (snapshot: AppStateSnapshot) => 
  snapshot.liveChanges === 'active';

// ===== ENHANCED AUTH SELECTORS (from authStore) =====

export const getUserDisplayInfo = (snapshot: AppStateSnapshot): UserDisplayInfo => {
  const { context } = snapshot;
  const user = context.user || context.lastKnownUser;
  
  const getDisplayName = (): string => {
    if (!user) return 'User';
    return user.name || user.email?.split('@')[0] || 'User';
  };
  
  const getInitials = (): string => {
    const displayName = getDisplayName();
    return displayName.slice(0, 2).toUpperCase();
  };
  
  return {
    displayName: getDisplayName(),
    initials: getInitials(),
    isOffline: context.isOfflineMode,
    hasCache: !!context.lastKnownUser,
  };
};

export const getCurrentUser = (snapshot: AppStateSnapshot) => {
  return snapshot.context.user;
};

export const getLastKnownUser = (snapshot: AppStateSnapshot) => {
  return snapshot.context.lastKnownUser;
};

export const isOfflineMode = (snapshot: AppStateSnapshot): boolean => {
  return snapshot.context.isOfflineMode;
};

export const hasUserCache = (snapshot: AppStateSnapshot): boolean => {
  return !!snapshot.context.lastKnownUser;
};

// Integrity reset selectors
export const isIntegrityResetInProgress = (snapshot: AppStateSnapshot): boolean => {
  return snapshot.context.isIntegrityResetInProgress;
};

export const isIntegrityValidationInProgress = (snapshot: AppStateSnapshot): boolean => {
  return snapshot.context.isIntegrityValidationInProgress;
};

export const getIntegrityResetInfo = (snapshot: AppStateSnapshot) => {
  return {
    isInProgress: snapshot.context.isIntegrityResetInProgress,
    reason: snapshot.context.integrityResetReason,
    type: snapshot.context.integrityResetType,
    error: snapshot.context.integrityResetError,
    isValidationInProgress: snapshot.context.isIntegrityValidationInProgress,
  };
};

// ===== COMPOUND STATE SELECTORS =====

export const isAppReady = (snapshot: AppStateSnapshot): boolean => {
  // Block app if integrity reset is in progress
  if (snapshot.context.isIntegrityResetInProgress) {
    return false;
  }
  
  return !!(
    snapshot.context.isDatabaseInitialized &&
    snapshot.context.user &&
    snapshot.context.authToken &&
    (snapshot.context.isSyncLive || snapshot.context.isOfflineMode)
  );
};

export const getAppReadinessInfo = (snapshot: AppStateSnapshot): AppReadinessInfo => {
  const { connection, auth, database, sync, context } = snapshot;
  
  // Determine the ready phase
  let readyPhase: AppReadinessInfo['readyPhase'] = 'offline';
  const blockingReasons: string[] = [];
  
  // Check for integrity reset first - this blocks everything
  if (context.isIntegrityResetInProgress) {
    blockingReasons.push(`Data integrity reset in progress: ${context.integrityResetReason || 'Unknown reason'}`);
    readyPhase = 'offline';
    return {
      isReady: false,
      isLoading: true,
      readyPhase,
      blockingReasons,
    };
  }
  
  // Check for integrity validation
  if (context.isIntegrityValidationInProgress) {
    blockingReasons.push('Validating data integrity');
  }
  
  // Check auth - allow offline mode with cached user
  if (auth !== 'authenticated' && !(context.isOfflineMode && context.lastKnownUser)) {
    blockingReasons.push('Authentication required');
  }
  
  // Check database
  if (database !== 'ready') {
    blockingReasons.push('Database initializing');
  } else {
    readyPhase = 'database_only';
  }
  
  // Check connection and sync
  if (connection === 'online') {
    if (sync === 'live') {
      readyPhase = 'fully_ready';
    } else if (sync === 'syncing') {
      readyPhase = 'sync_ready';
      blockingReasons.push('Syncing data');
    } else if (sync === 'error') {
      blockingReasons.push('Sync error');
    } else {
      // Only add "Connecting to server" if sync is idle AND we're not in an integrity validated state
      // The integrityValidated state means sync completed and integrity is good - should be considered ready
      const syncStateValue = snapshot.sync as string;
      if (syncStateValue !== 'integrityValidated') {
        blockingReasons.push('Connecting to server');
      } else {
        // Integrity validated state means we're ready
        readyPhase = 'fully_ready';
      }
    }
  } else if (context.isOfflineMode && context.lastKnownUser) {
    // Offline mode with cached user is considered ready
    readyPhase = 'offline';
    if (blockingReasons.length === 1 && blockingReasons[0] === 'Authentication required') {
      blockingReasons.length = 0; // Clear auth requirement in offline mode
    }
  }
  
  const isReady = blockingReasons.length === 0;
  const isLoading = !isReady;
  
  return {
    isReady,
    isLoading,
    readyPhase,
    blockingReasons,
  };
};

export const canLoadRoutes = (snapshot: AppStateSnapshot): boolean => {
  // 🔥 NEW: Use the abstracted flag from XState context
  // This is computed by the machine and includes all necessary checks
  return snapshot.context.canLoadRoutes;
};

export const getRouteLoadingInfo = (snapshot: AppStateSnapshot): RouteLoadingInfo => {
  const { connection, auth, database, sync, context } = snapshot;
  
  // Check auth (including offline mode)
  const hasAuth = auth === 'authenticated' || (context.isOfflineMode && context.lastKnownUser);
  
  if (!hasAuth) {
    return {
      canLoad: false,
      mode: 'offline',
      reason: 'Authentication required'
    };
  }
  
  if (database !== 'ready') {
    return {
      canLoad: false,
      mode: 'offline', 
      reason: 'Database not ready'
    };
  }
  
  // Determine mode based on connection and sync
  let mode: RouteLoadingInfo['mode'] = 'offline';
  let reason = 'Ready to load';
  
  if (connection === 'online' && !context.isOfflineMode) {
    if (sync === 'live') {
      mode = 'online';
      reason = 'Online with live sync';
    } else if (sync === 'syncing') {
      mode = 'degraded';
      reason = 'Syncing in progress - using local data';
    } else {
      mode = 'degraded';
      reason = 'Connecting to server - using local data';
    }
  } else {
    mode = 'offline';
    reason = context.isOfflineMode 
      ? 'Offline mode - using cached data'
      : 'Offline - using local data';
  }
  
  return {
    canLoad: true,
    mode,
    reason
  };
};

// ===== SYNC-SPECIFIC SELECTORS =====

export const getSyncProgress = (snapshot: AppStateSnapshot) => {
  const { sync, context } = snapshot;
  
  return {
    state: sync,
    currentLSN: context.currentLSN,
    serverLSN: context.serverLSN,
    lastSyncTime: context.lastSyncTime,
    error: context.syncError,
    isInitialSync: false,
    isCatchupSync: false,
    isLive: sync === 'live',
    hasError: !!context.syncError,
  };
};

// ===== DEBUG SELECTORS =====

export const getDebugInfo = (snapshot: AppStateSnapshot) => {
  return {
    states: {
      connection: snapshot.connection,
      auth: snapshot.auth,
      database: snapshot.database,
      sync: snapshot.sync,
      liveChanges: snapshot.liveChanges,
      appReadiness: snapshot.appReadiness,
    },
    context: snapshot.context,
    readiness: getAppReadinessInfo(snapshot),
    routing: getRouteLoadingInfo(snapshot),
    sync: getSyncProgress(snapshot),
    user: getUserDisplayInfo(snapshot),
  };
}; 