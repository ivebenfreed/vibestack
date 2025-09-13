import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router'
import React, { useEffect } from 'react'
import { observer } from '@legendapp/state/react'
import { UnifiedLayout } from '@/components/layout/unified-layout'
import { SearchProvider } from '@/context/search-context'
import { PostAuthOrganizationSetup } from '@/features/auth/components/PostAuthOrganizationSetup'
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen'
import { TrialExpiredGuard } from '@/components/guards/TrialExpiredGuard'
import { useAuth } from '@/state-machines'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
// import SkipToMain from '@/components/skip-to-main' - Disabled: phantom component issue
import { Project, Task, User } from '@/db/client-entities'
import { getDefaultStore } from 'jotai'
import { log } from '@/logger'
import { auth$ } from '@/legend-state/auth'

// Removed session tracking - components handle their own initialization state

// Create logger instance for this file
const myLog = log('routes/_authenticated/route.tsx');

export const Route = createFileRoute('/_authenticated')({
  pendingComponent: UnifiedLoadingScreen,
  beforeLoad: async ({ location }) => {
    // Get auth actor - if not available, redirect to sign-in
    const authActor = (window as any).authMachineActor
    if (!authActor) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.pathname },
        replace: true
      })
    }
    
    // If auth machine is still checking, wait for it to resolve
    const currentSnapshot = authActor.getSnapshot()
    if (currentSnapshot.matches('checking')) {
      myLog.info('Waiting for auth resolution...')
      
      await new Promise<void>((resolve) => {
        let resolved = false
        
        const subscription = authActor.subscribe((snapshot: any) => {
          if (!resolved && !snapshot.matches('checking')) {
            resolved = true
            subscription.unsubscribe()
            resolve()
          }
        })
        
        // Check again immediately in case it resolved while setting up subscription
        if (!authActor.getSnapshot().matches('checking')) {
          resolved = true
          subscription.unsubscribe()
          resolve()
        }
      })
    }
    
    // Check final auth state
    const finalAuthSnapshot = authActor.getSnapshot()
    myLog.info('Final auth state check:', {
      matches: finalAuthSnapshot.value,
      user: !!finalAuthSnapshot.context.user,
      authError: finalAuthSnapshot.context.authError,
      errorRetryCount: finalAuthSnapshot.context.errorRetryCount,
      path: window.location.pathname
    })
    
    // Allow errorRecovery state - don't redirect immediately
    if (finalAuthSnapshot.matches('errorRecovery')) {
      myLog.info('In error recovery state, allowing access with persisted auth')
      // The error recovery state will handle retries and eventual redirect if needed
      return
    }
    
    // Check Legend State auth as fallback - wait for loading to complete
    const legendStateLoading = auth$.loading.get()
    const legendStateUser = auth$.user.get()
    const isLegendStateAuthenticated = !!legendStateUser
    
    // If Legend State is still loading, wait for it to complete
    if (legendStateLoading && !legendStateUser) {
      myLog.info('Legend State auth still loading, waiting for completion...')
      
      await new Promise<void>((resolve) => {
        let resolved = false
        
        const checkState = () => {
          const currentLoading = auth$.loading.get()
          const currentUser = auth$.user.get()
          
          // Resolve when loading completes (either with user or without)
          if (!resolved && !currentLoading) {
            resolved = true
            resolve()
          }
        }
        
        // Subscribe to loading state changes
        const unsubscribe = auth$.loading.onChange(checkState)
        
        // Check immediately in case it already finished
        checkState()
        
        // Cleanup subscription after resolve
        setTimeout(() => {
          if (resolved) unsubscribe()
        }, 0)
      })
    }
    
    // Re-check Legend State auth after waiting
    const finalLegendStateUser = auth$.user.get()
    const finalIsLegendStateAuthenticated = !!finalLegendStateUser
    
    // Allow access if either XState or Legend State shows authenticated user
    const isAuthenticated = (finalAuthSnapshot.matches('authenticated') && finalAuthSnapshot.context.user) || 
                           finalIsLegendStateAuthenticated
    
    myLog.info('Combined auth check:', {
      xstateAuth: finalAuthSnapshot.matches('authenticated') && !!finalAuthSnapshot.context.user,
      legendStateAuth: finalIsLegendStateAuthenticated,
      legendStateUser: finalLegendStateUser?.email,
      finalDecision: isAuthenticated
    })
    
    if (!isAuthenticated) {
      myLog.info('Redirecting to sign-in from:', window.location.pathname)
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.pathname },
        replace: true
      })
    }

    // Check if we're in organization setup phase - allow access but don't check system readiness yet
    const isInOrgSetup = finalAuthSnapshot.matches('authenticated.loadingOrganizations') ||
                         finalAuthSnapshot.matches('authenticated.needsOrganizationSelection') ||
                         finalAuthSnapshot.matches('authenticated.creatingOrganization') ||
                         finalAuthSnapshot.matches('authenticated.selectingOrganization') ||
                         finalAuthSnapshot.matches('authenticated.loadingBilling') ||
                         finalAuthSnapshot.matches('authenticated.trialExpiredSetup') ||
                         finalAuthSnapshot.matches('authenticated.upgradingSubscription');

    if (isInOrgSetup) {
      myLog.info('In organization setup phase, skipping system readiness check')
      return
    }
    
    // FIXED: Removed blocking Legend State check from beforeLoad to prevent white screen
    // Components will handle their own loading states using UnifiedLoadingScreen
    myLog.info('Route loading - components will handle Legend State initialization')
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SearchProvider>
      <AuthenticatedContent />
    </SearchProvider>
  )
}

const AuthenticatedContent = observer(function AuthenticatedContent() {
  myLog.info('AuthenticatedContent Rendering at', Date.now());
  
  // Use unified auth system that combines XState and Legend State
  const unifiedAuth = useUnifiedAuth();
  
  // Fallback to XState auth machine if available
  const xstateAuth = useAuth();
  
  // Determine auth state - prefer unified auth, fallback to XState
  const authState = {
    isCheckingAuth: unifiedAuth.loading || xstateAuth?.isCheckingAuth || false,
    needsOrganizationSelection: unifiedAuth.needsOrganizationSelection || xstateAuth?.needsOrganizationSelection || false,
    isLoadingOrganizations: unifiedAuth.isLoadingOrganizations || xstateAuth?.isLoadingOrganizations || false,
    isAuthenticatedAndReady: unifiedAuth.isAuthenticatedAndReady,
    organizationSetupComplete: unifiedAuth.organizationSetupComplete || xstateAuth?.organizationSetupComplete || true,
    user: unifiedAuth.user || xstateAuth?.user
  };
  
  myLog.info('AuthenticatedContent Auth states:', {
    unifiedAuthState: {
      isAuthenticated: unifiedAuth.isAuthenticated,
      isSystemReady: unifiedAuth.isSystemReady,
      isLoading: unifiedAuth.isLoading,
      hasUser: !!unifiedAuth.user,
      userEmail: unifiedAuth.user?.email
    },
    xstateAuthState: {
      available: !!xstateAuth,
      isCheckingAuth: xstateAuth?.isCheckingAuth,
      isAuthenticatedAndReady: xstateAuth?.isAuthenticatedAndReady,
      hasUser: !!xstateAuth?.user
    },
    finalAuthState: authState
  });
  
  const currentOrgId = authState.user?.currentOrganizationId;
  
  // Note: Legend State context loading is now handled in __root.tsx
  // No need for duplicate initialization here
  
  // The sidebar entity groups are now automatically updated in loadOrgContext

  // Show unified loading screen during auth/org initialization
  // Simplified loading logic - removed artificial delay that caused flickering
  if (authState.isCheckingAuth || authState.isLoadingOrganizations ||
      (!authState.isAuthenticatedAndReady && !authState.needsOrganizationSelection)) {
    return <UnifiedLoadingScreen />;
  }

  // Show organization setup if needed (after loading is done)
  if (authState.needsOrganizationSelection) {
    return <PostAuthOrganizationSetup />;
  }

  // Show loading if still not fully ready after org setup
  if (!authState.isAuthenticatedAndReady || !authState.organizationSetupComplete) {
    return <UnifiedLoadingScreen />;
  }

  // Render the main app with trial expiration guard
  return (
    <TrialExpiredGuard>
      <div data-testid="authenticated-content" className="min-h-screen bg-background">
        {/* <SkipToMain /> - Disabled: phantom component issue */}
        <UnifiedLayout />
      </div>
    </TrialExpiredGuard>
  )
})
