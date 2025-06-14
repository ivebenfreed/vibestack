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

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // Pure XState auth protection - check global orchestrator
    const orchestratorActor = (window as any).orchestratorActor
    
    if (orchestratorActor) {
      const snapshot = orchestratorActor.getSnapshot()
      
      // Debug: Log the actual orchestrator state to understand what's happening
      console.log('[AuthenticatedRoute] Orchestrator state check:', {
        hasUser: !!snapshot.context.user,
        hasAuthToken: !!snapshot.context.authToken,
        isSystemReady: snapshot.context.isSystemReady,
        machineState: snapshot.value,
        userEmail: snapshot.context.user?.email
      })
      
      // If XState says we're authenticated, check system readiness
      if (snapshot.context.user && snapshot.context.authToken) {
        console.log('[AuthenticatedRoute] User authenticated - proceeding with route')
        
        // If system is ready, proceed immediately
        if (snapshot.context.isSystemReady) {
          console.log('[AuthenticatedRoute] System is ready - allowing route access')
          return
        }
        
        // If system is not ready, wait for it to become ready
        console.log('[AuthenticatedRoute] System not ready - waiting for system readiness...')
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('System readiness timeout after 30 seconds'))
          }, 30000)
          
          const unsubscribe = orchestratorActor.subscribe((state: any) => {
            if (state.context.isSystemReady) {
              console.log('[AuthenticatedRoute] System became ready - allowing route access')
              clearTimeout(timeout)
              unsubscribe.unsubscribe()
              resolve()
            }
          })
        })
        return
      }
      
      // If XState says we're clearly unauthenticated, redirect
      if (snapshot.value === 'initializing.auth.unauthenticated') {
        console.log('[AuthenticatedRoute] Orchestrator shows unauthenticated state - redirecting')
        throw redirect({
          to: '/sign-in',
          search: { redirect: location.href },
          replace: true
        })
      }
      
      // If we get here, we're in an intermediate state - wait a moment for orchestrator to settle
      console.log('[AuthenticatedRoute] Orchestrator in intermediate state - waiting for auth to settle...')
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('[AuthenticatedRoute] Auth settlement timeout - redirecting to sign-in')
          reject(new Error('Auth settlement timeout'))
        }, 5000) // Shorter timeout for auth settlement
        
        const unsubscribe = orchestratorActor.subscribe((state: any) => {
          // Once we have a clear auth state (either authenticated or unauthenticated)
          if ((state.context.user && state.context.authToken) || 
              state.value === 'initializing.auth.unauthenticated') {
            clearTimeout(timeout)
            unsubscribe.unsubscribe()
            resolve()
          }
        })
      })
      
      // Re-check after waiting
      const newSnapshot = orchestratorActor.getSnapshot()
      if (newSnapshot.context.user && newSnapshot.context.authToken) {
        console.log('[AuthenticatedRoute] Auth settled - user authenticated')
        return
      } else {
        console.log('[AuthenticatedRoute] Auth settled - user not authenticated')
        throw redirect({
          to: '/sign-in',
          search: { redirect: location.href },
          replace: true
        })
      }
    }
    
    // Fallback: if XState isn't ready yet, redirect to sign-in to be safe
    console.log('[AuthenticatedRoute] No orchestrator actor found - redirecting to sign-in')
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
  const activeSection = useLayoutStore.activeSection()
  const location = useLocation()
  
  // Layout store route updates for sidebar functionality
  useEffect(() => {
    // Only run when system is ready to avoid unnecessary work
    if (!isSystemReady) return
    
    const getExpectedSection = (pathname: string) => {
      if (pathname.startsWith('/projects') || pathname === '/tasks') return 'projects'
      if (pathname.startsWith('/settings') || pathname.startsWith('/help-center')) return 'settings'
      if (pathname.startsWith('/debug') || pathname.startsWith('/sign-') || pathname.startsWith('/forgot-') || pathname.startsWith('/otp') || pathname.match(/^\/(401|403|404|500|503)$/)) return 'debug'
      return 'home'
    }
    
    const expectedSection = getExpectedSection(location.pathname)
    if (activeSection !== expectedSection) {
      useLayoutStore.updateSectionFromRoute(location.pathname)
    }
  }, [isSystemReady, location.pathname, activeSection])
  
  console.log('[AuthenticatedLayout] ✅ Rendering layout with SystemReadyGuard')
  
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
