import { useSelector } from '@xstate/react';
import { useContext, createContext, type ReactNode } from 'react';
import type { ActorRefFrom } from 'xstate';
import type { orchestrator } from './orchestrator';
import type { OrchestratorContext, OrchestratorEvent } from './orchestrator';

// ===== CONTEXT =====

type OrchestratorActor = ActorRefFrom<typeof orchestrator>;

const OrchestratorContext = createContext<OrchestratorActor | null>(null);

export function OrchestratorProvider({ 
  children, 
  actor 
}: { 
  children: ReactNode; 
  actor: OrchestratorActor; 
}) {
  return (
    <OrchestratorContext.Provider value={actor}>
      {children}
    </OrchestratorContext.Provider>
  );
}

export function useOrchestratorActor() {
  const actor = useContext(OrchestratorContext);
  if (!actor) {
    throw new Error('useOrchestratorActor must be used within OrchestratorProvider');
  }
  return actor;
}

// ===== MAIN ORCHESTRATOR HOOK =====

export function useOrchestrator() {
  const actor = useOrchestratorActor();
  
  const state = useSelector(actor, (snapshot) => {
    // Helper function to get current state phase
    const getCurrentPhase = () => {
      const stateValue = snapshot.value;
      if (typeof stateValue === 'string') {
        return stateValue;
      }
      // Handle nested states - only go one level deep for main phases
      if (typeof stateValue === 'object' && stateValue !== null) {
        const keys = Object.keys(stateValue);
        if (keys.length > 0) {
          const mainKey = keys[0];
          const subState = (stateValue as any)[mainKey];
          if (typeof subState === 'string') {
            return `${mainKey}.${subState}`;
          }
          // If subState is also an object (nested further), just return the main key
          return mainKey;
        }
      }
      return stateValue;
    };

    const currentPhase = getCurrentPhase();
    
    return {
      // Current state information
      state: snapshot,
      currentPhase,
      
      // Context data
      context: snapshot.context,
      
      // Computed readiness flags
      canLoadRoutes: snapshot.context.isSystemReady,
      isSystemReady: snapshot.context.isSystemReady,
      
      // Auth info
      isAuthenticated: !!snapshot.context.user,
      user: snapshot.context.user,
      authError: snapshot.context.authError,
      
      // Database info
      isDatabaseReady: snapshot.context.isDatabaseInitialized,
      databaseError: snapshot.context.databaseError,
      
      // System status
      isOnline: snapshot.context.isOnline,
      isSyncLive: snapshot.context.isSyncLive,
      areLiveChangesActive: snapshot.context.liveChangesActive,
    };
  });
  
  return {
    ...state,
    send: actor.send,
    
    // Convenience actions
    signIn: (email: string, password: string) => 
      actor.send({ type: 'SIGN_IN', email, password }),
    signOut: () => 
      actor.send({ type: 'SIGN_OUT' }),
  };
}

// ===== SPECIFIC HOOKS FOR INDIVIDUAL CONCERNS =====

export function useConnection() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => ({
    isOnline: snapshot.context.isOnline,
    isOffline: !snapshot.context.isOnline,
  }));
}

export function useAuth() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => {
    const isInAuth = typeof snapshot.value === 'object' && 
                     snapshot.value !== null && 
                     'initializing' in snapshot.value &&
                     typeof (snapshot.value as any).initializing === 'object' &&
                     'auth' in (snapshot.value as any).initializing;
    
    const authState = isInAuth ? (snapshot.value as any).initializing.auth : null;
    
    return {
      isAuthenticated: !!snapshot.context.user,
      isUnauthenticated: !snapshot.context.user && !snapshot.context.authError,
      isSigningIn: authState === 'signing_in',
      isSigningOut: snapshot.value === 'signing_out',
      
      user: snapshot.context.user,
      authToken: snapshot.context.authToken,
      authError: snapshot.context.authError,
      
      // User role info
      userRole: snapshot.context.user?.role || null,
      isAdmin: snapshot.context.user?.role === 'admin' || snapshot.context.user?.role === 'super_admin',
      isSuperAdmin: snapshot.context.user?.role === 'super_admin',
      canAccessDebugFeatures: snapshot.context.user?.role === 'admin' || snapshot.context.user?.role === 'super_admin',
      
      // User display info
      displayName: (() => {
        const user = snapshot.context.user;
        if (!user) return 'User';
        return user.name || user.email?.split('@')[0] || 'User';
      })(),
      
      initials: (() => {
        const user = snapshot.context.user;
        if (!user) return 'U';
        const name = user.name || user.email?.split('@')[0] || 'User';
        return name.slice(0, 2).toUpperCase();
      })(),
      
      // Actions
      signIn: (email: string, password: string) => 
        actor.send({ type: 'SIGN_IN', email, password }),
      signOut: () => 
        actor.send({ type: 'SIGN_OUT' }),
    };
  });
}

export function useDatabase() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => {
    const isInDatabase = typeof snapshot.value === 'object' && 
                         snapshot.value !== null && 
                         'initializing' in snapshot.value &&
                         (snapshot.value as any).initializing === 'database';
    
    return {
      isReady: snapshot.context.isDatabaseInitialized,
      isInitializing: isInDatabase,
      isError: !!snapshot.context.databaseError,
      error: snapshot.context.databaseError,
    };
  });
}

export function useSync() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => {
    const isInSync = typeof snapshot.value === 'object' && 
                     snapshot.value !== null && 
                     'initializing' in snapshot.value &&
                     ['sync', 'starting_sync'].includes((snapshot.value as any).initializing);
    
    return {
      // Simplified sync state
      isSyncLive: snapshot.context.isSyncLive,
      isWaiting: isInSync,
      isSyncing: isInSync,
      
      // Legacy compatibility
      isSyncActive: isInSync,
    };
  });
}

// NEW: Hook to access sync state from orchestrator context (synced via onSnapshot)
export function useSyncMachine() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => {
    const syncState = snapshot.context.syncState;
    const syncClientId = snapshot.context.syncClientId;
    // Remove excessive logging that was causing performance issues during scroll
    // console.log(`[useSyncMachine] 🔍 Reading syncState from orchestrator context:`, {
    //   phase: syncState.phase,
    //   currentLSN: syncState.currentLSN,
    //   machineState: syncState.machineState
    // });
    
    return {
      // Client ID from orchestrator context
      clientId: syncClientId,
      
      // Sync phase information
      syncPhase: syncState.phase,
      syncProgress: syncState.progress,
      currentLSN: syncState.currentLSN,
      
      // State booleans
      isInitialSync: syncState.phase === 'initial',
      isCatchupSync: syncState.phase === 'catchup',
      isLiveSync: syncState.phase === 'live',
      isError: syncState.machineState === 'error',
      isConnecting: syncState.machineState === 'connecting',
      isIdle: syncState.machineState === 'idle',
      
      // Machine state
      machineState: syncState.machineState,
      error: syncState.error,
      
      // Detailed progress
      syncPhaseProgress: syncState.phaseProgress,
      
      // Convenience getters
      get isActive() {
        return ['connecting', 'initialSync', 'catchupSync', 'live'].includes(syncState.machineState);
      },
      
      get statusText() {
        if (syncState.machineState === 'error') return 'Error';
        if (syncState.machineState === 'connecting') return 'Connecting...';
        if (syncState.phase === 'initial') return `Initial Sync (${syncState.progress}%)`;
        if (syncState.phase === 'catchup') return `Catchup Sync (${syncState.progress}%)`;
        if (syncState.phase === 'live') return 'Live';
        return 'Idle';
      }
    };
  });
}

export function useLiveChanges() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => {
    const isInLiveChanges = typeof snapshot.value === 'object' && 
                           snapshot.value !== null && 
                           'initializing' in snapshot.value &&
                           (snapshot.value as any).initializing === 'starting_live_changes';
    
    return {
      status: isInLiveChanges ? 'starting' : (snapshot.context.liveChangesActive ? 'active' : 'inactive'),
      isActive: snapshot.context.liveChangesActive,
      isStarting: isInLiveChanges,
      isInactive: !snapshot.context.liveChangesActive && !isInLiveChanges,
    };
  });
}

export function useSystemReadiness() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => {
    const context = snapshot.context;
    
    // Use the same logic as useOrchestrator - just check context.isSystemReady
    const canLoadRoutes = context.isSystemReady;
    const isSystemReady = context.isSystemReady;
    
    // Detailed readiness checks for debugging (but don't use for canLoadRoutes calculation)
    const readinessChecks = {
      database: context.isDatabaseInitialized,
      auth: !!context.user,
      sync: context.isSyncLive,
      liveChanges: context.liveChangesActive,
    };
    
    return {
      canLoadRoutes,
      isSystemReady,
      readinessChecks,
      isLoading: !canLoadRoutes,
      
      // Individual readiness flags
      isDatabaseReady: readinessChecks.database,
      isAuthReady: readinessChecks.auth,
      isSyncReady: readinessChecks.sync,
      areLiveChangesReady: readinessChecks.liveChanges,
    };
  });
}

export function useSimpleReadiness() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => ({
    isReady: snapshot.context.isSystemReady,
    canLoadRoutes: snapshot.context.isSystemReady,
  }));
}

export function useIntegrity() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => ({
    // Simplified - integrity operations are handled by child machines
    // Orchestrator only needs to know if system is resetting
    isResetting: snapshot.value === 'resetting',
    
    // Actions
    requestReset: (reason: string) => 
      actor.send({ type: 'INTEGRITY_RESET_REQUIRED', reason }),
  }));
}

// ===== ROLE-BASED ACCESS CONTROL HOOK =====

export function useUserRole() {
  const actor = useOrchestratorActor();
  
  return useSelector(actor, (snapshot) => {
    const userRole = snapshot.context.user?.role || null;
    
    return {
      role: userRole || 'member',
      isAdmin: userRole === 'admin' || userRole === 'super_admin',
      isSuperAdmin: userRole === 'super_admin', 
      isMember: userRole === 'member',
      isViewer: userRole === 'viewer',
      
      // Permission helpers
      canAccess: (feature: string): boolean => {
        if (!snapshot.context.user) return false;
        
        switch (feature) {
          case 'debug_features':
            return userRole === 'admin' || userRole === 'super_admin';
          case 'user_management':
            return userRole === 'admin' || userRole === 'super_admin';
          case 'project_create':
            return userRole !== 'viewer';
          case 'admin_panel':
            return userRole === 'admin' || userRole === 'super_admin';
          default:
            return true;
        }
      }
    };
  });
} 