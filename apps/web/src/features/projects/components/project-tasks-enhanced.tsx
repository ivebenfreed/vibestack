import React, { useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { useLoaderData } from '@tanstack/react-router'
import { usePGliteContext } from '@/db/pglite-provider'
import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities'
import { TaskService } from '@/domain/task'
import { EnhancedDataTable } from '@/components/enhanced-table/enhanced-data-table'
import { format } from 'date-fns'

interface ProjectTasksEnhancedProps {
  projectId: string
  projectName?: string
}

export const ProjectTasksEnhanced = React.memo<ProjectTasksEnhancedProps>(({ projectId, projectName }) => {
  const { createQueryBuilder, isDataSourceReady } = usePGliteContext()

  // Get pre-loaded data from router loader (instant!)
  const loaderData = useLoaderData({ from: '/_authenticated/projects/$projectId' }) as { 
    project: any, 
    users: any[], 
    tasks: Task[] 
  }

  // Debug logging for loader data
  console.log(`[ProjectTasksEnhanced:${projectId}] Loader data:`, {
    tasksCount: loaderData.tasks?.length || 0,
    tasks: loaderData.tasks
  })

  // Create live query builder for real-time updates (project-specific tasks)
  const liveQueryBuilder = useMemo(() => {
    // Validate projectId early - if it's undefined, null, or empty, don't proceed
    const isValidProjectId = !!(projectId && typeof projectId === 'string' && projectId.trim() !== '' && projectId !== 'undefined')
    
    if (!isDataSourceReady || !createQueryBuilder || !isValidProjectId) {
      console.log('[ProjectTasksEnhanced] Skipping query builder creation:', {
        isDataSourceReady,
        hasCreateQueryBuilder: !!createQueryBuilder,
        isValidProjectId,
        projectId
      })
      return null
    }
    
    try {
      return TaskService.createQueryBuilders(createQueryBuilder).byProject(projectId)
    } catch (error) {
      console.error('[ProjectTasksEnhanced] Error creating query builder:', error)
      return null
    }
  }, [isDataSourceReady, createQueryBuilder, projectId])

  // Define columns (no project column since all tasks belong to this project)
  const columns = useMemo<ColumnDef<Task, any>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      size: 120,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      size: 300,
      cell: ({ getValue }) => (
        <div className="max-w-[300px] truncate font-medium">
          {getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 400,
      cell: ({ getValue }) => {
        const description = getValue() as string
        return (
          <div className="max-w-[400px] truncate text-muted-foreground">
            {description || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 150,
      cell: ({ getValue }) => {
        const status = getValue() as TaskStatus
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            status === TaskStatus.COMPLETED 
              ? 'bg-green-100 text-green-800' 
              : status === TaskStatus.IN_PROGRESS
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {status}
          </span>
        )
      },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      size: 150,
      cell: ({ getValue }) => {
        const priority = getValue() as TaskPriority
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            priority === TaskPriority.HIGH 
              ? 'bg-red-100 text-red-800' 
              : priority === TaskPriority.MEDIUM
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {priority}
          </span>
        )
      },
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      size: 180,
      cell: ({ getValue }) => {
        const date = getValue() as Date | null
        return (
          <div className="whitespace-nowrap">
            {date ? format(new Date(date), 'MMM dd, yyyy') : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'completedAt',
      header: 'Completed',
      size: 180,
      cell: ({ getValue }) => {
        const date = getValue() as Date | null
        return (
          <div className="whitespace-nowrap text-muted-foreground">
            {date ? format(new Date(date), 'MMM dd, yyyy') : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      size: 180,
      cell: ({ getValue }) => {
        const date = getValue() as Date
        return (
          <div className="whitespace-nowrap text-muted-foreground">
            {date ? format(new Date(date), 'MMM dd, yyyy') : '-'}
          </div>
        )
      },
    },
  ], [])

  return (
    <div className="mt-6">
      <EnhancedDataTable<Task>
        tableId={`project-tasks-enhanced-${projectId}`}
        title={projectName ? `${projectName} Tasks` : 'Project Tasks'}
        columns={columns}
        loaderData={loaderData.tasks}
        liveQueryBuilder={liveQueryBuilder}
        enableSorting={true}
        enablePagination={true}
        pageSize={10}
        showCard={true}
      />
    </div>
  )
})

ProjectTasksEnhanced.displayName = 'ProjectTasksEnhanced' 