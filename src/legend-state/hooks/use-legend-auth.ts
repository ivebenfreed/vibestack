import { useObservable } from '@legendapp/state/react';
import { auth$, isAuthenticated$, currentUser$, currentOrganization$, authLoading$, authError$ } from '../auth';
import { log } from '@/logger';

const myLog = log('legend-state/hooks/use-legend-auth.ts');

/**
 * React hook for Legend State auth system
 * Simpler alternative to the complex XState auth machine
 */
export function useLegendAuth() {
  // Use Legend State reactive hooks
  const user = useObservable(currentUser$);
  const organization = useObservable(currentOrganization$);
  const loading = useObservable(authLoading$);
  const error = useObservable(authError$);
  const isAuthenticated = !!user; // Computed from user state

  // Actions from the auth observable
  const signIn = auth$.signIn.get();
  const signOut = auth$.signOut.get();
  const checkAuth = auth$.checkAuth.get();
  const clearError = auth$.clearError.get();

  // Get values for logging (don't pass observables directly)
  const userValue = user?.get ? user.get() : user;
  const organizationValue = organization?.get ? organization.get() : organization;
  const loadingValue = loading?.get ? loading.get() : loading;
  const errorValue = error?.get ? error.get() : error;

  myLog.info('[useLegendAuth] Hook called with state:', {
    hasUser: !!userValue,
    userEmail: userValue?.email,
    organizationName: organizationValue?.name,
    isAuthenticated,
    loading: loadingValue,
    hasError: !!errorValue
  });

  return {
    // State
    user: userValue,
    organization: organizationValue,
    loading: loadingValue,
    error: errorValue,
    isAuthenticated,
    
    // Actions
    signIn,
    signOut,
    checkAuth,
    clearError,
    
    // Convenience computed values
    isSigningIn: loadingValue && !userValue, // Loading but no user means signing in
    isCheckingAuth: loadingValue && !errorValue, // Loading without error means checking
    hasAuthError: !!errorValue,
    userRole: userValue?.role || null,
    organizationRole: organizationValue?.role || null,
  };
}
