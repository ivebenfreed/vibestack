/**
 * Task Domain Service
 * 
 * Implements task-specific CRUD operations with business logic and sync tracking.
 * Uses the Task entity type from DataForge for full type safety.
 */

import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { taskDexieService } from '@repo/dataforge/dexie-domain';
import type { CreateTaskInput, UpdateTaskInput } from '@repo/dataforge/task-operations';
import { nanoid } from 'nanoid';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// Re-export types from DataForge
export type { CreateTaskInput, UpdateTaskInput } from '@repo/dataforge/task-operations';

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
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateTaskInput): Promise<Task> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    // Use generated Dexie service for creation
    const task = await taskDexieService.create(processedInput);
    
    // Track for outgoing sync
    await trackOutgoingChange('tasks', 'insert', task);
    
    console.log('[TaskService] Created task', {
      id: task.id,
      title: task.title,
      trackingSync: true
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
  
  async updateUI(id: string, updates: UpdateTaskInput): Promise<Task> {
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
    const updated = await taskDexieService.update(id, finalUpdates);
    if (!updated) {
      throw new Error(`Failed to update task ${id}`);
    }
    
    // Track for outgoing sync
    await trackOutgoingChange('tasks', 'update', updated);
    
    console.log('[TaskService] Updated task', {
      id: updated.id,
      updates: finalUpdates,
      trackingSync: true
    });
    
    // Call after hook if defined
    if (this.afterUpdate) {
      await this.afterUpdate(updated, existing);
    }
    
    return updated;
  }
  
  async deleteUI(id: string): Promise<boolean> {
    const existing = await taskDexieService.getById(id);
    if (!existing) {
      return false;
    }
    
    // Use generated Dexie service for deletion
    const result = await taskDexieService.delete(id);
    
    if (result) {
      // Track for outgoing sync
      await trackOutgoingChange('tasks', 'delete', { id });
      
      console.log('[TaskService] Deleted task', {
        id,
        trackingSync: true
      });
    }
    
    return result;
  }
  
  // ============================================================================
  // Incoming Operations (no sync tracking)
  // ============================================================================
  
  async createIncoming(task: Task): Promise<Task> {
    await db.tasks.put(task);
    console.log('[TaskService] Created task from incoming sync', {
      id: task.id,
      title: task.title
    });
    return task;
  }
  
  async updateIncoming(id: string, updates: Partial<Task>): Promise<Task> {
    const existing = await taskDexieService.getById(id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }
    
    const updated: Task = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    
    await db.tasks.put(updated);
    console.log('[TaskService] Updated task from incoming sync', {
      id: updated.id,
      updates
    });
    
    return updated;
  }
  
  async deleteIncoming(id: string): Promise<boolean> {
    const result = await taskDexieService.delete(id);
    if (result) {
      console.log('[TaskService] Deleted task from incoming sync', { id });
    }
    return result;
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
   * Bulk create tasks (used by incoming sync)
   */
  async bulkCreateIncoming(tasks: Task[]): Promise<Task[]> {
    if (tasks.length === 0) return [];
    
    await db.tasks.bulkPut(tasks);
    console.log('[TaskService] Bulk created tasks from incoming sync', {
      count: tasks.length
    });
    
    return tasks;
  }
  
  /**
   * Move task to a different project
   */
  async moveToProject(taskId: string, projectId: string | null): Promise<Task> {
    return this.updateUI(taskId, { projectId });
  }
  
  /**
   * Assign task to a user
   */
  async assignTo(taskId: string, userId: string | null): Promise<Task> {
    return this.updateUI(taskId, { assigneeId: userId });
  }
  
  /**
   * Update task status with business logic
   */
  async updateStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return this.updateUI(taskId, { status });
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
    // Track the change for sync
    const task = await taskDexieService.getById(taskId);
    if (task) {
      await trackOutgoingChange('tasks', 'update', task);
    }
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
}