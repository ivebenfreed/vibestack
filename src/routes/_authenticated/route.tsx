import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router'
import React, { useEffect } from 'react'
import { observer } from '@legendapp/state/react'
import { UnifiedLayout } from '@/components/layout/unified-layout'
import { SearchProvider } from '@/context/search-context'
import { PostAuthOrganizationSetup } from '@/features/auth/components/PostAuthOrganizationSetup'
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen'
import { TrialExpiredGuard } from '@/components/guards/TrialExpiredGuard'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
// import SkipToMain from '@/components/skip-to-main' - Disabled: phantom component issue
import { Project, Task, User } from '@/db/client-entities'
import { getDefaultStore } from 'jotai'
import { log } from '@/logger'
import { auth$ } from '@/legend-state/auth'
import { useRouteReady } from '@/legend-state/route-readiness'

// Removed session tracking - components handle their own initialization state

// Create logger instance for this file
const myLog = log('routes/_authenticated/route.tsx');

export const Route = createFileRoute('/_authenticated')({
  pendingComponent: UnifiedLoadingScreen,
  beforeLoad: async ({ location }) => {
    // AUTH MACHINE REMOVED - Use Legend State auth directly
    myLog.debug('[APP-INIT] _authenticated beforeLoad triggered', { path: location.pathname })
    
    // Check Legend State auth - wait for loading to complete
    const legendStateLoading = auth$.loading.get()
    const legendStateUser = auth$.user.get()
    const isLegendStateAuthenticated = !!legendStateUser
    
    // If Legend State is still loading, wait for it to complete
    if (legendStateLoading && !legendStateUser) {
      
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
    
    
    if (!finalIsLegendStateAuthenticated) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.pathname },
        replace: true
      })
    }
    
    // Components will handle their own loading states using UnifiedLoadingScreen
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

  // Signal route readiness
  useRouteReady();

  // Use unified auth system that combines XState and Legend State
  const unifiedAuth = useUnifiedAuth();
  
  
  // Use unified auth state directly
  const authState = {
    isCheckingAuth: unifiedAuth.loading,
    needsOrganizationSelection: unifiedAuth.needsOrganizationSelection,
    isLoadingOrganizations: unifiedAuth.isLoadingOrganizations,
    isAuthenticatedAndReady: unifiedAuth.isAuthenticatedAndReady,
    organizationSetupComplete: unifiedAuth.organizationSetupComplete,
    user: unifiedAuth.user
  };
  
  
  const currentOrgId = authState.user?.currentOrganizationId;
  
  // Note: Legend State context loading is now handled in __root.tsx
  // No need for duplicate initialization here
  
  // The sidebar entity groups are now automatically updated in loadOrgContext

  // Show unified loading screen during auth/org initialization
  // Simplified loading logic - removed artificial delay that caused flickering
  if (authState.isCheckingAuth || authState.isLoadingOrganizations ||
      (!authState.isAuthenticatedAndReady && !authState.needsOrganizationSelection)) {
    myLog.debug('[APP-INIT] AuthenticatedContent showing loading screen - auth/org state', {
      isCheckingAuth: authState.isCheckingAuth,
      isLoadingOrganizations: authState.isLoadingOrganizations,
      isAuthenticatedAndReady: authState.isAuthenticatedAndReady,
      needsOrganizationSelection: authState.needsOrganizationSelection
    });
    return <UnifiedLoadingScreen />;
  }

  // Show organization setup if needed (after loading is done)
  if (authState.needsOrganizationSelection) {
    myLog.debug('[APP-INIT] AuthenticatedContent showing PostAuthOrganizationSetup');
    return <PostAuthOrganizationSetup />;
  }

  // Show loading if still not fully ready after org setup
  if (!authState.isAuthenticatedAndReady || !authState.organizationSetupComplete) {
    myLog.debug('[APP-INIT] AuthenticatedContent showing loading screen - not ready', {
      isAuthenticatedAndReady: authState.isAuthenticatedAndReady,
      organizationSetupComplete: authState.organizationSetupComplete
    });
    return <UnifiedLoadingScreen />;
  }

  myLog.debug('[APP-INIT] AuthenticatedContent rendering main app content');

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
