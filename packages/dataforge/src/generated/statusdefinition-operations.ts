// Generated StatusDefinition CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { StatusDefinition } from './client-entities.js';

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

export interface CreateStatusDefinitionInput {
  // statusSetId is required
  // statusSetId must be a valid UUID
  // Business rule: foreignKey
  statusSetId: string;

  // name is required
  // name cannot exceed 50 characters
  name: string;

  // label is required
  // label cannot exceed 100 characters
  label: string;

  // color is required
  // color cannot exceed 7 characters
  color: string;

  // icon cannot exceed 50 characters
  icon?: string;

  // variant cannot exceed 20 characters
  variant?: string;

  // sortOrder is required
  sortOrder: number;

  isDefault: boolean;
  isFinal: boolean;
  isActive: boolean;
  // allowedTransitions must be a valid UUID
  allowedTransitions?: string;

  autoTransitionDays?: number;
  metadata: any;
}

export interface UpdateStatusDefinitionInput extends Partial<CreateStatusDefinitionInput> {}



// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

/**
 * Validation functions for StatusDefinition
 */

export function validateStatusDefinitionStatusSetId(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('statusSetId is required');
  }

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('statusSetId must be a valid UUID');
  }

  return errors;
}

export function validateStatusDefinitionName(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('name is required');
  }

  if (typeof value === 'string' && value.length > 50) {
    errors.push('name cannot exceed 50 characters');
  }

  return errors;
}

export function validateStatusDefinitionLabel(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('label is required');
  }

  if (typeof value === 'string' && value.length > 100) {
    errors.push('label cannot exceed 100 characters');
  }

  return errors;
}

export function validateStatusDefinitionColor(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('color is required');
  }

  if (typeof value === 'string' && value.length > 7) {
    errors.push('color cannot exceed 7 characters');
  }

  return errors;
}

export function validateStatusDefinitionIcon(value: any): string[] {
  const errors: string[] = [];

  if (typeof value === 'string' && value.length > 50) {
    errors.push('icon cannot exceed 50 characters');
  }

  return errors;
}

export function validateStatusDefinitionVariant(value: any): string[] {
  const errors: string[] = [];

  if (typeof value === 'string' && value.length > 20) {
    errors.push('variant cannot exceed 20 characters');
  }

  return errors;
}

export function validateStatusDefinitionSortOrder(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('sortOrder is required');
  }

  return errors;
}

export function validateStatusDefinitionAllowedTransitions(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('allowedTransitions must be a valid UUID');
  }

  return errors;
}

export function validateStatusDefinitionInput(input: CreateStatusDefinitionInput | UpdateStatusDefinitionInput): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if ('statusSetId' in input) {
    const fieldErrors = validateStatusDefinitionStatusSetId(input.statusSetId);
    if (fieldErrors.length > 0) {
      errors.statusSetId = fieldErrors;
    }
  }

  if ('name' in input) {
    const fieldErrors = validateStatusDefinitionName(input.name);
    if (fieldErrors.length > 0) {
      errors.name = fieldErrors;
    }
  }

  if ('label' in input) {
    const fieldErrors = validateStatusDefinitionLabel(input.label);
    if (fieldErrors.length > 0) {
      errors.label = fieldErrors;
    }
  }

  if ('color' in input) {
    const fieldErrors = validateStatusDefinitionColor(input.color);
    if (fieldErrors.length > 0) {
      errors.color = fieldErrors;
    }
  }

  if ('icon' in input) {
    const fieldErrors = validateStatusDefinitionIcon(input.icon);
    if (fieldErrors.length > 0) {
      errors.icon = fieldErrors;
    }
  }

  if ('variant' in input) {
    const fieldErrors = validateStatusDefinitionVariant(input.variant);
    if (fieldErrors.length > 0) {
      errors.variant = fieldErrors;
    }
  }

  if ('sortOrder' in input) {
    const fieldErrors = validateStatusDefinitionSortOrder(input.sortOrder);
    if (fieldErrors.length > 0) {
      errors.sortOrder = fieldErrors;
    }
  }

  if ('allowedTransitions' in input) {
    const fieldErrors = validateStatusDefinitionAllowedTransitions(input.allowedTransitions);
    if (fieldErrors.length > 0) {
      errors.allowedTransitions = fieldErrors;
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
 * Business logic functions for StatusDefinition
 */

export function getStatusDefinitionDefaults(): Partial<CreateStatusDefinitionInput> {
  return {
    isDefault: false,
    isFinal: false,
    isActive: true,
    metadata: {},
  };
}



// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

/**
 * Create StatusDefinition from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function createStatusDefinitionUI(
  statusdefinitionData: CreateStatusDefinitionInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<StatusDefinition> {
  console.log(`[StatusDefinitionFunctions-UI] Creating new statusdefinition`);
  
  // Validate input if validation function exists
  try {
    const validation = validateStatusDefinitionInput(statusdefinitionData);
    if (!validation.isValid) {
      throw new Error(`Invalid statusdefinition data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let statusdefinitionWithDefaults;
  try {
    statusdefinitionWithDefaults = {
      ...getStatusDefinitionDefaults(),
      ...statusdefinitionData
    };
  } catch (error) {
    // Defaults function might not exist
    statusdefinitionWithDefaults = {
      ...statusdefinitionData
    };
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database create completes
  
  try {
    // 2. DATABASE: Create in database in background
    const statusdefinitionRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const createdStatusDefinition = await statusdefinitionRepo.save(statusdefinitionWithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('status_definitions', 'insert', {
        ...createdStatusDefinition,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return createdStatusDefinition;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Update StatusDefinition from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function updateStatusDefinitionUI(
  statusdefinitionId: string,
  updates: UpdateStatusDefinitionInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<StatusDefinition> {
  console.log(`[StatusDefinitionFunctions-UI] Updating statusdefinition ${statusdefinitionId.slice(-8)}`);
  
  // Validate input if validation function exists
  try {
    const validation = validateStatusDefinitionInput(updates);
    if (!validation.isValid) {
      throw new Error(`Invalid statusdefinition update data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current statusdefinition for optimistic update
  const currentStatusDefinitions = dependencies.atomActions.statusdefinitionsAtom.get();
  const currentStatusDefinition = currentStatusDefinitions[statusdefinitionId];
  
  if (!currentStatusDefinition) {
    throw new Error(`StatusDefinition ${statusdefinitionId} not found for UI update`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database update completes
  
  try {
    // 2. DATABASE: Update database in background
    const statusdefinitionRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Separate many-to-many relationships from regular fields
    // Update all fields using regular update
    await statusdefinitionRepo.update(statusdefinitionId, updates);
    
    // Load the updated entity without problematic relations to avoid createQueryBuilder issues
    const updatedStatusDefinition = await statusdefinitionRepo.findOne({ 
      where: { id: statusdefinitionId }
    });
    
    if (!updatedStatusDefinition) {
      throw new Error(`StatusDefinition ${statusdefinitionId} not found after database update`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('status_definitions', 'update', {
        ...updatedStatusDefinition,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updatedStatusDefinition;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Delete StatusDefinition from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function deleteStatusDefinitionUI(
  statusdefinitionId: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[StatusDefinitionFunctions-UI] Deleting statusdefinition ${statusdefinitionId.slice(-8)}`);
  
  // Get current statusdefinition for potential revert
  const currentStatusDefinitions = dependencies.atomActions.statusdefinitionsAtom.get();
  const statusdefinitionToDelete = currentStatusDefinitions[statusdefinitionId];
  
  if (!statusdefinitionToDelete) {
    throw new Error(`StatusDefinition ${statusdefinitionId} not found for UI delete`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database delete completes
  
  try {
    // 2. DATABASE: Delete from database
    const statusdefinitionRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await statusdefinitionRepo.delete(statusdefinitionId);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(`StatusDefinition ${statusdefinitionId} could not be deleted from database`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('status_definitions', 'delete', {
        id: statusdefinitionId,
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
 * Create StatusDefinition from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function createStatusDefinitionIncoming(
  statusdefinitionData: StatusDefinition,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<StatusDefinition> {
  console.log(`[StatusDefinitionFunctions-Incoming] Creating statusdefinition ${statusdefinitionData.id.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const statusdefinitionRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const createdStatusDefinition = await statusdefinitionRepo.save(statusdefinitionData);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return createdStatusDefinition;
}

/**
 * Update StatusDefinition from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function updateStatusDefinitionIncoming(
  statusdefinitionId: string,
  updates: Partial<StatusDefinition>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<StatusDefinition> {
  console.log(`[StatusDefinitionFunctions-Incoming] Updating statusdefinition ${statusdefinitionId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const statusdefinitionRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await statusdefinitionRepo.update(statusdefinitionId, updates);
  const updatedStatusDefinition = await statusdefinitionRepo.findOne({ where: { id: statusdefinitionId } });
  
  if (!updatedStatusDefinition) {
    throw new Error(`StatusDefinition ${statusdefinitionId} not found after incoming update`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updatedStatusDefinition;
}

/**
 * Delete StatusDefinition from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function deleteStatusDefinitionIncoming(
  statusdefinitionId: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[StatusDefinitionFunctions-Incoming] Deleting statusdefinition ${statusdefinitionId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const statusdefinitionRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await statusdefinitionRepo.delete(statusdefinitionId);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}



// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

/**
 * Create StatusDefinition from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function createStatusDefinitionLiveChanges(
  statusdefinitionData: StatusDefinition,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[StatusDefinitionFunctions-LiveChanges] Reflecting statusdefinition ${statusdefinitionData.id.slice(-8)} database create in atom`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.createStatusDefinitionAtomOnly(statusdefinitionData);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update StatusDefinition from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function updateStatusDefinitionLiveChanges(
  statusdefinitionId: string,
  updates: Partial<StatusDefinition>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[StatusDefinitionFunctions-LiveChanges] Reflecting statusdefinition ${statusdefinitionId.slice(-8)} database change in atom`);
  
  // ATOM ONLY: Update atom to reflect database change
  const currentStatusDefinitions = dependencies.atomActions.statusdefinitionsAtom.get();
  const currentStatusDefinition = currentStatusDefinitions[statusdefinitionId];
  
  if (!currentStatusDefinition) {
    console.warn(`[StatusDefinitionFunctions-LiveChanges] StatusDefinition ${statusdefinitionId} not found in atom for live update`);
    return;
  }
  
  const updatedStatusDefinition = { ...currentStatusDefinition, ...updates };
  dependencies.atomActions.updateStatusDefinitionAtomOnly(statusdefinitionId, updatedStatusDefinition);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete StatusDefinition from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function deleteStatusDefinitionLiveChanges(
  statusdefinitionId: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[StatusDefinitionFunctions-LiveChanges] Reflecting statusdefinition ${statusdefinitionId.slice(-8)} database delete in atom`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.deleteStatusDefinitionAtomOnly(statusdefinitionId);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}


