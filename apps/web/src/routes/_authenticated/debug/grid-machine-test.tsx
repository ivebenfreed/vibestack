import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import { tasksAtom } from '@/domain/task'
import { updateTaskUI } from '@/domain/task'
import { VibeGridOptimus } from '@/components/custom/vibegridoptimus/VibeGridOptimus'

export const Route = createFileRoute('/_authenticated/debug/grid-machine-test')({
  component: GridMachineTestPage,
})

function GridMachineTestPage() {
  const [logs, setLogs] = React.useState<string[]>([])
  const [testStartTime, setTestStartTime] = React.useState<number | null>(null)

  // Get tasks from atom
  const tasks = useSelector(
    tasksAtom,
    (tasksRecord) => Object.values(tasksRecord),
    shallowEqual
  )

  const addLog = React.useCallback((message: string) => {
    const timestamp = testStartTime ? Date.now() - testStartTime : 0
    setLogs(prev => [...prev, `[+${timestamp}ms] ${message}`])
  }, [testStartTime])

  // Custom save handler with logging
  const handleSave = React.useCallback(async (id: string, column: string, value: any) => {
    addLog(`🚀 SAVE CALLED: ${id}.${column} = ${JSON.stringify(value)}`)
    
    try {
      await updateTaskUI(id, { [column]: value })
      addLog(`✅ SAVE SUCCESS: ${id}.${column}`)
    } catch (error) {
      addLog(`❌ SAVE FAILED: ${id}.${column} - ${error}`)
      throw error
    }
  }, [addLog])

  const startTest = React.useCallback(() => {
    setTestStartTime(Date.now())
    setLogs([])
    addLog('🔬 Grid machine test started')
  }, [addLog])

  const clearLogs = React.useCallback(() => {
    setLogs([])
    setTestStartTime(null)
  }, [])

  // Monitor atom updates
  React.useEffect(() => {
    if (testStartTime) {
      addLog(`📊 Atom has ${tasks.length} tasks`)
    }
  }, [tasks.length, testStartTime, addLog])

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <h1 className="text-2xl font-bold mb-2">Grid Machine Integration Test</h1>
        <p className="text-muted-foreground mb-4">
          Testing comprehensive XState grid machine with cell actors, optimistic updates, and state coordination.
        </p>
        
        <div className="flex gap-2">
          <button
            onClick={startTest}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            🔬 Start Test
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          >
            🧹 Clear Logs
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Grid */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-lg font-semibold mb-2">VibeGridOptimus with Grid Machine</h2>
          <div className="flex-1 border border-border rounded-lg overflow-hidden">
            <VibeGridOptimus
              entityName="Task"
              data={tasks}
              onSave={handleSave}
              height="100%"
              theme="light"
            />
          </div>
        </div>

        {/* Logs */}
        <div className="w-1/3 flex flex-col min-w-0">
          <h2 className="text-lg font-semibold mb-2">Real-time Logs</h2>
          <div className="flex-1 bg-gray-900 text-green-400 font-mono text-xs p-3 rounded-lg overflow-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">Click "Start Test" to begin monitoring...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1 whitespace-pre-wrap">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Test Instructions */}
      <div className="p-4 border-t border-border bg-card">
        <h3 className="font-semibold mb-2">Test Instructions:</h3>
        <ol className="text-sm text-muted-foreground space-y-1">
          <li>1. Click "Start Test" to begin monitoring</li>
          <li>2. Try editing text fields (should see optimistic updates)</li>
          <li>3. Try editing dropdowns (should see immediate commits)</li>
          <li>4. Watch for state machine transitions in logs</li>
          <li>5. Verify no flash during editor transitions</li>
          <li>6. Test sorting and selection features</li>
          <li>7. Monitor grid machine state indicators</li>
        </ol>
      </div>
    </div>
  )
}

export default GridMachineTestPage