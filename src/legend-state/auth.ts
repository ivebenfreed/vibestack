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
  organization: AuthOrganization | null;
  loading: boolean;
  error: string | null;
  sessionExpiry: string | null;
  authToken: string | null;
}

// Legend State Observable for Auth
export const auth$ = observable<AuthState & {
  // Actions
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}>({
  // State
  user: null,
  organization: null,
  loading: true,
  error: null,
  sessionExpiry: null,
  authToken: null,

  // Actions
  signIn: async (email: string, password: string): Promise<boolean> => {
    authLog.info('[AUTH$] Starting sign-in for:', email);
    auth$.loading.set(true);
    auth$.error.set(null);

    try {
      const result = await authClient.signIn.email({ email, password });
      
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
    
    try {
      await authClient.signOut();
      authLog.info('[AUTH$] Sign-out successful');
    } catch (error) {
      authLog.error('[AUTH$] Sign-out error:', error);
      // Continue with clearing state even if API call fails
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
      } else {
        // No user session
        auth$.user.set(null);
        auth$.organization.set(null);
        auth$.authToken.set(null);
        auth$.sessionExpiry.set(null);
        authLog.info('[AUTH$] No user session found');
      }
    } catch (error) {
      authLog.error('[AUTH$] Auth check failed:', error);
      
      // Handle session errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isSessionExpired = errorMessage.includes('401') || 
                               errorMessage.includes('Unauthorized') ||
                               errorMessage.includes('session expired');
      
      if (isSessionExpired) {
        // Clear expired session
        auth$.user.set(null);
        auth$.organization.set(null);
        auth$.authToken.set(null);
        auth$.sessionExpiry.set(null);
        
        // Clear persisted state
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
  }
});

// Initialize auth check on startup
auth$.checkAuth();

// Export computed values for convenience
export const isAuthenticated$ = () => auth$.user.get() !== null;
export const currentUser$ = auth$.user;
export const currentOrganization$ = auth$.organization;
export const authLoading$ = auth$.loading;
export const authError$ = auth$.error;