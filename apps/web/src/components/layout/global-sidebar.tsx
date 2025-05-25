import * as React from 'react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { globalSidebarData } from '@/components/layout/data/sidebar-data'
import { useGlobalSidebar } from '@/contexts/global-sidebar-context'

// Global sidebar width constant
export const GLOBAL_SIDEBAR_WIDTH = 64
// Mobile bottom navigation height constant  
export const MOBILE_BOTTOM_NAV_HEIGHT = 64

// V Logo component matching the main sidebar
const VLogo = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6"
  >
    <path
      d="M6 4L12 18L18 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

interface GlobalSidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function GlobalSidebar({ className, ...props }: GlobalSidebarProps) {
  const { activeSection, setActiveSection } = useGlobalSidebar()

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
            onClick={() => setActiveSection('home')}
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

interface NavItemProps {
  sectionId: string
  icon: React.ElementType
  label: string
  isActive: boolean
  isMobile?: boolean
}

function NavItem({ sectionId, icon: Icon, label, isActive, isMobile = false }: NavItemProps) {
  const { setActiveSection } = useGlobalSidebar()
  
  // Map section IDs to their main page routes
  const getSectionRoute = (sectionId: string): string => {
    switch (sectionId) {
      case 'home':
        return '/'
      case 'projects':
        return '/projects'
      case 'settings':
        return '/settings'
      case 'debug':
        return '/debug/database' // Default to database debug page
      default:
        return '/'
    }
  }
  
  const handleClick = () => {
    setActiveSection(sectionId)
  }
  
  const IconComponent = Icon as React.ComponentType<{ className?: string }>
  const route = getSectionRoute(sectionId)
  
  if (isMobile) {
    return (
      <Link
        to={route as any}
        onClick={handleClick}
        className={cn(
          'flex flex-col items-center justify-center px-2 py-1 min-w-0 flex-1',
          isActive
            ? 'text-sidebar-accent-foreground'
            : 'text-sidebar-foreground'
        )}
        aria-label={label}
      >
        <IconComponent className="h-5 w-5 mb-1" />
        <span className="text-xs truncate">{label}</span>
      </Link>
    )
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={route as any}
          onClick={handleClick}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-md transition-colors ring-sidebar-ring outline-hidden focus-visible:ring-2',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
          aria-label={label}
        >
          <IconComponent className="h-5 w-5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" align="center">{label}</TooltipContent>
    </Tooltip>
  )
}

// Mobile-specific nav item component
function MobileNavItem({ sectionId, icon: Icon, label, isActive }: Omit<NavItemProps, 'isMobile'>) {
  const { setActiveSection } = useGlobalSidebar()
  
  // Map section IDs to their main page routes
  const getSectionRoute = (sectionId: string): string => {
    switch (sectionId) {
      case 'home':
        return '/'
      case 'projects':
        return '/projects'
      case 'settings':
        return '/settings'
      case 'debug':
        return '/debug/database'
      default:
        return '/'
    }
  }
  
  const handleClick = () => {
    setActiveSection(sectionId)
  }
  
  const IconComponent = Icon as React.ComponentType<{ className?: string }>
  const route = getSectionRoute(sectionId)
  
  return (
    <Link
      to={route as any}
      onClick={handleClick}
      className={cn(
        'flex flex-col items-center justify-center p-2 min-w-0 flex-1 rounded-md transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
      aria-label={label}
    >
      <IconComponent className="h-5 w-5 mb-1" />
      <span className="text-xs truncate">{label}</span>
    </Link>
  )
}