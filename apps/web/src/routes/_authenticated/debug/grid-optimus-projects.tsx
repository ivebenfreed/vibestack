import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { VibeGridOptimus } from '@/components/custom/vibegridoptimus/VibeGridOptimus'
import { ProjectColumns } from '@repo/dataforge/column-configurations'
import type { Project } from '@repo/dataforge/client-entities'
import { useSelector } from '@xstate/store/react'
import { projectsAtom, updateProjectUI } from '@/domain/project'
import { usersAtom } from '@/domain/user'
import { shallowEqual } from '@xstate/store'
import { useTheme } from '@/context/theme-context'

export const Route = createFileRoute('/_authenticated/debug/grid-optimus-projects')({
  component: GridOptimusProjectsPage,
})

function GridOptimusProjectsPage() {
  // Get theme and resolve 'system' to actual theme (same as projects page)
  const { theme } = useTheme()
  const effectiveTheme = React.useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  }, [theme])

  // Use XState atoms for data (same as working debug route)
  const projects = useSelector(projectsAtom, (projectsRecord) => Object.values(projectsRecord), shallowEqual)
  const users = useSelector(usersAtom, (usersRecord) => Object.values(usersRecord), shallowEqual)
  

  // State management for grid (same as projects page)
  const [sortColumns, setSortColumns] = React.useState<readonly import('react-data-grid').SortColumn[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Debug logging
  console.log('[GridOptimus] Projects:', projects.length)
  console.log('[GridOptimus] Users:', users.length)
  console.log('[GridOptimus] ProjectColumns:', Object.keys(ProjectColumns))
  console.log('[GridOptimus] ProjectColumns structure:', ProjectColumns)

  // Enhanced columns with relationship data (same pattern as main projects page)
  const enhancedColumns = React.useMemo(() => {
    console.log('[GridOptimus] Creating enhancedColumns...')
    console.log('[GridOptimus] ProjectColumns keys:', Object.keys(ProjectColumns))
    
    const { createdAt, updatedAt, clientId, ownerId, ...editableColumns } = ProjectColumns
    
    // Use relationship columns instead of ID columns, and add relationship options
    const columnsWithData = {
      ...editableColumns,
      createdAt, // Keep createdAt for reference
      updatedAt, // Keep updatedAt for reference
    }
    
    // Enhance owner column with user options
    if (columnsWithData.owner && users.length > 0) {
      columnsWithData.owner = {
        ...columnsWithData.owner,
        meta: {
          ...columnsWithData.owner.meta,
          config: {
            ...columnsWithData.owner.meta?.config,
            options: users.map(user => ({
              value: user.id,
              label: user.name || user.email || `User ${user.id.slice(0, 8)}`
            }))
          }
        }
      }
    }
    
    // Enhance members column with user options for multi-select
    if (columnsWithData.members && users.length > 0) {
      const membersOptions = users.map(user => ({
        value: user.id,
        label: user.name || user.email || `User ${user.id.slice(0, 8)}`
      }))
      
      columnsWithData.members = {
        ...columnsWithData.members,
        meta: {
          ...columnsWithData.members.meta,
          config: {
            ...columnsWithData.members.meta?.config,
            options: membersOptions
          }
        }
      }
    }
    
    console.log('[GridOptimus] Enhanced columns created:', columnsWithData)
    console.log('[GridOptimus] Enhanced columns keys:', Object.keys(columnsWithData))
    return columnsWithData
  }, [users])
  
  // Log the final enhanced columns result
  console.log('[GridOptimus] Final enhancedColumns:', enhancedColumns)
  
  // Handle project updates (same as working debug route)
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

  // Handle batch project updates for drag fill operations
  const handleProjectBatchUpdate = React.useCallback(async (
    batchUpdates: Array<{ id: string; updates: Partial<Project> }>
  ) => {
    try {
      setError(null)
      console.log('[ProjectBatch] 🚀 Starting batch update of', batchUpdates.length, 'projects')
      
      // For now, use Promise.allSettled to handle partial failures gracefully
      const results = await Promise.allSettled(
        batchUpdates.map(({ id, updates }) => updateProjectUI(id, updates))
      )
      
      // Count successes and failures
      const successes = results.filter(r => r.status === 'fulfilled').length
      const failures = results.filter(r => r.status === 'rejected').length
      
      console.log(`[ProjectBatch] ✅ Batch completed: ${successes} successful, ${failures} failed`)
      
      if (failures > 0) {
        const failureReasons = results
          .filter(r => r.status === 'rejected')
          .map(r => (r as PromiseRejectedResult).reason.message)
        console.warn('[ProjectBatch] ⚠️ Some updates failed:', failureReasons)
      }
      
    } catch (err) {
      console.error('❌ Batch update failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to update projects')
    }
  }, [])

  // Handle row click (same as projects page)
  const handleRowClick = React.useCallback((project: Project) => {
    console.log('🔍 Project clicked:', project)
  }, [])
  
  // Show loading/empty state if no data (same as working debug route)
  if (projects.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">VibeGridOptimus - Projects Test</h1>
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">No projects found. Please create some projects first.</p>
          <p className="text-sm text-muted-foreground mt-2">Projects: {projects.length}, Users: {users.length}</p>
        </div>
      </div>
    )
  }

  // Custom toolbar for VibeGridOptimus (similar to working debug route)
  const toolbar = (
    <div className="p-4 border-b border-border bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">VibeGridOptimus Next-Gen Test</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Testing clean architecture, DataForge integration, and optimized performance • {projects.length} projects
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}
      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md dark:bg-green-950 dark:border-green-800">
        <div className="text-sm text-green-800 dark:text-green-200">
          <strong>🚀 VibeGridOptimus Features:</strong>
          <ul className="mt-2 space-y-1 text-xs">
            <li>• <strong>Clean Architecture:</strong> Hook-based with separated concerns</li>
            <li>• <strong>DataForge First:</strong> 100% generated types and column configurations</li>
            <li>• <strong>Performance:</strong> Optimized memoization and stable references</li>
            <li>• <strong>Native Features:</strong> Copy/paste, drag fill, keyboard navigation</li>
          </ul>
        </div>
      </div>
    </div>
  )

  // Custom footer with stats (same as working debug route)
  const footer = (
    <div className="p-3 border-t border-border bg-background">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Architecture: Hook-based • Separated concerns • DataForge integration
        </div>
        <div>
          Performance: Optimized rendering • Stable references • Minimal re-renders
        </div>
      </div>
    </div>
  )

  // Empty state (same as working debug route)
  const emptyState = (
    <div className="text-center text-muted-foreground">
      <div className="text-lg font-medium mb-2">No projects found</div>
      <div className="text-sm">Create your first project to get started</div>
    </div>
  )

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">VibeGridOptimus Test</h1>
        <p className="text-muted-foreground">
          Testing the next-generation data grid with clean architecture and optimized performance
        </p>
      </div>

      <div className="h-full flex flex-col">
        <VibeGridOptimus<Project>
          data={projects}
          columns={enhancedColumns}
          onUpdate={handleProjectUpdate}
          onBatchUpdate={handleProjectBatchUpdate}
          onRowClick={handleRowClick}
          sortColumns={sortColumns}
          onSortColumnsChange={setSortColumns}
          height="calc(100vh - 300px)"
          enableSorting={true}
          enableRowSelection={false}
          enableVirtualization={true}
          isLoading={isLoading}
          error={error}
          toolbar={toolbar}
          footer={footer}
          emptyState={emptyState}
          className="flex-1"
          theme={effectiveTheme}
        />
      </div>
    </div>
  )
}