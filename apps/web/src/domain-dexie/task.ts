/**
 * Task Domain - Re-export from new domain service architecture
 * 
 * This file now re-exports from the new formalized domain services.
 * The old implementation has been moved to task-service.ts
 */

import { domainServices } from './index';
import type { Task } from '@repo/dataforge/client-entities';
import type { CreateTaskInput, UpdateTaskInput } from './task-service';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';

// Re-export types
export type { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
export type { CreateTaskInput, UpdateTaskInput } from './task-service';

// ============================================================================
// Function Exports (for backward compatibility)
// ============================================================================

export const createTaskUI = (input: CreateTaskInput): Promise<Task> => domainServices.task.createUI(input);
export const updateTaskUI = (id: string, updates: UpdateTaskInput): Promise<Task> => domainServices.task.updateUI(id, updates);
export const deleteTaskUI = (id: string): Promise<boolean> => domainServices.task.deleteUI(id);
export const createTaskIncoming = (task: Task): Promise<Task> => domainServices.task.createIncoming(task);
export const updateTaskIncoming = (id: string, updates: Partial<Task>): Promise<Task> => domainServices.task.updateIncoming(id, updates);
export const deleteTaskIncoming = (id: string): Promise<boolean> => domainServices.task.deleteIncoming(id);

// Bulk operations
export async function bulkCreateTasksUI(tasksData: CreateTaskInput[]): Promise<Task[]> {
  const tasks: Task[] = [];
  for (const taskData of tasksData) {
    const task = await createTaskUI(taskData);
    tasks.push(task);
  }
  return tasks;
}

export async function bulkCreateTasksIncoming(tasksData: Task[]): Promise<Task[]> {
  return domainServices.task.bulkCreateIncoming(tasksData);
}

// ============================================================================
// Live Query Hooks (kept for backward compatibility)
// ============================================================================

export const useTaskQueries = {
  /**
   * Get all tasks (reactive)
   */
  allTasks: () => {
    return useLiveQuery(() => db.tasks.toArray()) || [];
  },

  /**
   * Get tasks by project (reactive)
   */
  byProject: (projectId: string) => {
    return useLiveQuery(
      () => projectId ? db.tasks.where('projectId').equals(projectId).toArray() : [],
      [projectId]
    ) || [];
  },

  /**
   * Get tasks by assignee (reactive)
   */
  byAssignee: (userId: string) => {
    return useLiveQuery(
      () => userId ? db.tasks.where('assigneeId').equals(userId).toArray() : [],
      [userId]
    ) || [];
  },

  /**
   * Get tasks by status (reactive)
   */
  byStatus: (status: string) => {
    return useLiveQuery(
      () => status ? db.tasks.where('status').equals(status).toArray() : [],
      [status]
    ) || [];
  },

  /**
   * Get task by ID (reactive)
   */
  byId: (taskId: string) => {
    return useLiveQuery(
      () => taskId ? db.tasks.get(taskId) : undefined,
      [taskId]
    );
  },

  /**
   * Get task count (reactive)
   */
  count: () => {
    return useLiveQuery(() => db.tasks.count()) || 0;
  },

  /**
   * Get task count by project (reactive)
   */
  countByProject: (projectId: string) => {
    return useLiveQuery(
      () => projectId ? db.tasks.where('projectId').equals(projectId).count() : 0,
      [projectId]
    ) || 0;
  },

  /**
   * Get overdue tasks (reactive)
   */
  overdue: () => {
    return useLiveQuery(() => {
      const now = new Date().toISOString();
      return db.tasks
        .where('dueDate')
        .below(now)
        .and(task => task.status !== 'completed')
        .toArray();
    }) || [];
  },
};