import React from 'react'
import { SimpleUniversalTable } from '@/components/custom/universal-entity-table-v2/core/SimpleUniversalTable'
import { 
  TableColumns,
  createProjectColumn,
  createAssigneeColumn,
  createStatusColumn,
  createPriorityColumn
} from '@/components/custom/universal-entity-table-v2/features/columns'
import { tasksAtom, taskActions } from '@/domain/task'
import { projectsAtom } from '@/domain/project'
import { usersAtom } from '@/domain/user'
import type { Task, Project, User } from '@repo/dataforge/client-entities'
import { TaskStatus, TaskPriority } from '@repo/dataforge/client-entities'
import type { BulkEditField } from '@/components/custom/universal-entity-table-v2/features/bulk-edit-toolbar'
import { useSelector } from '@xstate/store/react'

/**
 * ✅ TASKS TABLE V3 - UNIVERSAL TABLE INTEGRATION
 * 
 * This component integrates our enhanced SimpleUniversalTable with the existing
 * tasks route and domain structure. It provides:
 * 
 * - Complete task management with all advanced features
 * - Search & filtering toolbar
 * - Bulk operations (delete, edit)
 * - Inline editing with validation
 * - Live updates via domain atoms
 * - Integration with existing task/project/user domains
 * - Stable relationship columns using componentized pattern
 */
export function TasksTableV3() {
  // Get related data for relationship columns using XState selectors
  const allProjects = useSelector(projectsAtom, (projects) => projects)
  const allUsers = useSelector(usersAtom, (users) => users)
  const allTasks = useSelector(tasksAtom, (tasks) => tasks)

  // ✅ EARLY RETURN: Don't render until we have basic data structure
  if (!allTasks || !allProjects || !allUsers) {
    return (
      <div className="w-full p-8 text-center">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    )
  }

  // Convert to arrays for the stable components
  const projectsArray = Object.values(allProjects)
  const usersArray = Object.values(allUsers)

  // Convert to options format for bulk edit
  const projectOptions = projectsArray.map((project: Project) => ({
    value: project.id,
    label: project.name
  }))

  const userOptions = usersArray.map((user: User) => ({
    value: user.id,
    label: user.name || user.email
  }))

  // ✅ STABLE UPDATE FUNCTION
  const handleUpdate = async (rowId: string, field: keyof Task, value: any) => {
    await taskActions.updateTask(rowId, { [field]: value } as Partial<Task>)
  }

  // ✅ BULK EDIT FIELD DEFINITIONS
  const bulkEditFields: BulkEditField[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Open', value: 'OPEN' },
        { label: 'In Progress', value: 'IN_PROGRESS' },
        { label: 'Completed', value: 'COMPLETED' },
        { label: 'Cancelled', value: 'CANCELLED' }
      ]
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: [
        { label: 'Low', value: 'LOW' },
        { label: 'Medium', value: 'MEDIUM' },
        { label: 'High', value: 'HIGH' },
        { label: 'Critical', value: 'CRITICAL' }
      ]
    },
    {
      key: 'assigneeId',
      label: 'Assignee',
      type: 'select',
      options: [
        { label: 'Unassigned', value: null },
        ...userOptions
      ]
    },
    {
      key: 'projectId',
      label: 'Project',
      type: 'select',
      options: [
        { label: 'No Project', value: null },
        ...projectOptions
      ]
    }
  ]

  // ✅ BULK ACTION HANDLERS
  const handleBulkDelete = async (selectedIds: string[]) => {
    console.log('Bulk deleting tasks:', selectedIds)
    try {
      for (const id of selectedIds) {
        await taskActions.deleteTask(id)
      }
    } catch (error) {
      console.error('Bulk delete failed:', error)
    }
  }

  const handleBulkUpdate = async (selectedIds: string[], updates: Partial<Task>) => {
    console.log('Bulk updating tasks:', selectedIds, updates)
    try {
      for (const id of selectedIds) {
        await taskActions.updateTask(id, updates)
      }
    } catch (error) {
      console.error('Bulk update failed:', error)
    }
  }

  // ✅ COLUMN DEFINITIONS WITH STABLE COMPONENTS
  const columns = [
    // Title Column (editable text) - REQUIRED, not hideable
    {
      ...TableColumns.text({
        accessorKey: 'title' as keyof Task,
        header: 'Title',
        size: 250,
        entityAtom: tasksAtom,
        updateAction: taskActions.updateTask,
        validate: (value) => {
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
      enableHiding: false // Required field
    },

    // Description Column (editable text)
    TableColumns.text({
      accessorKey: 'description' as keyof Task,
      header: 'Description',
      size: 300,
      entityAtom: tasksAtom,
      updateAction: taskActions.updateTask,
      validate: (value) => {
        if (value && value.length > 500) {
          return 'Description must be less than 500 characters'
        }
        return null
      },
      placeholder: 'Enter task description...'
    }),

    // Status Column (editable select) - REQUIRED, not hideable
    {
      ...createStatusColumn<Task>(
        tasksAtom,
        taskActions.updateTask,
        140,
        {
          'open': 'Open',
          'in_progress': 'In Progress',
          'completed': 'Completed',
          'cancelled': 'Cancelled'
        }
      ),
      enableHiding: false // Required field
    },

    // Priority Column (editable select)
    createPriorityColumn<Task>(
      tasksAtom,
      taskActions.updateTask,
      120,
      {
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High',
        'critical': 'Critical'
      }
    ),

    // ✅ PROJECT COLUMN - Using Stable Component
    createProjectColumn<Task>(
      projectsArray,
      handleUpdate,
      180
    ),

    // ✅ ASSIGNEE COLUMN - Using Stable Component
    createAssigneeColumn<Task>(
      usersArray,
      handleUpdate,
      160
    ),

    // Due Date Column (editable date picker)
    TableColumns.date({
      accessorKey: 'dueDate' as keyof Task,
      header: 'Due Date',
      size: 160,
      entityAtom: tasksAtom,
      updateAction: taskActions.updateTask,
      placeholder: 'Set due date...',
      validate: (value) => {
        if (value) {
          const selectedDate = new Date(value)
          const today = new Date()
          today.setHours(0, 0, 0, 0) // Start of today
          
          if (selectedDate < today) {
            return 'Due date cannot be in the past'
          }
        }
        return null
      },
      displayRenderer: (value) => {
        if (!value) {
          return <span className="text-muted-foreground italic">No due date</span>
        }
        
        try {
          const date = new Date(value)
          const today = new Date()
          const isOverdue = date < today
          
          return (
            <span className={isOverdue ? "text-red-600 font-medium" : "text-foreground"}>
              {date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
              {isOverdue && ' (Overdue)'}
            </span>
          )
        } catch {
          return <span className="text-muted-foreground">Invalid date</span>
        }
      }
    }),

    // Created At Column (display only)
    TableColumns.display({
      accessorKey: 'createdAt' as keyof Task,
      header: 'Created',
      size: 120,
      cell: (value) => new Date(value as string).toLocaleDateString()
    }),

    // Updated At Column (display only)
    TableColumns.display({
      accessorKey: 'updatedAt' as keyof Task,
      header: 'Updated',
      size: 120,
      cell: (value) => {
        if (!value) return <span className="text-muted-foreground">-</span>
        return new Date(value as string).toLocaleDateString()
      }
    }),

    // Actions Column
    TableColumns.actions({
      header: 'Actions',
      size: 120,
      actions: [
        {
          label: 'Edit',
          onClick: (task) => {
            console.log('Edit task:', task)
            // Could open a dialog or navigate to edit form
          },
          variant: 'outline' as const
        },
        {
          label: 'Delete',
          onClick: async (task) => {
            if (confirm(`Delete task "${(task as Task).title}"?`)) {
              await taskActions.deleteTask(task.id)
            }
          },
          variant: 'destructive' as const,
          disabled: (task) => (task as Task).status === TaskStatus.COMPLETED
        }
      ]
    })
  ]

  return (
    <SimpleUniversalTable
      entityAtom={tasksAtom}
      columns={columns}
      tableId="tasks-main-table"
      
      // Core Features
      enablePagination
      enableSelection
      enableSorting
      pageSize={25}
      
      // Advanced Features
      enableToolbar
      enableBulkActions
      enableBulkEdit
      searchPlaceholder="Search tasks by title, description..."
      entityType="tasks"
      
      // Action Handlers
      onBulkDelete={handleBulkDelete}
      onBulkUpdate={handleBulkUpdate}
      bulkEditFields={bulkEditFields}
      
      className="w-full"
    />
  )
} 