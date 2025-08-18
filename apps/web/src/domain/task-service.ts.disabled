/**
 * Task Domain Service
 * 
 * Implements task-specific CRUD operations with business logic and sync tracking.
 * Uses the Task entity type from DataForge for full type safety.
 */

import { Task, TaskStatus, TaskPriority } from '../db/client-entities';
import { db } from '../db/dexie-schema';
// import { taskDexieService } from '@repo/dataforge/dexie-domain'; // TODO: Replace with local implementation
import type { CreateTaskInput, UpdateTaskInput } from '../db/client-entities';
import { nanoid } from 'nanoid';
import { BaseDomainService } from './base-domain-service';
// trackOutgoingChange no longer needed - automatic hooks handle change tracking

// Re-export types from client entities
export type { CreateTaskInput, UpdateTaskInput } from '../db/client-entities';

// ============================================================================
// Task Domain Service Implementation
// ============================================================================

export class TaskDomainService extends BaseDomainService<Task, CreateTaskInput, UpdateTaskInput> {
  tableName = 'tasks';
  entityName = 'Task';
  
  protected getTable() {
    return db.tasks;
  }
  
  // ============================================================================
  // Unified CRUD Operations (automatic sync tracking via hooks)
  // ============================================================================
  
  async create(input: CreateTaskInput): Promise<Task> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    // Use generated Dexie service for creation
    // Note: Change tracking happens automatically via hooks
    const task = await taskDexieService.create(processedInput);
    
    console.log('[TaskService] Created task', {
      id: task.id,
      title: task.title,
      trackingAutomatic: true
    });
    
    // Call after hook if defined
    if (this.afterCreate) {
      await this.afterCreate(task);
    }
    
    return task;
  }
  
  // ============================================================================
  // Many-to-Many Relationship Operations
  // ============================================================================
  
  /**
   * Get tags for a specific task
   */
  async getTaskTags(taskId: string): Promise<string[]> {
    const tags = await taskDexieService.getTags(taskId);
    const tagIds = tags.map(tag => tag.id);
    return tagIds;
  }
  
  /**
   * Get tags for multiple tasks (batch operation)
   */
  async getTagsForTasks(taskIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    
    // Use the generated service methods
    await Promise.all(
      taskIds.map(async (taskId) => {
        const tagIds = await this.getTaskTags(taskId);
        result.set(taskId, tagIds);
      })
    );
    
    return result;
  }
  
  async update(id: string, updates: UpdateTaskInput): Promise<Task> {
    const existing = await taskDexieService.getById(id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }
    
    // Validate input
    if (this.validateUpdate) {
      this.validateUpdate(id, updates);
    }
    
    // Apply transformations
    const processedUpdates = this.beforeUpdate 
      ? this.beforeUpdate(id, updates, existing) 
      : updates;
    
    // Handle special business logic
    const finalUpdates: UpdateTaskInput = {
      ...processedUpdates,
      // Auto-set completedAt when marking as completed
      completedAt: processedUpdates.status === TaskStatus.COMPLETED && !existing.completedAt
        ? new Date().toISOString()
        : processedUpdates.completedAt !== undefined 
          ? processedUpdates.completedAt 
          : existing.completedAt,
    };
    
    // Use generated Dexie service for update
    // Note: Change tracking happens automatically via hooks
    const updated = await taskDexieService.update(id, finalUpdates);
    if (!updated) {
      throw new Error(`Failed to update task ${id}`);
    }
    
    console.log('[TaskService] Updated task', {
      id: updated.id,
      updates: finalUpdates,
      trackingAutomatic: true
    });
    
    // Call after hook if defined
    if (this.afterUpdate) {
      await this.afterUpdate(updated, existing);
    }
    
    return updated;
  }
  
  async delete(id: string): Promise<boolean> {
    const existing = await taskDexieService.getById(id);
    if (!existing) {
      return false;
    }
    
    // Use generated Dexie service for deletion
    // Note: Change tracking happens automatically via hooks
    const result = await taskDexieService.delete(id);
    
    if (result) {
      console.log('[TaskService] Deleted task', {
        id,
        trackingAutomatic: true
      });
    }
    
    return result;
  }
  
  // ============================================================================
  // Sync Operations (executed within sync transactions to avoid tracking)
  // ============================================================================
  
  async createSync(task: Task): Promise<Task> {
    const { applySyncChanges } = await import('@/db/dexie-change-tracking');
    
    await applySyncChanges(async () => {
      await db.tasks.put(task);
    });
    
    console.log('[TaskService] Created task from sync', {
      id: task.id,
      title: task.title
    });
    return task;
  }
  
  async updateSync(id: string, updates: Partial<Task>): Promise<Task> {
    const { applySyncChanges } = await import('@/db/dexie-change-tracking');
    
    const existing = await taskDexieService.getById(id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }
    
    const updated: Task = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    
    await applySyncChanges(async () => {
      await db.tasks.put(updated);
    });
    
    console.log('[TaskService] Updated task from sync', {
      id: updated.id,
      updates
    });
    
    return updated;
  }
  
  async deleteSync(id: string): Promise<boolean> {
    const { applySyncChanges } = await import('@/db/dexie-change-tracking');
    let result = false;
    
    await applySyncChanges(async () => {
      result = await taskDexieService.delete(id);
    });
    
    if (result) {
      console.log('[TaskService] Deleted task from sync', { id });
    }
    return result;
  }

  // ============================================================================
  // Backward Compatibility Aliases (deprecated - use create/update/delete)
  // ============================================================================
  
  /** @deprecated Use create() instead - will be removed in next version */
  async createUI(input: CreateTaskInput): Promise<Task> {
    return this.create(input);
  }
  
  /** @deprecated Use update() instead - will be removed in next version */
  async updateUI(id: string, updates: UpdateTaskInput): Promise<Task> {
    return this.update(id, updates);
  }
  
  /** @deprecated Use delete() instead - will be removed in next version */
  async deleteUI(id: string): Promise<boolean> {
    return this.delete(id);
  }
  
  /** @deprecated Use createSync() instead - will be removed in next version */
  async createIncoming(task: Task): Promise<Task> {
    return this.createSync(task);
  }
  
  /** @deprecated Use updateSync() instead - will be removed in next version */
  async updateIncoming(id: string, updates: Partial<Task>): Promise<Task> {
    return this.updateSync(id, updates);
  }
  
  /** @deprecated Use deleteSync() instead - will be removed in next version */
  async deleteIncoming(id: string): Promise<boolean> {
    return this.deleteSync(id);
  }
  
  // ============================================================================
  // Validation Hooks
  // ============================================================================
  
  protected validateCreate(input: CreateTaskInput): void {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error('Task title is required');
    }
    
    if (input.title.length > 255) {
      throw new Error('Task title cannot exceed 255 characters');
    }
  }
  
  protected validateUpdate(id: string, updates: UpdateTaskInput): void {
    if (updates.title !== undefined) {
      if (updates.title.trim().length === 0) {
        throw new Error('Task title cannot be empty');
      }
      
      if (updates.title.length > 255) {
        throw new Error('Task title cannot exceed 255 characters');
      }
    }
  }
  
  // ============================================================================
  // Business Logic Hooks
  // ============================================================================
  
  protected beforeCreate(input: CreateTaskInput): CreateTaskInput {
    // Apply any default transformations
    return {
      ...input,
      // Ensure description is never null
      description: input.description || '',
      // Default to medium priority if not specified
      priority: input.priority || TaskPriority.MEDIUM,
      // Default to TODO status if not specified
      status: input.status || TaskStatus.TODO,
    };
  }
  
  protected beforeUpdate(id: string, updates: UpdateTaskInput, existing: Task): UpdateTaskInput {
    const processed = { ...updates };
    
    // Clear blockedReason when unblocking
    if (updates.status && updates.status !== TaskStatus.TODO && existing.blockedReason) {
      processed.blockedReason = '';
    }
    
    // Clear completedAt when reopening
    if (updates.status && updates.status !== TaskStatus.COMPLETED && existing.completedAt) {
      processed.completedAt = null;
    }
    
    return processed;
  }
  
  // ============================================================================
  // Additional Task-Specific Methods
  // ============================================================================
  
  /**
   * Bulk create tasks for sync operations
   */
  async batchCreateSync(tasks: Task[]): Promise<Task[]> {
    if (tasks.length === 0) return [];
    
    const { applySyncChanges } = await import('@/db/dexie-change-tracking');
    
    await applySyncChanges(async () => {
      await db.tasks.bulkPut(tasks);
    });
    
    console.log('[TaskService] Batch created tasks from sync', {
      count: tasks.length
    });
    
    return tasks;
  }
  
  /** @deprecated Use batchCreateSync() instead - will be removed in next version */
  async bulkCreateIncoming(tasks: Task[]): Promise<Task[]> {
    return this.batchCreateSync(tasks);
  }
  
  // ============================================================================
  // Batch Operations (unified interface)
  // ============================================================================
  
  /** @deprecated Use batchUpdate() instead - will be removed in next version */
  async batchUpdateUI(updates: Array<{ id: string; updates: Partial<Task> }>): Promise<Task[]> {
    return this.batchUpdate(updates);
  }
  
  /** @deprecated Use batchDelete() instead - will be removed in next version */
  async batchDeleteUI(ids: string[]): Promise<{ deleted: string[]; notFound: string[] }> {
    return this.batchDelete(ids);
  }
  
  /** @deprecated Use batchCreate() instead - will be removed in next version */
  async batchCreateUI(inputs: any[]): Promise<Task[]> {
    return this.batchCreate(inputs);
  }
  
  /** @deprecated Use batchUpdateSync() instead - will be removed in next version */
  async batchUpdateIncoming(updates: Array<{ id: string; updates: Partial<Task> }>): Promise<Task[]> {
    return this.batchUpdateSync(updates);
  }
  
  /** @deprecated Use batchDeleteSync() instead - will be removed in next version */
  async batchDeleteIncoming(ids: string[]): Promise<number> {
    return this.batchDeleteSync(ids);
  }
  
  /** @deprecated Use batchCreateSync() instead - will be removed in next version */
  async batchCreateIncoming(tasks: Task[]): Promise<Task[]> {
    return this.batchCreateSync(tasks);
  }

  /**
   * Move task to a different project
   */
  async moveToProject(taskId: string, projectId: string | null): Promise<Task> {
    return this.update(taskId, { projectId });
  }
  
  /**
   * Assign task to a user
   */
  async assignTo(taskId: string, userId: string | null): Promise<Task> {
    return this.update(taskId, { assigneeId: userId });
  }
  
  /**
   * Update task status with business logic
   */
  async updateStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return this.update(taskId, { status });
  }
  
  // ============================================================================
  // Relationship Resolvers (from generated service)
  // ============================================================================
  
  /**
   * Get a fully resolved task with all relationships populated
   * This includes the tags array and resolved display names
   */
  async getFullyResolvedTask(taskId: string): Promise<Task | null> {
    const task = await taskDexieService.getById(taskId);
    if (!task) {
      return null;
    }
    
    // Add many-to-many relationships
    const tags = await this.getTaskTags(taskId);
    task.tags = tags;
    
    // Note: Display name resolution (__resolved_ fields) happens in the table store
    // This method ensures the entity has all its relationship arrays
    
    return task;
  }
  
  /**
   * Get tags for a task
   */
  async getTags(taskId: string) {
    return taskDexieService.getTags(taskId);
  }
  
  /**
   * Set tags for a task
   */
  async setTags(taskId: string, tagIds: string[]) {
    await taskDexieService.setTags(taskId, tagIds);
    // Note: Change tracking happens automatically via hooks when the junction table is updated
  }
  
  /**
   * Resolve status definition
   */
  async resolveStatus(statusId: string) {
    return taskDexieService.resolveStatus_id(statusId);
  }
  
  /**
   * Resolve project
   */
  async resolveProject(projectId: string) {
    return taskDexieService.resolveProject_id(projectId);
  }
  
  /**
   * Resolve assignee
   */
  async resolveAssignee(assigneeId: string) {
    return taskDexieService.resolveAssignee_id(assigneeId);
  }
  
  // ============================================================================
  // Task Dependency Management (via EntityDependency service)
  // ============================================================================
  
  /**
   * Get all dependencies for a set of tasks
   */
  async getTaskDependencies(taskIds?: string[]): Promise<any[]> {
    const { entityDependencyService } = await import('./entity-dependency-service');
    return entityDependencyService.getTaskDependencies(taskIds);
  }
  
  /**
   * Get dependencies where these tasks are predecessors
   */
  async getDependenciesForTasks(taskIds: string[]): Promise<any[]> {
    const { entityDependencyService } = await import('./entity-dependency-service');
    return entityDependencyService.getDependenciesForEntities('Task', taskIds);
  }
  
  /**
   * Get dependencies for a single task
   */
  async getDependenciesForTask(taskId: string): Promise<any[]> {
    const { entityDependencyService } = await import('./entity-dependency-service');
    return entityDependencyService.getDependenciesForEntity('Task', taskId);
  }
  
  /**
   * Get dependents for a single task (tasks that depend on this task)
   */
  async getDependentsForTask(taskId: string): Promise<any[]> {
    const { entityDependencyService } = await import('./entity-dependency-service');
    return entityDependencyService.getDependentsForEntity('Task', taskId);
  }
  
  /**
   * Create a task dependency
   */
  async createTaskDependency(
    predecessorTaskId: string, 
    successorTaskId: string, 
    type?: any,
    lagDays?: number,
    metadata?: Record<string, any>
  ): Promise<any> {
    const { entityDependencyService } = await import('./entity-dependency-service');
    return entityDependencyService.createTaskDependency(predecessorTaskId, successorTaskId, type, lagDays, metadata);
  }
  
  /**
   * Check if a dependency exists between two tasks
   */
  async taskDependencyExists(predecessorTaskId: string, successorTaskId: string): Promise<boolean> {
    const { entityDependencyService } = await import('./entity-dependency-service');
    return entityDependencyService.dependencyExists('Task', predecessorTaskId, successorTaskId);
  }
}

// ============================================================================
// Service Instance
// ============================================================================

export const taskService = new TaskDomainService();