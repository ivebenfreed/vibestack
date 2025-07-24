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
import { useLocation } from '@tanstack/react-router'
import { useSidebarNavigation, useSidebarNavigationStats } from '@/stores/sidebarNavigationStore'
import { Database, RefreshCw, Activity, Zap, Table, Grid3X3, TestTube } from 'lucide-react'

// ⚡ PERFORMANCE: Lightweight debug sidebar content with static navigation
const DebugSidebarContent = React.memo(function DebugSidebarContent() {
  // Static debug navigation - no expensive hooks
  const debugNavGroups = [
    {
      title: "Development",
      items: [
        { title: "Database", url: "/debug/database", icon: Database },
        { title: "Sync Status", url: "/debug/sync", icon: RefreshCw },
        { title: "Live Query", url: "/debug/live-query", icon: Activity },
        { title: "Performance", url: "/debug/performance", icon: Zap },
      ]
    },
    {
      title: "Data Tables",
      items: [
        { title: "VibeGrid Native", url: "/debug/vibegrid-native", icon: Grid3X3 },
      ]
    },
    {
      title: "Testing",
      items: [
        { title: "Multi-Query", url: "/debug/multi-query", icon: Database },
        { title: "TypeORM Test", url: "/debug/typeorm-test", icon: Database },
      ]
    }
  ]
  
  return (
    <>
      {debugNavGroups.map((group, index) => (
        <NavGroup key={`${group.title}-${index}`} {...group} />
      ))}
    </>
  )
})

// ⚡ PERFORMANCE: Lazy-loaded sidebar content component for projects/settings (expensive hooks)
const SidebarContentLazy = React.memo(function SidebarContentLazy({ activeSection }: { activeSection: string }) {
  // Only run expensive hooks when content is actually rendered
  const navigation = useSidebarNavigation()
  const stats = useSidebarNavigationStats(navigation)
  const navGroups = navigation.sections[activeSection] || []
  
  // Debug logging removed - navigation is working correctly
  if (import.meta.env.DEV && Math.random() < 0.001) {
    console.log('[AppSidebar] Render cycle:', {
      activeSection,
      projectsCount: stats.projectsCount,
      navGroupsCount: navGroups.length,
      totalNavItems: stats.totalNavItems
    })
  }
  
  return (
    <>
      {navGroups.map((group, index) => (
        <NavGroup key={`${group.title}-${index}`} {...group} />
      ))}
    </>
  )
})

// 🎯 PERFORMANCE: Memoize the expensive sidebar component with React.memo comparison
const AppSidebarInternal = React.memo(function AppSidebarInternal({ collapsible = 'icon', variant = 'floating', ...props }: React.ComponentProps<typeof Sidebar>) {
  // Use Shadcn's sidebar state directly (no competing state)
  const { state } = useSidebar()
  const location = useLocation()
  
  // ⚡ PERFORMANCE: Direct route-based section detection (no layout store)
  const activeSection = React.useMemo(() => {
    if (location.pathname.startsWith('/projects') || location.pathname === '/tasks') {
      return 'projects'
    } else if (location.pathname.startsWith('/settings')) {
      return 'settings'
    } else if (location.pathname.startsWith('/debug')) {
      return 'debug'
    } else {
      return 'home'
    }
  }, [location.pathname])
  
  // Derive isCollapsed from Shadcn's state
  const isCollapsed = state === 'collapsed'
  
  // ⚡ PERFORMANCE: Different content strategies for different sections
  const shouldShowExpensiveContent = activeSection === 'projects' || activeSection === 'settings'
  const shouldShowDebugContent = activeSection === 'debug'

  return (
    <Sidebar collapsible={collapsible} variant={variant} {...props}>
      <SidebarHeader>
        <AppLogoHeader isCollapsed={isCollapsed} />
      </SidebarHeader>
      <SidebarContent>
        {shouldShowExpensiveContent && <SidebarContentLazy activeSection={activeSection} />}
        {shouldShowDebugContent && <DebugSidebarContent />}
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
