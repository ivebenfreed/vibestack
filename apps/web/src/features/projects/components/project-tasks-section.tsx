import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTableSkeleton } from '@/components/ui/table'
import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { usePGliteContext } from '@/db/pglite-provider'
import { useSelector } from '@xstate/store/react'
import { tasksAtom } from '@/domain/task'
import { shallowEqual } from '@xstate/store'
import { useStableEntityArrayFiltered } from '@/hooks/useStableEntityArray'
import { Badge } from '@/components/ui/badge'

interface ProjectTasksSectionProps {
  projectId: string
  projectName?: string
}

// 🎯 XSTATE PATTERN: Simple hook to get tasks by project using stable filtered array
function useTasksByProject(projectId: string) {
  const projectTasks = useStableEntityArrayFiltered(
    tasksAtom,
    (task: Task) => task.projectId === projectId
  )
  
  return {
    data: projectTasks,
    isLoading: false, // XState stores are always synchronous
    error: null as Error | null // Error handling via atoms if needed later
  }
}

// 🎯 UNIVERSAL REACTIVE DATA PATTERN: Simple, clean component using XState stores
const ProjectTasksSection = React.memo<ProjectTasksSectionProps>(({ projectId, projectName }) => {
  const { services } = usePGliteContext()

  // 🎯 USE XSTATE STORES: Direct access via XState selector hook
  const { 
    data: projectTasks = [], 
    isLoading, 
    error 
  } = useTasksByProject(projectId)

  // 🎯 BUSINESS LOGIC: Simple handlers using domain services
  const handleCreateTask = async () => {
    if (!services?.tasks) {
      toast.error('Task service not available')
      return
    }

    try {
      const newTask = await services.tasks.createTask({
        title: 'New Task',
        description: '',
        status: TaskStatus.OPEN,
        priority: TaskPriority.MEDIUM,
        projectId,
      })
      toast.success('Task created successfully')
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task')
    }
  }

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!services?.tasks) {
      toast.error('Task service not available')
      return
    }

    try {
      await services.tasks.updateTask(taskId, updates)
      toast.success('Task updated successfully')
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!services?.tasks) {
      toast.error('Task service not available')
      return
    }

    try {
      await services.tasks.deleteTask(taskId)
      toast.success('Task deleted successfully')
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task')
    }
  }

  // 🎯 DERIVED DATA: Simple, pure transformations
  const tasksByStatus = useMemo(() => {
    const grouped = projectTasks.reduce((acc: Record<TaskStatus, Task[]>, task: Task) => {
      const status = task.status || TaskStatus.OPEN
      if (!acc[status]) acc[status] = []
      acc[status].push(task)
      return acc
    }, {} as Record<TaskStatus, Task[]>)
    
    return grouped
  }, [projectTasks])

  // 🎯 LOADING STATES: Simple, no complex checking
  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{projectName ? `${projectName} Tasks` : 'Project Tasks'}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTableSkeleton />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{projectName ? `${projectName} Tasks` : 'Project Tasks'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Error loading tasks</p>
            <p className="text-sm text-red-600">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{projectName ? `${projectName} Tasks` : 'Project Tasks'}</CardTitle>
        <Button onClick={handleCreateTask} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </CardHeader>
      <CardContent>
        {projectTasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No tasks yet</p>
            <Button onClick={handleCreateTask} variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Task
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Task Status Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.values(TaskStatus).map(status => {
                // 🎯 THEME-AWARE: Status indicators that work with dark/light themes
                const statusStyles = {
                  [TaskStatus.COMPLETED]: 'bg-green-500 dark:bg-green-400',
                  [TaskStatus.IN_PROGRESS]: 'bg-blue-500 dark:bg-blue-400', 
                  [TaskStatus.OPEN]: 'bg-muted-foreground/60 dark:bg-muted-foreground/40'
                }
                
                return (
                  <div key={status} className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${statusStyles[status] || statusStyles[TaskStatus.OPEN]}`} />
                      {status.replace('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase())}
                      <span className="text-sm text-muted-foreground">
                        ({tasksByStatus[status]?.length || 0})
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {tasksByStatus[status]?.map((task: Task) => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          onUpdate={handleUpdateTask}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

// Simple task card component
interface TaskCardProps {
  task: Task
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onDelete: (taskId: string) => void
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate, onDelete }) => {
  // 🎯 THEME-AWARE: Use CSS custom properties and semantic color classes
  const priorityStyles = {
    [TaskPriority.HIGH]: {
      card: 'border-destructive/20 bg-destructive/5 dark:border-destructive/30 dark:bg-destructive/10',
      badge: 'bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-destructive-foreground'
    },
    [TaskPriority.MEDIUM]: {
      card: 'border-yellow-200 bg-yellow-50 dark:border-yellow-600/30 dark:bg-yellow-600/10',
      badge: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-600/20 dark:text-yellow-300 dark:border-yellow-600/30'
    },
    [TaskPriority.LOW]: {
      card: 'border-muted bg-muted/30 dark:border-muted/50 dark:bg-muted/20',
      badge: 'bg-muted text-muted-foreground border-muted dark:bg-muted/30 dark:text-muted-foreground'
    },
  }

  const currentPriority = task.priority || TaskPriority.LOW
  const styles = priorityStyles[currentPriority]

  return (
    <Card className={`${styles.card} hover:shadow-sm transition-all duration-200 border-2`}>
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h5 className="font-medium text-sm truncate pr-2">{task.title}</h5>
            <Badge variant="outline" className={`text-xs ${styles.badge} flex-shrink-0`}>
              {task.priority}
            </Badge>
          </div>
          
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              {task.dueDate ? format(new Date(task.dueDate), 'MMM dd') : 'No due date'}
            </span>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs hover:bg-background/80"
                onClick={() => onUpdate(task.id, { 
                  status: task.status === TaskStatus.COMPLETED ? TaskStatus.OPEN : TaskStatus.COMPLETED 
                })}
              >
                {task.status === TaskStatus.COMPLETED ? 'Reopen' : 'Complete'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(task.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

ProjectTasksSection.displayName = 'ProjectTasksSection'

export default ProjectTasksSection 