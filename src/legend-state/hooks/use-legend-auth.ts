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
  const userOrganizations = useObservable(auth$.userOrganizations);
  const loading = useObservable(authLoading$);
  const loadingOrganizations = useObservable(auth$.loadingOrganizations);
  const error = useObservable(authError$);
  const isAuthenticated = !!user; // Computed from user state

  // Actions from the auth observable - functions don't need .get()
  const signIn = auth$.signIn;
  const signOut = auth$.signOut;
  const checkAuth = auth$.checkAuth;
  const loadUserOrganizations = auth$.loadUserOrganizations;
  const clearError = auth$.clearError;

  // Get values for logging (don't pass observables directly)
  const userValue = user?.get ? user.get() : user;
  const organizationValue = organization?.get ? organization.get() : organization;
  const userOrganizationsValue = userOrganizations?.get ? userOrganizations.get() : userOrganizations;
  const loadingValue = loading?.get ? loading.get() : loading;
  const loadingOrganizationsValue = loadingOrganizations?.get ? loadingOrganizations.get() : loadingOrganizations;
  const errorValue = error?.get ? error.get() : error;

  myLog.info('[useLegendAuth] Hook called with state:', {
    hasUser: !!userValue,
    userEmail: userValue?.email,
    organizationName: organizationValue?.name,
    userOrganizationsCount: userOrganizationsValue?.length || 0,
    isAuthenticated,
    loading: loadingValue,
    loadingOrganizations: loadingOrganizationsValue,
    hasError: !!errorValue
  });

  return {
    // State
    user: userValue,
    organization: organizationValue,
    userOrganizations: userOrganizationsValue || [],
    loading: loadingValue,
    loadingOrganizations: loadingOrganizationsValue,
    error: errorValue,
    isAuthenticated,
    
    // Actions
    signIn,
    signOut,
    checkAuth,
    loadUserOrganizations,
    clearError,
    
    // Convenience computed values
    isSigningIn: loadingValue && !userValue, // Loading but no user means signing in
    isCheckingAuth: loadingValue && !errorValue, // Loading without error means checking
    hasAuthError: !!errorValue,
    userRole: userValue?.role || null,
    organizationRole: organizationValue?.role || null,
    hasMultipleOrganizations: (userOrganizationsValue?.length || 0) > 1,
    isLoadingOrganizations: !!loadingOrganizationsValue,
  };
}
