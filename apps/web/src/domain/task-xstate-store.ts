import { v4 as uuidv4 } from 'uuid';
import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
import { BaseRepository, BaseService, DatabaseServiceError, EventDispatcher } from './base';
import { OutgoingChangeProcessor } from '../sync/OutgoingChangeProcessor';
import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';

// ============================================================================
// 🎯 XSTATE STORE VERSION - Event-Driven Task Management
// ============================================================================

// Types for live changes
export type ChangeOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface TaskChange {
  __op__: ChangeOperation;
  __changed_columns__: string[];
  __after__: number | undefined;
  [key: string]: any; // The actual task data
}

// Task Store Context Type
interface TaskStoreContext {
  // Entity storage - normalized by ID for efficient lookups
  tasksById: Record<string, Task>;
  taskIds: string[];
  
  // Live changes state
  liveChangesLoading: boolean;
  liveChangesError: string | null;
  
  // Loading states for different operations
  loadingStates: {
    bulkLoad: boolean;
    create: boolean;
    update: Record<string, boolean>; // Per-task update loading
    delete: Record<string, boolean>; // Per-task delete loading
  };
  
  // Error states
  errors: {
    general: string | null;
    create: string | null;
    update: Record<string, string | undefined>; // Per-task update errors
    delete: Record<string, string | undefined>; // Per-task delete errors
  };
}

// Initial state
const initialContext: TaskStoreContext = {
  tasksById: {},
  taskIds: [],
  liveChangesLoading: false,
  liveChangesError: null,
  loadingStates: {
    bulkLoad: false,
    create: false,
    update: {},
    delete: {},
  },
  errors: {
    general: null,
    create: null,
    update: {},
    delete: {},
  },
};

// Create the XState Store
export const taskStore = createStore({
  context: initialContext,
  on: {
    // ============================================================================
    // Bulk Operations (Route Loaders)
    // ============================================================================
    
    BULK_LOAD_START: (context: TaskStoreContext) => ({
      ...context,
      loadingStates: {
        ...context.loadingStates,
        bulkLoad: true,
      },
      errors: {
        ...context.errors,
        general: null,
      },
    }),
    
    BULK_LOAD_SUCCESS: (context: TaskStoreContext, event: { tasks: Task[] }) => {
      const tasksById: Record<string, Task> = {};
      const taskIds: string[] = [];
      
      event.tasks.forEach(task => {
        tasksById[task.id] = task;
        taskIds.push(task.id);
      });
      
      return {
        ...context,
        tasksById,
        taskIds,
        loadingStates: {
          ...context.loadingStates,
          bulkLoad: false,
        },
        errors: {
          ...context.errors,
          general: null,
        },
      };
    },
    
    BULK_LOAD_FAILURE: (context: TaskStoreContext, event: { error: string }) => ({
      ...context,
      loadingStates: {
        ...context.loadingStates,
        bulkLoad: false,
      },
      errors: {
        ...context.errors,
        general: event.error,
      },
    }),
    
    // ============================================================================
    // Individual Task Operations (CRUD)
    // ============================================================================
    
    CREATE_TASK_START: (context: TaskStoreContext) => ({
      ...context,
      loadingStates: {
        ...context.loadingStates,
        create: true,
      },
      errors: {
        ...context.errors,
        create: null,
      },
    }),
    
    CREATE_TASK_SUCCESS: (context: TaskStoreContext, event: { task: Task }) => {
      const { task } = event;
      const newTasksById = { ...context.tasksById, [task.id]: task };
      const newTaskIds = context.taskIds.includes(task.id) 
        ? context.taskIds 
        : [...context.taskIds, task.id];
      
      return {
        ...context,
        tasksById: newTasksById,
        taskIds: newTaskIds,
        loadingStates: {
          ...context.loadingStates,
          create: false,
        },
        errors: {
          ...context.errors,
          create: null,
        },
      };
    },
    
    CREATE_TASK_FAILURE: (context: TaskStoreContext, event: { error: string }) => ({
      ...context,
      loadingStates: {
        ...context.loadingStates,
        create: false,
      },
      errors: {
        ...context.errors,
        create: event.error,
      },
    }),
    
    UPDATE_TASK_START: (context: TaskStoreContext, event: { taskId: string }) => ({
      ...context,
      loadingStates: {
        ...context.loadingStates,
        update: {
          ...context.loadingStates.update,
          [event.taskId]: true,
        },
      },
      errors: {
        ...context.errors,
        update: {
          ...context.errors.update,
          [event.taskId]: undefined,
        },
      },
    }),
    
    UPDATE_TASK_SUCCESS: (context: TaskStoreContext, event: { task: Task }) => {
      const { task } = event;
      const newLoadingUpdate = { ...context.loadingStates.update };
      delete newLoadingUpdate[task.id];
      
      const newErrorsUpdate = { ...context.errors.update };
      delete newErrorsUpdate[task.id];
      
      return {
        ...context,
        tasksById: {
          ...context.tasksById,
          [task.id]: task,
        },
        loadingStates: {
          ...context.loadingStates,
          update: newLoadingUpdate,
        },
        errors: {
          ...context.errors,
          update: newErrorsUpdate,
        },
      };
    },
    
    UPDATE_TASK_FAILURE: (context: TaskStoreContext, event: { taskId: string; error: string }) => {
      const newLoadingUpdate = { ...context.loadingStates.update };
      delete newLoadingUpdate[event.taskId];
      
      return {
        ...context,
        loadingStates: {
          ...context.loadingStates,
          update: newLoadingUpdate,
        },
        errors: {
          ...context.errors,
          update: {
            ...context.errors.update,
            [event.taskId]: event.error,
          },
        },
      };
    },
    
    DELETE_TASK_START: (context: TaskStoreContext, event: { taskId: string }) => ({
      ...context,
      loadingStates: {
        ...context.loadingStates,
        delete: {
          ...context.loadingStates.delete,
          [event.taskId]: true,
        },
      },
      errors: {
        ...context.errors,
        delete: {
          ...context.errors.delete,
          [event.taskId]: undefined,
        },
      },
    }),
    
    DELETE_TASK_SUCCESS: (context: TaskStoreContext, event: { taskId: string }) => {
      const newTasksById = { ...context.tasksById };
      delete newTasksById[event.taskId];
      
      const newTaskIds = context.taskIds.filter(id => id !== event.taskId);
      
      const newLoadingDelete = { ...context.loadingStates.delete };
      delete newLoadingDelete[event.taskId];
      
      const newErrorsDelete = { ...context.errors.delete };
      delete newErrorsDelete[event.taskId];
      
      return {
        ...context,
        tasksById: newTasksById,
        taskIds: newTaskIds,
        loadingStates: {
          ...context.loadingStates,
          delete: newLoadingDelete,
        },
        errors: {
          ...context.errors,
          delete: newErrorsDelete,
        },
      };
    },
    
    DELETE_TASK_FAILURE: (context: TaskStoreContext, event: { taskId: string; error: string }) => {
      const newLoadingDelete = { ...context.loadingStates.delete };
      delete newLoadingDelete[event.taskId];
      
      return {
        ...context,
        loadingStates: {
          ...context.loadingStates,
          delete: newLoadingDelete,
        },
        errors: {
          ...context.errors,
          delete: {
            ...context.errors.delete,
            [event.taskId]: event.error,
          },
        },
      };
    },
    
    // ============================================================================
    // Live Changes Events
    // ============================================================================
    
    LIVE_CHANGES_START: (context: TaskStoreContext) => ({
      ...context,
      liveChangesLoading: true,
      liveChangesError: null,
    }),
    
    LIVE_CHANGES_SUCCESS: (context: TaskStoreContext) => ({
      ...context,
      liveChangesLoading: false,
      liveChangesError: null,
    }),
    
    LIVE_CHANGES_FAILURE: (context: TaskStoreContext, event: { error: string }) => ({
      ...context,
      liveChangesLoading: false,
      liveChangesError: event.error,
    }),
    
    LIVE_CHANGE_RECEIVED: (context: TaskStoreContext, event: { changes: TaskChange[] }) => {
      let newTasksById = { ...context.tasksById };
      let newTaskIds = [...context.taskIds];
      
      event.changes.forEach(change => {
        const { __op__, __changed_columns__, __after__, ...taskData } = change;
        const task = transformDatabaseResult(taskData);
        const taskId = task.id;
        
        switch (change.__op__) {
          case 'INSERT':
            console.log(`[TaskXStateStore] INSERT: ${taskId}`);
            newTasksById[taskId] = task;
            if (!newTaskIds.includes(taskId)) {
              newTaskIds.push(taskId);
            }
            break;
            
          case 'UPDATE':
            console.log(`[TaskXStateStore] UPDATE: ${taskId}, changed: ${__changed_columns__?.join(', ')}`);
            if (newTasksById[taskId]) {
              newTasksById[taskId] = task;
            }
            break;
            
          case 'DELETE':
            console.log(`[TaskXStateStore] DELETE: ${taskId}`);
            delete newTasksById[taskId];
            newTaskIds = newTaskIds.filter(id => id !== taskId);
            break;
        }
      });
      
      return {
        ...context,
        tasksById: newTasksById,
        taskIds: newTaskIds,
      };
    },
    
    // ============================================================================
    // Optimistic Updates (for instant UI feedback)
    // ============================================================================
    
    OPTIMISTIC_UPDATE: (context: TaskStoreContext, event: { taskId: string; changes: Partial<Task> }) => {
      const existingTask = context.tasksById[event.taskId];
      if (!existingTask) return context;
      
      return {
        ...context,
        tasksById: {
          ...context.tasksById,
          [event.taskId]: {
            ...existingTask,
            ...event.changes,
          },
        },
      };
    },
    
    CLEAR_ERRORS: (context: TaskStoreContext) => ({
      ...context,
      errors: {
        general: null,
        create: null,
        update: {},
        delete: {},
      },
    }),
  },
});

// ============================================================================
// Selectors (Derived State)
// ============================================================================

export const taskStoreSelectors = {
  // All tasks as array (equivalent to allTasksAtom)
  allTasks: (state: ReturnType<typeof taskStore.getSnapshot>) => 
    state.context.taskIds.map(id => state.context.tasksById[id]).filter(Boolean),
  
  // Get specific task by ID (equivalent to getTaskAtom)
  taskById: (taskId: string) => (state: ReturnType<typeof taskStore.getSnapshot>) =>
    state.context.tasksById[taskId] || null,
  
  // Tasks by project
  tasksByProject: (projectId: string) => (state: ReturnType<typeof taskStore.getSnapshot>) =>
    state.context.taskIds
      .map(id => state.context.tasksById[id])
      .filter(task => task && task.projectId === projectId),
  
  // Tasks by status
  tasksByStatus: (status: TaskStatus) => (state: ReturnType<typeof taskStore.getSnapshot>) =>
    state.context.taskIds
      .map(id => state.context.tasksById[id])
      .filter(task => task && task.status === status),
  
  // Loading states
  isLoading: (state: ReturnType<typeof taskStore.getSnapshot>) =>
    state.context.loadingStates.bulkLoad || state.context.loadingStates.create,
  
  isTaskLoading: (taskId: string) => (state: ReturnType<typeof taskStore.getSnapshot>) =>
    state.context.loadingStates.update[taskId] || state.context.loadingStates.delete[taskId] || false,
  
  // Error states
  hasErrors: (state: ReturnType<typeof taskStore.getSnapshot>) =>
    !!(state.context.errors.general || state.context.errors.create || 
       Object.keys(state.context.errors.update).length > 0 || 
       Object.keys(state.context.errors.delete).length > 0),
  
  // Stats (equivalent to existing derived atoms)
  taskStats: (state: ReturnType<typeof taskStore.getSnapshot>) => {
    const tasks = state.context.taskIds.map(id => state.context.tasksById[id]).filter(Boolean);
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      pending: tasks.filter(t => t.status === TaskStatus.OPEN).length,
    };
  },
};

// ============================================================================
// React Hooks (equivalent to your current useAtomValue patterns)
// ============================================================================

export const useTaskStore = {
  // All tasks
  allTasks: () => useSelector(taskStore, taskStoreSelectors.allTasks),
  
  // Specific task
  task: (taskId: string) => useSelector(taskStore, taskStoreSelectors.taskById(taskId)),
  
  // Filtered tasks
  tasksByProject: (projectId: string) => useSelector(taskStore, taskStoreSelectors.tasksByProject(projectId)),
  tasksByStatus: (status: TaskStatus) => useSelector(taskStore, taskStoreSelectors.tasksByStatus(status)),
  
  // Loading states
  isLoading: () => useSelector(taskStore, taskStoreSelectors.isLoading),
  isTaskLoading: (taskId: string) => useSelector(taskStore, taskStoreSelectors.isTaskLoading(taskId)),
  
  // Error states
  hasErrors: () => useSelector(taskStore, taskStoreSelectors.hasErrors),
  
  // Stats
  taskStats: () => useSelector(taskStore, taskStoreSelectors.taskStats),
  
  // Live changes state
  liveChangesState: () => useSelector(taskStore, (state) => ({
    loading: state.context.liveChangesLoading,
    error: state.context.liveChangesError,
  })),
};

// ============================================================================
// Actions (Event Dispatchers)
// ============================================================================

export const taskStoreActions = {
  // Bulk operations (compatible with route loader pattern)
  loadTasks: async (tasks: Task[]) => {
    taskStore.send({ type: 'BULK_LOAD_START' });
    try {
      taskStore.send({ type: 'BULK_LOAD_SUCCESS', tasks });
      console.log(`[TaskXStateStore] Bulk loaded ${tasks.length} tasks from route loader`);
    } catch (error) {
      console.error('[TaskXStateStore] Bulk load failed:', error);
      taskStore.send({ type: 'BULK_LOAD_FAILURE', error: (error as Error).message });
    }
  },

  // Compatibility interface that matches Jotai's syncBulkLoad
  syncBulkLoad: {
    set: (tasks: Task[]) => taskStoreActions.loadTasks(tasks)
  },
  
  // Individual operations with optimistic updates
  updateTask: async (taskId: string, changes: Partial<Task>) => {
    // Optimistic update for instant UI feedback
    taskStore.send({ type: 'OPTIMISTIC_UPDATE', taskId, changes });
    taskStore.send({ type: 'UPDATE_TASK_START', taskId });
    
    try {
      // This would integrate with your actual service
      // For now, we'll simulate the API call
      const updatedTask = { ...taskStore.getSnapshot().context.tasksById[taskId], ...changes };
      taskStore.send({ type: 'UPDATE_TASK_SUCCESS', task: updatedTask as Task });
      return updatedTask as Task;
    } catch (error) {
      // Revert optimistic update
      taskStore.send({ type: 'UPDATE_TASK_FAILURE', taskId, error: (error as Error).message });
      throw error;
    }
  },
  
  // Live changes
  startLiveChanges: async () => {
    taskStore.send({ type: 'LIVE_CHANGES_START' });
    try {
      // await startLiveChangesIntegration();
      taskStore.send({ type: 'LIVE_CHANGES_SUCCESS' });
    } catch (error) {
      taskStore.send({ type: 'LIVE_CHANGES_FAILURE', error: (error as Error).message });
    }
  },
  
  // Utility actions
  clearErrors: () => taskStore.send({ type: 'CLEAR_ERRORS' }),
};

// ============================================================================
// Utility Functions
// ============================================================================

function transformDatabaseResult(row: Record<string, any>): Task {
  const task: any = {};
  
  // Transform all columns from snake_case to camelCase
  Object.keys(row).forEach(key => {
    // Remove task_ prefix and convert to camelCase
    const cleanKey = key.replace(/^task_/, '');
    const camelKey = toCamelCase(cleanKey);
    
    if (camelKey === 'tags' && typeof row[key] === 'string') {
      // Parse JSON string for tags
      try {
        task[camelKey] = JSON.parse(row[key]);
      } catch {
        task[camelKey] = [];
      }
    } else {
      task[camelKey] = row[key];
    }
  });
  
  return task as Task;
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// ============================================================================
// Export for Testing/Comparison
// ============================================================================

export { taskStore as TaskXStateStore };

// Compatibility layer - maintain the same interface as the existing TaskService for easy comparison
export class TaskServiceXState {
  static store = taskStore;
  static actions = taskStoreActions;
  static selectors = taskStoreSelectors;
  static hooks = useTaskStore;
} 