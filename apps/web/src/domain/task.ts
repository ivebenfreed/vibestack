import { v4 as uuidv4 } from 'uuid';
import { DeepPartial } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
import { BaseRepository, BaseService, DatabaseServiceError, EventDispatcher } from './base';
import { OutgoingChangeService } from '../sync/OutgoingChangeService';
import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { useMemo } from 'react';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Note: Live changes types moved to centralized LiveChangesManager

// Main tasks store - holds all tasks in normalized format
export const tasksAtom = createAtom<Record<string, Task>>({});

// Note: Live changes are now handled centrally by LiveChangesManager
// Individual domain live changes have been removed for better performance

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
          const aTime = new Date(a.updatedAt || a.createdAt).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt).getTime();
          return bTime - aTime; // Latest first
        });
      },
      shallowEqual
    );
  },

  // Individual task by ID
  task: (taskId: string) => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => tasksRecord[taskId] || null
    );
  },

  // Note: No need for separate taskIds with XState selectors

  // Task stats
  taskStats: () => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => {
        const tasks = Object.values(tasksRecord);
        const pending = tasks.filter(t => t.status === TaskStatus.OPEN).length;
        const inProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
        const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
        const total = tasks.length;
        
        return { pending, inProgress, completed, total };
      },
      shallowEqual
    );
  },

  // Filtered tasks
  tasksByProject: (projectId: string) => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => {
        const tasks = Object.values(tasksRecord);
        return tasks.filter(task => task.projectId === projectId);
      },
      shallowEqual
    );
  },

  tasksByStatus: (status: TaskStatus) => {
    return useSelector(
      tasksAtom,
      (tasksRecord) => {
        const tasks = Object.values(tasksRecord);
        return tasks.filter(task => task.status === status);
      },
      shallowEqual
    );
  },

  // Note: Live changes state is now managed centrally
};

// ============================================================================
// Actions (Pure XState)
// ============================================================================

export const taskActions = {
  // 🎯 COMPARTMENTALIZED LOADING: Atoms handle their own database loading
  ensureLoaded: async () => {
    const current = tasksAtom.get();
    if (Object.keys(current).length > 0) {
      console.log(`[TaskAtoms] Tasks already loaded - skipping (${Object.keys(current).length} tasks)`);
      return; // Already loaded
    }
    
    console.log('[TaskAtoms] Loading tasks from database...');
    try {
      // ✅ FIXED: Use global datasource singleton to prevent race conditions
      const { getGlobalDataSource } = await import('../db/global-datasource');
      const dataSource = await getGlobalDataSource();
      
      if (!dataSource.isInitialized) {
        console.warn('[TaskAtoms] DataSource not ready, skipping load');
        return;
      }
      
      const tasks = await dataSource.getRepository(Task).find({ 
        relations: ['project', 'assignee'] 
      });
      
      // Create normalized record
      const tasksRecord: Record<string, Task> = {};
      tasks.forEach(task => {
        tasksRecord[task.id] = task;
      });
      
      // Update atom
      tasksAtom.set(tasksRecord);
      console.log(`[TaskAtoms] ✅ Loaded ${tasks.length} tasks`);
      
    } catch (error) {
      console.error('[TaskAtoms] Failed to load tasks:', error);
      // Don't throw - let components handle empty state gracefully
    }
  },

  // Bulk load tasks (for external data sources)
  loadTasks: (tasks: Task[]) => {
    // Create normalized record - no presorting needed with XState selectors
    const tasksRecord: Record<string, Task> = {};
    tasks.forEach(task => {
      tasksRecord[task.id] = task;
    });
    
    // Update atom
    tasksAtom.set(tasksRecord);
    console.log(`[TaskAtoms] Bulk loaded ${tasks.length} tasks`);
  },

  // ✅ PURE FUNCTION UPDATE: Direct database + sync tracking (no optimistic update)
  updateTask: async (taskId: string, updates: Partial<Task>) => {
    try {
      console.log(`[TaskAtoms] Background update for task ${taskId.slice(-8)}: ${Object.keys(updates).join(', ')}`);
      
      const dataSource = await import('../db/newtypeorm/NewDataSource').then(m => m.getNewPGliteDataSource());
      const repository = (await dataSource).getRepository(Task);
      
      // Get current task
      const task = await repository.findOne({ where: { id: taskId } });
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Apply business logic
      const updatedData = {
        ...updates,
        updatedAt: new Date(),
        // Handle completedAt logic
        ...(updates.status === TaskStatus.COMPLETED && !task.completedAt 
            ? { completedAt: new Date() } 
            : updates.status !== TaskStatus.COMPLETED && updates.status !== undefined
            ? { completedAt: undefined } 
            : {})
      };
      
      // Update database
      await repository.update(taskId, updatedData);
      const updated = await repository.findOne({ where: { id: taskId } });
      
      if (!updated) {
        throw new Error(`Failed to retrieve updated task ${taskId}`);
      }
      
             // Get OutgoingChangeService from sync machine
       try {
         const { getGlobalOutgoingChangeService } = await import('../state-machines/machines/sync-machine-v2');
         const outgoingChangeService = getGlobalOutgoingChangeService();
         
         if (outgoingChangeService) {
           await outgoingChangeService.trackEntityChange('tasks', 'update', updated);
         } else {
           console.warn('[TaskAtoms] No OutgoingChangeService available - sync tracking skipped');
         }
       } catch (error) {
         console.warn('[TaskAtoms] Failed to get OutgoingChangeService:', error);
       }
       
       console.log(`[TaskAtoms] Successfully updated task ${taskId.slice(-8)} - live sync will update atoms`);
    } catch (error) {
      console.error(`[TaskAtoms] Failed to update task ${taskId}:`, error);
      throw error; // Let VibeGrid handle the error
    }
  },

  // Internal atom-only update (used by service layer and fallback)
  updateTaskAtomOnly: (taskId: string, updates: Partial<Task>) => {
    const currentTasks = tasksAtom.get();
    const currentTask = currentTasks[taskId];
    
    if (!currentTask) {
      console.warn(`[TaskAtoms] Task ${taskId} not found for update`);
      return;
    }
    
    // ✅ FIXED: Don't modify updatedAt if it's already provided (e.g., from LiveChangesManager)
    // Only add updatedAt if it's not already in the updates (i.e., when called directly from UI)
    const updatedTask = { 
      ...currentTask, 
      ...updates,
      ...(updates.updatedAt ? {} : { updatedAt: new Date() })
    };
    
    // Update tasks record
    tasksAtom.set({
      ...currentTasks,
      [taskId]: updatedTask
    });
    
    console.log(`[TaskAtoms] Updated task atom ${taskId}`);
  },

  // ✅ PURE FUNCTION DELETE: Direct database + sync tracking (no service overhead)
  deleteTask: async (taskId: string) => {
    try {
      const dataSource = await import('../db/newtypeorm/NewDataSource').then(m => m.getNewPGliteDataSource());
      const repository = (await dataSource).getRepository(Task);
      
      // Check if task exists
      const task = await repository.findOne({ where: { id: taskId } });
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Delete from database
      const result = await repository.delete(taskId);
      const success = (result.affected ?? 0) > 0;
      
      if (success) {
        // Get OutgoingChangeService from sync machine
        try {
          const { getGlobalOutgoingChangeService } = await import('../state-machines/machines/sync-machine-v2');
          const outgoingChangeService = getGlobalOutgoingChangeService();
          
          if (outgoingChangeService) {
            await outgoingChangeService.trackEntityChange('tasks', 'delete', { id: taskId });
          } else {
            console.warn('[TaskAtoms] No OutgoingChangeService available - sync tracking skipped');
          }
        } catch (error) {
          console.warn('[TaskAtoms] Failed to get OutgoingChangeService:', error);
        }
        
        // Remove from atom
        taskActions.deleteTaskAtomOnly(taskId);
      }
      
      console.log(`[TaskAtoms] Deleted task ${taskId} via pure function (with sync tracking)`);
    } catch (error) {
      console.error(`[TaskAtoms] Failed to delete task ${taskId}:`, error);
      // Fallback to atom-only delete
      taskActions.deleteTaskAtomOnly(taskId);
    }
  },

  // Internal atom-only delete (used by service layer and fallback)
  deleteTaskAtomOnly: (taskId: string) => {
    const currentTasks = tasksAtom.get();
    
    // Remove from tasks record
    const { [taskId]: removed, ...remainingTasks } = currentTasks;
    tasksAtom.set(remainingTasks);
    
    console.log(`[TaskAtoms] Deleted task atom ${taskId}`);
  },

  // Create task (always goes through service for proper creation workflow)
  createTask: (task: Task) => {
    const currentTasks = tasksAtom.get();
    
    // Add to tasks record
    tasksAtom.set({
      ...currentTasks,
      [task.id]: { ...task, updatedAt: new Date() }
    });
    
    console.log(`[TaskAtoms] Created task ${task.id}`);
  },
};

// ============================================================================
// Note: Live Changes Integration removed - now handled centrally by LiveChangesManager
// ============================================================================

// ============================================================================
// Atomic Store Implementation (TaskAtomStore replacement)
// ============================================================================

class TaskAtomStore {
  // XState atoms for compatibility with existing interfaces
  tasksAtom = tasksAtom
  
  // Compatibility methods for existing code
  getTaskAtom = (id: string) => {
    // Return a compatibility object that works with existing EntityTableRow
    return {
      get: () => {
        const tasksRecord = tasksAtom.get();
        return tasksRecord[id] || null;
      },
      isXStateAtom: true,
      taskId: id
    };
  }

  // Derived atom equivalent for compatibility
  allTasksAtom = {
    get: () => Object.values(tasksAtom.get())
  }

  // Bulk load compatibility
  syncBulkLoad = {
    set: (tasks: Task[]) => taskActions.loadTasks(tasks)
  }

  // Note: Live changes methods removed - now handled centrally by LiveChangesManager
}

// Repository
export class TaskRepository extends BaseRepository<Task> {
  constructor(dataSource: NewPGliteDataSource) {
    if (!dataSource.isInitialized) {
      throw new Error('DataSource must be initialized before creating TaskRepository');
    }
    super(dataSource.getRepository(Task), 'task', dataSource);
  }

  async findByProject(projectId: string): Promise<Task[]> {
    return this.repository.find({ where: { projectId } as any });
  }

  async findByAssignee(assigneeId: string): Promise<Task[]> {
    return this.repository.find({ where: { assigneeId } as any });
  }
}

// Service
export class TaskService extends BaseService<Task> {
  // 🎯 CONNECT: Service points to co-located atomic store (defined after class)
  static atoms: TaskAtomStore;

  constructor(
    protected taskRepository: TaskRepository,
    protected outgoingChangeService: OutgoingChangeService
  ) {
    super(taskRepository, 'tasks', outgoingChangeService);
    
    // Add debugging for outgoing change service initialization
    if (!outgoingChangeService) {
      console.error('[TaskService] CRITICAL: TaskService created with null outgoingChangeService!');
      console.error('[TaskService] This will cause crashes when trying to track changes for sync.');
      console.trace('[TaskService] Constructor call stack:');
    } else {
      console.log('[TaskService] Successfully initialized with outgoingChangeService');
    }
    
    // Set up entity-specific sync processing methods
    this.validateSyncData = this.validateTaskSyncData.bind(this);
  }

  /**
   * Override to specify task-specific date fields
   */
  getDateFields(): string[] {
    return ['createdAt', 'updatedAt', 'dueDate', 'startDate', 'completedAt'];
  }

  /**
   * Override to handle task-specific data processing
   */
  processSyncData(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): Record<string, any> {
    let processedData = super.processSyncData(data, operation);
    
    if (operation === 'INSERT' || operation === 'UPDATE') {
      // Handle task-specific business logic (e.g., status-dependent completedAt)
      processedData = this.handleTaskSpecificLogic(processedData);
    }
    
    return processedData;
  }

  /**
   * Handle task-specific business logic during sync
   */
  private handleTaskSpecificLogic(data: Record<string, any>): Record<string, any> {
    const result = { ...data };
    
    // Handle completedAt based on status
    if (result.status === TaskStatus.COMPLETED && !result.completedAt) {
      result.completedAt = new Date();
    } else if (result.status !== TaskStatus.COMPLETED && result.completedAt) {
      result.completedAt = null;
    }
    
    // Ensure tags is an array (server should handle this, but fallback for safety)
    if (result.tags && !Array.isArray(result.tags)) {
      console.warn('[TaskService] tags is not an array, setting to empty array:', result.tags);
      result.tags = [];
    }
    
    return result;
  }

  /**
   * Validate task sync data
   */
  private validateTaskSyncData(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
    if (operation === 'INSERT') {
      if (!data.title) {
        throw new Error(`Task INSERT requires title. Received: ${JSON.stringify(data)}`);
      }
    }
    
    if (operation === 'UPDATE' || operation === 'DELETE') {
      if (!data.id) {
        throw new Error(`Task ${operation} requires an id. Received: ${JSON.stringify(data)}`);
      }
    }
    
    // Validate status and priority enums
    if (data.status && !Object.values(TaskStatus).includes(data.status)) {
      throw new Error(`Invalid task status: ${data.status}`);
    }
    
    if (data.priority && !Object.values(TaskPriority).includes(data.priority)) {
      throw new Error(`Invalid task priority: ${data.priority}`);
    }
  }

  async get(id: string): Promise<Task | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to get task with ID ${id}`,
        'get',
        error
      );
    }
  }

  async getByProject(projectId: string): Promise<Task[]> {
    try {
      return await this.repository.findByProject(projectId);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to get tasks for project with ID ${projectId}`,
        'getByProject',
        error
      );
    }
  }

  async getByAssignee(assigneeId: string): Promise<Task[]> {
    try {
      return await this.repository.findByAssignee(assigneeId);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to get tasks for assignee with ID ${assigneeId}`,
        'getByAssignee',
        error
      );
    }
  }

  async createTask(taskData: {
    title: string;
    projectId?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    dueDate?: Date;
    startDate?: Date;
    completedAt?: Date;
    timeRange?: string;
    estimatedDuration?: string;
    tags?: string[];
  }): Promise<Task> {
    try {
      const now = new Date();
      const taskId = uuidv4();
      
      const newTask = {
        id: taskId,
        title: taskData.title,
        projectId: taskData.projectId || null,
        description: taskData.description || null,
        status: taskData.status || TaskStatus.OPEN,
        priority: taskData.priority || TaskPriority.MEDIUM,
        assigneeId: taskData.assigneeId || null,
        dueDate: taskData.dueDate || null,
        startDate: taskData.startDate || null,
        completedAt: taskData.completedAt || null,
        timeRange: taskData.timeRange || null,
        estimatedDuration: taskData.estimatedDuration || null,
        tags: Array.isArray(taskData.tags) ? taskData.tags : [],
        createdAt: now,
        updatedAt: now
      } as unknown as Task;

      // ✅ USE INHERITED METHOD: createWithProcessing handles sync tracking automatically
      const createdTask = await this.createWithProcessing(newTask as Record<string, any>);
      
      // ✅ OPTIMISTIC UPDATE: Add new task to atom immediately
      taskActions.createTask(createdTask);
      
      // Optimized event dispatching
      EventDispatcher.emit('task:created', { task: createdTask });
      
      return createdTask;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to create task "${taskData.title}"`,
        'createTask',
        error
      );
    }
  }

  async updateTask(id: string, changes: Partial<Task>): Promise<Task> {
    const updateCallId = `update_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    console.log(`[TaskService] 🔄 updateTask called: ${updateCallId} for task ${id.slice(-8)} with changes:`, Object.keys(changes));
    
    try {
      const task = await this.repository.findById(id);
      if (!task) {
        throw new Error(`Task with ID ${id} not found`);
      }
      
      // Simplified logging for task updates
      const changedFields = Object.keys(changes);
      console.log(`[TaskService] Updating task ${id.slice(-8)}: ${changedFields.join(', ')}`);
      
      // Handle completedAt automatically when status changes
      const updatedData = {
        ...changes,
        updatedAt: new Date()
      } as DeepPartial<Task>;
      
      // If status is being changed, handle completedAt logic
      if (changes.status !== undefined && changes.status !== task.status) {
        updatedData.completedAt = (changes.status === TaskStatus.COMPLETED ? new Date() : undefined) as DeepPartial<Date | undefined>;
      }
      
      // ✅ OPTIMISTIC UPDATE: Update atom immediately with optimistic data (BEFORE async operations)
      const optimisticTask = { ...task, ...updatedData } as Task
      taskActions.updateTaskAtomOnly(id, optimisticTask)
      
      // ✅ BACKGROUND PROCESSING: Let the rest happen asynchronously without blocking the optimistic update
      const backgroundSync = async () => {
        console.log(`[TaskService] 🔄 backgroundSync starting for ${updateCallId}`);
        try {
          // ✅ USE INHERITED METHOD: updateWithProcessing handles sync tracking automatically
          console.log(`[TaskService] 🔄 About to call updateWithProcessing for ${updateCallId}`);
          const updatedTask = await this.updateWithProcessing(id, updatedData as Record<string, any>);
          console.log(`[TaskService] 🔄 updateWithProcessing completed for ${updateCallId}`);
          
          // ✅ SUCCESS: Update atom with real server data (may be same as optimistic)
          taskActions.updateTaskAtomOnly(id, updatedTask)
          
          // Optimized event dispatching
          EventDispatcher.emit('task:updated', { task: updatedTask });
          
        } catch (updateError) {
          // ✅ REVERT: If save fails, revert atom to original state
          console.error(`[TaskService] Update failed for ${updateCallId}, reverting optimistic change:`, updateError)
          
          // Check if it's an outgoing change service initialization issue
          if (updateError instanceof Error && updateError.message.includes('OutgoingChangeService not available')) {
            console.error('[TaskService] OutgoingChangeService not initialized - this indicates a service initialization problem');
            console.error('[TaskService] Current outgoingChangeService:', this.outgoingChangeService);
            console.error('[TaskService] Service constructor was called with:', {
              repository: !!this.repository,
              tableName: this.tableName,
              outgoingChangeService: !!this.outgoingChangeService
            });
          }
          
          taskActions.updateTaskAtomOnly(id, task)
        }
      }
      
      // Start background sync without awaiting
      console.log(`[TaskService] 🔄 Starting backgroundSync for ${updateCallId}`);
      backgroundSync()
      
      // ✅ RETURN OPTIMISTIC DATA: Return immediately with optimistic data
      return optimisticTask;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to update task with ID ${id}`,
        'updateTask',
        error
      );
    }
  }

  async deleteTask(id: string): Promise<boolean> {
    try {
      const task = await this.repository.findById(id);
      if (!task) {
        throw new Error(`Task with ID ${id} not found`);
      }
      
      // ✅ USE INHERITED METHOD: deleteWithProcessing handles sync tracking automatically
      const success = await this.deleteWithProcessing(id);
      
      // ✅ OPTIMISTIC UPDATE: Remove task from atom immediately
      if (success) {
        taskActions.deleteTaskAtomOnly(id)
        
        // Optimized event dispatching
        EventDispatcher.emit('task:deleted', { taskId: id });
      }
      
      return success;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to delete task with ID ${id}`,
        'deleteTask',
        error
      );
    }
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    try {
      const task = await this.repository.findById(id);
      if (!task) {
        throw new Error(`Task with ID ${id} not found`);
      }
      
      // Handle completedAt automatically
      const updatedData = {
        status,
        completedAt: (status === TaskStatus.COMPLETED ? new Date() : undefined),
        updatedAt: new Date()
      } as DeepPartial<Task>;
      
      // ✅ USE INHERITED METHOD: updateWithProcessing handles sync tracking automatically
      const updatedTask = await this.updateWithProcessing(id, updatedData as Record<string, any>);
      
      // ✅ SUCCESS: Update atom with real server data
      taskActions.updateTaskAtomOnly(id, updatedTask)
      
      // Optimized event dispatching
      EventDispatcher.emit('task:status-updated', { task: updatedTask });
      
      return updatedTask;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to update status for task with ID ${id}`,
        'updateTaskStatus',
        error
      );
    }
  }

  // Note: Live changes methods removed - now handled centrally by LiveChangesManager

  // ============================================================================
  // LIVE QUERY BUILDERS (using our existing patterns)
  // ============================================================================
  
  static createQueryBuilders(createQueryBuilder: Function) {
    return {
      all: () => {
        return createQueryBuilder(Task, 'task')
          // TEMPORARILY REMOVED - causing N+1 queries due to Promise-based relations
          // .leftJoinAndSelect('task.project', 'project')
          // .leftJoinAndSelect('task.assignee', 'assignee')
          .orderBy('task.createdAt', 'DESC')
      },

      allWithRelations: () => {
        return createQueryBuilder(Task, 'task')
          .leftJoinAndSelect('task.project', 'project')
          .leftJoinAndSelect('task.assignee', 'assignee')
          .orderBy('task.createdAt', 'DESC')
      },

      // Alternative: Repository-based approach with relations (often more efficient)
      allWithRelationsRepository: async (dataSource: any) => {
        const taskRepo = dataSource.getRepository(Task)
        return await taskRepo.find({
          relations: ['project', 'assignee'],
          order: { createdAt: 'DESC' }
        })
      },

      recent: (limit: number = 5) => {
        return createQueryBuilder(Task, 'task')
          .select(['task.id', 'task.title', 'task.status', 'task.createdAt'])
          .orderBy('task.createdAt', 'DESC')
          .limit(limit)
      },

      byProject: (projectId: string) => {
        // Validate projectId early - if it's undefined, null, or empty, throw an error
        const isValidProjectId = !!(projectId && typeof projectId === 'string' && projectId.trim() !== '' && projectId !== 'undefined')
        
        if (!isValidProjectId) {
          throw new Error(`Invalid projectId provided to TaskService.createQueryBuilders.byProject: "${projectId}"`)
        }
        
        return createQueryBuilder(Task, 'task')
          // TEMPORARILY REMOVED - causing N+1 queries due to Promise-based relations
          // .leftJoinAndSelect('task.project', 'project')
          // .leftJoinAndSelect('task.assignee', 'assignee')
          .where('task.projectId = :projectId', { projectId })
          .orderBy('task.createdAt', 'DESC')
      },

      byAssignee: (assigneeId: string) => {
        // Validate assigneeId early - if it's undefined, null, or empty, throw an error
        const isValidAssigneeId = !!(assigneeId && typeof assigneeId === 'string' && assigneeId.trim() !== '' && assigneeId !== 'undefined')
        
        if (!isValidAssigneeId) {
          throw new Error(`Invalid assigneeId provided to TaskService.createQueryBuilders.byAssignee: "${assigneeId}"`)
        }
        
        return createQueryBuilder(Task, 'task')
          // TEMPORARILY REMOVED - causing N+1 queries due to Promise-based relations
          // .leftJoinAndSelect('task.project', 'project')
          // .leftJoinAndSelect('task.assignee', 'assignee')
          .where('task.assigneeId = :assigneeId', { assigneeId })
          .orderBy('task.createdAt', 'DESC')
      },

      detail: (id: string) => {
        // Validate id early - if it's undefined, null, or empty, throw an error
        const isValidId = !!(id && typeof id === 'string' && id.trim() !== '' && id !== 'undefined')
        
        if (!isValidId) {
          throw new Error(`Invalid id provided to TaskService.createQueryBuilders.detail: "${id}"`)
        }
        
        return createQueryBuilder(Task, 'task')
          // TEMPORARILY REMOVED - causing N+1 queries due to Promise-based relations
          // .leftJoinAndSelect('task.project', 'project')
          // .leftJoinAndSelect('task.assignee', 'assignee')
          // .leftJoinAndSelect('task.comments', 'comments')
          .where('task.id = :id', { id })
      },
    }
  }

  // ❌ DELETED: All queryOptions (~200 lines) - replaced with atomic stores

  // ❌ DELETED: All hooks (~250 lines) - replaced with atomic stores
}

// ============================================================================
// ATOMIC STORE INSTANCE - Exported for Universal Entity Table v2  
// ============================================================================

// 🎯 SIMPLE: Direct export, no registry needed
const taskAtoms = new TaskAtomStore();

// 🎯 FIX: Use lazy initialization to prevent circular dependency
Object.defineProperty(TaskService, 'atoms', {
  get() {
    return taskAtoms;
  },
  enumerable: true,
  configurable: true
});

export { taskAtoms };

// Factory function for this domain
export function createTaskDomain(
  dataSource: NewPGliteDataSource, 
  outgoingChangeService: OutgoingChangeService
) {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before creating Task domain');
  }
  
  const repository = new TaskRepository(dataSource);
  const service = new TaskService(repository, outgoingChangeService);
  
  // Register service instance for VibeGrid integration
  setTaskService(service);
  
  return { repository, service };
}

// ============================================================================
// SINGLETON SERVICE INSTANCE - For VibeGrid Integration
// ============================================================================

let taskServiceInstance: TaskService | null = null;

export function setTaskService(service: TaskService): void {
  taskServiceInstance = service;
}

export async function getTaskService(): Promise<TaskService | null> {
  return taskServiceInstance;
}

export function hasTaskService(): boolean {
  return taskServiceInstance !== null;
}

/**
 * Update the TaskService's OutgoingChangeService after sync machine initialization
 * This allows the service to be created with a no-op service initially, then upgraded
 * to use the real OutgoingChangeService from the sync machine.
 */
export function updateTaskServiceOutgoingChangeService(outgoingChangeService: OutgoingChangeService): void {
  if (taskServiceInstance) {
    console.log('[TaskService] 🔄 Updating OutgoingChangeService from no-op to real service');
    (taskServiceInstance as any).outgoingChangeService = outgoingChangeService;
    console.log('[TaskService] ✅ OutgoingChangeService updated successfully');
  } else {
    console.warn('[TaskService] Cannot update OutgoingChangeService - TaskService not initialized');
  }
} 