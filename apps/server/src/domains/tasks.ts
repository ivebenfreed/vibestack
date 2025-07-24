import { Client } from '@neondatabase/serverless';
import { Task, TaskStatus, TaskPriority } from "@repo/dataforge/server-entities";
import { validate } from "class-validator";
import { FindOptionsWhere, DeepPartial } from 'typeorm';
import { NeonService } from '../lib/neon-orm/neon-service';
import type { Context } from 'hono';
import type { Env } from '../types/env';
import type { AppBindings } from '../types/hono';
import { BaseServerRepository } from './BaseServerRepository';

// Re-export enums for convenience
export { TaskStatus, TaskPriority };

// Simplified type definitions
type TaskInstance = Task;

// Input types for API
export type TaskCreateInput = Partial<Omit<TaskInstance, 'id' | 'created_at' | 'updated_at'>>;
export type TaskUpdateInput = Partial<TaskCreateInput>;

/**
 * TaskRepository class that extends BaseServerRepository
 */
export class TaskRepository extends BaseServerRepository<Task> {
  
  constructor(neonService: NeonService) {
    super(neonService, Task);
  }

  /**
   * Find all tasks
   */
  async findAll(): Promise<Task[]> {
    return await this.neonService.find(Task);
  }

  /**
   * Find task by ID
   */
  async findById(id: string): Promise<Task | null> {
    return await this.neonService.findOne(Task, { id } as FindOptionsWhere<Task>);
  }

  /**
   * Find tasks by project ID
   */
  async findByProjectId(projectId: string): Promise<Task[]> {
    return await this.neonService.find(Task, { projectId } as FindOptionsWhere<Task>);
  }

  /**
   * Find tasks by assignee ID
   */
  async findByAssigneeId(assigneeId: string): Promise<Task[]> {
    return await this.neonService.find(Task, { assigneeId } as FindOptionsWhere<Task>);
  }

  /**
   * Find tasks by status
   */
  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return await this.neonService.find(Task, { legacyStatus: status } as FindOptionsWhere<Task>);
  }

  /**
   * Create a new task with defaults
   */
  async create(data: TaskCreateInput): Promise<Task> {
    // Set default values if not provided
    const taskData = {
      ...data,
      legacyStatus: data.status || TaskStatus.OPEN,
      priority: data.priority || TaskPriority.MEDIUM
    };
    
    // Use parent class create method (handles validation)
    return await super.create(taskData as DeepPartial<Task>);
  }

  /**
   * Update a task
   */
  async update(id: string, data: TaskUpdateInput): Promise<Task | null> {
    // Create task for validation
    const task = new Task();
    Object.assign(task, { id, ...data });
    
    // Validate task
    const errors = await validate(task, { skipMissingProperties: true });
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
    }
    
    // Update the task using TypeORM
    await this.neonService.update(Task, { id } as FindOptionsWhere<Task>, data as DeepPartial<Task>);
    
    // Return the updated task
    return await this.findById(id);
  }

  /**
   * Update task status (specialized method)
   * Used by sync operations - preserves clientId
   */
  async updateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    // Set completedAt based on status
    const completedAt = status === TaskStatus.COMPLETED ? new Date() : null;
    
    // Use parent class update method
    return await this.update(id, { legacyStatus: status, completedAt } as TaskUpdateInput);
  }

  /**
   * System update task status - clears clientId
   * Used by API endpoints and system operations
   */
  async systemUpdateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    // Set completedAt based on status
    const completedAt = status === TaskStatus.COMPLETED ? new Date() : null;
    
    // Use parent class systemUpdate method
    return await this.systemUpdate(id, { legacyStatus: status, completedAt } as TaskUpdateInput);
  }

  /**
   * Update task time range (specialized method)
   * Used by sync operations - preserves clientId
   */
  async updateTimeRange(id: string, timeRange: string): Promise<Task | null> {
    // Use parent class update method
    return await this.update(id, { timeRange } as TaskUpdateInput);
  }

  /**
   * System update task time range - clears clientId
   * Used by API endpoints and system operations
   */
  async systemUpdateTimeRange(id: string, timeRange: string): Promise<Task | null> {
    // Use parent class systemUpdate method
    return await this.systemUpdate(id, { timeRange } as TaskUpdateInput);
  }

  /**
   * Add dependency to task using TypeORM query builder
   */
  async addDependency(taskId: string, dependencyId: string): Promise<Task | null> {
    const queryBuilder = await this.neonService.createQueryBuilder(Task, 'task');
    await queryBuilder
      .insert()
      .into('task_dependencies')
      .values({
        dependent_task_id: taskId,
        dependency_task_id: dependencyId
      })
      .orIgnore() // ON CONFLICT DO NOTHING
      .execute();
    
    return await this.findById(taskId);
  }

  /**
   * Remove dependency from task using TypeORM query builder
   */
  async removeDependency(taskId: string, dependencyId: string): Promise<Task | null> {
    const queryBuilder = await this.neonService.createQueryBuilder(Task, 'task');
    await queryBuilder
      .delete()
      .from('task_dependencies')
      .where('dependent_task_id = :taskId AND dependency_task_id = :dependencyId', { 
        taskId, 
        dependencyId 
      })
      .execute();
    
    return await this.findById(taskId);
  }

  /**
   * Add tag to task
   * Used by sync operations - preserves clientId
   */
  async addTag(id: string, tag: string): Promise<Task | null> {
    try {
      // First get the current task to check existing tags
      const task = await this.findById(id);
      if (!task) return null;
      
      // Check if tag already exists
      const tags = task.legacyTags || [];
      if (!tags.includes(tag)) {
        // Add the tag and update
        tags.push(tag);
        
        // Update using the standard update method
        await this.neonService.update(
          Task,
          { id } as FindOptionsWhere<Task>,
          { legacyTags: tags } as DeepPartial<Task>
        );
      }
      
      // Return updated task
      return await this.findById(id);
    } catch (error) {
      console.error('Error adding tag:', error);
      throw error;
    }
  }

  /**
   * Remove tag from task
   * Used by sync operations - preserves clientId
   */
  async removeTag(id: string, tag: string): Promise<Task | null> {
    try {
      // First get the current task
      const task = await this.findById(id);
      if (!task) return null;
      
      // Remove the tag if it exists
      const tags = task.legacyTags || [];
      const updatedTags = tags.filter(t => t !== tag);
      
      // Update using the standard update method
      await this.neonService.update(
        Task,
        { id } as FindOptionsWhere<Task>,
        { legacyTags: updatedTags } as DeepPartial<Task>
      );
      
      // Return updated task
      return await this.findById(id);
    } catch (error) {
      console.error('Error removing tag:', error);
      throw error;
    }
  }

  /**
   * System add tag to task - clears clientId
   * Used by API endpoints and system operations
   */
  async systemAddTag(id: string, tag: string): Promise<Task | null> {
    try {
      // First get the current task to check existing tags
      const task = await this.findById(id);
      if (!task) return null;
      
      // Check if tag already exists
      const tags = task.legacyTags || [];
      if (!tags.includes(tag)) {
        // Add the tag and update using system method
        tags.push(tag);
        
        // Use the base class systemUpdate method
        return await this.systemUpdate(id, { legacyTags: tags } as TaskUpdateInput);
      }
      
      // No change needed, return existing task
      return task;
    } catch (error) {
      console.error('Error adding tag:', error);
      throw error;
    }
  }

  /**
   * System remove tag from task - clears clientId
   * Used by API endpoints and system operations
   */
  async systemRemoveTag(id: string, tag: string): Promise<Task | null> {
    try {
      // First get the current task
      const task = await this.findById(id);
      if (!task) return null;
      
      // Remove the tag if it exists
      const tags = task.legacyTags || [];
      const updatedTags = tags.filter(t => t !== tag);
      
      // Use the base class systemUpdate method
      return await this.systemUpdate(id, { legacyTags: updatedTags } as TaskUpdateInput);
    } catch (error) {
      console.error('Error removing tag:', error);
      throw error;
    }
  }

  /**
   * Delete task
   */
  async delete(id: string): Promise<boolean> {
    try {
      // First delete all dependencies
      const dependencyQueryBuilder = await this.neonService.createQueryBuilder(Task, 'task');
      await dependencyQueryBuilder
        .delete()
        .from('task_dependencies')
        .where('dependent_task_id = :id OR dependency_task_id = :id', { id })
        .execute();
      
      // Then delete the task
      const result = await this.neonService.delete(Task, { id } as FindOptionsWhere<Task>);
      
      return (result.affected !== null && result.affected !== undefined && result.affected > 0);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }
}

// Helper to create a NeonService instance from a Neon client
const createServiceFromClient = (client: Client): NeonService => {
  // Create a minimal mock of Hono context with the client
  // First cast to unknown to avoid strict type checking errors
  const context = {
    req: { neon: client },
    env: { DATABASE_URL: "neon-client://internal" },
    // Add minimal implementations of required methods/properties
    finalized: false,
    error: null,
    get executionCtx() { return null; },
    get event() { return null; }
  } as unknown as Context<{ Bindings: Env; Variables: any }>;
  
  return new NeonService(context);
};

// Legacy compatibility layer - maps the class-based repository to the old interface
// This preserves backward compatibility with code still using the taskQueries object
export const taskQueries = {
  findAll: async (client: Client): Promise<TaskInstance[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.findAll();
  },

  findById: async (client: Client, id: string): Promise<TaskInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.findById(id);
  },

  findByProjectId: async (client: Client, projectId: string): Promise<TaskInstance[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.findByProjectId(projectId);
  },

  findByAssigneeId: async (client: Client, assigneeId: string): Promise<TaskInstance[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.findByAssigneeId(assigneeId);
  },

  findByStatus: async (client: Client, status: typeof TaskStatus[keyof typeof TaskStatus]): Promise<TaskInstance[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.findByStatus(status);
  },

  create: async (client: Client, data: TaskCreateInput): Promise<TaskInstance> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.create(data);
  },

  update: async (client: Client, id: string, data: TaskUpdateInput): Promise<TaskInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.update(id, data);
  },

  updateStatus: async (client: Client, id: string, status: typeof TaskStatus[keyof typeof TaskStatus]): Promise<TaskInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.updateStatus(id, status);
  },

  updateTimeRange: async (client: Client, id: string, timeRange: string): Promise<TaskInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.updateTimeRange(id, timeRange);
  },

  addDependency: async (client: Client, taskId: string, dependencyId: string): Promise<TaskInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.addDependency(taskId, dependencyId);
  },

  removeDependency: async (client: Client, taskId: string, dependencyId: string): Promise<TaskInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.removeDependency(taskId, dependencyId);
  },

  addTag: async (client: Client, id: string, tag: string): Promise<TaskInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.addTag(id, tag);
  },

  removeTag: async (client: Client, id: string, tag: string): Promise<TaskInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.removeTag(id, tag);
  },

  delete: async (client: Client, id: string): Promise<boolean> => {
    const neonService = createServiceFromClient(client);
    const repo = new TaskRepository(neonService);
    return await repo.delete(id);
  }
};