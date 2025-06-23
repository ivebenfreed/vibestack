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
      // Navigate immediately to unmount all authenticated components
      navigate({ to: '/sign-in', replace: true });
      
      console.log('[useAuth] Sending SIGN_OUT directly to AuthMachine');
      authActor.send({ type: 'SIGN_OUT' });
    } else {
      console.error('[useAuth] AuthMachine actor not available');
    }
  }, [authActor, navigate]);

  const refreshAuth = useMemo(() => () => {
    if (authActor) {
      // Check if actor is still active before sending events
      const snapshot = authActor.getSnapshot();
      if (snapshot.status === 'stopped') {
        console.log('[useAuth] Auth actor is stopped, skipping CHECK_AUTH event');
        return;
      }
      
      console.log('[useAuth] Sending CHECK_AUTH directly to AuthMachine');
      authActor.send({ type: 'CHECK_AUTH' });
    } else {
      console.error('[useAuth] AuthMachine actor not available');
    }
  }, [authActor]);

  // Computed display properties for backward compatibility
  const displayName = useMemo(() => {
    if (!user) return 'User';
    return user.name || user.email?.split('@')[0] || 'User';
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return 'U';
    const name = user.name || user.email?.split('@')[0] || 'User';
    return name.slice(0, 2).toUpperCase();
  }, [user]);

  const userRole = user?.role || null;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  return {
    // State
    user,
    authError,
    lastActivity,
    
    // Status
    isAuthenticated,
    isSigningIn,
    isSigningOut,
    isCheckingAuth,
    
    // User role info
    userRole,
    isAdmin,
    isSuperAdmin,
    canAccessDebugFeatures: isAdmin,
    
    // User display info
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
  const isReady = appInitState === 'ready';
  const hasError = appInitState === 'error';

  const retryInit = useMemo(() => () => {
    actor.send({ type: 'RETRY_INIT' });
  }, [actor]);

  const restartSync = useMemo(() => () => {
    actor.send({ type: 'RESTART_SYNC' });
  }, [actor]);

  return {
    // Database state
    isDatabaseInitialized,
    databaseError,
    
    // Sync state
    isSyncReady,
    syncError,
    connectionStatus,
    liveChangesStatus,
    
    // Status
    isCheckingRequirements,
    isInitializingDatabase,
    isStartingSync,
    isReady,
    hasError,
    
    // Actions
    retryInit,
    restartSync,
  };
}

// System hook - app initialization state directly from app init machine
export function useSystem() {
  // Get app init machine directly from window
  const appInitMachine = useMemo(() => {
    return (window as any).appInitActor;
  }, []);

  // Safety check: only proceed if app init machine exists
  if (!appInitMachine) {
    return {
      isSystemReady: false,
      isInitializing: false,
      hasAnyError: false,
      errors: [],
    };
  }
  
  // Subscribe directly to app init machine state changes
  const appInitSnapshot = useSelector(appInitMachine, (state) => state);
  
  const isSystemReady = appInitSnapshot?.value === 'ready' || false;
  const isInitializing = appInitSnapshot?.value && !['idle', 'ready', 'error'].includes(appInitSnapshot.value as string) || false;
  
  if (import.meta.env.MODE === 'development') {
    console.log('[useSystem] isSystemReady selector:', { 
      isReady: isSystemReady, 
      appInitState: appInitSnapshot?.value, 
      timestamp: Date.now() 
    });
  }
  
  // Get error states from app init machine
  const databaseError = appInitSnapshot?.context?.databaseError || null;
  const syncError = appInitSnapshot?.context?.syncError || null;
  
  const hasAnyError = !!(databaseError || syncError);

  // Get all errors in one place
  const errors: string[] = [];
  if (databaseError) errors.push(databaseError);
  if (syncError) errors.push(syncError);

  return {
    // High-level status
    isSystemReady,
    isInitializing,
    hasAnyError,
    
    // Error aggregation
    errors,
  };
}

// Direct sync machine hook - accesses sync machine state directly
export function useSync() {
  // Get sync machine from app init machine's children
  const syncMachine = useMemo(() => {
    const appInitActor = (window as any).appInitActor;
    if (!appInitActor) return null;
    
    const appInitSnapshot = appInitActor.getSnapshot();
    return appInitSnapshot?.children?.syncMachine;
  }, []);

  // Safety check: return default state if sync machine not available
  if (!syncMachine) {
    return {
      clientId: null,
      currentLSN: null,
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
      statusText: 'Idle'
    };
  }

  // Subscribe to sync machine state changes
  const syncSnapshot = useSelector(syncMachine, (state) => state);
  
  const context = syncSnapshot?.context || {};
  const state = syncSnapshot?.value || 'idle';
  
  // Debug logging
  console.log('[useSync] Sync machine state:', {
    state,
    syncPhase: context.syncPhase,
    clientId: context.clientId,
    currentLSN: context.currentLSN
  });
  
  // Check if state is a string or object with nested states
  const stateString = typeof state === 'string' ? state : JSON.stringify(state);
  
  // Determine connection status based on actual sync machine states
  const isConnected = stateString.includes('live_sync') || 
                     stateString.includes('initial_sync') || 
                     stateString.includes('catchup_sync') ||
                     stateString.includes('determining_sync_phase') ||
                     stateString.includes('services_ready');
  
  return {
    // Core sync state
    clientId: context.clientId,
    currentLSN: context.currentLSN,
    syncPhase: context.syncPhase,
    
    // Connection status
    isConnected,
    error: context.error,
    
    // State booleans
    isInitialSync: context.syncPhase === 'initial' || state === 'initial_sync',
    isCatchupSync: context.syncPhase === 'catchup' || state === 'catchup_sync',
    isLiveSync: context.syncPhase === 'live' || state === 'live_sync',
    isError: state === 'error' || !!context.error,
    isConnecting: state === 'connecting' || stateString.includes('connecting'),
    isIdle: state === 'idle',
    
    // Machine state
    machineState: typeof state === 'string' ? state : Object.keys(state)[0],
    
    // Detailed progress (if available)
    syncPhaseProgress: context.phaseProgress,
    
    // Convenience getters
    isActive: ['connecting', 'initial_sync', 'catchup_sync', 'live_sync', 'determining_sync_phase'].some(s => 
      stateString.includes(s)
    ),
    
    statusText: context.error ? 'Error' :
                state === 'connecting' ? 'Connecting...' :
                state === 'initial_sync' || context.syncPhase === 'initial' ? 'Initial Sync' :
                state === 'catchup_sync' || context.syncPhase === 'catchup' ? 'Catchup Sync' :
                state === 'live_sync' || context.syncPhase === 'live' ? 'Live' :
                state === 'idle' ? 'Idle' :
                'Syncing'
  };
}


// No longer exporting context - using direct actor access pattern