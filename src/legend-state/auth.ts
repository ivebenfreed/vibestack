import { observable } from '@legendapp/state';
import { authClient } from '@/lib/auth';
import { log } from '@/logger';

const authLog = log('legend-state/auth');

// Types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  image?: string;
}

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface AuthState {
  user: AuthUser | null;
  organization: AuthOrganization | null; // Current selected organization
  userOrganizations: AuthOrganization[]; // All organizations user has access to
  loading: boolean;
  loadingOrganizations: boolean;
  error: string | null;
  sessionExpiry: string | null;
  authToken: string | null;
}

// Legend State Observable for Auth
export const auth$ = observable<AuthState & {
  // Actions
  signIn: (credentials: { email: string; password: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  loadUserOrganizations: () => Promise<void>;
  clearError: () => void;
}>({
  // State
  user: null,
  organization: null,
  userOrganizations: [],
  loading: true,
  loadingOrganizations: false,
  error: null,
  sessionExpiry: null,
  authToken: null,

  // Actions
  signIn: async (credentials: { email: string; password: string }): Promise<boolean> => {
    authLog.info('[AUTH$] Starting sign-in for:', credentials.email);
    auth$.loading.set(true);
    auth$.error.set(null);

    try {
      const result = await authClient.signIn.email({ email: credentials.email, password: credentials.password });
      
      if (result.error) {
        authLog.error('[AUTH$] Sign-in failed:', result.error.message);
        auth$.error.set(result.error.message);
        return false;
      }

      // Get fresh session data with organization info
      const session = await authClient.getSession();
      
      if (!session?.data?.user) {
        authLog.error('[AUTH$] No user data in session after sign-in');
        auth$.error.set('Failed to get session data after sign-in');
        return false;
      }

      // Extract user data
      const userData: AuthUser = {
        id: session.data.user.id,
        email: session.data.user.email,
        name: session.data.user.name || session.data.user.email?.split('@')[0] || 'User',
        role: (session.data.user as any).role || 'member',
        emailVerified: session.data.user.emailVerified || false,
        image: session.data.user.image,
      };

      // Extract organization data (if available)
      const organizationData = session.data.session?.organization ? {
        id: session.data.session.organization.id,
        name: session.data.session.organization.name,
        slug: session.data.session.organization.slug,
        role: session.data.session.organization.role,
      } : null;

      // Update auth state
      auth$.user.set(userData);
      auth$.organization.set(organizationData);
      auth$.authToken.set(session.data.session?.token || 'authenticated');
      auth$.sessionExpiry.set(
        session.data.session?.expiresAt ? 
          new Date(session.data.session.expiresAt).toISOString() : 
          null
      );

      authLog.info('[AUTH$] Sign-in successful:', {
        userId: userData.id,
        userEmail: userData.email,
        userRole: userData.role,
        organizationName: organizationData?.name,
        hasToken: !!session.data.session?.token
      });

      // Load user organizations after successful sign-in
      auth$.loadUserOrganizations();

      return true;

    } catch (error) {
      authLog.error('[AUTH$] Sign-in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Network error during sign-in';
      auth$.error.set(errorMessage);
      return false;
    } finally {
      auth$.loading.set(false);
    }
  },

  signOut: async (): Promise<void> => {
    authLog.info('[AUTH$] Starting sign-out');
    
    // Only call server signOut if we have a current user session
    if (auth$.user.get()) {
      try {
        await authClient.signOut();
        authLog.info('[AUTH$] Server sign-out successful');
      } catch (error) {
        authLog.info('[AUTH$] Server sign-out error (continuing with local cleanup):', error);
        // Continue with clearing state even if API call fails
      }
    } else {
      authLog.info('[AUTH$] No active session, skipping server sign-out');
    }

    // Clear auth state
    auth$.user.set(null);
    auth$.organization.set(null);
    auth$.authToken.set(null);
    auth$.sessionExpiry.set(null);
    auth$.error.set(null);
    auth$.loading.set(false);

    // Clear any persisted auth state
    try {
      localStorage.removeItem('auth-machine-state');
      localStorage.removeItem('auth-machine-snapshot');
    } catch (error) {
      authLog.warn('[AUTH$] Failed to clear localStorage:', error);
    }
  },

  checkAuth: async (): Promise<void> => {
    authLog.info('[AUTH$] Checking authentication status');
    
    try {
      const session = await authClient.getSession();
      
      if (session?.data?.user) {
        // Extract user data
        const userData: AuthUser = {
          id: session.data.user.id,
          email: session.data.user.email,
          name: session.data.user.name || session.data.user.email?.split('@')[0] || 'User',
          role: (session.data.user as any).role || 'member',
          emailVerified: session.data.user.emailVerified || false,
          image: session.data.user.image,
        };

        // Extract organization data (if available)
        const organizationData = session.data.session?.organization ? {
          id: session.data.session.organization.id,
          name: session.data.session.organization.name,
          slug: session.data.session.organization.slug,
          role: session.data.session.organization.role,
        } : null;

        // Update auth state
        auth$.user.set(userData);
        auth$.organization.set(organizationData);
        auth$.authToken.set(session.data.session?.token || 'authenticated');
        auth$.sessionExpiry.set(
          session.data.session?.expiresAt ? 
            new Date(session.data.session.expiresAt).toISOString() : 
            null
        );

        authLog.info('[AUTH$] User authenticated:', {
          userId: userData.id,
          organizationName: organizationData?.name
        });

        // Load user organizations after authentication check
        auth$.loadUserOrganizations();
      } else {
        // No user session - don't treat this as an error
        auth$.user.set(null);
        auth$.organization.set(null);
        auth$.authToken.set(null);
        auth$.sessionExpiry.set(null);
        authLog.info('[AUTH$] No user session found');
      }
    } catch (error) {
      authLog.info('[AUTH$] Auth check failed (treating as no session):', error);
      
      // Treat all auth check errors as "no session" to prevent error loops
      // Don't set error state during initial auth check
      auth$.user.set(null);
      auth$.organization.set(null);
      auth$.authToken.set(null);
      auth$.sessionExpiry.set(null);
      
      // Clear persisted state only if it's a clear auth failure (401, 403)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAuthFailure = errorMessage.includes('401') || 
                           errorMessage.includes('403') ||
                           errorMessage.includes('Unauthorized');
      
      if (isAuthFailure) {
        try {
          localStorage.removeItem('auth-machine-state');
          localStorage.removeItem('auth-machine-snapshot');
        } catch {
          // Ignore localStorage errors
        }
      }
    } finally {
      auth$.loading.set(false);
    }
  },

  clearError: (): void => {
    auth$.error.set(null);
  },

  loadUserOrganizations: async (): Promise<void> => {
    authLog.info('[AUTH$] Loading user organizations');
    auth$.loadingOrganizations.set(true);
    
    try {
      const response = await fetch(`${window.location.origin}/api/organizations`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // The API returns { organizations: [...] } format
      const organizations = data.organizations || data;
      
      if (!Array.isArray(organizations)) {
        throw new Error('Invalid organizations response format');
      }

      // Transform to AuthOrganization format - API returns flat organization objects
      const userOrganizations: AuthOrganization[] = organizations.map((org: any) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: 'owner' // Default role - this should come from membership data in the future
      }));

      auth$.userOrganizations.set(userOrganizations);

      // Set current organization if not already set and user has organizations
      if (!auth$.organization.get() && userOrganizations.length > 0) {
        auth$.organization.set(userOrganizations[0]);
      }

      authLog.info('[AUTH$] Loaded user organizations:', {
        count: userOrganizations.length,
        organizations: userOrganizations.map(org => ({ name: org.name, role: org.role })),
        currentOrg: auth$.organization.get()?.name
      });

    } catch (error) {
      authLog.error('[AUTH$] Failed to load user organizations:', error);
      auth$.userOrganizations.set([]);
      // Don't set error state for organization loading - it's not critical for auth
    } finally {
      auth$.loadingOrganizations.set(false);
    }
  }
});

// Initialize auth check on startup
auth$.checkAuth();

// Reactive effect: Auto-load universe context when organizations are loaded
// This connects Legend State auth to the universe schema system
import { when } from '@legendapp/state';

when(() => {
  const user = auth$.user.get();
  const organizations = auth$.userOrganizations.get();
  const loadingOrganizations = auth$.loadingOrganizations.get();
  
  // Trigger when we have a user, organizations loaded, and not currently loading
  return user && organizations.length > 0 && !loadingOrganizations;
}, async () => {
  const user = auth$.user.get();
  const organizations = auth$.userOrganizations.get();
  
  if (!user || organizations.length === 0) return;
  
  authLog.info('[AUTH$] Auto-loading universe context from Legend State auth', {
    userId: user.id,
    organizationCount: organizations.length,
    organizations: organizations.map(org => ({ id: org.id, name: org.name }))
  });
  
  try {
    const { initializeLegendState } = await import('@/legend-state/initialization');
    const organizationIds = organizations.map(org => org.id);
    const organizationData = organizations.map(org => ({ id: org.id, name: org.name }));
    
    await initializeLegendState(user.id, organizationIds, organizationData);
    
    authLog.info('[AUTH$] Successfully initialized Legend State from simplified initialization');
  } catch (error) {
    authLog.error('[AUTH$] Failed to load universe context from Legend State auth:', error);
  }
});

// Export computed values for convenience
export const isAuthenticated$ = () => auth$.user.get() !== null;
export const currentUser$ = auth$.user;
export const currentOrganization$ = auth$.organization;
export const authLoading$ = auth$.loading;
export const authError$ = auth$.error;