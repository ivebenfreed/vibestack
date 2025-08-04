/**
 * TaskDependency Domain Service
 * 
 * Implements task dependency CRUD operations with business logic and sync tracking.
 * Uses the TaskDependency entity type from DataForge for full type safety.
 */

import { TaskDependency, DependencyType } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { taskdependencyDexieService } from '@repo/dataforge/dexie-domain';
import type { CreateTaskDependencyInput, UpdateTaskDependencyInput } from '@repo/dataforge/taskdependency-operations';
import { nanoid } from 'nanoid';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// Re-export types from DataForge
export type { CreateTaskDependencyInput, UpdateTaskDependencyInput } from '@repo/dataforge/taskdependency-operations';
export { DependencyType };

// ============================================================================
// TaskDependency Domain Service Implementation
// ============================================================================

export class TaskDependencyDomainService extends BaseDomainService<TaskDependency, CreateTaskDependencyInput, UpdateTaskDependencyInput> {
  tableName = 'task_dependencies_scheduling';
  entityName = 'TaskDependency';
  
  protected getTable() {
    return db.task_dependencies_scheduling;
  }
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateTaskDependencyInput): Promise<TaskDependency> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Additional validation for dependencies
    this.validateDependencyInput(input);
    
    // Check for self-dependency
    if (input.predecessorTaskId === input.successorTaskId) {
      throw new Error('A task cannot depend on itself');
    }
    
    // Check for existing dependency
    const existing = await this.getTable()
      .where({ 
        predecessorTaskId: input.predecessorTaskId, 
        successorTaskId: input.successorTaskId 
      })
      .first();
    
    if (existing) {
      throw new Error('This dependency already exists');
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    // Use generated Dexie service for creation
    const dependency = await taskdependencyDexieService.create(processedInput);
    
    // Track for outgoing sync
    await trackOutgoingChange('task_dependencies_scheduling', 'insert', dependency);
    
    console.log('[TaskDependencyService] Created task dependency', {
      id: dependency.id,
      predecessorTaskId: dependency.predecessorTaskId,
      successorTaskId: dependency.successorTaskId,
      type: dependency.type
    });
    
    return dependency;
  }
  
  async updateUI(id: string, updates: UpdateTaskDependencyInput): Promise<TaskDependency> {
    // Get existing dependency
    const existing = await this.getTable().get(id);
    if (!existing) {
      throw new Error(`TaskDependency with id ${id} not found`);
    }
    
    // Validate updates
    if (this.validateUpdate) {
      this.validateUpdate(updates);
    }
    
    // Validate dependency changes
    const newPredecessor = updates.predecessorTaskId || existing.predecessorTaskId;
    const newSuccessor = updates.successorTaskId || existing.successorTaskId;
    
    if (newPredecessor === newSuccessor) {
      throw new Error('A task cannot depend on itself');
    }
    
    // Apply transformations
    const processedUpdates = this.beforeUpdate ? this.beforeUpdate(updates) : updates;
    
    // Use generated Dexie service for update
    const updatedDependency = await taskdependencyDexieService.update(id, processedUpdates);
    
    // Track for outgoing sync
    await trackOutgoingChange('task_dependencies_scheduling', 'update', updatedDependency);
    
    console.log('[TaskDependencyService] Updated task dependency', {
      id,
      updates: processedUpdates
    });
    
    return updatedDependency;
  }
  
  async deleteUI(id: string): Promise<boolean> {
    const existing = await this.getTable().get(id);
    if (!existing) {
      console.log('[TaskDependencyService] TaskDependency not found for deletion', { id });
      return false;
    }
    
    // Use generated Dexie service for deletion
    const success = await taskdependencyDexieService.delete(id);
    
    if (success) {
      // Track for outgoing sync
      await trackOutgoingChange('task_dependencies_scheduling', 'delete', { id });
      
      console.log('[TaskDependencyService] Deleted task dependency', { id });
    }
    
    return success;
  }
  
  // ============================================================================
  // Query Operations (read-only, no sync tracking)
  // ============================================================================
  
  /**
   * Get all dependencies for a specific task (as predecessor)
   */
  async getDependenciesForTask(taskId: string): Promise<TaskDependency[]> {
    return await this.getTable()
      .where('predecessorTaskId')
      .equals(taskId)
      .toArray();
  }
  
  /**
   * Get all tasks that depend on a specific task (as successor)
   */
  async getDependentsForTask(taskId: string): Promise<TaskDependency[]> {
    return await this.getTable()
      .where('successorTaskId')
      .equals(taskId)
      .toArray();
  }
  
  /**
   * Get all dependencies for a set of tasks
   */
  async getDependenciesForTasks(taskIds: string[]): Promise<TaskDependency[]> {
    if (taskIds.length === 0) return [];
    
    const predecessorDeps = await this.getTable()
      .where('predecessorTaskId')
      .anyOf(taskIds)
      .toArray();
      
    const successorDeps = await this.getTable()
      .where('successorTaskId')
      .anyOf(taskIds)
      .toArray();
    
    // Combine and deduplicate
    const allDeps = [...predecessorDeps, ...successorDeps];
    const uniqueDeps = allDeps.filter((dep, index, arr) => 
      arr.findIndex(d => d.id === dep.id) === index
    );
    
    return uniqueDeps;
  }
  
  /**
   * Check if a dependency exists between two tasks
   */
  async dependencyExists(predecessorTaskId: string, successorTaskId: string): Promise<boolean> {
    const existing = await this.getTable()
      .where({ predecessorTaskId, successorTaskId })
      .first();
    
    return !!existing;
  }
  
  /**
   * Get dependencies by type
   */
  async getDependenciesByType(type: DependencyType): Promise<TaskDependency[]> {
    return await this.getTable()
      .where('type')
      .equals(type)
      .toArray();
  }
  
  // ============================================================================
  // Business Logic Helpers
  // ============================================================================
  
  private validateDependencyInput(input: CreateTaskDependencyInput | UpdateTaskDependencyInput) {
    if ('predecessorTaskId' in input && !input.predecessorTaskId) {
      throw new Error('Predecessor task ID is required');
    }
    
    if ('successorTaskId' in input && !input.successorTaskId) {
      throw new Error('Successor task ID is required');
    }
    
    if ('type' in input && input.type && !Object.values(DependencyType).includes(input.type)) {
      throw new Error(`Invalid dependency type: ${input.type}`);
    }
    
    if ('lagDays' in input && input.lagDays !== undefined) {
      if (!Number.isInteger(input.lagDays)) {
        throw new Error('Lag days must be an integer');
      }
    }
  }
  
  /**
   * Client-side cycle detection (basic implementation)
   * Note: For robust cycle detection, rely on server-side validation
   */
  async wouldCreateCycle(predecessorTaskId: string, successorTaskId: string): Promise<boolean> {
    // Basic implementation: check if successorTask already depends on predecessorTask
    const existingPath = await this.findDependencyPath(successorTaskId, predecessorTaskId);
    return existingPath.length > 0;
  }
  
  /**
   * Find dependency path between two tasks (simple BFS)
   */
  private async findDependencyPath(fromTaskId: string, toTaskId: string, visited = new Set<string>()): Promise<string[]> {
    if (visited.has(fromTaskId)) return []; // Avoid infinite loops
    if (fromTaskId === toTaskId) return [fromTaskId];
    
    visited.add(fromTaskId);
    
    // Get all tasks that fromTask depends on (predecessors)
    const dependencies = await this.getDependenciesForTask(fromTaskId);
    
    for (const dep of dependencies) {
      const path = await this.findDependencyPath(dep.successorTaskId, toTaskId, new Set(visited));
      if (path.length > 0) {
        return [fromTaskId, ...path];
      }
    }
    
    return [];
  }
}

// ============================================================================
// Service Instance
// ============================================================================

export const taskDependencyService = new TaskDependencyDomainService();