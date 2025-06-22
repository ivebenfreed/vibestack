import { useAuth } from '@/state-machines/orchestrator-hooks';
import { useState } from 'react';
import { authClient } from '@/lib/auth';

/**
 * Direct sign-out function that bypasses orchestrator initialization coupling
 */
async function performDirectSignOut(): Promise<void> {
  console.log('[AUTH] Starting direct sign-out process...');
  
  try {
    // Step 1: Sign out from auth provider
    console.log('[AUTH] Step 1: Signing out from auth provider...');
    await authClient.signOut();
    console.log('[AUTH] Successfully signed out from auth provider');
    
    // Step 2: Preserve sync data before clearing orchestrator state
    console.log('[AUTH] Step 2: Preserving sync data...');
    let preservedSyncData = null;
    try {
      const orchestratorState = localStorage.getItem('orchestrator-state');
      if (orchestratorState) {
        const parsedState = JSON.parse(orchestratorState);
        if (parsedState?.context) {
          preservedSyncData = {
            syncClientId: parsedState.context.syncClientId,
            syncState: parsedState.context.syncState,
            syncLastSyncTime: parsedState.context.syncLastSyncTime,
            integrityBaseline: parsedState.context.integrityBaseline
          };
          console.log('[AUTH] Preserved sync data:', {
            clientId: preservedSyncData.syncClientId,
            currentLSN: preservedSyncData.syncState?.currentLSN,
            lastSyncTime: preservedSyncData.syncLastSyncTime
          });
        }
      }
    } catch (error) {
      console.warn('[AUTH] Failed to preserve sync data:', error);
    }
    
    // Step 3: Clear auth state while preserving sync data
    console.log('[AUTH] Step 3: Clearing auth state (preserving sync data)...');
    if (preservedSyncData) {
      const minimalState = {
        context: {
          user: null,
          authToken: null,
          authError: null,
          sessionExpiry: null,
          isDatabaseInitialized: false,
          databaseError: null,
          isOnline: navigator.onLine,
          isSyncLive: false,
          liveChangesActive: false,
          isSystemReady: false,
          ...preservedSyncData,
          startupTime: Date.now(),
          lastActivity: Date.now()
        }
      };
      localStorage.setItem('orchestrator-state', JSON.stringify(minimalState));
      console.log('[AUTH] Auth state cleared with sync data preserved');
    } else {
      localStorage.removeItem('orchestrator-state');
      console.log('[AUTH] Orchestrator state completely cleared');
    }
    
    // Step 4: Force redirect to sign-in page immediately  
    console.log('[AUTH] Step 4: Forcing redirect to sign-in...');
    console.log('[AUTH] ✅ Direct sign-out completed - redirecting to sign-in');
    window.location.href = '/sign-in';
  } catch (error) {
    console.error('[AUTH] Direct sign-out failed:', error);
    throw error;
  }
}

/**
 * Custom hook for handling the sign-out process with direct approach.
 * Uses direct sign-out to avoid coupling with app initialization flow.
 * 1. Sign out from auth provider
 * 2. Preserve sync data
 * 3. Clear auth state
 * 4. Trigger navigation via auth state change events
 */
export function useSignOut() {
  const { signOut: orchestratorSignOut, isSigningOut } = useAuth();
  const [lastSignOutAttempt, setLastSignOutAttempt] = useState<number | null>(null);

  const signOut = async () => {
    const now = Date.now();
    
    // Prevent rapid sign-out attempts (debounce)
    if (lastSignOutAttempt && (now - lastSignOutAttempt) < 2000) {
      console.warn('[AUTH] Sign-out attempt too soon, ignoring');
      return false;
    }
    
    setLastSignOutAttempt(now);
    
    try {
      console.log('[AUTH] Beginning direct sign-out (bypassing orchestrator initialization coupling)...');
      
      // Direct sign-out approach - don't couple with app initialization
      await performDirectSignOut();
      
      console.log('[AUTH] Direct sign-out process completed');
      return true;
    } catch (error) {
      console.error('[AUTH] Error during sign-out process:', error);
      
      // Even if there's an error, try emergency auth cleanup (preserve sync data)
      try {
        // Try to preserve sync data even in error case
        let preservedSyncData = null;
        try {
          const orchestratorState = localStorage.getItem('orchestrator-state');
          if (orchestratorState) {
            const parsedState = JSON.parse(orchestratorState);
            if (parsedState?.context) {
              preservedSyncData = {
                syncClientId: parsedState.context.syncClientId,
                syncState: parsedState.context.syncState,
                syncLastSyncTime: parsedState.context.syncLastSyncTime,
                integrityBaseline: parsedState.context.integrityBaseline
              };
            }
          }
        } catch (e) {
          console.warn('[AUTH] Error cleanup: Could not preserve sync data');
        }
        
        // Don't remove orchestrator state here - let the preserved sync data take effect
        
        // Restore minimal state with sync data if available
        if (preservedSyncData) {
          const minimalState = {
            context: {
              user: null,
              authToken: null,
              authError: null,
              sessionExpiry: null,
              isDatabaseInitialized: false,
              databaseError: null,
              isOnline: navigator.onLine,
              isSyncLive: false,
              liveChangesActive: false,
              isSystemReady: false,
              ...preservedSyncData,
              startupTime: Date.now(),
              lastActivity: Date.now()
            }
          };
          localStorage.setItem('orchestrator-state', JSON.stringify(minimalState));
          console.log('[AUTH] Error cleanup: Restored state with preserved sync data');
        }
        
        window.dispatchEvent(new CustomEvent('auth:state-changed', {
          detail: { authenticated: false, reason: 'error-fallback' }
        }));
      } catch (cleanupError) {
        console.error('[AUTH] Emergency cleanup failed:', cleanupError);
      }
      
      return false;
    }
  };

  return { 
    signOut,
    isSigningOut: isSigningOut || Boolean(lastSignOutAttempt && (Date.now() - lastSignOutAttempt) < 5000)
  };
} 