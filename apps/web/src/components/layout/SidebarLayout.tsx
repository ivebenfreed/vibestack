import Cookies from 'js-cookie'
import { Outlet } from '@tanstack/react-router'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header, HEADER_HEIGHT } from '@/components/layout/header'
import { useLayoutStore, shouldShowSidebarForSection } from '@/stores/layoutStore'
import { useState, useEffect, useMemo } from 'react'

export function SidebarLayout() {
  const activeSection = useLayoutStore.activeSection()
  const pendingSection = useLayoutStore.pendingSection()
  
  // Use effective section (pending takes priority for immediate animations)
  const effectiveSection = pendingSection || activeSection
  
  // Memoize shouldShowSidebar to prevent unnecessary useEffect runs
  const shouldShowSidebar = useMemo(() => 
    shouldShowSidebarForSection(effectiveSection), 
    [effectiveSection]
  )
  
  // Read sidebar state from cookie for manual toggle state
  const sidebarState = Cookies.get('sidebar_state')
  const defaultManualState = sidebarState === null ? true : sidebarState === 'true'
  
  // Local state for manual toggle (when sidebar should be visible)
  const [manualToggleState, setManualToggleState] = useState(defaultManualState)
  
  // Determine the collapsible mode and open state:
  // - When sidebar should be hidden by route: use "offcanvas" mode, always closed
  // - When sidebar should be visible: use "icon" mode, respect manual toggle
  const collapsibleMode = shouldShowSidebar ? 'icon' : 'offcanvas'
  const isOpen = shouldShowSidebar ? manualToggleState : false
  
  // When section changes and sidebar becomes visible, restore manual toggle state
  useEffect(() => {
    if (shouldShowSidebar) {
      // Restore the manual toggle state from cookie when sidebar becomes available
      const currentSidebarState = Cookies.get('sidebar_state')
      const savedState = currentSidebarState === null ? true : currentSidebarState === 'true'
      setManualToggleState(savedState)
    }
  }, [shouldShowSidebar])
  
  const handleOpenChange = (open: boolean) => {
    // Only allow manual toggle when sidebar should be visible for this section
    if (shouldShowSidebar) {
      setManualToggleState(open)
      // Update cookie for persistence
      document.cookie = `sidebar_state=${open}; path=/; max-age=${60 * 60 * 24 * 7}`
    }
    // If sidebar shouldn't show, ignore manual toggle attempts
  }
  
  return (
    <SidebarProvider 
      defaultOpen={defaultManualState}
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      {/* Use dynamic collapsible mode: "offcanvas" for complete hide, "icon" for responsive */}
      <AppSidebar collapsible={collapsibleMode} />
      
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