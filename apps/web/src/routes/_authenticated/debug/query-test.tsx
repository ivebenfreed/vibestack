import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { updateTaskUI, getTaskDependencies, tasksAtom } from '@/domain/task'
import { usersAtom } from '@/domain/user'
import { projectsAtom } from '@/domain/project'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'

export const Route = createFileRoute('/_authenticated/debug/query-test')({
  component: QueryTestPage,
})

function QueryTestPage() {
  const [results, setResults] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  // Get test data
  const tasks = useSelector(tasksAtom, (tasksRecord) => Object.values(tasksRecord), shallowEqual)
  const users = useSelector(usersAtom, (usersRecord) => Object.values(usersRecord), shallowEqual)
  const projects = useSelector(projectsAtom, (projectsRecord) => Object.values(projectsRecord), shallowEqual)

  const testTask = tasks[0]
  const testUser = users[0]
  const testProject = projects[0]

  // Debug logging
  React.useEffect(() => {
    console.log('[QueryTest] Debug data:', {
      tasksCount: tasks.length,
      usersCount: users.length,
      projectsCount: projects.length,
      testTask: testTask?.id,
      testUser: testUser?.id,
      testProject: testProject?.id
    })
  }, [tasks.length, users.length, projects.length, testTask?.id, testUser?.id, testProject?.id])

  const loadTestData = async () => {
    try {
      // Import and call ensure loaded functions
      const { ensureTasksLoaded } = await import('@/domain/ensure-loaded')
      const { ensureUsersLoaded } = await import('@/domain/ensure-loaded')
      const { ensureProjectsLoaded } = await import('@/domain/ensure-loaded')
      
      await ensureTasksLoaded()
      await ensureUsersLoaded()
      await ensureProjectsLoaded()
      
      addResult('Load Test Data', true, { message: 'Data loaded successfully' })
    } catch (error) {
      addResult('Load Test Data', false, null, error)
    }
  }

  const addResult = (test: string, success: boolean, data: any, error?: any) => {
    setResults(prev => [...prev, {
      test,
      success,
      data,
      error: error?.message || error,
      timestamp: new Date().toLocaleTimeString()
    }])
  }

  const testHardcodedQuery = async () => {
    if (!testTask) return
    
    setIsLoading(true)
    try {
      console.log('[QueryTest] Testing hardcoded query...')
      
      // Get dependencies to use the same dataSource
      const dependencies = await getTaskDependencies()
      const taskRepo = dependencies.dataSource.getRepository(dependencies.EntityClass)
      
      // Test 1: Simple hardcoded update using save pattern
      console.log('[QueryTest] Test 1: Hardcoded save pattern')
      const entityToUpdate = await taskRepo.findOne({ where: { id: testTask.id } })
      if (entityToUpdate) {
        entityToUpdate.title = `Hardcoded Test ${Date.now()}`
        const result = await taskRepo.save(entityToUpdate)
        addResult('Hardcoded Save Pattern', true, { updatedTitle: result.title })
      }

      // Test 2: Direct repo.update call (this should fail)
      console.log('[QueryTest] Test 2: Direct repo.update call')
      try {
        await taskRepo.update(testTask.id, { title: `Direct Update Test ${Date.now()}` })
        addResult('Direct repo.update', true, { message: 'Update succeeded' })
      } catch (error) {
        addResult('Direct repo.update', false, null, error)
      }

    } catch (error) {
      console.error('[QueryTest] Hardcoded query failed:', error)
      addResult('Hardcoded Query', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testGeneratedQuery = async () => {
    if (!testTask) return
    
    setIsLoading(true)
    try {
      console.log('[QueryTest] Testing generated DataForge operation...')
      
      // Use the generated updateTaskUI function
      await updateTaskUI(testTask.id, { 
        title: `Generated Test ${Date.now()}` 
      })
      
      addResult('Generated DataForge Operation', true, { message: 'UpdateTaskUI succeeded' })
      
    } catch (error) {
      console.error('[QueryTest] Generated query failed:', error)
      addResult('Generated DataForge Operation', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testProjectRelationshipUpdate = async () => {
    if (!testTask || !testProject) return
    
    setIsLoading(true)
    try {
      console.log('[QueryTest] Testing project relationship update...')
      
      // Test updating a project relationship field
      await updateTaskUI(testTask.id, { 
        projectId: testProject.id 
      })
      
      addResult('Project Relationship Update', true, { 
        message: 'Project relationship updated',
        projectId: testProject.id 
      })
      
    } catch (error) {
      console.error('[QueryTest] Project relationship update failed:', error)
      addResult('Project Relationship Update', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testAssigneeRelationshipUpdate = async () => {
    if (!testTask || !testUser) return
    
    setIsLoading(true)
    try {
      console.log('[QueryTest] Testing assignee relationship update...')
      
      // Test updating an assignee relationship field
      await updateTaskUI(testTask.id, { 
        assigneeId: testUser.id 
      })
      
      addResult('Assignee Relationship Update', true, { 
        message: 'Assignee relationship updated',
        assigneeId: testUser.id 
      })
      
    } catch (error) {
      console.error('[QueryTest] Assignee relationship update failed:', error)
      addResult('Assignee Relationship Update', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testTaskDependenciesUpdate = async () => {
    if (!testTask || tasks.length < 2) return
    
    setIsLoading(true)
    try {
      console.log('[QueryTest] Testing task dependencies relationship update...')
      
      // Get a different task to use as dependency
      const dependencyTask = tasks.find(t => t.id !== testTask.id)
      if (!dependencyTask) {
        addResult('Task Dependencies Update', false, null, 'Not enough tasks for dependency test')
        return
      }
      
      // Test updating many-to-many dependencies relationship
      await updateTaskUI(testTask.id, { 
        dependencies: [dependencyTask.id]
      })
      
      addResult('Task Dependencies Update', true, { 
        message: 'Task dependencies updated',
        dependencyTaskId: dependencyTask.id 
      })
      
    } catch (error) {
      console.error('[QueryTest] Task dependencies update failed:', error)
      addResult('Task Dependencies Update', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testTasksDependentOnThisUpdate = async () => {
    if (!testTask || tasks.length < 2) return
    
    setIsLoading(true)
    try {
      console.log('[QueryTest] Testing tasksDependentOnThis relationship update...')
      
      // Get a different task to use as dependent
      const dependentTask = tasks.find(t => t.id !== testTask.id)
      if (!dependentTask) {
        addResult('TasksDependentOnThis Update', false, null, 'Not enough tasks for dependent test')
        return
      }
      
      // Test updating many-to-many tasksDependentOnThis relationship
      await updateTaskUI(testTask.id, { 
        tasksDependentOnThis: [dependentTask.id]
      })
      
      addResult('TasksDependentOnThis Update', true, { 
        message: 'TasksDependentOnThis updated',
        dependentTaskId: dependentTask.id 
      })
      
    } catch (error) {
      console.error('[QueryTest] TasksDependentOnThis update failed:', error)
      addResult('TasksDependentOnThis Update', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const testMultipleRelationshipsUpdate = async () => {
    if (!testTask || !testProject || !testUser) return
    
    setIsLoading(true)
    try {
      console.log('[QueryTest] Testing multiple relationships update...')
      
      // Test updating multiple relationship fields at once
      await updateTaskUI(testTask.id, { 
        projectId: testProject.id,
        assigneeId: testUser.id
      })
      
      addResult('Multiple Relationships Update', true, { 
        message: 'Multiple relationships updated',
        projectId: testProject.id,
        assigneeId: testUser.id 
      })
      
    } catch (error) {
      console.error('[QueryTest] Multiple relationships update failed:', error)
      addResult('Multiple Relationships Update', false, null, error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearResults = () => setResults([])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Query Test Debug Page</CardTitle>
          <CardDescription>
            Compare hardcoded queries vs generated DataForge operations to identify the issue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {testTask && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Test Data:</h4>
              <p><strong>Task:</strong> {testTask.title} ({testTask.id.slice(-8)})</p>
              <p><strong>Available Users:</strong> {users.length}</p>
              <p><strong>Available Projects:</strong> {projects.length}</p>
            </div>
          )}
          
          <div className="flex gap-3 flex-wrap">
            <Button 
              onClick={loadTestData}
              disabled={isLoading}
              variant="default"
            >
              Load Test Data
            </Button>
            
            <Button 
              onClick={testHardcodedQuery}
              disabled={isLoading || !testTask}
              variant="outline"
            >
              Test Hardcoded Query
            </Button>
            
            <Button 
              onClick={testGeneratedQuery}
              disabled={isLoading || !testTask}
              variant="outline"
            >
              Test Generated Query
            </Button>
            
            <Button 
              onClick={testProjectRelationshipUpdate}
              disabled={isLoading || !testTask || !testProject}
              variant="outline"
            >
              Test Project Relationship
            </Button>
            
            <Button 
              onClick={testAssigneeRelationshipUpdate}
              disabled={isLoading || !testTask || !testUser}
              variant="outline"
            >
              Test Assignee Relationship
            </Button>
            
            <Button 
              onClick={testTaskDependenciesUpdate}
              disabled={isLoading || !testTask || tasks.length < 2}
              variant="outline"
            >
              Test Task Dependencies
            </Button>
            
            <Button 
              onClick={testTasksDependentOnThisUpdate}
              disabled={isLoading || !testTask || tasks.length < 2}
              variant="outline"
            >
              Test Tasks Dependent On This
            </Button>
            
            <Button 
              onClick={testMultipleRelationshipsUpdate}
              disabled={isLoading || !testTask || !testProject || !testUser}
              variant="outline"
            >
              Test Multiple Relationships
            </Button>
            
            <Button 
              onClick={clearResults}
              variant="secondary"
            >
              Clear Results
            </Button>
          </div>
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
                      <strong>Result:</strong> {JSON.stringify(result.data, null, 2)}
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