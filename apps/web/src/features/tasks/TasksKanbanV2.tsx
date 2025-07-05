/**
 * TasksKanbanV2 - Tasks Kanban using generic VibeKan component
 * Demonstrates how to use the generic VibeKan for specific entity types
 */

import React from 'react'
import { useSelector } from '@xstate/store/react'
import { tasksAtom } from '@/domain/task'
import { shallowEqual } from '@xstate/store'
import { useStableEntityArray } from '@/hooks/useStableEntityArray'
import { useOptimisticTasks } from '@/hooks/useOptimisticTask'
import { Task, TaskStatus } from '@repo/dataforge/client-entities'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { VibeKan, createVibeKanConfig } from '@/components/custom/vibekan'

// Task Card Component with optimistic state indicators
function TaskCard({ task, isDragging, overlay, isOptimistic, isPending }: { 
  task: Task; 
  isDragging: boolean; 
  overlay: boolean;
  isOptimistic?: boolean;
  isPending?: boolean;
}) {
  const className = [
    'cursor-grab',
    isDragging ? 'opacity-50' : '',
    overlay ? 'rotate-3 shadow-xl' : '',
    isOptimistic ? 'ring-2 ring-blue-200' : '',
    isPending ? 'opacity-75' : ''
  ].filter(Boolean).join(' ')

  return (
    <Card className={className}>
      <CardHeader className="p-3">
        <CardTitle className="text-sm">{task.title}</CardTitle>
        {isOptimistic && (
          <div className="text-xs text-blue-600 mt-1">Updating...</div>
        )}
      </CardHeader>
    </Card>
  )
}


export default function TasksKanbanV2() {
  // Get tasks from XState atom using stable array
  const stableTasks = useStableEntityArray(tasksAtom)
  const taskIds = stableTasks.map(t => t.id)
  
  // Use optimistic hooks for immediate UI updates
  const { tasks, updateTask, getPendingStatus, getOptimisticStatus } = useOptimisticTasks(taskIds)
  
  // Create optimistic-aware kanban config
  const optimisticTaskKanbanConfig = createVibeKanConfig<Task, TaskStatus>({
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
      <TaskCard 
        task={task} 
        isDragging={isDragging} 
        overlay={overlay}
        isOptimistic={getOptimisticStatus(task.id)}
        isPending={getPendingStatus(task.id)}
      />
    ),
    
    onStatusChange: async (taskId, newStatus) => {
      // Use optimistic update instead of direct database call
      await updateTask(taskId, { status: newStatus })
    },
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 pb-4">
        <h1 className="text-2xl font-bold">Tasks Kanban</h1>
        <div className="text-sm text-gray-600">
          Optimistic updates enabled - changes appear instantly!
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <VibeKan 
          entities={tasks} 
          config={optimisticTaskKanbanConfig}
          enablePersistence={true}
          kanbanId="tasks-main"
          enableCrossTabSync={true}
          debugMode={false}
          className="h-full"
        />
      </div>
    </div>
  )
}