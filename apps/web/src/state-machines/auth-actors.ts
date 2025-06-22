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

// Actor for handling sign-out - direct coordination
export const signOutActor = fromPromise(async () => {
  try {
    console.log('[signOutActor] Starting coordinated sign-out process...');
    
    // Step 1: Disable sync auto-connect to prevent reconnection during sign-out
    console.log('[signOutActor] Disabling sync auto-connect...');
    try {
      const { SyncManager } = await import('@/sync/SyncManager');
      const syncManager = SyncManager.getInstance();
      syncManager.setAutoConnect(false);
      
      // Step 2: Disconnect from sync
      console.log('[signOutActor] Disconnecting from sync...');
      syncManager.disconnect();
    } catch (syncError) {
      console.warn('[signOutActor] Error during sync teardown (continuing with auth sign-out):', syncError);
    }
    
    // Step 3: Sign out from auth provider
    console.log('[signOutActor] Signing out from auth provider...');
    await authClient.signOut();
    
    // Step 4: Clear persisted XState
    try {
      localStorage.removeItem('orchestrator-state');
      console.log('[signOutActor] Cleared persisted XState');
    } catch (error) {
      console.warn('[signOutActor] Failed to clear persisted state:', error);
    }
    
    // Step 5: Dispatch auth state change event
    window.dispatchEvent(new CustomEvent('auth:state-changed', { 
      detail: { authenticated: false, reason: 'sign-out' }
    }));
    
    console.log('[signOutActor] ✅ Sign-out completed successfully');
    return { success: true };
  } catch (error) {
    console.error('[signOutActor] Sign-out failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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