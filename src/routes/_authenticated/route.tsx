import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from '@tanstack/react-router'
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
  // PERFORMANCE: Removed beforeLoad - any async function blocks navigation
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
  const navigate = useNavigate()
  const location = useLocation()

  // Signal route readiness
  useRouteReady();

  // Use unified auth system that combines XState and Legend State
  const unifiedAuth = useUnifiedAuth();

  // Handle authentication redirect when auth loads
  useEffect(() => {
    // Only redirect if auth has finished loading and user is not authenticated
    // Don't redirect to sign-in with sign-in as the redirect parameter
    if (!unifiedAuth.loading && !unifiedAuth.isAuthenticated) {
      myLog.debug('[APP-INIT] User not authenticated after auth load, redirecting to sign-in', {
        path: location.pathname
      });

      const redirectParam = location.pathname.startsWith('/sign-in') ? {} : { redirect: location.pathname };
      navigate({
        to: '/sign-in',
        search: redirectParam,
        replace: true
      });
    }
  }, [unifiedAuth.loading, unifiedAuth.isAuthenticated, navigate, location.pathname]);
  
  
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
