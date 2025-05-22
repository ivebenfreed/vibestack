import React, { Suspense, useMemo } from 'react'
import { CellContext, ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  EditableTextCell,
  EditableSelectCell,
  EditableDateCell,
  // EditableRelationshipCell, // No longer directly imported, used via factory
  createEditableEntityCell as createEditableEntityCellV2
} from '@/components/data-table/data-table-logic' // Updated import path
import { usePGliteContext } from '@/db/pglite-provider'
import { Task, TaskStatus, TaskPriority, Project, User } from '@repo/dataforge/client-entities' // Added Project, User
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { SearchProvider } from '@/context/search-context'
import { format } from 'date-fns'
import { DataTableSkeleton } from '@/components/ui/table-skeleton'
import { EntityDataTable } from '@/components/data-table/data-table-entity' // Updated import path and component name

// Note: V1 pluginRegistry and DataTableErrorBoundary removed for initial V2 testing.
// These may need to be re-introduced or adapted if V2 components require them.

// V2 Cell Factories for Project and User
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
            label: status,
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
            label: priority,
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

  if (servicesLoading || !ormTaskRepository) {
    return (
      <SearchProvider>
        <Header />
        <Main className="flex flex-col pt-4 px-4">
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
      </SearchProvider>
    );
  }

  return (
    <SearchProvider>
      <Header />
      <Main className="flex flex-col pt-4 px-4">
        <div className="mt-4">
          <EntityDataTable<Task>
            tableId="debug-tasks-table-v2"
            // repository prop might not be directly applicable to EntityDataTable,
            // it expects liveQueryBuilder and service props.
            // For now, keeping ormTaskRepository to see if it's used internally by EntityDataTable
            // or if it needs to be adapted to service/liveQueryBuilder.
            // This will likely cause a type error if EntityDataTable doesn't accept 'repository'.
            // The 'service' and 'liveQueryBuilder' props will be critical.
            // We need to pass the entityType as well.
            entityType="Task" // Added entityType
            liveQueryBuilder={services.tasks?.getRepo()?.getOrmRepository?.()?.createQueryBuilder('task')}
            service={{
              getRepo: () => services.tasks.getRepo(),
              create: (data) => services.tasks.createTask(data),
              update: (id, data) => services.tasks.updateTask(id, data),
              delete: (id) => services.tasks.deleteTask(id),
              getById: (id) => services.tasks.get(id), // Assuming EntityDataTable might use this
            }}
            customColumns={columns}
            title="Tasks - V2 Data Table Test"
            showCard={true}
            textFilterConfig={{ columnId: 'title', placeholder: 'Filter tasks by title...' }}
            retryOnError={true}
            maxRetryAttempts={3}
            tableConfig={{
              enableSorting: true,
              enablePagination: true,
              pageSize: 10 // Also moving defaultPageSize here as pageSize
            }}
            customEditableColumns={['title', 'description', 'status', 'priority', 'dueDate', 'projectId', 'assigneeId']}
            relatedServices={ services?.projects && services?.users ? {
                project: services.projects,
                user: services.users
              } : {} }
          />
        </div>
      </Main>
    </SearchProvider>
  );
}

export default DataTableV2DebugPanel;