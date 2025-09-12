import { fromPromise } from 'xstate';
import { authClient } from '@/lib/auth'; // User's existing auth client
import type { UserInfo } from './types';
import { log } from '@/logger';

const myLog = log('state-machines/auth-actors.ts');

// Actor for checking auth - handles network errors gracefully
export const checkAuthActor = fromPromise(async () => {
  try {
    myLog.info('[checkAuthActor] Checking authentication...');
    
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
      
      // Extract organization data from session (automatically injected by customSession plugin)
      const organization = session.data.session?.organization ? {
        id: session.data.session.organization.id,
        name: session.data.session.organization.name,
        slug: session.data.session.organization.slug,
        role: session.data.session.organization.role,
      } : null;
      
      // Extract session expiry if available
      const sessionExpiry = session.data.session?.expiresAt ? 
        new Date(session.data.session.expiresAt).toISOString() : 
        null;
      
      myLog.info('[checkAuthActor] Session data:', {
        hasUser: !!session.data.user,
        hasSession: !!session.data.session,
        hasOrganization: !!organization,
        organizationName: organization?.name,
        userRole: user.role,
        orgRole: organization?.role,
        sessionExpiry,
        tokenPresent: !!session.data.session?.token,
        rawUserData: session.data.user,
        rawOrganizationData: session.data.session?.organization
      });
      
      return {
        authenticated: true,
        user,
        organization, // Include organization from session
        authToken: session.data.session?.token || 'authenticated',
        sessionExpiry,
      };
    }
    
    // No user in session - this is a legitimate auth failure
    myLog.info('[checkAuthActor] No user found in session');
    return { authenticated: false, shouldSignOut: true };
    
  } catch (error) {
    myLog.error('[checkAuthActor] Auth check failed:', error);
    
    // Try to get persisted auth data before deciding what to do
    const persistedAuth = localStorage.getItem('auth-machine-state');
    const hasValidPersistedAuth = (() => {
      if (!persistedAuth) return false;
      try {
        const parsed = JSON.parse(persistedAuth);
        const hasUser = !!parsed?.context?.user;
        const hasToken = !!parsed?.context?.authToken;
        const notExpired = !parsed?.context?.sessionExpiry || 
                          new Date(parsed.context.sessionExpiry) > new Date();
        return hasUser && hasToken && notExpired;
      } catch {
        return false;
      }
    })();
    
    // Analyze the error to determine if it's a network issue or auth failure
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Better error detection including response status
    const isNetworkError = errorMessage.includes('fetch') || 
                          errorMessage.includes('network') || 
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('ECONNREFUSED') ||
                          errorMessage.includes('ENOTFOUND') ||
                          errorMessage.includes('Failed to fetch') ||
                          errorMessage.includes('NetworkError');
    
    // Check if it's an HTTP error with status - be more specific
    const isServerError = errorMessage.includes('500') || 
                         errorMessage.includes('502') || 
                         errorMessage.includes('503') || 
                         errorMessage.includes('504') ||
                         errorMessage.includes('INTERNAL_SERVER_ERROR') ||
                         errorMessage.includes('Internal Server Error');
    
    // REFINED: Only treat 401 as explicit session expiry that needs persistence clearing
    // 403 could be permission issue, not session expiry - keep user logged in
    const isSessionExpired = errorMessage.includes('401') || 
                             errorMessage.includes('Unauthorized') ||
                             errorMessage.includes('UNAUTHORIZED') ||
                             errorMessage.includes('session expired') ||
                             errorMessage.includes('token expired');
    
    // 403 is permission denied, not necessarily session expiry - don't clear persistence
    const isPermissionDenied = errorMessage.includes('403') || 
                              errorMessage.includes('Forbidden');
    
    // If we have valid persisted auth and it's a server/network error, stay authenticated
    if ((isNetworkError || isServerError) && hasValidPersistedAuth) {
      myLog.info('[checkAuthActor] Server/network error but have valid persisted auth, staying authenticated');
      try {
        const parsed = JSON.parse(persistedAuth!);
        return {
          authenticated: true,
          user: parsed.context.user,
          authToken: parsed.context.authToken,
          sessionExpiry: parsed.context.sessionExpiry,
          fromPersisted: true,
          errorType: 'recoverable',
          error: errorMessage
        };
      } catch {
        // Fall through to normal error handling
      }
    }
    
    if (isNetworkError || isServerError) {
      // Network/server errors - don't sign out, keep trying, preserve auth state
      myLog.info('[checkAuthActor] Network/server error detected, preserving auth state for offline experience');
      return { 
        authenticated: false, 
        shouldSignOut: false, 
        errorType: 'network',
        error: errorMessage,
        retryable: true
      };
    } else if (isSessionExpired) {
      // ONLY 401/session expired errors - clear persistence to prevent loops
      myLog.info('[checkAuthActor] Session expired (401), clearing persistence and signing out');
      
      // CRITICAL: Clear persisted state to prevent infinite loops with expired sessions
      try {
        localStorage.removeItem('auth-machine-snapshot');
        localStorage.removeItem('auth-machine-state');
        myLog.info('[checkAuthActor] Cleared persisted auth state due to session expiry');
      } catch (error) {
        myLog.error('[checkAuthActor] Failed to clear persisted state:', error);
      }
      
      return { 
        authenticated: false, 
        shouldSignOut: true, 
        errorType: 'session-expired',
        error: 'Your session has expired. Please sign in again.',
        clearPersisted: true
      };
    } else if (isPermissionDenied) {
      // 403 errors - permission issue, not session expiry - preserve auth but show error
      myLog.info('[checkAuthActor] Permission denied (403), preserving auth state but showing error');
      return { 
        authenticated: false, 
        shouldSignOut: false,  // Don't sign out, just show permission error
        errorType: 'permission-denied',
        error: errorMessage,
        retryable: false  // Don't auto-retry permission errors
      };
    } else {
      // Unknown errors - be conservative but don't clear persistence unless clearly session-related
      myLog.info('[checkAuthActor] Unknown error, checking if session-related before clearing persistence');
      
      // Only clear persistence if error message suggests session issues
      const shouldClearPersistence = errorMessage.toLowerCase().includes('session') ||
                                    errorMessage.toLowerCase().includes('token') ||
                                    errorMessage.toLowerCase().includes('auth') ||
                                    errorMessage.toLowerCase().includes('expired');
      
      if (shouldClearPersistence) {
        try {
          localStorage.removeItem('auth-machine-snapshot');
          localStorage.removeItem('auth-machine-state');
          myLog.info('[checkAuthActor] Cleared persisted state for session-related unknown error');
        } catch (error) {
          myLog.error('[checkAuthActor] Failed to clear persisted state:', error);
        }
      }
      
      return { 
        authenticated: false, 
        shouldSignOut: shouldClearPersistence, 
        errorType: 'unknown',
        error: errorMessage,
        clearPersisted: shouldClearPersistence,
        retryable: !shouldClearPersistence  // Retry if not session-related
      };
    }
  }
});

// Actor for handling sign-in
export const signInActor = fromPromise(async ({ input }: { 
  input: { email: string; password: string } 
}) => {
  try {
    myLog.info('[signInActor] Starting sign-in process for:', input.email);
    
    const result = await authClient.signIn.email({
      email: input.email,
      password: input.password,
    });
    
    myLog.info('[signInActor] Auth client result:', {
      hasError: !!result.error,
      hasData: !!result.data,
      errorMessage: result.error?.message
    });
    
    if (result.error) {
      myLog.error('[signInActor] Sign-in failed with error:', result.error.message);
      return {
        success: false,
        error: result.error.message,
      };
    }
    
    // Dispatch auth event for any listeners
    window.dispatchEvent(new CustomEvent('auth:signin'));
    
    // CRITICAL FIX: Sign-in response may not include full user data with role
    // Get fresh session data immediately after successful sign-in to ensure we have the role
    myLog.info('[signInActor] Sign-in successful, fetching full session data...');
    const session = await authClient.getSession();
    
    myLog.info('[signInActor] Session fetch result:', {
      hasSession: !!session,
      hasData: !!session?.data,
      hasUser: !!session?.data?.user,
      userId: session?.data?.user?.id
    });
    
    if (!session?.data?.user) {
      myLog.error('[signInActor] Failed to get session data after sign-in');
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
    
    myLog.info('[signInActor] Successfully created user object:', {
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
    
    // Extract organization data from session if available
    const organization = (session.data.session as any)?.organization || null;
    
    myLog.info('[signInActor] Returning success result with user data and organization:', organization?.name || 'No org');
    return {
      user,
      authToken,
      sessionExpiry,
      organization, // Include organization from session
    };
  } catch (error) {
    myLog.error('[signInActor] Unexpected error during sign-in:', error);
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
    myLog.error('[signOutActor] Sign-out failed:', error);
    
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
    myLog.error('Token validation failed:', error);
    return { valid: false };
  }
});

// Actor for setting up Legend State persistence during auth initialization
export const setupPersistenceActor = fromPromise(async ({ input }: {
  input: { userId: string; organizationIds: string[]; entityKeys?: string[] }
}) => {
  try {
    const { userId, organizationIds, entityKeys = [] } = input;
    myLog.info('[setupPersistenceActor] Starting Legend State persistence setup', {
      userId,
      organizationCount: organizationIds.length,
      entityCount: entityKeys.length
    });

    // Dynamically import to avoid circular dependencies
    const { ensureLegendStateReady } = await import('@/legend-state/helpers/InitializationManager');
    const { loadUniverseContext } = await import('@/legend-state/observables');
    
    // For universe mode with multiple orgs, use 'universe' as the org identifier
    const initOrgId = organizationIds.length > 1 ? 'universe' : organizationIds[0];
    
    // Load universe context to get entity keys from schemas
    myLog.info('[setupPersistenceActor] Loading universe context to get entity schemas');
    await loadUniverseContext(userId, organizationIds);
    
    // Get entity keys from the loaded universe context
    const { universeSchema$ } = await import('@/legend-state/observables');
    const currentSchema = universeSchema$.peek();
    const dynamicEntityKeys = currentSchema?.entities ? Object.keys(currentSchema.entities) : [];
    
    myLog.info('[setupPersistenceActor] Found entity keys from schema', {
      entityKeys: dynamicEntityKeys,
      schemaVersion: currentSchema?.version
    });
    
    // Initialize persistence configuration with actual entity keys
    const persistenceContext = await ensureLegendStateReady(initOrgId, userId, dynamicEntityKeys);
    
    myLog.info('[setupPersistenceActor] ✅ Legend State persistence setup complete', {
      hasPersistence: !!persistenceContext,
      entityMappings: persistenceContext ? Object.keys(persistenceContext.entityTableMap).length : 0,
      finalEntityCount: dynamicEntityKeys.length
    });
    
    return {
      success: true,
      persistenceContext,
      orgId: initOrgId,
      entityCount: dynamicEntityKeys.length,
      entityKeys: dynamicEntityKeys
    };
    
  } catch (error) {
    myLog.error('[setupPersistenceActor] ❌ Failed to setup Legend State persistence:', error);
    
    // Don't throw - allow auth to continue with server-only sync
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Persistence setup failed',
      fallbackMode: 'server-only'
    };
  }
}); 