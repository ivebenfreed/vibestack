// MUST be first - Apply TypeORM patches before any TypeORM code runs
import './db/newtypeorm/applyPatches';

import "reflect-metadata"; // Required for TypeORM decorators
import React, { useEffect, useState, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { handleServerError } from '@/utils/handle-server-error'
import { FontProvider } from './context/font-context'
import { ThemeProvider } from './context/theme-context'
import './index.css'
// Generated Routes
import { routeTree } from './routeTree.gen'
import { AbilityProvider } from './contexts/AbilityContext'; // Adjust path
// Import the Mini Sync Visualizer
import { PerformanceMonitorProvider } from './contexts/performance-monitor-context'
import { GlobalPerformanceMonitor } from './components/debug/GlobalPerformanceMonitor'

// Lazy load heavy providers for better performance
const LazyVibestackPGliteProvider = lazy(() => 
  import('./db/pglite-provider').then(module => ({ 
    default: module.VibestackPGliteProvider 
  }))
);

const LazySyncProvider = lazy(() => 
  import('./sync/SyncContext').then(module => ({ 
    default: module.SyncProvider 
  }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) console.log({ failureCount, error })

        if (failureCount >= 0 && import.meta.env.DEV) return false
        if (failureCount > 3 && import.meta.env.PROD) return false

        return !(
          error instanceof AxiosError &&
          [401, 403].includes(error.response?.status ?? 0)
        )
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
    mutations: {
      onError: (error) => {
        handleServerError(error)

        if (error instanceof AxiosError) {
          if (error.response?.status === 304) {
            toast.error('Content not modified!')
          }
        }
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          const authState = useAuthStore.getState();
          // Check if offline and if there's a valid persisted session
          if (!navigator.onLine && authState.isAuthenticated && !authState.isSessionExpired()) {
            console.warn("[QueryCache] Received 401 while offline, but cached session is valid. Suppressing logout.");
            // Optionally, you could inform the user that some actions might be limited
            // toast.info("Offline: Some operations may be limited.");
          } else {
            toast.error('Session expired! Please log in again.');
            authState.setUnauthenticated();
          }
        }
        if (error.response?.status === 500) {
          toast.error('Internal Server Error!')
          router.navigate({ to: '/500' })
        }
        if (error.response?.status === 403) {
          // router.navigate("/forbidden", { replace: true });
        }
      }
    },
  }),
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Auth-aware wrapper component for database and sync services
function AuthAwareProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const [showProviders, setShowProviders] = useState(false);
  
  // Track provider initialization performance
  useEffect(() => {
    if (isAuthenticated) {
      window.dispatchEvent(new CustomEvent('provider-db-init-start'));
      const startTime = performance.now();
      
      // Delay provider initialization to not block initial render
      const timer = setTimeout(() => {
        setShowProviders(true);
      }, 50); // Reduced from 100ms to 50ms since it's working well
      
      return () => {
        clearTimeout(timer);
        const endTime = performance.now();
        window.dispatchEvent(new CustomEvent('provider-db-init-complete', {
          detail: { duration: endTime - startTime }
        }));
      };
    } else {
      setShowProviders(false);
    }
  }, [isAuthenticated]);
  
  // For authenticated users, initialize database and sync with lazy loading
  if (isAuthenticated && showProviders) {
    return (
      <React.Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Initializing database...</p>
          </div>
        </div>
      }>
        <LazyVibestackPGliteProvider>
          <LazySyncProvider>
            {children}
          </LazySyncProvider>
        </LazyVibestackPGliteProvider>
      </React.Suspense>
    )
  }
  
  // For unauthenticated users or during lazy loading, just render the children
  // This allows the auth flow and initial UI to work normally
  return children
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <PerformanceMonitorProvider enabled={true}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme='light' storageKey='vite-ui-theme'>
          <FontProvider>
            <AuthAwareProviders>
              <AbilityProvider>
                <RouterProvider router={router} />
              </AbilityProvider>
            </AuthAwareProviders>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
      <GlobalPerformanceMonitor defaultVisible={true} position="top-center" />
    </PerformanceMonitorProvider>
  )
}
