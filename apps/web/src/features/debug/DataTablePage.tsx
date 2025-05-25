import React, { Suspense, useMemo } from 'react'
import { CellContext, ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  EditableTextCell,
  EditableSelectCell,
  EditableDateCell,
  createEditableEntityCell as createEditableEntityCellV2,
  TaskEntityMetadata
} from '@/components/data-table/data-table-logic'
import { usePGliteContext } from '@/db/pglite-provider'
import { Task, TaskStatus, TaskPriority, Project, User } from '@repo/dataforge/client-entities'
import { Main } from '@/components/layout/main'
import { toast } from 'sonner'

import { format } from 'date-fns'
import { DataTableSkeleton } from '@/components/ui/table-skeleton'
import { EntityDataTable } from '@/components/data-table/data-table-entity'

// Clean separation of concerns:
// - data-table-logic.tsx: TypeORM integration, metadata utilities, column generation
// - data-table-entity.tsx: Main EntityDataTable component logic  
// - data-table-editing.tsx: Editable cell components
// - This file: Usage-specific configuration and column definitions

// Cell factories for relationship columns (Project and User)
const EditableProjectCellV2 = createEditableEntityCellV2<Project>({
  serviceName: 'projects', // This key must match the key in PGliteContext services
  getDisplayValue: (project) => project?.name || 'N/A',
  emptyLabel: 'No Project',
});

const EditableUserCellV2 = createEditableEntityCellV2<User>({
  serviceName: 'users', // This key must match the key in PGliteContext services
  getDisplayValue: (user) => user?.name || user?.email || 'N/A',
  emptyLabel: 'Unassigned',
});

function DataTableV2DebugPanel() {
  const { services, isLoading: servicesLoading, repositories } = usePGliteContext()

  const ormTaskRepository = useMemo(() => {
    if (repositories?.tasks) {
      if (typeof (repositories.tasks as any).getOrmRepository === 'function') {
        return (repositories.tasks as any).getOrmRepository();
      }
      console.warn("[DataTablePage] repositories.tasks.getOrmRepository is not a function");
    }
    return undefined;
  }, [repositories]);
  
  const columns = useMemo<ColumnDef<Task, any>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      enableHiding: false,
      cell: (props: CellContext<Task, string>) => <EditableTextCell {...props} />,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      enableHiding: true,
      cell: (props: CellContext<Task, string>) => <EditableTextCell {...props} />,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableHiding: true,
      cell: (props: CellContext<Task, TaskStatus>) => (
        <EditableSelectCell
          {...props}
          options={Object.values(TaskStatus).map(status => ({
            label: status.replace('_', ' ').toUpperCase(),
            value: status
          }))}
        />
      ),
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      enableHiding: true,
      cell: (props: CellContext<Task, TaskPriority>) => (
        <EditableSelectCell
          {...props}
          options={Object.values(TaskPriority).map(priority => ({
            label: priority.charAt(0).toUpperCase() + priority.slice(1),
            value: priority
          }))}
        />
      ),
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      enableHiding: true,
      cell: (props: CellContext<Task, Date>) => <EditableDateCell {...props} />,
    },
    {
      accessorKey: 'completedAt',
      header: 'Completed At',
      enableHiding: true,
      cell: ({ getValue }: CellContext<Task, Date | null>) => {
        const date = getValue()
        return date ? format(date, 'PPP p') : '-'
      },
    },
    {
      accessorKey: 'projectId',
      header: 'Project',
      enableHiding: true,
      cell: (props: CellContext<Task, string>) => <EditableProjectCellV2 {...props} />,
    },
    {
      accessorKey: 'assigneeId',
      header: 'Assignee',
      enableHiding: true,
      cell: (props: CellContext<Task, string>) => <EditableUserCellV2 {...props} />,
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      enableHiding: true,
      cell: ({ getValue }: CellContext<Task, string[]>) => {
        const tags = getValue()
        return tags && tags.length > 0 ? tags.join(', ') : '-'
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      enableHiding: true,
      cell: ({ getValue }: CellContext<Task, Date>) => {
        const date = getValue()
        return date ? format(date, 'PPP p') : '-'
      },
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated At',
      enableHiding: true,
      cell: ({ getValue }: CellContext<Task, Date>) => {
        const date = getValue()
        return date ? format(date, 'PPP p') : '-'
      },
    },
  ], [])

  // Event handlers for inline operations
  const handleEntityCreated = (newTask: Task) => {
    console.log('New task created:', newTask);
    toast.success(`Task "${newTask.title}" created successfully!`);
  };

  const handleEntityUpdated = (updatedTask: Task) => {
    console.log('Task updated:', updatedTask);
    toast.success(`Task "${updatedTask.title}" updated successfully!`);
  };

  const handleEntityDeleted = (taskId: string) => {
    console.log('Task deleted:', taskId);
    toast.success('Task deleted successfully!');
  };

  if (servicesLoading || !ormTaskRepository) {
    return (
      <>
        <Main className="flex flex-col">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>
                Tasks - V2 Data Table Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <DataTableSkeleton />
                <div className="text-xs text-muted-foreground">
                  {servicesLoading ? "Loading database services..." :
                   !repositories ? "Initializing repositories..." :
                   !repositories.tasks ? "Initializing task repository..." :
                   !ormTaskRepository ? "Obtaining ORM task repository..." :
                   "Loading tasks..."}
                </div>
              </div>
            </CardContent>
          </Card>
        </Main>
      </>
    );
  }

  return (
    <>
      <Main className="flex flex-col">
        <div className="mt-4">
          <EntityDataTable<Task>
            tableId="debug-tasks-table-v2"
            entityType="Task"
            entityMetadata={TaskEntityMetadata}
            liveQueryBuilder={services.tasks?.getRepo()?.getOrmRepository?.()?.createQueryBuilder('task')}
            service={{
              getRepo: () => services.tasks.getRepo(),
              create: (data) => services.tasks.createTask(data),
              update: (id, data) => services.tasks.updateTask(id, data),
              delete: (id) => services.tasks.deleteTask(id),
              getById: (id) => services.tasks.get(id),
            }}
            customColumns={columns}
            title="Tasks - V2 Data Table Test (with Inline Create)"
            showCard={true}
            textFilterConfig={{ columnId: 'title', placeholder: 'Filter tasks by title...' }}
            facetedFilterConfigs={[
              {
                columnId: 'status',
                title: 'Status',
                options: Object.values(TaskStatus).map(status => ({
                  label: status.replace('_', ' ').toUpperCase(),
                  value: status
                }))
              },
              {
                columnId: 'priority',
                title: 'Priority',
                options: Object.values(TaskPriority).map(priority => ({
                  label: priority.charAt(0).toUpperCase() + priority.slice(1),
                  value: priority
                }))
              }
            ]}
            retryOnError={true}
            maxRetryAttempts={3}
            tableConfig={{
              enableSorting: true,
              enablePagination: true,
              pageSize: 10
            }}
            customEditableColumns={['title', 'description', 'status', 'priority', 'dueDate', 'projectId', 'assigneeId']}
            relatedServices={services?.projects && services?.users ? {
              project: services.projects,
              user: services.users
            } : {}}
            // Inline create functionality
            enableInlineCreate={true}
            initialNewRecordData={{
              status: TaskStatus.OPEN,
              priority: TaskPriority.MEDIUM,
              tags: []
            }}
            onEntityCreated={handleEntityCreated}
            onEntityUpdated={handleEntityUpdated}
            onEntityDeleted={handleEntityDeleted}
            // Empty state customization
            emptyState={
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No tasks found
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by creating your first task using the "Add Record" button below.
                </p>
              </div>
            }
          />
        </div>
      </Main>
    </>
  );
}

export default DataTableV2DebugPanel;