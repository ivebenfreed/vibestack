import React, { useMemo } from 'react'
import { CellContext, ColumnDef } from '@tanstack/react-table'
import {
  EditableTextCell,
  EditableSelectCell,
  EditableDateCell,
} from '@/components/data-table/data-table-editing'
import {
  createEditableEntityCell as createEditableEntityCellV2,
} from '@/components/data-table/data-table-logic'
import { Task, TaskStatus, TaskPriority, Project, User } from '@repo/dataforge/client-entities'
import { format } from 'date-fns'
import { EntityDataTable } from '@/components/data-table/data-table-entity'
import { TaskService } from '@/domain/task'
import { usePGliteContext } from '@/db/pglite-provider'

// V2 Cell Factories for Project and User
const EditableProjectCellV2 = createEditableEntityCellV2<Project>({
  serviceName: 'projects',
  getDisplayValue: (project) => project?.name || 'N/A',
  emptyLabel: 'No Project',
});

const EditableUserCellV2 = createEditableEntityCellV2<User>({
  serviceName: 'users',
  getDisplayValue: (user) => user?.name || user?.email || 'N/A',
  emptyLabel: 'Unassigned',
});

export function TasksDataTableNew() {
  // Use the new domain-based hook - much simpler!
  const { data: tasks, isLoading, error } = TaskService.hooks.useAllTasks()
  const { services } = usePGliteContext()
  
  // Create the live query builder for EntityDataTable
  const { createQueryBuilder, isDataSourceReady } = usePGliteContext()
  const liveQueryBuilder = useMemo(() => {
    if (!isDataSourceReady || !createQueryBuilder) return null
    return TaskService.createQueryBuilders(createQueryBuilder).all()
  }, [isDataSourceReady, createQueryBuilder])
  
  const columns = useMemo<ColumnDef<Task, any>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      enableSorting: true,
      enableHiding: true,
      size: 120,
      minSize: 80,
      maxSize: 200,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      enableHiding: false,
      size: 300,
      minSize: 200,
      cell: (props: CellContext<Task, string>) => (
        <div className="max-w-[300px] truncate">
          <EditableTextCell {...props} />
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      enableHiding: true,
      size: 400,
      minSize: 200,
      cell: (props: CellContext<Task, string>) => (
        <div className="max-w-[400px] truncate">
          <EditableTextCell {...props} />
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableHiding: true,
      size: 150,
      minSize: 120,
      cell: (props: CellContext<Task, TaskStatus>) => (
        <EditableSelectCell
          {...props}
          options={Object.values(TaskStatus).map(status => ({
            label: status,
            value: status
          }))}
        />
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      enableHiding: true,
      size: 150,
      minSize: 120,
      cell: (props: CellContext<Task, TaskPriority>) => (
        <EditableSelectCell
          {...props}
          options={Object.values(TaskPriority).map(priority => ({
            label: priority,
            value: priority
          }))}
        />
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      enableHiding: true,
      size: 180,
      minSize: 150,
      cell: (props: CellContext<Task, Date>) => <EditableDateCell {...props} />,
    },
    {
      accessorKey: 'completedAt',
      header: 'Completed At',
      enableHiding: true,
      size: 200,
      minSize: 180,
      cell: ({ getValue }: CellContext<Task, Date | null>) => {
        const date = getValue()
        return (
          <div className="whitespace-nowrap">
            {date ? format(date, 'PPP p') : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'projectId',
      header: 'Project',
      enableHiding: true,
      size: 200,
      minSize: 150,
      cell: (props: CellContext<Task, string>) => {
        const projectId = props.getValue()
        return (
          <div className="max-w-[200px] truncate" title={projectId || 'No Project'}>
            {projectId || 'No Project'}
          </div>
        )
      },
    },
    {
      accessorKey: 'assigneeId',
      header: 'Assignee',
      enableHiding: true,
      size: 200,
      minSize: 150,
      cell: (props: CellContext<Task, string>) => {
        const assigneeId = props.getValue()
        return (
          <div className="max-w-[200px] truncate" title={assigneeId || 'Unassigned'}>
            {assigneeId || 'Unassigned'}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      enableHiding: true,
      size: 180,
      minSize: 150,
      cell: ({ getValue }: CellContext<Task, Date>) => {
        const date = getValue()
        return (
          <div className="whitespace-nowrap">
            {format(date, 'PPP p')}
          </div>
        )
      },
    },
  ], [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-red-500">Error loading tasks: {error.message}</p>
      </div>
    )
  }

  if (!services?.tasks) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-muted-foreground">Task service not available</p>
      </div>
    )
  }

  return (
    <EntityDataTable
      tableId="tasks-new"
      entityType="task"
      entityMetadata={null} // We're using custom columns
      service={services.tasks}
      liveQueryBuilder={liveQueryBuilder}
      customColumns={columns}
      title="Tasks (New Pattern)"
      tableConfig={{
        enablePagination: false, // Disable pagination
        enableSorting: true,
        enableColumnResizing: true,
        pageSize: 1000, // Large number to show all tasks
      }}
      textFilterConfig={{
        columnId: 'title',
        placeholder: 'Search tasks...'
      }}
      facetedFilterConfigs={[
        {
          columnId: 'status',
          title: 'Status',
          options: Object.values(TaskStatus).map(status => ({
            label: status,
            value: status
          }))
        },
        {
          columnId: 'priority',
          title: 'Priority',
          options: Object.values(TaskPriority).map(priority => ({
            label: priority,
            value: priority
          }))
        }
      ]}
    />
  )
} 