import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { useMemo } from 'react';

// Imports for 3-path architecture wrapper functions
import { 
  createTaskUI as generatedCreateTaskUI,
  updateTaskUI as generatedUpdateTaskUI,
  deleteTaskUI as generatedDeleteTaskUI,
  createTaskIncoming as generatedCreateTaskIncoming,
  updateTaskIncoming as generatedUpdateTaskIncoming,
  deleteTaskIncoming as generatedDeleteTaskIncoming,
  createTaskLiveChanges as generatedCreateTaskLiveChanges,
  updateTaskLiveChanges as generatedUpdateTaskLiveChanges,
  deleteTaskLiveChanges as generatedDeleteTaskLiveChanges,
  type CreateTaskInput,
  type UpdateTaskInput
} from '@repo/dataforge/task-operations';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Main tasks store - holds all tasks in normalized format
export const tasksAtom = createAtom<Record<string, Task>>({});

// ============================================================================
// React Hooks (Pure XState)
// ============================================================================

export const useTaskAtoms = {
  // All tasks as sorted array
  allTasks: () => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => {
        const tasks = Object.values(tasksRecord);
        return tasks.sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      },
      shallowEqual
    );
  },

  // Single task by ID
  taskById: (id: string) => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => tasksRecord[id] || null,
      shallowEqual
    );
  },

  // Tasks by project ID
  tasksByProject: (projectId: string) => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => {
        const tasks = Object.values(tasksRecord);
        return tasks
          .filter(task => task.projectId === projectId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      shallowEqual
    );
  },

  // Tasks by status
  tasksByStatus: (status: TaskStatus) => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => {
        const tasks = Object.values(tasksRecord);
        return tasks
          .filter(task => task.status === status)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      shallowEqual
    );
  },

  // Tasks by assignee
  tasksByAssignee: (assigneeId: string) => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => {
        const tasks = Object.values(tasksRecord);
        return tasks
          .filter(task => task.assigneeId === assigneeId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      shallowEqual
    );
  },

  // Task count
  taskCount: () => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => Object.keys(tasksRecord).length
    );
  },

  // Tasks by multiple filters
  filteredTasks: (filters: {
    projectId?: string;
    status?: TaskStatus;
    assigneeId?: string;
    priority?: TaskPriority;
  }) => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => {
        const tasks = Object.values(tasksRecord);
        return tasks
          .filter(task => {
            if (filters.projectId && task.projectId !== filters.projectId) return false;
            if (filters.status && task.status !== filters.status) return false;
            if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false;
            if (filters.priority && task.priority !== filters.priority) return false;
            return true;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      shallowEqual
    );
  }
};

// ============================================================================
// XState Atom Actions
// ============================================================================

export const taskActions = {
  // Create new task in atom
  createTask: (task: Task) => {
    const currentTasks = tasksAtom.get();
    tasksAtom.set({
      ...currentTasks,
      [task.id]: task
    });
  },

  // Update existing task in atom
  updateTaskAtomOnly: (id: string, updates: Partial<Task>) => {
    const currentTasks = tasksAtom.get();
    const existingTask = currentTasks[id];
    if (!existingTask) {
      console.warn(`[TaskActions] Task ${id} not found for update`);
      return;
    }
    
    tasksAtom.set({
      ...currentTasks,
      [id]: { ...existingTask, ...updates }
    });
  },

  // Delete task from atom
  deleteTaskAtomOnly: (id: string) => {
    const currentTasks = tasksAtom.get();
    const { [id]: deleted, ...remaining } = currentTasks;
    tasksAtom.set(remaining);
  },

  // Load multiple tasks (for initial load)
  loadTasks: (tasks: Task[]) => {
    const tasksRecord = tasks.reduce((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {} as Record<string, Task>);
    
    tasksAtom.set(tasksRecord);
  },

  // Clear all tasks
  clearTasks: () => {
    tasksAtom.set({});
  },

  // Ensure tasks are loaded (high-performance direct check)
  ensureLoaded: async () => {
    if (Object.keys(tasksAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const tasks = await dataSource.getRepository(Task).find({
        relations: ['project', 'assignee']
      });
      taskActions.loadTasks(tasks);
    }
  }
};

// ============================================================================
// 3-Path Architecture Wrapper Functions
// ============================================================================

/**
 * Create task from UI - thin wrapper around generated function
 */
export async function createTaskUI(taskData: CreateTaskInput): Promise<Task> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const { getGlobalServicesV3 } = await import('../state-machines/machines/sync-machine-v3');
  
  const dataSource = await getNewPGliteDataSource();
  const services = getGlobalServicesV3();
  
  return generatedCreateTaskUI(taskData, {
    dataSource,
    EntityClass: Task,
    atomActions: taskActions,
    outgoingChangeService: services?.outgoingChangeService || null
  });
}

/**
 * Update task from UI - thin wrapper around generated function
 */
export async function updateTaskUI(taskId: string, updates: UpdateTaskInput): Promise<Task> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const { getGlobalServicesV3 } = await import('../state-machines/machines/sync-machine-v3');
  
  const dataSource = await getNewPGliteDataSource();
  const services = getGlobalServicesV3();
  
  return generatedUpdateTaskUI(taskId, updates, {
    dataSource,
    EntityClass: Task,
    atomActions: taskActions,
    outgoingChangeService: services?.outgoingChangeService || null
  });
}

/**
 * Delete task from UI - thin wrapper around generated function
 */
export async function deleteTaskUI(taskId: string): Promise<boolean> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const { getGlobalServicesV3 } = await import('../state-machines/machines/sync-machine-v3');
  
  const dataSource = await getNewPGliteDataSource();
  const services = getGlobalServicesV3();
  
  return generatedDeleteTaskUI(taskId, {
    dataSource,
    EntityClass: Task,
    atomActions: taskActions,
    outgoingChangeService: services?.outgoingChangeService || null
  });
}

/**
 * Create task from incoming sync - thin wrapper around generated function
 */
export async function createTaskIncoming(taskData: Task): Promise<Task> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const dataSource = await getNewPGliteDataSource();
  
  return generatedCreateTaskIncoming(taskData, {
    dataSource,
    EntityClass: Task
  });
}

/**
 * Update task from incoming sync - thin wrapper around generated function
 */
export async function updateTaskIncoming(taskId: string, updates: Partial<Task>): Promise<Task> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const dataSource = await getNewPGliteDataSource();
  
  return generatedUpdateTaskIncoming(taskId, updates, {
    dataSource,
    EntityClass: Task
  });
}

/**
 * Delete task from incoming sync - thin wrapper around generated function
 */
export async function deleteTaskIncoming(taskId: string): Promise<void> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const dataSource = await getNewPGliteDataSource();
  
  return generatedDeleteTaskIncoming(taskId, {
    dataSource,
    EntityClass: Task
  });
}

/**
 * Create task from live changes - thin wrapper around generated function
 */
export function createTaskLiveChanges(taskData: Task): void {
  generatedCreateTaskLiveChanges(taskData, {
    atomActions: taskActions
  });
}

/**
 * Update task from live changes - thin wrapper around generated function
 */
export function updateTaskLiveChanges(taskId: string, updates: Partial<Task>): void {
  generatedUpdateTaskLiveChanges(taskId, updates, {
    atomActions: taskActions
  });
}

/**
 * Delete task from live changes - thin wrapper around generated function
 */
export function deleteTaskLiveChanges(taskId: string): void {
  generatedDeleteTaskLiveChanges(taskId, {
    atomActions: taskActions
  });
}

/**
 * Bulk create tasks from incoming sync - optimized for chunked data
 * Used by IncomingChangeService for performance when processing chunks
 */
export async function bulkCreateTasksIncoming(tasksData: Task[]): Promise<Task[]> {
  if (tasksData.length === 0) return [];
  
  console.log(`[TaskDomain] Bulk creating ${tasksData.length} tasks from incoming sync`);
  const startTime = Date.now();
  
  try {
    const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
    const dataSource = await getNewPGliteDataSource();
    
    // Apply to database
    const taskRepo = dataSource.getRepository(Task);
    const result = await taskRepo.insert(tasksData);
    
    // Get the inserted tasks
    const insertedTasks = tasksData;
    
    // Update atoms in batch
    const currentTasks = tasksAtom.get();
    const newTasksRecord = { ...currentTasks };
    
    insertedTasks.forEach(task => {
      newTasksRecord[task.id] = task;
    });
    
    tasksAtom.set(newTasksRecord);
    
    const processingTime = Date.now() - startTime;
    const throughput = (tasksData.length / processingTime) * 1000;
    console.log(`[TaskDomain] ✅ Bulk inserted ${tasksData.length} tasks in ${processingTime}ms (${throughput.toFixed(0)} tasks/sec)`);
    
    return insertedTasks;
    
  } catch (error) {
    console.error(`[TaskDomain] ❌ Bulk insert failed for ${tasksData.length} tasks:`, error);
    throw error;
  }
}

// Re-export types for convenience
export type { CreateTaskInput, UpdateTaskInput } from '@repo/dataforge/task-operations';