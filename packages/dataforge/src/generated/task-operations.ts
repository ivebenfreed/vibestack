// Generated Task CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { Task } from './client-entities.js';
import { TaskPriority } from './client-entities.js';

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

export interface CreateTaskInput {
  // title is required
  // title cannot exceed 100 characters
  title: string;

  description?: string;
  // legacyStatus must be one of: open, in_progress, completed
  legacyStatus?: string;

  // statusId must be a valid UUID
  // Business rule: foreignKey
  statusId?: string;

  // priority must be one of: low, medium, high
  // Business rule: permissions
  // Business rule: auditLog
  priority: TaskPriority;

  // dueDate must be a valid date
  dueDate?: Date;

  // startDate must be a valid date
  startDate?: Date;

  // completedAt must be a valid date
  completedAt?: Date;

  timeRange?: string;
  estimatedDuration?: string;
  legacyTags?: string[];
  // projectId must be a valid UUID
  // Business rule: foreignKey
  projectId?: string;

  // assigneeId must be a valid UUID
  // Business rule: foreignKey
  assigneeId?: string;

}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {}



// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

/**
 * Validation functions for Task
 */

export function validateTaskTitle(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('title is required');
  }

  if (typeof value === 'string' && value.length > 100) {
    errors.push('title cannot exceed 100 characters');
  }

  return errors;
}

export function validateTaskLegacyStatus(value: any): string[] {
  const errors: string[] = [];

  return errors;
}

export function validateTaskStatusId(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('statusId must be a valid UUID');
  }

  return errors;
}

export function validateTaskPriority(value: any): string[] {
  const errors: string[] = [];

  if (value && !['low', 'medium', 'high'].includes(value)) {
    errors.push('priority must be one of: low, medium, high');
  }

  return errors;
}

export function validateTaskDueDate(value: any): string[] {
  const errors: string[] = [];

  return errors;
}

export function validateTaskStartDate(value: any): string[] {
  const errors: string[] = [];

  return errors;
}

export function validateTaskCompletedAt(value: any): string[] {
  const errors: string[] = [];

  return errors;
}

export function validateTaskProjectId(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('projectId must be a valid UUID');
  }

  return errors;
}

export function validateTaskAssigneeId(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('assigneeId must be a valid UUID');
  }

  return errors;
}

export function validateTaskInput(input: CreateTaskInput | UpdateTaskInput): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if ('title' in input) {
    const fieldErrors = validateTaskTitle(input.title);
    if (fieldErrors.length > 0) {
      errors.title = fieldErrors;
    }
  }

  if ('legacyStatus' in input) {
    const fieldErrors = validateTaskLegacyStatus(input.legacyStatus);
    if (fieldErrors.length > 0) {
      errors.legacyStatus = fieldErrors;
    }
  }

  if ('statusId' in input) {
    const fieldErrors = validateTaskStatusId(input.statusId);
    if (fieldErrors.length > 0) {
      errors.statusId = fieldErrors;
    }
  }

  if ('priority' in input) {
    const fieldErrors = validateTaskPriority(input.priority);
    if (fieldErrors.length > 0) {
      errors.priority = fieldErrors;
    }
  }

  if ('dueDate' in input) {
    const fieldErrors = validateTaskDueDate(input.dueDate);
    if (fieldErrors.length > 0) {
      errors.dueDate = fieldErrors;
    }
  }

  if ('startDate' in input) {
    const fieldErrors = validateTaskStartDate(input.startDate);
    if (fieldErrors.length > 0) {
      errors.startDate = fieldErrors;
    }
  }

  if ('completedAt' in input) {
    const fieldErrors = validateTaskCompletedAt(input.completedAt);
    if (fieldErrors.length > 0) {
      errors.completedAt = fieldErrors;
    }
  }

  if ('projectId' in input) {
    const fieldErrors = validateTaskProjectId(input.projectId);
    if (fieldErrors.length > 0) {
      errors.projectId = fieldErrors;
    }
  }

  if ('assigneeId' in input) {
    const fieldErrors = validateTaskAssigneeId(input.assigneeId);
    if (fieldErrors.length > 0) {
      errors.assigneeId = fieldErrors;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}



// ============================================================================
// Business Logic Functions - Generated from entity business rules
// ============================================================================

/**
 * Business logic functions for Task
 */

export function getTaskDefaults(): Partial<CreateTaskInput> {
  return {
    legacyStatus: 'open',
    priority: TaskPriority.MEDIUM,
    legacyTags: [],
  };
}

export function getTaskRequiredPermissions(operation: 'create' | 'update' | 'delete', fieldName?: string): string[] {
  const permissions: string[] = [];

  if (operation === 'create' || operation === 'update') {
    switch (fieldName) {
      case 'priority':
        permissions.push(...["task:update:priority"]);
        break;
    }
  }

  return permissions;
}



// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

/**
 * Create Task from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function createTaskUI(
  taskData: CreateTaskInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<Task> {
  console.log(`[TaskFunctions-UI] Creating new task`);
  
  // Validate input if validation function exists
  try {
    const validation = validateTaskInput(taskData);
    if (!validation.isValid) {
      throw new Error(`Invalid task data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let taskWithDefaults;
  try {
    taskWithDefaults = {
      ...getTaskDefaults(),
      ...taskData
    };
  } catch (error) {
    // Defaults function might not exist
    taskWithDefaults = {
      ...taskData
    };
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database create completes
  
  try {
    // 2. DATABASE: Create in database in background
    const taskRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const createdTask = await taskRepo.save(taskWithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('tasks', 'insert', {
        ...createdTask,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return createdTask;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Update Task from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function updateTaskUI(
  taskId: string,
  updates: UpdateTaskInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<Task> {
  console.log(`[TaskFunctions-UI] Updating task ${taskId.slice(-8)}`);
  
  // Validate input if validation function exists
  try {
    const validation = validateTaskInput(updates);
    if (!validation.isValid) {
      throw new Error(`Invalid task update data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current task for optimistic update
  const currentTasks = dependencies.atomActions.tasksAtom.get();
  const currentTask = currentTasks[taskId];
  
  if (!currentTask) {
    throw new Error(`Task ${taskId} not found for UI update`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database update completes
  
  try {
    // 2. DATABASE: Update database in background
    const taskRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Separate many-to-many relationships from regular fields
    // Separate many-to-many relationships from regular fields
    const { tags, dependencies: dependenciesField, tasksDependentOnThis, ...regularUpdates } = updates as any;
    
    // Update regular fields if any
    if (Object.keys(regularUpdates).length > 0) {
      await taskRepo.update(taskId, regularUpdates);
    }
    
    // Handle many-to-many relationships using direct junction table manipulation
    
    if (tags !== undefined) {
      // Clear existing relations first
      await taskRepo
        .createQueryBuilder()
        .delete()
        .from('task_tags')
        .where('"taskId" = :taskId', { taskId })
        .execute();
      
      // Add new relations if any
      if (tags && tags.length > 0) {
        const relatedIds = tags.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['taskId']: taskId, 
          ['tagId']: relatedId 
        }));
        await taskRepo
          .createQueryBuilder()
          .insert()
          .into('task_tags')
          .values(values)
          .execute();
      }
    }
    if (dependenciesField !== undefined) {
      // Clear existing relations first
      await taskRepo
        .createQueryBuilder()
        .delete()
        .from('task_dependencies')
        .where('"dependentTaskId" = :taskId', { taskId })
        .execute();
      
      // Add new relations if any
      if (dependenciesField && dependenciesField.length > 0) {
        const relatedIds = dependenciesField.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['dependentTaskId']: taskId, 
          ['dependencyTaskId']: relatedId 
        }));
        await taskRepo
          .createQueryBuilder()
          .insert()
          .into('task_dependencies')
          .values(values)
          .execute();
      }
    }
    if (tasksDependentOnThis !== undefined) {
      // Clear existing relations first
      await taskRepo
        .createQueryBuilder()
        .delete()
        .from('task_dependencies')
        .where('"dependencyTaskId" = :taskId', { taskId })
        .execute();
      
      // Add new relations if any
      if (tasksDependentOnThis && tasksDependentOnThis.length > 0) {
        const relatedIds = tasksDependentOnThis.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['dependencyTaskId']: taskId, 
          ['dependentTaskId']: relatedId 
        }));
        await taskRepo
          .createQueryBuilder()
          .insert()
          .into('task_dependencies')
          .values(values)
          .execute();
      }
    }
    
    // Load the updated entity without problematic relations to avoid createQueryBuilder issues
    const updatedTask = await taskRepo.findOne({ 
      where: { id: taskId }
    });
    
    if (!updatedTask) {
      throw new Error(`Task ${taskId} not found after database update`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('tasks', 'update', {
        ...updatedTask,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updatedTask;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Delete Task from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function deleteTaskUI(
  taskId: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[TaskFunctions-UI] Deleting task ${taskId.slice(-8)}`);
  
  // Get current task for potential revert
  const currentTasks = dependencies.atomActions.tasksAtom.get();
  const taskToDelete = currentTasks[taskId];
  
  if (!taskToDelete) {
    throw new Error(`Task ${taskId} not found for UI delete`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database delete completes
  
  try {
    // 2. DATABASE: Delete from database
    const taskRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await taskRepo.delete(taskId);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(`Task ${taskId} could not be deleted from database`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('tasks', 'delete', {
        id: taskId,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return true;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}



// ============================================================================
// 2. INCOMING PATH - Server sync data (Database → Live changes trigger atom)
// ============================================================================

/**
 * Create Task from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function createTaskIncoming(
  taskData: Task,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<Task> {
  console.log(`[TaskFunctions-Incoming] Creating task ${taskData.id.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const taskRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const createdTask = await taskRepo.save(taskData);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return createdTask;
}

/**
 * Update Task from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function updateTaskIncoming(
  taskId: string,
  updates: Partial<Task>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<Task> {
  console.log(`[TaskFunctions-Incoming] Updating task ${taskId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const taskRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await taskRepo.update(taskId, updates);
  const updatedTask = await taskRepo.findOne({ where: { id: taskId } });
  
  if (!updatedTask) {
    throw new Error(`Task ${taskId} not found after incoming update`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updatedTask;
}

/**
 * Delete Task from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function deleteTaskIncoming(
  taskId: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[TaskFunctions-Incoming] Deleting task ${taskId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const taskRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await taskRepo.delete(taskId);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}



// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

/**
 * Create Task from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function createTaskLiveChanges(
  taskData: Task,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[TaskFunctions-LiveChanges] Reflecting task ${taskData.id.slice(-8)} database create in atom`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.createTaskAtomOnly(taskData);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update Task from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function updateTaskLiveChanges(
  taskId: string,
  updates: Partial<Task>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[TaskFunctions-LiveChanges] Reflecting task ${taskId.slice(-8)} database change in atom`);
  
  // ATOM ONLY: Update atom to reflect database change
  const currentTasks = dependencies.atomActions.tasksAtom.get();
  const currentTask = currentTasks[taskId];
  
  if (!currentTask) {
    console.warn(`[TaskFunctions-LiveChanges] Task ${taskId} not found in atom for live update`);
    return;
  }
  
  const updatedTask = { ...currentTask, ...updates };
  dependencies.atomActions.updateTaskAtomOnly(taskId, updatedTask);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete Task from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function deleteTaskLiveChanges(
  taskId: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[TaskFunctions-LiveChanges] Reflecting task ${taskId.slice(-8)} database delete in atom`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.deleteTaskAtomOnly(taskId);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}


