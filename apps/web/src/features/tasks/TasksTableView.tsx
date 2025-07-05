import React from 'react'
import { VibeGridOptimus } from '@/components/custom/vibegridoptimus/VibeGridOptimus'
import { createVibeGrid } from '@/components/custom/vibegridoptimus/hooks/useValidatedVibeGrid'
import { tasksAtom, getTaskDependencies } from '@/domain/task'
import { useTheme } from '@/context/theme-context'
import { updateTaskUI } from '@repo/dataforge/task-operations'

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

  // Create save handler that uses DataForge operations directly
  const handleTaskSave = React.useCallback(async (id: string, column: string, value: any) => {
    console.log('[TasksTableView] 🚀 Save handler called:', { id, column, value })
    console.log('[TasksTableView] 📍 Checkpoint 1: About to get dependencies')
    try {
      // Get dependencies and call DataForge operation directly
      const dependencies = await getTaskDependencies()
      console.log('[TasksTableView] 📍 Checkpoint 2: Got dependencies, calling updateTaskUI')
      await updateTaskUI(id, { [column]: value }, dependencies)
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