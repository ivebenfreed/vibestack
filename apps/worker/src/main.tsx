// Dexie uses native IndexedDB, no patches or decorators needed

// Enable Legend State React tracking for automatic component updates
import { enableReactTracking } from '@legendapp/state/config/enableReactTracking';

enableReactTracking({
  auto: true,
  warnUnobserved: true
});

// Initialize global API interceptor for 402 and other error handling
import './lib/api-interceptor';

// Note: Legend State persistence is configured per-observable in observables.ts
// using configureSynced(syncedCrud, persistOptions) pattern

// Debug utilities (only in development)
if (process.env.NODE_ENV === 'development') {
  // Commented out - file needs to be updated for new architecture
  // import('./debug/manual-integrity-reset');
  // import('./test-utils/sync-test-helpers'); // Removed - no longer needed
}

// Dexie uses native IndexedDB for local persistence

// Removed LiveStore initialization - migrating to Legend State

import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
// import { QueryClient } from '@tanstack/react-query' // ❌ DISABLED: Moved away from traditional queries per universal-reactive-data-pattern
import { FontProvider } from './context/font-context'
import { ThemeProvider } from './context/theme-context'
import { uiLog } from '@/logger'
import './index.css'
// Generated Routes
import { routeTree } from './routeTree.gen'
// TODO: Migrate to Dexie - these imports need to be updated to use the new domain services

// 🔥 SIMPLIFIED INTEGRATION FLOW:
// 1. main.tsx: Creates router and renders root providers
// 2. __root.tsx: Creates XState actors (auth + sync) and provides them globally  
// 3. AuthAwareProviders: Provides IndexedDB context when user is authenticated
// 4. Auth machine: Directly calls Legend State loadOrgContext() when ready
// 5. Legend State: Handles lazy initialization and persistence automatically
// 6. UnifiedLoadingScreen: Shows loading state based on Legend State observables

// Global instances for HMR persistence
let router: ReturnType<typeof createRouter>;
// ❌ DISABLED: Moved away from traditional queries per universal-reactive-data-pattern
// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       staleTime: 5 * 60 * 1000, // 5 minutes
//       gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
//     },
//   },
// });

// Create logger instance for this file
const log = uiLog('main.tsx');

// Initialize or reuse Router for HMR
function getRouter() {
  if (!router) {
    log.info('🚀 Creating new router instance with performance tracking...')
    
    const startTime = performance.now()
    
    router = createRouter({
      routeTree,
      context: { 
        // ❌ DISABLED: Moved away from traditional queries per universal-reactive-data-pattern
        // queryClient,
        setTaskAtoms: undefined!,
        setProjectAtoms: undefined!,
        setUserAtoms: undefined!,
      },
      // ⚡ PERFORMANCE: Disable preloading to prevent click handler violations
      defaultPreload: false,  // Disabled to prevent performance issues
      defaultPreloadStaleTime: 10_000, // Cache preloaded routes for 10 seconds
      defaultPendingMs: 100, // Show pending UI after 100ms
      defaultPendingMinMs: 150, // ⚡ OPTIMIZED: Reduced from 500ms to 150ms for snappier feel
      
      // ⚡ PERFORMANCE: Reduced aggressiveness to prevent excessive multiple route loading
      defaultPreloadDelay: 150, // ⚡ LESS AGGRESSIVE: Increased from 25ms to 150ms to reduce accidental preloads
      defaultPreloadGcTime: 30_000, // Keep preloaded routes in memory for 30 seconds
    })
    
    const createTime = performance.now() - startTime
    log.info('✅ Router instance created', {
      createTime: `${createTime.toFixed(2)}ms`,
      preloadEnabled: true,
      preloadDelay: 150,
      pendingMs: 100,
      pendingMinMs: 150,
      staleTime: 10_000,
      lazyRoutesEnabled: true
    })
    
    // ⚡ PERFORMANCE: Disable custom tracking during development to prevent HMR issues
    if (typeof window !== 'undefined' && !import.meta.env.DEV) {
      log.info('🔍 Setting up route change tracking for production...')
      
      // Only in production - avoid HMR conflicts in development
      const originalPushState = window.history.pushState
      window.history.pushState = function(state, title, url) {
        const navStart = performance.now()
        log.info('📍 Route change starting:', { 
          url: url || 'unknown',
          timestamp: new Date().toISOString()
        })
        
        const result = originalPushState.call(this, state, title, url)
        
        requestAnimationFrame(() => {
          const navTime = performance.now() - navStart
          log.info('🎯 Route change completed:', {
            url: url || 'unknown',
            totalTime: `${navTime.toFixed(2)}ms`,
            currentPath: window.location.pathname
          })
        })
        
        return result
      }
    }
  }
  return router;
}

// Get the router instance
const currentRouter = getRouter();

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof currentRouter
  }
}

// ⚡ PERFORMANCE: Simplified HMR - just preserve router instance
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    log.info('🔥 HMR Dispose: Storing router instance');
    data.router = router;
    data.timestamp = Date.now();
  });

  // Restore instances on hot reload
  if (import.meta.hot.data.router) {
    log.info('🔥 HMR Restore: Reusing existing router instance');
    router = import.meta.hot.data.router;
  }
}

// Simple app initialization
async function initializeApp() {
  const rootElement = document.getElementById('root')!
  
  // Simple: Just render the app
  renderApp(rootElement)
}

// Wrapper component to provide atom setters via router context - Phase 4: Atomic Integration
function AppWithRouterContext() {
  // TODO: Migrate to Dexie - need to update to use new domain services
  // Direct access to the set methods from the atomic stores
  // const setTaskAtoms = taskUtils.loadTasks
  // const setProjectAtoms = projectUtils.loadProjects
  // const setUserAtoms = userUtils.loadUsers

  return (
    <RouterProvider 
      router={currentRouter} 
      context={{ 
        // ❌ DISABLED: Moved away from traditional queries per universal-reactive-data-pattern
        // queryClient,
        // TODO: Migrate to Dexie - temporarily disabled until migration is complete
        setTaskAtoms: undefined as any,
        setProjectAtoms: undefined as any,
        setUserAtoms: undefined as any
      }} 
    />
  )
}

function renderApp(rootElement: HTMLElement) {
  log.info('🔍 Creating React root and rendering app');
  
  const root = ReactDOM.createRoot(rootElement)
  
  root.render(
    <ThemeProvider defaultTheme='light' storageKey='vite-ui-theme'>
      <FontProvider>
        <AppWithRouterContext />
      </FontProvider>
    </ThemeProvider>
  )
}

// Initialize the app
initializeApp();

// HMR: Accept hot updates for this module
if (import.meta.hot) {
  import.meta.hot.accept();
}
