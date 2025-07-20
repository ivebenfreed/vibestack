import { createFileRoute } from '@tanstack/react-router'
import Tasks from '@/features/tasks'
import { z } from 'zod'
import { db } from '@repo/dataforge/dexie-schema'
import { syncProcessView } from '@/components/custom/vibegriddex/utils/syncViewProcessor'
import type { Column } from '@/components/custom/vibegriddex/column-types'
import type { Task } from '@repo/dataforge/client-entities'

const tasksSearchSchema = z.object({
  view: z.enum(['table', 'kanban', 'timeline']).optional(),
})

export const Route = createFileRoute('/_authenticated/tasks/')({
  staleTime: 30_000, // Cache for 30 seconds
  loader: async () => {
    console.log('[Tasks Route] Loading tasks data from Dexie')
    
    // Define columns matching the TasksTableView component
    const columns: Column<Task>[] = [
      { id: 'title', field: 'title', name: 'Title', cellType: 'text', width: 300 },
      { id: 'description', field: 'description', name: 'Description', cellType: 'text', width: 400 },
      { id: 'status', field: 'status', name: 'Status', cellType: 'enum', width: 150,
        options: [
          { value: 'todo', label: 'To Do' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' }
        ]
      },
      { id: 'priority', field: 'priority', name: 'Priority', cellType: 'enum', width: 120,
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }
        ]
      },
      { id: 'dueDate', field: 'dueDate', name: 'Due Date', cellType: 'date', width: 150 },
      { id: 'projectId', field: 'projectId', name: 'Project', cellType: 'relationship-single', 
        width: 200, relationshipTable: 'projects', relationshipDisplayField: 'name' },
      { id: 'assigneeId', field: 'assigneeId', name: 'Assignee', cellType: 'relationship-single',
        width: 180, relationshipTable: 'users', relationshipDisplayField: 'name' },
      { id: 'createdAt', field: 'createdAt', name: 'Created', cellType: 'date', width: 150, editable: false },
      { id: 'updatedAt', field: 'updatedAt', name: 'Updated', cellType: 'date', width: 150, editable: false }
    ]
    
    // Load all necessary data in parallel
    const [tasks, users, projects] = await Promise.all([
      db.tasks.toArray(),
      db.users.toArray(),
      db.projects.toArray()
    ])
    
    // Create relationship data map
    const relationshipData: Record<string, any> = {
      users: Object.fromEntries(users.map(u => [u.id, u])),
      projects: Object.fromEntries(projects.map(p => [p.id, p]))
    }
    
    // Create relationship resolvers
    const relationshipResolvers: Record<string, (id: string | string[]) => string> = {
      projectId: (id: string | string[]) => {
        if (Array.isArray(id)) return id.join(', ')
        const project = relationshipData.projects[id]
        return project?.name || id
      },
      assigneeId: (id: string | string[]) => {
        if (Array.isArray(id)) return id.join(', ')
        const user = relationshipData.users[id]
        return user?.name || user?.email || id
      }
    }
    
    // Process view data to match VibeGridDex expectations
    const processedData = syncProcessView({
      entities: tasks,
      columns: columns,
      sortBy: [],
      filters: [],
      groupBy: [],
      columnVisibility: Object.fromEntries(columns.map(col => [col.id, true])),
      columnOrder: columns.map(col => col.id),
      rowHeight: 40,
      enableSelectionColumn: true,
      relationshipResolvers
    })
    
    console.log('[Tasks Route] Processed data:', {
      taskCount: tasks.length,
      processedRowCount: processedData.processedRows.length,
      columnCount: processedData.visibleColumns.length
    })
    
    return {
      tasks,
      relationshipData,
      initialData: {
        processedRows: processedData.processedRows,
        visibleColumns: processedData.visibleColumns,
        coordinateMapping: processedData.coordinateMapping,
        relationshipData,
        relationshipResolvers
      }
    }
  },
  validateSearch: tasksSearchSchema,
  component: Tasks,
})
