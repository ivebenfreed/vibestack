/**
 * SidebarLayout - Complete Custom Dual Sidebar Layout
 * 
 * Custom dual sidebar architecture that uses:
 * - DualSidebarProvider for state management
 * - AppSidebar for custom app sidebar
 * - Integration with enhanced layout store
 * - Proper CSS Grid layout for dual sidebars
 * 
 * Features:
 * - No dependency on template SidebarProvider
 * - Proper dual sidebar layout with CSS Grid
 * - Clean route transitions
 * - Mobile responsive design
 * - All existing functionality preserved
 */

import { Outlet, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { DualSidebarProvider } from './DualSidebarProvider'
import { AppSidebarV2 } from './AppSidebarV2'
import { HeaderV3 } from './HeaderV3'
import { useLayoutStoreV2, cleanupLegacyCookieState } from '@/stores/layoutStoreV2'
import { GlobalSidebar } from '@/components/layout/global-sidebar'
import { GridDebugToggle } from '@/components/debug/grid-debug-toggle'

// Dual sidebar layout now uses static CSS classes in index.css (Tailwind v4 approach)

function SidebarLayoutV3Internal() {
  const location = useLocation()
  
  // Use enhanced layout store
  const appSidebarVisible = useLayoutStoreV2.sidebarVisible()
  const appSidebarExpanded = useLayoutStoreV2.sidebarExpanded()
  const isTransitioning = useLayoutStoreV2.isTransitioning()
  const isMobile = useLayoutStoreV2.isMobile()
  const { 
    updateSectionFromRoute,
    initializeMobileDetection,
    scheduleTransitioningClear,
    clearTransitioning
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
  
  // Clear transitioning flag immediately since we removed animations
  useEffect(() => {
    if (isTransitioning) {
      clearTransitioning()
    }
  }, [isTransitioning, clearTransitioning])
  
  // No more runtime CSS injection - using static Tailwind v4 classes
  
  // No CSS variables needed - using data attributes for CSS Grid
  
  
  return (
    <div className="layout-container">
      <div
        className="dual-sidebar-layout"
        data-app-sidebar-visible={appSidebarVisible}
        data-app-sidebar-expanded={appSidebarExpanded}
        data-transitioning={isTransitioning}
        data-mobile={isMobile}
      >
        {/* Global Sidebar - Grid column 1 */}
        <GlobalSidebar />
        
        {/* App Sidebar - Grid column 2 (when visible) */}
        <AppSidebarV2 />
        
        {/* Main Content - Grid column 3 */}
        <main className="dual-sidebar-inset">
          <HeaderV3 fixed />
          <div className="dual-sidebar-content">
            <Outlet />
          </div>
        </main>
      </div>
      <GridDebugToggle />
    </div>
  )
}

export function SidebarLayoutV3() {
  return (
    <DualSidebarProvider>
      <SidebarLayoutV3Internal />
    </DualSidebarProvider>
  )
}