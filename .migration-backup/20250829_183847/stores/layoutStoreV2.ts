/**
 * Enhanced Layout Store V2 - Dual Sidebar Architecture
 * 
 * Replaces cookie-based sidebar state with centralized XState Store management.
 * Designed specifically for dual sidebar architecture with proper route transitions.
 * 
 * Features:
 * - Route-driven app sidebar visibility
 * - Per-section user preferences
 * - Clean route transitions without animation artifacts
 * - Structured localStorage persistence (replaces cookies)
 * - Mobile responsive state management
 */

import { createStore } from '@xstate/store'
import { useSelector } from '@xstate/store/react'

// Section configuration - static data that doesn't change
export const sectionConfig = {
  home: { showSidebar: false, sidebarContent: 'none' },
  projects: { showSidebar: true, sidebarContent: 'projects' },
  settings: { showSidebar: true, sidebarContent: 'settings' },
  debug: { showSidebar: true, sidebarContent: 'debug' }
} as const

export type ActiveSection = keyof typeof sectionConfig

// Sidebar preferences for each section
export type SidebarPreferences = {
  [K in ActiveSection]: {
    expanded: boolean
  }
}

// App sidebar state
export interface AppSidebarState {
  visible: boolean        // Route-driven visibility
  expanded: boolean       // User preference within visible routes
  isTransitioning: boolean // Animation control flag
}

// Enhanced layout store context
export interface LayoutStoreContext {
  // Section management (keep existing)
  activeSection: ActiveSection
  
  // App sidebar state (new)
  appSidebar: AppSidebarState
  
  // Per-section preferences (replace cookies)
  sidebarPreferences: SidebarPreferences
  
  // Mobile state (simplified)
  isMobile: boolean
}

// Storage key for preferences persistence
const SIDEBAR_PREFERENCES_KEY = 'vibestack_sidebar_preferences'

// Default preferences - start expanded for better UX
const defaultSidebarPreferences: SidebarPreferences = {
  home: { expanded: false },     // Not used since home has no sidebar
  projects: { expanded: true },  // Start expanded for better UX
  settings: { expanded: true },  // Start expanded for better UX
  debug: { expanded: true }      // Start expanded for better UX
}

// Load preferences from localStorage
function loadSidebarPreferences(): SidebarPreferences {
  if (typeof window === 'undefined') {
    return defaultSidebarPreferences
  }
  
  try {
    const stored = localStorage.getItem(SIDEBAR_PREFERENCES_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults to ensure all sections exist
      return { ...defaultSidebarPreferences, ...parsed }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[LayoutStoreV2] Failed to load sidebar preferences:', error)
    }
  }
  
  return defaultSidebarPreferences
}

// Save preferences to localStorage
function saveSidebarPreferences(preferences: SidebarPreferences): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(SIDEBAR_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[LayoutStoreV2] Failed to save sidebar preferences:', error)
    }
  }
}

// Determine if mobile based on window width
function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}

// Create enhanced layout store
export const layoutStoreV2 = createStore({
  context: {
    activeSection: 'home' as ActiveSection,
    appSidebar: {
      visible: false,
      expanded: true, // Default to expanded for better UX
      isTransitioning: false
    },
    sidebarPreferences: loadSidebarPreferences(),
    isMobile: getIsMobile()
  },
  
  on: {
    // Route-driven section change with atomic sidebar state updates
    transitionToSection: (context, event: { section: ActiveSection }) => {
      const { section } = event
      const shouldShow = sectionConfig[section].showSidebar
      const userPreference = context.sidebarPreferences[section]?.expanded ?? false
      const wasVisible = context.appSidebar.visible
      const isBecomingVisible = !wasVisible && shouldShow
      
      if (import.meta.env.DEV) {
        console.log('[LayoutStoreV2] Transitioning to section:', {
          section,
          shouldShow,
          userPreference,
          isBecomingVisible
        })
      }
      
      return {
        ...context,
        activeSection: section,
        appSidebar: {
          visible: shouldShow,
          // Keep current expanded state when transitioning between visible routes
          // Only reset to false when not showing at all
          expanded: shouldShow ? context.appSidebar.expanded : false,
          // Don't mark as transitioning - this was blocking sidebar display
          isTransitioning: false
        }
      }
    },
    
    // User toggle within visible routes
    setSidebarExpanded: (context, event: { expanded: boolean }) => {
      const { expanded } = event
      const { activeSection } = context
      
      if (!context.appSidebar.visible) {
        if (import.meta.env.DEV) {
          console.warn('[LayoutStoreV2] Attempted to toggle sidebar when not visible')
        }
        return context
      }
      
      if (import.meta.env.DEV) {
        console.log('[LayoutStoreV2] Setting sidebar expanded:', expanded)
      }
      
      // Update preferences and save to localStorage
      const newPreferences = {
        ...context.sidebarPreferences,
        [activeSection]: { expanded }
      }
      
      saveSidebarPreferences(newPreferences)
      
      return {
        ...context,
        appSidebar: {
          ...context.appSidebar,
          expanded
        },
        sidebarPreferences: newPreferences
      }
    },
    
    // Clear transitioning flag after DOM updates
    clearTransitioning: (context) => {
      if (import.meta.env.DEV) {
        console.log('[LayoutStoreV2] Clearing transitioning flag')
      }
      
      return {
        ...context,
        appSidebar: {
          ...context.appSidebar,
          isTransitioning: false
        }
      }
    },
    
    // Update mobile state on resize
    setMobile: (context, event: { isMobile: boolean }) => {
      const { isMobile } = event
      
      if (context.isMobile === isMobile) {
        return context
      }
      
      if (import.meta.env.DEV) {
        console.log('[LayoutStoreV2] Mobile state changed:', isMobile)
      }
      
      return {
        ...context,
        isMobile
      }
    },
    
    // Route-based section detection (for router integration)
    updateSectionFromRoute: (context, event: { pathname: string }) => {
      const { pathname } = event
      let newSection: ActiveSection = 'home'
      
      // Determine section from route
      if (pathname.startsWith('/projects') || pathname === '/tasks') {
        newSection = 'projects'
      } else if (pathname.startsWith('/settings') || pathname.startsWith('/help-center')) {
        newSection = 'settings'
      } else if (pathname.startsWith('/debug')) {
        newSection = 'debug'
      } else {
        newSection = 'home'
      }
      
      // If section changed, apply transition logic inline
      if (context.activeSection !== newSection) {
        const shouldShow = sectionConfig[newSection].showSidebar
        const wasVisible = context.appSidebar.visible
        const userPreference = context.sidebarPreferences[newSection]?.expanded ?? false
        const isBecomingVisible = !wasVisible && shouldShow
        
        if (import.meta.env.DEV) {
          console.log('[LayoutStoreV2] Section change detected:', {
            pathname,
            from: context.activeSection,
            to: newSection,
            shouldShow,
            wasVisible,
            isBecomingVisible
          })
        }
        
        // Log transition for debugging
        if (import.meta.env.DEV) {
          console.log('[LayoutStoreV2] Route transition:', {
            from: context.activeSection,
            to: newSection,
            wasVisible,
            willBeVisible: shouldShow,
            isTransitioning: isBecomingVisible,
            expanded: shouldShow ? (isBecomingVisible ? userPreference : context.appSidebar.expanded) : false
          })
        }
        
        return {
          ...context,
          activeSection: newSection,
          appSidebar: {
            visible: shouldShow,
            // Preserve current expanded state when moving between routes that show sidebar
            // Only use preference if sidebar wasn't visible before (first time showing)
            expanded: shouldShow ? (isBecomingVisible ? userPreference : context.appSidebar.expanded) : false,
            isTransitioning: false
          }
        }
      }
      
      return context
    }
  }
})

// ============================================================================
// React Hooks (XState Store API)
// ============================================================================

export const useLayoutStoreV2 = {
  // Core selectors
  activeSection: () => useSelector(layoutStoreV2, (state) => state.context.activeSection),
  appSidebar: () => useSelector(layoutStoreV2, (state) => state.context.appSidebar),
  sidebarPreferences: () => useSelector(layoutStoreV2, (state) => state.context.sidebarPreferences),
  isMobile: () => useSelector(layoutStoreV2, (state) => state.context.isMobile),
  
  // Convenience selectors
  sidebarVisible: () => useSelector(layoutStoreV2, (state) => state.context.appSidebar?.visible ?? false),
  sidebarExpanded: () => useSelector(layoutStoreV2, (state) => state.context.appSidebar?.expanded ?? false),
  isTransitioning: () => useSelector(layoutStoreV2, (state) => state.context.appSidebar?.isTransitioning ?? false),
  
  // Get all state at once
  getState: () => layoutStoreV2.getSnapshot().context,
  
  // Actions
  transitionToSection: (section: ActiveSection) => 
    layoutStoreV2.trigger.transitionToSection({ section }),
  setSidebarExpanded: (expanded: boolean) => 
    layoutStoreV2.trigger.setSidebarExpanded({ expanded }),
  clearTransitioning: () => 
    layoutStoreV2.trigger.clearTransitioning(),
  setMobile: (isMobile: boolean) => 
    layoutStoreV2.trigger.setMobile({ isMobile }),
  updateSectionFromRoute: (pathname: string) => 
    layoutStoreV2.trigger.updateSectionFromRoute({ pathname }),
  
  // Toggle helper
  toggleSidebar: () => {
    const state = layoutStoreV2.getSnapshot().context
    if (state.appSidebar.visible) {
      layoutStoreV2.trigger.setSidebarExpanded({ expanded: !state.appSidebar.expanded })
    }
  },
  
  // Initialize mobile detection with cleanup
  initializeMobileDetection: () => {
    const updateMobile = () => {
      const isMobile = getIsMobile()
      layoutStoreV2.trigger.setMobile({ isMobile })
    }
    
    // Set initial value
    updateMobile()
    
    // Add resize listener
    window.addEventListener('resize', updateMobile)
    
    // Return cleanup function
    return () => {
      window.removeEventListener('resize', updateMobile)
    }
  },
  
  // Clear transitioning after timeout (for route transitions)
  scheduleTransitioningClear: (delay: number = 100) => {
    setTimeout(() => {
      layoutStoreV2.trigger.clearTransitioning()
    }, delay)
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

// Determine if sidebar should be shown for a section
export const shouldShowSidebarForSection = (section: ActiveSection): boolean => {
  return sectionConfig[section]?.showSidebar ?? false
}

// Get section configuration
export const getSectionConfig = (section: ActiveSection) => {
  return sectionConfig[section] || sectionConfig.home
}

// Check if section has sidebar content
export const sectionHasSidebar = (section: ActiveSection): boolean => {
  return sectionConfig[section]?.showSidebar ?? false
}

// Get current sidebar preference for section
export const getSidebarPreference = (section: ActiveSection): boolean => {
  const state = layoutStoreV2.getSnapshot().context
  return state.sidebarPreferences[section]?.expanded ?? false
}

// Migration helper to clean up old cookie state
export const cleanupLegacyCookieState = () => {
  if (typeof document !== 'undefined') {
    // Remove the old sidebar_state cookie
    document.cookie = 'sidebar_state=; path=/; max-age=0'
  }
}

// sectionConfig and ActiveSection are already exported above at line 19 and 26