/**
 * Auto Service Detection Example
 * 
 * Shows the difference between manual service adapter creation
 * and automatic service detection
 */

import React, { useMemo } from 'react'
import { UniversalEntityTable, createEditableTextColumn, type EntityService } from '../index'
import { usePGliteContext } from '@/db/pglite-provider'
import { TaskService } from '@/domain/task'
import type { Task } from '@repo/dataforge/client-entities'

// ❌ OLD WAY (verbose, duplicated in every component)
export function ManualServiceExample({ tasks }: { tasks: Task[] }) {
  // This logic would be duplicated in every page component
  const { services } = usePGliteContext()
  
  const taskEntityService = useMemo(() => {
    if (!services?.tasks) {
      throw new Error('Task service not available from context')
    }
    const taskService = services.tasks
    
    return {
      create: async (data: Partial<Task>) => taskService.createTask(data as any),
      update: async (id: string, changes: Partial<Task>) => taskService.updateTask(id, changes),
      delete: async (id: string) => { await taskService.deleteTask(id) },
      bulkUpdate: async (ids: string[], changes: Partial<Task>) => {
        const results = await Promise.all(ids.map(id => taskService.updateTask(id, changes)))
        return results
      },
      bulkDelete: async (ids: string[]) => {
        await Promise.all(ids.map(id => taskService.deleteTask(id)))
      },
    }
  }, [services])

  const columns = [
    createEditableTextColumn<Task>('title', 'Title', { size: 200 }),
    createEditableTextColumn<Task>('description', 'Description', { size: 250 }),
  ]

  return (
    <UniversalEntityTable<Task>
      data={tasks}
      entityType="tasks"
      columns={columns}
      service={taskEntityService} // Manual service adapter
      enableInlineEdit={true}
    />
  )
}

// ✅ NEW WAY (automatic, no boilerplate)
export function AutoServiceExample({ tasks }: { tasks: Task[] }) {
  const columns = [
    createEditableTextColumn<Task>('title', 'Title', { size: 200 }),
    createEditableTextColumn<Task>('description', 'Description', { size: 250 }),
  ]

  return (
    <UniversalEntityTable<Task>
      data={tasks}
      entityType="tasks" // Automatically detects 'tasks' service from context
      columns={columns}
      // No service prop needed - auto-detected!
      enableInlineEdit={true}
    />
  )
}

// ✅ ADVANCED: Still supports explicit service override
export function ExplicitServiceExample({ tasks, customService }: { 
  tasks: Task[]
  customService: EntityService<Task>
}) {
  const columns = [
    createEditableTextColumn<Task>('title', 'Title', { size: 200 }),
    createEditableTextColumn<Task>('description', 'Description', { size: 250 }),
  ]

  return (
    <UniversalEntityTable<Task>
      data={tasks}
      entityType="tasks"
      columns={columns}
      service={customService} // Explicit service takes priority
      enableInlineEdit={true}
    />
  )
} 