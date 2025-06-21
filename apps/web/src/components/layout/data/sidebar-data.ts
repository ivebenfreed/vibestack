import {
  IconBarrierBlock,
  IconBrowserCheck,
  IconBug,
  IconChecklist,
  IconError404,
  IconHelp,
  IconLayoutDashboard,
  IconLock,
  IconLockAccess,
  IconMessages,
  IconNotification,
  IconPackages,
  IconPalette,
  IconServerOff,
  IconSettings,
  IconTool,
  IconUserCog,
  IconUserOff,
  IconUsers,
  IconFolder,
  IconFolderOpen,
  IconHome,
  IconPoint,
} from '@tabler/icons-react'
import { Dot, AudioWaveform, Command, GalleryVerticalEnd, FolderOpen, Folder, FolderClosed } from 'lucide-react'
import { type SidebarData, type NavGroup, type NavItem } from '../types'
import { Project, ProjectStatus } from '@repo/dataforge/client-entities'

/**
 * Global sidebar sections with their submenu items
 * 
 * @example
 * // To add a new section without main sidebar:
 * {
 *   id: 'analytics',
 *   title: 'Analytics',
 *   icon: IconChart,
 *   showMainSidebar: false, // Hides main sidebar and sidebar trigger
 *   navGroups: []
 * }
 * 
 * // To add a section with main sidebar (default):
 * {
 *   id: 'admin',
 *   title: 'Admin',
 *   icon: IconShield,
 *   showMainSidebar: true, // or omit (defaults to true)
 *   navGroups: [...]
 * }
 */
export interface GlobalSidebarSection {
  id: string
  title: string
  icon: React.ElementType
  navGroups: NavGroup[]
  showMainSidebar?: boolean // Controls whether to show the main sidebar for this section
}

/**
 * Generate dynamic project navigation items from actual project data
 * Projects will be organized into collapsible folders by status
 * 🎯 PURE FUNCTION: Let Jotai atoms handle memoization for surgical rerendering
 */
export function generateProjectNavItems(projects: Project[]): NavItem[] {
  const startTime = performance.now()
  
  // Separate projects by status using correct enum values
  const activeProjects = projects.filter(p => 
    p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.IN_PROGRESS
  )
  const archivedProjects = projects.filter(p => 
    p.status === ProjectStatus.ON_HOLD || p.status === ProjectStatus.COMPLETED
  )
  
  // Create nav items with project IDs for atomized rendering
  const createProjectItems = (projectList: Project[]) => 
    projectList.map(project => ({
      projectId: project.id, // 🎯 ATOMIZED: Store ID for surgical rendering
      title: project.name,   // Keep for folder titles
      url: `/projects/${project.id}` as any,
      icon: Dot,
    }))

  const navItems: NavItem[] = []

  // All Projects folder (collapsible)
  if (projects.length > 0) {
    navItems.push({
      title: `All Projects (${projects.length})`,
      icon: Folder,
      items: createProjectItems(projects)
    })
  }

  // Active Projects folder (collapsible)
  if (activeProjects.length > 0) {
    navItems.push({
      title: `Active (${activeProjects.length})`,
      icon: FolderOpen,
      items: createProjectItems(activeProjects)
    })
  }

  // Archived Projects folder (collapsible) 
  if (archivedProjects.length > 0) {
    navItems.push({
      title: `Archived (${archivedProjects.length})`,
      icon: FolderClosed,
      items: createProjectItems(archivedProjects)
    })
  }
  


  return navItems
}

/**
 * Generate dynamic projects section with actual project data
 */
export function generateProjectsSection(projects: Project[] = []): GlobalSidebarSection {
  const projectNavItems = generateProjectNavItems(projects)
  
  const projectsGroupItems: NavItem[] = [
    // Direct link to projects overview
    {
      title: 'All Projects',
      url: '/projects',
      icon: IconLayoutDashboard,
    },
    // Collapsible project folders
    ...projectNavItems,
  ]
  
  return {
    id: 'projects',
    title: 'Projects',
    icon: IconFolder,
    showMainSidebar: true, // Show main sidebar for projects
    navGroups: [
      {
        title: 'Projects',
        items: projectsGroupItems,
      },
      {
        title: 'Project Tools',
        items: [
          {
            title: 'All Tasks',
            url: '/tasks',
            icon: IconChecklist,
          },
        ],
      },
    ],
  }
}

export const globalSidebarData: GlobalSidebarSection[] = [
  {
    id: 'home',
    title: 'Home',
    icon: IconHome,
    showMainSidebar: false, // Hide main sidebar for home/dashboard
    navGroups: [
      {
        title: 'General',
        items: [
          {
            title: 'Dashboard',
            url: '/',
            icon: IconLayoutDashboard,
          },
          {
            title: 'Tasks',
            url: '/tasks',
            icon: IconChecklist,
          },
          {
            title: 'Apps',
            url: '/apps',
            icon: IconPackages,
          },
          {
            title: 'Chats',
            url: '/chats',
            badge: '3',
            icon: IconMessages,
          },
          {
            title: 'Users',
            url: '/users',
            icon: IconUsers,
          },
        ],
      },
    ],
  },
  // Projects section will be dynamically generated
  generateProjectsSection(), // Default empty projects section
  {
    id: 'settings',
    title: 'Settings',
    icon: IconSettings,
    showMainSidebar: true, // Show main sidebar for settings
    navGroups: [
      {
        title: 'User Settings',
        items: [
          {
            title: 'Profile',
            url: '/settings',
            icon: IconUserCog,
          },
          {
            title: 'Account',
            url: '/settings/account',
            icon: IconTool,
          },
          {
            title: 'Appearance',
            url: '/settings/appearance',
            icon: IconPalette,
          },
          {
            title: 'Notifications',
            url: '/settings/notifications',
            icon: IconNotification,
          },
          {
            title: 'Display',
            url: '/settings/display',
            icon: IconBrowserCheck,
          },
        ],
      },
      {
        title: 'System',
        items: [
          {
            title: 'Help Center',
            url: '/help-center',
            icon: IconHelp,
          },
        ],
      },
    ],
  },
  {
    id: 'debug',
    title: 'Debug',
    icon: IconBug,
    showMainSidebar: true, // Show main sidebar for debug
    navGroups: [
      {
        title: 'Authentication',
        items: [
          {
            title: 'Auth Debug',
            url: '/debug/auth',
            icon: IconLockAccess,
          },
          {
            title: 'Sign In',
            url: '/sign-in',
            icon: IconLock,
          },
          {
            title: 'Sign Up',
            url: '/sign-up',
            icon: IconUserCog,
          },
          {
            title: 'Forgot Password',
            url: '/forgot-password',
            icon: IconLock,
          },
          {
            title: 'OTP',
            url: '/otp',
            icon: IconLock,
          },
        ],
      },
      {
        title: 'System Debug',
        items: [
          {
            title: 'Database',
            url: '/debug/database',
            icon: IconBug,
          },



          {
            title: 'Sync',
            url: '/debug/sync',
            icon: IconBug,
          },

          {
            title: 'Sync Testing',
            url: '/debug/sync-test',
            icon: IconBug,
          },
          {
            title: 'Live Query',
            url: '/debug/live-query',
            icon: IconBug,
          },
          {
            title: 'Live Query Performance',
            url: '/debug/performance',
            icon: IconBug,
          },
          {
            title: 'Multi-Query Test',
            url: '/debug/multi-query',
            icon: IconBug,
          },
          {
            title: 'TypeORM Test',
            url: '/debug/typeorm-test',
            icon: IconBug,
          },
          {
            title: 'Tasks New Pattern',
            url: '/debug/tasks-new-pattern',
            icon: IconChecklist,
          },

          {
            title: 'VibeGrid Native',
            url: '/debug/vibegrid-native',
            icon: IconChecklist,
          },

          {
            title: 'VibeGridFinal Tasks',
            url: '/debug/vibegridfinal-tasks',
            icon: IconChecklist,
          },
        ],
      },
      {
        title: 'Error Pages',
        items: [
          {
            title: 'Unauthorized',
            url: '/401',
            icon: IconLock,
          },
          {
            title: 'Forbidden',
            url: '/403',
            icon: IconUserOff,
          },
          {
            title: 'Not Found',
            url: '/404',
            icon: IconError404,
          },
          {
            title: 'Internal Server Error',
            url: '/500',
            icon: IconServerOff,
          },
          {
            title: 'Maintenance Error',
            url: '/503',
            icon: IconBarrierBlock,
          },
        ],
      },
    ],
  },
]

// Legacy sidebar data for backward compatibility (now derived from global data)
export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Shadcn Admin',
      logo: Command,
      plan: 'Vite + ShadcnUI',
    },
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
  ],
  navGroups: globalSidebarData[0].navGroups, // Default to home section
}

// Helper function to get sidebar data for a specific global section
export function getSidebarDataForSection(sectionId: string, projects: Project[] = []): NavGroup[] {
  if (sectionId === 'projects') {
    // Generate dynamic projects section with actual project data
    const projectsSection = generateProjectsSection(projects)
    return projectsSection.navGroups
  }
  
  const section = globalSidebarData.find(s => s.id === sectionId)
  return section?.navGroups || globalSidebarData[0].navGroups
}

// Helper function to check if main sidebar should be shown for a section
export function shouldShowMainSidebarForSection(sectionId: string): boolean {
  const section = globalSidebarData.find(s => s.id === sectionId)
  return section?.showMainSidebar ?? true // Default to true if not specified
}

// Helper function to configure a new global sidebar section
export function createGlobalSidebarSection(
  id: string,
  title: string,
  icon: React.ElementType,
  navGroups: NavGroup[],
  showMainSidebar: boolean = true
): GlobalSidebarSection {
  return {
    id,
    title,
    icon,
    navGroups,
    showMainSidebar,
  }
}
