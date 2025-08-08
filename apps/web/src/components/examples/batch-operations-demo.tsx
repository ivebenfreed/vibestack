/**
 * Batch Operations Demo
 * 
 * This example demonstrates how to use the new batch operations
 * in domain services for efficient bulk updates.
 */

import React, { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { domainServices } from '@/domain'
import type { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities'

export function BatchOperationsDemo() {
  
  // Example 1: Batch update multiple tasks
  const handleBatchUpdateTasks = useCallback(async () => {
    // Simulate updating multiple tasks to "completed" status
    const tasksToUpdate = [
      { id: 'task-1', updates: { status: 'completed' as TaskStatus } },
      { id: 'task-2', updates: { status: 'completed' as TaskStatus } },
      { id: 'task-3', updates: { status: 'completed' as TaskStatus, priority: 'low' as TaskPriority } },
    ];
    
    try {
      const updatedTasks = await domainServices.task.batchUpdate(tasksToUpdate);
      console.log('Batch updated tasks:', updatedTasks);
    } catch (error) {
      console.error('Batch update failed:', error);
    }
  }, []);
  
  // Example 2: Batch create multiple tasks
  const handleBatchCreateTasks = useCallback(async () => {
    const newTasks = [
      {
        title: 'Task 1',
        description: 'First batch created task',
        status: 'todo' as TaskStatus,
        priority: 'medium' as TaskPriority
      },
      {
        title: 'Task 2',
        description: 'Second batch created task',
        status: 'todo' as TaskStatus,
        priority: 'high' as TaskPriority
      },
      {
        title: 'Task 3',
        description: 'Third batch created task',
        status: 'in_progress' as TaskStatus,
        priority: 'low' as TaskPriority
      }
    ];
    
    try {
      const createdTasks = await domainServices.task.batchCreate(newTasks);
      console.log('Batch created tasks:', createdTasks);
    } catch (error) {
      console.error('Batch create failed:', error);
    }
  }, []);
  
  // Example 3: Batch delete multiple tasks
  const handleBatchDeleteTasks = useCallback(async () => {
    const tasksToDelete = ['task-1', 'task-2', 'task-3'];
    
    try {
      const result = await domainServices.task.batchDelete(tasksToDelete);
      console.log('Batch delete result:', result);
      console.log('Deleted:', result.deleted);
      console.log('Not found:', result.notFound);
    } catch (error) {
      console.error('Batch delete failed:', error);
    }
  }, []);
  
  // Example 4: Using batch operations with VibeGridDex
  const GridExample = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">VibeGridDex with Batch Operations</h3>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`import { VibeGridDexWithSuspense } from '@/components/custom/vibegriddex/VibeGridDex'
import { domainServices } from '@/domain'

function TasksTable() {
  // Define batch update handler
  const handleBatchUpdate = useCallback(async (updates) => {
    try {
      await domainServices.task.batchUpdate(updates);
    } catch (error) {
      console.error('Batch update failed', error);
      throw error;
    }
  }, []);

  return (
    <VibeGridDexWithSuspense
      tableId="tasks-table"
      entityType="task"
      columns={columns}
      onEntityUpdate={(id, updates) => domainServices.task.update(id, updates)}
      onBatchEntityUpdate={handleBatchUpdate}    // Batch updates for fill & paste
    />
  );
}`}</pre>
      </div>
    );
  };
  
  // Example 5: Batch operations in sync handlers
  const SyncExample = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Batch Operations for Incoming Sync</h3>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`// In your sync handler
async function handleIncomingChanges(changes: TableChange[]) {
  // Group changes by operation type
  const creates: Task[] = [];
  const updates: Array<{ id: string; updates: Partial<Task> }> = [];
  const deletes: string[] = [];
  
  for (const change of changes) {
    switch (change.operation) {
      case 'insert':
        creates.push(change.data as Task);
        break;
      case 'update':
        updates.push({ 
          id: change.data.id, 
          updates: change.data 
        });
        break;
      case 'delete':
        deletes.push(change.data.id);
        break;
    }
  }
  
  // Apply batch operations (sync transactions to avoid tracking)
  if (creates.length > 0) {
    await domainServices.task.batchCreateSync(creates);
  }
  if (updates.length > 0) {
    await domainServices.task.batchUpdateSync(updates);
  }
  if (deletes.length > 0) {
    await domainServices.task.batchDeleteSync(deletes);
  }
}`}</pre>
      </div>
    );
  };
  
  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Batch Operations Demo</h2>
      
      <div className="space-y-4">
        <div className="flex gap-4">
          <Button onClick={handleBatchCreateTasks}>
            Batch Create Tasks
          </Button>
          <Button onClick={handleBatchUpdateTasks}>
            Batch Update Tasks
          </Button>
          <Button onClick={handleBatchDeleteTasks}>
            Batch Delete Tasks
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Open the console to see the results of batch operations.
        </div>
      </div>
      
      <div className="border-t pt-6 space-y-6">
        <GridExample />
        <SyncExample />
      </div>
      
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Benefits of Batch Operations</h3>
        <ul className="space-y-2 text-sm">
          <li>✅ <strong>Performance:</strong> Single database transaction for multiple operations</li>
          <li>✅ <strong>Consistency:</strong> All operations succeed or fail together</li>
          <li>✅ <strong>Efficiency:</strong> Reduced overhead for sync tracking</li>
          <li>✅ <strong>Fill Operations:</strong> Automatically uses batch updates when available</li>
          <li>✅ <strong>Paste Operations:</strong> Groups multiple cell updates into one batch</li>
        </ul>
      </div>
    </div>
  );
}