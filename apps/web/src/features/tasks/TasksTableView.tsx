import React from 'react'
import { VibeGridOptimus } from '@/components/custom/vibegridoptimus/VibeGridOptimus'
import { createVibeGrid } from '@/components/custom/vibegridoptimus/hooks/useValidatedVibeGrid'
import { tasksAtom, updateTaskUI } from '@/domain/task'
import { useTheme } from '@/context/theme-context'

/**
 * TasksTableView - Separated table view component to isolate createVibeGrid hook
 * This prevents the hook from being called when viewing other tabs
 */
export default function TasksTableView() {
  // Get theme and resolve 'system' to actual theme
  const { theme } = useTheme()
  const effectiveTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  // Create save handler that uses domain wrapper (handles dependencies automatically)
  const handleTaskSave = React.useCallback(async (id: string, column: string, value: any) => {
    console.log('[TasksTableView] 🚀 Save handler called:', { id, column, value })
    
    // Build the updates object
    const updates = { [column]: value }
    console.log('[TasksTableView] 🔧 Constructed updates object:', updates)
    console.log('[TasksTableView] 🔧 Updates object type:', typeof updates)
    console.log('[TasksTableView] 🔧 Updates object keys:', Object.keys(updates))
    console.log('[TasksTableView] 🔧 Updates object JSON:', JSON.stringify(updates))
    
    try {
      // Use domain wrapper that handles dependencies internally
      await updateTaskUI(id, updates)
      console.log('[TasksTableView] ✅ Task updated successfully')
    } catch (error) {
      console.error('[TasksTableView] ❌ Task update failed:', error)
      throw error
    }
  }, [])

  // ✅ TYPE-SAFE VIBEGRID: Enforces entity validation, data source, and column config
  const taskGridProps = createVibeGrid({
    entityName: "Task",
    atom: tasksAtom,
    onSave: handleTaskSave
  })

  console.log('[TasksTableView] 🔧 Grid props:', { 
    hasOnSave: !!taskGridProps.onSave,
    dataLength: taskGridProps.data.length 
  })

  return (
    <VibeGridOptimus
      {...taskGridProps}
      height={600}
      theme={effectiveTheme}
      className="border border-border rounded-lg"
    />
  )
}