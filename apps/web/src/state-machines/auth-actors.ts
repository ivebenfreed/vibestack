import { fromPromise } from 'xstate';
import { authClient } from '@/lib/auth'; // User's existing auth client
import type { UserInfo } from './types';

// Actor for checking auth - pure authClient, no separate guard
export const checkAuthActor = fromPromise(async () => {
  try {
    console.log('[checkAuthActor] Checking authentication...');
    
    // Direct auth check via authClient
    const session = await authClient.getSession();
    
    if (session?.data?.user) {
      const user: UserInfo = {
        id: session.data.user.id,
        email: session.data.user.email,
        name: session.data.user.name || session.data.user.email?.split('@')[0] || 'User',
        role: (session.data.user as any).role || 'member', // Extract role from session data or default to 'member'
        emailVerified: session.data.user.emailVerified || false,
        image: session.data.user.image,
      };
      
      // Extract session expiry if available
      const sessionExpiry = session.data.session?.expiresAt ? 
        new Date(session.data.session.expiresAt).toISOString() : 
        null;
      
      console.log('[checkAuthActor] Session data:', {
        hasUser: !!session.data.user,
        hasSession: !!session.data.session,
        userRole: user.role,
        sessionExpiry,
        tokenPresent: !!session.data.session?.token,
        rawUserData: session.data.user, // Debug: log raw user data to see available fields
        extractedRole: (session.data.user as any).role // Debug: log the extracted role specifically
      });
      
      return {
        authenticated: true,
        user,
        token: session.data.session?.token || 'authenticated',
        sessionExpiry, // Include session expiry
      };
    }
    
    return { authenticated: false };
  } catch (error) {
    console.error('[checkAuthActor] Auth check failed:', error);
    return { authenticated: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Actor for handling sign-in
export const signInActor = fromPromise(async ({ input }: { 
  input: { email: string; password: string } 
}) => {
  try {
    const result = await authClient.signIn.email({
      email: input.email,
      password: input.password,
    });
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    // Dispatch auth event for any listeners
    window.dispatchEvent(new CustomEvent('auth:signin'));
    
    // CRITICAL FIX: Sign-in response may not include full user data with role
    // Get fresh session data immediately after successful sign-in to ensure we have the role
    console.log('[signInActor] Sign-in successful, fetching full session data...');
    const session = await authClient.getSession();
    
    if (!session?.data?.user) {
      throw new Error('Failed to get session data after sign-in');
    }
    
    // Use session user data which includes the role field
    const user = {
      id: session.data.user.id,
      email: session.data.user.email,
      name: session.data.user.name || session.data.user.email?.split('@')[0] || 'User',
      role: (session.data.user as any).role || 'member',
      emailVerified: session.data.user.emailVerified || false,
      image: session.data.user.image,
    };
    
    // Debug: log sign-in vs session data comparison
    console.log('[signInActor] Data comparison:', {
      signInUserData: result.data?.user,
      signInRole: (result.data?.user as any)?.role,
      sessionUserData: session.data.user,
      sessionRole: (session.data.user as any).role,
      finalUserRole: user.role
    });
    
    return {
      success: true,
      user,
      token: result.data?.token || session.data.session?.token,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sign-in failed',
    };
  }
});

// Actor for handling sign-out - robust with timeout and error handling
export const signOutActor = fromPromise(async () => {
  const SIGN_OUT_TIMEOUT = 10000; // 10 seconds timeout
  
  try {
    console.log('[signOutActor] Starting robust sign-out process...');
    
    // Create a timeout promise to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Sign-out process timed out after 10 seconds'));
      }, SIGN_OUT_TIMEOUT);
    });
    
    // Create the main sign-out logic
    const signOutProcess = async () => {
      // Step 1: Sign out from auth provider (critical step)
      console.log('[signOutActor] Step 1: Signing out from auth provider...');
      try {
        await authClient.signOut();
        console.log('[signOutActor] Successfully signed out from auth provider');
      } catch (authError) {
        console.warn('[signOutActor] Auth provider sign-out failed, continuing with cleanup:', authError);
        // Continue with cleanup even if auth sign-out fails
      }
      
      // Step 2: Clear auth-related state only (preserve sync state)
      console.log('[signOutActor] Step 2: Clearing auth-related state (preserving sync data)...');
      // Note: Sync cleanup is handled automatically by orchestrator state transition
      try {
        // First, preserve sync-related data from orchestrator state
        let preservedSyncData = null;
        try {
          const orchestratorState = localStorage.getItem('orchestrator-state');
          if (orchestratorState) {
            const parsedState = JSON.parse(orchestratorState);
            if (parsedState?.context) {
              // Preserve sync-related data
              preservedSyncData = {
                syncClientId: parsedState.context.syncClientId,
                syncState: parsedState.context.syncState,
                syncLastSyncTime: parsedState.context.syncLastSyncTime,
                integrityBaseline: parsedState.context.integrityBaseline
              };
              console.log('[signOutActor] Preserved sync data:', {
                clientId: preservedSyncData.syncClientId,
                currentLSN: preservedSyncData.syncState?.currentLSN,
                lastSyncTime: preservedSyncData.syncLastSyncTime
              });
            }
          }
        } catch (e) {
          console.warn('[signOutActor] Could not preserve sync data:', e);
        }
        
        // Clear auth-related storage keys only
        const authKeysToRemove = [
          'auth-token',
          'user-session',
          'better-auth.session'  // Better Auth session key
        ];
        
        authKeysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.warn(`Failed to remove ${key}:`, e);
          }
        });
        
        // Clear orchestrator state but restore sync data
        try {
          localStorage.removeItem('orchestrator-state');
          
          // If we preserved sync data, create a minimal orchestrator state with just sync info
          if (preservedSyncData) {
            const minimalState = {
              context: {
                // Reset auth state
                user: null,
                authToken: null,
                authError: null,
                sessionExpiry: null,
                
                // Reset system state
                isDatabaseInitialized: false,
                databaseError: null,
                isOnline: navigator.onLine,
                isSyncLive: false,
                liveChangesActive: false,
                isSystemReady: false,
                
                // Preserve sync data
                ...preservedSyncData,
                
                // Reset timing
                startupTime: Date.now(),
                lastActivity: Date.now()
              }
            };
            
            localStorage.setItem('orchestrator-state', JSON.stringify(minimalState));
            console.log('[signOutActor] Restored orchestrator state with preserved sync data');
          }
        } catch (e) {
          console.warn('[signOutActor] Failed to manage orchestrator state:', e);
        }
        
        // Clear session storage except sync-related items
        try {
          // Don't clear all session storage - just auth-related items
          const sessionKeysToRemove = [
            'auth-session',
            'user-token',
            'auth-state'
          ];
          
          sessionKeysToRemove.forEach(key => {
            try {
              sessionStorage.removeItem(key);
            } catch (e) {
              console.warn(`Failed to remove session ${key}:`, e);
            }
          });
        } catch (e) {
          console.warn('Failed to clear session storage items:', e);
        }
        
        console.log('[signOutActor] Auth state cleared (sync data preserved)');
      } catch (storageError) {
        console.warn('[signOutActor] Storage cleanup failed:', storageError);
      }
      
      // Step 3: Dispatch auth state change event (critical for UI updates)
      console.log('[signOutActor] Step 3: Notifying auth state change...');
      try {
        window.dispatchEvent(new CustomEvent('auth:state-changed', { 
          detail: { authenticated: false, reason: 'sign-out', timestamp: Date.now() }
        }));
        
        // Also dispatch a more general sign-out event
        window.dispatchEvent(new CustomEvent('auth:signout', {
          detail: { timestamp: Date.now() }
        }));
        
        console.log('[signOutActor] Auth state change events dispatched');
      } catch (eventError) {
        console.warn('[signOutActor] Failed to dispatch events:', eventError);
      }
      
      return { success: true, timestamp: Date.now() };
    };
    
    // Race between timeout and sign-out process
    const result = await Promise.race([signOutProcess(), timeoutPromise]);
    
    console.log('[signOutActor] ✅ Sign-out completed successfully');
    return result;
    
  } catch (error) {
    console.error('[signOutActor] Sign-out failed:', error);
    
    // Even if sign-out fails, try to clear auth state as a fallback (preserve sync data)
    console.log('[signOutActor] Attempting emergency auth cleanup (preserving sync data)...');
    try {
      // Try to preserve sync data even in emergency
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
        console.warn('[signOutActor] Emergency: Could not preserve sync data');
      }
      
      // Clear orchestrator state
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
        console.log('[signOutActor] Emergency: Restored state with preserved sync data');
      }
      
      window.dispatchEvent(new CustomEvent('auth:state-changed', { 
        detail: { authenticated: false, reason: 'sign-out-error', error: error.message }
      }));
    } catch (emergencyError) {
      console.error('[signOutActor] Emergency cleanup also failed:', emergencyError);
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    };
  }
});

// Actor for token refresh/validation
export const validateTokenActor = fromPromise(async () => {
  try {
    // Simplified - just check if we can get a session
    const session = await authClient.getSession();
    return { valid: !!session?.data?.user };
  } catch (error) {
    console.error('Token validation failed:', error);
    return { valid: false };
  }
}); 