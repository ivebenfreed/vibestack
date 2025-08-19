// import { QueryClient } from '@tanstack/react-query' // ❌ DISABLED: Moved away from traditional queries per universal-reactive-data-pattern
import { createRootRouteWithContext, Outlet, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@/components/ui/sonner'
import GeneralError from '@/features/errors/general-error'
import NotFoundError from '@/features/errors/not-found-error'
import { useEffect, useState } from 'react'
import { InitializationErrorBoundary } from '@/components/error-boundary'
import { AuthAwareProviders } from '@/components/providers/AuthAwareProviders'
import { Task, Project, User } from '@/db/client-entities'
// import { useAuth } from '@/state-machines' // 🔥 REPLACED with V2 orchestrator hook
import { authClient } from '@/lib/auth'
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen'
import { IntegrityMonitor } from '@/components/IntegrityMonitor'
// 🔥 NEW: Import XState machines directly (no orchestrator needed)
import { createActor } from 'xstate'
import { authMachine } from '@/state-machines/machines/auth-machine'
import { appInitMachine } from '@/state-machines/machines/app-init-machine'
import { pureLiveStoreSyncMachine } from '@/state-machines/machines/pure-livestore-sync-machine'
import { xstateTestInspector } from '@/test-utils/xstate-test-inspector'
import { useAuth, useSystem } from '@/state-machines'
import React from 'react'
import { useRouter } from '@tanstack/react-router'

// Router context interface with atom setters
interface RouterContext {
  // queryClient?: QueryClient // ❌ DISABLED: Made optional since we moved away from traditional queries per universal-reactive-data-pattern
  setTaskAtoms: (tasks: Task[]) => void
  setProjectAtoms: (projects: Project[]) => void
  setUserAtoms: (users: User[]) => void
}

// Create app init machine actor directly (no orchestrator needed)
const createAppInitActor = () => {
  console.log('[XSTATE] Creating app init machine actor...')
  
  // Add inspection in test/dev mode
  const inspectOptions = (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') 
    ? { inspect: xstateTestInspector.inspect }
    : {};
  
  const actor = createActor(appInitMachine, {
    ...inspectOptions,
    id: 'app-init-machine'
  })
  actor.start()
  return actor
}


// 🔥 HMR FIX: Check for preserved actors from previous module
if (import.meta.hot && import.meta.hot.data.authMachineActor) {
  console.log('[XSTATE] 🔥 HMR: Found preserved actors from previous module')
  
  // Restore preserved actors
  ;(window as any).authMachineActor = import.meta.hot.data.authMachineActor
  ;(window as any).pureLiveStoreSyncMachineActor = import.meta.hot.data.pureLiveStoreSyncMachineActor
  ;(window as any).appInitActor = import.meta.hot.data.appInitActor
  
  // Clear from hot data
  import.meta.hot.data.authMachineActor = null
  import.meta.hot.data.pureLiveStoreSyncMachineActor = null
  import.meta.hot.data.appInitActor = null
  
  console.log('[XSTATE] 🔥 HMR: Actors restored successfully')
}

// 🔥 AUTH PERSISTENCE: Auth machine handles its own persistence internally
// No manual persistence needed - the auth machine's persistAuthState action handles this

// Create AuthMachine actor (only if not already exists from HMR)
let authMachineActor = (window as any).authMachineActor

if (!authMachineActor) {
  console.log('[AuthMachine] Creating new auth machine actor')
  
  // Add inspection in test/dev mode
  const inspectOptions = (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') 
    ? { inspect: xstateTestInspector.inspect }
    : {};
  
  authMachineActor = createActor(authMachine, {
    ...inspectOptions,
    id: 'auth-machine'
  })
  
  // XState 5: Auth machine handles its own persistence - just start normally
  console.log('[AuthMachine] Starting (persistence handled by auth machine internally)')
  authMachineActor.start()
  
  // Store globally
  ;(window as any).authMachineActor = authMachineActor
  
  // Set up subscriptions for new actor
  authMachineActor.subscribe((snapshot) => {
    // Auth machine handles its own persistence via persistAuthState action
    
    const authenticated = snapshot.matches('authenticated')
    const reason = snapshot.value === 'authenticated' ? 'authenticated' : 
                   snapshot.value === 'unauthenticated' ? 'unauthenticated' :
                   snapshot.value === 'signingOut' ? 'signing-out' : 'checking'
    
    console.log('[AuthMachine] State changed:', { authenticated, reason })
    
    // 🚀 ULTRA-FAST INITIALIZATION: Start local data checking immediately when auth completes
    if (authenticated && snapshot.matches('authenticated')) {
      console.log('[AuthMachine] ✅ Authentication complete - starting ultra-fast initialization')
      
      const currentOrganization = snapshot.context.currentOrganization
      const hasOrganization = !!currentOrganization?.id
      
      const currentAppInitActor = (window as any).appInitActor
      if (currentAppInitActor) {
        if (hasOrganization) {
          console.log('[AuthMachine] 🏢 Organization ready - starting local data check for ultra-fast loading')
          // Start with organization context for local data introspection
          currentAppInitActor.send({ 
            type: 'START_INIT',
            organizationId: currentOrganization.id 
          })
        } else {
          console.log('[AuthMachine] ⚡ No organization yet - will trigger after organization selection')
          // Don't start yet - wait for organization to be available
          // The app init will be triggered when organization context is updated
        }
      } else {
        console.warn('[AuthMachine] App init actor not found - START_INIT not sent')
      }
    }
    
    // Handle organization updates during initialization  
    if (authenticated && snapshot.matches('authenticated.ready')) {
      const currentOrganization = snapshot.context.currentOrganization
      if (currentOrganization?.id) {
        console.log('[AuthMachine] 🏢 Organization now available - starting ultra-fast initialization')
        const currentAppInitActor = (window as any).appInitActor
        if (currentAppInitActor) {
          const appInitSnapshot = currentAppInitActor.getSnapshot()
          
          // If app init is still idle and organization just became available, start initialization
          if (appInitSnapshot.value === 'idle') {
            console.log('[AuthMachine] 🚀 Starting app initialization with organization:', currentOrganization.name)
            currentAppInitActor.send({ 
              type: 'START_INIT',
              organizationId: currentOrganization.id 
            })
          } 
          // If already running but with different organization, update it
          else if (appInitSnapshot.context.organizationId !== currentOrganization.id) {
            console.log('[AuthMachine] Updating app init with organization:', currentOrganization.name)
            currentAppInitActor.send({ 
              type: 'UPDATE_ORGANIZATION',
              organizationId: currentOrganization.id 
            })
          }
        }
      }
    }
    
    // Emit custom event for navigation logic
    window.dispatchEvent(new CustomEvent('auth:state-changed', {
      detail: { authenticated, reason }
    }))
  })
} else {
  console.log('[AuthMachine] 🔥 HMR: Using existing auth machine actor')
}

// Create Pure LiveStore Sync Machine actor (only if not already exists from HMR)
let pureLiveStoreSyncMachineActor = (window as any).pureLiveStoreSyncMachineActor

if (!pureLiveStoreSyncMachineActor) {
  console.log('[PureLiveStoreSyncMachine] Creating new pure LiveStore sync machine actor')
  
  // Add inspection in test/dev mode
  const inspectOptions = (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') 
    ? { inspect: xstateTestInspector.inspect }
    : {};
  
  pureLiveStoreSyncMachineActor = createActor(pureLiveStoreSyncMachine, {
    ...inspectOptions,
    id: 'pure-livestore-sync-machine'
  })
  
  // Pure LiveStore SyncMachine handles its own persistence internally
  console.log('[PureLiveStoreSyncMachine] Starting (state persistence handled internally)')
  pureLiveStoreSyncMachineActor.start()
  
  // Store globally
  ;(window as any).pureLiveStoreSyncMachineActor = pureLiveStoreSyncMachineActor
  
  // Set up subscriptions for new actor
  let wasLiveSync = false
  
  pureLiveStoreSyncMachineActor.subscribe((snapshot) => {
    // Send SYNC_READY to app-init when sync machine enters live sync
    if (snapshot.value === 'live_sync' && !wasLiveSync) {
      wasLiveSync = true
      const currentAppInitActor = (window as any).appInitActor
      if (currentAppInitActor) {
        currentAppInitActor.send({ type: 'SYNC_LIVE' })
      }
    } else if (snapshot.value !== 'live_sync') {
      wasLiveSync = false
    }
  })
} else {
  console.log('[SyncMachine] 🔥 HMR: Using existing sync machine actor')
}

// Create app init machine actor (only if not already exists from HMR)
let appInitActor = (window as any).appInitActor

if (!appInitActor) {
  console.log('[APP INIT] Creating new app init machine actor')
  appInitActor = createAppInitActor()
  
  // Store globally
  ;(window as any).appInitActor = appInitActor
  
  // Set up subscriptions for new actor
  appInitActor.subscribe({
    error: (error) => {
      console.error('[APP INIT] Actor error:', error)
      sessionStorage.setItem('app-init-last-error', JSON.stringify({
        error: error.message,
        timestamp: Date.now()
      }))
    },
    complete: () => {
      console.warn('[APP INIT] Actor completed/stopped unexpectedly')
      sessionStorage.setItem('app-init-stopped', JSON.stringify({
        timestamp: Date.now(),
        reason: 'completed'
      }))
    }
  })
} else {
  console.log('[APP INIT] 🔥 HMR: Using existing app init machine actor')
}

// Dexie uses native IndexedDB, no special error handling needed


// Actors are already globally accessible (assigned during creation)

// 🔥 HMR FIX: Preserve actors across HMR updates
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[XSTATE] 🔥 HMR Dispose: Preserving actors for next module...')
    
    // Store actor references in hot data to preserve across HMR
    import.meta.hot.data.authMachineActor = (window as any).authMachineActor
    import.meta.hot.data.pureLiveStoreSyncMachineActor = (window as any).pureLiveStoreSyncMachineActor
    import.meta.hot.data.appInitActor = (window as any).appInitActor
    
    // Don't stop actors - let them continue running
    console.log('[XSTATE] 🔥 HMR: Actors preserved for hot reload')
  })
  
  // On accept, restore the preserved actors
  import.meta.hot.accept(() => {
    console.log('[XSTATE] 🔥 HMR Accept: Module reloaded')
  })
}

// Reset app init and sync machines on sign-out (auth machine handles its own cleanup)
window.addEventListener('auth:signout', () => {
  console.log('[XSTATE] Resetting machines on sign-out (auth machine handles its own persistence cleanup)')
  // Note: sync-machine-state is preserved across sign-outs to maintain client ID and LSN
  
  // Reset pure LiveStore sync machine to idle state for fresh initialization on next sign-in
  const pureLiveStoreSyncMachineActor = (window as any).pureLiveStoreSyncMachineActor
  if (pureLiveStoreSyncMachineActor) {
    console.log('[XSTATE] Resetting pure LiveStore sync machine on sign-out')
    pureLiveStoreSyncMachineActor.send({ type: 'DISCONNECT', reason: 'User signed out' })
  }
  
  // Reset app init machine to idle state for fresh initialization on next sign-in
  const appInitActor = (window as any).appInitActor
  if (appInitActor) {
    console.log('[XSTATE] Resetting app init machine on sign-out')
    appInitActor.send({ type: 'RESET' })
  }
})

// Note: Dexie database is initialized when user is authenticated
// and DexieProvider is mounted to handle the database events

export const Route = createRootRouteWithContext<RouterContext>()({
  // 🎯 LOADING COMPONENT: Show loading during navigation (intent preloading)
  pendingComponent: () => (
    <div className="h-svh w-full flex items-center justify-center">
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <h1 className="text-xl font-semibold">Loading Page</h1>
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Loading components...
          </p>
          <p className="text-xs text-muted-foreground">
            This will be faster next time
          </p>
        </div>
      </div>
    </div>
  ),
  component: function RootComponent() {
    return (
      <InitializationErrorBoundary>
        {/* 🔥 FIXED: No provider needed - using direct actor access */}
        <RootComponentInternal />
      </InitializationErrorBoundary>
    );
  },
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
});

function RootComponentInternal() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  
  // Simple online/offline detection 
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <AuthAwareProviders>
      <AppWithInitialization />
    </AuthAwareProviders>
  )
}

function AppWithInitialization() {
  const navigate = useNavigate()
  const router = useRouter()
  const { isSystemReady } = useSystem()
  const { isAuthenticated } = useAuth()
  
  // Listen for auth state changes to handle navigation
  React.useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      const { authenticated, reason } = event.detail
      console.log('[Root] Auth state changed:', { authenticated, reason })
      
      // Note: Immediate navigation now handled in useAuth.signOut() to prevent component re-rendering
      const publicPaths = ['/sign-', '/reset-password', '/complete-registration', '/forgot-password', '/verify-email', '/otp-verify']
      const isPublicPath = publicPaths.some(path => window.location.pathname.startsWith(path))
      
      if (!authenticated && reason === 'unauthenticated' && !isPublicPath) {
        // Handle edge cases where auth check fails (not from sign-out)
        console.log('[Root] Unauthenticated state detected, redirecting to sign-in')
        navigate({ to: '/sign-in', replace: true })
      }
    }
    
    window.addEventListener('auth:state-changed', handleAuthStateChange as EventListener)
    
    return () => {
      window.removeEventListener('auth:state-changed', handleAuthStateChange as EventListener)
    }
  }, [navigate]);
  
  // Show UnifiedLoadingScreen overlay only when authenticated but system is not ready
  return (
    <>
      <Outlet />
      {isAuthenticated && !isSystemReady && <UnifiedLoadingScreen />}
      <IntegrityMonitor />
      <Toaster duration={3000} />
      {import.meta.env.MODE === 'development' && (
        <TanStackRouterDevtools position='bottom-right' />
      )}
    </>
  )
}
