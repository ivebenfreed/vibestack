import React, { useEffect, useState, useMemo } from 'react';
import { ContentContainer } from '@/components/layout/content-container';
import ProjectsProvider from './context/projects-context';
import { ProjectsDialogs } from './components/projects-dialogs';
import { ProjectsPrimaryButtons } from './components/projects-primary-buttons';
import { usePGliteContext } from '@/db/pglite-provider';
import { Project } from '@repo/dataforge/client-entities';
import { useSelector } from '@xstate/store/react';
import { projectsAtom, updateProjectUI } from '@/domain/project';
import { usersAtom } from '@/domain/user';
import { shallowEqual } from '@xstate/store';
import { useLoaderData } from '@tanstack/react-router';
import { VibeGridOptimus } from '@/components/custom/vibegridoptimus/VibeGridOptimus';
import { useTheme } from '@/context/theme-context';
import { useStableEntityArray } from '@/hooks/useStableEntityArray';

/**
 * Main Projects Feature Component
 * Displays projects in VibeGridOptimus with real-time updates
 * Now uses XState atomic reactivity with surgical updates
 */
const Projects: React.FC = () => {
  // Get theme and resolve 'system' to actual theme - React Compiler will optimize this
  const { theme } = useTheme()
  const effectiveTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  // 🎯 XSTATE REACTIVITY: Stable array that only changes when data actually changes
  const projects = useStableEntityArray(projectsAtom)

  // Get users for relationship data - using stable array
  const users = useStableEntityArray(usersAtom)

  // No default sorting - let VibeGridOptimus handle all sorting internally
  const [sortColumns, setSortColumns] = useState<readonly import('react-data-grid').SortColumn[]>([])


  // Loading and error states
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle project updates
  const handleProjectUpdate = React.useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      setError(null)
      
      // Try the update as-is first - DataForge should handle many-to-many relationships
      await updateProjectUI(id, updates)
      console.log('✅ Project updated successfully:', { id, updates })
    } catch (err) {
      console.error('❌ Failed to update project:', err)
      setError(err instanceof Error ? err.message : 'Failed to update project')
    }
  }, [])

  // Handle row click
  const handleRowClick = React.useCallback((project: Project) => {
    console.log('🔍 Project clicked:', project)
  }, [])

  // No need for manual column configuration - VibeGridOptimus handles this automatically!


  // Custom toolbar for VibeGridOptimus
  const toolbar = (
    <div className="p-4 border-b border-border bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Projects</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your projects and track their progress • {projects.length} projects
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ProjectsPrimaryButtons />
        </div>
      </div>
      {error && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}
    </div>
  )

  // Custom footer with stats
  const footer = (
    <div className="p-3 border-t border-border bg-background">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Features: DataForge entities • XState atoms • Real-time updates
        </div>
        <div>
          Performance: High-speed grid • Virtual scrolling • Instant updates
        </div>
      </div>
    </div>
  )

  // Empty state
  const emptyState = (
    <div className="text-center text-muted-foreground">
      <div className="text-lg font-medium mb-2">No projects found</div>
      <div className="text-sm">Create your first project to get started</div>
    </div>
  )

  return (
    <ProjectsProvider>
      <ContentContainer>
        <div className="h-full flex flex-col">
          <VibeGridOptimus
            entityName="Project"
            data={projects}
            onSave={async (id, column, value) => {
              await handleProjectUpdate(id, { [column]: value });
            }}
            height="calc(100vh - 200px)"
            className="flex-1"
          />
        </div>
      </ContentContainer>

      <ProjectsDialogs />
    </ProjectsProvider>
  );
};

export default Projects; 