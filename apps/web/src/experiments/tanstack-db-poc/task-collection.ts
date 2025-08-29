import { createDexieCollection } from './dexie-collection';
import { Task, TaskSchema, TaskStatus, createTask } from './task-schema';
import { uiLog } from '@/logger';
const log = uiLog('experiments/tanstack-db-poc/task-collection.ts');

// Create the task collection with Dexie persistence
export const taskCollection = createDexieCollection<Task>({
  dbName: 'tanstack-db-poc',
  tableName: 'tasks',
  schema: TaskSchema as any, // TODO: Proper schema conversion
  getKey: (task) => task.id,
});

// Start sync immediately if not already started
if (typeof taskCollection.startSyncImmediate === 'function') {
  log.info('Starting sync immediately for task collection');
  taskCollection.startSyncImmediate();
}

// Helper functions for easier usage
export const taskOperations = {
  // Create a single task
  async createTask(data: Partial<Task>): Promise<void> {
    const task = createTask(data);
    taskCollection.insert(task);
  },

  // Update a task
  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    taskCollection.update(id, (draft) => {
      Object.assign(draft, updates);
      draft.updatedAt = new Date().toISOString();
      
      // If status changes to completed, set completedAt
      if (updates.status === TaskStatus.COMPLETED && draft.status !== TaskStatus.COMPLETED) {
        draft.completedAt = new Date().toISOString();
      }
    });
  },

  // Delete a task
  async deleteTask(id: string): Promise<void> {
    taskCollection.delete(id);
  },

  // Bulk create tasks
  async bulkCreate(tasks: Partial<Task>[]): Promise<void> {
    const createdTasks = tasks.map(data => createTask(data));
    taskCollection.insert(createdTasks);
  },

  // Bulk update tasks - simplified since update doesn't support arrays directly
  async bulkUpdate(updates: Array<{ id: string; data: Partial<Task> }>): Promise<void> {
    for (const { id, data } of updates) {
      taskCollection.update(id, (draft) => {
        Object.assign(draft, data);
        draft.updatedAt = new Date().toISOString();
      });
    }
  },

  // Bulk delete tasks - simplified since delete doesn't support arrays directly
  async bulkDelete(ids: string[]): Promise<void> {
    for (const id of ids) {
      taskCollection.delete(id);
    }
  },
};