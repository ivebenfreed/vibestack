/**
 * React Hook for Unified Authentication
 * 
 * Uses Legend State observables to provide seamless authentication state
 * that automatically combines XState and Legend State auth systems.
 */

import { use$ } from '@legendapp/state/react'
import React from 'react'
import { unifiedAuth$, getAuthState } from '../unified-auth'
import { log } from '@/logger'

const hookLog = log('legend-state/hooks/use-unified-auth')

/**
 * Hook that provides unified authentication state from both auth systems
 * 
 * This hook automatically:
 * - Combines XState and Legend State auth into single reactive values
 * - Prioritizes Legend State auth when available
 * - Falls back to XState auth machine
 * - Handles system readiness (auth + universe schema)
 * - Provides real-time reactive updates
 */
export function useUnifiedAuth() {
  // Use Legend State's use$ hook for consuming computed observables
  // This is the correct pattern for Legend State v3
  const isAuthenticated = use$(unifiedAuth$.isAuthenticated)
  const user = use$(unifiedAuth$.user) 
  const organization = use$(unifiedAuth$.organization)
  const userOrganizations = use$(unifiedAuth$.userOrganizations)
  const loading = use$(unifiedAuth$.loading)
  const error = use$(unifiedAuth$.error)
  const isSystemReady = use$(unifiedAuth$.isSystemReady)
  const needsOrganizationSelection = use$(unifiedAuth$.needsOrganizationSelection)
  const isLoadingOrganizations = use$(unifiedAuth$.isLoadingOrganizations)
  const organizationSetupComplete = use$(unifiedAuth$.organizationSetupComplete)

  // Derived state for convenience
  const isAuthenticatedAndReady = isAuthenticated && isSystemReady
  const userEmail = user?.email || null
  const organizationName = organization?.name || null
  const userOrganizationsCount = userOrganizations?.length || 0

  hookLog.debug('[useUnifiedAuth] Hook called with state:', {
    hasUser: !!user,
    userEmail,
    organizationName,
    userOrganizationsCount,
    isAuthenticated,
    isSystemReady,
    isAuthenticatedAndReady,
    loading,
    hasError: !!error
  })

  return {
    // Core auth state
    isAuthenticated,
    user,
    organization,
    userOrganizations,
    loading,
    error,
    
    // Organization state
    needsOrganizationSelection,
    isLoadingOrganizations,
    organizationSetupComplete,
    
    // System state
    isSystemReady,
    isAuthenticatedAndReady,
    
    // Convenience properties
    userEmail,
    organizationName,
    userOrganizationsCount,
    
    // Utility functions
    getAuthState: () => getAuthState()
  }
}

/**
 * Hook for just checking authentication status (lighter weight)
 */
export function useIsAuthenticated() {
  return use$(unifiedAuth$.isAuthenticated)
}

/**
 * Hook for just checking system readiness
 */
export function useIsSystemReady() {
  return use$(unifiedAuth$.isSystemReady)
}

/**
 * Hook for current user data
 */
export function useCurrentUser() {
  return use$(unifiedAuth$.user)
}

/**
 * Hook for current organization
 */
export function useCurrentOrganization() {
  return use$(unifiedAuth$.organization)
}