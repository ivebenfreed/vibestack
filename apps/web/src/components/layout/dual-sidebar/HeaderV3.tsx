/**
 * HeaderV3 - Custom Header for Dual Sidebar Architecture
 * 
 * Custom header that works with DualSidebarProvider instead of template SidebarProvider.
 * Includes toggle button for app sidebar when on sidebar-visible routes.
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Search } from '@/components/search'
import SyncStatusIcon from '@/features/sync/components/SyncStatusIcon'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { useLocation } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { RotateCcw, PanelLeftIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDualSidebar } from './DualSidebarProvider'

export const HEADER_HEIGHT = 64 // pixels

interface HeaderV3Props extends React.HTMLAttributes<HTMLElement> {
  fixed?: boolean
  ref?: React.Ref<HTMLElement>
}

// PWA-aware refresh button component (copied from original)
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
      console.error('Failed to refresh:', error)
      // Fallback to simple reload
      window.location.reload()
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

// Custom sidebar trigger button for V3
const SidebarTriggerV3 = () => {
  const { toggleAppSidebar } = useDualSidebar()
  
  if (import.meta.env.DEV) {
    console.log('[SidebarTriggerV3] Rendering trigger button')
  }
  
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => {
        console.log('[SidebarTriggerV3] Button clicked!')
        toggleAppSidebar()
      }}
      className="h-8 w-8"
    >
      <PanelLeftIcon className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

export const HeaderV3 = ({
  className,
  fixed,
  children,
  ...props
}: HeaderV3Props) => {
  const [offset, setOffset] = React.useState(0)
  const location = useLocation()
  const { appSidebarVisible } = useDualSidebar()
  
  // ⚡ PERFORMANCE: Direct route-based sidebar trigger detection
  const shouldShowSidebarTrigger = React.useMemo(() => {
    // Show trigger for routes that have sidebars (projects/settings/debug)
    return location.pathname.startsWith('/projects') || 
           location.pathname === '/tasks' || 
           location.pathname.startsWith('/settings') ||
           location.pathname.startsWith('/debug')
  }, [location.pathname])
  
  // Show trigger for routes that should have sidebars (simplified logic)
  const showSidebarTrigger = shouldShowSidebarTrigger
  
  // Debug logging
  if (import.meta.env.DEV) {
    console.log('[HeaderV3] Rendering header - Toggle button state:', {
      pathname: location.pathname,
      shouldShowSidebarTrigger,
      appSidebarVisible,
      showSidebarTrigger
    })
  }

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
          <SidebarTriggerV3 />
          <Separator orientation='vertical' className='h-6' />
        </>
      )}
      
      <div className='flex-1 flex justify-center'>
        <Search />
      </div>
      
      {/* Right side buttons */}
      <div className='flex items-center gap-1'>
        <RefreshButton />
        <ThemeSwitch />
        <SyncStatusIcon />
        <ProfileDropdown />
      </div>
      
      {children}
    </header>
  )
}