/**
 * EntityDependency Domain Service
 * 
 * Implements generic entity dependency CRUD operations with business logic and sync tracking.
 * Uses the EntityDependency entity type from DataForge for full type safety.
 */

import { EntityDependency, DependencyType } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { entitydependencyDexieService } from '@repo/dataforge/dexie-domain';
// Define input types locally since operations may not be generated yet
export type CreateEntityDependencyInput = {
  entityType: string;
  predecessorId: string;
  successorId: string;
  type?: DependencyType;
  lagTime?: string;
  lagDays?: number;
  metadata?: Record<string, any>;
  description?: string;
};

export type UpdateEntityDependencyInput = Partial<Omit<CreateEntityDependencyInput, 'entityType'>>;
import { nanoid } from 'nanoid';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// Re-export types
export { DependencyType };

// ============================================================================
// EntityDependency Domain Service Implementation
// ============================================================================

export class EntityDependencyDomainService extends BaseDomainService<EntityDependency, CreateEntityDependencyInput, UpdateEntityDependencyInput> {
  tableName = 'entity_dependencies';
  entityName = 'EntityDependency';
  
  protected getTable() {
    return db.entity_dependencies;
  }
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateEntityDependencyInput): Promise<EntityDependency> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Additional validation for dependencies
    this.validateDependencyInput(input);
    
    // Check for self-dependency
    if (input.predecessorId === input.successorId) {
      throw new Error('An entity cannot depend on itself');
    }
    
    // Check for existing dependency
    const existing = await this.getTable()
      .where({ 
        entityType: input.entityType,
        predecessorId: input.predecessorId, 
        successorId: input.successorId 
      })
      .first();
    
    if (existing) {
      throw new Error('This dependency already exists');
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    // Use generated Dexie service for creation
    const dependency = await entitydependencyDexieService.create(processedInput);
    
    // Track for outgoing sync
    await trackOutgoingChange('entity_dependencies', 'insert', dependency);
    
    console.log('[EntityDependencyService] Created entity dependency', {
      id: dependency.id,
      entityType: dependency.entityType,
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type
    });
    
    return dependency;
  }
  
  async updateUI(id: string, updates: UpdateEntityDependencyInput): Promise<EntityDependency> {
    // Get existing dependency
    const existing = await this.getTable().get(id);
    if (!existing) {
      throw new Error(`EntityDependency with id ${id} not found`);
    }
    
    // Validate updates
    if (this.validateUpdate) {
      this.validateUpdate(id, updates);
    }
    
    // Validate dependency changes
    const newPredecessor = updates.predecessorId || existing.predecessorId;
    const newSuccessor = updates.successorId || existing.successorId;
    
    if (newPredecessor === newSuccessor) {
      throw new Error('An entity cannot depend on itself');
    }
    
    // Apply transformations
    const processedUpdates = this.beforeUpdate ? this.beforeUpdate(id, updates, existing) : updates;
    
    // Use generated Dexie service for update
    const updatedDependency = await entitydependencyDexieService.update(id, processedUpdates);
    if (!updatedDependency) {
      throw new Error(`Failed to update entity dependency ${id}`);
    }
    
    // Track for outgoing sync
    await trackOutgoingChange('entity_dependencies', 'update', updatedDependency);
    
    console.log('[EntityDependencyService] Updated entity dependency', {
      id,
      updates: processedUpdates
    });
    
    return updatedDependency;
  }
  
  async deleteUI(id: string): Promise<boolean> {
    const existing = await this.getTable().get(id);
    if (!existing) {
      console.log('[EntityDependencyService] EntityDependency not found for deletion', { id });
      return false;
    }
    
    // Use generated Dexie service for deletion
    const success = await entitydependencyDexieService.delete(id);
    
    if (success) {
      // Track for outgoing sync
      await trackOutgoingChange('entity_dependencies', 'delete', { id });
      
      console.log('[EntityDependencyService] Deleted entity dependency', { id });
    }
    
    return success;
  }
  
  // ============================================================================
  // Query Operations (read-only, no sync tracking)
  // ============================================================================
  
  /**
   * Get all dependencies for a specific entity (as predecessor)
   */
  async getDependenciesForEntity(entityType: string, entityId: string): Promise<EntityDependency[]> {
    return await this.getTable()
      .where({ entityType, predecessorId: entityId })
      .toArray();
  }
  
  /**
   * Get all entities that depend on a specific entity (as successor)
   */
  async getDependentsForEntity(entityType: string, entityId: string): Promise<EntityDependency[]> {
    return await this.getTable()
      .where({ entityType, successorId: entityId })
      .toArray();
  }
  
  /**
   * Get all dependencies for a set of entities
   */
  async getDependenciesForEntities(entityType: string, entityIds: string[]): Promise<EntityDependency[]> {
    if (entityIds.length === 0) return [];
    
    const predecessorDeps = await this.getTable()
      .where('entityType').equals(entityType)
      .and(dep => entityIds.includes(dep.predecessorId))
      .toArray();
      
    const successorDeps = await this.getTable()
      .where('entityType').equals(entityType)
      .and(dep => entityIds.includes(dep.successorId))
      .toArray();
    
    // Combine and deduplicate
    const allDeps = [...predecessorDeps, ...successorDeps];
    const uniqueDeps = allDeps.filter((dep, index, arr) => 
      arr.findIndex(d => d.id === dep.id) === index
    );
    
    return uniqueDeps;
  }
  
  /**
   * Check if a dependency exists between two entities
   */
  async dependencyExists(entityType: string, predecessorId: string, successorId: string): Promise<boolean> {
    const existing = await this.getTable()
      .where({ entityType, predecessorId, successorId })
      .first();
    
    return !!existing;
  }
  
  /**
   * Get dependencies by type for a specific entity type
   */
  async getDependenciesByType(entityType: string, depType: DependencyType): Promise<EntityDependency[]> {
    return await this.getTable()
      .where({ entityType, type: depType })
      .toArray();
  }
  
  // ============================================================================
  // Task-specific helper methods
  // ============================================================================
  
  /**
   * Get all task dependencies (convenience method for Gantt chart)
   */
  async getTaskDependencies(taskIds?: string[]): Promise<EntityDependency[]> {
    if (taskIds && taskIds.length > 0) {
      return this.getDependenciesForEntities('Task', taskIds);
    }
    
    return await this.getTable()
      .where('entityType')
      .equals('Task')
      .toArray();
  }
  
  /**
   * Create a task dependency (convenience method)
   */
  async createTaskDependency(
    predecessorTaskId: string, 
    successorTaskId: string, 
    type: DependencyType = DependencyType.FINISH_TO_START,
    lagDays?: number,
    metadata?: Record<string, any>
  ): Promise<EntityDependency> {
    return this.createUI({
      entityType: 'Task',
      predecessorId: predecessorTaskId,
      successorId: successorTaskId,
      type,
      lagDays,
      metadata
    });
  }
  
  // ============================================================================
  // Business Logic Helpers
  // ============================================================================
  
  private validateDependencyInput(input: CreateEntityDependencyInput | UpdateEntityDependencyInput) {
    if ('entityType' in input && !input.entityType) {
      throw new Error('Entity type is required');
    }
    
    if ('predecessorId' in input && !input.predecessorId) {
      throw new Error('Predecessor ID is required');
    }
    
    if ('successorId' in input && !input.successorId) {
      throw new Error('Successor ID is required');
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
  async wouldCreateCycle(entityType: string, predecessorId: string, successorId: string): Promise<boolean> {
    // Basic implementation: check if successor already depends on predecessor
    const existingPath = await this.findDependencyPath(entityType, successorId, predecessorId);
    return existingPath.length > 0;
  }
  
  /**
   * Find dependency path between two entities (simple BFS)
   */
  private async findDependencyPath(
    entityType: string, 
    fromEntityId: string, 
    toEntityId: string, 
    visited = new Set<string>()
  ): Promise<string[]> {
    if (visited.has(fromEntityId)) return []; // Avoid infinite loops
    if (fromEntityId === toEntityId) return [fromEntityId];
    
    visited.add(fromEntityId);
    
    // Get all entities that fromEntity depends on (predecessors)
    const dependencies = await this.getDependenciesForEntity(entityType, fromEntityId);
    
    for (const dep of dependencies) {
      const path = await this.findDependencyPath(entityType, dep.successorId, toEntityId, new Set(visited));
      if (path.length > 0) {
        return [fromEntityId, ...path];
      }
    }
    
    return [];
  }
  
  // ============================================================================
  // Lifecycle Hooks
  // ============================================================================
  
  protected beforeCreate(input: CreateEntityDependencyInput): CreateEntityDependencyInput {
    return {
      ...input,
      // Default to finish-to-start if not specified
      type: input.type || DependencyType.FINISH_TO_START,
      // Default lag days to 0 if not specified
      lagDays: input.lagDays ?? 0,
    };
  }
}

// ============================================================================
// Service Instance
// ============================================================================

export const entityDependencyService = new EntityDependencyDomainService();