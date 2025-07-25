/**
 * Unified Sidebar - Single sidebar with hierarchical navigation
 * Replaces the complex dual sidebar system with a clean, simple approach
 */

import * as React from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { useAuth } from '@/state-machines'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import { projectsAtom, useProjectAtoms } from '@/domain-xstate/project'
import { Project, ProjectStatus } from '@repo/dataforge/client-entities'
import { 
  Home, 
  FolderKanban, 
  CheckSquare, 
  Settings, 
  Bug,
  Plus,
  MessageSquare,
  Package,
  HelpCircle,
  Folder,
  FolderOpen,
  Dot,
  Circle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Activity,
  Zap,
  Grid3X3
} from 'lucide-react'

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

interface NavSection {
  id: string
  label: string
  items: NavItem[]
}

const mainNavigation: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, href: '/projects' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, href: '/tasks' },
  { id: 'apps', label: 'Apps', icon: Package, href: '/apps' },
  { id: 'chats', label: 'Chats', icon: MessageSquare, href: '/chats', badge: '3' },
]

const bottomNavigation: NavItem[] = [
  { id: 'help-center', label: 'Help Center', icon: HelpCircle, href: '/help-center' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  { id: 'debug', label: 'Debug', icon: Bug, href: '/debug' },
]

export function UnifiedSidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { isAdmin, isSuperAdmin } = useAuth()
  
  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  // Filter navigation items based on user permissions
  const filteredBottomNavigation = bottomNavigation.filter(item => {
    if (item.id === 'debug') {
      // Only show debug link to admins and super admins
      return isAdmin || isSuperAdmin
    }
    return true
  })

  return (
    <div className={cn(
      'flex flex-col bg-sidebar transition-all duration-200 border-r border-sidebar-border',
      'h-screen',
      isCollapsed ? 'w-16' : 'w-full'
    )}>
      {/* Header - only show on desktop (collapsed sidebar) */}
      {isCollapsed && (
        <header className="border-b border-border flex-shrink-0">
          <div className="flex h-14 items-center justify-center">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-md">
              <span className="text-primary-foreground font-bold text-lg">V</span>
            </div>
          </div>
        </header>
      )}
      
      {/* Mobile/Expanded Header */}
      {!isCollapsed && (
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
          {/* Main Navigation */}
          <div className="space-y-1 mb-6">
            {mainNavigation.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={isActive(item.href)}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>

          {/* Context-sensitive content */}
          <ContextualNavigation 
            location={location.pathname} 
            isCollapsed={isCollapsed} 
          />

          {/* Always show divider between main content and bottom nav */}
          <Separator className="my-4" />

          {/* Bottom Navigation */}
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
}

function NavItem({ item, isActive, isCollapsed }: {
  item: NavItem
  isActive: boolean
  isCollapsed: boolean
}) {
  const content = (
    <Link
      to={item.href}
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

function ContextualNavigation({ location, isCollapsed }: {
  location: string
  isCollapsed: boolean
}) {
  // Get the expanded content first
  let expandedContent = null
  
  if (location.startsWith('/projects')) {
    expandedContent = <ProjectNavigation isCollapsed={false} />
  } else if (location.startsWith('/tasks')) {
    expandedContent = <TasksNavigation isCollapsed={false} />
  } else if (location.startsWith('/settings')) {
    expandedContent = <SettingsNavigation isCollapsed={false} />
  } else if (location.startsWith('/debug')) {
    expandedContent = <DebugNavigation isCollapsed={false} />
  }
  
  // If no content, return null
  if (!expandedContent) return null
  
  // If collapsed, show the caret with popover containing the same content
  if (isCollapsed) {
    return (
      <CollapsedContextualNav location={location}>
        {expandedContent}
      </CollapsedContextualNav>
    )
  }
  
  // If expanded, show the content directly
  return expandedContent
}


// Simple collapsed navigation - shows exact same content as expanded sidebar
function CollapsedContextualNav({ location, children }: {
  location: string
  children: React.ReactNode
}) {
  if (!children) return null
  
  const [isOpen, setIsOpen] = React.useState(false)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  
  // Handle wheel events to prevent them from bubbling to the page
  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    const container = scrollContainerRef.current
    if (!container) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    const atTop = scrollTop === 0
    const atBottom = scrollTop + clientHeight >= scrollHeight
    
    // If scrolling up at top or scrolling down at bottom, allow event to bubble
    // Otherwise, prevent bubbling to keep scroll within popover
    if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
      return // Let it bubble to parent
    }
    
    e.stopPropagation()
  }, [])
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full h-8 p-0 flex items-center justify-center hover:bg-sidebar-accent mt-2"
        >
          <ChevronDown className="h-3 w-3" />
          <span className="sr-only">Show navigation</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="right" 
        align="start" 
        className="w-64 p-0 max-h-[calc(100vh-4rem)] flex flex-col"
        sideOffset={8}
        onWheel={handleWheel}
      >
        <div 
          ref={scrollContainerRef}
          className="overflow-y-auto flex-1 p-3"
          onWheel={handleWheel}
        >
          {React.cloneElement(children as React.ReactElement, { 
            onNavigate: () => setIsOpen(false)
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ProjectNavigation({ isCollapsed, onNavigate }: { 
  isCollapsed: boolean
  onNavigate?: () => void 
}) {
  const location = useLocation()
  
  // 🎯 SURGICAL SELECTORS: Individual selectors for each status to avoid object creation
  const activeProjects = useSelector(projectsAtom, (projectsRecord) => 
    Object.values(projectsRecord).filter(p => p.status === ProjectStatus.ACTIVE), 
    shallowEqual
  )
  
  const inProgressProjects = useSelector(projectsAtom, (projectsRecord) => 
    Object.values(projectsRecord).filter(p => p.status === ProjectStatus.IN_PROGRESS), 
    shallowEqual
  )
  
  const onHoldProjects = useSelector(projectsAtom, (projectsRecord) => 
    Object.values(projectsRecord).filter(p => p.status === ProjectStatus.ON_HOLD), 
    shallowEqual
  )
  
  const completedProjects = useSelector(projectsAtom, (projectsRecord) => 
    Object.values(projectsRecord).filter(p => p.status === ProjectStatus.COMPLETED), 
    shallowEqual
  )

  // Total projects count for empty state
  const totalProjects = useSelector(projectsAtom, (projectsRecord) => 
    Object.keys(projectsRecord).length
  )

  // Group for easy iteration (no new object creation in selector)
  const projectsByStatus = {
    [ProjectStatus.ACTIVE]: activeProjects,
    [ProjectStatus.IN_PROGRESS]: inProgressProjects,
    [ProjectStatus.ON_HOLD]: onHoldProjects,
    [ProjectStatus.COMPLETED]: completedProjects
  }

  // Get status color helper function
  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.ACTIVE:
        return 'bg-green-500'
      case ProjectStatus.IN_PROGRESS:
        return 'bg-blue-500'
      case ProjectStatus.ON_HOLD:
        return 'bg-yellow-500'
      case ProjectStatus.COMPLETED:
        return 'bg-gray-500'
      default:
        return 'bg-gray-400'
    }
  }

  // Status sections configuration
  const statusSections = [
    { 
      status: ProjectStatus.ACTIVE, 
      label: 'Active', 
      projects: activeProjects 
    },
    { 
      status: ProjectStatus.IN_PROGRESS, 
      label: 'In Progress', 
      projects: inProgressProjects 
    },
    { 
      status: ProjectStatus.ON_HOLD, 
      label: 'On Hold', 
      projects: onHoldProjects 
    },
    { 
      status: ProjectStatus.COMPLETED, 
      label: 'Completed', 
      projects: completedProjects 
    }
  ]

  return (
    <div className="mt-4">
      {/* Project Status Accordion */}
      <Accordion type="single" collapsible>
        {statusSections.map((section) => {
          if (section.projects.length === 0) return null

          return (
            <AccordionItem key={section.status} value={section.status}>
              <AccordionTrigger className="px-3 py-2 hover:bg-sidebar-accent/50 rounded-md [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", getStatusColor(section.status))} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {section.label} ({section.projects.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 ml-4">
                  {section.projects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        location.pathname === `/projects/${project.id}`
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground"
                      )}
                    >
                      <span className="truncate">{project.name}</span>
                    </Link>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* Empty state */}
      {totalProjects === 0 && (
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">No projects yet</p>
          <Button variant="ghost" size="sm" className="mt-2 h-6 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Create Project
          </Button>
        </div>
      )}
    </div>
  )
}

function TasksNavigation({ isCollapsed, onNavigate }: { 
  isCollapsed: boolean
  onNavigate?: () => void 
}) {
  const location = useLocation()
  
  const taskItems = [
    { label: 'Table View', href: '/tasks?view=table' },
    { label: 'Kanban View', href: '/tasks?view=kanban' },
    { label: 'Timeline View', href: '/tasks?view=timeline' },
  ]
  
  return (
    <div className="mt-4 space-y-1">
      <div className="px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Task Views
        </span>
      </div>
      {taskItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            location.pathname === item.href
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground"
          )}
        >
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </div>
  )
}

function SettingsNavigation({ isCollapsed, onNavigate }: { 
  isCollapsed: boolean
  onNavigate?: () => void 
}) {
  const location = useLocation()
  const settingsItems = [
    { label: 'Profile', href: '/settings' },
    { label: 'Account', href: '/settings/account' },
    { label: 'Appearance', href: '/settings/appearance' },
    { label: 'Notifications', href: '/settings/notifications' },
    { label: 'Display', href: '/settings/display' },
  ]


  return (
    <div className="mt-4">
      <div className="px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Settings
        </span>
      </div>
      <div className="space-y-1">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              location.pathname === item.href
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground"
            )}
          >
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function DebugNavigation({ isCollapsed, onNavigate }: { 
  isCollapsed: boolean
  onNavigate?: () => void 
}) {
  const location = useLocation()
  const [systemExpanded, setSystemExpanded] = React.useState(true)
  const [errorExpanded, setErrorExpanded] = React.useState(false)
  
  const debugSections = [
    {
      title: 'Core Debug Tools',
      expanded: systemExpanded,
      setExpanded: setSystemExpanded,
      items: [
        { label: 'Sync System', href: '/debug/sync' },
        { label: 'Sync Test', href: '/debug/sync-test' },
        { label: 'Database', href: '/debug/database' },
        { label: 'Integrity', href: '/debug/integrity' },
        { label: 'Kanban Debug', href: '/debug/kanban' },
        { label: 'React Flow Positioning', href: '/debug/reactflow-positioning' },
      ]
    },
    {
      title: 'Error Pages',
      expanded: errorExpanded,
      setExpanded: setErrorExpanded,
      items: [
        { label: 'Unauthorized (401)', href: '/401' },
        { label: 'Forbidden (403)', href: '/403' },
        { label: 'Not Found (404)', href: '/404' },
        { label: 'Server Error (500)', href: '/500' },
        { label: 'Maintenance (503)', href: '/503' },
      ]
    }
  ]


  return (
    <div className="mt-4 space-y-4">
      {debugSections.map((section) => (
        <div key={section.title}>
          <button
            onClick={() => section.setExpanded(!section.expanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-sidebar-accent/50 rounded-md transition-colors"
          >
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {section.title}
            </span>
            {section.expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
          {section.expanded && (
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ml-2",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    location.pathname === item.href
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground"
                  )}
                >
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}