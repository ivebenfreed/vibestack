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
import { useAuth } from '@/hooks/useSimpleAuth'
import { authClient } from '@/lib/auth'
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource'
import { usePGliteContext } from '@/db/pglite-provider'
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen'
// 🔥 NEW: Import XState orchestrator
import { createActor } from 'xstate'
import { orchestrator } from '@/state-machines/orchestrator'
import { OrchestratorProvider, useSystemReadiness } from '@/state-machines/orchestrator-hooks'
import React from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'

// Router context interface with atom setters
interface RouterContext {
  // queryClient?: QueryClient // ❌ DISABLED: Made optional since we moved away from traditional queries per universal-reactive-data-pattern
  setTaskAtoms: (tasks: Task[]) => void
  setProjectAtoms: (projects: Project[]) => void
  setUserAtoms: (users: User[]) => void
}

// 🔥 NEW: XState native persistence (simplified)
const ORCHESTRATOR_STORAGE_KEY = 'orchestrator-state'

const loadPersistedOrchestratorState = () => {
  try {
    const stored = localStorage.getItem(ORCHESTRATOR_STORAGE_KEY)
    if (stored) {
      const persistedSnapshot = JSON.parse(stored)
      
      // Validate that persisted state has required structure
      if (!persistedSnapshot.value || !persistedSnapshot.context) {
        console.log('[XSTATE] Persisted state missing required structure, forcing clean start')
        localStorage.removeItem(ORCHESTRATOR_STORAGE_KEY)
        return null
      }
      
      // Validate that context has essential properties (only what we actually persist)
      const ctx = persistedSnapshot.context
      const hasRequiredContext = typeof ctx === 'object' && 
                                 ctx !== null &&
                                 typeof ctx.syncClientId === 'string' &&
                                 ctx.syncState && 
                                 typeof ctx.syncState.currentLSN === 'string'
      
      if (!hasRequiredContext) {
        console.log('[XSTATE] Persisted state has corrupted context, forcing clean start')
        localStorage.removeItem(ORCHESTRATOR_STORAGE_KEY)
        return null
      }
      
      // Check age based on auth session expiry if available, otherwise fallback to 7 days
      const sessionExpiry = persistedSnapshot.sessionExpiry
      const lastActivity = ctx.lastActivity
      const now = Date.now()
      
      // Use session expiry if available, otherwise default to 7 days
      const maxAge = sessionExpiry ? 
        new Date(sessionExpiry).getTime() - now : 
        7 * 24 * 60 * 60 * 1000 // 7 days default
      
      if (sessionExpiry && now >= new Date(sessionExpiry).getTime()) {
        console.log('[XSTATE] Persisted state expired with auth session, forcing clean start')
        localStorage.removeItem(ORCHESTRATOR_STORAGE_KEY)
        return null
      } else if (!sessionExpiry && lastActivity && (now - lastActivity) > maxAge) {
        console.log('[XSTATE] Persisted state is stale (no session expiry), forcing clean start')
        localStorage.removeItem(ORCHESTRATOR_STORAGE_KEY)
        return null
      }
      
      console.log('[XSTATE] Loading valid persisted orchestrator state:', persistedSnapshot.value)
      console.log(`[XSTATE] 📥 Restored LSN: ${persistedSnapshot.context?.syncState?.currentLSN}, ClientID: ${persistedSnapshot.context?.syncClientId}`)
      return persistedSnapshot
    }
  } catch (error) {
    console.warn('[XSTATE] Failed to parse persisted state, forcing clean start:', error)
    localStorage.removeItem(ORCHESTRATOR_STORAGE_KEY)
  }
  return null
}

const saveOrchestratorState = async (snapshot: any) => {
  try {
    // Check if user is authenticated before persisting
    const user = snapshot.context.user
    const authToken = snapshot.context.authToken
    const sessionExpiry = snapshot.context.sessionExpiry
    
    if (user && authToken) {
      const stateToPersist = {
        value: snapshot.value,
        context: {
          user,
          authToken,
          sessionExpiry,
          isDatabaseInitialized: snapshot.context.isDatabaseInitialized,
          syncClientId: snapshot.context.syncClientId,
          syncState: snapshot.context.syncState,
          integrityBaseline: snapshot.context.integrityBaseline
        }
      }
      
      // Get previous LSN to avoid logging redundant saves
      const previousState = localStorage.getItem(ORCHESTRATOR_STORAGE_KEY);
      let previousLSN = '0/0';
      if (previousState) {
        try {
          const parsed = JSON.parse(previousState);
          previousLSN = parsed.context?.syncState?.currentLSN || '0/0';
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      localStorage.setItem(ORCHESTRATOR_STORAGE_KEY, JSON.stringify(stateToPersist))
      const ttlInfo = sessionExpiry ? `expires with session at ${sessionExpiry}` : 'no session expiry'
      
      // Only log when state value changes or LSN actually changes
      const currentLSN = stateToPersist.context.syncState.currentLSN;
      if (previousLSN !== currentLSN || !previousState) {
        console.log(`[XSTATE] Persisted complete orchestrator state: ${stateToPersist.value} (${ttlInfo})`)
        console.log(`[XSTATE] 💾 Persisted LSN: ${currentLSN}, ClientID: ${stateToPersist.context.syncClientId}`)
      }
    }
  } catch (error) {
    console.warn('[XSTATE] Failed to persist orchestrator state:', error)
  }
}

// Create the orchestrator actor with built-in state restoration
const persistedSnapshot = loadPersistedOrchestratorState()

console.log('[XSTATE] Creating orchestrator actor with persistence support...')

// 🔥 HMR FIX: Clean up existing orchestrator before creating new one
if (import.meta.hot && (window as any).orchestratorActor) {
  console.log('[XSTATE] 🔥 HMR: Cleaning up existing orchestrator actor...')
  const existingActor = (window as any).orchestratorActor
  
  try {
    // Stop the existing actor and its child machines
    existingActor.stop()
    console.log('[XSTATE] 🔥 HMR: Existing orchestrator stopped')
  } catch (error) {
    console.warn('[XSTATE] 🔥 HMR: Error stopping existing orchestrator:', error)
  }
  
  // Clear the global reference
  (window as any).orchestratorActor = null
}

const orchestratorActor = createActor(orchestrator, {
  input: { snapshot: persistedSnapshot }
})

// Start the orchestrator
orchestratorActor.start()

// Subscribe to state changes for persistence
orchestratorActor.subscribe((snapshot) => {
  saveOrchestratorState(snapshot)
})

// Monitor actor status and handle unexpected stops
orchestratorActor.subscribe({
  error: (error) => {
    console.error('[ORCHESTRATOR] Actor error:', error)
    // Store error in sessionStorage for debugging
    sessionStorage.setItem('orchestrator-last-error', JSON.stringify({
      error: error.message,
      timestamp: Date.now()
    }))
  },
  complete: () => {
    console.warn('[ORCHESTRATOR] Actor completed/stopped unexpectedly')
    // Store completion event for debugging
    sessionStorage.setItem('orchestrator-stopped', JSON.stringify({
      timestamp: Date.now(),
      reason: 'completed'
    }))
  }
})

// Make orchestrator globally accessible for auth guards
;(window as any).orchestratorActor = orchestratorActor

// 🔥 HMR FIX: Add HMR disposal handler
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[XSTATE] 🔥 HMR Dispose: Cleaning up orchestrator...')
    
    if ((window as any).orchestratorActor) {
      try {
        const actor = (window as any).orchestratorActor
        actor.stop()
        console.log('[XSTATE] 🔥 HMR: Orchestrator stopped for HMR')
      } catch (error) {
        console.warn('[XSTATE] 🔥 HMR: Error stopping orchestrator during dispose:', error)
      }
    }
    
    // Clear global reference
    (window as any).orchestratorActor = null
  })
}

// Clear persisted state on sign-out events
window.addEventListener('auth:signout', () => {
  console.log('[XSTATE] Clearing persisted state on sign-out')
  localStorage.removeItem(ORCHESTRATOR_STORAGE_KEY)
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
        {/* 🔥 NEW: Provide XState orchestrator at the top level */}
        <OrchestratorProvider actor={orchestratorActor}>
          <RootComponentInternal />
        </OrchestratorProvider>
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
  // 🔥 NEW: Use orchestrator system coordination  
  const { isAuthenticated } = useAuth()
  const { isSystemReady, canLoadRoutes, readinessChecks } = useSystemReadiness()
  const navigate = useNavigate()
  const router = useRouter()
  
  // 🔥 NEW: Listen for auth state changes to handle navigation
  React.useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      const { authenticated, reason } = event.detail
      console.log('[Root] Auth state changed:', { authenticated, reason })
      
      if (!authenticated && reason === 'sign-out') {
        console.log('[Root] Sign-out detected, checking current route...')
        const currentPath = window.location.pathname
        
        // If on an authenticated route, redirect to sign-in
        if (currentPath.startsWith('/_authenticated') || currentPath === '/') {
          console.log('[Root] Redirecting to sign-in after sign-out')
          navigate({ 
            to: '/sign-in', 
            search: { redirect: currentPath },
            replace: true 
          })
        }
      }
    }
    
    window.addEventListener('auth:state-changed', handleAuthStateChange as EventListener)
    
    return () => {
      window.removeEventListener('auth:state-changed', handleAuthStateChange as EventListener)
    }
  }, [navigate])
  
  // 🔥 DEBUG: Log orchestrator state in development (only on changes)
  const prevStateRef = React.useRef<string>('')
  React.useEffect(() => {
    if (import.meta.env.MODE === 'development') {
      const currentState = JSON.stringify({
        isSystemReady,
        canLoadRoutes,
        isAuthenticated
      })
      
      // Only log if state actually changed
      if (currentState !== prevStateRef.current) {
        console.log('[Orchestrator Debug] System state changed:', {
          isSystemReady,
          canLoadRoutes,
          readinessChecks,
          isAuthenticated
        });
        prevStateRef.current = currentState
      }
    }
  }, [isSystemReady, canLoadRoutes, readinessChecks, isAuthenticated]);
  
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
