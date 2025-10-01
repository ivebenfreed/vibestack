/**
 * Unified Sidebar - 2-Level Navigation: Universe → Organization
 * Clean implementation with Universe view and Organization view
 */

import * as React from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { observer, use$ } from '@legendapp/state/react'
import { createEntityGroups, getEntity$ } from '@/legend-state'
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
  BarChart3,
  ChevronsLeft,
  Vault,
  FolderKanban,
  Network
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
  Circle,
  Vault,
  FolderKanban
}

function getIconComponent(iconName: string): React.ElementType {
  return IconMap[iconName] || Circle
}

interface SidebarProps {
  isCollapsed: boolean
  onToggle?: () => void
  isUniverseMode?: boolean
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

export const UnifiedSidebar = observer(function UnifiedSidebar({ isCollapsed, onToggle, isUniverseMode = true }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUnifiedAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isSuperAdmin = user?.role === 'super_admin'

  // Determine current context from URL instead of observables
  const routeOrgId = location.pathname.startsWith('/org/')
    ? location.pathname.split('/')[2] // Extract orgId from /org/{orgId}/...
    : null
  const isUniverseView = !routeOrgId

  // Store current org when navigating to org routes (for persistence)
  React.useEffect(() => {
    if (routeOrgId && typeof window !== 'undefined') {
      try {
        localStorage.setItem('lastSelectedOrganization', routeOrgId)
      } catch (error) {
        console.warn('Failed to store organization preference:', error)
      }
    }
  }, [routeOrgId])
  
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggle}
                    className="w-8 h-8 p-0"
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-md">
                      <span className="text-primary-foreground font-bold text-lg">E</span>
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Expand sidebar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>
      ) : (
        <header className="border-b border-border flex-shrink-0">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="font-semibold text-sidebar-foreground">
              Elevra
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggle}
                    className="p-2 hover:bg-sidebar-accent"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                    <span className="sr-only">Collapse sidebar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Collapse sidebar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
              isUniverseMode={isUniverseMode}
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
  const { userOrganizations } = useUnifiedAuth()
  const location = useLocation()

  // Transform userOrganizations to match the expected format (organizations are "worlds" in the UI)
  const worlds = (userOrganizations || []).map(org => ({
    info: {
      id: org.id,
      name: org.name,
      slug: org.slug || '',
      type: org.type || 'business',
      role: org.role || 'member'
    }
  }))

  const universeNavItems = [
    { id: 'universe-dashboard', label: 'Universe Dashboard', icon: Globe, href: '/universe' },
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

          {/* Worlds */}
          <Separator className="my-2" />
          {worlds.slice(0, 3).map(world => (
            <Tooltip key={world.info.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full justify-center p-2"
                  onClick={() => onEnterOrg(world.info.id)}
                >
                  <Map className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {world.info.name}
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

      {/* Worlds List */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground px-2 mb-2 flex items-center justify-between">
          <span>Worlds</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded">{worlds.length}</span>
        </div>
        {worlds.map(world => (
          <Button
            key={world.info.id}
            variant="ghost"
            className="w-full justify-start px-3 py-2 h-auto font-normal"
            onClick={() => onEnterOrg(world.info.id)}
          >
            <Map className="h-4 w-4 mr-3" />
            <span className="truncate">{world.info.name}</span>
            <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
          </Button>
        ))}
      </div>
    </div>
  )
}

// Organization View Component - Level 2  
function OrganizationView({ orgId, isCollapsed, isUniverseMode = true, onBackToUniverse }: {
  orgId: string
  isCollapsed: boolean
  isUniverseMode?: boolean
  onBackToUniverse: () => void
}) {
  const { userOrganizations } = useUnifiedAuth()
  const navigate = useNavigate()
  // Create organization-specific entity groups
  const orgEntityGroups$ = React.useMemo(() => createEntityGroups(orgId), [orgId])
  const entityNavGroups = use$(orgEntityGroups$)

  // Get project entities for the expandable Projects section
  const projectEntities = React.useMemo(() => {
    if (!entityNavGroups) return []

    // Find the projects group from entity nav groups
    const projectsGroup = entityNavGroups.find(group => group.name === 'Projects')
    return projectsGroup?.items || []
  }, [entityNavGroups])

  // State for expanded projects in sidebar
  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(new Set())

  // Helper function to toggle project expansion
  const toggleProjectExpansion = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev)
      if (newSet.has(projectId)) {
        newSet.delete(projectId)
      } else {
        newSet.add(projectId)
      }
      return newSet
    })
  }
  const location = useLocation()

  const currentOrg = (userOrganizations || []).find(org => org.id === orgId)
  if (!currentOrg) {
    return <div className="p-4 text-sm text-muted-foreground">Organization not found</div>
  }


  if (isCollapsed) {
    return (
      <TooltipProvider>
        <div className="space-y-1">
          {/* Back to Universe (only in universe mode) */}
          {isUniverseMode && (
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
          )}

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
              {currentOrg.name} World
            </TooltipContent>
          </Tooltip>

          {/* Entity Studio */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/org/${orgId}/entity-studio`}
                className={cn(
                  "flex items-center justify-center rounded-md p-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  location.pathname.startsWith(`/org/${orgId}/entity-studio`)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground"
                )}
              >
                <Network className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              Entity Studio
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
          {isUniverseMode && (
            <>
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
            </>
          )}
          {!isUniverseMode ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex-1 justify-between p-2 h-auto">
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-sm font-medium truncate">{currentOrg.name}</span>
                    <span className="text-xs text-muted-foreground truncate">Organization</span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {userOrganizations?.map(org => (
                  <DropdownMenuItem
                    key={org?.id || 'unknown'}
                    onClick={() => {
                      if (org?.id) {
                        // Store selected org in localStorage
                        try {
                          localStorage.setItem('lastSelectedOrganization', org.id)
                        } catch (error) {
                          console.warn('Failed to store organization preference:', error)
                        }
                        navigate({ to: '/org/$orgId/dashboard', params: { orgId: org.id } })
                      }
                    }}
                    className="flex items-center gap-3"
                  >
                    <Building className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{org?.name}</span>
                      <span className="text-xs text-muted-foreground">{org?.role}</span>
                    </div>
                  </DropdownMenuItem>
                )) || []}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate">{currentOrg.name}</span>
              <span className="text-xs text-muted-foreground truncate">World</span>
            </div>
          )}
        </div>
      </div>

      {/* World Dashboard */}
      <div className="space-y-1">
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
          <span className="truncate">Dashboard</span>
        </Link>

        {/* Entity Studio - Visual Entity Schema Viewer */}
        <Link
          to={`/org/${orgId}/entity-studio`}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            location.pathname.startsWith(`/org/${orgId}/entity-studio`)
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground'
          )}
        >
          <Network className="h-4 w-4" />
          <span className="truncate">Entity Studio</span>
        </Link>
      </div>

      {/* Projects Section - Expandable with individual records */}
      {projectEntities.length > 0 && (
        <div className="space-y-1 mb-4">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            Projects
          </div>
          {projectEntities.map((projectEntity) => {
            // Use the fullEntityName from createEntityGroups which is already correctly prefixed
            const fullEntityName = projectEntity.fullEntityName || `${projectEntity.organizationId}_${projectEntity.originalEntityName || projectEntity.title}`
            const projectId = `${projectEntity.organizationId}-${projectEntity.originalEntityName || projectEntity.title}`
            const isExpanded = expandedProjects.has(projectId)

            // Debug logging removed to prevent unnecessary console spam during navigation

            return (
              <ProjectEntitySection
                key={projectId}
                projectEntity={projectEntity}
                fullEntityName={fullEntityName}
                projectId={projectId}
                isExpanded={isExpanded}
                onToggle={() => toggleProjectExpansion(projectId)}
                location={location}
              />
            )
          })}
        </div>
      )}

      {/* Vault Section (formerly All Entities) */}
      <Accordion type="single" collapsible defaultValue="entities">
        <AccordionItem value="entities">
          <AccordionTrigger className="px-2 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent/50 rounded-md [&[data-state=open]>svg]:rotate-180">
            <span>Vault</span>
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

// Component for rendering individual project records using reactive observables
interface ProjectEntitySectionProps {
  projectEntity: any
  fullEntityName: string
  projectId: string
  isExpanded: boolean
  onToggle: () => void
  location: any
}

const ProjectEntitySection = observer(({
  projectEntity,
  fullEntityName,
  projectId,
  isExpanded,
  onToggle,
  location
}: ProjectEntitySectionProps) => {
  // Use Legend State's selective observation pattern
  const entityStore = getEntity$(fullEntityName)

  // Use shallow tracking to only react to structure changes, not individual record changes
  const shallowData = entityStore ? entityStore.get(true) : undefined
  const count = shallowData ? Object.keys(shallowData).length : 0
  const loading = !entityStore

  const IconComponent = getIconComponent(projectEntity.icon)

  // Process data to array format - will only update when shallow structure changes
  const records = React.useMemo(() => {
    if (!shallowData || typeof shallowData !== 'object') return []
    return Object.values(shallowData)
  }, [shallowData]) // Depends on shallow data structure, not deep changes

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground animate-pulse">
        <div className="flex items-center gap-3">
          <IconComponent className="h-4 w-4" />
          <span>Loading {projectEntity.title}...</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Project Entity Header - Clickable to toggle */}
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center justify-between w-full rounded-md px-3 py-2 text-sm transition-colors',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          'text-sidebar-foreground'
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
          <IconComponent className="h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="font-medium truncate w-full" title={projectEntity.title}>
              {projectEntity.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {loading ? '...' : count} records
            </span>
          </div>
        </div>
      </button>

      {/* Individual Records - Shown when expanded */}
      {isExpanded && (
        <div className="ml-6 space-y-1 mt-1">
          {records.map((record: any, index: number) => (
            <Link
              key={record.id || index}
              to={`${projectEntity.url}/${record.id}`}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                location.pathname === `${projectEntity.url}/${record.id}`
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground'
              )}
            >
              <FileText className="h-3 w-3 flex-shrink-0" />
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-sm truncate w-full" title={record.name || record.title || 'Untitled'}>
                  {record.name || record.title || 'Untitled'}
                </span>
                {record.description && (
                  <span className="text-xs text-muted-foreground truncate w-full" title={record.description}>
                    {record.description.substring(0, 30)}...
                  </span>
                )}
              </div>
            </Link>
          ))}

          {records.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No records found
            </div>
          )}
        </div>
      )}
    </div>
  )
})