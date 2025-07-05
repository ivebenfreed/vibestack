import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import { tasksAtom } from '@/domain/task'
import { useGridCellState } from '@/components/custom/vibegridoptimus/machines/gridCellStateMachine'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Task } from '@repo/dataforge/client-entities'

export const Route = createFileRoute('/_authenticated/debug/state-machine-test')({
  component: StateMachineTestPage,
})

function StateMachineTestPage() {
  // Get a test task from atom
  const testTask = useSelector(
    tasksAtom,
    (tasks) => Object.values(tasks)[0] || null,
    shallowEqual
  )

  if (!testTask) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">State Machine Test</h1>
        <p className="text-muted-foreground">No tasks found. Please create a task first.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">State Machine Test Page</h1>
        <p className="text-muted-foreground">Testing XState machine for grid cell optimistic updates</p>
      </div>

      <StateMachineCell
        taskId={testTask.id}
        columnKey="title"
        atomValue={testTask.title}
      />
    </div>
  )
}

interface StateMachineCellProps {
  taskId: string
  columnKey: string
  atomValue: any
}

function StateMachineCell({ taskId, columnKey, atomValue }: StateMachineCellProps) {
  const [debugLog, setDebugLog] = useState<string[]>([])
  
  // Subscribe to the actual task atom for live updates
  const liveTask = useSelector(
    tasksAtom,
    (tasks) => tasks[taskId] || null,
    shallowEqual
  )
  const liveAtomValue = liveTask?.[columnKey as keyof typeof liveTask]
  
  const addLog = React.useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    setDebugLog(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 9)])
  }, [])

  // Real save function using task operations
  const realSave = React.useCallback(async (id: string, column: string, value: any) => {
    addLog(`🚀 REAL SAVE STARTED: ${column}="${value}"`)
    
    try {
      // Import and call real updateTaskUI
      const { updateTaskUI } = await import('@/domain/task')
      
      await updateTaskUI(id, { [column]: value })
      addLog(`✅ REAL SAVE SUCCESS: ${column}="${value}"`)
    } catch (error) {
      addLog(`❌ REAL SAVE FAILED: ${error}`)
      throw error
    }
  }, [addLog])

  // Use state machine
  const {
    state,
    displayValue,
    isEditing,
    isCommitting,
    isPersisting,
    hasError,
    error,
    canRetry,
    actions
  } = useGridCellState(taskId, columnKey, liveAtomValue, realSave)

  // Track state changes
  React.useEffect(() => {
    addLog(`🔄 STATE: ${state.value} (display: "${displayValue}")`)
  }, [state.value, displayValue, addLog])

  // Track live atom updates
  React.useEffect(() => {
    addLog(`🔗 LIVE ATOM UPDATE: "${liveAtomValue}"`)
  }, [liveAtomValue, addLog])

  const [inputValue, setInputValue] = useState('')

  React.useEffect(() => {
    if (isEditing) {
      setInputValue(state.context.editingValue || '')
    }
  }, [isEditing, state.context.editingValue])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">🔧 State Machine Cell Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Display Value */}
        <div className="p-3 border rounded bg-muted">
          <div className="text-sm font-medium mb-1">Display Value:</div>
          <div className="text-lg font-mono">"{displayValue}"</div>
        </div>
        
        {/* State Info */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant={state.matches('idle') ? 'default' : 'outline'}>
            State: {String(state.value)}
          </Badge>
          {isEditing && <Badge className="bg-blue-100 text-blue-800">Editing</Badge>}
          {isCommitting && <Badge className="bg-yellow-100 text-yellow-800">Committing</Badge>}
          {isPersisting && <Badge className="bg-orange-100 text-orange-800">Persisting</Badge>}
          {hasError && <Badge className="bg-red-100 text-red-800">Error</Badge>}
        </div>

        {/* Error Display */}
        {hasError && error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded">
            <div className="text-red-600 text-sm">❌ {error}</div>
            {canRetry && (
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2" 
                onClick={actions.retrySave}
              >
                Retry Save
              </Button>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="space-y-2">
          {!isEditing ? (
            <Button onClick={actions.startEdit} disabled={isCommitting || isPersisting}>
              Start Editing
            </Button>
          ) : (
            <div className="space-y-2">
              <Input 
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  actions.changeValue(e.target.value)
                }}
                placeholder="Edit value..."
              />
              <div className="flex gap-2">
                <Button 
                  onClick={() => actions.commitEdit(inputValue)}
                  disabled={isCommitting || isPersisting}
                >
                  Commit
                </Button>
                <Button 
                  variant="outline" 
                  onClick={actions.cancelEdit}
                  disabled={isCommitting || isPersisting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Debug Log */}
        <div className="text-xs bg-muted p-3 rounded max-h-32 overflow-y-auto">
          <div className="font-medium mb-2">Debug Log:</div>
          {debugLog.map((log, i) => (
            <div key={i} className="font-mono">{log}</div>
          ))}
        </div>
        
        {/* Atom Value Reference */}
        <div className="text-xs text-muted-foreground">
          Live Atom Value: "{liveAtomValue}"<br/>
          Prop Atom Value: "{atomValue}"
        </div>
      </CardContent>
    </Card>
  )
}