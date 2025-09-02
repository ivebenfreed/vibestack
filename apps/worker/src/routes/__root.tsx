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
import { simpleNotificationSyncMachine } from '@/state-machines/machines/simple-notification-sync-machine'
import { xstateTestInspector } from '@/test-utils/xstate-test-inspector'
import { useAuth, useSystem } from '@/state-machines'
import { stateLog } from '@/logger'
import React from 'react'
import { useRouter } from '@tanstack/react-router'

// Router context interface with atom setters
interface RouterContext {
  // queryClient?: QueryClient // ❌ DISABLED: Made optional since we moved away from traditional queries per universal-reactive-data-pattern
  setTaskAtoms: (tasks: Task[]) => void
  setProjectAtoms: (projects: Project[]) => void
  setUserAtoms: (users: User[]) => void
}

// App init machine removed - Legend State handles initialization lazily
// Auth machine now directly calls loadOrgContext() when ready

// Create logger instance for this file
const log = stateLog('routes/__root.tsx');

// 🔥 HMR FIX: Check for preserved actors from previous module
if (import.meta.hot && import.meta.hot.data.authMachineActor) {
  log.info('🔥 HMR: Found preserved actors from previous module')
  
  // Restore preserved actors
  ;(window as any).authMachineActor = import.meta.hot.data.authMachineActor
  ;(window as any).simpleNotificationSyncMachineActor = import.meta.hot.data.simpleNotificationSyncMachineActor
  
  // Clear from hot data
  import.meta.hot.data.authMachineActor = null
  import.meta.hot.data.simpleNotificationSyncMachineActor = null
  
  log.info('🔥 HMR: Actors restored successfully')
}

// 🔥 AUTH PERSISTENCE: Auth machine handles its own persistence internally
// No manual persistence needed - the auth machine's persistAuthState action handles this

// Create AuthMachine actor (only if not already exists from HMR)
let authMachineActor = (window as any).authMachineActor

if (!authMachineActor) {
  log.info('Creating new auth machine actor at', Date.now());
  
  // Add inspection in test/dev mode
  const inspectOptions = (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') 
    ? { inspect: xstateTestInspector.inspect }
    : {};
  
  // Try to restore persisted snapshot
  let persistedSnapshot = null;
  try {
    const stored = localStorage.getItem('auth-machine-snapshot');
    if (stored) {
      persistedSnapshot = JSON.parse(stored);
      log.info('Restored auth machine snapshot:', persistedSnapshot?.value);
    }
  } catch (error) {
    console.warn('[ROOT] Failed to restore auth machine snapshot:', error);
    localStorage.removeItem('auth-machine-snapshot');
  }
  
  // Clean up old localStorage keys to avoid conflicts
  localStorage.removeItem('auth-machine-state');
  localStorage.removeItem('vibestack-last-organization-id');
  
  authMachineActor = createActor(authMachine, {
    ...inspectOptions,
    id: 'auth-machine',
    snapshot: persistedSnapshot
  })
  
  log.info('Auth machine created, starting...');
  authMachineActor.start()
  
  // Store globally
  ;(window as any).authMachineActor = authMachineActor
  
  // Set up subscriptions for new actor
  authMachineActor.subscribe((snapshot) => {
    // Persist snapshot for proper XState persistence
    try {
      localStorage.setItem('auth-machine-snapshot', JSON.stringify(snapshot));
    } catch (error) {
      console.warn('[ROOT] Failed to persist auth snapshot:', error);
    }
    
    const authenticated = snapshot.matches('authenticated')
    const reason = snapshot.value === 'authenticated' ? 'authenticated' : 
                   snapshot.value === 'unauthenticated' ? 'unauthenticated' :
                   snapshot.value === 'signingOut' ? 'signing-out' : 'checking'
    
    // 🚀 DIRECT LEGEND STATE INITIALIZATION: Load org context when auth completes
    if (authenticated && snapshot.matches('authenticated.ready')) {
      const currentOrganization = snapshot.context.currentOrganization
      const user = snapshot.context.user
      
      if (currentOrganization?.id && user?.id) {
        log.info('Auth ready - starting parallel Legend State and sync initialization:', currentOrganization.id)
        
        // 🔄 SYNC: Connect sync machine when ready
        const connectSync = () => {
          const syncActor = (window as any).simpleNotificationSyncMachineActor;
          if (syncActor) {
            log.info('✅ Triggering sync connection - auth ready');
            syncActor.send({ 
              type: 'CONNECT', 
              organizationId: currentOrganization.id,
              userId: user.id
            });
          } else {
            // Retry until sync actor is available
            setTimeout(connectSync, 10);
          }
        };
        connectSync();
        
        // Load universe context with ALL user organizations
        import('../legend-state').then(({ loadUniverseContext, universeHelpers }) => {
          // Initialize universe context for organizations display
          universeHelpers.setAuthenticated(true, user.id).then(async () => {
            log.info('Universe context authenticated and workspace data loaded')
            
            // Refresh workspace data (this loads organization data)
            await universeHelpers.refresh()
            
            // Import the universe context observable to get the data
            const { universeContext$ } = await import('../legend-state/observables/universe-context')
            const universeData = universeContext$.get()
            const orgIds = universeData && universeData.organizations ? Object.keys(universeData.organizations) : []
            
            if (orgIds.length > 0) {
              log.info(`Loading entity schemas from ${orgIds.length} organizations:`, orgIds)
              
              // Load entity schemas from ALL user organizations
              return loadUniverseContext(user.id, orgIds)
            } else {
              log.warn('No organizations found for user - loading current org only')
              // Fallback to current org if no universe data
              return loadUniverseContext(user.id, [currentOrganization.id])
            }
          }).then(() => {
            log.info('Complete universe context loaded successfully (entities + worlds)')
          }).catch((error) => {
            console.error('[ROOT] Failed to initialize complete universe context:', error)
          })
        }).catch((error) => {
          console.error('[ROOT] Failed to import Legend State:', error)
        })
      }
    }
    
    // Emit custom event for navigation logic
    window.dispatchEvent(new CustomEvent('auth:state-changed', {
      detail: { authenticated, reason }
    }))
  })
  
  // Check initial state after setting up subscription (for restored snapshots)
  const initialSnapshot = authMachineActor.getSnapshot()
  if (initialSnapshot.matches('authenticated.ready')) {
    const currentOrganization = initialSnapshot.context.currentOrganization
    const user = initialSnapshot.context.user
    
    if (currentOrganization?.id && user?.id) {
      log.info('Initial auth already ready - loading Legend State org context:', currentOrganization.id)
      
      // 🔄 SYNC: Connect sync machine for restored auth state (wait for actor to be ready)
      const connectSync = () => {
        const syncActor = (window as any).simpleNotificationSyncMachineActor;
        if (syncActor) {
          log.info('✅ Triggering sync connection - restored auth ready');
          syncActor.send({ 
            type: 'CONNECT', 
            organizationId: currentOrganization.id,
            userId: user.id
          });
        } else {
          // Retry until sync actor is available
          setTimeout(connectSync, 10);
        }
      };
      connectSync();
      
      // Dynamic import to avoid circular dependencies
      import('../legend-state').then(({ loadUniverseContext, universeHelpers }) => {
        // Initialize universe context for organizations display
        universeHelpers.setAuthenticated(true, user.id).then(async () => {
          log.info('Universe context authenticated and workspace data loaded (initial)')
          
          // Refresh workspace data (this loads organization data)
          await universeHelpers.refresh()
          
          // Import the universe context observable to get the data
          const { universeContext$ } = await import('../legend-state/observables/universe-context')
          const universeData = universeContext$.get()
          const orgIds = universeData && universeData.organizations ? Object.keys(universeData.organizations) : []
          
          if (orgIds.length > 0) {
            log.info(`Loading entity schemas from ${orgIds.length} organizations (initial):`, orgIds)
            
            // Load entity schemas from ALL user organizations
            return loadUniverseContext(user.id, orgIds)
          } else {
            log.warn('No organizations found for user - loading current org only (initial)')
            // Fallback to current org if no universe data
            return loadUniverseContext(user.id, [currentOrganization.id])
          }
        }).then(() => {
          log.info('Complete universe context loaded successfully (initial - entities + worlds)')
        }).catch((error) => {
          console.error('[ROOT] Failed to initialize complete universe context (initial):', error)
        })
      }).catch((error) => {
        console.error('[ROOT] Failed to import Legend State (initial):', error)
      })
    }
  }
} else {
  // HMR: Using existing auth machine actor
}

// Create Simple Notification Sync Machine actor (only if not already exists from HMR)
let simpleNotificationSyncMachineActor = (window as any).simpleNotificationSyncMachineActor

if (!simpleNotificationSyncMachineActor) {
  // Creating simple notification sync machine
  
  // Add inspection in test/dev mode
  const inspectOptions = (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') 
    ? { inspect: xstateTestInspector.inspect }
    : {};
  
  simpleNotificationSyncMachineActor = createActor(simpleNotificationSyncMachine, {
    ...inspectOptions,
    id: 'simple-notification-sync-machine'
  })
  
  // Simple sync machine handles notifications only
  // Starting notification sync
  simpleNotificationSyncMachineActor.start()
  
  // Store globally
  ;(window as any).simpleNotificationSyncMachineActor = simpleNotificationSyncMachineActor
  
  // Set up subscriptions for new actor
  simpleNotificationSyncMachineActor.subscribe((snapshot) => {
    // Sync machine is now independent - no app init coordination needed
    log.info('SyncMachine State changed:', snapshot.value)
  })
} else {
  log.info('SyncMachine 🔥 HMR: Using existing sync machine actor')
}

// App init machine removed - Legend State handles initialization directly
// No separate init actor needed - auth machine calls loadOrgContext() directly

// Dexie uses native IndexedDB, no special error handling needed


// Actors are already globally accessible (assigned during creation)

// 🔥 HMR FIX: Preserve actors across HMR updates
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    log.info('XSTATE 🔥 HMR Dispose: Preserving actors for next module...')
    
    // Store actor references in hot data to preserve across HMR
    import.meta.hot.data.authMachineActor = (window as any).authMachineActor
    import.meta.hot.data.simpleNotificationSyncMachineActor = (window as any).simpleNotificationSyncMachineActor
    
    // Don't stop actors - let them continue running
    log.info('XSTATE 🔥 HMR: Actors preserved for hot reload')
  })
  
  // On accept, restore the preserved actors
  import.meta.hot.accept(() => {
    log.info('XSTATE 🔥 HMR Accept: Module reloaded')
  })
}

// Reset sync machine on sign-out and clear Legend State context
window.addEventListener('auth:signout', () => {
  log.info('XSTATE Resetting sync machine and Legend State on sign-out')
  
  // Reset simple notification sync machine to idle state for fresh initialization on next sign-in
  const simpleNotificationSyncMachineActor = (window as any).simpleNotificationSyncMachineActor
  if (simpleNotificationSyncMachineActor) {
    log.info('XSTATE Resetting simple notification sync machine on sign-out')
    simpleNotificationSyncMachineActor.send({ type: 'DISCONNECT', reason: 'User signed out' })
  }
  
  // Clear Legend State context on sign-out
  import('../legend-state').then(({ clearContext }) => {
    clearContext()
    log.info('XSTATE Legend State context cleared on sign-out')
  }).catch((error) => {
    console.warn('[XSTATE] Failed to clear Legend State context:', error)
  })
})

// Note: Dexie database is initialized when user is authenticated
// and DexieProvider is mounted to handle the database events

export const Route = createRootRouteWithContext<RouterContext>()({
  // 🎯 LOADING COMPONENT: Show loading during navigation (intent preloading)
  pendingComponent: () => (
    <div className="h-svh w-full flex items-center justify-center bg-zinc-950">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <h1 className="text-xl font-semibold text-zinc-100">Loading Page</h1>
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-zinc-400">
            Loading components...
          </p>
          <p className="text-xs text-zinc-500">
            This will be faster next time
          </p>
        </div>
      </div>
    </div>
  ),
  component: function RootComponent() {
    log.info('RootComponent rendering at', Date.now());
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
  log.info('RootComponentInternal rendering at', Date.now());
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
  log.info('AppWithInitialization rendering at', Date.now());
  const navigate = useNavigate()
  const router = useRouter()
  const { isSystemReady } = useSystem()
  const { isAuthenticated } = useAuth()
  log.info('AppWithInitialization states:', { isSystemReady, isAuthenticated });
  
  // Listen for auth state changes to handle navigation
  React.useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      const { authenticated, reason } = event.detail
      log.info('Auth state changed:', { authenticated, reason })
      
      // Note: Immediate navigation now handled in useAuth.signOut() to prevent component re-rendering
      const publicPaths = ['/sign-', '/reset-password', '/complete-registration', '/forgot-password', '/verify-email', '/otp-verify']
      const isPublicPath = publicPaths.some(path => window.location.pathname.startsWith(path))
      
      if (!authenticated && reason === 'unauthenticated' && !isPublicPath) {
        // Handle edge cases where auth check fails (not from sign-out)
        log.info('Unauthenticated state detected, redirecting to sign-in')
        navigate({ to: '/sign-in', replace: true })
      }
    }
    
    window.addEventListener('auth:state-changed', handleAuthStateChange as EventListener)
    
    return () => {
      window.removeEventListener('auth:state-changed', handleAuthStateChange as EventListener)
    }
  }, [navigate]);
  
  // Note: Removed root-level UnifiedLoadingScreen to prevent flickering
  // Loading state is now handled entirely by AuthenticatedContent component
  return (
    <>
      <Outlet />
      <IntegrityMonitor />
      <Toaster duration={3000} />
      {import.meta.env.MODE === 'development' && (
        <TanStackRouterDevtools position='bottom-right' />
      )}
    </>
  )
}
