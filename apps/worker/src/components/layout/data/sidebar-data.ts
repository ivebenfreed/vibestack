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
import { Dot, AudioWaveform, Command, GalleryVerticalEnd, FolderOpen, Folder, FolderClosed, Globe, Building2, Sparkles } from 'lucide-react'
import { type SidebarData, type NavGroup, type NavItem } from '../types'
import { Project, ProjectStatus } from '@/db/client-entities'
import { generateDynamicSidebarData, shouldHideBusinessRoutes } from './dynamic-sidebar-data'
import type { EntitySchema } from '@/lib/schema-client'

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
          {
            title: 'Tasks Kanban',
            url: '/tasks/kanban',
            icon: IconChecklist,
          },
        ],
      },
    ],
  }
}

function getHomeNavItems(): NavItem[] {
  const hideBusinessRoutes = shouldHideBusinessRoutes()
  
  const allItems: NavItem[] = [
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
      title: 'Tasks Kanban',
      url: '/tasks/kanban',
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
  ]
  
  if (hideBusinessRoutes) {
    return allItems.filter(item => 
      !item.url?.includes('/tasks') && 
      !item.url?.includes('/projects')
    )
  }
  
  return allItems
}

/**
 * Generate universe section for personal worlds and projects
 */
export function generateUniverseSection(universeData: any, worldData: any): GlobalSidebarSection {
  const userUniverse = universeData ? Object.values(universeData)[0] : null;
  const personalWorlds = worldData ? Object.values(worldData).filter((world: any) => !!world.universe_id) : [];
  
  const universeNavItems: NavItem[] = [
    // Universe overview
    {
      title: userUniverse ? userUniverse.name : 'My Universe',
      url: '/universe',
      icon: Globe,
    },
    // Personal worlds
    ...personalWorlds.map((world: any) => ({
      title: world.name,
      url: `/worlds/${world.id}`,
      icon: Sparkles,
      badge: world.state === 'active' ? undefined : world.state,
    })),
  ];

  return {
    id: 'universe',
    title: 'Personal Universe',
    icon: Globe,
    showMainSidebar: true,
    navGroups: [
      {
        title: 'My Universe',
        items: universeNavItems,
      },
    ],
  };
}

/**
 * Generate organizational worlds section
 */
export function generateWorldsSection(worldData: any): GlobalSidebarSection {
  const organizationalWorlds = worldData ? Object.values(worldData).filter((world: any) => !world.universe_id) : [];
  
  // Group worlds by type for better organization
  const worldsByType = organizationalWorlds.reduce((acc: any, world: any) => {
    const type = world.world_type || 'business';
    if (!acc[type]) acc[type] = [];
    acc[type].push(world);
    return acc;
  }, {});

  const worldNavGroups: NavGroup[] = [
    {
      title: 'All Worlds',
      items: [
        {
          title: 'Worlds Overview',
          url: '/worlds',
          icon: Building2,
        },
      ],
    },
  ];

  // Add groups for each world type
  Object.entries(worldsByType).forEach(([type, worlds]: [string, any]) => {
    if (worlds.length > 0) {
      const typeConfig = {
        business: { title: 'Business Domains', icon: Building2 },
        client: { title: 'Client Worlds', icon: Building2 },
        department: { title: 'Departments', icon: Building2 },
        project_domain: { title: 'Project Domains', icon: Folder },
        personal: { title: 'Personal Worlds', icon: Sparkles },
      };

      const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.business;
      
      worldNavGroups.push({
        title: config.title,
        items: worlds.map((world: any) => ({
          title: world.name,
          url: `/worlds/${world.id}`,
          icon: config.icon,
          badge: world.state === 'active' ? undefined : world.state,
        })),
      });
    }
  });

  return {
    id: 'worlds',
    title: 'Business Worlds',
    icon: Building2,
    showMainSidebar: true,
    navGroups: worldNavGroups,
  };
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
        items: getHomeNavItems(),
      },
    ],
  },
  // Universe and Worlds sections (always shown)
  generateUniverseSection(null, null), // Will be populated with real data in store
  generateWorldsSection(null), // Will be populated with real data in store
  // Projects section will be dynamically generated (hidden when using entity routes)
  ...(!shouldHideBusinessRoutes() ? [generateProjectsSection()] : []),
  // Entities section shown when business routes are hidden
  ...(shouldHideBusinessRoutes() ? [generateEntitiesSection(null)] : []),
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
            title: 'Kanban Debug',
            url: '/debug/kanban',
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
      name: 'VibeStack',
      logo: Command,
      plan: 'Local First Platform',
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

/**
 * Generate dynamic entities section from organization schema
 */
export function generateEntitiesSection(schema: EntitySchema | null): GlobalSidebarSection {
  return {
    id: 'entities',
    title: 'Organization Entities',
    icon: IconFolder,
    showMainSidebar: true,
    navGroups: generateDynamicSidebarData(schema)
  }
}

// Helper function to get sidebar data for a specific global section
export function getSidebarDataForSection(
  sectionId: string, 
  projects: Project[] = [], 
  schema: EntitySchema | null = null, 
  universeData: any = null, 
  worldData: any = null
): NavGroup[] {
  if (sectionId === 'entities') {
    // Generate dynamic entities section with schema data
    const entitiesSection = generateEntitiesSection(schema)
    return entitiesSection.navGroups
  }
  
  if (sectionId === 'projects') {
    // Generate dynamic projects section with actual project data
    const projectsSection = generateProjectsSection(projects)
    return projectsSection.navGroups
  }

  if (sectionId === 'universe') {
    // Generate dynamic universe section with real data
    const universeSection = generateUniverseSection(universeData, worldData)
    return universeSection.navGroups
  }

  if (sectionId === 'worlds') {
    // Generate dynamic worlds section with real data
    const worldsSection = generateWorldsSection(worldData)
    return worldsSection.navGroups
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
