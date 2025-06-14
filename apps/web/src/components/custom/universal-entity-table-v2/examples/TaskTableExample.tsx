import React from 'react'
import { SimpleUniversalTable } from '../core/SimpleUniversalTable'
import { TableColumns } from '../features/columns'
import { tasksAtom, taskActions } from '@/domain/task'
import type { Task } from '@repo/dataforge/client-entities'
import type { BulkEditField } from '../features/bulk-edit-toolbar'

/**
 * ✅ ENHANCED UNIVERSAL TABLE WITH ADVANCED FEATURES
 * 
 * This example demonstrates the complete SimpleUniversalTable feature set:
 * - Direct domain atom usage (tasksAtom, usersAtom, projectsAtom)
 * - Domain action pattern (taskActions.updateTask)
 * - Advanced features: toolbar, bulk actions, bulk editing
 * - No compatibility wrappers
 * - Atomic column components with individual cell state
 * - Stable column definitions (no memoization needed)
 */
export function TaskTableExample() {
  // ✅ BULK EDIT FIELD DEFINITIONS
  const bulkEditFields: BulkEditField[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'To Do', value: 'todo' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Done', value: 'done' }
      ]
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }
      ]
    }
  ]

  // ✅ BULK ACTION HANDLERS
  const handleBulkDelete = async (selectedIds: string[]) => {
    console.log('Bulk deleting tasks:', selectedIds)
    // In real app: await taskActions.deleteTasks(selectedIds)
    for (const id of selectedIds) {
      await taskActions.deleteTask(id)
    }
  }

  const handleBulkUpdate = async (selectedIds: string[], updates: Partial<Task>) => {
    console.log('Bulk updating tasks:', selectedIds, updates)
    // In real app: await taskActions.updateTasks(selectedIds, updates)
    for (const id of selectedIds) {
      await taskActions.updateTask(id, updates)
    }
  }
  const columns = [
    TableColumns.text({
      accessorKey: 'title' as keyof Task,
      header: 'Title',
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
      }
    }),

    TableColumns.select({
      accessorKey: 'status' as keyof Task,
      header: 'Status',
      entityAtom: tasksAtom,
      updateAction: taskActions.updateTask,
      options: [
        { value: 'todo', label: 'To Do' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'done', label: 'Done' }
      ]
    }),

    TableColumns.display({
      accessorKey: 'createdAt' as keyof Task,
      header: 'Created',
      cell: (value) => new Date(value).toLocaleDateString()
    }),

    TableColumns.actions({
      header: 'Actions',
      actions: [
        {
          label: 'Edit',
          onClick: (task) => console.log('Edit task:', task),
          variant: 'outline' as const
        },
        {
          label: 'Delete',
          onClick: (task) => taskActions.deleteTask(task.id),
          variant: 'destructive' as const,
          disabled: (task) => (task as Task).status === 'completed'
        }
      ]
    })
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Tasks</h1>
      
      <SimpleUniversalTable
        entityAtom={tasksAtom}
        columns={columns}
        tableId="tasks-table"
        title="Task Management"
        
        // Core Features
        enablePagination
        enableSelection
        enableSorting
        pageSize={25}
        
        // Advanced Features
        enableToolbar
        enableBulkActions
        enableBulkEdit
        searchPlaceholder="Search tasks..."
        entityType="tasks"
        
        // Action Handlers
        onBulkDelete={handleBulkDelete}
        onBulkUpdate={handleBulkUpdate}
        bulkEditFields={bulkEditFields}
        
        className="w-full"
      />
    </div>
  )
}

// ============================================================================
// COMPLETE FEATURE DEMONSTRATION
// ============================================================================

/*
🎯 FEATURES DEMONSTRATED IN THIS EXAMPLE:

✅ CORE TABLE FEATURES:
- XState store integration with stable state management
- Automatic selection column when enableSelection={true}
- Sorting, pagination, and filtering via XState store
- Stable column definitions with zero recreation

✅ SEARCH & FILTERING TOOLBAR:
- EntityTableToolbar with search input
- Column visibility controls
- Auto-search as you type
- Filter management

✅ BULK OPERATIONS:
- EntityTableBulkActions toolbar appears when rows selected
- Bulk delete functionality with domain action integration
- Custom bulk actions support
- Clear selection functionality

✅ BULK EDITING:
- EntityTableBulkEditToolbar with form fields
- Select fields for status, priority, etc.
- Direct domain action integration (handleBulkUpdate)
- Performance-optimized form controls

✅ ENHANCED UX:
- Selection count in pagination display
- Entity type labeling ("tasks" instead of "rows")
- Proper loading states during bulk operations
- Contextual toolbars that appear/hide based on selection

ARCHITECTURE BENEFITS:

✅ STABLE COLUMN DEFINITIONS:
- No useMemo/useCallback needed for column definitions
- TableColumns.* functions return stable objects
- TanStack Table sees consistent column identity
- Zero recreation on re-renders

✅ ATOMIC CELL STATE:
- Each cell has independent editing state via createAtom
- Zero interference between different cells
- Optimized re-rendering only when specific cell data changes

✅ DIRECT DOMAIN INTEGRATION:
- taskActions.updateTask called directly
- tasksAtom subscriptions for live data
- No service adapters or compatibility wrappers

✅ XSTATE STORE BENEFITS:
- Persistent table state across navigation
- Shared state between table instances
- Performance tracking built-in
- Event-driven state updates

USAGE PATTERN:

```typescript
<SimpleUniversalTable
  // Required
  entityAtom={tasksAtom}
  columns={columns}
  
  // Advanced Features
  enableToolbar        // Search & column controls
  enableBulkActions    // Bulk delete & custom actions
  enableBulkEdit       // Bulk editing form
  enableSelection      // Row selection
  
  // Domain Actions
  onBulkDelete={handleBulkDelete}
  onBulkUpdate={handleBulkUpdate}
  bulkEditFields={bulkEditFields}
/>
```

This pattern scales to any entity type - just swap the atom and actions!
*/ 