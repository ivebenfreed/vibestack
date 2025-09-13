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
// Sync system replaced with Legend State reactive observables
// XState machines removed in favor of reactive pattern
import { useSystem } from '@/state-machines'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
import { log } from '@/logger'
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
    rootLog.info('RootComponent rendering at', Date.now());
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
  rootLog.info('RootComponentInternal rendering at', Date.now());
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
  rootLog.info('AppWithInitialization rendering at', Date.now());
  const navigate = useNavigate()
  const router = useRouter()
  const { isSystemReady } = useSystem()
  
  // Use unified auth that combines both XState and Legend State auth
  const { isAuthenticated, isSystemReady: unifiedSystemReady } = useUnifiedAuth()
  
  // Use the unified system ready state (combines both sources)
  const finalSystemReady = isSystemReady || unifiedSystemReady
  
  rootLog.info('AppWithInitialization states:', { 
    isSystemReady, 
    unifiedSystemReady,
    finalSystemReady,
    isAuthenticated: isAuthenticated,
    source: 'unified auth (combines XState + Legend State)'
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
