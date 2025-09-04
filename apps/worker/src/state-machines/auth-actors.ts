import { fromPromise } from 'xstate';
import { authClient } from '@/lib/auth'; // User's existing auth client
import type { UserInfo } from './types';
import { syncLog } from '@/logger';

const log = syncLog('state-machines/auth-actors.ts');

// Actor for checking auth - handles network errors gracefully
export const checkAuthActor = fromPromise(async () => {
  try {
    log.info('[checkAuthActor] Checking authentication...');
    
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
      
      log.info('[checkAuthActor] Session data:', {
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
    log.info('[checkAuthActor] No user found in session');
    return { authenticated: false, shouldSignOut: true };
    
  } catch (error) {
    log.error('[checkAuthActor] Auth check failed:', error);
    
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
    
    const isAuthError = errorMessage.includes('401') || 
                       errorMessage.includes('403') || 
                       errorMessage.includes('Unauthorized') ||
                       errorMessage.includes('Forbidden') ||
                       errorMessage.includes('UNAUTHORIZED');
    
    // If we have valid persisted auth and it's a server/network error, stay authenticated
    if ((isNetworkError || isServerError) && hasValidPersistedAuth) {
      log.info('[checkAuthActor] Server/network error but have valid persisted auth, staying authenticated');
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
      // Network/server errors - don't sign out, keep trying
      log.info('[checkAuthActor] Network/server error detected, not signing out user');
      return { 
        authenticated: false, 
        shouldSignOut: false, 
        errorType: 'network',
        error: errorMessage,
        retryable: true
      };
    } else if (isAuthError) {
      // Actual auth errors - immediately sign out for better UX
      log.info('[checkAuthActor] Authentication error detected, signing out immediately');
      return { 
        authenticated: false, 
        shouldSignOut: true, 
        errorType: 'auth',
        error: errorMessage 
      };
    } else {
      // Unknown errors - sign out to be safe and provide clear UX
      log.info('[checkAuthActor] Unknown error, signing out for safety and clear UX');
      return { 
        authenticated: false, 
        shouldSignOut: true, 
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
    log.info('[signInActor] Starting sign-in process for:', input.email);
    
    const result = await authClient.signIn.email({
      email: input.email,
      password: input.password,
    });
    
    log.info('[signInActor] Auth client result:', {
      hasError: !!result.error,
      hasData: !!result.data,
      errorMessage: result.error?.message
    });
    
    if (result.error) {
      log.error('[signInActor] Sign-in failed with error:', result.error.message);
      return {
        success: false,
        error: result.error.message,
      };
    }
    
    // Dispatch auth event for any listeners
    window.dispatchEvent(new CustomEvent('auth:signin'));
    
    // CRITICAL FIX: Sign-in response may not include full user data with role
    // Get fresh session data immediately after successful sign-in to ensure we have the role
    log.info('[signInActor] Sign-in successful, fetching full session data...');
    const session = await authClient.getSession();
    
    log.info('[signInActor] Session fetch result:', {
      hasSession: !!session,
      hasData: !!session?.data,
      hasUser: !!session?.data?.user,
      userId: session?.data?.user?.id
    });
    
    if (!session?.data?.user) {
      log.error('[signInActor] Failed to get session data after sign-in');
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
    
    log.info('[signInActor] Successfully created user object:', {
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
    
    log.info('[signInActor] Returning success result with user data and organization:', organization?.name || 'No org');
    return {
      user,
      authToken,
      sessionExpiry,
      organization, // Include organization from session
    };
  } catch (error) {
    log.error('[signInActor] Unexpected error during sign-in:', error);
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
    log.error('[signOutActor] Sign-out failed:', error);
    
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
    log.error('Token validation failed:', error);
    return { valid: false };
  }
});

// Actor for setting up Legend State persistence during auth initialization
export const setupPersistenceActor = fromPromise(async ({ input }: {
  input: { userId: string; organizationIds: string[]; entityKeys?: string[] }
}) => {
  try {
    const { userId, organizationIds, entityKeys = [] } = input;
    log.info('[setupPersistenceActor] Starting Legend State persistence setup', {
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
    log.info('[setupPersistenceActor] Loading universe context to get entity schemas');
    await loadUniverseContext(userId, organizationIds);
    
    // Get entity keys from the loaded universe context
    const { orgContext$ } = await import('@/legend-state/observables');
    const currentSchema = orgContext$.schema.peek();
    const dynamicEntityKeys = currentSchema?.entities ? Object.keys(currentSchema.entities) : [];
    
    log.info('[setupPersistenceActor] Found entity keys from schema', {
      entityKeys: dynamicEntityKeys,
      schemaVersion: currentSchema?.version
    });
    
    // Initialize persistence configuration with actual entity keys
    const persistenceContext = await ensureLegendStateReady(initOrgId, userId, dynamicEntityKeys);
    
    log.info('[setupPersistenceActor] ✅ Legend State persistence setup complete', {
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
    log.error('[setupPersistenceActor] ❌ Failed to setup Legend State persistence:', error);
    
    // Don't throw - allow auth to continue with server-only sync
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Persistence setup failed',
      fallbackMode: 'server-only'
    };
  }
}); 