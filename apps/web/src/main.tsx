// MUST be first - Apply TypeORM patches before any TypeORM code runs
import './db/newtypeorm/applyPatches';

import "reflect-metadata"; // Required for TypeORM decorators

// Debug utilities (only in development)
if (process.env.NODE_ENV === 'development') {
  import('./debug/manual-integrity-reset');
}

// Global error handlers for IndexedDB concurrency issues
if (typeof window !== 'undefined') {
  // Handle uncaught promise rejections (like ErrnoError 44)
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    // Check if this is an IndexedDB ErrnoError 44 (device busy)
    if (error?.name === 'ErrnoError' && error?.errno === 44) {
      console.warn('[GLOBAL] 🔄 Caught IndexedDB ErrnoError 44 (device busy) - this is expected during high concurrency operations');
      console.warn('[GLOBAL] 📋 Error details:', {
        name: error.name,
        errno: error.errno,
        message: error.message || 'Device or resource busy',
        stack: error.stack || 'No stack trace available'
      });
      
      // Prevent the error from appearing in console as "Uncaught"
      event.preventDefault();
      return;
    }
    
    // Check for other IndexedDB related errors
    if (error?.message?.includes('database is locked') || 
        error?.message?.includes('device or resource busy') ||
        error?.message?.includes('syncToFs')) {
      console.warn('[GLOBAL] 🔄 Caught IndexedDB concurrency error:', error?.message || error);
      event.preventDefault();
      return;
    }
    
    // Let other errors bubble up normally
    console.error('[GLOBAL] ❌ Unhandled promise rejection:', error);
  });
  
  // Handle general errors
  window.addEventListener('error', (event) => {
    const error = event.error;
    
    // Check if this is an IndexedDB ErrnoError 44
    if (error?.name === 'ErrnoError' && error?.errno === 44) {
      console.warn('[GLOBAL] 🔄 Caught IndexedDB ErrnoError 44 via error event - suppressing');
      event.preventDefault();
      return;
    }
    
    // Let other errors bubble up normally
  });
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
// import { QueryClient } from '@tanstack/react-query' // ❌ DISABLED: Moved away from traditional queries per universal-reactive-data-pattern
import { FontProvider } from './context/font-context'
import { ThemeProvider } from './context/theme-context'
import './index.css'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Import domain actions for atomic store access
import { taskActions } from '@/domain/task'
import { projectActions } from '@/domain/project'
import { userActions } from '@/domain/user'

// 🔥 ORCHESTRATOR INTEGRATION FLOW:
// 1. main.tsx: Creates router and renders root providers
// 2. __root.tsx: Creates orchestrator actor and provides it globally  
// 3. AuthAwareProviders: Sends DB_INIT_START when user is authenticated
// 4. VibestackPGliteProvider: Dispatches database:ready events to orchestrator
// 5. Orchestrator: Coordinates auth → database → sync → liveChanges → routes
// 6. UnifiedLoadingScreen: Shows appropriate loading state for each phase

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

// Initialize or reuse Router for HMR
function getRouter() {
  if (!router) {
    console.log("🚀 [ROUTER] Creating new router instance with performance tracking...")
    
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
    console.log("✅ [ROUTER] Router instance created", {
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
      console.log("🔍 [ROUTER] Setting up route change tracking for production...")
      
      // Only in production - avoid HMR conflicts in development
      const originalPushState = window.history.pushState
      window.history.pushState = function(state, title, url) {
        const navStart = performance.now()
        console.log("📍 [ROUTER] Route change starting:", { 
          url: url || 'unknown',
          timestamp: new Date().toISOString()
        })
        
        const result = originalPushState.call(this, state, title, url)
        
        requestAnimationFrame(() => {
          const navTime = performance.now() - navStart
          console.log("🎯 [ROUTER] Route change completed:", {
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
    console.log("🔥 [MAIN] HMR Dispose: Storing router instance");
    data.router = router;
    data.timestamp = Date.now();
  });

  // Restore instances on hot reload
  if (import.meta.hot.data.router) {
    console.log("🔥 [MAIN] HMR Restore: Reusing existing router instance");
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
  // Direct access to the set methods from the atomic stores
  const setTaskAtoms = taskActions.loadTasks
  const setProjectAtoms = projectActions.loadProjects
  const setUserAtoms = userActions.loadUsers

  return (
    <RouterProvider 
      router={currentRouter} 
      context={{ 
        // ❌ DISABLED: Moved away from traditional queries per universal-reactive-data-pattern
        // queryClient,
        setTaskAtoms,
        setProjectAtoms,
        setUserAtoms
      }} 
    />
  )
}

function renderApp(rootElement: HTMLElement) {
  console.log("🔍 [MAIN] Creating React root and rendering app");
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
