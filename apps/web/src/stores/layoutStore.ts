import { createStore } from '@xstate/store'
import { useSelector } from '@xstate/store/react'

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Section configuration - static data that doesn't change
export const sectionConfig = {
  home: { showSidebar: false, sidebarContent: 'none' },
  projects: { showSidebar: true, sidebarContent: 'projects' },
  settings: { showSidebar: true, sidebarContent: 'settings' },
  debug: { showSidebar: true, sidebarContent: 'debug' }
} as const

export type ActiveSection = keyof typeof sectionConfig

// 🎯 PERFORMANCE: Cache sidebar state to avoid expensive DOM queries
let sidebarStateCache: { isCollapsed: boolean, lastCheck: number } | null = null
const SIDEBAR_CACHE_TTL = 10000 // Increased cache TTL to 10 seconds to reduce DOM queries during navigation

// XState Store for layout management
export const layoutStore = createStore({
  // Initial context
  context: {
    activeSection: 'home' as ActiveSection,
    pendingSection: null as ActiveSection | null,
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    layoutChangeId: 0,
  },
  
  // Transitions/Events  
  on: {
    setActiveSection: (context, event: { section: ActiveSection }) => {
      if (context.activeSection !== event.section) {
        if (import.meta.env.DEV) {
          console.log('[LayoutStore] Setting active section:', event.section)
        }
        return {
          ...context,
          activeSection: event.section,
          pendingSection: null
        }
      }
      return context
    },
    
    setPendingSection: (context, event: { section: ActiveSection }) => {
      // Skip if already pending this section or it's already active
      if (context.pendingSection === event.section || context.activeSection === event.section) {
        return context
      }
      
      if (import.meta.env.DEV) {
        console.log('[LayoutStore] Setting pending section for immediate animation:', event.section)
      }
      return {
        ...context,
        pendingSection: event.section
      }
    },
    
    clearPendingSection: (context) => ({
      ...context,
      pendingSection: null
    }),
    
    updateSectionFromRoute: (context, event: { pathname: string }) => {
      let newSection: ActiveSection = 'home'
      const { pathname } = event
      
      // Determine which global section should be active based on the current route
      if (pathname.startsWith('/projects') || pathname === '/tasks') {
        newSection = 'projects'
      } else if (pathname.startsWith('/settings') || pathname.startsWith('/help-center')) {
        newSection = 'settings'
      } else if (pathname.startsWith('/debug') || pathname.startsWith('/sign-') || pathname.startsWith('/forgot-') || pathname.startsWith('/otp') || pathname.match(/^\/(401|403|404|500|503)$/)) {
        newSection = 'debug'
      } else {
        newSection = 'home'
      }
      
      // Skip update if already correct
      if (context.activeSection === newSection && !context.pendingSection) {
        return context
      }
      
      // If we have a pending section and it matches the route, confirm it
      if (context.pendingSection === newSection) {
        if (import.meta.env.DEV) {
          console.log('[LayoutStore] Route confirmed pending section:', newSection)
        }
        return {
          ...context,
          activeSection: newSection,
          pendingSection: null
        }
      } else if (context.activeSection !== newSection) {
        if (import.meta.env.DEV) {
          console.log('[LayoutStore] Route changed, updating section:', pathname, '->', newSection)
        }
        return {
          ...context,
          activeSection: newSection,
          pendingSection: null
        }
      }
      
      return context
    },
    
    triggerLayoutChange: (context) => {
      const windowWidth = window.innerWidth
      const isMobile = windowWidth < 768
      // 🎯 SIMPLIFIED: Since we're using pure CSS transitions, we don't need expensive calculations
      const simpleContentWidth = isMobile ? windowWidth : windowWidth - 64 // Just account for global sidebar
      
      return {
        ...context,
        layoutChangeId: context.layoutChangeId + 1,
        viewportWidth: simpleContentWidth,
        isMobile
      }
    }
  }
})

// ============================================================================
// React Hooks (XState Store API)
// ============================================================================

export const useLayoutStore = {
  // Selectors
  activeSection: () => useSelector(layoutStore, (state) => state.context.activeSection),
  pendingSection: () => useSelector(layoutStore, (state) => state.context.pendingSection),
  viewportWidth: () => useSelector(layoutStore, (state) => state.context.viewportWidth),
  isMobile: () => useSelector(layoutStore, (state) => state.context.isMobile),
  layoutChangeId: () => useSelector(layoutStore, (state) => state.context.layoutChangeId),
  
  // Get all state at once (equivalent to old Zustand usage)
  getState: () => layoutStore.getSnapshot().context,
  
  // Actions using the trigger API (fluent API)
  setActiveSection: (section: ActiveSection) => 
    layoutStore.trigger.setActiveSection({ section }),
  setPendingSection: (section: ActiveSection) => 
    layoutStore.trigger.setPendingSection({ section }),
  clearPendingSection: () => 
    layoutStore.trigger.clearPendingSection(),
  updateSectionFromRoute: (pathname: string) => 
    layoutStore.trigger.updateSectionFromRoute({ pathname }),
  triggerLayoutChange: () => 
    layoutStore.trigger.triggerLayoutChange(),
  
  // Initialize viewport with cleanup
  initializeViewport: () => {
    const updateViewport = debounce(() => {
      layoutStore.trigger.triggerLayoutChange()
    }, 100) // Quick response for smooth window resizing
    
    // Set initial values
    updateViewport()
    
    // Add resize listener
    window.addEventListener('resize', updateViewport)
    
    // Watch for sidebar state changes using MutationObserver
    let sidebarObserver: MutationObserver | null = null
    
    // 🎯 SMOOTH TRANSITIONS: Minimal debounce to update content width right after sidebar transition
    const debouncedSidebarUpdate = debounce(() => {
      // Invalidate cache so next layout calculation gets fresh state
      sidebarStateCache = null
      layoutStore.trigger.triggerLayoutChange()
    }, 50) // Minimal delay - just enough to batch rapid mutations but fast enough for smooth transitions
    
    const setupSidebarObserver = () => {
      // 🎯 DISABLED: Let SidebarInset handle transitions natively with CSS
      // No need to observe sidebar state changes when using pure CSS approach
      if (import.meta.env.DEV) {
        console.log('[LayoutStore] Sidebar observer disabled - using native CSS transitions')
      }
    }
    
    // Setup observer immediately and also after a delay (in case DOM isn't ready)
    setupSidebarObserver()
    setTimeout(setupSidebarObserver, 1000)
    
    // Return cleanup function
    return () => {
      window.removeEventListener('resize', updateViewport)
      // No sidebar observer to clean up - using native CSS transitions
    }
  },
}

// Helper function to determine if sidebar should be shown for a section
// Now supports pending section for immediate animations
export const shouldShowSidebarForSection = (section: ActiveSection): boolean => {
  return sectionConfig[section]?.showSidebar ?? true
}

// Helper functions (maintain backward compatibility)
export const getEffectiveSection = (): ActiveSection => {
  const state = layoutStore.getSnapshot().context
  return state.pendingSection || state.activeSection
}

export const getSectionConfig = (section: ActiveSection) => {
  return sectionConfig[section] || sectionConfig.home
}

export const useContentWidth = () => {
  return useSelector(layoutStore, (state) => state.context.viewportWidth)
} 