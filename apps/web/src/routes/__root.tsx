// import { QueryClient } from '@tanstack/react-query' // ❌ DISABLED: Moved away from traditional queries per universal-reactive-data-pattern
import { createRootRouteWithContext, Outlet, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@/components/ui/sonner'
import GeneralError from '@/features/errors/general-error'
import NotFoundError from '@/features/errors/not-found-error'
import { useEffect, useState } from 'react'
import { InitializationErrorBoundary } from '@/components/error-boundary'
import { AuthAwareProviders } from '@/components/providers/AuthAwareProviders'
import { Task, Project, User } from '@repo/dataforge/client-entities'
// import { useAuth } from '@/hooks/useSimpleAuth' // 🔥 REPLACED with V2 orchestrator hook
import { authClient } from '@/lib/auth'
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource'
import { usePGliteContext } from '@/db/pglite-provider'
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen'
// 🔥 NEW: Import XState machines directly (no orchestrator needed)
import { createActor } from 'xstate'
import { authMachine } from '@/state-machines/machines/auth-machine'
import { appInitMachine } from '@/state-machines/machines/app-init-machine'
import { syncMachineV3 } from '@/state-machines/machines/sync-machine-v3'
import { useAuth, useSystem } from '@/state-machines'
import React from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'

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
  
  const actor = createActor(appInitMachine)
  actor.start()
  return actor
}


// 🔥 HMR FIX: Check for preserved actors from previous module
if (import.meta.hot && import.meta.hot.data.authMachineActor) {
  console.log('[XSTATE] 🔥 HMR: Found preserved actors from previous module')
  
  // Restore preserved actors
  ;(window as any).authMachineActor = import.meta.hot.data.authMachineActor
  ;(window as any).syncMachineActor = import.meta.hot.data.syncMachineActor
  ;(window as any).appInitActor = import.meta.hot.data.appInitActor
  
  // Clear from hot data
  import.meta.hot.data.authMachineActor = null
  import.meta.hot.data.syncMachineActor = null
  import.meta.hot.data.appInitActor = null
  
  console.log('[XSTATE] 🔥 HMR: Actors restored successfully')
}

// 🔥 AUTH PERSISTENCE: Load and save AuthMachine state
const AUTH_STORAGE_KEY = 'auth-machine-state'

// 🔥 SYNC PERSISTENCE: Removed - SyncMachine handles its own persistence internally

const loadPersistedAuthState = () => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      const persistedSnapshot = JSON.parse(stored)
      
      // Basic validation - XState 5 will handle format validation
      if (!persistedSnapshot) {
        console.log('[AuthMachine] No valid persisted state found')
        localStorage.removeItem(AUTH_STORAGE_KEY)
        return null
      }
      
      console.log('[AuthMachine] Loading persisted auth state')
      return persistedSnapshot
    }
  } catch (error) {
    console.warn('[AuthMachine] Failed to parse persisted state:', error)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
  return null
}

const saveAuthState = (actor: any) => {
  try {
    const snapshot = actor.getSnapshot()
    // Only persist if user is authenticated
    if (snapshot.context.user && snapshot.matches('authenticated')) {
      // XState 5: Use getPersistedSnapshot() for proper snapshot format
      const persistedSnapshot = actor.getPersistedSnapshot()
      
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(persistedSnapshot))
      console.log('[AuthMachine] Persisted auth state using XState 5 format:', snapshot.value)
    } else {
      // Clear persisted state if not authenticated
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  } catch (error) {
    console.warn('[AuthMachine] Failed to persist auth state:', error)
  }
}

// SyncMachine persistence is handled internally by the machine itself

// XState 5: Proper snapshot persistence
const persistedAuthSnapshot = loadPersistedAuthState()

// Create AuthMachine actor (only if not already exists from HMR)
let authMachineActor = (window as any).authMachineActor

if (!authMachineActor) {
  console.log('[AuthMachine] Creating new auth machine actor')
  authMachineActor = createActor(authMachine)
  
  // XState 5: Start with snapshot if available
  if (persistedAuthSnapshot) {
    console.log('[AuthMachine] Starting with persisted snapshot')
    authMachineActor.start(persistedAuthSnapshot)
  } else {
    console.log('[AuthMachine] Starting fresh')
    authMachineActor.start()
  }
  
  // Store globally
  ;(window as any).authMachineActor = authMachineActor
  
  // Set up subscriptions for new actor
  authMachineActor.subscribe((snapshot) => {
    saveAuthState(authMachineActor)
    
    const authenticated = snapshot.matches('authenticated')
    const reason = snapshot.value === 'authenticated' ? 'authenticated' : 
                   snapshot.value === 'unauthenticated' ? 'unauthenticated' :
                   snapshot.value === 'signingOut' ? 'signing-out' : 'checking'
    
    console.log('[AuthMachine] State changed:', { authenticated, reason })
    
    // 🔥 DIRECT FLOW: When auth completes, directly start initialization
    if (authenticated && snapshot.value === 'authenticated') {
      console.log('[AuthMachine] ✅ Authentication complete - starting app initialization')
      const currentAppInitActor = (window as any).appInitActor
      if (currentAppInitActor) {
        currentAppInitActor.send({ type: 'START_INIT' })
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

// Create SyncMachine actor (only if not already exists from HMR)
let syncMachineActor = (window as any).syncMachineActor

if (!syncMachineActor) {
  console.log('[SyncMachine] Creating new sync machine actor')
  syncMachineActor = createActor(syncMachineV3)
  
  // SyncMachine handles its own persistence internally
  console.log('[SyncMachine] Starting (state persistence handled internally)')
  syncMachineActor.start()
  
  // Store globally
  ;(window as any).syncMachineActor = syncMachineActor
  
  // Set up subscriptions for new actor
  let wasLiveSync = false
  
  syncMachineActor.subscribe((snapshot) => {
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

// Handle PGlite filesystem errors gracefully
window.addEventListener('unhandledrejection', (event) => {
  // Check if it's a PGlite ErrnoError that we can safely ignore
  if (event.reason && event.reason.name === 'ErrnoError') {
    console.warn('[PGlite] ErrnoError caught and handled:', event.reason.errno);
    event.preventDefault(); // Prevent the error from being logged as uncaught
  }
})


// Actors are already globally accessible (assigned during creation)

// 🔥 HMR FIX: Preserve actors across HMR updates
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[XSTATE] 🔥 HMR Dispose: Preserving actors for next module...')
    
    // Store actor references in hot data to preserve across HMR
    import.meta.hot.data.authMachineActor = (window as any).authMachineActor
    import.meta.hot.data.syncMachineActor = (window as any).syncMachineActor
    import.meta.hot.data.appInitActor = (window as any).appInitActor
    
    // Don't stop actors - let them continue running
    console.log('[XSTATE] 🔥 HMR: Actors preserved for hot reload')
  })
  
  // On accept, restore the preserved actors
  import.meta.hot.accept(() => {
    console.log('[XSTATE] 🔥 HMR Accept: Module reloaded')
  })
}

// Clear auth state and reset app init on sign-out
window.addEventListener('auth:signout', () => {
  console.log('[XSTATE] Clearing auth state on sign-out')
  localStorage.removeItem(AUTH_STORAGE_KEY)
  // Note: sync-machine-state is preserved across sign-outs to maintain client ID and LSN
  
  // Reset sync machine to idle state for fresh initialization on next sign-in
  const syncMachineActor = (window as any).syncMachineActor
  if (syncMachineActor) {
    console.log('[XSTATE] Resetting sync machine on sign-out')
    syncMachineActor.send({ type: 'DISCONNECT', reason: 'User signed out' })
  }
  
  // Reset app init machine to idle state for fresh initialization on next sign-in
  const appInitActor = (window as any).appInitActor
  if (appInitActor) {
    console.log('[XSTATE] Resetting app init machine on sign-out')
    appInitActor.send({ type: 'RESET' })
  }
})

// Note: DB_INIT_START is sent from AuthAwareProviders when user is authenticated
// and PGlite Provider is actually mounted to handle the database events

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
  
  // Handle redirect after refresh
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const redirectPath = urlParams.get('redirectAfterRefresh')
    
    if (redirectPath) {
      console.log('[ROOT] Redirecting after refresh to:', redirectPath)
      // Clean up the URL and redirect
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      
      // Small delay to ensure app is fully loaded
      setTimeout(() => {
        navigate({ to: redirectPath as any, replace: true })
      }, 100)
    }
  }, [navigate])
  
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
      <Toaster duration={3000} />
      {import.meta.env.MODE === 'development' && (
        <TanStackRouterDevtools position='bottom-right' />
      )}
    </>
  )
}
