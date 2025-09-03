/**
 * Unified Sidebar - 2-Level Navigation: Universe → Organization
 * Clean implementation with Universe view and Organization view
 */

import * as React from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/state-machines'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { observer } from '@legendapp/state/react'
import { entityGroups$, createEntityGroups, currentOrganizations$, universeHelpers } from '@/legend-state'
import { use$ } from '@legendapp/state/react'
import { 
  Home, 
  Settings, 
  Bug,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Activity,
  Building,
  Globe,
  Map,
  CheckSquare,
  FolderOpen,
  Database,
  FileText,
  MessageSquare,
  File,
  Circle,
  BarChart3
} from 'lucide-react'

// Icon resolver for dynamic entity icons
const IconMap: Record<string, React.ElementType> = {
  CheckSquare,
  FolderOpen,
  Database,
  FileText,
  Activity,
  MessageSquare,
  File,
  Globe,
  Map,
  Circle
}

function getIconComponent(iconName: string): React.ElementType {
  return IconMap[iconName] || Circle
}

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  href: string
  badge?: string
}

const bottomNavigation: NavItem[] = [
  { id: 'help-center', label: 'Help Center', icon: HelpCircle, href: '/help-center' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  { id: 'debug', label: 'Debug', icon: Bug, href: '/debug' },
]

export const UnifiedSidebar = observer(function UnifiedSidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin } = useAuth()
  
  // Determine current context from URL instead of observables
  const routeOrgId = location.pathname.startsWith('/org/') 
    ? location.pathname.split('/')[2] // Extract orgId from /org/{orgId}/...
    : null
  const isUniverseView = !routeOrgId
  
  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  // Filter navigation items based on user permissions
  const filteredBottomNavigation = bottomNavigation.filter(item => {
    if (item.id === 'debug') {
      return isAdmin || isSuperAdmin
    }
    return true
  })

  return (
    <div 
      data-testid="sidebar"
      className={cn(
        'flex flex-col bg-sidebar transition-all duration-200 border-r border-sidebar-border',
        'h-screen',
        isCollapsed ? 'w-16' : 'w-full'
      )}>
      {/* Header */}
      {isCollapsed ? (
        <header className="border-b border-border flex-shrink-0">
          <div className="flex h-14 items-center justify-center">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-md">
              <span className="text-primary-foreground font-bold text-lg">V</span>
            </div>
          </div>
        </header>
      ) : (
        <header className="border-b border-border flex-shrink-0">
          <div className="flex h-14 items-center justify-center">
            <div className="font-semibold text-sidebar-foreground px-4">
              VibeStack
            </div>
          </div>
        </header>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="px-3 py-4">
          {/* 2-Level Navigation Structure */}
          {isUniverseView ? (
            <UniverseView 
              isCollapsed={isCollapsed} 
              onEnterOrg={(orgId: string) => navigate({ to: `/org/${orgId}` })}
            />
          ) : (
            <OrganizationView 
              orgId={routeOrgId!} 
              isCollapsed={isCollapsed}
              onBackToUniverse={() => navigate({ to: '/universe' })}
            />
          )}

          {/* Bottom Navigation */}
          <Separator className="my-4" />
          <div className="space-y-1">
            {filteredBottomNavigation.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={isActive(item.href)}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})

function NavItem({ item, isActive, isCollapsed }: {
  item: NavItem
  isActive: boolean
  isCollapsed: boolean | undefined
}) {
  const content = (
    <Link
      to={item.href}
      data-testid={`nav-link-${item.id}`}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground',
        isCollapsed && 'justify-center px-2'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!isCollapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span className="ml-auto text-xs bg-sidebar-accent-foreground/20 px-1.5 py-0.5 rounded">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  )

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
}

// Universe View Component - Level 1
function UniverseView({ isCollapsed, onEnterOrg }: {
  isCollapsed: boolean
  onEnterOrg: (orgId: string) => void
}) {
  const organizations = use$(currentOrganizations$)
  const location = useLocation()

  const universeNavItems = [
    { id: 'universe-dashboard', label: 'Universe Dashboard', icon: Globe, href: '/universe' },
    { id: 'universe-analytics', label: 'Analytics', icon: Activity, href: '/universe/analytics' },
  ]

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <div className="space-y-1">
          {/* Universe Dashboard */}
          {universeNavItems.map(item => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center justify-center rounded-md p-2 text-sm transition-colors',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    location.pathname.startsWith(item.href)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Organizations */}
          <Separator className="my-2" />
          {organizations.slice(0, 3).map(org => (
            <Tooltip key={org.info.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full justify-center p-2"
                  onClick={() => onEnterOrg(org.info.id)}
                >
                  <Building className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {org.info.name}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-4">
      {/* Universe Dashboard Links */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground px-2 mb-2">Universe</div>
        {universeNavItems.map(item => (
          <Link
            key={item.id}
            to={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              location.pathname.startsWith(item.href)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Organizations List */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground px-2 mb-2 flex items-center justify-between">
          <span>Organizations</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded">{organizations.length}</span>
        </div>
        {organizations.map(org => (
          <Button
            key={org.info.id}
            variant="ghost"
            className="w-full justify-start px-3 py-2 h-auto font-normal"
            onClick={() => onEnterOrg(org.info.id)}
          >
            <Building className="h-4 w-4 mr-3" />
            <span className="truncate">{org.info.name}</span>
            <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
          </Button>
        ))}
      </div>
    </div>
  )
}

// Organization View Component - Level 2  
function OrganizationView({ orgId, isCollapsed, onBackToUniverse }: {
  orgId: string
  isCollapsed: boolean
  onBackToUniverse: () => void
}) {
  const allOrganizations = use$(currentOrganizations$)
  // Create organization-specific entity groups
  const orgEntityGroups$ = React.useMemo(() => createEntityGroups(orgId), [orgId])
  const entityNavGroups = use$(orgEntityGroups$)
  const location = useLocation()

  const currentOrg = allOrganizations.find(org => org.info.id === orgId)
  if (!currentOrg) {
    return <div className="p-4 text-sm text-muted-foreground">Organization not found</div>
  }


  if (isCollapsed) {
    return (
      <TooltipProvider>
        <div className="space-y-1">
          {/* Back to Universe */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full justify-center p-2"
                onClick={onBackToUniverse}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Back to Universe
            </TooltipContent>
          </Tooltip>

          {/* Organization Dashboard */}
          <Separator className="my-2" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/org/${orgId}/dashboard`}
                className={cn(
                  "flex items-center justify-center rounded-md p-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  location.pathname.startsWith(`/org/${orgId}/dashboard`)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground"
                )}
              >
                <BarChart3 className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              {currentOrg.info.name} Dashboard
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Breadcrumb Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToUniverse}
            className="text-xs text-muted-foreground hover:text-foreground p-1 h-auto"
          >
            <Globe className="h-3 w-3 mr-1" />
            Universe
          </Button>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate">{currentOrg.info.name}</span>
            <span className="text-xs text-muted-foreground truncate">Organization</span>
          </div>
        </div>
      </div>

      {/* Organization Dashboard */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground px-2 mb-2">
          <span>Dashboard</span>
        </div>
        <Link
          to={`/org/${orgId}/dashboard`}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            location.pathname.startsWith(`/org/${orgId}/dashboard`)
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground'
          )}
        >
          <BarChart3 className="h-4 w-4" />
          <span className="truncate">{currentOrg.info.name} Overview</span>
        </Link>
      </div>

      {/* All Entities Dropdown */}
      <Accordion type="single" collapsible defaultValue="entities">
        <AccordionItem value="entities">
          <AccordionTrigger className="px-2 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent/50 rounded-md [&[data-state=open]>svg]:rotate-180">
            <span>All Entities</span>
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="space-y-1 ml-2">
              {entityNavGroups?.map(group => 
                group.items?.map(item => {
                  const IconComponent = getIconComponent(item.icon)
                  return (
                    <Link
                      key={item.url}
                      to={item.url}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        location.pathname.startsWith(item.url)
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground'
                      )}
                    >
                      <IconComponent className="h-4 w-4" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  )
                })
              )}
              {(!entityNavGroups || entityNavGroups.length === 0) && (
                <div className="text-xs text-muted-foreground px-3 py-2">
                  No entities available
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}