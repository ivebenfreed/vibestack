/**
 * Unified Authentication Observable
 * 
 * Seamlessly combines XState auth machine and Legend State auth into a single
 * reactive observable that always reflects the true authentication state
 * from either system.
 */

import { observable, computed } from '@legendapp/state'
import { auth$ } from './auth'
import { log } from '@/logger'

const unifiedAuthLog = log('legend-state/unified-auth')

/**
 * Unified authentication state that reactively combines XState and Legend State auth
 * 
 * Priority order:
 * 1. Legend State auth (if user is authenticated)
 * 2. XState auth machine (as fallback)
 * 3. Default unauthenticated state
 */
export const unifiedAuth$ = observable({
  // Core computed values that automatically update based on both auth systems
  isAuthenticated: computed(() => {
    // Check Legend State auth first (higher priority)
    const legendStateUser = auth$.user.get()
    const isLegendStateAuthenticated = !!legendStateUser
    
    // Check XState auth machine as fallback
    const authActor = (window as any).authMachineActor
    const isXStateAuthenticated = authActor ? 
      authActor.getSnapshot().matches('authenticated') && !!authActor.getSnapshot().context.user :
      false
    
    // Combine both states - either system can provide authentication
    const finalAuthenticated = isLegendStateAuthenticated || isXStateAuthenticated
    
    unifiedAuthLog.debug('[UnifiedAuth] Authentication check:', {
      legendStateAuth: isLegendStateAuthenticated,
      legendStateUser: legendStateUser?.email,
      xstateAuth: isXStateAuthenticated,
      finalResult: finalAuthenticated
    })
    
    return finalAuthenticated
  }),
  
  user: computed(() => {
    // Prefer Legend State user data when available
    const legendStateUser = auth$.user.get()
    if (legendStateUser) {
      return legendStateUser
    }
    
    // Fallback to XState user data
    const authActor = (window as any).authMachineActor
    if (authActor) {
      const snapshot = authActor.getSnapshot()
      return snapshot.context.user || null
    }
    
    return null
  }),
  
  organization: computed(() => {
    // Prefer Legend State organization data
    const legendStateOrg = auth$.organization.get()
    if (legendStateOrg) {
      return legendStateOrg
    }
    
    // Fallback to XState organization data
    const authActor = (window as any).authMachineActor
    if (authActor) {
      const snapshot = authActor.getSnapshot()
      return snapshot.context.currentOrganization || null
    }
    
    return null
  }),
  
  userOrganizations: computed(() => {
    // Prefer Legend State organizations
    const legendStateOrgs = auth$.userOrganizations.get()
    if (legendStateOrgs && legendStateOrgs.length > 0) {
      return legendStateOrgs
    }
    
    // Fallback to XState organizations
    const authActor = (window as any).authMachineActor
    if (authActor) {
      const snapshot = authActor.getSnapshot()
      return snapshot.context.userOrganizations || []
    }
    
    return []
  }),
  
  loading: computed(() => {
    // Loading if either system is loading
    const legendStateLoading = auth$.loading.get() || auth$.loadingOrganizations.get()
    
    const authActor = (window as any).authMachineActor
    const xstateLoading = authActor ? 
      authActor.getSnapshot().matches('checking') ||
      authActor.getSnapshot().matches('authenticated.loadingOrganizations') :
      false
    
    return legendStateLoading || xstateLoading
  }),
  
  error: computed(() => {
    // Show error from either system
    const legendStateError = auth$.error.get()
    if (legendStateError) return legendStateError
    
    const authActor = (window as any).authMachineActor
    if (authActor) {
      const snapshot = authActor.getSnapshot()
      return snapshot.context.authError || null
    }
    
    return null
  }),
  
  // Organization selection state
  needsOrganizationSelection: computed(() => {
    // Check XState first - it has detailed organization flow logic
    const authActor = (window as any).authMachineActor
    if (authActor) {
      const snapshot = authActor.getSnapshot()
      if (snapshot.matches('authenticated.needsOrganizationSelection')) {
        return true
      }
    }
    
    // Fallback: check if user is authenticated but has no organizations in Legend State
    const isAuthenticated = unifiedAuth$.isAuthenticated.get()
    const userOrganizations = unifiedAuth$.userOrganizations.get()
    const organizationsLoading = auth$.loadingOrganizations.get()
    
    return isAuthenticated && !organizationsLoading && (!userOrganizations || userOrganizations.length === 0)
  }),
  
  isLoadingOrganizations: computed(() => {
    // Loading organizations if either system is loading them
    const legendStateLoading = auth$.loadingOrganizations.get()
    
    const authActor = (window as any).authMachineActor
    const xstateLoading = authActor ? 
      authActor.getSnapshot().matches('authenticated.loadingOrganizations') :
      false
    
    return legendStateLoading || xstateLoading
  }),
  
  organizationSetupComplete: computed(() => {
    // Organization setup is complete if we have organizations and not in setup flows
    const userOrganizations = unifiedAuth$.userOrganizations.get()
    const needsSelection = unifiedAuth$.needsOrganizationSelection.get()
    const isLoadingOrgs = unifiedAuth$.isLoadingOrganizations.get()
    
    return !needsSelection && !isLoadingOrgs && (userOrganizations?.length || 0) > 0
  }),

  // System readiness combines auth + universe schema
  isSystemReady: computed(() => {
    const isAuthenticated = unifiedAuth$.isAuthenticated.get()
    if (!isAuthenticated) return false
    
    // Check if universe schema has organizations (indicates system is ready)
    try {
      // Access universe context from global window object to avoid circular dependencies
      const universeContext = (window as any).universeContext$?.get?.()
      if (!universeContext) {
        // Fallback: if we can't access universe context, check Legend State auth organizations directly
        const userOrganizations = unifiedAuth$.userOrganizations.get()
        const hasOrganizations = userOrganizations && userOrganizations.length > 0
        
        unifiedAuthLog.debug('[UnifiedAuth] System readiness check (via Legend State auth):', {
          isAuthenticated,
          hasOrganizations,
          organizationCount: userOrganizations?.length || 0
        })
        
        return hasOrganizations
      }
      
      const organizations = universeContext?.organizations || {}
      const hasOrganizations = Object.keys(organizations).length > 0
      
      unifiedAuthLog.debug('[UnifiedAuth] System readiness check:', {
        isAuthenticated,
        hasOrganizations,
        organizationCount: Object.keys(organizations).length
      })
      
      return hasOrganizations
    } catch (error) {
      unifiedAuthLog.warn('[UnifiedAuth] Could not check universe context for system readiness:', error)
      return false
    }
  })
})

// Export computed helpers for easy access
export const isAuthenticated$ = unifiedAuth$.isAuthenticated
export const currentUser$ = unifiedAuth$.user
export const currentOrganization$ = unifiedAuth$.organization
export const userOrganizations$ = unifiedAuth$.userOrganizations
export const authLoading$ = unifiedAuth$.loading
export const authError$ = unifiedAuth$.error
export const isSystemReady$ = unifiedAuth$.isSystemReady

// Helper function to get current auth state synchronously
export const getAuthState = () => {
  return {
    isAuthenticated: unifiedAuth$.isAuthenticated.get(),
    user: unifiedAuth$.user.get(),
    organization: unifiedAuth$.organization.get(),
    userOrganizations: unifiedAuth$.userOrganizations.get(),
    loading: unifiedAuth$.loading.get(),
    error: unifiedAuth$.error.get(),
    isSystemReady: unifiedAuth$.isSystemReady.get()
  }
}

// Log authentication state changes (only when value actually changes)
let lastAuthState: { isAuthenticated: boolean; userEmail?: string } | null = null
unifiedAuth$.isAuthenticated.onChange((value) => {
  // Extract actual boolean value (onChange may pass observable wrapper)
  const isAuthenticated = typeof value === 'object' && 'value' in value ? value.value : value
  const user = unifiedAuth$.user.get()
  const currentState = {
    isAuthenticated: !!isAuthenticated,
    userEmail: user?.email
  }

  // Only log if state actually changed
  if (!lastAuthState ||
      lastAuthState.isAuthenticated !== currentState.isAuthenticated ||
      lastAuthState.userEmail !== currentState.userEmail) {
    unifiedAuthLog.info('[UnifiedAuth] Authentication state changed:', {
      isAuthenticated: currentState.isAuthenticated,
      userEmail: user?.email,
      source: user ? 'determined from available auth systems' : 'no user data'
    })
    lastAuthState = currentState
  }
})

// Log system readiness changes (only when value actually changes)
let lastSystemReady: boolean | null = null
unifiedAuth$.isSystemReady.onChange((value) => {
  // Extract actual boolean value (onChange may pass observable wrapper)
  const isReady = typeof value === 'object' && 'value' in value ? value.value : value
  const readyBool = !!isReady

  // Only log if state actually changed
  if (lastSystemReady !== readyBool) {
    unifiedAuthLog.info('[UnifiedAuth] System readiness changed:', { isReady: readyBool })
    lastSystemReady = readyBool
  }
})

unifiedAuthLog.info('[UnifiedAuth] Unified authentication observable initialized')