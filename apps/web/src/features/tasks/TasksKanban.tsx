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
  useDroppable,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  CollisionDetection,
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
import { tasksAtom } from '@/domain-xstate/task'
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
  const { setNodeRef: setSortableRef } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  })

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `${column.id}-droppable`,
    data: {
      type: 'Column',
      column,
    },
  })

  const taskIds = tasks.map(task => task.id)

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node)
    setDroppableRef(node)
  }

  return (
    <div ref={setNodeRef} className="w-80">
      <div className={`bg-muted/50 rounded-lg p-4 transition-colors ${
        isOver ? 'bg-blue-100 border-2 border-blue-300 border-dashed' : ''
      }`}>
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

// Custom collision detection for kanban
const customCollisionDetection: CollisionDetection = (args) => {
  // First try to find collisions with sortable items (for reordering within columns)
  const rectCollisions = rectIntersection(args)
  
  if (rectCollisions.length > 0) {
    return rectCollisions
  }
  
  // If no sortable items found, look for droppable column zones
  return pointerWithin(args)
}

// Main component
export default function TasksKanban() {
  // ✅ SIMPLE SELECTOR: Back to basics
  const tasks = useSelector(tasksAtom, (tasksRecord) => {
    if (!tasksRecord || Object.keys(tasksRecord).length === 0) return []
    return Object.values(tasksRecord)
  }, shallowEqual)
  
  // ✅ ORDERING STATE: Separate from sync, only for user drag ordering
  const [taskOrder, setTaskOrder] = useState<string[]>([]) // Just store IDs in order
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  
  // ✅ OPTIMIZED SYNC: React Compiler will optimize this array operation
  const taskIds = tasks.map(t => t.id).sort()
  const taskIdsString = taskIds.join(',')
  
  React.useEffect(() => {
    const currentTaskIds = new Set(taskOrder)
    const newTaskIds = taskIds.filter(id => !currentTaskIds.has(id))
    const hasDeletedTasks = taskOrder.some(id => !taskIds.includes(id))
    
    // Only update if there are actual structural changes
    if (newTaskIds.length > 0 || hasDeletedTasks) {
      setTaskOrder(prev => {
        // Remove deleted tasks and add new tasks
        const filtered = prev.filter(id => taskIds.includes(id))
        return [...filtered, ...newTaskIds]
      })
    }
  }, [taskIdsString]) // Only when task IDs change

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  )

  const onDragStart = React.useCallback((event: DragStartEvent) => {
    const { active } = event
    console.log('🚀 Drag start:', active.id, active.data.current)
    
    // ✅ MINIMAL STATE UPDATES: Only set active task for overlay
    if (active.data.current?.type === 'Task') {
      setActiveTask(active.data.current.task)
    }
  }, [])

  // ✅ LIVE REORDERING: Update visual order during drag for better UX
  const onDragOver = React.useCallback((event: DragOverEvent) => {
    const { active, over } = event
    
    if (!over) return
    
    const activeId = active.id as string
    const overId = over.id as string
    
    // Only handle task-to-task reordering within the same column
    if (active.data.current?.type === 'Task' && over.data.current?.type === 'Task') {
      const activeTask = tasks.find(t => t.id === activeId)
      const overTask = tasks.find(t => t.id === overId)
      
      // Only reorder if both tasks are in the same status/column
      if (activeTask && overTask && activeTask.status === overTask.status) {
        const currentOrder = [...taskOrder]
        const activeIndex = currentOrder.indexOf(activeId)
        const overIndex = currentOrder.indexOf(overId)
        
        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          const newOrder = arrayMove(currentOrder, activeIndex, overIndex)
          setTaskOrder(newOrder)
        }
      }
    }
  }, [tasks, taskOrder])

  const onDragEnd = async (event: DragEndEvent) => {
    console.log('🏁 Drag end')
    setActiveTask(null)

    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overData = over.data.current
    const originalTask = tasks.find(t => t.id === activeId)
    
    if (!originalTask) return

    let newStatus: TaskStatus | null = null

    // Determine new status based on drop target
    if (overData?.type === 'Column') {
      newStatus = overData.column.status
    } else if (overData?.type === 'Task') {
      const overTask = tasks.find(t => t.id === over.id)
      if (overTask) {
        newStatus = overTask.status
      }
    }

    // ✅ CHANGE DETECTION: Only update if status actually changed
    if (newStatus && originalTask.status !== newStatus) {
      console.log(`🔄 Status change: ${originalTask.status} → ${newStatus}`)
      const { updateTaskUI } = await import('@/domain/task')
      await updateTaskUI(activeId, { status: newStatus })
    } else {
      console.log('🚫 No status change needed - skipping update')
    }
  }

  // ✅ SIMPLE GROUPING: Keep useMemo for drag-and-drop stability
  const tasksByColumn = useMemo(() => {
    const grouped: Record<ColumnId, Task[]> = {
      open: [],
      in_progress: [],
      completed: []
    }
    
    const tasksMap = new Map(tasks.map(t => [t.id, t]))
    
    for (const taskId of taskOrder) {
      const task = tasksMap.get(taskId)
      if (task) {
        const columnId = getColumnId(task.status)
        grouped[columnId].push(task)
      }
    }
    
    return grouped
  }, [tasks, taskOrder])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Tasks Kanban</h1>
      
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
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