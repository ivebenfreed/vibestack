import React from 'react'
import { VibeGridDex } from '@/components/custom/vibegriddex/VibeGridDex'
import { updateTaskUI } from '@/domain-dexie/task'
import { useTheme } from '@/context/theme-context'
import type { Task } from '@repo/dataforge/client-entities'
import type { Column } from '@/components/custom/vibegriddex/column-types'

/**
 * TasksTableView - Using VibeGridDex for Dexie-based data grid
 */
export default function TasksTableView() {
  // Get theme and resolve 'system' to actual theme
  const { theme } = useTheme()
  const effectiveTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  // Define columns for Task entity
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

  // Handle entity updates
  const handleEntityUpdate = React.useCallback(async (rowId: string, updates: Record<string, any>) => {
    console.log('[TasksTableView] 🚀 Updating task:', { rowId, updates })
    try {
      await updateTaskUI(rowId, updates)
      console.log('[TasksTableView] ✅ Task updated successfully')
    } catch (error) {
      console.error('[TasksTableView] ❌ Task update failed:', error)
      throw error
    }
  }, [])

  return (
    <VibeGridDex
      tableId="tasks-table"
      entityType="task"
      columns={columns}
      onEntityUpdate={handleEntityUpdate}
      height={600}
      className="border border-border rounded-lg"
      enableSorting
      enableFiltering
      enableVirtualScrolling
    />
  )
}