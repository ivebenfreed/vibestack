/**
 * Task Domain Service
 * 
 * Implements task-specific CRUD operations with business logic and sync tracking.
 * Uses the Task entity type from DataForge for full type safety.
 */

import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { nanoid } from 'nanoid';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// ============================================================================
// Input Types
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
    
    const now = new Date().toISOString();
    const task: Task = {
      id: nanoid(),
      title: processedInput.title,
      description: processedInput.description || '',
      // Use legacyStatus for compatibility with existing code
      legacyStatus: processedInput.status || 'open',
      status: processedInput.status || TaskStatus.TODO,
      priority: processedInput.priority || TaskPriority.MEDIUM,
      projectId: processedInput.projectId || null,
      assigneeId: processedInput.assigneeId || null,
      dueDate: processedInput.dueDate || null,
      estimatedDuration: processedInput.estimatedDuration || null,
      actualDuration: null,
      completedAt: null,
      order: processedInput.order || 0,
      blockedReason: null,
      timeRange: null,
      startDate: null,
      legacyTags: [],
      createdAt: now,
      updatedAt: now,
      clientId: nanoid(),
    } as Task;
    
    // Save to Dexie
    await db.tasks.add(task);
    
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
  
  async updateUI(id: string, updates: UpdateTaskInput): Promise<Task> {
    const existing = await db.tasks.get(id);
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
    const finalUpdates: Partial<Task> = {
      ...processedUpdates,
      // Sync legacy status field
      legacyStatus: processedUpdates.status || existing.legacyStatus,
      // Auto-set completedAt when marking as completed
      completedAt: processedUpdates.status === TaskStatus.COMPLETED && !existing.completedAt
        ? new Date().toISOString()
        : processedUpdates.completedAt !== undefined 
          ? processedUpdates.completedAt 
          : existing.completedAt,
    };
    
    // Use base class helper for common update logic
    const updated = await this.performUpdate(id, finalUpdates);
    
    // Call after hook if defined
    if (this.afterUpdate) {
      await this.afterUpdate(updated, existing);
    }
    
    return updated;
  }
  
  async deleteUI(id: string): Promise<boolean> {
    return this.performDelete(id);
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
    const existing = await db.tasks.get(id);
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
    const existing = await db.tasks.get(id);
    if (!existing) {
      return false;
    }
    
    await db.tasks.delete(id);
    console.log('[TaskService] Deleted task from incoming sync', { id });
    
    return true;
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
}