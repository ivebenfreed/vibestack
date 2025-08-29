/**
 * SidebarLayout V2 - Enhanced with Layout Store Integration
 * 
 * Replaces cookie-based state management with enhanced XState Store.
 * Provides clean route transitions without animation artifacts.
 * Maintains all existing functionality while using centralized state management.
 */

import { Outlet, useLocation } from '@tanstack/react-router'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header, HEADER_HEIGHT } from '@/components/layout/header'
import { useEffect } from 'react'
import { useLayoutStoreV2, cleanupLegacyCookieState } from '@/stores/layoutStoreV2'

export function SidebarLayoutV2() {
  const location = useLocation()
  
  // Use enhanced layout store
  const activeSection = useLayoutStoreV2.activeSection()
  const appSidebar = useLayoutStoreV2.appSidebar()
  const isMobile = useLayoutStoreV2.isMobile()
  const { 
    transitionToSection, 
    setSidebarExpanded, 
    clearTransitioning,
    updateSectionFromRoute,
    initializeMobileDetection,
    scheduleTransitioningClear
  } = useLayoutStoreV2
  
  // Initialize mobile detection on mount
  useEffect(() => {
    const cleanup = initializeMobileDetection()
    return cleanup
  }, [])
  
  // Clean up legacy cookie state on first run
  useEffect(() => {
    cleanupLegacyCookieState()
  }, [])
  
  // Update section based on route changes
  useEffect(() => {
    updateSectionFromRoute(location.pathname)
  }, [location.pathname, updateSectionFromRoute])
  
  // Clear transitioning flag after route transitions complete
  useEffect(() => {
    if (appSidebar.isTransitioning) {
      // Schedule clearing the transitioning flag after DOM updates
      scheduleTransitioningClear(100)
    }
  }, [appSidebar.isTransitioning, scheduleTransitioningClear])
  
  // Handle user toggle events
  const handleOpenChange = (open: boolean) => {
    // Only allow manual toggle when sidebar is visible for this section
    if (appSidebar.visible) {
      setSidebarExpanded(open)
    }
    // If sidebar shouldn't show, ignore manual toggle attempts
  }
  
  // Determine collapsible mode
  const collapsibleMode = appSidebar.visible ? 'icon' : 'offcanvas'
  
  if (import.meta.env.DEV) {
    // Debug logging for development
    console.log('[SidebarLayoutV2] Render state:', {
      activeSection,
      appSidebar,
      collapsibleMode,
      pathname: location.pathname
    })
  }
  
  return (
    <SidebarProvider 
      // Always start collapsed to prevent animation artifacts
      defaultOpen={false}
      open={appSidebar.expanded}
      onOpenChange={handleOpenChange}
    >
      {/* Use dynamic collapsible mode with transition control */}
      <AppSidebar 
        collapsible={collapsibleMode}
        data-disable-transition={appSidebar.isTransitioning}
      />
      
      <SidebarInset className="flex flex-col min-h-0 !ml-0">
        <Header fixed />
        <div 
          className="flex-1 min-h-0 overflow-auto"
          style={{ paddingTop: `${HEADER_HEIGHT}px` }}
        >
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}