// import { QueryClient } from '@tanstack/react-query' // ❌ DISABLED: Moved away from traditional queries per universal-reactive-data-pattern
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
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
import { useAuth } from '@/state-machines/orchestrator-hooks-v2'
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


// 🔥 HMR FIX: Clean up existing actors before creating new ones
if (import.meta.hot) {
  if ((window as any).appInitActor) {
    console.log('[XSTATE] 🔥 HMR: Cleaning up existing app init actor...')
    const existingActor = (window as any).appInitActor
    
    try {
      // Check if actor is still running before stopping
      if (existingActor.getSnapshot().status !== 'stopped') {
        existingActor.stop()
        console.log('[XSTATE] 🔥 HMR: Existing app init actor stopped')
      }
    } catch (error) {
      console.warn('[XSTATE] 🔥 HMR: Error stopping existing app init actor:', error)
    }
    
    (window as any).appInitActor = null
  }
  
  if ((window as any).authMachineActor) {
    console.log('[XSTATE] 🔥 HMR: Cleaning up existing auth machine actor...')
    const existingAuthActor = (window as any).authMachineActor
    
    try {
      // Check if actor is still running before stopping
      const currentSnapshot = existingAuthActor.getSnapshot()
      if (currentSnapshot.status !== 'stopped') {
        if (currentSnapshot.matches('authenticated') && currentSnapshot.context.user) {
          console.log('[XSTATE] 🔥 HMR: Preserving auth state for restart')
          saveAuthState(existingAuthActor)
        }
        
        existingAuthActor.stop()
        console.log('[XSTATE] 🔥 HMR: Existing auth machine stopped')
      } else {
        console.log('[XSTATE] 🔥 HMR: Auth machine already stopped, skipping')
      }
    } catch (error) {
      console.warn('[XSTATE] 🔥 HMR: Error stopping existing auth machine:', error)
    }
    
    (window as any).authMachineActor = null
  }
}

// 🔥 AUTH PERSISTENCE: Load and save AuthMachine state
const AUTH_STORAGE_KEY = 'auth-machine-state'

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

// XState 5: Proper snapshot persistence
const persistedAuthSnapshot = loadPersistedAuthState()

// Create AuthMachine actor
const authMachineActor = createActor(authMachine)

// XState 5: Start with snapshot if available
if (persistedAuthSnapshot) {
  console.log('[AuthMachine] Starting with persisted snapshot')
  authMachineActor.start(persistedAuthSnapshot)
} else {
  console.log('[AuthMachine] Starting fresh')
  authMachineActor.start()
}

// Set up auth state persistence and direct init trigger
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
    appInitActor.send({ type: 'START_INIT' })
  }
  
  // Emit custom event for navigation logic
  window.dispatchEvent(new CustomEvent('auth:state-changed', {
    detail: { authenticated, reason }
  }))
})

// Create app init machine actor directly
const appInitActor = createAppInitActor()

// Handle PGlite filesystem errors gracefully
window.addEventListener('unhandledrejection', (event) => {
  // Check if it's a PGlite ErrnoError that we can safely ignore
  if (event.reason && event.reason.name === 'ErrnoError') {
    console.warn('[PGlite] ErrnoError caught and handled:', event.reason.errno);
    event.preventDefault(); // Prevent the error from being logged as uncaught
  }
})

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

// Make both actors globally accessible
;(window as any).authMachineActor = authMachineActor
;(window as any).appInitActor = appInitActor

// 🔥 HMR FIX: Add HMR disposal handler for both actors
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[XSTATE] 🔥 HMR Dispose: Cleaning up actors...')
    
    if ((window as any).appInitActor) {
      try {
        const actor = (window as any).appInitActor
        actor.stop()
        console.log('[XSTATE] 🔥 HMR: App init actor stopped for HMR')
      } catch (error) {
        console.warn('[XSTATE] 🔥 HMR: Error stopping app init actor during dispose:', error)
      }
    }
    
    if ((window as any).authMachineActor) {
      try {
        const authActor = (window as any).authMachineActor
        authActor.stop()
        console.log('[XSTATE] 🔥 HMR: Auth machine stopped for HMR')
      } catch (error) {
        console.warn('[XSTATE] 🔥 HMR: Error stopping auth machine during dispose:', error)
      }
    }
    
    // Clear global references
    (window as any).appInitActor = null
    (window as any).authMachineActor = null
  })
}

// Clear auth state and reset app init on sign-out
window.addEventListener('auth:signout', () => {
  console.log('[XSTATE] Clearing auth state on sign-out')
  localStorage.removeItem(AUTH_STORAGE_KEY)
  // Note: sync-machine-state is preserved across sign-outs to maintain client ID and LSN
  
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
  
  // Listen for auth state changes to handle navigation
  React.useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      const { authenticated, reason } = event.detail
      console.log('[Root] Auth state changed:', { authenticated, reason })
      
      // Note: Immediate navigation now handled in useAuth.signOut() to prevent component re-rendering
      if (!authenticated && reason === 'unauthenticated' && !window.location.pathname.startsWith('/sign-')) {
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
  
  // Remove UnifiedLoadingScreen from root - it should only be on authenticated routes
  return (
    <>
      <Outlet />
      <Toaster duration={3000} />
      {import.meta.env.MODE === 'development' && (
        <TanStackRouterDevtools position='bottom-right' />
      )}
    </>
  )
}
