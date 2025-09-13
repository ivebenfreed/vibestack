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
      myLog.info('[useAppInit] Using Legend State sync manager for restart');
      import('../legend-state/sync-manager').then(({ syncActions }) => {
        syncActions.reconnect().catch((error) => {
          myLog.error('[useAppInit] Failed to reconnect sync manager:', error);
        });
      }).catch((error) => {
        myLog.error('[useAppInit] Failed to import sync manager for restart:', error);
      });
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

// Sync hook - now uses Legend State reactive sync manager
export function useSync() {
  // Use Legend State sync connection hook directly with proper reactivity
  const [syncConnection, setSyncConnection] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  
  // Import and use the Legend State sync manager directly
  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    import('../legend-state/sync-manager').then(({ syncState$, connectionStatus$, statusText$ }) => {
      try {
        // Subscribe to sync state changes reactively using Legend State
        unsubscribe = syncState$.onChange(() => {
          const state = syncState$.peek();
          const status = connectionStatus$.peek();
          const statusMessage = statusText$.peek();
          
          setSyncConnection({
            isConnected: state.isConnected,
            isConnecting: state.isConnecting,
            error: state.error,
            clientId: state.clientId,
            organizationId: state.organizationId,
            userId: state.userId,
            serverUrl: state.serverUrl,
            reconnectAttempts: state.reconnectAttempts,
            maxReconnectAttempts: state.maxReconnectAttempts,
            lastNotification: state.lastNotification,
            connectionStatus: status,
            statusText: statusMessage
          });
        });
        
        // Set initial state immediately
        const initialState = syncState$.peek();
        const initialStatus = connectionStatus$.peek();
        const initialStatusMessage = statusText$.peek();
        
        setSyncConnection({
          isConnected: initialState.isConnected,
          isConnecting: initialState.isConnecting,
          error: initialState.error,
          clientId: initialState.clientId,
          organizationId: initialState.organizationId,
          userId: initialState.userId,
          serverUrl: initialState.serverUrl,
          reconnectAttempts: initialState.reconnectAttempts,
          maxReconnectAttempts: initialState.maxReconnectAttempts,
          lastNotification: initialState.lastNotification,
          connectionStatus: initialStatus,
          statusText: initialStatusMessage
        });
        
      } catch (err) {
        myLog.error('[useSync] Failed to setup sync manager subscription:', err);
        setError('Failed to load sync manager');
      }
    }).catch((err) => {
      myLog.error('[useSync] Failed to import sync manager:', err);
      setError('Failed to load sync manager');
    });
    
    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Return compatibility interface matching old XState-based hook
  if (error) {
    return {
      clientId: '',
      currentLSN: '0/0',
      syncPhase: null,
      isConnected: false,
      error,
      isInitialSync: false,
      isCatchupSync: false,
      isLiveSync: false,
      isError: true,
      isConnecting: false,
      isIdle: true,
      machineState: 'error',
      syncPhaseProgress: null,
      isActive: false,
      statusText: `Error: ${error}`
    };
  }

  if (!syncConnection) {
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

  // Map Legend State sync manager state to XState-compatible interface
  const isConnected = syncConnection.isConnected;
  const isError = !!syncConnection.error;
  const isConnecting = syncConnection.isConnecting;
  const isIdle = !isConnected && !isConnecting && !isError;
  
  // Legend State sync manager focuses on notifications, not complex sync phases
  const isInitialSync = false; // No initial sync phase in notification-based sync
  const isCatchupSync = false; // No catchup sync phase in notification-based sync  
  const isLiveSync = isConnected; // Connected state means we're receiving live notifications
  
  const isActive = isConnected && !isError;
  
  // Use status text from Legend State sync manager if available, otherwise generate fallback
  const statusText = syncConnection.statusText || 
                    (isError ? `Error${syncConnection.error ? `: ${syncConnection.error}` : ''}` :
                     isConnecting ? 'Connecting...' :
                     isConnected ? 'Connected - receiving notifications' :
                     isIdle ? 'Disconnected' :
                     'Unknown');

  // Use connection status from Legend State if available, otherwise determine from state
  const machineState = syncConnection.connectionStatus || 
                      (isError ? 'error' :
                       isConnecting ? 'connecting' :
                       isConnected ? 'connected' :
                       'disconnected');

  return {
    // Core sync state - adapted from Legend State
    clientId: syncConnection.clientId || '',
    currentLSN: '0/0', // Legend State doesn't use LSN concept
    syncPhase: null, // Legend State doesn't have sync phases
    
    // Connection status
    isConnected,
    error: syncConnection.error || null,
    
    // State booleans
    isInitialSync,
    isCatchupSync,
    isLiveSync,
    isError,
    isConnecting,
    isIdle,
    
    // State information
    machineState,
    syncPhaseProgress: null, // No progress tracking in notification sync
    isActive,
    statusText
  };
}