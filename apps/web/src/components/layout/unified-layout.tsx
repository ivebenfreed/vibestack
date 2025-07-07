/**
 * Unified Layout - Clean, simple layout to replace the complex dual sidebar system
 * Simple CSS Grid: [sidebar] [main-content]
 */

import * as React from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { UnifiedSidebar } from './unified-sidebar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import SyncStatusIcon from '@/features/sync/components/SyncStatusIcon'
import { RotateCcw, Menu, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'

interface UnifiedLayoutProps {
  children?: React.ReactNode
}

// PWA-aware refresh button component
const RefreshButton = () => {
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  
  const handleRefresh = async () => {
    setIsRefreshing(true)
    
    try {
      // Handle PWA service worker and cache clearing
      if ('serviceWorker' in navigator) {
        // Get all service worker registrations
        const registrations = await navigator.serviceWorker.getRegistrations()
        
        for (const registration of registrations) {
          // Skip waiting to activate new service worker immediately
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
          
          // Force update to get latest service worker
          await registration.update()
        }
      }
      
      // Clear only non-essential caches to preserve auth state and routing
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        // Preserve caches that contain auth, session, or navigation data
        const cachesToDelete = cacheNames.filter(name => 
          !name.includes('auth') && 
          !name.includes('session') && 
          !name.includes('navigation-cache') &&
          !name.includes('runtime-navigation')
        )
        await Promise.all(
          cachesToDelete.map(cacheName => caches.delete(cacheName))
        )
      }
      
      // Navigate to root after refresh to avoid service worker redirect issues
      setTimeout(() => {
        // Remember current path to redirect back after refresh
        const currentPath = window.location.pathname + window.location.search
        const redirectParam = currentPath !== '/' ? `?redirectAfterRefresh=${encodeURIComponent(currentPath)}` : ''
        
        // Navigate to root with redirect parameter
        window.location.href = `/${redirectParam}`
      }, 300)
      
    } catch (error) {
      console.error('Failed to refresh:', error)
      // Fallback to navigate to root with current path
      const currentPath = window.location.pathname + window.location.search
      const redirectParam = currentPath !== '/' ? `?redirectAfterRefresh=${encodeURIComponent(currentPath)}` : ''
      window.location.href = `/${redirectParam}`
    }
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8"
          >
            <RotateCcw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span className="sr-only">Refresh Application</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refresh app & clear cache</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function UnifiedLayout({ children }: UnifiedLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false)
  const location = useLocation()
  const isMobile = useIsMobile()
  
  // Responsive behavior - auto-collapse on tablet screens
  React.useEffect(() => {
    const handleResize = () => {
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024
      if (isTablet) {
        setSidebarCollapsed(true)
      }
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])
  
  // Pages that need full height content area
  const fullHeightPages = ['/tasks']
  const isFullHeight = fullHeightPages.some(page => location.pathname.startsWith(page))
  
  // Get page title based on route
  const getPageTitle = () => {
    if (location.pathname === '/') return 'Dashboard'
    if (location.pathname.startsWith('/projects')) return 'Projects'
    if (location.pathname.startsWith('/tasks')) return 'Tasks'
    if (location.pathname.startsWith('/apps')) return 'Apps'
    if (location.pathname.startsWith('/chats')) return 'Chats'
    if (location.pathname.startsWith('/help-center')) return 'Help Center'
    if (location.pathname.startsWith('/settings')) return 'Settings'
    if (location.pathname.startsWith('/debug')) return 'Debug'
    return 'Dashboard'
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Mobile Layout */}
      {isMobile ? (
        <>
          {/* Mobile Sidebar as Sheet */}
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetContent side="left" className="p-0 w-[300px]">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>
              <UnifiedSidebar 
                isCollapsed={false}
                onToggle={() => setMobileSidebarOpen(false)}
              />
            </SheetContent>
          </Sheet>
          
          {/* Mobile Main Content */}
          <main className="flex flex-col h-full overflow-hidden">
            {/* Mobile Header */}
            <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
              <div className="flex h-14 items-center gap-3 px-4">
                {/* Mobile Menu button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="p-2 shrink-0"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
                
                <div className="flex-1 flex justify-center min-w-0">
                  <Search />
                </div>
                
                {/* Right side buttons - compact on mobile */}
                <div className="flex items-center gap-0">
                  <ThemeSwitch />
                  <ProfileDropdown />
                </div>
              </div>
            </header>
            
            {/* Mobile Content Area */}
            <div className={cn(
              "flex-1 overflow-auto",
              isFullHeight ? "p-0" : "p-4"
            )}>
              <div className={cn(
                "w-full",
                isFullHeight && "h-full p-4 flex flex-col"
              )}>
                {children || <Outlet />}
              </div>
            </div>
          </main>
        </>
      ) : (
        // Desktop Layout
        <div 
          className={cn(
            "grid h-screen transition-all duration-200",
            sidebarCollapsed 
              ? "grid-cols-[64px_1fr]" 
              : "grid-cols-[240px_1fr]"
          )}
        >
          {/* Desktop Sidebar */}
          <UnifiedSidebar 
            isCollapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          
          {/* Desktop Main Content */}
          <main className="flex flex-col overflow-hidden">
            {/* Desktop Header */}
            <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
              <div className="flex h-14 items-center gap-3 px-6 sm:gap-4">
                {/* Toggle button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="p-2"
                      >
                        {sidebarCollapsed ? (
                          <Menu className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        <span className="sr-only">Toggle sidebar</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <Separator orientation='vertical' className='h-6' />
                
                <div className="flex-1 flex justify-center">
                  <Search />
                </div>
                
                {/* Right side buttons */}
                <div className="flex items-center gap-1">
                  <RefreshButton />
                  <ThemeSwitch />
                  <SyncStatusIcon />
                  <ProfileDropdown />
                </div>
              </div>
            </header>
            
            {/* Desktop Content Area */}
            <div className={cn(
              "flex-1 overflow-auto",
              isFullHeight ? "p-0" : "p-6"
            )}>
              <div className={cn(
                "w-full",
                isFullHeight && "h-full p-6 flex flex-col"
              )}>
                {children || <Outlet />}
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  )
}