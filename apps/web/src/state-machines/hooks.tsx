import React, { useMemo } from 'react';
import { useSelector } from '@xstate/react';
import { useNavigate } from '@tanstack/react-router';
import { authClient } from '@/lib/auth';
import type { UserInfo } from './types';

// Auth-focused hook - directly communicates with AuthMachine
export function useAuth() {
  const navigate = useNavigate();
  
  // Get AuthMachine directly from window (it's started independently)
  // Don't memoize - always get the current actor reference
  const authActor = (window as any).authMachineActor;

  // Safety check: only proceed if authActor exists
  if (!authActor) {
    return {
      user: null,
      authError: null,
      lastActivity: Date.now(),
      isAuthenticated: false,
      isSigningIn: false,
      isSigningOut: false,
      isCheckingAuth: true,
      userRole: null,
      isAdmin: false,
      isSuperAdmin: false,
      canAccessDebugFeatures: false,
      displayName: 'User',
      initials: 'U',
      signIn: () => console.error('[useAuth] AuthMachine not available'),
      signOut: () => console.error('[useAuth] AuthMachine not available'),
      refreshAuth: () => console.error('[useAuth] AuthMachine not available'),
    };
  }
  
  const user = useSelector(authActor, (state) => state?.context?.user || null);
  const authError = useSelector(authActor, (state) => state?.context?.authError || null);
  const lastActivity = useSelector(authActor, (state) => state?.context?.lastActivity || Date.now());
  
  // Auth token and session expiry are private to AuthMachine - components shouldn't need them
  // If needed for API calls, get them directly from authClient
  
  const isAuthenticated = useSelector(authActor, (state) => 
    state?.matches ? state.matches('authenticated') : false
  );
  const isSigningIn = useSelector(authActor, (state) => 
    state?.matches ? state.matches('signingIn') : false
  );
  const isSigningOut = useSelector(authActor, (state) => 
    state?.matches ? state.matches('signingOut') : false
  );
  const isCheckingAuth = useSelector(authActor, (state) => 
    state?.matches ? state.matches('checking') : true
  );

  const signIn = useMemo(() => (credentials: { email: string; password: string }) => {
    if (authActor) {
      // Check if actor is still active before sending events
      const snapshot = authActor.getSnapshot();
      if (snapshot.status === 'stopped') {
        console.log('[useAuth] Auth actor is stopped, skipping SIGN_IN event');
        return;
      }
      
      console.log('[useAuth] Sending SIGN_IN directly to AuthMachine');
      authActor.send({ type: 'SIGN_IN', credentials });
    } else {
      console.error('[useAuth] AuthMachine actor not available');
    }
  }, [authActor]);

  const signOut = useMemo(() => () => {
    if (authActor) {
      // Check if actor is still active before sending events
      const snapshot = authActor.getSnapshot();
      if (snapshot.status === 'stopped') {
        console.log('[useAuth] Auth actor is stopped, skipping SIGN_OUT event');
        // Just navigate since actor is stopped
        navigate({ to: '/sign-in', replace: true });
        return;
      }
      
      console.log('[useAuth] Immediate navigation to prevent component re-rendering');
      // Get current location to preserve as redirect
      const currentPath = window.location.pathname;
      // Don't redirect back to sign-in or sign-up pages
      const shouldPreserveRedirect = currentPath !== '/sign-in' && currentPath !== '/sign-up';
      
      // Navigate immediately to unmount all authenticated components
      navigate({ 
        to: '/sign-in', 
        search: shouldPreserveRedirect ? { redirect: currentPath } : {},
        replace: true 
      });
      
      console.log('[useAuth] Sending SIGN_OUT directly to AuthMachine');
      authActor.send({ type: 'SIGN_OUT' });
    } else {
      console.error('[useAuth] AuthMachine actor not available');
      // Fallback navigation
      navigate({ to: '/sign-in', replace: true });
    }
  }, [authActor, navigate]);

  const refreshAuth = useMemo(() => () => {
    if (authActor) {
      console.log('[useAuth] Sending REFRESH_AUTH directly to AuthMachine');
      authActor.send({ type: 'REFRESH_AUTH' });
    } else {
      console.error('[useAuth] AuthMachine actor not available');
    }
  }, [authActor]);

  // Computed values for display and role checking
  const userRole = user?.role || null;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';
  const canAccessDebugFeatures = isAdmin;
  const displayName = user?.name || user?.displayName || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return {
    // User data
    user,
    authError,
    lastActivity,
    
    // State flags
    isAuthenticated,
    isSigningIn,
    isSigningOut,
    isCheckingAuth,
    
    // Role data
    userRole,
    isAdmin,
    isSuperAdmin,
    canAccessDebugFeatures,
    displayName,
    initials,
    
    // Actions
    signIn,
    signOut,
    refreshAuth,
  };
}

// App initialization hook - directly from AppInitMachine
export function useAppInit() {
  // Get AppInitMachine directly from window (it's started independently)
  const actor = useMemo(() => {
    return (window as any).appInitActor;
  }, []);

  // Safety check: only proceed if actor exists
  if (!actor) {
    return {
      isDatabaseInitialized: false,
      databaseError: null,
      isSyncReady: false,
      syncError: null,
      connectionStatus: 'disconnected' as const,
      liveChangesStatus: 'idle' as const,
      isCheckingRequirements: true,
      isInitializingDatabase: false,
      isStartingSync: false,
      isReady: false,
      hasError: false,
      retryInit: () => console.error('[useAppInit] AppInitMachine not available'),
      restartSync: () => console.error('[useAppInit] AppInitMachine not available'),
    };
  }
  
  // Get data directly from app init machine snapshot
  const initMachineSnapshot = useSelector(actor, (state) => state);
  
  const isDatabaseInitialized = initMachineSnapshot?.context?.isDatabaseInitialized || false;
  const databaseError = initMachineSnapshot?.context?.databaseError || null;
  const isSyncReady = initMachineSnapshot?.context?.isSyncReady || false;
  const syncError = initMachineSnapshot?.context?.syncError || null;
  const connectionStatus = initMachineSnapshot?.context?.connectionStatus || 'disconnected';
  const liveChangesStatus = initMachineSnapshot?.context?.liveChangesStatus || 'idle';

  // Get AppInitMachine state directly
  const appInitState = initMachineSnapshot?.value || 'idle';
  
  const isCheckingRequirements = appInitState === 'idle';
  const isInitializingDatabase = appInitState === 'database';
  const isStartingSync = appInitState === 'sync';
  const isStartingLiveChanges = appInitState === 'live_changes';
  const isReady = appInitState === 'ready';
  const hasError = !!(databaseError || syncError);

  const retryInit = useMemo(() => () => {
    if (actor) {
      console.log('[useAppInit] Sending RETRY to AppInitMachine');
      actor.send({ type: 'RETRY' });
    } else {
      console.error('[useAppInit] AppInitMachine actor not available');
    }
  }, [actor]);

  const restartSync = useMemo(() => () => {
    if (actor) {
      console.log('[useAppInit] Sending RESTART_SYNC to AppInitMachine');
      actor.send({ type: 'RESTART_SYNC' });
    } else {
      console.error('[useAppInit] AppInitMachine actor not available');
    }
  }, [actor]);

  return {
    // Core states
    isDatabaseInitialized,
    databaseError,
    isSyncReady,
    syncError,
    connectionStatus,
    liveChangesStatus,
    
    // UI state flags
    isCheckingRequirements,
    isInitializingDatabase,
    isStartingSync,
    isStartingLiveChanges,
    isReady,
    hasError,
    
    // Actions
    retryInit,
    restartSync,
  };
}

// System hook - simple readiness check
export function useSystem() {
  // AppInit machine includes system readiness
  const { isReady } = useAppInit();
  
  return {
    isSystemReady: isReady,
    isSystemError: false, // AppInit handles errors
    systemError: null, // AppInit handles errors
  };
}

// Sync hook - directly from SyncMachine
export function useSync() {
  // Get sync machine from global actor
  const syncMachine = useMemo(() => {
    return (window as any).syncMachineActor || null;
  }, []);

  // Safety check: only proceed if syncMachine exists
  if (!syncMachine) {
    return {
      clientId: '',
      currentLSN: '0/0',
      syncPhase: null,
      isConnected: false,
      error: null,
      isInitialSync: false,
      isCatchupSync: false,
      isLiveSync: false,
      isError: false,
      isConnecting: false,
      isIdle: true,
      machineState: 'idle',
      syncPhaseProgress: null,
      isActive: false,
      statusText: 'Disconnected'
    };
  }

  // Subscribe to sync machine state changes
  const syncSnapshot = useSelector(syncMachine, (state) => state);
  
  const context = syncSnapshot?.context || {};
  const state = syncSnapshot?.value || 'idle';
  
  // Convert complex state object to string for easier checking
  const stateString = typeof state === 'string' ? state : JSON.stringify(state);
  
  // Determine connection status based on actual sync machine states
  const isConnected = stateString.includes('live_sync') || 
                     stateString.includes('initial_sync') || 
                     stateString.includes('catchup_sync') ||
                     stateString.includes('determining_sync_phase') ||
                     stateString.includes('services_ready');
  
  const isError = stateString.includes('error') || !!context.error;
  const isConnecting = stateString.includes('connecting') || stateString.includes('initialization');
  const isIdle = stateString === 'idle' || stateString.includes('disconnected');
  
  // Determine sync phases
  const isInitialSync = context.syncPhase === 'initial' || stateString.includes('initial_sync');
  const isCatchupSync = context.syncPhase === 'catchup' || stateString.includes('catchup_sync');
  const isLiveSync = context.syncPhase === 'live' || stateString.includes('live_sync');
  
  const isActive = isConnected && !isError;
  
  // Generate human-readable status text
  const statusText = isError ? 'Error' :
                    isConnecting ? 'Connecting...' :
                    isInitialSync ? 'Initial Sync' :
                    isCatchupSync ? 'Catchup Sync' :
                    isLiveSync ? 'Live' :
                    isIdle ? 'Disconnected' :
                    'Unknown';

  return {
    // Core sync state
    clientId: context.clientId || '',
    currentLSN: context.currentLSN || '0/0',
    syncPhase: context.syncPhase || null,
    
    // Connection status
    isConnected,
    error: context.error || null,
    
    // State booleans
    isInitialSync,
    isCatchupSync,
    isLiveSync,
    isError,
    isConnecting,
    isIdle,
    
    // State information
    machineState: stateString,
    syncPhaseProgress: context.syncPhaseProgress || null,
    isActive,
    statusText
  };
}