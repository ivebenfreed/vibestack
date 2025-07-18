import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { updateTaskUI, getTaskDependencies, tasksAtom } from '@/domain/task'
import { statusDefinitionsAtom } from '@/domain/status-definition'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'

export const Route = createFileRoute('/_authenticated/debug/status-test')({
  component: StatusTestPage,
})

function StatusTestPage() {
  const [results, setResults] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [statusDefinitions, setStatusDefinitions] = React.useState<any[]>([])

  // Get test data
  const tasks = useSelector(tasksAtom, (tasksRecord) => Object.values(tasksRecord), shallowEqual)
  const statusDefinitionsFromAtom = useSelector(statusDefinitionsAtom, (statusDefinitionsRecord) => Object.values(statusDefinitionsRecord), shallowEqual)
  const testTask = tasks[0]

  // Debug logging
  React.useEffect(() => {
    console.log('[StatusTest] Debug data:', {
      tasksCount: tasks.length,
      testTask: testTask?.id,
      testTaskStatus: testTask?.status,
      testTaskStatusId: testTask?.statusId,
      statusDefinitionsFromAtomCount: statusDefinitionsFromAtom.length,
      statusDefinitionsFromStateCount: statusDefinitions.length
    })
  }, [tasks.length, testTask?.id, testTask?.status, testTask?.statusId, statusDefinitionsFromAtom.length, statusDefinitions.length])

  const addResult = (test: string, success: boolean, data: any, error?: any) => {
    setResults(prev => [...prev, {
      test,
      success,
      data,
      error: error?.message || error,
      timestamp: new Date().toLocaleTimeString()
    }])
  }

  const loadStatusDefinitions = async () => {
    setIsLoading(true)
    try {
      console.log('[StatusTest] Loading StatusDefinitions...')
      
      // Get the data source from task dependencies
      const dependencies = await getTaskDependencies()
      const { dataSource } = dependencies
      
      // Import StatusDefinition entity
      const { StatusDefinition } = await import('@repo/dataforge/client-entities')
      
      // Query all status definitions
      const statusDefRepo = dataSource.getRepository(StatusDefinition)
      const statuses = await statusDefRepo.find({
        order: { sortOrder: 'ASC' }
      })
      
      setStatusDefinitions(statuses)
      addResult('Load StatusDefinitions', true, { 
        count: statuses.length,
        statuses: statuses.map(s => ({ id: s.id, name: s.name, label: s.label }))
      })
      
    } catch (error) {
      console.error('[StatusTest] Failed to load StatusDefinitions:', error)
      addResult('Load StatusDefinitions', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testStatusUpdate = async (statusId: string, statusName: string) => {
    if (!testTask) return
    
    setIsLoading(true)
    try {
      console.log('[StatusTest] Testing status update...', { statusId, statusName })
      
      // Test updating status using the updateTaskUI function
      await updateTaskUI(testTask.id, { 
        statusId: statusId 
      })
      
      addResult(`Update Status to ${statusName}`, true, { 
        message: `Status updated to ${statusName}`,
        statusId: statusId 
      })
      
    } catch (error) {
      console.error('[StatusTest] Status update failed:', error)
      addResult(`Update Status to ${statusName}`, false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testDirectStatusQuery = async () => {
    setIsLoading(true)
    try {
      console.log('[StatusTest] Testing direct status query...')
      
      // Get the data source from task dependencies
      const dependencies = await getTaskDependencies()
      const { dataSource } = dependencies
      
      // Import StatusDefinition entity
      const { StatusDefinition } = await import('@repo/dataforge/client-entities')
      
      // Test direct query
      const statusDefRepo = dataSource.getRepository(StatusDefinition)
      const defaultStatus = await statusDefRepo.findOne({
        where: { isDefault: true }
      })
      
      addResult('Direct Status Query', true, { 
        defaultStatus: defaultStatus ? {
          id: defaultStatus.id,
          name: defaultStatus.name,
          label: defaultStatus.label,
          isDefault: defaultStatus.isDefault
        } : null
      })
      
    } catch (error) {
      console.error('[StatusTest] Direct status query failed:', error)
      addResult('Direct Status Query', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testTaskWithStatusQuery = async () => {
    if (!testTask) return
    
    setIsLoading(true)
    try {
      console.log('[StatusTest] Testing task with status query...')
      
      // Get the data source from task dependencies
      const dependencies = await getTaskDependencies()
      const { dataSource, EntityClass } = dependencies
      
      // Query task with status relation
      const taskRepo = dataSource.getRepository(EntityClass)
      const taskWithStatus = await taskRepo.findOne({
        where: { id: testTask.id },
        relations: ['status']
      })
      
      addResult('Task with Status Query', true, { 
        taskId: taskWithStatus?.id,
        taskTitle: taskWithStatus?.title,
        status: taskWithStatus?.status ? {
          id: taskWithStatus.status.id,
          name: taskWithStatus.status.name,
          label: taskWithStatus.status.label
        } : null,
        statusId: taskWithStatus?.statusId
      })
      
    } catch (error) {
      console.error('[StatusTest] Task with status query failed:', error)
      addResult('Task with Status Query', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testHardcodedStatusUpdate = async () => {
    if (!testTask || statusDefinitions.length === 0) return
    
    setIsLoading(true)
    try {
      console.log('[StatusTest] Testing hardcoded status update...')
      
      // Get the data source from task dependencies
      const dependencies = await getTaskDependencies()
      const { dataSource, EntityClass } = dependencies
      
      // Use the first available status
      const targetStatus = statusDefinitions[0]
      
      // Test hardcoded update using save pattern
      const taskRepo = dataSource.getRepository(EntityClass)
      const entityToUpdate = await taskRepo.findOne({ where: { id: testTask.id } })
      
      if (entityToUpdate) {
        entityToUpdate.statusId = targetStatus.id
        const result = await taskRepo.save(entityToUpdate)
        
        addResult('Hardcoded Status Update', true, { 
          updatedStatusId: result.statusId,
          targetStatusName: targetStatus.name
        })
      }
      
    } catch (error) {
      console.error('[StatusTest] Hardcoded status update failed:', error)
      addResult('Hardcoded Status Update', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testAtomVsQuery = async () => {
    setIsLoading(true)
    try {
      console.log('[StatusTest] Testing atom vs query comparison...')
      
      // Test 1: Check atom state
      const atomStatusDefinitions = statusDefinitionsAtom.get()
      
      // Test 2: Check database query
      const dependencies = await getTaskDependencies()
      const { dataSource } = dependencies
      const { StatusDefinition } = await import('@repo/dataforge/client-entities')
      const statusDefRepo = dataSource.getRepository(StatusDefinition)
      const queryStatusDefinitions = await statusDefRepo.find({
        order: { sortOrder: 'ASC' }
      })
      
      addResult('Atom vs Query Comparison', true, { 
        atomCount: Object.keys(atomStatusDefinitions).length,
        queryCount: queryStatusDefinitions.length,
        atomIds: Object.keys(atomStatusDefinitions),
        queryIds: queryStatusDefinitions.map(s => s.id),
        firstAtomStatus: Object.values(atomStatusDefinitions)[0] ? {
          id: Object.values(atomStatusDefinitions)[0].id,
          name: Object.values(atomStatusDefinitions)[0].name
        } : null,
        firstQueryStatus: queryStatusDefinitions[0] ? {
          id: queryStatusDefinitions[0].id,
          name: queryStatusDefinitions[0].name
        } : null
      })
      
    } catch (error) {
      console.error('[StatusTest] Atom vs query comparison failed:', error)
      addResult('Atom vs Query Comparison', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearResults = () => setResults([])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Status Test Debug Page</CardTitle>
          <CardDescription>
            Test StatusDefinition queries and task status updates to debug the foreign key constraint issue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {testTask && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Test Data:</h4>
              <p><strong>Task:</strong> {testTask.title} ({testTask.id.slice(-8)})</p>
              <p><strong>Current Status ID:</strong> {testTask.statusId || 'null'}</p>
              <p><strong>Current Status:</strong> {testTask.status?.name || 'null'}</p>
              <p><strong>Status Definitions from Atom:</strong> {statusDefinitionsFromAtom.length}</p>
              <p><strong>Status Definitions from Query:</strong> {statusDefinitions.length}</p>
            </div>
          )}
          
          <div className="flex gap-3 flex-wrap">
            <Button 
              onClick={testAtomVsQuery}
              disabled={isLoading}
              variant="default"
            >
              Test Atom vs Query
            </Button>
            
            <Button 
              onClick={loadStatusDefinitions}
              disabled={isLoading}
              variant="outline"
            >
              Load Status Definitions
            </Button>
            
            <Button 
              onClick={testDirectStatusQuery}
              disabled={isLoading}
              variant="outline"
            >
              Test Direct Status Query
            </Button>
            
            <Button 
              onClick={testTaskWithStatusQuery}
              disabled={isLoading || !testTask}
              variant="outline"
            >
              Test Task with Status Query
            </Button>
            
            <Button 
              onClick={testHardcodedStatusUpdate}
              disabled={isLoading || !testTask || statusDefinitions.length === 0}
              variant="outline"
            >
              Test Hardcoded Status Update
            </Button>
            
            <Button 
              onClick={clearResults}
              variant="secondary"
            >
              Clear Results
            </Button>
          </div>

          {statusDefinitions.length > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Available Status Definitions:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {statusDefinitions.map((status) => (
                  <div key={status.id} className="flex items-center justify-between p-2 bg-background rounded border">
                    <div>
                      <span className="font-medium">{status.label}</span>
                      <span className="text-sm text-muted-foreground ml-2">({status.name})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.isDefault ? "default" : "outline"} className="text-xs">
                        {status.isDefault ? "Default" : "Regular"}
                      </Badge>
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => testStatusUpdate(status.id, status.name)}
                        disabled={isLoading || !testTask}
                      >
                        Test Update
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div 
                  key={index}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "✅ SUCCESS" : "❌ FAILED"}
                    </Badge>
                    <span className="font-medium">{result.test}</span>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {result.timestamp}
                    </span>
                  </div>
                  
                  {result.data && (
                    <div className="bg-green-50 dark:bg-green-950 p-2 rounded text-sm">
                      <strong>Result:</strong> <pre className="mt-1">{JSON.stringify(result.data, null, 2)}</pre>
                    </div>
                  )}
                  
                  {result.error && (
                    <div className="bg-red-50 dark:bg-red-950 p-2 rounded text-sm">
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}