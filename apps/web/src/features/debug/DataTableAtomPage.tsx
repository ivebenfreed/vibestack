import React, { Suspense, useMemo } from 'react'
import { useAtomicLiveChanges } from '@/db/hooks/useAtomicLiveChanges'
import { ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Task, TaskStatus, TaskPriority, Project, User } from '@repo/dataforge/client-entities'
import { ContentContainer } from '@/components/layout/content-container'
import { format } from 'date-fns'
import { useAtomValue } from 'jotai'
// Import Universal Entity Table v2 and components
import { 
  UniversalEntityTable,
  LightweightTextInput,
  LightweightSelect,
  LightweightDatePicker,
  useEntityOperations,
  UserAssignmentCell,
  ProjectAssignmentCell,
  createHybridRelationshipColumn,
  createEditableTextColumn,
  createEditableNumberColumn,
  createEditableDateColumn,
  createEditableSelectColumn,
  createEditableBooleanColumn,
  badge,
  taskStatus,
  taskPriority,
  type EntityService,
} from '@/components/custom/universal-entity-table-v2'

// Import our domain atomic stores
import { TaskService } from '@/domain/task'

// ✅ ROW-LEVEL ATOM PATTERN: Component for individual task row that reads from its own atom
const TaskRow = React.memo(({ taskId, projects, users }: { taskId: string, projects: Project[], users: User[] }) => {
  // ✅ GRANULAR REACTIVITY: Each row only re-renders when ITS task atom changes
  const task = useAtomValue(TaskService.atoms.getTaskAtom(taskId))
  
  if (!task) {
    return (
      <tr>
        <td colSpan={9} className="text-center text-muted-foreground">
          Task {taskId} not found
        </td>
      </tr>
    )
  }

  // ✅ RELATION LOOKUP: If relations aren't populated in task atom, look them up
  const project = task.project || projects.find(p => p.id === task.projectId)
  const assignee = task.assignee || users.find(u => u.id === task.assigneeId)

  // Debug first few rows to see what's in the task atom
  const shouldDebug = ['e0e179df-e95a-4022-bb86-063902a62aca', 'd4986714-293c-445f-93dc-a6c605d98d9a'].includes(taskId)
  if (shouldDebug) {
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] hasProject:`, !!task.project)
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] hasAssignee:`, !!task.assignee)
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] projectId:`, task.projectId)
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] assigneeId:`, task.assigneeId)
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] projects array length:`, projects.length)
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] users array length:`, users.length)
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] foundProject:`, !!project)
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] foundAssignee:`, !!assignee)
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] projectName:`, project?.name)
    console.log(`🔍 [TaskRow:${task.title?.slice(0, 20)}] assigneeName:`, assignee?.name)
  }

  return (
    <tr>
      <td className="px-4 py-2 truncate max-w-[200px]">{task.title}</td>
      <td className="px-4 py-2 truncate max-w-[250px]">{task.description || '-'}</td>
      <td className="px-4 py-2">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
          task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-800' :
          task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {task.status}
        </span>
      </td>
      <td className="px-4 py-2">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
          task.priority === TaskPriority.HIGH ? 'bg-red-100 text-red-800' :
          task.priority === TaskPriority.MEDIUM ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {task.priority}
        </span>
      </td>
      <td className="px-4 py-2">{task.dueDate ? format(new Date(task.dueDate), 'MMM dd') : '-'}</td>
      <td className="px-4 py-2">{project?.name || '(No Project)'}</td>
      <td className="px-4 py-2">{assignee?.name || '(Unassigned)'}</td>
      <td className="px-4 py-2">{Array.isArray(task.tags) && task.tags.length > 0 ? task.tags.join(', ') : '(No tags)'}</td>
      <td className="px-4 py-2">{format(new Date(task.createdAt), 'MMM dd')}</td>
    </tr>
  )
})

// ✅ TABLE IDS COMPONENT: Reads only from taskIdsAtom for row ordering
const TaskTableBody = React.memo(({ projects, users }: { projects: Project[], users: User[] }) => {
  // ✅ Only subscribes to IDs list, not individual task data
  const taskIds = useAtomValue(TaskService.atoms.entityIdsAtom)
  
  console.log(`🏗️ [TaskTableBody] Rendering ${taskIds.length} rows`)
  
  return (
    <tbody>
      {taskIds.map((taskId) => (
        <TaskRow key={taskId} taskId={taskId} projects={projects} users={users} />
      ))}
    </tbody>
  )
})

/**
 * Universal Entity Table v2 Atom Debug Page
 * 
 * ✅ Jotai Atom-Per-Row Pattern Implementation
 * ✅ TRUE GRANULAR REACTIVITY - only changed rows re-render
 * ✅ TypeORM direct integration - no intermediary cache layers
 * ✅ Efficient live updates - only refetch changed entities
 * ✅ Maintains same performance as TanStack Query for bulk loading
 */

interface DataTableAtomDebugPageProps {
  loaderData: {
    tasks: Task[]
    projects: Project[]
    users: User[]
    liveChangesReady: boolean
  }
}

function DataTableAtomDebugPage({ loaderData }: DataTableAtomDebugPageProps) {
  const renderCount = React.useRef(0)
  renderCount.current++
  
  // ✅ ATOMIC LIVE CHANGES: Connect sync updates to individual task atoms
  const atomicLiveChanges = useAtomicLiveChanges()
  
  // Debug atomic live changes status
  React.useEffect(() => {
    if (atomicLiveChanges.performance?.updateCount) {
      console.log(`🔄 [DataTableAtomPage] Atomic live changes active - ${atomicLiveChanges.performance.updateCount} updates processed`)
    }
  }, [atomicLiveChanges.performance?.updateCount])
  
  // ✅ LIGHTWEIGHT READS: Only read what we need for stats and count
  const taskIds = useAtomValue(TaskService.atoms.entityIdsAtom)
  const allTasks = useAtomValue(TaskService.atoms.allTasksAtom)
  
  // Calculate basic stats from tasks
  const taskStats = useMemo(() => {
    return {
      open: allTasks.filter(t => t.status === TaskStatus.OPEN).length,
      inProgress: allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      completed: allTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    }
  }, [allTasks])
  
  // Use projects/users from loader for now (these could be atoms too in the future)  
  const { projects, users } = loaderData
  
  // ✅ SIMPLE COUNT CHECK: Use IDs length instead of derived array
  const shouldRenderTable = taskIds.length > 0

  console.log(`🎯 [DataTableAtomPage] Live changes handled at router level - component is pure atom reader`)
  
  console.log(`📊 [DataTableAtomPage] Render #${renderCount.current} - Atom IDs: ${taskIds.length} task IDs from taskIdsAtom`)
  console.log(`📊 [DataTableAtomPage] First 5 task IDs:`, taskIds.slice(0, 5))
  
  // Second render is expected due to router behavior, but is lightweight thanks to idempotent checks
  if (renderCount.current > 1) {
    console.log(`🔄 [DataTableAtomPage] Additional render #${renderCount.current} - router re-render (atoms unchanged due to idempotent checks)`)
  }

  // Debug statistics comparing to TanStack Query approach
  const debugStats = {
    tasksCount: taskIds.length,
    projectsCount: projects.length,
    usersCount: users.length,
    atomMapSize: allTasks.length, // Use all tasks length instead
    loadedTaskIds: taskIds.length, // Use task IDs length instead
    taskStats: taskStats,
    loadingStates: {
      tasks: false, // Atoms are always populated from loader
      projects: false,
      users: false,
    },
    errorStates: {
      tasks: false,
      projects: false,
      users: false,
    }
  }

  return (
    <ContentContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Universal Entity Table v2 - Jotai Atoms</h1>
          <p className="text-muted-foreground">
            Atom-Per-Row Pattern • TRUE Granular Reactivity • TypeORM Direct Integration • Targeted Live Updates
          </p>
        </div>

        {/* Debug Info */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Information - TRUE Granular Atom Pattern</CardTitle>
            <CardDescription>
              Each row reads from its individual task atom for maximum granular reactivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">Tasks</div>
                <div className="text-muted-foreground">{debugStats.tasksCount} loaded</div>
                <div className="text-xs text-muted-foreground">From {debugStats.atomMapSize} atoms</div>
              </div>
              <div>
                <div className="font-medium">Projects</div>
                <div className="text-muted-foreground">{debugStats.projectsCount} loaded</div>
              </div>
              <div>
                <div className="font-medium">Users</div>
                <div className="text-muted-foreground">{debugStats.usersCount} loaded</div>
              </div>
              <div>
                <div className="font-medium">Task Stats</div>
                <div className="text-xs text-muted-foreground">
                  Open: {taskStats.open} | Progress: {taskStats.inProgress} | Done: {taskStats.completed}
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">TRUE Granular Atom Pattern Benefits:</div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Each row reads from its individual task atom directly</li>
                <li>• Only changed rows re-render (not entire table)</li>
                <li>• No derived array choke points</li>
                <li>• Targeted live updates - only refetch changed entities</li>
                <li>• Render count: {renderCount.current} (should stay low)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Entity Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks Table - TRUE Atom-Per-Row Pattern</CardTitle>
            <CardDescription>
              Each row is backed by an individual Jotai atom and only re-renders when that specific task changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Loading tasks...</div>}>
              {shouldRenderTable ? (
                <div className="w-full overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Title</th>
                        <th className="px-4 py-3 text-left font-medium">Description</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Priority</th>
                        <th className="px-4 py-3 text-left font-medium">Due Date</th>
                        <th className="px-4 py-3 text-left font-medium">Project</th>
                        <th className="px-4 py-3 text-left font-medium">Assignee</th>
                        <th className="px-4 py-3 text-left font-medium">Tags</th>
                        <th className="px-4 py-3 text-left font-medium">Created</th>
                      </tr>
                    </thead>
                    <TaskTableBody projects={projects} users={users} />
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">
                    Populating {loaderData.tasks.length} task atoms...
                  </div>
                </div>
              )}
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  )
}

export default DataTableAtomDebugPage 