import { fromPromise } from 'xstate';
import { authClient } from '@/lib/auth'; // User's existing auth client
import type { UserInfo } from './types';

// Actor for checking auth - handles network errors gracefully
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
        authToken: session.data.session?.token || 'authenticated',
        sessionExpiry, // Include session expiry
      };
    }
    
    // No user in session - this is a legitimate auth failure
    console.log('[checkAuthActor] No user found in session');
    return { authenticated: false, shouldSignOut: true };
    
  } catch (error) {
    console.error('[checkAuthActor] Auth check failed:', error);
    
    // Analyze the error to determine if it's a network issue or auth failure
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNetworkError = errorMessage.includes('fetch') || 
                          errorMessage.includes('network') || 
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('ECONNREFUSED') ||
                          errorMessage.includes('ENOTFOUND') ||
                          errorMessage.includes('Failed to fetch');
    
    // Check if it's an HTTP error with status
    const isServerError = errorMessage.includes('500') || 
                         errorMessage.includes('502') || 
                         errorMessage.includes('503') || 
                         errorMessage.includes('504');
    
    const isAuthError = errorMessage.includes('401') || 
                       errorMessage.includes('403') || 
                       errorMessage.includes('Unauthorized') ||
                       errorMessage.includes('Forbidden');
    
    if (isNetworkError || isServerError) {
      // Network/server errors - don't sign out, keep trying
      console.log('[checkAuthActor] Network/server error detected, not signing out user');
      return { 
        authenticated: false, 
        shouldSignOut: false, 
        errorType: 'network',
        error: errorMessage 
      };
    } else if (isAuthError) {
      // Actual auth errors - sign out
      console.log('[checkAuthActor] Authentication error detected, will sign out');
      return { 
        authenticated: false, 
        shouldSignOut: true, 
        errorType: 'auth',
        error: errorMessage 
      };
    } else {
      // Unknown errors - be conservative, don't sign out immediately
      console.log('[checkAuthActor] Unknown error, not signing out to be safe');
      return { 
        authenticated: false, 
        shouldSignOut: false, 
        errorType: 'unknown',
        error: errorMessage 
      };
    }
  }
});

// Actor for handling sign-in
export const signInActor = fromPromise(async ({ input }: { 
  input: { email: string; password: string } 
}) => {
  try {
    console.log('[signInActor] Starting sign-in process for:', input.email);
    
    const result = await authClient.signIn.email({
      email: input.email,
      password: input.password,
    });
    
    console.log('[signInActor] Auth client result:', {
      hasError: !!result.error,
      hasData: !!result.data,
      errorMessage: result.error?.message
    });
    
    if (result.error) {
      console.error('[signInActor] Sign-in failed with error:', result.error.message);
      return {
        success: false,
        error: result.error.message,
      };
    }
    
    // Dispatch auth event for any listeners
    window.dispatchEvent(new CustomEvent('auth:signin'));
    
    // CRITICAL FIX: Sign-in response may not include full user data with role
    // Get fresh session data immediately after successful sign-in to ensure we have the role
    console.log('[signInActor] Sign-in successful, fetching full session data...');
    const session = await authClient.getSession();
    
    console.log('[signInActor] Session fetch result:', {
      hasSession: !!session,
      hasData: !!session?.data,
      hasUser: !!session?.data?.user,
      userId: session?.data?.user?.id
    });
    
    if (!session?.data?.user) {
      console.error('[signInActor] Failed to get session data after sign-in');
      return {
        success: false,
        error: 'Failed to get session data after sign-in',
      };
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
    
    console.log('[signInActor] Successfully created user object:', {
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      userName: user.name
    });
    
    // Return the successful result
    const authToken = result.data?.token || session.data.session?.token || 'authenticated';
    const sessionExpiry = session.data.session?.expiresAt ? 
      new Date(session.data.session.expiresAt).toISOString() : 
      null;
    
    console.log('[signInActor] Returning success result with user data');
    return {
      user,
      authToken,
      sessionExpiry,
    };
  } catch (error) {
    console.error('[signInActor] Unexpected error during sign-in:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sign-in failed',
    };
  }
});

// Actor for handling sign-out - simple and clean
export const signOutActor = fromPromise(async () => {
  try {
    // Simply sign out from auth provider
    await authClient.signOut();
    
    // Clear auth-related localStorage
    localStorage.removeItem('auth-machine-state');
    
    // Success - auth machine will handle the state transition
    return { success: true };
  } catch (error) {
    console.error('[signOutActor] Sign-out failed:', error);
    
    // Even on error, clear auth state
    localStorage.removeItem('auth-machine-state');
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
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