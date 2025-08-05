import React, { useMemo, useRef } from 'react'
import { VibeGantt } from '@/components/custom/vibegantt/VibeGantt'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import { tasksAtom } from '@/domain-xstate/task'
import { projectsAtom } from '@/domain-xstate/project'
import { usersAtom } from '@/domain-xstate/user'
import type { GanttTask, TaskDependency } from '@/components/custom/vibegantt/types'

/**
 * TasksGantt - Integration component between task system and VibeGantt
 * 
 * This component:
 * 1. Fetches tasks from XState atoms
 * 2. Transforms them to GanttTask format
 * 3. Renders VibeGantt with proper data
 */
export function TasksGantt() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Get all tasks from XState atom
  const tasksRecord = useSelector(tasksAtom, (record) => record, shallowEqual)
  const projectsRecord = useSelector(projectsAtom, (record) => record, shallowEqual)
  const usersRecord = useSelector(usersAtom, (record) => record, shallowEqual)
  
  // Transform tasks to GanttTask format
  const ganttTasks = useMemo(() => {
    if (!tasksRecord || typeof tasksRecord !== 'object') return []
    
    return Object.values(tasksRecord)
      .filter(task => {
        // Filter tasks that have either:
        // 1. Both plannedStartDate and plannedEndDate
        // 2. Both startDate and dueDate (fallback)
        return (task.plannedStartDate && task.plannedEndDate) || 
               (task.startDate && task.dueDate)
      })
      .map(task => {
        // Map to GanttTask format
        const ganttTask: GanttTask = {
          id: task.id,
          name: task.title,
          plannedStartDate: task.plannedStartDate 
            ? new Date(task.plannedStartDate) 
            : task.startDate 
              ? new Date(task.startDate)
              : new Date(),
          plannedEndDate: task.plannedEndDate 
            ? new Date(task.plannedEndDate) 
            : task.dueDate 
              ? new Date(task.dueDate)
              : new Date(),
          progress: task.status === 'completed' ? 100 : 
                   task.status === 'in_progress' ? 50 : 0,
          priority: task.priority || 'medium',
          assignee: task.assigneeId && usersRecord[task.assigneeId] 
            ? usersRecord[task.assigneeId].name 
            : undefined,
          projectId: task.projectId,
          description: task.description,
          color: task.priority === 'critical' ? '#ef4444' :
                 task.priority === 'high' ? '#f59e0b' :
                 task.priority === 'medium' ? '#3b82f6' :
                 '#22c55e',
          constraints: []
        }
        
        // Add actual dates if different from planned
        if (task.startDate && task.startDate !== task.plannedStartDate) {
          ganttTask.actualStartDate = new Date(task.startDate)
        }
        if (task.dueDate && task.dueDate !== task.plannedEndDate) {
          ganttTask.actualEndDate = new Date(task.dueDate)
        }
        
        return ganttTask
      })
      .sort((a, b) => a.plannedStartDate.getTime() - b.plannedStartDate.getTime())
  }, [tasksRecord, usersRecord])
  
  // For now, no dependencies
  const dependencies: TaskDependency[] = useMemo(() => [], [])
  
  // Handle task updates
  const handleTaskUpdate = async (taskId: string, updates: Partial<GanttTask>) => {
    console.log('TasksGantt: Task update requested', { taskId, updates })
    
    // Import task service and update the task
    const { updateTaskUI } = await import('@/domain/task-service')
    
    const taskUpdates: any = {}
    if (updates.plannedStartDate) {
      taskUpdates.plannedStartDate = updates.plannedStartDate.toISOString().split('T')[0]
    }
    if (updates.plannedEndDate) {
      taskUpdates.plannedEndDate = updates.plannedEndDate.toISOString().split('T')[0]
    }
    if (updates.actualStartDate) {
      taskUpdates.startDate = updates.actualStartDate.toISOString().split('T')[0]
    }
    if (updates.actualEndDate) {
      taskUpdates.dueDate = updates.actualEndDate.toISOString().split('T')[0]
    }
    
    await updateTaskUI(taskId, taskUpdates)
  }
  
  // Calculate default time range
  const timeRange = useMemo(() => {
    if (ganttTasks.length === 0) {
      const today = new Date()
      return {
        start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        end: new Date(today.getFullYear(), today.getMonth() + 3, 0)
      }
    }
    
    const allDates = ganttTasks.flatMap(task => [
      task.plannedStartDate,
      task.plannedEndDate
    ])
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
    
    // Add padding
    const start = new Date(minDate)
    start.setMonth(start.getMonth() - 1)
    const end = new Date(maxDate)
    end.setMonth(end.getMonth() + 2)
    
    return { start, end }
  }, [ganttTasks])
  
  if (ganttTasks.length === 0) {
    return (
      <div className="w-full h-[800px] border rounded-lg bg-background overflow-hidden flex items-center justify-center">
        <div className="text-center p-8">
          <h3 className="text-lg font-semibold mb-2">No Tasks to Display</h3>
          <p className="text-muted-foreground max-w-md">
            No tasks with date ranges were found. Tasks need either planned start/end dates 
            or actual start/due dates to appear in the Gantt chart.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Tip: Edit a task and set both a start date and due date to see it here.
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="w-full h-[800px] border rounded-lg bg-background overflow-hidden">
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Interactive Gantt Chart</h2>
            <p className="text-sm text-muted-foreground">
              Showing {ganttTasks.length} tasks • Drag to reschedule • Ctrl+Scroll to zoom
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span>Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
              <span>High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
              <span>Critical</span>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="w-full"
        style={{ height: 'calc(100% - 73px)' }}
      >
        <VibeGantt
          projectId="demo"
          tasks={ganttTasks}
          dependencies={dependencies}
          config={{
            enableEditing: true,
            enableDragDrop: true,
            enableZoom: true,
            showDependencies: true,
            showProgress: true,
            showToday: true,
            rowHeight: 40,
            minZoomLevel: 'hour',
            maxZoomLevel: 'year',
            defaultZoomLevel: 'day',
            timeRange,
            snapToGrid: true,
            weekStartsOn: 1,
          }}
          onTaskUpdate={handleTaskUpdate}
        />
      </div>
    </div>
  )
}