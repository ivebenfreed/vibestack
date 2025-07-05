import React from 'react'
import { VibeGridOptimus } from '@/components/custom/vibegridoptimus/VibeGridOptimus'
import { createVibeGrid } from '@/components/custom/vibegridoptimus/hooks/useValidatedVibeGrid'
import { tasksAtom } from '@/domain/task'
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

  // ✅ TYPE-SAFE VIBEGRID: Enforces entity validation, data source, and column config
  const taskGridProps = createVibeGrid({
    entityName: "Task",
    atom: tasksAtom
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