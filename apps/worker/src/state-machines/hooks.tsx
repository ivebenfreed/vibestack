import React, { useMemo } from 'react';
import { useSelector } from '@xstate/react';
import { useNavigate } from '@tanstack/react-router';
import { authClient } from '@/lib/auth';
import type { UserInfo } from './types';
import { log } from '@/logger';

const myLog = log('state-machines/hooks.tsx');

// Auth-focused hook - directly communicates with AuthMachine
export function useAuth() {
  const navigate = useNavigate();
  
  // Get AuthMachine directly from window (it's started independently)
  // Don't memoize - always get the current actor reference
  const authActor = (window as any).authMachineActor;

  // Safety check: only proceed if authActor exists
  if (!authActor) {
    return {
      // Auth properties
      user: null,
      authError: null,
      lastActivity: Date.now(),
      isAuthenticated: false,
      isSigningIn: false,
      isSigningOut: false,
      isCheckingAuth: true,
      isInErrorRecovery: false,
      errorRetryCount: 0,
      userRole: null,
      isAdmin: false,
      isSuperAdmin: false,
      isMember: false,
      isViewer: false,
      canAccessDebugFeatures: false,
      canAccessDebug: false,
      displayName: 'User',
      initials: 'U',
      displayUser: null,
      isLoading: false,
      error: null,
      
      // Organization properties
      currentOrganization: null,
      userOrganizations: [],
      organizationError: null,
      isLoadingOrganizations: false,
      needsOrganizationSelection: false,
      isAuthenticatedAndReady: false,
      organizationSetupComplete: false,
      hasMultipleOrganizations: false,
      organizationName: 'No Organization',
      
      // Billing/Trial data
      isTrialExpired: false,
      needsBillingSetup: false,
      subscriptionInfo: null,
      trialStatus: null,
      
      // Auth actions
      signIn: () => log.error('[useAuth] AuthMachine not available'),
      signOut: () => log.error('[useAuth] AuthMachine not available'),
      refreshAuth: () => log.error('[useAuth] AuthMachine not available'),
      
      // Organization actions
      createOrganization: () => log.error('[useAuth] AuthMachine not available'),
      selectOrganization: () => log.error('[useAuth] AuthMachine not available'),
      switchOrganization: () => log.error('[useAuth] AuthMachine not available'),
      reloadOrganizations: () => log.error('[useAuth] AuthMachine not available'),
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
  const isInErrorRecovery = useSelector(authActor, (state) => 
    state?.matches ? state.matches('errorRecovery') : false
  );
  const errorRetryCount = useSelector(authActor, (state) => 
    state?.context?.errorRetryCount || 0
  );

  // Organization selectors
  const currentOrganization = useSelector(authActor, (state) => 
    state?.context?.currentOrganization || null
  );
  const userOrganizations = useSelector(authActor, (state) => 
    state?.context?.userOrganizations || []
  );
  const organizationError = useSelector(authActor, (state) => 
    state?.context?.organizationError || null
  );
  const isLoadingOrganizations = useSelector(authActor, (state) => 
    state?.context?.isLoadingOrganizations || false
  );
  const organizationSetupComplete = useSelector(authActor, (state) => 
    state?.context?.organizationSetupComplete || false
  );
  
  // Organization state checks
  const needsOrganizationSelection = useSelector(authActor, (state) => 
    state?.matches ? state.matches('authenticated.needsOrganizationSelection') : false
  );
  const isAuthenticatedAndReady = useSelector(authActor, (state) => 
    state?.matches ? state.matches('authenticated.ready') : false
  );

  const signIn = useMemo(() => (credentials: { email: string; password: string }) => {
    if (authActor) {
      // Check if actor is still active before sending events
      const snapshot = authActor.getSnapshot();
      if (snapshot.status === 'stopped') {
        myLog.info('[useAuth] Auth actor is stopped, skipping SIGN_IN event');
        return;
      }
      
      myLog.info('[useAuth] Sending SIGN_IN directly to AuthMachine');
      authActor.send({ type: 'SIGN_IN', credentials });
    } else {
      myLog.error('[useAuth] AuthMachine actor not available');
    }
  }, [authActor]);

  const signOut = useMemo(() => () => {
    if (authActor) {
      // Check if actor is still active before sending events
      const snapshot = authActor.getSnapshot();
      if (snapshot.status === 'stopped') {
        myLog.info('[useAuth] Auth actor is stopped, skipping SIGN_OUT event');
        // Just navigate since actor is stopped
        navigate({ to: '/sign-in', replace: true });
        return;
      }
      
      myLog.info('[useAuth] Immediate navigation to prevent component re-rendering');
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
      
      myLog.info('[useAuth] Sending SIGN_OUT directly to AuthMachine');
      authActor.send({ type: 'SIGN_OUT' });
    } else {
      myLog.error('[useAuth] AuthMachine actor not available');
      // Fallback navigation
      navigate({ to: '/sign-in', replace: true });
    }
  }, [authActor, navigate]);

  const refreshAuth = useMemo(() => () => {
    if (authActor) {
      myLog.info('[useAuth] Sending CHECK_AUTH directly to AuthMachine');
      authActor.send({ type: 'CHECK_AUTH' });
    } else {
      myLog.error('[useAuth] AuthMachine actor not available');
    }
  }, [authActor]);

  // Organization actions
  const createOrganization = useMemo(() => (organizationData: { name: string; domain?: string }) => {
    if (authActor) {
      myLog.info('[useAuth] Creating organization:', organizationData);
      authActor.send({ type: 'CREATE_ORGANIZATION', organizationData });
    }
  }, [authActor]);

  const selectOrganization = useMemo(() => (organizationId: string) => {
    if (authActor) {
      myLog.info('[useAuth] Selecting organization:', organizationId);
      authActor.send({ type: 'SELECT_ORGANIZATION', organizationId });
    }
  }, [authActor]);

  const switchOrganization = useMemo(() => (organizationId: string) => {
    if (authActor) {
      myLog.info('[useAuth] Switching organization:', organizationId);
      authActor.send({ type: 'SWITCH_ORGANIZATION', organizationId });
    }
  }, [authActor]);

  const reloadOrganizations = useMemo(() => () => {
    if (authActor) {
      myLog.info('[useAuth] Reloading organizations');
      authActor.send({ type: 'REFRESH_ORGANIZATIONS' });
    }
  }, [authActor]);

  // Computed values for display and role checking
  const userRole = user?.role || null;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';
  const isMember = userRole === 'member';
  const isViewer = userRole === 'viewer';
  const canAccessDebugFeatures = isAdmin;
  const canAccessDebug = isAdmin; // Alias for compatibility
  const displayName = user?.name || user?.displayName || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  
  // Trial expiration selector
  const isTrialExpired = useSelector(authActor, (state) => 
    state?.context?.isTrialExpired || false
  );
  const needsBillingSetup = useSelector(authActor, (state) => 
    state?.context?.needsBillingSetup || false
  );
  const subscriptionInfo = useSelector(authActor, (state) => 
    state?.context?.subscriptionInfo || null
  );
  const trialStatus = useSelector(authActor, (state) => 
    state?.context?.trialStatus || null
  );
  
  // Organization computed values
  const hasMultipleOrganizations = userOrganizations.length > 1;
  const organizationName = currentOrganization?.name || 'No Organization';
  const effectiveUserRole = currentOrganization?.role || user?.role || null;

  // Additional computed properties for compatibility
  const displayUser = user; // Alias for useSimpleAuth compatibility
  const isLoading = isSigningIn; // Alias for useSimpleAuth compatibility
  const error = authError; // Alias for useSimpleAuth compatibility

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
    isInErrorRecovery,
    errorRetryCount,
    
    // Role data
    userRole,
    isAdmin,
    isSuperAdmin,
    isMember,
    isViewer,
    canAccessDebugFeatures,
    canAccessDebug,
    displayName,
    initials,
    
    // Organization data
    currentOrganization,
    userOrganizations,
    organizationError,
    isLoadingOrganizations,
    needsOrganizationSelection,
    isAuthenticatedAndReady,
    organizationSetupComplete,
    hasMultipleOrganizations,
    organizationName,
    effectiveUserRole,
    
    // Billing/Trial data
    isTrialExpired,
    needsBillingSetup,
    subscriptionInfo,
    trialStatus,
    
    // Compatibility aliases
    displayUser,
    isLoading,
    error,
    
    // Actions
    signIn,
    signOut,
    refreshAuth,
    
    // Organization actions
    createOrganization,
    selectOrganization,
    switchOrganization,
    reloadOrganizations,
  };
}

// Legend State system readiness hook - replaces app init machine
export function useAppInit() {
  // Legend State handles its own initialization - check observables directly
  const [isReady, setIsReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    // Dynamic import to avoid circular dependencies
    import('../legend-state').then(({ universeLoading$, universeError$, universeUserId$, universeOrgId$, universeSchema$ }) => {
      // Subscribe to universe state using individual observables
      const unsubscribe = universeSchema$.onChange(() => {
        // Get the current universe state
        const schema = universeSchema$.peek();
        const userId = universeUserId$.peek();
        const orgId = universeOrgId$.peek();
        const isLoading = universeLoading$.peek();
        const error = universeError$.peek();
        
        const hasOrgAndUser = !!(orgId && userId);
        const hasSchema = !!(schema && Object.keys(schema.entities || {}).length > 0);
        
        // System is ready when we have org, user, and schema loaded
        setIsReady(hasOrgAndUser && hasSchema && !isLoading);
        setError(error);
      });
      
      return unsubscribe;
    }).catch((err) => {
      myLog.error('[useAppInit] Failed to import Legend State:', err);
      setError('Failed to load Legend State');
    });
  }, []);

  return {
    // Core states (simplified - Legend State manages complexity internally)
    isDatabaseInitialized: isReady,
    databaseError: error,
    isSyncReady: isReady,
    syncError: null, // Sync machine handles its own errors
    connectionStatus: 'connected' as const, // Simplified - sync machine manages this
    liveChangesStatus: 'connected' as const, // Simplified
    
    // UI state flags
    isCheckingRequirements: !isReady && !error,
    isInitializingDatabase: !isReady && !error,
    isStartingSync: false, // Sync is independent
    isStartingLiveChanges: false,
    isReady,
    hasError: !!error,
    
    // Actions (simplified - Legend State handles retries internally)
    retryInit: () => {
      myLog.info('[useAppInit] Legend State handles retries automatically');
    },
    restartSync: () => {
      myLog.info('[useAppInit] Use sync machine directly for restart');
      const syncActor = (window as any).simpleNotificationSyncMachineActor;
      if (syncActor) {
        syncActor.send({ type: 'RECONNECT' });
      }
    },
  };
}

// System hook - Legend State readiness check
export function useSystem() {
  // Use Legend State readiness instead of app init machine
  const { isReady, hasError, databaseError } = useAppInit();
  
  return {
    isSystemReady: isReady,
    isSystemError: hasError,
    systemError: databaseError,
  };
}

// Sync hook - directly from SyncMachine
export function useSync() {
  // Get sync machine from global actor - updated for simple notification sync machine
  const syncMachine = useMemo(() => {
    const machine = (window as any).simpleNotificationSyncMachineActor || (window as any).syncMachineActor || null;
    myLog.info('[useSync] Found sync machine:', !!machine, machine ? 'type: simpleNotificationSyncMachine' : 'no machine');
    return machine;
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
  
  // Determine connection status based on simple notification sync machine states
  const isConnected = stateString === 'connected' || context.isConnected === true;
  const isError = stateString === 'error' || !!context.error;
  const isConnecting = stateString === 'connecting';
  const isIdle = stateString === 'disconnected';
  
  // Simple notification sync machine doesn't have complex sync phases
  const isInitialSync = false; // No initial sync phase in simple notification sync
  const isCatchupSync = false; // No catchup sync phase in simple notification sync  
  const isLiveSync = isConnected; // Connected state means we're receiving notifications
  
  const isActive = isConnected && !isError;
  
  // Generate human-readable status text for simple notification sync
  const statusText = isError ? `Error${context.error ? `: ${context.error}` : ''}` :
                    isConnecting ? 'Connecting...' :
                    isConnected ? 'Connected (Live Notifications)' :
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