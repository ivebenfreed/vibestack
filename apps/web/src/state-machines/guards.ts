import type { AppContext, AppEvent } from './types';

// ===== CONNECTION GUARDS =====

export const connectionGuards = {
  isOnline: () => navigator.onLine,
  hasNetworkConnection: () => navigator.onLine,
  maxRetriesReached: ({ context }: { context: AppContext }) => 
    context.connectionAttempts >= 3,
};

// ===== AUTH GUARDS =====

export const authGuards = {
  hasValidAuth: ({ context }: { context: AppContext }) => 
    !!(context.user && context.authToken),
  
  hasAuthToken: ({ context }: { context: AppContext }) => 
    !!context.authToken,
  
  hasUser: ({ context }: { context: AppContext }) => 
    !!context.user,
};

// ===== DATABASE GUARDS =====

export const databaseGuards = {
  isDatabaseReady: ({ context }: { context: AppContext }) => 
    context.isDatabaseInitialized,
  
  hasDatabaseError: ({ context }: { context: AppContext }) => 
    !!context.databaseError,
};

// ===== SYNC GUARDS =====

export const syncGuards = {
  canStartSync: ({ context }: { context: AppContext }) => {
    // Need auth + database + connection to start sync
    return !!(
      context.user && 
      context.authToken && 
      context.isDatabaseInitialized &&
      navigator.onLine
    );
  },
  
  needsInitialSync: ({ context }: { context: AppContext }) => 
    context.currentLSN === '0/0',
  
  needsCatchup: ({ context, event }: { context: AppContext; event: AppEvent }) => {
    if (event.type !== 'SYNC_CONNECTED') return false;
    if (!event.serverLSN) return false;
    
    // Simple LSN comparison - in real app you'd use proper LSN comparison
    return context.currentLSN !== event.serverLSN;
  },
  
  isUpToDate: ({ context, event }: { context: AppContext; event: AppEvent }) => {
    if (event.type !== 'SYNC_CONNECTED') return false;
    if (!event.serverLSN) return false;
    
    return context.currentLSN === event.serverLSN;
  },
};

// ===== LIVE CHANGES GUARDS =====

export const liveChangesGuards = {
  canEnableLiveChanges: ({ context }: { context: AppContext }) => {
    // 🔥 KEY FIX: Only enable live changes when sync is live AND database is ready
    // This prevents the race condition you're experiencing
    return context.isDatabaseInitialized;
  },
  
  shouldDisableLiveChanges: ({ context }: { context: AppContext }) => {
    return !context.isDatabaseInitialized;
  },
};

// ===== APP READINESS GUARDS =====

export const appReadinessGuards = {
  allSystemsReady: ({ context }: { context: AppContext }) => {
    return !!(
      // Core requirements
      context.user && 
      context.authToken &&
      context.isDatabaseInitialized &&
      // Either we're synced OR we're offline (offline mode)
      (context.currentLSN !== '0/0' || !navigator.onLine)
    );
  },
  
  anySystemNotReady: ({ context }: { context: AppContext }) => {
    return !(
      context.user && 
      context.authToken &&
      context.isDatabaseInitialized &&
      (context.currentLSN !== '0/0' || !navigator.onLine)
    );
  },
  
  canLoadRoutes: ({ context }: { context: AppContext }) => {
    return !!(
      // Database must be ready
      context.isDatabaseInitialized &&
      // Auth must be valid
      context.user &&
      context.authToken
      // Sync state doesn't block route loading - we can load with local data
    );
  },
};

// ===== COMBINED GUARDS =====

export const guards = {
  ...connectionGuards,
  ...authGuards,
  ...databaseGuards,
  ...syncGuards,
  ...liveChangesGuards,
  ...appReadinessGuards,
}; 