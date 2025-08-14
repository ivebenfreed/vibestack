// Generated EntityDependency CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { EntityDependency } from './client-entities.js';

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

export interface CreateEntityDependencyInput {
  // entityType is required
  // entityType cannot exceed 50 characters
  entityType: string;

  // predecessorId is required
  // predecessorId must be a valid UUID
  // Business rule: foreignKey
  predecessorId: string;

  // successorId is required
  // successorId must be a valid UUID
  // Business rule: foreignKey
  successorId: string;

  // type must be one of: finish-to-start, start-to-start, finish-to-finish, start-to-finish
  type: string;

  lagTime?: string;
  lagDays?: number;
  metadata?: any;
  description?: string;
}

export interface UpdateEntityDependencyInput extends Partial<CreateEntityDependencyInput> {}



// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

/**
 * Validation functions for EntityDependency
 */

export function validateEntityDependencyEntityType(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('entityType is required');
  }

  if (typeof value === 'string' && value.length > 50) {
    errors.push('entityType cannot exceed 50 characters');
  }

  return errors;
}

export function validateEntityDependencyPredecessorId(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('predecessorId is required');
  }

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('predecessorId must be a valid UUID');
  }

  return errors;
}

export function validateEntityDependencySuccessorId(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('successorId is required');
  }

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('successorId must be a valid UUID');
  }

  return errors;
}

export function validateEntityDependencyType(value: any): string[] {
  const errors: string[] = [];

  return errors;
}

export function validateEntityDependencyInput(input: CreateEntityDependencyInput | UpdateEntityDependencyInput): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if ('entityType' in input) {
    const fieldErrors = validateEntityDependencyEntityType(input.entityType);
    if (fieldErrors.length > 0) {
      errors.entityType = fieldErrors;
    }
  }

  if ('predecessorId' in input) {
    const fieldErrors = validateEntityDependencyPredecessorId(input.predecessorId);
    if (fieldErrors.length > 0) {
      errors.predecessorId = fieldErrors;
    }
  }

  if ('successorId' in input) {
    const fieldErrors = validateEntityDependencySuccessorId(input.successorId);
    if (fieldErrors.length > 0) {
      errors.successorId = fieldErrors;
    }
  }

  if ('type' in input) {
    const fieldErrors = validateEntityDependencyType(input.type);
    if (fieldErrors.length > 0) {
      errors.type = fieldErrors;
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
 * Business logic functions for EntityDependency
 */

export function getEntityDependencyDefaults(): Partial<CreateEntityDependencyInput> {
  return {
    type: 'finish-to-start',
  };
}



// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

/**
 * Create EntityDependency from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function createEntityDependencyUI(
  entitydependencyData: CreateEntityDependencyInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<EntityDependency> {
  console.log(`[EntityDependencyFunctions-UI] Creating new entitydependency`);
  
  // Validate input if validation function exists
  try {
    const validation = validateEntityDependencyInput(entitydependencyData);
    if (!validation.isValid) {
      throw new Error(`Invalid entitydependency data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let entitydependencyWithDefaults;
  try {
    entitydependencyWithDefaults = {
      ...getEntityDependencyDefaults(),
      ...entitydependencyData
    };
  } catch (error) {
    // Defaults function might not exist
    entitydependencyWithDefaults = {
      ...entitydependencyData
    };
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database create completes
  
  try {
    // 2. DATABASE: Create in database in background
    const entitydependencyRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const createdEntityDependency = await entitydependencyRepo.save(entitydependencyWithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('entity_dependencies', 'insert', {
        ...createdEntityDependency,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return createdEntityDependency;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Update EntityDependency from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function updateEntityDependencyUI(
  entitydependencyId: string,
  updates: UpdateEntityDependencyInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<EntityDependency> {
  console.log(`[EntityDependencyFunctions-UI] Updating entitydependency ${entitydependencyId.slice(-8)}`);
  
  // Validate input if validation function exists
  try {
    const validation = validateEntityDependencyInput(updates);
    if (!validation.isValid) {
      throw new Error(`Invalid entitydependency update data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current entitydependency for optimistic update
  const currentEntityDependencys = dependencies.atomActions.entitydependencysAtom.get();
  const currentEntityDependency = currentEntityDependencys[entitydependencyId];
  
  if (!currentEntityDependency) {
    throw new Error(`EntityDependency ${entitydependencyId} not found for UI update`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database update completes
  
  try {
    // 2. DATABASE: Update database in background
    const entitydependencyRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Separate many-to-many relationships from regular fields
    // Update all fields using regular update
    await entitydependencyRepo.update(entitydependencyId, updates);
    
    // Load the updated entity without problematic relations to avoid createQueryBuilder issues
    const updatedEntityDependency = await entitydependencyRepo.findOne({ 
      where: { id: entitydependencyId }
    });
    
    if (!updatedEntityDependency) {
      throw new Error(`EntityDependency ${entitydependencyId} not found after database update`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('entity_dependencies', 'update', {
        ...updatedEntityDependency,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updatedEntityDependency;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Delete EntityDependency from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function deleteEntityDependencyUI(
  entitydependencyId: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[EntityDependencyFunctions-UI] Deleting entitydependency ${entitydependencyId.slice(-8)}`);
  
  // Get current entitydependency for potential revert
  const currentEntityDependencys = dependencies.atomActions.entitydependencysAtom.get();
  const entitydependencyToDelete = currentEntityDependencys[entitydependencyId];
  
  if (!entitydependencyToDelete) {
    throw new Error(`EntityDependency ${entitydependencyId} not found for UI delete`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database delete completes
  
  try {
    // 2. DATABASE: Delete from database
    const entitydependencyRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await entitydependencyRepo.delete(entitydependencyId);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(`EntityDependency ${entitydependencyId} could not be deleted from database`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('entity_dependencies', 'delete', {
        id: entitydependencyId,
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
 * Create EntityDependency from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function createEntityDependencyIncoming(
  entitydependencyData: EntityDependency,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<EntityDependency> {
  console.log(`[EntityDependencyFunctions-Incoming] Creating entitydependency ${entitydependencyData.id.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const entitydependencyRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const createdEntityDependency = await entitydependencyRepo.save(entitydependencyData);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return createdEntityDependency;
}

/**
 * Update EntityDependency from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function updateEntityDependencyIncoming(
  entitydependencyId: string,
  updates: Partial<EntityDependency>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<EntityDependency> {
  console.log(`[EntityDependencyFunctions-Incoming] Updating entitydependency ${entitydependencyId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const entitydependencyRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await entitydependencyRepo.update(entitydependencyId, updates);
  const updatedEntityDependency = await entitydependencyRepo.findOne({ where: { id: entitydependencyId } });
  
  if (!updatedEntityDependency) {
    throw new Error(`EntityDependency ${entitydependencyId} not found after incoming update`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updatedEntityDependency;
}

/**
 * Delete EntityDependency from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function deleteEntityDependencyIncoming(
  entitydependencyId: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[EntityDependencyFunctions-Incoming] Deleting entitydependency ${entitydependencyId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const entitydependencyRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await entitydependencyRepo.delete(entitydependencyId);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}



// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

/**
 * Create EntityDependency from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function createEntityDependencyLiveChanges(
  entitydependencyData: EntityDependency,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[EntityDependencyFunctions-LiveChanges] Reflecting entitydependency ${entitydependencyData.id.slice(-8)} database create in atom`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.createEntityDependencyAtomOnly(entitydependencyData);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update EntityDependency from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function updateEntityDependencyLiveChanges(
  entitydependencyId: string,
  updates: Partial<EntityDependency>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[EntityDependencyFunctions-LiveChanges] Reflecting entitydependency ${entitydependencyId.slice(-8)} database change in atom`);
  
  // ATOM ONLY: Update atom to reflect database change
  const currentEntityDependencys = dependencies.atomActions.entitydependencysAtom.get();
  const currentEntityDependency = currentEntityDependencys[entitydependencyId];
  
  if (!currentEntityDependency) {
    console.warn(`[EntityDependencyFunctions-LiveChanges] EntityDependency ${entitydependencyId} not found in atom for live update`);
    return;
  }
  
  const updatedEntityDependency = { ...currentEntityDependency, ...updates };
  dependencies.atomActions.updateEntityDependencyAtomOnly(entitydependencyId, updatedEntityDependency);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete EntityDependency from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function deleteEntityDependencyLiveChanges(
  entitydependencyId: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[EntityDependencyFunctions-LiveChanges] Reflecting entitydependency ${entitydependencyId.slice(-8)} database delete in atom`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.deleteEntityDependencyAtomOnly(entitydependencyId);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}


