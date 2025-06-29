/**
 * TasksKanban - Real data Kanban board with drag and drop
 * Maintains task order within columns and syncs with backend
 */

import React, { useState, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSelector } from '@xstate/store/react'
import { tasksAtom } from '@/domain/task'
import { shallowEqual } from '@xstate/store'
import { Task, TaskStatus } from '@repo/dataforge/client-entities'

// Column configuration
type ColumnId = 'open' | 'in_progress' | 'completed'

interface Column {
  id: ColumnId
  title: string
  status: TaskStatus
}

const columns: Column[] = [
  { id: 'open', title: 'Open', status: TaskStatus.OPEN },
  { id: 'in_progress', title: 'In Progress', status: TaskStatus.IN_PROGRESS },
  { id: 'completed', title: 'Completed', status: TaskStatus.COMPLETED },
]

// Helper to map status to column ID
function getColumnId(status: TaskStatus): ColumnId {
  switch (status) {
    case TaskStatus.OPEN:
      return 'open'
    case TaskStatus.IN_PROGRESS:
      return 'in_progress'
    case TaskStatus.COMPLETED:
      return 'completed'
    default:
      return 'open'
  }
}

// TaskCard component
function TaskCard({ task, overlay = false }: { task: Task; overlay?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
    disabled: overlay,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab ${isDragging ? 'opacity-50' : ''} ${overlay ? 'rotate-3 shadow-xl' : ''}`}
    >
      <CardHeader className="p-3">
        <CardTitle className="text-sm">{task.title}</CardTitle>
      </CardHeader>
    </Card>
  )
}

// Column component
function KanbanColumn({ column, tasks, children }: { column: Column; tasks: Task[]; children: React.ReactNode }) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  })

  const taskIds = tasks.map(task => task.id)

  return (
    <div ref={setNodeRef} className="w-80">
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{column.title}</h3>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
        
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 min-h-[200px]">
            {children}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}

// Main component
export default function TasksKanban() {
  // Get tasks from XState atom
  const tasks = useSelector(tasksAtom, (tasksRecord) => Object.values(tasksRecord), shallowEqual)
  
  // Local state for ordered tasks
  const [orderedTasks, setOrderedTasks] = useState<Task[]>([])
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  
  // Initialize ordered tasks from atom data
  React.useEffect(() => {
    // Preserve existing order where possible
    const existingIds = new Set(orderedTasks.map(t => t.id))
    const newTasks = tasks.filter(t => !existingIds.has(t.id))
    const updatedTasks = orderedTasks.filter(t => tasks.some(task => task.id === t.id))
    
    // Update with current task data while preserving order
    const mergedTasks = updatedTasks.map(orderedTask => {
      const currentTask = tasks.find(t => t.id === orderedTask.id)
      return currentTask || orderedTask
    })
    
    setOrderedTasks([...mergedTasks, ...newTasks])
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  )

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event
    console.log('🚀 Drag start:', active.id, active.data.current)
    
    if (active.data.current?.type === 'Task') {
      setActiveTask(active.data.current.task)
    }
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    console.log('🔄 Drag over:', { activeId, overId })

    const activeData = active.data.current
    const overData = over.data.current

    if (!activeData || activeData.type !== 'Task') return

    const isOverATask = overData?.type === 'Task'
    const isOverAColumn = overData?.type === 'Column'

    setOrderedTasks((tasks) => {
      const activeIndex = tasks.findIndex((t) => t.id === activeId)
      if (activeIndex === -1) return tasks

      const activeTask = tasks[activeIndex]

      // Task over task
      if (isOverATask) {
        const overIndex = tasks.findIndex((t) => t.id === overId)
        if (overIndex === -1) return tasks

        const overTask = tasks[overIndex]
        let newTasks = [...tasks]

        // Update status if different column
        if (activeTask.status !== overTask.status) {
          newTasks[activeIndex] = { ...activeTask, status: overTask.status }
          console.log(`✅ Task ${activeId} moved to status ${overTask.status}`)
        }

        // Reorder
        return arrayMove(newTasks, activeIndex, overIndex)
      }

      // Task over column
      if (isOverAColumn) {
        const newStatus = overData.column.status
        if (activeTask.status !== newStatus) {
          const newTasks = [...tasks]
          newTasks[activeIndex] = { ...activeTask, status: newStatus }
          console.log(`✅ Task ${activeId} moved to status ${newStatus}`)
          return newTasks
        }
      }

      return tasks
    })
  }

  const onDragEnd = async (event: DragEndEvent) => {
    console.log('🏁 Drag end')
    setActiveTask(null)

    // Find the task that was moved
    const activeId = event.active.id
    const movedTask = orderedTasks.find(t => t.id === activeId)
    
    if (movedTask) {
      // Get original task to check if status changed
      const originalTask = tasks.find(t => t.id === activeId)
      if (originalTask && originalTask.status !== movedTask.status) {
        const { updateTaskUI } = await import('@/domain/task')
        await updateTaskUI(movedTask.id, { status: movedTask.status })
      }
    }
  }

  // Group tasks by status while maintaining order
  const tasksByColumn = useMemo(() => {
    const grouped: Record<ColumnId, Task[]> = {
      open: [],
      in_progress: [],
      completed: []
    }
    
    orderedTasks.forEach(task => {
      const columnId = getColumnId(task.status)
      grouped[columnId].push(task)
    })
    
    return grouped
  }, [orderedTasks])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Tasks Kanban</h1>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto">
          {columns.map(column => (
            <KanbanColumn 
              key={column.id} 
              column={column} 
              tasks={tasksByColumn[column.id]}
            >
              {tasksByColumn[column.id].map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </KanbanColumn>
          ))}
        </div>
        
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}