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
import { FontProvider } from './context/font-context'
import { ThemeProvider } from './context/theme-context'
import { log } from '@/logger'
import './index.css'
// Generated Routes
import { routeTree } from './routeTree.gen'

// 🔥 SIMPLIFIED INTEGRATION FLOW:
// 1. main.tsx: Creates router and renders root providers
// 2. __root.tsx: Creates XState actors (auth + sync) and provides them globally  
// 3. AuthAwareProviders: Provides IndexedDB context when user is authenticated
// 4. Auth machine: Directly calls Legend State loadOrgContext() when ready
// 5. Legend State: Handles lazy initialization and persistence automatically
// 6. UnifiedLoadingScreen: Shows loading state based on Legend State observables

// Global instances for HMR persistence
let router: ReturnType<typeof createRouter>;

// Create logger instance for this file
const mainLog = log('main.tsx');

// Initialize or reuse Router for HMR
function getRouter() {
  if (!router) {
    mainLog.info('🚀 Creating new router instance with performance tracking...')
    
    const startTime = performance.now()
    
    router = createRouter({
      routeTree,
      context: {
        setTaskAtoms: undefined!,
        setProjectAtoms: undefined!,
        setUserAtoms: undefined!,
      },
      // ⚡ PERFORMANCE: Disable preloading to prevent click handler violations
      defaultPreload: false,  // Disabled to prevent performance issues
      defaultPreloadStaleTime: 10_000, // Cache preloaded routes for 10 seconds
      defaultPendingMs: 0, // ⚡ INSTANT: No delay for pending UI
      defaultPendingMinMs: 0, // ⚡ INSTANT: No minimum pending duration

      // ⚡ PERFORMANCE: Reduced aggressiveness to prevent excessive multiple route loading
      defaultPreloadDelay: 0, // ⚡ INSTANT: No preload delay
      defaultPreloadGcTime: 30_000, // Keep preloaded routes in memory for 30 seconds

      // TIMING DEBUG: Hook into router events
      onBeforeLoad: ({ location, cause }) => {
        console.log(`⏱️ [ROUTER-TIMING] onBeforeLoad: ${performance.now().toFixed(3)}ms - ${location.pathname} (${cause})`);
      },
      onLoad: ({ location, cause }) => {
        console.log(`⏱️ [ROUTER-TIMING] onLoad: ${performance.now().toFixed(3)}ms - ${location.pathname} (${cause})`);
      }
    })
    
    const createTime = performance.now() - startTime
    mainLog.info('✅ Router instance created', {
      createTime: `${createTime.toFixed(2)}ms`,
      preloadEnabled: false,
      preloadDelay: 0,
      pendingMs: 0,
      pendingMinMs: 0,
      staleTime: 10_000,
      lazyRoutesEnabled: true
    })
    
    // ⚡ PERFORMANCE: Disable custom tracking during development to prevent HMR issues
    if (typeof window !== 'undefined' && !import.meta.env.DEV) {
      mainLog.info('🔍 Setting up route change tracking for production...')
      
      // Only in production - avoid HMR conflicts in development
      const originalPushState = window.history.pushState
      window.history.pushState = function(state, title, url) {
        const navStart = performance.now()
        mainLog.info('📍 Route change starting:', { 
          url: url || 'unknown',
          timestamp: new Date().toISOString()
        })
        
        const result = originalPushState.call(this, state, title, url)
        
        requestAnimationFrame(() => {
          const navTime = performance.now() - navStart
          mainLog.info('🎯 Route change completed:', {
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
    mainLog.info('🔥 HMR Dispose: Storing router instance');
    data.router = router;
    data.timestamp = Date.now();
  });

  // Restore instances on hot reload
  if (import.meta.hot.data.router) {
    mainLog.info('🔥 HMR Restore: Reusing existing router instance');
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
  // Legend State handles entity management automatically via observables
  // Router context provides compatibility layer for legacy components

  return (
    <RouterProvider 
      router={currentRouter} 
      context={{ 
        // Legend State handles data management - these setters provide compatibility
        setTaskAtoms: undefined as any,
        setProjectAtoms: undefined as any,
        setUserAtoms: undefined as any
      }} 
    />
  )
}

function renderApp(rootElement: HTMLElement) {
  mainLog.info('🔍 Creating React root and rendering app');
  
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
