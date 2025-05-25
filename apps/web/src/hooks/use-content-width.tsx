import * as React from 'react'
import { useIsMobile } from './use-mobile'
import { useGlobalSidebar } from '@/contexts/global-sidebar-context'
// import { useSidebar } from '@/components/ui/sidebar' // Replaced with direct context usage
import { SidebarContext } from '@/components/ui/sidebar' // Import context directly
import { GLOBAL_SIDEBAR_WIDTH } from '@/components/layout/global-sidebar'

// Constants from sidebar.tsx
const SIDEBAR_WIDTH = 256 // 16rem in pixels (16 * 16)
const SIDEBAR_WIDTH_ICON = 48 // 3rem in pixels (3 * 16)

export interface ContentWidthInfo {
  /** Available content width in pixels */
  contentWidth: number
  /** Global sidebar width in pixels (0 on mobile) */
  globalSidebarWidth: number
  /** Main sidebar width in pixels (0 when hidden or on mobile) */
  mainSidebarWidth: number
  /** Whether the main sidebar is visible */
  hasMainSidebar: boolean
  /** Whether we're on mobile */
  isMobile: boolean
  /** CSS custom properties to apply to container */
  cssVars: React.CSSProperties & { [key: `--${string}`]: string }
  /** Tailwind classes for responsive content width */
  contentWidthClasses: string
  /** Left margin to account for sidebars */
  leftMargin: number
}

/**
 * Hook that calculates robust content width based on all sidebar states
 * 
 * @param options Configuration options
 * @returns ContentWidthInfo object with calculated dimensions and utilities
 */
export function useContentWidth(options: {
  /** Include padding in calculations (default: true) */
  includePadding?: boolean
  /** Custom viewport width override for testing */
  viewportWidth?: number
} = {}): ContentWidthInfo {
  const { includePadding = true, viewportWidth } = options
  
  const isMobile = useIsMobile()
  const { shouldShowMainSidebar } = useGlobalSidebar()
  // const { state: sidebarState } = useSidebar() // Replaced
  const sidebarContext = React.useContext(SidebarContext)
  const sidebarState = sidebarContext?.state ?? 'collapsed' // Default to 'collapsed' if no provider

  // Get current viewport width
  const [currentViewportWidth, setCurrentViewportWidth] = React.useState(
    viewportWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024)
  )
  
  // Add debounced state for sidebar changes to smooth out rapid transitions
  const [debouncedSidebarState, setDebouncedSidebarState] = React.useState(sidebarState)
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSidebarState(sidebarState)
    }, 50) // Small delay to let CSS transitions start
    
    return () => clearTimeout(timer)
  }, [sidebarState])
  
  React.useEffect(() => {
    if (viewportWidth) return // Don't update if overridden
    
    const updateWidth = () => setCurrentViewportWidth(window.innerWidth)
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [viewportWidth])
  
  const hasMainSidebar = shouldShowMainSidebar()
  const isMainSidebarExpanded = debouncedSidebarState === 'expanded' // Use debounced state
  
  const calculations = React.useMemo(() => {
    // Global sidebar: always present on desktop, hidden on mobile
    const globalSidebarWidth = isMobile ? 0 : GLOBAL_SIDEBAR_WIDTH
    
    // Main sidebar: depends on visibility and state
    let mainSidebarWidth = 0
    if (!isMobile && hasMainSidebar) {
      mainSidebarWidth = isMainSidebarExpanded ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_ICON
    }
    
    // Calculate left margin (for positioning)
    const leftMargin = globalSidebarWidth + mainSidebarWidth
    
    // Calculate content width
    const padding = includePadding ? 32 : 0 // Account for typical container padding
    const contentWidth = currentViewportWidth - leftMargin - padding
    
    // CSS custom properties
    const cssVars = {
      '--global-sidebar-width': `${globalSidebarWidth}px`,
      '--main-sidebar-width': `${mainSidebarWidth}px`,
      '--content-width': `${contentWidth}px`,
      '--left-margin': `${leftMargin}px`,
    } as React.CSSProperties & { [key: `--${string}`]: string }
    
    // Generate Tailwind classes for responsive content width
    const contentWidthClasses = [
      // Mobile: full width
      'w-full',
      // Desktop: calculated width based on sidebar states
      !hasMainSidebar 
        ? 'md:w-[calc(100vw-var(--global-sidebar-width))]'
        : isMainSidebarExpanded
          ? 'md:w-[calc(100vw-var(--global-sidebar-width)-var(--sidebar-width))]'
          : 'md:w-[calc(100vw-var(--global-sidebar-width)-var(--sidebar-width-icon))]',
      // Smooth transitions
      'transition-[width]',
      'duration-200',
      'ease-linear'
    ].filter(Boolean).join(' ')
    
    return {
      contentWidth: Math.max(0, contentWidth),
      globalSidebarWidth,
      mainSidebarWidth,
      hasMainSidebar,
      isMobile,
      cssVars,
      contentWidthClasses,
      leftMargin
    }
  }, [
    isMobile,
    hasMainSidebar,
    isMainSidebarExpanded,
    currentViewportWidth,
    includePadding
  ])
  
  return calculations
}

/**
 * Hook that provides just the content width classes for easy use in components
 */
export function useContentWidthClasses(options?: Parameters<typeof useContentWidth>[0]): string {
  const { contentWidthClasses } = useContentWidth(options)
  return contentWidthClasses
}

/**
 * Hook that provides CSS variables for content width calculations
 */
export function useContentWidthVars(options?: Parameters<typeof useContentWidth>[0]): React.CSSProperties & { [key: `--${string}`]: string } {
  const { cssVars } = useContentWidth(options)
  return cssVars
} 