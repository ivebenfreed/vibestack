/**
 * AppSidebarV2 - Custom App Sidebar for Dual Sidebar Architecture
 * 
 * Replaces template-based Sidebar with custom implementation that:
 * - Integrates with DualSidebarProvider and layoutStoreV2
 * - Preserves exact design and functionality of original AppSidebar
 * - Handles mobile sheet behavior properly
 * - Maintains all performance optimizations
 * - Supports keyboard shortcuts and accessibility
 */

import React from 'react'
import { useLocation } from '@tanstack/react-router'
import { useDualSidebar } from './DualSidebarProvider'
import { useLayoutStoreV2 } from '@/stores/layoutStoreV2'
import { useSidebarNavigation, useSidebarNavigationStats } from '@/stores/sidebarNavigationStore'
import { Database, RefreshCw, Activity, Zap, Grid3X3 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { PanelLeftIcon } from 'lucide-react'
import { AppLogoHeader } from '../app-logo-header'
import { NavGroupV2 } from './NavGroupV2'

// ⚡ PERFORMANCE: Lightweight debug sidebar content with static navigation (copied from original)
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
        { title: "VibeGridFinal Tasks", url: "/debug/vibegridfinal-tasks", icon: Grid3X3 },
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
        <NavGroupV2 key={`${group.title}-${index}`} {...group} />
      ))}
    </>
  )
})

// ⚡ PERFORMANCE: Lazy-loaded sidebar content component for projects/settings (copied from original)
const SidebarContentLazy = React.memo(function SidebarContentLazy({ activeSection }: { activeSection: string }) {
  // Only run expensive hooks when content is actually rendered
  const navigation = useSidebarNavigation()
  const stats = useSidebarNavigationStats(navigation)
  const navGroups = navigation.sections[activeSection] || []
  
  
  return (
    <>
      {navGroups.map((group, index) => (
        <NavGroupV2 key={`${group.title}-${index}`} {...group} />
      ))}
    </>
  )
})

// Custom sidebar trigger button
function SidebarTrigger({ className }: { className?: string }) {
  const { toggleAppSidebar } = useDualSidebar()
  
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`size-7 ${className || ''}`}
      onClick={toggleAppSidebar}
      aria-label="Toggle Sidebar"
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

// Desktop sidebar component
function DesktopAppSidebar({ activeSection }: { activeSection: string }) {
  const { 
    appSidebarVisible, 
    appSidebarExpanded, 
    isTransitioning,
    toggleAppSidebar 
  } = useDualSidebar()
  
  if (!appSidebarVisible) {
    return null // Hidden by route
  }
  
  
  // ⚡ PERFORMANCE: Different content strategies for different sections (copied from original)
  const shouldShowExpensiveContent = activeSection === 'projects' || activeSection === 'settings'
  const shouldShowDebugContent = activeSection === 'debug'
  
  return (
    <div
      className="app-sidebar-desktop"
      data-expanded={appSidebarExpanded}
      data-transitioning={isTransitioning}
    >
      {/* Header */}
      <div className={appSidebarExpanded ? 'sidebar-header-expanded' : 'sidebar-header-collapsed'}>
        <AppLogoHeader isCollapsed={!appSidebarExpanded} />
      </div>
      
      {/* Content */}
      <div className={appSidebarExpanded ? 'sidebar-content-expanded' : 'sidebar-content-collapsed'}>
        {shouldShowExpensiveContent && <SidebarContentLazy activeSection={activeSection} />}
        {shouldShowDebugContent && <DebugSidebarContent />}
      </div>
      
      {/* Footer */}
      <div className="sidebar-footer">
        {/* Footer content goes here */}
      </div>
      
      {/* Rail for hover expansion */}
      <button
        className="sidebar-rail"
        onClick={toggleAppSidebar}
        aria-label="Toggle Sidebar"
        title="Toggle Sidebar"
      />
    </div>
  )
}

// Mobile sidebar component
function MobileAppSidebar({ activeSection }: { activeSection: string }) {
  const { 
    appSidebarVisible, 
    mobileSheetOpen, 
    setMobileSheetOpen 
  } = useDualSidebar()
  
  if (!appSidebarVisible) {
    return null // Hidden by route
  }
  
  // ⚡ PERFORMANCE: Different content strategies for different sections (copied from original)
  const shouldShowExpensiveContent = activeSection === 'projects' || activeSection === 'settings'
  const shouldShowDebugContent = activeSection === 'debug'
  
  return (
    <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
      <SheetContent
        side="left"
        className="bg-sidebar text-sidebar-foreground p-0 w-[var(--app-sidebar-width-mobile)]"
        style={{
          '--app-sidebar-width-mobile': 'var(--app-sidebar-width-mobile)'
        } as React.CSSProperties}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>App Sidebar</SheetTitle>
          <SheetDescription>Navigation and content for the current section</SheetDescription>
        </SheetHeader>
        
        <div className="flex h-full w-full flex-col">
          {/* Header */}
          <div className="flex h-14 items-center border-b border-sidebar-border p-2">
            <AppLogoHeader isCollapsed={false} />
          </div>
          
          {/* Content */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
            {shouldShowExpensiveContent && <SidebarContentLazy activeSection={activeSection} />}
            {shouldShowDebugContent && <DebugSidebarContent />}
          </div>
          
          {/* Footer */}
          <div className="flex flex-col gap-2 p-2">
            {/* Footer content goes here */}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Main AppSidebarV2 component
export const AppSidebarV2 = React.memo(function AppSidebarV2() {
  const location = useLocation()
  const { isMobile } = useDualSidebar()
  
  // ⚡ PERFORMANCE: Direct route-based section detection (copied from original)
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
  
  return (
    <>
      {/* Desktop Sidebar */}
      <DesktopAppSidebar activeSection={activeSection} />
      
      {/* Mobile Sidebar */}
      {isMobile && <MobileAppSidebar activeSection={activeSection} />}
    </>
  )
})

// Export sidebar trigger for use in headers/toolbars
export { SidebarTrigger }