import React, { useMemo } from 'react';
import { useSelector } from '@xstate/react';
import { useNavigate } from '@tanstack/react-router';
import { authClient } from '@/lib/auth';
import type { UserInfo } from './types';
import { log } from '@/logger';

const myLog = log('state-machines/hooks.tsx');

// Auth-focused hook - AUTH MACHINE REMOVED, Legend State handles auth
// This hook now provides stub implementation for compatibility
export function useAuth() {
  const navigate = useNavigate();
  
  myLog.info('[useAuth] 📝 Auth machine removed - use useUnifiedAuth instead');
  
  // Return stub implementation - auth machine no longer exists
  // Components should migrate to useUnifiedAuth for actual auth functionality
  return {
    // Auth properties
    user: null,
    authError: null,
    lastActivity: Date.now(),
    isAuthenticated: false,
    isSigningIn: false,
    isSigningOut: false,
    isCheckingAuth: false,
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
    effectiveUserRole: null,
    
    // Billing/Trial data
    isTrialExpired: false,
    needsBillingSetup: false,
    subscriptionInfo: null,
    trialStatus: null,
    
    // Auth actions - stubs that redirect to useUnifiedAuth
    signIn: (credentials: { email: string; password: string }) => {
      myLog.warn('[useAuth] Auth machine removed - use useUnifiedAuth.signIn instead');
    },
    signOut: () => {
      myLog.warn('[useAuth] Auth machine removed - use useUnifiedAuth.signOut instead');
    },
    refreshAuth: () => {
      myLog.warn('[useAuth] Auth machine removed - use useUnifiedAuth.refreshAuth instead');
    },
    
    // Organization actions - stubs
    createOrganization: (organizationData: { name: string; domain?: string }) => {
      myLog.warn('[useAuth] Auth machine removed - use Legend State or API directly');
    },
    selectOrganization: (organizationId: string) => {
      myLog.warn('[useAuth] Auth machine removed - use Legend State or API directly');
    },
    switchOrganization: (organizationId: string) => {
      myLog.warn('[useAuth] Auth machine removed - use Legend State or API directly');
    },
    reloadOrganizations: () => {
      myLog.warn('[useAuth] Auth machine removed - use Legend State or API directly');
    },
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