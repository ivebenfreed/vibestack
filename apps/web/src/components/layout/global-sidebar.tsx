import * as React from 'react'
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { globalSidebarData } from '@/components/layout/data/sidebar-data'
import { useLayoutStore } from '@/stores/layoutStore'

// Global sidebar width constant
export const GLOBAL_SIDEBAR_WIDTH = 64
// Mobile bottom navigation height constant  
export const MOBILE_BOTTOM_NAV_HEIGHT = 64

interface GlobalSidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

interface NavItemProps {
  sectionId: string
  icon: React.ElementType
  label: string
  isActive: boolean
  isMobile: boolean
}

function NavItem({ sectionId, icon: Icon, label, isActive, isMobile }: NavItemProps) {
  const matchRoute = useMatchRoute()
  const navigate = useNavigate()
  
  // Determine the route for this section
  const getRouteForSection = (section: string) => {
    switch (section) {
      case 'home': return '/'
      case 'projects': return '/projects'
      case 'settings': return '/settings'
      case 'debug': return '/debug'
      default: return '/'
    }
  }
  
  const route = getRouteForSection(sectionId)
  const isCurrentRoute = matchRoute({ to: route, fuzzy: true })
  
  const handleClick = () => {
    // 🎯 DEBUG: Time the entire navigation process
    const clickTime = performance.now()
    console.log(`🔥 [GlobalSidebar] CLICK DETECTED for section: ${sectionId} to route: ${route}`)
    if (import.meta.env.DEV) {
      console.log(`[GlobalSidebar] Navigation click for section: ${sectionId} to route: ${route}`)
    }
    
    // Defer navigation to next tick for instant click response
    setTimeout(() => {
      const navStartTime = performance.now()
      console.log(`[GlobalSidebar] Starting navigation to ${route} at ${navStartTime - clickTime}ms after click`)
      
      navigate({ to: route })
      
      // Check when navigation completes
      setTimeout(() => {
        const navEndTime = performance.now()
        console.log(`[GlobalSidebar] Navigation to ${route} took ${navEndTime - navStartTime}ms total`)
      }, 0)
    }, 0)
  }
  
  if (isMobile) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center p-2 rounded-md transition-colors text-xs cursor-pointer',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          (isActive || isCurrentRoute) 
            ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
            : 'text-sidebar-foreground'
        )}
        onClick={handleClick}
      >
        <Icon className="h-5 w-5 mb-1" />
        <span className="text-xs">{label}</span>
      </div>
    )
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={route}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-md transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            (isActive || isCurrentRoute) 
              ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
              : 'text-sidebar-foreground'
          )}
          preload="intent"
        >
          <Icon className="h-5 w-5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" align="center">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function MobileNavItem({ sectionId, icon, label, isActive }: Omit<NavItemProps, 'isMobile'>) {
  return <NavItem sectionId={sectionId} icon={icon} label={label} isActive={isActive} isMobile={true} />
}

function VLogo() {
  return (
    <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
      <span className="text-primary-foreground font-bold text-lg">V</span>
    </div>
  )
}

export function GlobalSidebar({ className, ...props }: GlobalSidebarProps) {
  const activeSection = useLayoutStore.activeSection()

  return (
    <>
      {/* Desktop Global Sidebar */}
      <div
        className={cn(
          // Hide on mobile, show on desktop
          'fixed left-0 top-0 z-[100] hidden md:flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border',
          className
        )}
        style={{ width: 'var(--global-sidebar-width)' }}
        {...props}
      >
        <div className="flex h-14 items-center justify-center border-b border-sidebar-border">
          <Link 
            to="/" 
            className="flex items-center justify-center p-2 rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Home"
            onClick={() => useLayoutStore.setActiveSection('home')}
          >
            <VLogo />
          </Link>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 p-2">
          <TooltipProvider delayDuration={200}>
            {globalSidebarData.map((section) => (
              <NavItem 
                key={section.id}
                sectionId={section.id}
                icon={section.icon} 
                label={section.title}
                isActive={activeSection === section.id}
                isMobile={false}
              />
            ))}
          </TooltipProvider>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-sidebar border-t border-sidebar-border"
        style={{ height: `${MOBILE_BOTTOM_NAV_HEIGHT}px` }}
      >
        <div className="flex items-center justify-around h-full px-1">
          {globalSidebarData.map((section) => (
            <MobileNavItem 
              key={section.id}
              sectionId={section.id}
              icon={section.icon} 
              label={section.title}
              isActive={activeSection === section.id}
            />
          ))}
        </div>
      </div>
    </>
  )
}