import React, { Suspense, useMemo } from 'react'
import { CellContext, ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  EditableTextCell,
  EditableSelectCell,
  EditableDateCell,
} from '@/components/custom/universal-entity-table/entity-table-editing'
import { Task, TaskStatus, TaskPriority, Project, User } from '@repo/dataforge/client-entities'
import { ContentContainer } from '@/components/layout/content-container'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { DataTableSkeleton } from '@/components/ui/table-skeleton'
import { useLoaderData } from '@tanstack/react-router'

// Import domain service hooks for explicit page-level data management
import { TaskService } from '@/domain/task'
import { ProjectService } from '@/domain/project'  
import { UserService } from '@/domain/user'

// Import the pure display table component - using ONLY entity table components
import { 
  UniversalEntityTable,
  EditableFilterableRelationshipCell,
  createTaskColumns,
} from '@/components/custom/universal-entity-table'
import { MinimalTable } from './MinimalTable'

/**
 * Universal Reactive Data Pattern Implementation
 * 
 * ✅ Router Loader → Global Live Query Manager → TanStack Query Cache → Components
 * ✅ Reference counted live query subscriptions prevent duplication
 * ✅ Relationship cells access cache directly via domain service cache keys
 * ✅ Smart fallback: live data || loader data || cached data || []
 * ✅ Zero prop drilling, zero hardcoded entity types, zero recursion
 */

function DataTableV2DebugPanel() {
  // Get preloaded data from route loader for instant display
  const loaderData = useLoaderData({ from: '/_authenticated/debug/data-table' }) as {
    tasks: Task[]
    projects: Project[]
    users: User[]
  }

  // EXPLICIT HOOK CALLS - Called once at page level for live updates
  // ✅ ALL data through domain service hooks (Universal Reactive Data Pattern)
  const { data: liveTasks, isLoading: tasksLoading, error: tasksError } = TaskService.hooks.useAllTasks()
  const { data: liveProjects, isLoading: projectsLoading, error: projectsError } = ProjectService.hooks.useAllProjects()
  const { data: liveUsers, isLoading: usersLoading, error: usersError } = UserService.hooks.useAllUsers()

  // EXPLICIT DATA SELECTION - Smart fallback with clear priority
  const currentTasks = useMemo(() => liveTasks || loaderData.tasks || [], [liveTasks, loaderData.tasks])
  const currentProjects = useMemo(() => liveProjects || loaderData.projects || [], [liveProjects, loaderData.projects])
  const currentUsers = useMemo(() => liveUsers || loaderData.users || [], [liveUsers, loaderData.users])

  // ✅ RELATIONSHIP DATA: No longer needed - cells access cache directly via Universal Reactive Data Pattern
  // Removed relationshipData prop drilling - relationship cells access QueryClient cache directly

  // Debug info available in UI instead of console

  // ✅ Memoize the TaskService for stable references
  const stableTaskService = useMemo(() => TaskService, [])
  const stableProjectService = useMemo(() => ProjectService, [])
  const stableUserService = useMemo(() => UserService, [])

  // ✅ Memoize relationship configs to prevent re-renders
  const projectRelationshipConfig = useMemo(() => ({
    cacheKey: stableProjectService.queryOptions.all().queryKey,
    getEntityId: (project: Project) => project.id,
    getDisplayValue: (project: Project) => project.name,
    emptyLabel: 'No Project',
  }), [stableProjectService])

  const userRelationshipConfig = useMemo(() => ({
    cacheKey: stableUserService.queryOptions.all().queryKey,
    getEntityId: (user: User) => user.id,
    getDisplayValue: (user: User) => user.name || user.email,
    emptyLabel: 'Unassigned',
  }), [stableUserService])

  // ✅ Use preset task columns with customizations for relationships
  const columns = useMemo<ColumnDef<Task, any>[]>(() => {
    const baseColumns = createTaskColumns({
      enableOptimisticUpdates: true
    })
    
    // Add relationship columns and custom columns
    const customColumns: ColumnDef<Task, any>[] = [
      {
        accessorKey: 'description',
        header: 'Description',
        enableHiding: true,
        size: 250,
        cell: (props: CellContext<Task, string>) => <EditableTextCell {...props} />,
      },
      {
        accessorKey: 'projectId',
        header: 'Project',
        enableHiding: true,
        size: 180,
        cell: (props: CellContext<Task, string>) => (
          <EditableFilterableRelationshipCell
            {...props}
            relationshipConfig={projectRelationshipConfig}
          />
        ),
      },
      {
        accessorKey: 'assigneeId',
        header: 'Assignee',
        enableHiding: true,
        size: 150,
        cell: (props: CellContext<Task, string>) => (
          <EditableFilterableRelationshipCell
            {...props}
            relationshipConfig={userRelationshipConfig}
          />
        ),
      },
      {
        accessorKey: 'tags',
        header: 'Tags',
        enableHiding: true,
        size: 150,
        cell: ({ getValue }: CellContext<Task, string[]>) => {
          const tags = getValue()
          return tags && tags.length > 0 ? tags.join(', ') : '-'
        },
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated At',
        enableHiding: true,
        size: 150,
        cell: ({ getValue }: CellContext<Task, Date>) => {
          const date = getValue()
          return date ? format(date, 'PPP p') : '-'
        },
      },
    ]
    
    // Combine preset columns with custom ones
    return [
      ...baseColumns.slice(0, 2), // title, status
      customColumns[0], // description
      baseColumns[2], // priority
      baseColumns[3], // dueDate
      customColumns[1], // projectId
      customColumns[2], // assigneeId  
      customColumns[3], // tags
      baseColumns[4], // createdAt
      customColumns[4], // updatedAt
    ]
  }, [stableProjectService, stableUserService, projectRelationshipConfig, userRelationshipConfig])

  // ✅ No page-level handlers needed - table uses modular editing system

  return (
    <ContentContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Universal Reactive Data Pattern</h1>
          <p className="text-muted-foreground">
            Router Loader → Global Live Query Manager → TanStack Query Cache → Components
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Universal Entity Table - Universal Reactive Data Pattern</CardTitle>
            <CardDescription>
              ✅ Global Live Query Manager • ✅ Direct Cache Access • ✅ Zero Prop Drilling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mt-4">
              {/* 🚨 DEBUGGING: Use minimal table to isolate performance issue */}
              <MinimalTable />
              
              {/* ✅ UNIVERSAL REACTIVE DATA PATTERN - Relationship cells access cache directly */}
              {/* <UniversalEntityTable<Task>
                entityType="tasks"
                data={currentTasks} // ✅ Smart fallback: live || loader || []
                columns={columns}
                title="Tasks - Universal Reactive Data Pattern"
                showCard={false}
                showToolbar={true}
                enableBulkActions={true}
                enableInlineEdit={true}
                enableOptimisticUpdates={true}
                enableSorting={true}
                enablePagination={true}
                pageSize={10}
                useContentWidth={false}
                service={stableTaskService} // ✅ Pass stable service for operations
              /> */}
            </div>
            
            {/* Implementation explanation */}
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  ✅ Universal Reactive Data Pattern Benefits
                </h4>
                <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
                  <div>• <strong>Global Live Query Manager:</strong> Reference counted subscriptions, zero duplication</div>
                  <div>• <strong>Direct Cache Access:</strong> Relationship cells access TanStack Query cache directly</div>
                  <div>• <strong>Zero Prop Drilling:</strong> No relationshipData props, service cache keys used directly</div>
                  <div>• <strong>Smart Fallback:</strong> live data || loader data || cached data || []</div>
                  <div>• <strong>Real-time Sync:</strong> Router loaders and live queries update same cache</div>
                  <div>• <strong>Performance:</strong> Automatic subscription deduplication and cleanup</div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  📋 Universal Reactive Data Pattern Implementation
                </h4>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <div className="font-mono bg-muted p-2 rounded mt-1">
                    {`// ✅ Complete Universal Reactive Data Pattern
function DataTablePage() {
  const loaderData = useLoaderData()
  
  // All hooks use Global Live Query Manager
  const { data: liveTasks } = TaskService.hooks.useAllTasks()
  const { data: liveProjects } = ProjectService.hooks.useAllProjects()
  const { data: liveUsers } = UserService.hooks.useAllUsers()
  
  // Smart fallback: live || loader || []
  const currentTasks = liveTasks || loaderData.tasks || []
  
  return (
    <UniversalEntityTable
      data={currentTasks}              // Explicit main data
      // ✅ Relationship cells access QueryClient cache directly
    />
  )
}`}
                  </div>
                  <div>• <strong>Architecture:</strong> Four-layer pattern with Global Live Query Manager</div>
                  <div>• <strong>Table Role:</strong> Display component with self-sufficient relationship cells</div>
                  <div>• <strong>Page Role:</strong> Smart fallback data selection via domain service hooks</div>
                  <div>• <strong>Cache Strategy:</strong> Router loader → TanStack Query cache ← Global Live Query Manager</div>
                  <div>• <strong>Relationship Cells:</strong> Direct service cache key access, no hardcoding</div>
                </div>
              </div>

              {/* Universal Reactive Data Pattern Debug */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Universal Reactive Data Pattern Debug</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• <strong>Router Loader:</strong> {loaderData.tasks?.length || 0} tasks, {loaderData.projects?.length || 0} projects, {loaderData.users?.length || 0} users</div>
                  <div>• <strong>Live Data (Global Manager):</strong> {liveTasks?.length || 0} tasks, {liveProjects?.length || 0} projects, {liveUsers?.length || 0} users</div>
                  <div>• <strong>Smart Fallback Result:</strong> {currentTasks.length} tasks, {currentProjects.length} projects, {currentUsers.length} users</div>
                  <div>• <strong>Global Live Query Manager:</strong> ✅ Reference counted subscriptions active</div>
                  <div>• <strong>Cache Access:</strong> Relationship cells use direct service cache keys</div>
                  <div>• <strong>Loading States:</strong> Tasks: {tasksLoading ? 'loading' : 'loaded'}, Projects: {projectsLoading ? 'loading' : 'loaded'}, Users: {usersLoading ? 'loading' : 'loaded'}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  );
}

export default DataTableV2DebugPanel;