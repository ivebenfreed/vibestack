import { createRootRouteWithContext, Outlet, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@/components/ui/sonner'
import GeneralError from '@/features/errors/general-error'
import NotFoundError from '@/features/errors/not-found-error'
import { useEffect, useState } from 'react'
import { InitializationErrorBoundary } from '@/components/error-boundary'
import { AuthAwareProviders } from '@/components/providers/AuthAwareProviders'
import { Task, Project, User } from '@/db/client-entities'
import { authClient } from '@/lib/auth'
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen'
import { IntegrityMonitor } from '@/components/IntegrityMonitor'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
import { log } from '@/logger'
import React from 'react'
import { useRouter } from '@tanstack/react-router'
import { routeReadiness$, routeReadinessActions } from '@/legend-state/route-readiness'
import { useSelector } from '@legendapp/state/react'

// Router context interface with atom setters
interface RouterContext {
  setTaskAtoms: (tasks: Task[]) => void
  setProjectAtoms: (projects: Project[]) => void
  setUserAtoms: (users: User[]) => void
}

// App init machine removed - Legend State handles initialization lazily
// Auth machine now directly calls loadOrgContext() when ready

// Create logger instance for this file
const rootLog = log('routes/__root.tsx');

// 🔥 HMR: Legend State sync manager handles HMR persistence automatically
// No manual actor preservation needed

// 🔥 AUTH PERSISTENCE: Auth now handled by Legend State automatically
// Legend State handles authentication initialization and session management

// Clean up old auth machine localStorage keys to avoid conflicts
localStorage.removeItem('auth-machine-state');
localStorage.removeItem('auth-machine-snapshot');
localStorage.removeItem('vibestack-last-organization-id');

// Initialize Legend State auth system
rootLog.info('Legend State auth system handles authentication and initialization automatically');

// Initialize app-wide loading stages
import { appInitMethods$, useAppInitialization } from '@/legend-state/app-initialization-stages';

// Initialize Legend State sync manager
rootLog.info('Initializing Legend State sync manager')
// Sync manager will be connected automatically when authentication is ready

// Legend State initialization is now handled automatically by auth.ts reactive effects
// No need for separate XState machine - Legend State auth handles initialization
rootLog.info('[ROOT] Legend State initialization handled automatically by auth.ts reactive effects')

// Dexie uses native IndexedDB, no special error handling needed


// Actors are already globally accessible (assigned during creation)

// 🔥 HMR: Legend State sync manager handles HMR automatically
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    rootLog.info('🔥 HMR Dispose: Legend State sync manager persists automatically')
  })
  
  import.meta.hot.accept(() => {
    rootLog.info('🔥 HMR Accept: Module reloaded with Legend State persistence')
  })
}

// Reset sync manager on sign-out and clear Legend State context
window.addEventListener('auth:signout', () => {
  rootLog.info('Resetting Legend State sync manager on sign-out')
  
  // Reset sync manager using Legend State actions
  import('../legend-state/sync-manager').then(({ syncActions }) => {
    syncActions.reset()
    rootLog.info('Legend State sync manager reset on sign-out')
  }).catch((error) => {
    console.warn('Failed to reset sync manager:', error)
  })
  
  // Clear Legend State context on sign-out
  import('../legend-state').then(({ clearContext }) => {
    clearContext()
    rootLog.info('Legend State context cleared on sign-out')
  }).catch((error) => {
    console.warn('Failed to clear Legend State context:', error)
  })
})

// Note: Dexie database is initialized when user is authenticated
// and DexieProvider is mounted to handle the database events

export const Route = createRootRouteWithContext<RouterContext>()({
  // 🎯 LOADING COMPONENT: Handled manually in AppWithInitialization
  // pendingComponent removed to prevent duplicate loading screens
  component: function RootComponent() {
    rootLog.debug('RootComponent rendering at', Date.now()); // HMR test 10 - verifying HMR works after fix
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
  rootLog.debug('RootComponentInternal rendering at', Date.now());
  const { isAuthenticated } = useUnifiedAuth()
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
  rootLog.debug('[APP-INIT] AppWithInitialization rendering at', Date.now());
  const navigate = useNavigate()
  const router = useRouter()

  // Use unified auth
  const { isAuthenticated, isSystemReady: unifiedSystemReady } = useUnifiedAuth()

  // Use app initialization to check if the app is fully loaded
  const appInit = useAppInitialization()

  // Start app initialization only when authenticated
  React.useEffect(() => {
    // Only initialize if authenticated and not already in progress
    const currentStage = appInit.stage;
    if (isAuthenticated && currentStage === 'idle') {
      rootLog.debug('[APP-INIT] Starting app initialization - user authenticated');
      appInitMethods$.initialize().catch((error) => {
        rootLog.error('[APP-INIT] App initialization failed:', error);
      });
    } else if (!isAuthenticated && currentStage !== 'idle') {
      // Reset initialization if user becomes unauthenticated
      rootLog.debug('[APP-INIT] Resetting app initialization - user not authenticated');
      appInitMethods$.reset();
    }
  }, [isAuthenticated]); // Run when authentication state changes

  // Use route readiness tracking
  const routeReady = useSelector(routeReadiness$.isReady)
  const shouldShowLoadingForRoute = useSelector(routeReadiness$.shouldShowLoading)

  // Check if we're on a public auth route
  const currentPath = router.state.location.pathname
  const isPublicAuthRoute = currentPath.startsWith('/sign-in') ||
                           currentPath.startsWith('/sign-up') ||
                           currentPath.startsWith('/forgot-password') ||
                           currentPath.startsWith('/reset-password') ||
                           currentPath.startsWith('/verify-email') ||
                           currentPath.startsWith('/otp')

  // Determine if we should show loading screen
  // Don't show loading for public auth routes, only for authenticated app initialization
  const shouldShowLoading = !isPublicAuthRoute && ((isAuthenticated && !appInit.isReady) || shouldShowLoadingForRoute)

  // Start route loading tracking only on initial mount
  React.useEffect(() => {
    // Reset route readiness on component mount (handles HMR)
    routeReadinessActions.reset();
    const pathname = router.state.location.pathname;
    routeReadinessActions.startLoading(pathname);
  }, []); // Empty deps - only run once on mount

  rootLog.debug('[APP-INIT] AppWithInitialization states:', {
    unifiedSystemReady,
    isAuthenticated: isAuthenticated,
    appInitReady: appInit.isReady,
    appInitStage: appInit.stage,
    appInitProgress: appInit.progressPercent,
    routeReady,
    shouldShowLoadingForRoute,
    shouldShowLoading
  });

  // Listen for auth state changes to handle navigation
  React.useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      const { authenticated, reason } = event.detail
      rootLog.info('Auth state changed:', { authenticated, reason })

      // Note: Immediate navigation now handled in useAuth.signOut() to prevent component re-rendering
      const publicPaths = ['/sign-', '/reset-password', '/complete-registration', '/forgot-password', '/verify-email', '/otp-verify']
      const isPublicPath = publicPaths.some(path => window.location.pathname.startsWith(path))

      if (!authenticated && reason === 'unauthenticated' && !isPublicPath) {
        // Handle edge cases where auth check fails (not from sign-out)
        rootLog.info('Unauthenticated state detected, redirecting to sign-in')
        navigate({ to: '/sign-in', replace: true })
      }
    }

    window.addEventListener('auth:state-changed', handleAuthStateChange as EventListener)

    return () => {
      window.removeEventListener('auth:state-changed', handleAuthStateChange as EventListener)
    }
  }, [navigate]);

  // Handle unauthenticated users - redirect to sign-in immediately
  React.useEffect(() => {
    if (!isAuthenticated) {
      rootLog.debug('[APP-INIT] User not authenticated, triggering redirect to sign-in');
      navigate({ to: '/sign-in', replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Show loading while redirect happens for unauthenticated users (but not on public auth routes)
  if (!isAuthenticated && !isPublicAuthRoute) {
    return <UnifiedLoadingScreen />; // Brief loading while redirect happens
  }

  // Show loading screen until app initialization is complete (only for authenticated users, not on public routes)
  if (isAuthenticated && !appInit.isReady && !isPublicAuthRoute) {
    rootLog.debug('[APP-INIT] Showing UnifiedLoadingScreen - app not ready', {
      appInitReady: appInit.isReady,
      stage: appInit.stage,
      progress: appInit.progressPercent
    });
    return <UnifiedLoadingScreen />
  }

  rootLog.debug('[APP-INIT] App ready, rendering Outlet', {
    appInitReady: appInit.isReady,
    routeReady,
    shouldShowLoadingForRoute,
    stage: appInit.stage,
    progress: appInit.progressPercent
  });

  return (
    <>
      <Outlet />
      {/* Loading screen overlay removed - was causing stuck loading state */}
      <IntegrityMonitor />
      <Toaster duration={3000} />
      {import.meta.env.MODE === 'development' && (
        <TanStackRouterDevtools position='bottom-right' />
      )}
    </>
  )
}
