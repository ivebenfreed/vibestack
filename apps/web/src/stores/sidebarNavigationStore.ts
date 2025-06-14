import { createStore } from '@xstate/store'
import { useSelector } from '@xstate/store/react'
import { projectsAtom, projectActions } from '@/domain/project'
import { tasksAtom, taskActions } from '@/domain/task'
import { usersAtom, userActions } from '@/domain/user'
import { type NavGroup } from '@/components/layout/types'
import { 
  generateProjectsSection, 
  globalSidebarData,
  type GlobalSidebarSection 
} from '@/components/layout/data/sidebar-data'
import { Project } from '@repo/dataforge/client-entities'
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource'
import { Project as ProjectEntity, Task, User } from '@repo/dataforge/client-entities'
import { useMemo, useEffect, useRef } from 'react'
import { shallowEqual } from '@xstate/store'

// 🎯 TYPED: Export types for components
export type SidebarNavigation = {
  sections: Record<string, NavGroup[]>
  projectsCount: number
  lastUpdated: number
  computationTime: number
}

// 🎯 LOADING STATE: Prevent multiple simultaneous loads
let isLoadingProjects = false

// 🎯 XState Store for sidebar navigation state
export const sidebarNavigationStore = createStore({
  context: {
    navigation: {
      sections: {} as Record<string, NavGroup[]>,
      projectsCount: 0,
      lastUpdated: Date.now(),
      computationTime: 0
    } as SidebarNavigation,
    isLoading: false,
    lastProjectsHash: '', // Track changes to projects for selective updates
  },
  
  on: {
    updateNavigation: (context, event: { projects: Project[] }) => {
      const startTime = performance.now()
      
      if (import.meta.env.DEV) {
        console.log(`[SidebarNavigationStore] Recomputing navigation for ${event.projects.length} projects...`, {
          timestamp: new Date().toISOString(),
          projectIds: event.projects.map((p: Project) => p.id).slice(0, 3)
        })
      }
      
      const sectionsMap: Record<string, NavGroup[]> = {}
      
      // Handle projects section with dynamic data
      if (event.projects.length >= 0) { // Always include projects section, even if empty
        const projectsSection = generateProjectsSection(event.projects)
        sectionsMap['projects'] = projectsSection.navGroups
      }
      
      // Add static sections from globalSidebarData
      globalSidebarData.forEach(section => {
        if (section.id !== 'projects') { // Skip projects, we handle it above
          sectionsMap[section.id] = section.navGroups
        }
      })
      
      const endTime = performance.now()
      const computationTime = endTime - startTime
      
      if (import.meta.env.DEV) {
        console.log(`[SidebarNavigationStore] ✅ Navigation computed in ${computationTime.toFixed(2)}ms for ${event.projects.length} projects`)
      }
      
      // Create hash for change detection
      const projectsHash = event.projects.map(p => `${p.id}-${p.updatedAt}`).join(',')
      
      return {
        ...context,
        navigation: {
          sections: sectionsMap,
          projectsCount: event.projects.length,
          lastUpdated: Date.now(),
          computationTime
        },
        lastProjectsHash: projectsHash
      }
    },
    
    setLoading: (context, event: { isLoading: boolean }) => ({
      ...context,
      isLoading: event.isLoading
    }),
  }
})

// 🎯 COMPARTMENTALIZED LOADING: Use atom loading methods instead of direct DB calls
async function loadProjectsForSidebar() {
  // Prevent multiple simultaneous loads
  if (isLoadingProjects) {
    return
  }
  
  // ✅ WAIT FOR ROUTE LOADING: Check if we're in a route loading phase
  if (typeof window !== 'undefined' && (window as any).appActor) {
    const snapshot = (window as any).appActor.getSnapshot()
    const isRouteLoading = snapshot.context.isRouteLoading || false
    
    if (isRouteLoading) {
      console.log('[SidebarNavigation] 🔄 Route loading in progress - deferring sidebar data loading')
      return
    }
  }
  
  // ✅ CHECK ATOMS FIRST: Route loaders likely already populated them
  const { projectsAtom } = await import('@/domain/project')
  const { tasksAtom } = await import('@/domain/task')
  const { usersAtom } = await import('@/domain/user')
  
  const currentProjects = projectsAtom.get()
  const currentTasks = tasksAtom.get()
  const currentUsers = usersAtom.get()
  
  // If atoms are already populated, no need to load from database
  if (Object.keys(currentProjects).length > 0 || Object.keys(currentTasks).length > 0 || Object.keys(currentUsers).length > 0) {
    console.log('[SidebarNavigation] ✅ Atoms already populated by route loaders - skipping database loading')
    return
  }
  
  // ✅ FALLBACK: Only load if atoms are empty and provider is ready
  const { isGlobalDataSourceReady } = await import('@/db/global-datasource')
  
  if (!isGlobalDataSourceReady()) {
    console.log('[SidebarNavigation] Provider not ready yet, skipping atom loading')
    return
  }
  
  isLoadingProjects = true
  sidebarNavigationStore.trigger.setLoading({ isLoading: true })
  console.log('[SidebarNavigation] Atoms empty and provider ready - loading data via atoms...')
  
  try {
    // 🎯 SERIALIZED: Load atoms sequentially to avoid PGlite database contention
    console.log('[SidebarNavigation] Loading atoms sequentially to prevent database conflicts...')
    const { projectActions } = await import('@/domain/project')
    const { taskActions } = await import('@/domain/task')
    const { userActions } = await import('@/domain/user')
    
    await projectActions.ensureLoaded()
    await taskActions.ensureLoaded()
    await userActions.ensureLoaded()
    
    console.log('[SidebarNavigation] ✅ All atoms loaded successfully')
    
  } catch (error) {
    console.error('[SidebarNavigation] Failed to load data via atoms:', error)
  } finally {
    isLoadingProjects = false
    sidebarNavigationStore.trigger.setLoading({ isLoading: false })
  }
}

// ============================================================================
// React Hooks (XState Store API)
// ============================================================================

// 🎯 PERFORMANCE: Custom hook for sidebar navigation data
export function useSidebarNavigation(): SidebarNavigation {
  // 🎯 XSTATE SELECTOR: Get projects directly from atom with useSelector
  const projects = useSelector(
    projectsAtom,
    (projectsRecord) => {
      const projects = Object.values(projectsRecord);
      return projects.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime; // Latest first
      });
    },
    shallowEqual
  )
  
  // Get current navigation from store
  const navigation = useSelector(sidebarNavigationStore, (state) => state.context.navigation)
  const lastProjectsHash = useSelector(sidebarNavigationStore, (state) => state.context.lastProjectsHash)
  
  // 🎯 CONTROLLED LOADING: Use useEffect to prevent infinite loops
  const hasTriggeredLoad = useRef(false)
  
  useEffect(() => {
    // Only trigger load once when no projects and we're in browser
    if (projects.length === 0 && typeof window !== 'undefined' && !hasTriggeredLoad.current) {
      hasTriggeredLoad.current = true
      
      // ✅ FIXED: Check if provider is ready before loading
      // This prevents loading during provider initialization phase
      import('@/db/global-datasource').then(({ isGlobalDataSourceReady }) => {
        if (isGlobalDataSourceReady()) {
          loadProjectsForSidebar().catch(console.error)
        } else {
          console.log('[SidebarNavigation] Provider not ready, will wait for route-based loading')
          hasTriggeredLoad.current = false // Reset so we can try again later
        }
      })
    }
    
    // Reset flag when we have projects
    if (projects.length > 0) {
      hasTriggeredLoad.current = false
    }
  }, [projects.length])
  
  // 🎯 PERFORMANCE: Only update navigation when projects actually change
  useEffect(() => {
    const currentProjectsHash = projects.map(p => `${p.id}-${p.updatedAt}`).join(',')
    
    // Only update if projects hash changed or we have no navigation data
    if (currentProjectsHash !== lastProjectsHash || navigation.projectsCount === 0) {
      sidebarNavigationStore.trigger.updateNavigation({ projects })
    }
  }, [projects, lastProjectsHash, navigation.projectsCount])
  
  return navigation
}

// 🎯 CONVENIENCE: Hook for specific section navigation
export function useSectionNavigation(sectionId: string): NavGroup[] {
  const navigation = useSidebarNavigation()
  return navigation.sections[sectionId] || []
}

// 🎯 PERFORMANCE: Hook for navigation stats (debugging)
export function useSidebarNavigationStats(navigation?: SidebarNavigation) {
  // Accept navigation as parameter to avoid double computation
  const computedNavigation = navigation || useSidebarNavigation()
  
  return useMemo(() => ({
    sectionsCount: Object.keys(computedNavigation.sections).length,
    projectsCount: computedNavigation.projectsCount,
    totalNavItems: Object.values(computedNavigation.sections).reduce(
      (total, groups) => total + groups.reduce((groupTotal, group) => groupTotal + group.items.length, 0), 
      0
    ),
    lastUpdated: computedNavigation.lastUpdated
  }), [computedNavigation])
}

// 🎯 DIRECT STORE ACCESS: For advanced usage
export const useSidebarNavigationStore = {
  // Selectors
  navigation: () => useSelector(sidebarNavigationStore, (state) => state.context.navigation),
  isLoading: () => useSelector(sidebarNavigationStore, (state) => state.context.isLoading),
  
  // Actions
  updateNavigation: (projects: Project[]) => 
    sidebarNavigationStore.trigger.updateNavigation({ projects }),
  setLoading: (isLoading: boolean) => 
    sidebarNavigationStore.trigger.setLoading({ isLoading }),
} 