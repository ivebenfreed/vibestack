import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router'
import React, { useEffect } from 'react'
import { observer } from '@legendapp/state/react'
import { UnifiedLayout } from '@/components/layout/unified-layout'
import { SearchProvider } from '@/context/search-context'
import { PostAuthOrganizationSetup } from '@/features/auth/components/PostAuthOrganizationSetup'
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen'
import { useAuth } from '@/state-machines'
// import SkipToMain from '@/components/skip-to-main' - Disabled: phantom component issue
import { Project, Task, User } from '@/db/client-entities'
import { getDefaultStore } from 'jotai'
import { switchToOrganization } from '@/stores/org-data-store'

// Removed session tracking - components handle their own initialization state

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
      console.log('[AuthenticatedRoute] Waiting for auth resolution...')
      
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
    console.log('[AuthenticatedRoute] Final auth state check:', {
      matches: finalAuthSnapshot.value,
      user: !!finalAuthSnapshot.context.user,
      authError: finalAuthSnapshot.context.authError,
      errorRetryCount: finalAuthSnapshot.context.errorRetryCount,
      path: window.location.pathname
    })
    
    // Allow errorRecovery state - don't redirect immediately
    if (finalAuthSnapshot.matches('errorRecovery')) {
      console.log('[AuthenticatedRoute] In error recovery state, allowing access with persisted auth')
      // The error recovery state will handle retries and eventual redirect if needed
      return
    }
    
    if (!finalAuthSnapshot.matches('authenticated') || !finalAuthSnapshot.context.user) {
      console.log('[AuthenticatedRoute] Redirecting to sign-in from:', window.location.pathname)
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.pathname },
        replace: true
      })
    }

    // Check if we're in organization setup phase - allow access but don't check system readiness yet
    const isInOrgSetup = finalAuthSnapshot.matches('authenticated.loadingOrganizations') ||
                         finalAuthSnapshot.matches('authenticated.needsOrganizationSetup') ||
                         finalAuthSnapshot.matches('authenticated.needsOrganizationSelection') ||
                         finalAuthSnapshot.matches('authenticated.creatingOrganization') ||
                         finalAuthSnapshot.matches('authenticated.selectingOrganization') ||
                         finalAuthSnapshot.matches('authenticated.loadingBilling') ||
                         finalAuthSnapshot.matches('authenticated.trialExpiredSetup') ||
                         finalAuthSnapshot.matches('authenticated.upgradingSubscription');

    if (isInOrgSetup) {
      console.log('[AuthenticatedRoute] In organization setup phase, skipping system readiness check')
      return
    }
    
    // FIXED: Removed blocking Legend State check from beforeLoad to prevent white screen
    // Components will handle their own loading states using UnifiedLoadingScreen
    console.log('[AuthenticatedRoute] Route loading - components will handle Legend State initialization')
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
  console.log('[AuthenticatedContent] Rendering at', Date.now());
  const { 
    isCheckingAuth,
    needsOrganizationSetup, 
    needsOrganizationSelection,
    isLoadingOrganizations,
    isAuthenticatedAndReady,
    organizationSetupComplete,
    user
  } = useAuth();
  
  console.log('[AuthenticatedContent] Auth states:', {
    isCheckingAuth,
    isLoadingOrganizations,
    isAuthenticatedAndReady,
    organizationSetupComplete
  });
  
  const currentOrgId = user?.currentOrganizationId;
  const [hasInitializedOrg, setHasInitializedOrg] = React.useState(false);
  
  // Initialize store ONLY on first load, not when organization changes
  useEffect(() => {
    if (currentOrgId && !hasInitializedOrg) {
      console.log('[AuthenticatedContent] Initial organization setup:', currentOrgId);
      switchToOrganization(currentOrgId).then(() => {
        setHasInitializedOrg(true);
      }).catch(error => {
        console.error('[AuthenticatedContent] Failed to initialize organization:', error)
        setHasInitializedOrg(true); // Continue anyway to prevent infinite loading
      })
    }
  }, [currentOrgId, hasInitializedOrg])
  
  // The sidebar entity groups are now automatically updated in switchToOrganization

  // Show unified loading screen during auth/org initialization
  // Simplified loading logic - removed artificial delay that caused flickering
  if (isCheckingAuth || isLoadingOrganizations ||
      (!isAuthenticatedAndReady && !needsOrganizationSetup && !needsOrganizationSelection)) {
    return <UnifiedLoadingScreen />;
  }

  // Show organization setup if needed (after loading is done)
  if (needsOrganizationSetup || needsOrganizationSelection) {
    return <PostAuthOrganizationSetup />;
  }

  // Show loading if still not fully ready after org setup
  if (!isAuthenticatedAndReady || !organizationSetupComplete) {
    return <UnifiedLoadingScreen />;
  }

  // Render the main app
  return (
    <div data-testid="authenticated-content" className="min-h-screen bg-background">
      {/* <SkipToMain /> - Disabled: phantom component issue */}
      <UnifiedLayout />
    </div>
  )
})
