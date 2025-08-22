import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
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

// Track if we've verified system readiness in this session
let hasVerifiedSystemThisSession = false;

// Reset on sign-out
if (typeof window !== 'undefined') {
  window.addEventListener('auth:signout', () => {
    hasVerifiedSystemThisSession = false;
  });
}

export const Route = createFileRoute('/_authenticated')({
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
    
    // Only check system ready once per session (after sign-in)
    if (!hasVerifiedSystemThisSession) {
      const appInitActor = (window as any).appInitActor
      if (appInitActor) {
        // Get app init machine directly
        const appInitMachine = appInitActor
        
        if (!appInitMachine) {
          console.error('[AuthenticatedRoute] App init machine not found')
          return
        }
        
        const appInitSnapshot = appInitMachine.getSnapshot()
        const isSystemReady = appInitSnapshot?.value === 'ready' || false
        
        console.log('[AuthenticatedRoute] System check:', {
          hasAppInitMachine: !!appInitMachine,
          appInitState: appInitSnapshot?.value,
          isSystemReady
        })
        
        if (!isSystemReady) {
          console.log('[AuthenticatedRoute] First access this session - waiting for system initialization...')
          
          await new Promise<void>((resolve) => {
            let resolved = false
            
            // Subscribe directly to app init machine changes
            const subscription = appInitMachine.subscribe((snapshot: any) => {
              // Also check sync machine state when we're in sync state
              let syncMachineInfo = ''
              if (snapshot?.value === 'sync') {
                const appInitSnapshot = appInitActor.getSnapshot()
                const syncMachine = appInitSnapshot?.children?.syncMachine
                if (syncMachine) {
                  const syncSnapshot = syncMachine.getSnapshot()
                  syncMachineInfo = ` | Sync: ${syncSnapshot?.value} (phase: ${syncSnapshot?.context?.syncPhase})`
                }
              }
              
              console.log('[AuthenticatedRoute] App init machine change:', {
                state: snapshot?.value,
                isReady: snapshot?.value === 'ready',
                syncInfo: syncMachineInfo
              })
              
              if (!resolved && snapshot?.value === 'ready') {
                console.log('[AuthenticatedRoute] ✅ App init machine reached ready state!')
                resolved = true
                subscription.unsubscribe()
                resolve()
              }
            })
            
            // Check again immediately in case it resolved while setting up subscription
            const currentSnapshot = appInitMachine.getSnapshot()
            if (currentSnapshot?.value === 'ready') {
              console.log('[AuthenticatedRoute] ✅ Already ready during subscription setup')
              resolved = true
              subscription.unsubscribe()
              resolve()
            }
          })
        }
        
        // Mark as verified for this session
        hasVerifiedSystemThisSession = true;
        console.log('[AuthenticatedRoute] System verified for this session')
      }
    }
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
  const { 
    isCheckingAuth,
    needsOrganizationSetup, 
    needsOrganizationSelection,
    isLoadingOrganizations,
    isAuthenticatedAndReady,
    organizationSetupComplete,
    user
  } = useAuth();
  
  const currentOrgId = user?.currentOrganizationId;
  
  // Initialize store when organization changes
  useEffect(() => {
    if (currentOrgId) {
      switchToOrganization(currentOrgId).catch(error => {
        console.error('[AuthenticatedContent] Failed to switch organization:', error)
      })
    }
  }, [currentOrgId])
  
  // The sidebar entity groups are now automatically updated in switchToOrganization

  // Show unified loading screen during auth/org initialization
  // This covers both auth checking and organization loading phases
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
    <div data-testid="authenticated-content">
      {/* <SkipToMain /> - Disabled: phantom component issue */}
      <UnifiedLayout />
    </div>
  )
})
