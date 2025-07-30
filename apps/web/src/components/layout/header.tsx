import React from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger, SidebarContext } from '@/components/ui/sidebar'
import { Search } from '@/components/search'
import SyncStatusIcon from '../../features/sync/components/SyncStatusIcon'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { useLocation } from '@tanstack/react-router'
import { GLOBAL_SIDEBAR_WIDTH } from './global-sidebar'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const HEADER_HEIGHT = 64 // pixels

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  fixed?: boolean
  ref?: React.Ref<HTMLElement>
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
      
      // Clear all caches to ensure fresh content
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
      }
      
      // Give a moment for cache clearing, then hard reload
      setTimeout(() => {
        // Force reload bypassing cache
        window.location.reload()
      }, 300)
      
    } catch (error) {
      console.error('Error during PWA refresh:', error)
      // Fallback to simple reload if PWA refresh fails
      setTimeout(() => {
        window.location.reload()
      }, 200)
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
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refresh App</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export const Header = ({
  className,
  fixed,
  children,
  ...props
}: HeaderProps) => {
  const [offset, setOffset] = React.useState(0)
  const location = useLocation()
  
  // ⚡ PERFORMANCE: Direct route-based sidebar trigger detection
  const shouldShowSidebarTrigger = React.useMemo(() => {
    // Show trigger for routes that have sidebars (projects/settings/debug)
    return location.pathname.startsWith('/projects') || 
           location.pathname === '/tasks' || 
           location.pathname.startsWith('/settings') ||
           location.pathname.startsWith('/debug')
  }, [location.pathname])
  
  // Check if we're within a SidebarProvider context
  const sidebarContext = React.useContext(SidebarContext)
  const hasSidebarContext = !!sidebarContext
  
  // Final trigger visibility
  const showSidebarTrigger = shouldShowSidebarTrigger && hasSidebarContext

  React.useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop)
    }

    // Add scroll listener to the body
    document.addEventListener('scroll', onScroll, { passive: true })

    // Clean up the event listener on unmount
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'bg-background flex items-center gap-3 p-4 sm:gap-4',
        fixed && 'header-fixed peer/header fixed top-0 right-0 z-50',
        fixed && 'left-0 md:left-[var(--global-sidebar-width)]',
        offset > 10 && fixed ? 'shadow-sm' : 'shadow-none',
        className
      )}
      style={fixed ? { 
        height: 'var(--header-height)'
      } as React.CSSProperties : {
        height: 'var(--header-height)'
      }}
      {...props}
    >
      {showSidebarTrigger && (
        <>
          <SidebarTrigger 
            variant='outline' 
            className='scale-125 sm:scale-100' 
            data-testid="sidebar-toggle"
          />
          <Separator orientation='vertical' className='h-6' />
        </>
      )}
      {children}
      <div className='ml-auto flex items-center space-x-4'>
        <Search />
        <SyncStatusIcon />
        <RefreshButton />
        <ThemeSwitch />
        <ProfileDropdown data-testid="user-menu" />
      </div>
    </header>
  )
}

Header.displayName = 'Header'
