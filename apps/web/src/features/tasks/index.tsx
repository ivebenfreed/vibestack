import React, { Suspense, useMemo } from 'react'
import { CellContext, ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  EditableTextCell,
  EditableSelectCell,
  EditableDateCell,
} from '@/components/data-table/data-table-editing'
import {
  createEditableEntityCell as createEditableEntityCellV2,
  TaskEntityMetadata
} from '@/components/data-table/data-table-logic'
import { usePGliteContext } from '@/db/pglite-provider'
import { Task, TaskStatus, TaskPriority, Project, User } from '@repo/dataforge/client-entities'
import { Main } from '@/components/layout/main'
import { format } from 'date-fns'
import { DataTableSkeleton } from '@/components/ui/table-skeleton'
import { EntityDataTable } from '@/components/data-table/data-table-entity'
import TasksProvider from './context/tasks-context'
import { TasksDialogs } from './components/tasks-dialogs'
import { TasksPrimaryButtons } from './components/tasks-primary-buttons'
import { statuses, priorities } from './data/data'

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

function TasksDataTable() {
  const { services, isLoading: servicesLoading, repositories } = usePGliteContext()

  const ormTaskRepository = useMemo(() => {
    if (repositories?.tasks) {
      if (typeof (repositories.tasks as any).getOrmRepository === 'function') {
        return (repositories.tasks as any).getOrmRepository();
      }
      console.warn("[TasksPage] repositories.tasks.getOrmRepository is not a function");
    }
    return undefined;
  }, [repositories]);
  
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
      cell: (props: CellContext<Task, string>) => <EditableProjectCellV2 {...props} />,
    },
    {
      accessorKey: 'assigneeId',
      header: 'Assignee',
      enableHiding: true,
      size: 200,
      minSize: 150,
      cell: (props: CellContext<Task, string>) => <EditableUserCellV2 {...props} />,
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      enableHiding: true,
      size: 250,
      minSize: 150,
      cell: ({ getValue }: CellContext<Task, string[]>) => {
        const tags = getValue()
        return (
          <div className="max-w-[250px] truncate" title={tags && tags.length > 0 ? tags.join(', ') : undefined}>
            {tags && tags.length > 0 ? tags.join(', ') : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      enableHiding: true,
      size: 200,
      minSize: 180,
      cell: ({ getValue }: CellContext<Task, Date>) => {
        const date = getValue()
        return (
          <div className="whitespace-nowrap">
            {date ? format(date, 'PPP p') : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated At',
      enableHiding: true,
      size: 200,
      minSize: 180,
      cell: ({ getValue }: CellContext<Task, Date>) => {
        const date = getValue()
        return (
          <div className="whitespace-nowrap">
            {date ? format(date, 'PPP p') : '-'}
          </div>
        )
      },
    },
  ], [])

  if (servicesLoading || !ormTaskRepository) {
    return (
      <>
        <Main className="flex flex-col">
          <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>Tasks</h2>
              <p className='text-muted-foreground'>
                Here&apos;s a list of your tasks for this month!
              </p>
            </div>
            <TasksPrimaryButtons />
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>
                All Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTableSkeleton />
            </CardContent>
          </Card>
        </Main>
      </>
    );
  }

  return (
    <>
      <Main className="flex flex-col">
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Tasks</h2>
            <p className='text-muted-foreground'>
              Here&apos;s a list of your tasks for this month!
            </p>
          </div>
          <TasksPrimaryButtons />
        </div>
        <div className="mt-4">
          <EntityDataTable<Task>
            tableId="tasks-table"
            entityType="Task"
            entityMetadata={TaskEntityMetadata}
            liveQueryBuilder={services.tasks?.getRepo()?.getOrmRepository?.()?.createQueryBuilder('task').orderBy('task.createdAt', 'DESC')}
            service={{
              getRepo: () => services.tasks.getRepo(),
              create: (data) => services.tasks.createTask(data),
              update: (id, data) => services.tasks.updateTask(id, data),
              delete: (id) => services.tasks.deleteTask(id),
              getById: (id) => services.tasks.get(id),
            }}
            customColumns={columns}
            title="All Tasks"
            showCard={true}
            textFilterConfig={{ columnId: 'title', placeholder: 'Filter tasks by title...' }}
            facetedFilterConfigs={[
              {
                columnId: 'status',
                title: 'Status',
                options: statuses,
              },
              {
                columnId: 'priority',
                title: 'Priority',
                options: priorities,
              },
            ]}
            retryOnError={true}
            maxRetryAttempts={3}
            tableConfig={{
              enableSorting: true,
              enablePagination: true,
              pageSize: 10,
              enableColumnResizing: true
            }}
            defaultSorting={[]} // Start with no sorting applied
            customEditableColumns={['title', 'description', 'status', 'priority', 'dueDate', 'projectId', 'assigneeId']}
            enableBulkActions={true}
            bulkEditFields={[
              {
                key: 'status',
                label: 'Status',
                type: 'enum',
                options: Object.values(TaskStatus).map(status => ({
                  label: status,
                  value: status
                }))
              },
              {
                key: 'priority',
                label: 'Priority',
                type: 'enum',
                options: Object.values(TaskPriority).map(priority => ({
                  label: priority,
                  value: priority
                }))
              }
            ]}
            relatedServices={services?.projects && services?.users ? {
                project: services.projects,
                user: services.users
              } : {}}
            onEntityCreated={(newTask) => {
              console.log('New task created:', newTask);
            }}
            onEntityDeleted={(taskId) => {
              console.log('Task deleted:', taskId);
            }}
          />
        </div>
      </Main>
    </>
  );
}

/**
 * Main Tasks Feature Component
 * Responsible for initializing context and rendering the task display.
 * Uses EntityDataTable with live queries for real-time updates and editing.
 */
const Tasks: React.FC = () => {
  return (
    <TasksProvider>
      <TasksDataTable />
      <TasksDialogs />
    </TasksProvider>
  )
}

export default Tasks;
