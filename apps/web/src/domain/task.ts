import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// Re-export DataForge operations and types directly
export { 
  createTaskUI,
  updateTaskUI,
  deleteTaskUI,
  createTaskIncoming,
  updateTaskIncoming,
  deleteTaskIncoming,
  createTaskLiveChanges,
  updateTaskLiveChanges,
  deleteTaskLiveChanges,
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
// Atom Utilities for DataForge Operations
// ============================================================================

// Simple atom manipulation functions that DataForge operations can use
export const atomActions = {
  createTaskAtomOnly: (task: Task) => {
    const currentTasks = tasksAtom.get();
    tasksAtom.set({ ...currentTasks, [task.id]: task });
  },
  
  updateTaskAtomOnly: (id: string, updates: Partial<Task>) => {
    const currentTasks = tasksAtom.get();
    const existingTask = currentTasks[id];
    if (existingTask) {
      tasksAtom.set({ ...currentTasks, [id]: { ...existingTask, ...updates } });
    }
  },
  
  deleteTaskAtomOnly: (id: string) => {
    const currentTasks = tasksAtom.get();
    const { [id]: deleted, ...remaining } = currentTasks;
    tasksAtom.set(remaining);
  },
  
  // Expose atom for DataForge operations  
  tasksAtom: tasksAtom
};

// Utility functions for loading data
export const taskUtils = {
  loadTasks: (tasks: Task[]) => {
    const tasksRecord = tasks.reduce((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {} as Record<string, Task>);
    tasksAtom.set(tasksRecord);
  },
  
  clearTasks: () => tasksAtom.set({}),
  
  ensureLoaded: async () => {
    if (Object.keys(tasksAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const tasks = await dataSource.getRepository(Task).find({
        relations: ['project', 'assignee']
      });
      taskUtils.loadTasks(tasks);
    }
  }
};

// ============================================================================
// DataForge Operation Dependencies
// ============================================================================

// Helper to get dependencies for DataForge operations
export async function getTaskDependencies() {
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return {
    dataSource,
    EntityClass: Task,
    atomActions,
    outgoingChangeService: services?.outgoingChangeService || null
  };
}

// Bulk operations (kept for IncomingChangeService)
export async function bulkCreateTasksIncoming(tasksData: Task[]): Promise<Task[]> {
  if (tasksData.length === 0) return [];
  
  console.log(`[TaskDomain] Bulk creating ${tasksData.length} tasks from incoming sync`);
  const startTime = Date.now();
  
  try {
    const { getGlobalDataSource } = await import('@/db/global-datasource');
    const dataSource = await getGlobalDataSource();
    
    // Apply to database
    const taskRepo = dataSource.getRepository(Task);
    const result = await taskRepo.insert(tasksData);
    
    // Update atoms in batch
    const currentTasks = tasksAtom.get();
    const newTasksRecord = { ...currentTasks };
    
    tasksData.forEach(task => {
      newTasksRecord[task.id] = task;
    });
    
    tasksAtom.set(newTasksRecord);
    
    const processingTime = Date.now() - startTime;
    const throughput = (tasksData.length / processingTime) * 1000;
    console.log(`[TaskDomain] ✅ Bulk inserted ${tasksData.length} tasks in ${processingTime}ms (${throughput.toFixed(0)} tasks/sec)`);
    
    return tasksData;
    
  } catch (error) {
    console.error(`[TaskDomain] ❌ Bulk insert failed for ${tasksData.length} tasks:`, error);
    throw error;
  }
}