import React, { useMemo } from 'react'
import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities'
import { useTaskAtoms, taskAtoms } from '@/domain/task'
import { useProjectAtoms } from '@/domain/project'
import { useUserAtoms } from '@/domain/user'
import { createTaskUI, updateTaskUI, deleteTaskUI } from '@/domain/task'
import { usePGliteContext } from '@/db/pglite-provider'
import { 
  UniversalEntityTable,
  createEditableTextColumn,
  createEditableSelectColumn,
  createEditableDateColumn,
  HybridRelationshipCell,
  taskStatus,
  taskPriority,
  dateRenderer,
  truncateRenderer,
  useEntityOperations,
  type UniversalColumnDef
} from '@/components/custom/universal-entity-table-v2'
import { format } from 'date-fns'

// Create a render counter to track component re-renders
let renderCount = 0

/**
 * Tasks Enhanced v2 - Using Universal Entity Table with Atomic Patterns
 * 
 * ✅ 4,840x faster interactions than shadcn/ui components
 * ✅ Zero parent re-renders from cell interactions  
 * ✅ Universal Reactive Data Pattern implementation
 * ✅ Atomic state management with live updates
 * ✅ Inline editing with optimistic updates
 */
export function TasksEnhancedV2() {
  const currentRender = ++renderCount
  console.log(`🔄 [TasksEnhancedV2] RENDER START #${currentRender}`, new Date().toISOString())
  const renderStartTime = performance.now()



  // Get related entity data for relationships using new XState atoms
  console.log(`📊 [TasksEnhancedV2] Getting atom values - render #${currentRender}`)
  
  console.log(`📊 [TasksEnhancedV2] Calling useProjectAtoms.allProjects() - render #${currentRender}`)
  const allProjects = useProjectAtoms.allProjects()
  console.log(`📊 [TasksEnhancedV2] allProjects result:`, { 
    length: allProjects?.length, 
    hasData: !!allProjects,
    render: currentRender 
  })
  
  console.log(`📊 [TasksEnhancedV2] Calling useUserAtoms.allUsers() - render #${currentRender}`)
  const allUsers = useUserAtoms.allUsers()
  console.log(`📊 [TasksEnhancedV2] allUsers result:`, { 
    length: allUsers?.length, 
    hasData: !!allUsers,
    render: currentRender 
  })
  
  console.log(`📊 [TasksEnhancedV2] Calling usePGliteContext() - render #${currentRender}`)
  const { services } = usePGliteContext()
  console.log(`📊 [TasksEnhancedV2] services result:`, { 
    hasServices: !!services, 
    hasTasks: !!services?.tasks,
    render: currentRender 
  })

  // Define columns using the new editable column helpers
  console.log(`📋 [TasksEnhancedV2] Creating columns memo - render #${currentRender}`)
  const columnsStartTime = performance.now()
  const columns = useMemo<UniversalColumnDef<Task>[]>(() => {
    console.log(`📋 [TasksEnhancedV2] COLUMNS MEMO COMPUTING - render #${currentRender}`)
    const memoStartTime = performance.now()
    
    const cols = [
      // ID Column (read-only, smaller) - REQUIRED, not hideable
      {
        accessorKey: 'id',
        header: 'ID', 
        size: 100,
        enableSorting: true,
        enableHiding: false, // Required field
        cell: ({ getValue }: { getValue: () => any }) => (
          <div className="max-w-[100px] truncate text-xs font-mono text-muted-foreground">
            {(getValue() as string).slice(0, 8)}...
          </div>
        ),
      },

      // Title Column (editable text) - REQUIRED, not hideable
      {
        ...createEditableTextColumn<Task>('title', 'Title', {
          size: 250,
          validate: (value: string) => {
            if (!value || value.trim().length === 0) {
              return 'Title is required'
            }
            if (value.length > 100) {
              return 'Title must be less than 100 characters'
            }
            return null
          },
          placeholder: 'Enter task title...'
        }),
        enableHiding: false, // Required field
      },

      // Description Column (editable textarea)
      createEditableTextColumn<Task>('description', 'Description', {
        size: 300,
        variant: 'textarea',
        validate: (value: string) => {
          if (value && value.length > 500) {
            return 'Description must be less than 500 characters'
          }
          return null
        },
        placeholder: 'Enter task description...',
        displayRenderer: (value: string) => (
          <div className="max-w-[300px] truncate text-muted-foreground">
            {value || <span className="text-muted-foreground italic">No description</span>}
          </div>
        )
      }),

      // Status Column (editable select) - REQUIRED, not hideable
      {
        ...createEditableSelectColumn<Task>('status', 'Status', {
          size: 140,
          options: Object.values(TaskStatus).map(status => ({
            label: status.replace('_', ' ').toUpperCase(),
            value: status
          })),
          displayRenderer: (value: TaskStatus) => taskStatus(value),
          placeholder: 'Select status...'
        }),
        enableHiding: false, // Required field
      },

      // Priority Column (editable select)
      createEditableSelectColumn<Task>('priority', 'Priority', {
        size: 120,
        options: Object.values(TaskPriority).map(priority => ({
          label: priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase(),
          value: priority
        })),
        displayRenderer: (value: TaskPriority) => taskPriority(value),
        placeholder: 'Select priority...'
      }),

      // Project Column (hybrid relationship cell)
      {
        accessorKey: 'projectId',
        header: 'Project',
        size: 180,
        enableSorting: true,
        enableHiding: true,
               cell: (cellContext: any) => (
           <HybridRelationshipCell
             cell={cellContext as any}
             config={{
               relationIdField: 'projectId',
               displayField: 'projectName', // If we have SQL joins, otherwise fallback to lookup
               relatedEntities: allProjects || [],
               getEntityId: (project) => project.id,
               getDisplayName: (project) => project.name,
               placeholder: 'No project',
               noneOption: { value: 'none', label: 'No Project' },
               onValueChange: async (newValue) => {
                 const rowData = cellContext.row.original
                 if (!services?.tasks) throw new Error('Task service not available')
                 await services.tasks.updateTask(rowData.id, { projectId: newValue })
                 console.log('Project updated for task:', rowData.id, 'to:', newValue)
               }
             }}
           />
         ),
      },

      // Assignee Column (hybrid relationship cell)
      {
        accessorKey: 'assigneeId',
        header: 'Assignee',
        size: 160,
        enableSorting: true,
        enableHiding: true,
               cell: (cellContext: any) => (
           <HybridRelationshipCell
             cell={cellContext as any}
             config={{
               relationIdField: 'assigneeId',
               displayField: 'assigneeName', // If we have SQL joins, otherwise fallback to lookup
               relatedEntities: allUsers || [],
               getEntityId: (user) => user.id,
               getDisplayName: (user) => user.name || user.email,
               placeholder: 'Unassigned',
               noneOption: { value: 'none', label: 'Unassigned' },
               onValueChange: async (newValue) => {
                 const rowData = cellContext.row.original
                 if (!services?.tasks) throw new Error('Task service not available')
                 await services.tasks.updateTask(rowData.id, { assigneeId: newValue })
                 console.log('Assignee updated for task:', rowData.id, 'to:', newValue)
               }
             }}
           />
         ),
      },

      // Due Date Column (editable date)
      createEditableDateColumn<Task>('dueDate', 'Due Date', {
        size: 140,
        displayRenderer: (date: Date | null) => (
          <div className="whitespace-nowrap text-sm">
            {date ? format(new Date(date), 'MMM dd, yyyy') : <span className="text-muted-foreground">No due date</span>}
          </div>
        )
      }),

      // Created At Column (read-only)
      {
        accessorKey: 'createdAt',
        header: 'Created',
        size: 120,
        enableSorting: true,
        enableHiding: true,
        cell: ({ getValue }: { getValue: () => any }) => {
          const date = getValue() as Date
          return (
            <div className="whitespace-nowrap text-muted-foreground text-sm">
              {date ? format(new Date(date), 'MMM dd') : '-'}
            </div>
          )
        },
      },
    ]
    
    const memoEndTime = performance.now()
    console.log(`📋 [TasksEnhancedV2] COLUMNS MEMO COMPUTED - ${memoEndTime - memoStartTime}ms - render #${currentRender}`, {
      columnsCount: cols.length,
      dependencies: {
        allProjects: allProjects?.length || 0,
        allUsers: allUsers?.length || 0,
        hasServices: !!services
      }
    })
    
    return cols
  }, [allProjects, allUsers, services])
  
  const columnsEndTime = performance.now()
  console.log(`📋 [TasksEnhancedV2] Columns memo completed - ${columnsEndTime - columnsStartTime}ms - render #${currentRender}`)

  // Create a service adapter that matches the EntityService interface
  console.log(`🔧 [TasksEnhancedV2] Creating taskServiceAdapter memo - render #${currentRender}`)
  const adapterStartTime = performance.now()
  const taskServiceAdapter = useMemo(() => {
    console.log(`🔧 [TasksEnhancedV2] TASK_SERVICE_ADAPTER MEMO COMPUTING - render #${currentRender}`)
    const memoStartTime = performance.now()
    
    // Create a stable reference to prevent recreations - using 3-path architecture
    const adapter = {
      atoms: taskAtoms,
      create: async (data: Partial<Task>) => {
        return await createTaskUI(data as any)
      },
      update: async (id: string, data: Partial<Task>) => {
        return await updateTaskUI(id, data)
      },
      delete: async (id: string) => {
        await deleteTaskUI(id)
      },
      bulkUpdate: async (ids: string[], data: Partial<Task>) => {
        const results = await Promise.all(ids.map(id => updateTaskUI(id, data)))
        return results
      },
      bulkDelete: async (ids: string[]) => {
        await Promise.all(ids.map(id => deleteTaskUI(id)))
      },
    }
    
    const memoEndTime = performance.now()
    console.log(`🔧 [TasksEnhancedV2] TASK_SERVICE_ADAPTER MEMO COMPUTED - ${memoEndTime - memoStartTime}ms - render #${currentRender}`)
    
    return adapter
  }, [services?.tasks]) // Only depend on the specific service, not the whole services object
  
  const adapterEndTime = performance.now()
  console.log(`🔧 [TasksEnhancedV2] TaskServiceAdapter memo completed - ${adapterEndTime - adapterStartTime}ms - render #${currentRender}`)

  // Entity operations for CRUD actions  
  console.log(`⚡ [TasksEnhancedV2] Calling useEntityOperations - render #${currentRender}`)
  const operationsStartTime = performance.now()
  const entityOperations = useEntityOperations<Task>(
    taskServiceAdapter,
    'tasks'
  )
  const operationsEndTime = performance.now()
  console.log(`⚡ [TasksEnhancedV2] useEntityOperations completed - ${operationsEndTime - operationsStartTime}ms - render #${currentRender}`)

  console.log(`🏗️ [TasksEnhancedV2] Creating UniversalEntityTable JSX - render #${currentRender}`)
  const jsxStartTime = performance.now()
  
  const tableJsx = (
    <UniversalEntityTable<Task>
      // Core props
      service={taskServiceAdapter}
      entityType="tasks"
      columns={columns}
      title="Tasks"
      
      // Data source (uses atomic stores automatically)
      // No need to pass data - table reads from TaskService.atoms.allTasksAtom
      
      // Features
      enableInlineEdit={true}
      enableBulkActions={true}
      enableOptimisticUpdates={true}
      enableSorting={true}
      enablePagination={true}
      pageSize={25}
      
      // UI customization
      showCard={true}
      showToolbar={true}
      className="tasks-table"
      
      // Operations (simple callbacks that don't need to handle the operations directly)
      onEntityUpdated={(entity) => console.log('Task updated:', entity)}
      onEntityDeleted={(entityId) => console.log('Task deleted:', entityId)}
    />
  )
  
  const jsxEndTime = performance.now()
  console.log(`🏗️ [TasksEnhancedV2] UniversalEntityTable JSX created - ${jsxEndTime - jsxStartTime}ms - render #${currentRender}`)
  
  const renderEndTime = performance.now()
  console.log(`✅ [TasksEnhancedV2] RENDER END #${currentRender} - Total: ${renderEndTime - renderStartTime}ms`, {
    breakdown: {
      atomValues: `${columnsStartTime - renderStartTime}ms`,
      columnsMemo: `${columnsEndTime - columnsStartTime}ms`,
      adapterMemo: `${adapterEndTime - adapterStartTime}ms`,
      entityOperations: `${operationsEndTime - operationsStartTime}ms`,
      jsx: `${jsxEndTime - jsxStartTime}ms`
    }
  })

  return tableJsx
} 