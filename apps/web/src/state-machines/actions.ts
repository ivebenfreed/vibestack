import { assign } from 'xstate';
import type { AppContext, AppEvent } from './types';

// ===== CONNECTION ACTIONS =====

export const connectionActions = {
  incrementConnectionAttempts: assign({
    connectionAttempts: ({ context }: { context: AppContext }) => 
      context.connectionAttempts + 1,
    lastActivity: () => Date.now(),
  }),
  
  resetConnectionAttempts: assign({
    connectionAttempts: () => 0,
    lastConnectionError: () => null,
  }),
  
  storeConnectionError: assign({
    lastConnectionError: ({ event }: { event: AppEvent }) => 
      event.type === 'CONNECTION_FAILED' ? event.error : null,
  }),
};

// ===== ENHANCED AUTH ACTIONS (includes authStore logic) =====

export const authActions = {
  storeAuthData: assign({
    user: ({ event }: { event: AppEvent }) => 
      event.type === 'LOGIN_SUCCESS' ? event.user : null,
    authToken: ({ event }: { event: AppEvent }) => 
      event.type === 'LOGIN_SUCCESS' ? event.token : null,
    lastKnownUser: ({ event }: { event: AppEvent }) => 
      event.type === 'LOGIN_SUCCESS' ? event.user : null, // Cache user on login
    isOfflineMode: () => false, // Clear offline mode on fresh login
    lastActivity: () => Date.now(),
  }),
  
  clearAuthData: assign({
    user: () => null,
    authToken: () => null,
    // Keep lastKnownUser for offline access
    // Don't clear isOfflineMode - let it persist
  }),
  
  updateAuthToken: assign({
    authToken: ({ event }: { event: AppEvent }) => 
      event.type === 'AUTH_TOKEN_RECEIVED' ? event.token : null,
  }),
  
  // New actions from authStore
  cacheUser: assign({
    lastKnownUser: ({ event }: { event: AppEvent }) => 
      event.type === 'CACHE_USER' ? event.user : null,
    isOfflineMode: () => false, // Fresh user data means we're online
  }),
  
  setOfflineMode: assign({
    isOfflineMode: ({ event }: { event: AppEvent }) => 
      event.type === 'SET_OFFLINE_MODE' ? event.offline : false,
  }),
  
  clearUserCache: assign({
    lastKnownUser: () => null,
    isOfflineMode: () => false,
  }),
};

// ===== DATABASE ACTIONS =====

export const databaseActions = {
  markDatabaseReady: assign({
    isDatabaseInitialized: () => true,
    databaseError: () => null,
    lastActivity: () => Date.now(),
  }),
  
  storeDatabaseError: assign({
    isDatabaseInitialized: () => false,
    databaseError: ({ event }: { event: AppEvent }) => 
      event.type === 'DATABASE_ERROR' ? event.error : null,
  }),
  
  resetDatabaseState: assign({
    isDatabaseInitialized: () => false,
    databaseError: () => null,
  }),
};

// ===== SYNC ACTIONS =====

export const syncActions = {
  updateServerLSN: assign({
    serverLSN: ({ event }: { event: AppEvent }) => {
      if (event.type === 'SYNC_CONNECTED') return event.serverLSN;
      return null;
    },
  }),
  
  updateCurrentLSN: assign({
    currentLSN: ({ event }: { event: AppEvent }) => {
      if (event.type === 'INITIAL_SYNC_COMPLETE') return event.finalLSN;
      if (event.type === 'CATCHUP_COMPLETE') return event.finalLSN;
      if (event.type === 'LSN_UPDATE') return event.lsn;
      return ({ context }: { context: AppContext }) => context.currentLSN;
    },
    lastSyncTime: () => Date.now(),
    syncError: () => null,
  }),
  
  storeSyncError: assign({
    syncError: ({ event }: { event: AppEvent }) => 
      event.type === 'SYNC_ERROR' ? event.error : null,
  }),
  
  clearSyncError: assign({
    syncError: () => null,
  }),
};

// ===== LIVE CHANGES ACTIONS =====

export const liveChangesActions = {
  enableLiveChanges: assign({
    isLiveChangesEnabled: () => true,
    lastActivity: () => Date.now(),
  }),
  
  disableLiveChanges: assign({
    isLiveChangesEnabled: () => false,
  }),
  
  recordLiveChange: assign({
    lastLiveChangeTime: () => Date.now(),
    lastActivity: () => Date.now(),
  }),
};

// ===== SYSTEM ACTIONS =====

export const systemActions = {
  recordActivity: assign({
    lastActivity: () => Date.now(),
  }),
  
  initializeApp: assign({
    startupTime: () => Date.now(),
    lastActivity: () => Date.now(),
    connectionAttempts: () => 0,
    currentLSN: () => '0/0', // Will be loaded from persistence later
    // Initialize auth cache
    lastKnownUser: () => null,
    isOfflineMode: () => false,
  }),
};

// ===== SIDE EFFECT ACTIONS (no assign) =====

export const sideEffectActions = {
  // 🔥 KEY ACTION: Notify LiveChangesManager to start/stop
  notifyEnableLiveChanges: () => {
    console.log('[AppMachine] 🟢 Enabling live changes - sync is ready');
    window.dispatchEvent(new CustomEvent('app:enable-live-changes'));
  },
  
  notifyDisableLiveChanges: () => {
    console.log('[AppMachine] 🔴 Disabling live changes - sync not ready');
    window.dispatchEvent(new CustomEvent('app:disable-live-changes'));
  },
  
  notifyAppReady: () => {
    console.log('[AppMachine] 🎉 App is ready for use');
    window.dispatchEvent(new CustomEvent('app:ready'));
  },
  
  notifyAppNotReady: () => {
    console.log('[AppMachine] ⏳ App is not ready');
    window.dispatchEvent(new CustomEvent('app:not-ready'));
  },
  
  // Sync-related notifications
  notifyInitialSyncStart: () => {
    console.log('[AppMachine] 🔄 Initial sync starting');
    window.dispatchEvent(new CustomEvent('app:initial-sync-start'));
  },
  
  notifyInitialSyncComplete: () => {
    console.log('[AppMachine] ✅ Initial sync complete');
    window.dispatchEvent(new CustomEvent('app:initial-sync-complete'));
  },
  
  notifyCatchupStart: () => {
    console.log('[AppMachine] 🔄 Catchup sync starting');
    window.dispatchEvent(new CustomEvent('app:catchup-sync-start'));
  },
  
  notifyCatchupComplete: () => {
    console.log('[AppMachine] ✅ Catchup sync complete');
    window.dispatchEvent(new CustomEvent('app:catchup-sync-complete'));
  },
  
  notifyLiveReady: () => {
    console.log('[AppMachine] 🎯 Live sync ready');
    window.dispatchEvent(new CustomEvent('app:live-sync-ready'));
  },
  
  // Auth-related side effects (from authStore)
  logUserCache: ({ context }: { context: AppContext }) => {
    if (context.lastKnownUser) {
      console.log('[AppMachine] Caching user for offline access:', context.lastKnownUser.id);
    }
  },
  
  logOfflineMode: ({ context }: { context: AppContext }) => {
    console.log('[AppMachine] Setting offline mode:', context.isOfflineMode);
  },
};

// ===== COMBINED ACTIONS =====

export const actions = {
  ...connectionActions,
  ...authActions,
  ...databaseActions,
  ...syncActions,
  ...liveChangesActions,
  ...systemActions,
  ...sideEffectActions,
}; 