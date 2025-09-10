import { fromCallback } from 'xstate';
import type { GanttTask, TaskDependency } from '../types';
import { log } from '@/logger';
const fileLog = log('archive/deprecated-components/vibegantt/actors/gantt-domain-service-actor.ts');

/**
 * Domain Service Actor for Gantt Write Operations
 * 
 * This actor handles all write operations through the domain service pattern.
 * It delegates to the provided domain service methods, maintaining separation
 * of concerns and enabling sync tracking.
 */

interface DomainServiceInput {
  domainService: {
    updateTask: (taskId: string, updates: Partial<GanttTask>) => Promise<void>;
    createTask: (task: Partial<GanttTask>) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    createDependency: (dependency: Partial<TaskDependency>) => Promise<void>;
    deleteDependency: (dependencyId: string) => Promise<void>;
  };
}

export const ganttDomainServiceActor = fromCallback<any, DomainServiceInput>(({ 
  sendBack, 
  receive, 
  input,
  self
}) => {
  const { domainService } = input;
  
  // Handle incoming write operations
  receive(async (event) => {
    try {
      switch (event.type) {
        case 'UPDATE_TASK': {
          const { taskId, updates } = event;
          await domainService.updateTask(taskId, updates);
          sendBack({ type: 'TASK_UPDATE_SUCCESS', taskId });
          break;
        }
        
        case 'CREATE_TASK': {
          const { task } = event;
          await domainService.createTask(task);
          sendBack({ type: 'TASK_CREATE_SUCCESS' });
          break;
        }
        
        case 'DELETE_TASK': {
          const { taskId } = event;
          await domainService.deleteTask(taskId);
          sendBack({ type: 'TASK_DELETE_SUCCESS', taskId });
          break;
        }
        
        case 'CREATE_DEPENDENCY': {
          const { dependency } = event;
          await domainService.createDependency(dependency);
          sendBack({ type: 'DEPENDENCY_CREATE_SUCCESS' });
          break;
        }
        
        case 'DELETE_DEPENDENCY': {
          const { dependencyId } = event;
          await domainService.deleteDependency(dependencyId);
          sendBack({ type: 'DEPENDENCY_DELETE_SUCCESS', dependencyId });
          break;
        }
        
        case 'BATCH_UPDATE_TASKS': {
          const { updates } = event; // Array of { taskId, updates }
          
          // Process updates in parallel for performance
          await Promise.all(
            updates.map(({ taskId, updates }) => 
              domainService.updateTask(taskId, updates)
            )
          );
          
          sendBack({ type: 'BATCH_UPDATE_SUCCESS', count: updates.length });
          break;
        }
      }
    } catch (error) {
      fileLog.error('Domain service error:', error);
      sendBack({
        type: 'DOMAIN_SERVICE_ERROR',
        error: error.message,
        operation: event.type
      });
    }
  });
  
  // No cleanup needed for domain service
  return () => {};
});