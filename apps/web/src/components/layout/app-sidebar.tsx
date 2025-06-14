import React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { NavGroup } from '@/components/layout/nav-group'
import { AppLogoHeader } from './app-logo-header'
import { useLayoutStore } from '@/stores/layoutStore'
import { useSidebarNavigation, useSidebarNavigationStats } from '@/stores/sidebarNavigationStore'

// 🎯 PERFORMANCE: Memoize the expensive sidebar component with React.memo comparison
const AppSidebarInternal = React.memo(function AppSidebarInternal({ collapsible = 'icon', variant = 'floating', ...props }: React.ComponentProps<typeof Sidebar>) {
  // Use Shadcn's sidebar state directly (no competing state)
  const { state } = useSidebar()
  
  // Use layout store for section data only - ONLY use activeSection for content
  // This prevents content from changing before route navigation completes
  const activeSection = useLayoutStore.activeSection()
  
  // Derive isCollapsed from Shadcn's state
  const isCollapsed = state === 'collapsed'
  
  // 🎯 PERFORMANCE: Get pre-computed navigation from XState hooks
  const navigation = useSidebarNavigation()
  const navGroups = navigation.sections[activeSection] || []
  
  // 🎯 PERFORMANCE: Optional stats for debugging (pass navigation to avoid double computation)
  const stats = useSidebarNavigationStats(navigation)
  

  
  // Debug logging removed - navigation is working correctly
  
  // Only log in dev mode and reduce frequency for cleaner logs
  if (import.meta.env.DEV && Math.random() < 0.001) { // Reduced to 0.1% for navigation performance
    console.log('[AppSidebar] Render cycle:', {
      sidebarState: state,
      isCollapsed,
      activeSection,
      collapsible,
      projectsCount: stats.projectsCount,
      navGroupsCount: navGroups.length,
      totalNavItems: stats.totalNavItems
    })
  }

  return (
    <Sidebar collapsible={collapsible} variant={variant} {...props}>
      <SidebarHeader>
        <AppLogoHeader isCollapsed={isCollapsed} />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group, index) => (
          <NavGroup key={`${group.title}-${index}`} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {/* Footer content goes here */}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return prevProps.collapsible === nextProps.collapsible && 
         prevProps.variant === nextProps.variant
})

// 🎯 PERFORMANCE: Export the memoized component
export { AppSidebarInternal as AppSidebar }
