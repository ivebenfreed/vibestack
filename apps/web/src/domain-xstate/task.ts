import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// TODO: REFACTOR - Remove these DataForge operation wrappers
// These are being replaced by domain-dexie services (domainServices.task)
// Components should use domainServices.task.createUI/updateUI/deleteUI directly

// Export types for backward compatibility during refactoring
export type { CreateTaskInput, UpdateTaskInput } from '@repo/dataforge/task-operations';

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

// TODO: REFACTOR - Remove these atom manipulation utilities
// These are legacy utilities that were used by DataForge operations
// Components should update atoms directly or use domain-dexie services

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
  
  // TODO: REFACTOR - This ensureLoaded pattern needs to be replaced
  // with view-based data loading like VibeGridDex
  ensureLoaded: async () => {
    console.log('[TaskUtils] ensureLoaded called - needs refactoring to view-based loading');
  }
};