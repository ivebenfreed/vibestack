/**
 * DualSidebarProvider - Custom Context Provider for Dual Sidebar Architecture
 * 
 * Replaces template SidebarProvider with dual sidebar-aware state management.
 * Integrates with enhanced layout store while preserving all existing functionality.
 * 
 * Features:
 * - Mobile sheet behavior for app sidebar
 * - Keyboard shortcuts (Ctrl+B)
 * - Accessibility features
 * - Touch interactions
 * - Integration with layoutStoreV2
 */

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useLayoutStoreV2 } from '@/stores/layoutStoreV2'
import { TooltipProvider } from '@/components/ui/tooltip'

// Constants for dual sidebar layout
const GLOBAL_SIDEBAR_WIDTH = 64
const APP_SIDEBAR_WIDTH = '16rem'
const APP_SIDEBAR_WIDTH_MOBILE = '18rem'
const APP_SIDEBAR_WIDTH_ICON = '3.5rem'
const KEYBOARD_SHORTCUT = 'b'

interface DualSidebarContextProps {
  // App sidebar state (from layoutStoreV2)
  appSidebarVisible: boolean
  appSidebarExpanded: boolean
  isTransitioning: boolean
  
  // Mobile specific state
  isMobile: boolean
  mobileSheetOpen: boolean
  setMobileSheetOpen: (open: boolean) => void
  
  // Actions
  toggleAppSidebar: () => void
  setAppSidebarExpanded: (expanded: boolean) => void
  
  // CSS variables for layout
  cssVariables: React.CSSProperties
}

const DualSidebarContext = createContext<DualSidebarContextProps | null>(null)

export function useDualSidebar() {
  const context = useContext(DualSidebarContext)
  if (!context) {
    throw new Error('useDualSidebar must be used within a DualSidebarProvider')
  }
  return context
}

interface DualSidebarProviderProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function DualSidebarProvider({ 
  children, 
  className, 
  style 
}: DualSidebarProviderProps) {
  // Layout store integration
  const appSidebarVisible = useLayoutStoreV2.sidebarVisible()
  const appSidebarExpanded = useLayoutStoreV2.sidebarExpanded()
  const isTransitioning = useLayoutStoreV2.isTransitioning()
  const isMobile = useLayoutStoreV2.isMobile()
  const { setSidebarExpanded, toggleSidebar } = useLayoutStoreV2
  
  // Mobile sheet state (separate from desktop app sidebar state)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        if (isMobile) {
          setMobileSheetOpen(open => !open)
        } else {
          toggleSidebar()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobile, toggleSidebar])
  
  // Actions
  const toggleAppSidebar = useCallback(() => {
    if (isMobile) {
      setMobileSheetOpen(open => !open)
    } else {
      toggleSidebar()
    }
  }, [isMobile, toggleSidebar])
  
  const setAppSidebarExpandedAction = useCallback((expanded: boolean) => {
    setSidebarExpanded(expanded)
  }, [setSidebarExpanded])
  
  // CSS variables for consistent styling
  const cssVariables: React.CSSProperties = {
    '--global-sidebar-width': `${GLOBAL_SIDEBAR_WIDTH}px`,
    '--app-sidebar-width': APP_SIDEBAR_WIDTH,
    '--app-sidebar-width-mobile': APP_SIDEBAR_WIDTH_MOBILE,
    '--app-sidebar-width-icon': APP_SIDEBAR_WIDTH_ICON,
    ...style
  }
  
  const contextValue: DualSidebarContextProps = {
    // State
    appSidebarVisible,
    appSidebarExpanded,
    isTransitioning,
    isMobile,
    mobileSheetOpen,
    setMobileSheetOpen,
    
    // Actions
    toggleAppSidebar,
    setAppSidebarExpanded: setAppSidebarExpandedAction,
    
    // CSS
    cssVariables
  }
  
  // Debug logging
  if (import.meta.env.DEV) {
    console.log('[DualSidebarProvider] Context state:', {
      appSidebarVisible,
      appSidebarExpanded,
      isTransitioning,
      isMobile
    })
  }
  
  return (
    <DualSidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          className={`dual-sidebar-wrapper flex min-h-svh w-full ${className || ''}`}
          style={cssVariables}
          data-app-sidebar-visible={appSidebarVisible}
          data-app-sidebar-expanded={appSidebarExpanded}
          data-transitioning={isTransitioning}
          data-mobile={isMobile}
        >
          {children}
        </div>
      </TooltipProvider>
    </DualSidebarContext.Provider>
  )
}

// Export constants for use in other components
export {
  GLOBAL_SIDEBAR_WIDTH,
  APP_SIDEBAR_WIDTH,
  APP_SIDEBAR_WIDTH_MOBILE,
  APP_SIDEBAR_WIDTH_ICON,
  KEYBOARD_SHORTCUT
}