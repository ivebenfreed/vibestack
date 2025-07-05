import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import { tasksAtom } from '@/domain/task'
import { useOptimisticTask } from '@/hooks/useOptimisticTask'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities'

export const Route = createFileRoute('/_authenticated/debug/optimistic-test')({
  component: OptimisticTestPage,
})

function OptimisticTestPage() {
  // Get all tasks from atom
  const allTasks = useSelector(
    tasksAtom,
    (tasks) => Object.values(tasks).slice(0, 3), // Just first 3 for testing
    shallowEqual
  )

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Optimistic Updates Debug Page</h1>
        <p className="text-muted-foreground">Testing pure local state optimistic updates vs atom synchronization</p>
      </div>

      {allTasks.length === 0 ? (
        <Card className="p-6">
          <CardHeader>
            <CardTitle>No Tasks Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No tasks are available for testing. Please create some tasks first or check if the data is loading.
            </p>
            <div className="text-sm bg-muted p-3 rounded">
              <strong>To test optimistic updates:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Go to the Tasks page and create a few tasks</li>
                <li>Return to this debug page</li>
                <li>Test editing in both the blue (current) and green (optimistic) cards</li>
                <li>Watch the debug logs to see timing differences</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      ) : (
        allTasks.map(task => (
          <div key={task.id} className="space-y-4">
            <h2 className="text-lg font-semibold">Task: {task.title}</h2>
            
            {/* Direct Atom View */}
            <AtomTaskCard task={task} />
            
            {/* Optimistic Hook View */}
            <OptimisticTaskCard taskId={task.id} />
            
            <hr className="my-6" />
          </div>
        ))
      )}
    </div>
  )
}

// Component that directly subscribes to atom (like current grid)
function AtomTaskCard({ task }: { task: Task }) {
  const [debugLog, setDebugLog] = useState<string[]>([])
  
  const addLog = React.useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    setDebugLog(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 4)])
  }, [])

  // Direct atom subscription for this specific task
  const atomTask = useSelector(
    tasksAtom,
    (tasks) => tasks[task.id] || null,
    shallowEqual
  )

  // Track atom updates separately to avoid infinite loop
  React.useEffect(() => {
    if (atomTask) {
      addLog(`ATOM UPDATE: title="${atomTask.title}", priority="${atomTask.priority}"`)
    }
  }, [atomTask, addLog])

  const [localTitle, setLocalTitle] = useState(atomTask?.title || '')
  const [localPriority, setLocalPriority] = useState(atomTask?.priority || 'medium')

  // Sync local state with atom changes
  React.useEffect(() => {
    if (atomTask) {
      setLocalTitle(atomTask.title)
      setLocalPriority(atomTask.priority)
    }
  }, [atomTask])

  const handleSave = async () => {
    addLog(`SAVE TRIGGERED: title="${localTitle}", priority="${localPriority}"`)
    
    // Import and call updateTaskUI directly (like grid does)
    const { updateTaskUI } = await import('@/domain/task')
    
    try {
      await updateTaskUI(task.id, {
        title: localTitle,
        priority: localPriority as TaskPriority
      })
      addLog('SAVE SUCCESS')
    } catch (error) {
      addLog(`SAVE ERROR: ${error}`)
    }
  }

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="text-sm text-blue-700">🔗 Direct Atom Subscription (Current Grid Pattern)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-foreground">Local Title</label>
            <Input 
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Local Priority</label>
            <select 
              value={localPriority}
              onChange={(e) => setLocalPriority(e.target.value)}
              className="h-8 px-2 border border-input bg-background text-foreground rounded focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline">Atom: {atomTask?.title}</Badge>
          <Badge variant="outline">Priority: {atomTask?.priority}</Badge>
        </div>
        
        <Button onClick={handleSave} size="sm">Save Changes</Button>
        
        <div className="text-xs bg-muted p-2 rounded max-h-24 overflow-y-auto">
          <div className="font-medium mb-1">Debug Log:</div>
          {debugLog.map((log, i) => (
            <div key={i} className="font-mono">{log}</div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Component using optimistic hook
function OptimisticTaskCard({ taskId }: { taskId: string }) {
  const [debugLog, setDebugLog] = useState<string[]>([])
  
  const addLog = React.useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    setDebugLog(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 4)])
  }, [])

  const { task, updateTask, isOptimistic, isPending, error } = useOptimisticTask(taskId)
  
  const [localTitle, setLocalTitle] = useState(task?.title || '')
  const [localPriority, setLocalPriority] = useState(task?.priority || 'medium')

  // Update local state when task changes
  React.useEffect(() => {
    if (task) {
      addLog(`TASK UPDATE: title="${task.title}", priority="${task.priority}", optimistic=${isOptimistic}`)
      if (!isOptimistic) {
        setLocalTitle(task.title)
        setLocalPriority(task.priority)
      }
    }
  }, [task, isOptimistic, addLog])

  const handleSave = async () => {
    addLog(`OPTIMISTIC SAVE: title="${localTitle}", priority="${localPriority}"`)
    
    try {
      await updateTask({
        title: localTitle,
        priority: localPriority as TaskPriority
      })
      addLog('OPTIMISTIC SAVE SUCCESS')
    } catch (error) {
      addLog(`OPTIMISTIC SAVE ERROR: ${error}`)
    }
  }

  return (
    <Card className="border-green-200">
      <CardHeader>
        <CardTitle className="text-sm text-green-700">⚡ Optimistic Hook (New Pattern)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-foreground">Local Title</label>
            <Input 
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Local Priority</label>
            <select 
              value={localPriority}
              onChange={(e) => setLocalPriority(e.target.value)}
              className="h-8 px-2 border border-input bg-background text-foreground rounded focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline">Task: {task?.title}</Badge>
          <Badge variant="outline">Priority: {task?.priority}</Badge>
          {isOptimistic && <Badge className="bg-yellow-100 text-yellow-800">Optimistic</Badge>}
          {isPending && <Badge className="bg-blue-100 text-blue-800">Pending</Badge>}
          {error && <Badge className="bg-red-100 text-red-800">Error</Badge>}
        </div>
        
        <Button onClick={handleSave} size="sm" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
        
        <div className="text-xs bg-muted p-2 rounded max-h-24 overflow-y-auto">
          <div className="font-medium mb-1">Debug Log:</div>
          {debugLog.map((log, i) => (
            <div key={i} className="font-mono">{log}</div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}