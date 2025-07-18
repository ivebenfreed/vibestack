/**
 * Dexie-based Task Domain
 * 
 * This is a parallel implementation that uses Dexie live queries instead of atomic stores.
 * It provides the same interface as the atomic store version but uses Dexie for data persistence and reactivity.
 */

import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';
import { nanoid } from 'nanoid';

// ============================================================================
// Types
// ============================================================================

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assigneeId?: string;
  dueDate?: string;
  estimatedDuration?: number;
  order?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assigneeId?: string;
  dueDate?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  completedAt?: string;
  order?: number;
  blockedReason?: string;
}

// ============================================================================
// Service Layer (CRUD Operations)
// ============================================================================

export const taskService = {
  /**
   * Create a new task
   */
  async create(taskData: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: nanoid(),
      title: taskData.title,
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      projectId: taskData.projectId,
      assigneeId: taskData.assigneeId,
      dueDate: taskData.dueDate,
      estimatedDuration: taskData.estimatedDuration,
      actualDuration: undefined,
      order: taskData.order || 0,
      blockedReason: undefined,
      completedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clientId: 'dexie-client', // TODO: Get from sync context
      userId: 'current-user', // TODO: Get from auth context
      // Legacy fields for compatibility
      legacyStatus: taskData.status || 'todo',
      statusId: undefined, // TODO: Map from status to statusId
      startDate: undefined,
    };

    await db.tasks.add(task);
    return task;
  },

  /**
   * Update a task
   */
  async update(taskId: string, updates: UpdateTaskInput): Promise<Task | null> {
    const existingTask = await db.tasks.get(taskId);
    if (!existingTask) {
      return null;
    }

    const updatedTask: Task = {
      ...existingTask,
      ...updates,
      updatedAt: new Date().toISOString(),
      // Handle status updates
      legacyStatus: updates.status || existingTask.legacyStatus,
      // Handle completion
      completedAt: updates.status === 'completed' ? new Date().toISOString() : existingTask.completedAt,
    };

    await db.tasks.put(updatedTask);
    return updatedTask;
  },

  /**
   * Delete a task
   */
  async delete(taskId: string): Promise<boolean> {
    try {
      await db.transaction('rw', db.tasks, db.task_tags, db.task_dependencies, async () => {
        // Delete the task
        await db.tasks.delete(taskId);
        
        // Clean up relationships
        await db.task_tags.where('taskId').equals(taskId).delete();
        await db.task_dependencies.where('dependentTaskId').equals(taskId).delete();
        await db.task_dependencies.where('dependencyTaskId').equals(taskId).delete();
      });
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  },

  /**
   * Get a single task by ID
   */
  async get(taskId: string): Promise<Task | null> {
    const task = await db.tasks.get(taskId);
    return task || null;
  },

  /**
   * Get all tasks
   */
  async getAll(): Promise<Task[]> {
    return await db.tasks.toArray();
  },

  /**
   * Get tasks by project
   */
  async getByProject(projectId: string): Promise<Task[]> {
    return await db.tasks.where('projectId').equals(projectId).toArray();
  },

  /**
   * Get tasks by assignee
   */
  async getByAssignee(assigneeId: string): Promise<Task[]> {
    return await db.tasks.where('assigneeId').equals(assigneeId).toArray();
  },

  /**
   * Get tasks by status
   */
  async getByStatus(status: TaskStatus): Promise<Task[]> {
    return await db.tasks.where('status').equals(status).toArray();
  },

  /**
   * Bulk create tasks
   */
  async bulkCreate(tasks: CreateTaskInput[]): Promise<Task[]> {
    const taskEntities: Task[] = tasks.map(taskData => ({
      id: nanoid(),
      title: taskData.title,
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      projectId: taskData.projectId,
      assigneeId: taskData.assigneeId,
      dueDate: taskData.dueDate,
      estimatedDuration: taskData.estimatedDuration,
      actualDuration: undefined,
      order: taskData.order || 0,
      blockedReason: undefined,
      completedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clientId: 'dexie-client',
      userId: 'current-user',
      legacyStatus: taskData.status || 'todo',
      statusId: undefined,
      startDate: undefined,
    }));

    await db.tasks.bulkAdd(taskEntities);
    return taskEntities;
  },
};

// ============================================================================
// Live Query Hooks (Replace Atomic Store Hooks)
// ============================================================================

export const useTaskQueries = {
  /**
   * Get all tasks (sorted by creation date)
   */
  allTasks: () => {
    return useLiveQuery(async () => {
      const tasks = await db.tasks.toArray();
      return tasks.sort((a, b) => {
        // Add defensive checks for createdAt
        const aCreatedAt = a?.createdAt || new Date().toISOString();
        const bCreatedAt = b?.createdAt || new Date().toISOString();
        return new Date(bCreatedAt).getTime() - new Date(aCreatedAt).getTime();
      });
    });
  },

  /**
   * Get a single task by ID
   */
  taskById: (id: string) => {
    return useLiveQuery(async () => {
      return await db.tasks.get(id);
    }, [id]);
  },

  /**
   * Get tasks by project ID
   */
  tasksByProject: (projectId: string) => {
    return useLiveQuery(async () => {
      if (!projectId) return [];
      const tasks = await db.tasks.where('projectId').equals(projectId).toArray();
      return tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [projectId]);
  },

  /**
   * Get tasks by assignee ID
   */
  tasksByAssignee: (assigneeId: string) => {
    return useLiveQuery(async () => {
      if (!assigneeId) return [];
      return await db.tasks.where('assigneeId').equals(assigneeId).toArray();
    }, [assigneeId]);
  },

  /**
   * Get tasks by status
   */
  tasksByStatus: (status: TaskStatus) => {
    return useLiveQuery(async () => {
      return await db.tasks.where('status').equals(status).toArray();
    }, [status]);
  },

  /**
   * Get task count
   */
  taskCount: () => {
    return useLiveQuery(async () => {
      return await db.tasks.count();
    });
  },

  /**
   * Get task statistics
   */
  taskStats: () => {
    return useLiveQuery(async () => {
      const tasks = await db.tasks.toArray();
      
      const stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        todo: tasks.filter(t => t.status === 'todo').length,
        overdue: tasks.filter(t => {
          if (!t.dueDate) return false;
          return new Date(t.dueDate) < new Date() && t.status !== 'completed';
        }).length,
        byStatus: new Map<TaskStatus, number>(),
        byPriority: new Map<TaskPriority, number>(),
      };

      // Group by status
      tasks.forEach(task => {
        const statusCount = stats.byStatus.get(task.status) || 0;
        stats.byStatus.set(task.status, statusCount + 1);
        
        const priorityCount = stats.byPriority.get(task.priority) || 0;
        stats.byPriority.set(task.priority, priorityCount + 1);
      });

      return stats;
    });
  },

  /**
   * Get recent tasks (last 10)
   */
  recentTasks: () => {
    return useLiveQuery(async () => {
      const tasks = await db.tasks.orderBy('updatedAt').reverse().limit(10).toArray();
      return tasks;
    });
  },

  /**
   * Search tasks by title/description
   */
  searchTasks: (query: string) => {
    return useLiveQuery(async () => {
      if (!query.trim()) return [];
      
      const tasks = await db.tasks.toArray();
      const searchLower = query.toLowerCase();
      
      return tasks.filter(task => 
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
      );
    }, [query]);
  },
};

// ============================================================================
// Repository Pattern (for complex operations)
// ============================================================================

export const taskRepository = {
  /**
   * Get tasks with their tags
   */
  async getTasksWithTags(projectId?: string): Promise<Array<Task & { tags: any[] }>> {
    let tasks: Task[];
    
    if (projectId) {
      tasks = await db.tasks.where('projectId').equals(projectId).toArray();
    } else {
      tasks = await db.tasks.toArray();
    }

    // Load tags for all tasks
    const tasksWithTags = await Promise.all(
      tasks.map(async (task) => {
        const taskTags = await db.task_tags.where('taskId').equals(task.id).toArray();
        const tagIds = taskTags.map(tt => tt.tagId);
        const tags = await db.tags.bulkGet(tagIds);
        
        return {
          ...task,
          tags: tags.filter(Boolean)
        };
      })
    );

    return tasksWithTags;
  },

  /**
   * Get task dependencies
   */
  async getTaskDependencies(taskId: string): Promise<Task[]> {
    const dependencies = await db.task_dependencies
      .where('dependentTaskId')
      .equals(taskId)
      .toArray();
    
    const depIds = dependencies.map(d => d.dependencyTaskId);
    const depTasks = await db.tasks.bulkGet(depIds);
    
    return depTasks.filter(Boolean) as Task[];
  },

  /**
   * Get tasks that depend on this task
   */
  async getTaskDependents(taskId: string): Promise<Task[]> {
    const dependents = await db.task_dependencies
      .where('dependencyTaskId')
      .equals(taskId)
      .toArray();
    
    const depIds = dependents.map(d => d.dependentTaskId);
    const depTasks = await db.tasks.bulkGet(depIds);
    
    return depTasks.filter(Boolean) as Task[];
  },
};

// ============================================================================
// Utilities
// ============================================================================

export const taskUtils = {
  /**
   * Calculate task completion percentage for a project
   */
  async getProjectCompletion(projectId: string): Promise<number> {
    const tasks = await db.tasks.where('projectId').equals(projectId).toArray();
    if (tasks.length === 0) return 0;
    
    const completed = tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  },

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(): Promise<Task[]> {
    const tasks = await db.tasks.toArray();
    const now = new Date();
    
    return tasks.filter(task => {
      if (!task.dueDate || task.status === 'completed') return false;
      return new Date(task.dueDate) < now;
    });
  },

  /**
   * Get tasks due soon (next 7 days)
   */
  async getTasksDueSoon(): Promise<Task[]> {
    const tasks = await db.tasks.toArray();
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return tasks.filter(task => {
      if (!task.dueDate || task.status === 'completed') return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= now && dueDate <= weekFromNow;
    });
  },
};