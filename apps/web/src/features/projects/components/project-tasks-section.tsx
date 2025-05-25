import React, { useMemo } from 'react'
import { CellContext, ColumnDef } from '@tanstack/react-table'
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
import { format } from 'date-fns'
import { EntityDataTable } from '@/components/data-table/data-table-entity'
import { statuses, priorities } from '../../tasks/data/data'
import { Card, CardContent } from '@/components/ui/card'
import { DataTableSkeleton } from '@/components/ui/table-skeleton'

// V2 Cell Factories for User (Project is not editable in this context since we're showing tasks for a specific project)
const EditableUserCellV2 = createEditableEntityCellV2<User>({
  serviceName: 'users',
  getDisplayValue: (user) => user?.name || user?.email || 'N/A',
  emptyLabel: 'Unassigned',
});

interface ProjectTasksSectionProps {
  projectId: string
  projectName?: string
}

// Memoize the component to prevent re-renders when unrelated parent data changes
const ProjectTasksSection = React.memo<ProjectTasksSectionProps>(({ projectId, projectName }) => {
  const { services, isLoading: servicesLoading, repositories } = usePGliteContext()

  const ormTaskRepository = useMemo(() => {
    if (repositories?.tasks) {
      if (typeof (repositories.tasks as any).getOrmRepository === 'function') {
        return (repositories.tasks as any).getOrmRepository();
      }
      console.warn("[ProjectTasksSection] repositories.tasks.getOrmRepository is not a function");
    }
    return undefined;
  }, [repositories]);
  
  // Create columns without projectId column since all tasks belong to this project
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

  // Memoize the live query builder to prevent recreation when unrelated props change
  const liveQueryBuilder = useMemo(() => {
    if (!services?.tasks?.getRepo()?.getOrmRepository) {
      return null;
    }
    
    return services.tasks.getRepo().getOrmRepository()
      .createQueryBuilder('task')
      .where('task.projectId = :projectId', { projectId })
      .orderBy('task.createdAt', 'DESC');
  }, [services?.tasks, projectId]); // Only depend on projectId, not the entire project object

  // Memoize the service configuration
  const serviceConfig = useMemo(() => ({
    getRepo: () => services.tasks.getRepo(),
    create: (data: Partial<Task>) => services.tasks.createTask({ ...data, projectId }), // Ensure new tasks belong to this project
    update: (id: string, data: Partial<Task>) => services.tasks.updateTask(id, data),
    delete: (id: string) => services.tasks.deleteTask(id),
    getById: (id: string) => services.tasks.get(id),
  }), [services?.tasks, projectId]);

  // Memoize related services
  const relatedServices = useMemo(() => 
    services?.users ? { user: services.users } : {}
  , [services?.users]);

  if (servicesLoading || !ormTaskRepository) {
    return (
      <Card className="mt-6">
        <CardContent className="p-6">
          <DataTableSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6">
      <EntityDataTable<Task>
        tableId={`project-tasks-${projectId}`} // Stable ID based only on projectId
        entityType="Task"
        entityMetadata={TaskEntityMetadata}
        liveQueryBuilder={liveQueryBuilder}
        service={serviceConfig}
        customColumns={columns}
        title={projectName ? `${projectName} Tasks` : 'Project Tasks'}
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
        customEditableColumns={['title', 'description', 'status', 'priority', 'dueDate', 'assigneeId']} // Note: projectId is not editable
        relatedServices={relatedServices}
        enableInlineCreate={true}
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
        initialNewRecordData={{
          projectId: projectId,
          status: TaskStatus.OPEN,
          priority: TaskPriority.MEDIUM
        }}
        onEntityCreated={(newTask) => {
          console.log('New task created:', newTask);
        }}
        onEntityDeleted={(taskId) => {
          console.log('Task deleted:', taskId);
        }}
        emptyState={
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">No tasks found for this project.</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first task to get started.</p>
          </div>
        }
      />
    </div>
  )
});

// Add display name for better debugging
ProjectTasksSection.displayName = 'ProjectTasksSection';

export default ProjectTasksSection 