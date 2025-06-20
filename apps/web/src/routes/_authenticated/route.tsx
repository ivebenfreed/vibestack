import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { GlobalSidebar, GLOBAL_SIDEBAR_WIDTH } from '@/components/layout/global-sidebar'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { useLayoutStore } from '@/stores/layoutStore'
import { SearchProvider } from '@/context/search-context'
import SkipToMain from '@/components/skip-to-main'
import { ProjectService } from '@/domain/project'
import { TaskService } from '@/domain/task'
import { UserService } from '@/domain/user'
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource'
import { Project, Task, User } from '@repo/dataforge/client-entities'
import { getDefaultStore } from 'jotai'
import { useSystemReadiness } from '@/state-machines/orchestrator-hooks'
import { EnhancedLoadingSkeleton } from '@/components/loading/enhanced-loading-skeleton'
import { SystemReadyGuard } from '@/components/guards/SystemReadyGuard'
import { UnifiedLoadingScreen } from '@/components/loading/UnifiedLoadingScreen'

// Global debouncer to prevent multiple auth checks during rapid preloading
let lastAuthCheck: {
  timestamp: number
  result: 'authenticated' | 'unauthenticated'
  executionId: string
  url: string
} | null = null

// ⚡ PERFORMANCE: Moderate debounce time now that route loaders are removed
const AUTH_DEBOUNCE_MS = 500 // Prevent duplicate auth checks within 500ms

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const now = Date.now()
    const executionId = Math.random().toString(36).substr(2, 9)
    const currentUrl = location.href
    
    // Debug: Track debouncer state
    console.log(`[AuthenticatedRoute] BeforeLoad execution ${executionId}:`, {
      url: currentUrl,
      timestamp: now,
      lastCheck: lastAuthCheck ? {
        timestamp: lastAuthCheck.timestamp,
        timeDiff: now - lastAuthCheck.timestamp,
        withinDebounce: (now - lastAuthCheck.timestamp) < AUTH_DEBOUNCE_MS,
        executionId: lastAuthCheck.executionId,
        sameUrl: lastAuthCheck.url === currentUrl
      } : null
    })
    
    // ⚡ PERFORMANCE: More aggressive debouncing - also check if same URL to skip redundant checks
    if (lastAuthCheck && 
        (now - lastAuthCheck.timestamp) < AUTH_DEBOUNCE_MS &&
        lastAuthCheck.url === currentUrl) {
      console.log(`[AuthenticatedRoute] DEBOUNCED execution ${executionId} - returning cached result (same URL)`)
      // Return cached result silently (no logging during rapid preload calls)
      if (lastAuthCheck.result === 'unauthenticated') {
        throw redirect({
          to: '/sign-in',
          search: { redirect: location.href },
          replace: true
        })
      }
      return // authenticated - proceed silently
    }
    
    console.log(`[AuthenticatedRoute] EXECUTING auth check ${executionId}`)
    
    // XState-based auth guard - simple state checks only
    const orchestratorActor = (window as any).orchestratorActor
    
    // Fallback: if XState isn't ready yet, redirect to sign-in
    if (!orchestratorActor) {
      console.log('[AuthenticatedRoute] No orchestrator actor found - redirecting to sign-in')
      lastAuthCheck = { timestamp: now, result: 'unauthenticated', executionId, url: currentUrl }
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
        replace: true
      })
    }
    
    const snapshot = orchestratorActor.getSnapshot()
    
    // Debug: Log the actual orchestrator state (only for non-debounced checks)
    console.log('[AuthenticatedRoute] Orchestrator state check:', {
      hasUser: !!snapshot.context.user,
      hasAuthToken: !!snapshot.context.authToken,
      isSystemReady: snapshot.context.isSystemReady,
      canLoadRoutes: snapshot.context.isSystemReady, // Use system ready as route loading flag
      machineState: snapshot.value,
      userEmail: snapshot.context.user?.email
    })
    
    // Simple XState guards - no complex logic or subscriptions
    
    // If clearly unauthenticated, redirect immediately
    if (snapshot.value === 'initializing.auth.unauthenticated') {
      console.log('[AuthenticatedRoute] Unauthenticated state - redirecting')
      lastAuthCheck = { timestamp: now, result: 'unauthenticated', executionId, url: currentUrl }
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
        replace: true
      })
    }
    
    // 🔥 CRITICAL FIX: Check both authentication AND system readiness
    if (snapshot.context.user && snapshot.context.authToken) {
      // User is authenticated, but check if system is ready for route loading
      if (!snapshot.context.isSystemReady) {
        console.log('[AuthenticatedRoute] User authenticated but system not ready - waiting for initialization...')
        
        // Return a promise that resolves when system becomes ready
        return new Promise((resolve, reject) => {
          const checkSystemReady = () => {
            const currentSnapshot = orchestratorActor.getSnapshot()
            if (currentSnapshot.context.isSystemReady) {
              console.log('[AuthenticatedRoute] System ready - proceeding with route')
              lastAuthCheck = { timestamp: Date.now(), result: 'authenticated', executionId, url: currentUrl }
              resolve(undefined)
            } else if (currentSnapshot.value === 'initializing.auth.unauthenticated') {
              // User became unauthenticated while waiting
              console.log('[AuthenticatedRoute] User became unauthenticated while waiting - redirecting')
              reject(redirect({
                to: '/sign-in',
                search: { redirect: location.href },
                replace: true
              }))
            } else {
              // Still not ready, check again in a bit
              setTimeout(checkSystemReady, 100)
            }
          }
          
          checkSystemReady()
        })
      }
      
      console.log('[AuthenticatedRoute] User authenticated and system ready - proceeding with route')
      lastAuthCheck = { timestamp: now, result: 'authenticated', executionId, url: currentUrl }
      return
    }
    
    // For any intermediate/unknown states, redirect to sign-in to be safe
    console.log('[AuthenticatedRoute] Intermediate/unknown state - redirecting to sign-in')
    lastAuthCheck = { timestamp: now, result: 'unauthenticated', executionId, url: currentUrl }
    throw redirect({
      to: '/sign-in',
      search: { redirect: location.href },
      replace: true
    })
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <>
      <SystemReadyGuard>
        <SearchProvider>
          <AuthenticatedContent />
        </SearchProvider>
      </SystemReadyGuard>
    </>
  )
}

function AuthenticatedContent() {
  const { isSystemReady } = useSystemReadiness()
  const location = useLocation()
  
  // ⚡ PERFORMANCE: No layout store updates - using pure route-based highlighting
  // The sidebar uses matchRoute for highlighting, which is much lighter than layout store updates
  
  return (
    <div className="layout-container">
      <GlobalSidebar />
      <div>
        <SkipToMain />
        <SidebarLayout />
      </div>
    </div>
  )
}
