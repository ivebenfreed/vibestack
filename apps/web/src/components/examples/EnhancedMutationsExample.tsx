/**
 * Enhanced Mutations Example Component
 * 
 * Demonstrates the improved Legend State mutation system with:
 * - Enhanced error handling
 * - Server-side validation
 * - Batch operations
 * - Event-based feedback
 */

import React, { useState, useEffect } from 'react'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { batch } from '@legendapp/state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  getEntity$, 
  batchOperations, 
  entityOperations, 
  ValidationError, 
  ConflictError 
} from '@/legend-state'

interface TaskData {
  id?: string
  name: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
}

export const EnhancedMutationsExample = observer(() => {
  const [newTaskName, setNewTaskName] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Get the tasks entity observable
  const tasks$ = getEntity$('task')
  const tasks = use$(tasks$)

  // Listen for entity operation events
  useEffect(() => {
    const handleEntityEvent = (event: CustomEvent) => {
      const { entityName, operation, error } = event.detail
      if (entityName === 'task') {
        if (event.type === 'vibestack:entity-error') {
          setFeedback({ type: 'error', message: `${operation} failed: ${error}` })
        } else {
          setFeedback({ type: 'success', message: `Task ${operation} successful` })
        }
        setTimeout(() => setFeedback(null), 3000)
      }
    }

    window.addEventListener('vibestack:entity-created', handleEntityEvent)
    window.addEventListener('vibestack:entity-updated', handleEntityEvent)
    window.addEventListener('vibestack:entity-deleted', handleEntityEvent)
    window.addEventListener('vibestack:entity-error', handleEntityEvent)

    return () => {
      window.removeEventListener('vibestack:entity-created', handleEntityEvent)
      window.removeEventListener('vibestack:entity-updated', handleEntityEvent)
      window.removeEventListener('vibestack:entity-deleted', handleEntityEvent)
      window.removeEventListener('vibestack:entity-error', handleEntityEvent)
    }
  }, [])

  // Enhanced create operation with validation
  const handleCreateTask = async () => {
    if (!newTaskName.trim()) return

    setIsLoading(true)
    try {
      const taskData: TaskData = {
        name: newTaskName.trim(),
        description: 'Created via enhanced mutations example',
        status: 'pending',
        priority: 'medium'
      }

      await entityOperations.createEntity('task', taskData, { validate: true })
      setNewTaskName('')
    } catch (error) {
      if (error instanceof ValidationError) {
        setFeedback({ 
          type: 'error', 
          message: `Validation failed: ${error.errors.join(', ')}` 
        })
      } else {
        setFeedback({ 
          type: 'error', 
          message: `Create failed: ${error.message}` 
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Batch update multiple tasks
  const handleBatchUpdateStatuses = async () => {
    if (!tasks || Object.keys(tasks).length === 0) return

    setIsLoading(true)
    try {
      const taskIds = Object.keys(tasks)
      const updates = taskIds.map(id => ({
        id,
        data: { status: 'in_progress' as const }
      }))

      await batchOperations.batchUpdate('task', updates)
      setFeedback({ 
        type: 'success', 
        message: `Batch updated ${updates.length} tasks` 
      })
    } catch (error) {
      setFeedback({ 
        type: 'error', 
        message: `Batch update failed: ${error.message}` 
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Individual task update with optimistic UI
  const handleUpdateTask = async (id: string, updates: Partial<TaskData>) => {
    try {
      await entityOperations.updateEntity('task', id, updates, { validate: true })
    } catch (error) {
      console.error('Task update failed:', error)
    }
  }

  // Individual task deletion
  const handleDeleteTask = async (id: string) => {
    try {
      await entityOperations.deleteEntity('task', id)
    } catch (error) {
      console.error('Task deletion failed:', error)
    }
  }

  // Batch create multiple tasks
  const handleBatchCreate = async () => {
    setIsLoading(true)
    try {
      const newTasks: TaskData[] = [
        { name: 'Batch Task 1', status: 'pending', priority: 'low' },
        { name: 'Batch Task 2', status: 'pending', priority: 'medium' },
        { name: 'Batch Task 3', status: 'pending', priority: 'high' },
      ]

      const result = await batchOperations.batchCreate('task', newTasks)
      setFeedback({ 
        type: 'success', 
        message: `Created ${result.successful}/${newTasks.length} tasks` 
      })
    } catch (error) {
      setFeedback({ 
        type: 'error', 
        message: `Batch create failed: ${error.message}` 
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Batch delete all tasks
  const handleBatchDelete = async () => {
    if (!tasks || Object.keys(tasks).length === 0) return

    setIsLoading(true)
    try {
      const taskIds = Object.keys(tasks)
      const result = await batchOperations.batchDelete('task', taskIds)
      setFeedback({ 
        type: 'success', 
        message: `Deleted ${result.successful}/${taskIds.length} tasks` 
      })
    } catch (error) {
      setFeedback({ 
        type: 'error', 
        message: `Batch delete failed: ${error.message}` 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const taskArray = tasks ? Object.values(tasks) : []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Enhanced Mutations Demo</CardTitle>
          <CardDescription>
            Demonstrates improved error handling, validation, and batch operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Feedback Alert */}
          {feedback && (
            <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          )}

          {/* Create Task Section */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Create Task (with validation)</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Task name..."
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateTask()}
              />
              <Button 
                onClick={handleCreateTask} 
                disabled={isLoading || !newTaskName.trim()}
              >
                Create Task
              </Button>
            </div>
          </div>

          {/* Batch Operations Section */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Batch Operations</h3>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                onClick={handleBatchCreate}
                disabled={isLoading}
              >
                Batch Create 3 Tasks
              </Button>
              <Button 
                variant="outline" 
                onClick={handleBatchUpdateStatuses}
                disabled={isLoading || taskArray.length === 0}
              >
                Batch Update All to "In Progress"
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleBatchDelete}
                disabled={isLoading || taskArray.length === 0}
              >
                Batch Delete All Tasks
              </Button>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              Tasks ({taskArray.length})
            </h3>
            {taskArray.length === 0 ? (
              <p className="text-muted-foreground">No tasks yet. Create some to see enhanced mutations in action.</p>
            ) : (
              <div className="space-y-2">
                {taskArray.map((task: any) => (
                  <Card key={task.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{task.name}</h4>
                        <div className="flex gap-2">
                          <Badge variant={
                            task.status === 'completed' ? 'default' :
                            task.status === 'in_progress' ? 'secondary' : 'outline'
                          }>
                            {task.status}
                          </Badge>
                          <Badge variant="outline">{task.priority}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateTask(task.id, { 
                            status: task.status === 'completed' ? 'pending' : 'completed' 
                          })}
                        >
                          {task.status === 'completed' ? 'Reopen' : 'Complete'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
})