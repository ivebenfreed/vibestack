import { useAuth } from '@/state-machines/orchestrator-hooks';
import { useState } from 'react';

/**
 * Custom hook for handling the sign-out process through the orchestrator.
 * The orchestrator coordinates all sign-out steps including:
 * 1. Sync teardown
 * 2. Authentication provider sign-out
 * 3. State machine coordination
 * 4. Navigation is handled by route guards/auth providers
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
      console.log('[AUTH] Beginning orchestrator-coordinated sign-out...');
      
      // Use orchestrator sign-out - it will coordinate everything
      orchestratorSignOut();
      
      // Set up a fallback timeout in case orchestrator gets stuck
      const fallbackTimeout = setTimeout(() => {
        console.warn('[AUTH] Sign-out taking too long, attempting direct cleanup (preserving sync data)...');
        
        // Emergency fallback - clear auth state but preserve sync data
        try {
          // Preserve sync data before clearing
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
            console.warn('[AUTH] Fallback: Could not preserve sync data');
          }
          
          // Clear orchestrator state
          localStorage.removeItem('orchestrator-state');
          
          // Clear only auth-related session storage
          const authSessionKeys = ['auth-session', 'user-token', 'auth-state'];
          authSessionKeys.forEach(key => {
            try {
              sessionStorage.removeItem(key);
            } catch (e) {
              console.warn(`Failed to remove session ${key}:`, e);
            }
          });
          
          // Restore minimal state with sync data
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
            console.log('[AUTH] Fallback: Restored state with preserved sync data');
          }
          
          // Force reload to clear any stuck state
          console.warn('[AUTH] Forcing page reload as fallback...');
          window.location.href = '/sign-in';
        } catch (error) {
          console.error('[AUTH] Emergency fallback failed:', error);
        }
      }, 20000); // 20 second fallback
      
      // Listen for auth state changes to know when sign-out completes
      const handleAuthStateChange = (event: CustomEvent) => {
        if (event.detail?.authenticated === false) {
          console.log('[AUTH] Sign-out completed successfully');
          clearTimeout(fallbackTimeout);
          window.removeEventListener('auth:state-changed', handleAuthStateChange as EventListener);
        }
      };
      
      window.addEventListener('auth:state-changed', handleAuthStateChange as EventListener);
      
      // Clean up listener after 25 seconds regardless
      setTimeout(() => {
        window.removeEventListener('auth:state-changed', handleAuthStateChange as EventListener);
        clearTimeout(fallbackTimeout);
      }, 25000);
      
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
        
        localStorage.removeItem('orchestrator-state');
        
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