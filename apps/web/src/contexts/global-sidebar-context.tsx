import React, { createContext, useContext, useState, useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import { globalSidebarData, type GlobalSidebarSection, getSidebarDataForSection } from '@/components/layout/data/sidebar-data'
import { usePGliteContext } from '@/db/pglite-provider'
import { Project } from '@repo/dataforge/client-entities'
import { useLiveEntity } from '@/db/hooks/useLiveEntity'
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource'
import { SelectQueryBuilder } from 'typeorm'

interface GlobalSidebarContextType {
  activeSection: string
  setActiveSection: (sectionId: string) => void
  getActiveSectionData: () => GlobalSidebarSection | undefined
  shouldShowMainSidebar: () => boolean
  projects: Project[]
  isLoadingProjects: boolean
}

const GlobalSidebarContext = createContext<GlobalSidebarContextType | undefined>(undefined)

export function GlobalSidebarProvider({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState('home')
  const [projectQueryBuilder, setProjectQueryBuilder] = useState<SelectQueryBuilder<Project> | null>(null)
  const location = useLocation()
  const { services } = usePGliteContext()

  // Initialize project query builder for live updates
  useEffect(() => {
    const initializeQueryBuilder = async () => {
      try {
        const dataSource = await getNewPGliteDataSource()
        if (!dataSource.isInitialized) {
          await dataSource.initialize()
        }
        
        const projectsQB = dataSource
          .getRepository(Project)
          .createQueryBuilder('project')
          .orderBy('LOWER(project.name)', 'ASC')
        
        setProjectQueryBuilder(projectsQB)
        console.log('[GlobalSidebarProvider] Project query builder initialized for live updates')
      } catch (error) {
        console.error('[GlobalSidebarProvider] Error initializing project query builder:', error)
        setProjectQueryBuilder(null)
      }
    }
    
    if (services?.projects) {
      initializeQueryBuilder()
    }
  }, [services])

  // Use live entity hook for real-time project updates
  const { 
    data: projects, 
    loading: isLoadingProjects, 
    error: projectError 
  } = useLiveEntity<Project>(
    projectQueryBuilder,
    { 
      enabled: !!projectQueryBuilder,
      transform: true // Enable camelCase transformation
    }
  )

  // Log project updates for debugging
  useEffect(() => {
    if (projects && projects.length > 0) {
      console.log('[GlobalSidebarProvider] Projects updated via live query:', projects.length)
    }
  }, [projects])

  // Handle errors
  useEffect(() => {
    if (projectError) {
      console.error('[GlobalSidebarProvider] Project live query error:', projectError)
    }
  }, [projectError])

  // Auto-detect active section based on current route
  useEffect(() => {
    const pathname = location.pathname
    
    // Determine which global section should be active based on the current route
    if (pathname.startsWith('/projects') || pathname === '/tasks') {
      setActiveSection('projects')
    } else if (pathname.startsWith('/settings') || pathname.startsWith('/help-center')) {
      setActiveSection('settings')
    } else if (pathname.startsWith('/debug') || pathname.startsWith('/sign-') || pathname.startsWith('/forgot-') || pathname.startsWith('/otp') || pathname.match(/^\/(401|403|404|500|503)$/)) {
      setActiveSection('debug')
    } else {
      setActiveSection('home')
    }
  }, [location.pathname])

  const getActiveSectionData = () => {
    return globalSidebarData.find(section => section.id === activeSection)
  }

  const shouldShowMainSidebar = () => {
    const sectionData = getActiveSectionData()
    return sectionData?.showMainSidebar ?? true // Default to true if not specified
  }

  const value = {
    activeSection,
    setActiveSection,
    getActiveSectionData,
    shouldShowMainSidebar,
    projects: projects || [],
    isLoadingProjects: isLoadingProjects || false,
  }

  return (
    <GlobalSidebarContext.Provider value={value}>
      {children}
    </GlobalSidebarContext.Provider>
  )
}

export function useGlobalSidebar() {
  const context = useContext(GlobalSidebarContext)
  if (context === undefined) {
    throw new Error('useGlobalSidebar must be used within a GlobalSidebarProvider')
  }
  return context
} 