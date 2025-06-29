/**
 * TasksKanbanDebug - Debug version with persistence debugging enabled
 */

import React from 'react'
import { useSelector } from '@xstate/store/react'
import { tasksAtom } from '@/domain/task'
import { shallowEqual } from '@xstate/store'
import { Task, TaskStatus } from '@repo/dataforge/client-entities'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { VibeKan, createVibeKanConfig } from '@/components/custom/vibekan'

// Task Card Component
function TaskCard({ task, isDragging, overlay }: { task: Task; isDragging: boolean; overlay: boolean }) {
  return (
    <Card className={`cursor-grab ${isDragging ? 'opacity-50' : ''} ${overlay ? 'rotate-3 shadow-xl' : ''}`}>
      <CardHeader className="p-3">
        <CardTitle className="text-sm">{task.title}</CardTitle>
      </CardHeader>
    </Card>
  )
}

// Create the kanban configuration for tasks
const taskKanbanConfig = createVibeKanConfig<Task, TaskStatus>({
  columns: [
    { id: 'open', title: 'Open', status: TaskStatus.OPEN },
    { id: 'in_progress', title: 'In Progress', status: TaskStatus.IN_PROGRESS },
    { id: 'completed', title: 'Completed', status: TaskStatus.COMPLETED },
  ],
  
  getColumnId: (task) => {
    switch (task.status) {
      case TaskStatus.OPEN:
        return 'open'
      case TaskStatus.IN_PROGRESS:
        return 'in_progress'
      case TaskStatus.COMPLETED:
        return 'completed'
      default:
        return 'open'
    }
  },
  
  getStatusForColumn: (columnId) => {
    const columnStatusMap: Record<string, TaskStatus> = {
      'open': TaskStatus.OPEN,
      'in_progress': TaskStatus.IN_PROGRESS,
      'completed': TaskStatus.COMPLETED,
    }
    return columnStatusMap[columnId] || TaskStatus.OPEN
  },
  
  renderCard: (task, isDragging, overlay) => (
    <TaskCard task={task} isDragging={isDragging} overlay={overlay} />
  ),
  
  onStatusChange: async (taskId, newStatus) => {
    const { updateTaskUI } = await import('@/domain/task')
    await updateTaskUI(taskId, { status: newStatus })
  },
})

export default function TasksKanbanDebug() {
  // Get tasks from XState atom
  const tasks = useSelector(tasksAtom, (tasksRecord) => Object.values(tasksRecord), shallowEqual)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Tasks Kanban - Debug Mode</h1>
      <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
        <p className="text-sm text-yellow-800">
          🐛 Debug mode enabled - Check console for persistence logs
        </p>
      </div>
      <VibeKan 
        entities={tasks} 
        config={taskKanbanConfig}
        enablePersistence={true}
        kanbanId="tasks-debug"
        enableCrossTabSync={true}
        debugMode={true}
      />
    </div>
  )
}