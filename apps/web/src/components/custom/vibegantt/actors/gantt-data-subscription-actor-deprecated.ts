// DEPRECATED - This actor is no longer needed with the store architecture
// The gantt-data-store.ts handles all Dexie subscriptions directly
// Keeping this file for reference during migration

import { fromCallback } from 'xstate';
import { db } from '@repo/dataforge/dexie-schema';
import type { GanttTask, TaskDependency } from '../types';
import { liveQuery } from 'dexie';

interface DataSubscriptionInput {
  projectId?: string;
  filters?: {
    startDate?: Date;
    endDate?: Date;
    assigneeIds?: string[];
    status?: string[];
  };
}

export const dataSubscriptionActor = fromCallback<any, DataSubscriptionInput>(({ 
  sendBack, 
  receive, 
  input,
  self
}) => {
  const subscriptions: Array<{ unsubscribe: () => void }> = [];
  
  // Subscribe to tasks
  const subscribeToTasks = () => {
    const observable = liveQuery(async () => {
      let query = db.tasks.toCollection();
      
      // Apply project filter if provided
      if (input?.projectId) {
        query = db.tasks.where('projectId').equals(input.projectId);
      }
      
      const tasks = await query.toArray();
      
      // Transform to GanttTask format
      return tasks.map(task => ({
        id: task.id,
        name: task.title || 'Untitled Task',
        plannedStartDate: task.plannedStartDate || task.createdAt,
        plannedEndDate: task.plannedEndDate || task.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        actualStartDate: task.actualStartDate,
        actualEndDate: task.actualEndDate,
        progress: task.progress || 0,
        assigneeId: task.assigneeId,
        parentId: task.parentId,
        color: task.color,
        priority: task.priority || 'medium',
        constraints: task.constraints,
        customFields: task.customFields,
      } as GanttTask));
    });
    
    const subscription = observable.subscribe({
      next: (tasks) => {
        sendBack({
          type: 'TASKS_UPDATED',
          tasks,
        });
      },
      error: (error) => {
        console.error('Error in task subscription:', error);
        sendBack({
          type: 'SUBSCRIPTION_ERROR',
          error,
        });
      },
    });
    
    subscriptions.push(subscription);
  };
  
  // Subscribe to task dependencies
  const subscribeToDependencies = () => {
    const observable = liveQuery(async () => {
      let dependencies = await db.task_dependencies.toArray();
      
      // Filter by project if provided (need to join with tasks)
      if (input?.projectId) {
        const projectTasks = await db.tasks.where('projectId').equals(input.projectId).toArray();
        const projectTaskIds = new Set(projectTasks.map(t => t.id));
        
        dependencies = dependencies.filter(dep => 
          projectTaskIds.has(dep.dependentTaskId) || projectTaskIds.has(dep.dependencyTaskId)
        );
      }
      
      // Transform to TaskDependency format
      return dependencies.map(dep => ({
        id: `${dep.dependentTaskId}-${dep.dependencyTaskId}`, // Generate ID from relationship
        sourceTaskId: dep.dependencyTaskId, // The task being depended on
        targetTaskId: dep.dependentTaskId, // The task that depends
        type: 'finish-to-start' as const, // Default type
        lag: 0, // Default lag
      } as TaskDependency));
    });
    
    const subscription = observable.subscribe({
      next: (dependencies) => {
        sendBack({
          type: 'DEPENDENCIES_UPDATED',
          dependencies,
        });
      },
      error: (error) => {
        console.error('Error in dependency subscription:', error);
        sendBack({
          type: 'SUBSCRIPTION_ERROR',
          error,
        });
      },
    });
    
    subscriptions.push(subscription);
  };
  
  // Subscribe to resources (users)
  const subscribeToResources = () => {
    const observable = liveQuery(async () => {
      const users = await db.users.toArray();
      
      // Transform to Resource format
      return users.map(user => ({
        id: user.id,
        name: user.name || user.email,
        type: 'person' as const,
        availability: 8, // Default 8 hours per day
        cost: user.hourlyRate,
      }));
    });
    
    const subscription = observable.subscribe({
      next: (resources) => {
        sendBack({
          type: 'RESOURCES_UPDATED',
          resources,
        });
      },
      error: (error) => {
        console.error('Error in resource subscription:', error);
        sendBack({
          type: 'SUBSCRIPTION_ERROR',
          error,
        });
      },
    });
    
    subscriptions.push(subscription);
  };
  
  // Handle incoming events
  receive((event) => {
    switch (event.type) {
      case 'UPDATE_FILTERS':
        // Re-subscribe with new filters
        subscriptions.forEach(sub => sub.unsubscribe());
        subscriptions.length = 0;
        subscribeToTasks();
        subscribeToDependencies();
        subscribeToResources();
        break;
        
      case 'CREATE_TASK':
        db.tasks.add(event.task);
        break;
        
      case 'UPDATE_TASK':
        db.tasks.update(event.taskId, event.updates);
        break;
        
      case 'DELETE_TASK':
        db.tasks.delete(event.taskId);
        break;
        
      case 'CREATE_DEPENDENCY':
        db.task_dependencies.add({
          dependentTaskId: event.dependency.targetTaskId,
          dependencyTaskId: event.dependency.sourceTaskId,
        });
        break;
        
      case 'DELETE_DEPENDENCY':
        // Parse the generated ID back to component parts
        const [dependentId, dependencyId] = event.dependencyId.split('-');
        db.task_dependencies
          .where('[dependentTaskId+dependencyTaskId]')
          .equals([dependentId, dependencyId])
          .delete();
        break;
    }
  });
  
  // Initialize subscriptions
  subscribeToTasks();
  subscribeToDependencies();
  subscribeToResources();
  
  // Cleanup function
  return () => {
    subscriptions.forEach(sub => sub.unsubscribe());
  };
});