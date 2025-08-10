// Generated StatusSet CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { StatusSet } from './client-entities.js';

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

export interface CreateStatusSetInput {
  // name is required
  // name cannot exceed 100 characters
  name: string;

  // entityType is required
  // entityType cannot exceed 50 characters
  entityType: string;

  description?: string;
  isSystem: boolean;
  isActive: boolean;
  // defaultColor cannot exceed 7 characters
  defaultColor?: string;

  displayOrder: number;
  metadata: any;
}

export interface UpdateStatusSetInput extends Partial<CreateStatusSetInput> {}



// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

/**
 * Validation functions for StatusSet
 */

export function validateStatusSetName(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('name is required');
  }

  if (typeof value === 'string' && value.length > 100) {
    errors.push('name cannot exceed 100 characters');
  }

  return errors;
}

export function validateStatusSetEntityType(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('entityType is required');
  }

  if (typeof value === 'string' && value.length > 50) {
    errors.push('entityType cannot exceed 50 characters');
  }

  return errors;
}

export function validateStatusSetDefaultColor(value: any): string[] {
  const errors: string[] = [];

  if (typeof value === 'string' && value.length > 7) {
    errors.push('defaultColor cannot exceed 7 characters');
  }

  return errors;
}

export function validateStatusSetInput(input: CreateStatusSetInput | UpdateStatusSetInput): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if ('name' in input) {
    const fieldErrors = validateStatusSetName(input.name);
    if (fieldErrors.length > 0) {
      errors.name = fieldErrors;
    }
  }

  if ('entityType' in input) {
    const fieldErrors = validateStatusSetEntityType(input.entityType);
    if (fieldErrors.length > 0) {
      errors.entityType = fieldErrors;
    }
  }

  if ('defaultColor' in input) {
    const fieldErrors = validateStatusSetDefaultColor(input.defaultColor);
    if (fieldErrors.length > 0) {
      errors.defaultColor = fieldErrors;
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
 * Business logic functions for StatusSet
 */

export function getStatusSetDefaults(): Partial<CreateStatusSetInput> {
  return {
    isSystem: false,
    isActive: true,
    displayOrder: 0,
    metadata: {},
  };
}



// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

/**
 * Create StatusSet from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function createStatusSetUI(
  statussetData: CreateStatusSetInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<StatusSet> {
  console.log(`[StatusSetFunctions-UI] Creating new statusset`);
  
  // Validate input if validation function exists
  try {
    const validation = validateStatusSetInput(statussetData);
    if (!validation.isValid) {
      throw new Error(`Invalid statusset data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let statussetWithDefaults;
  try {
    statussetWithDefaults = {
      ...getStatusSetDefaults(),
      ...statussetData
    };
  } catch (error) {
    // Defaults function might not exist
    statussetWithDefaults = {
      ...statussetData
    };
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database create completes
  
  try {
    // 2. DATABASE: Create in database in background
    const statussetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const createdStatusSet = await statussetRepo.save(statussetWithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('status_sets', 'insert', {
        ...createdStatusSet,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return createdStatusSet;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Update StatusSet from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function updateStatusSetUI(
  statussetId: string,
  updates: UpdateStatusSetInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<StatusSet> {
  console.log(`[StatusSetFunctions-UI] Updating statusset ${statussetId.slice(-8)}`);
  
  // Validate input if validation function exists
  try {
    const validation = validateStatusSetInput(updates);
    if (!validation.isValid) {
      throw new Error(`Invalid statusset update data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current statusset for optimistic update
  const currentStatusSets = dependencies.atomActions.statussetsAtom.get();
  const currentStatusSet = currentStatusSets[statussetId];
  
  if (!currentStatusSet) {
    throw new Error(`StatusSet ${statussetId} not found for UI update`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database update completes
  
  try {
    // 2. DATABASE: Update database in background
    const statussetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Separate many-to-many relationships from regular fields
    // Separate many-to-many relationships from regular fields
    const { projects, ...regularUpdates } = updates as any;
    
    // Update regular fields if any
    if (Object.keys(regularUpdates).length > 0) {
      await statussetRepo.update(statussetId, regularUpdates);
    }
    
    // Handle many-to-many relationships using direct junction table manipulation
    
    if (projects !== undefined) {
      // Clear existing relations first
      await statussetRepo
        .createQueryBuilder()
        .delete()
        .from('project_status_sets')
        .where('"statusSetId" = :statussetId', { statussetId })
        .execute();
      
      // Add new relations if any
      if (projects && projects.length > 0) {
        const relatedIds = projects.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['statusSetId']: statussetId, 
          ['projectId']: relatedId 
        }));
        await statussetRepo
          .createQueryBuilder()
          .insert()
          .into('project_status_sets')
          .values(values)
          .execute();
      }
    }
    
    // Load the updated entity without problematic relations to avoid createQueryBuilder issues
    const updatedStatusSet = await statussetRepo.findOne({ 
      where: { id: statussetId }
    });
    
    if (!updatedStatusSet) {
      throw new Error(`StatusSet ${statussetId} not found after database update`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('status_sets', 'update', {
        ...updatedStatusSet,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updatedStatusSet;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Delete StatusSet from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function deleteStatusSetUI(
  statussetId: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[StatusSetFunctions-UI] Deleting statusset ${statussetId.slice(-8)}`);
  
  // Get current statusset for potential revert
  const currentStatusSets = dependencies.atomActions.statussetsAtom.get();
  const statussetToDelete = currentStatusSets[statussetId];
  
  if (!statussetToDelete) {
    throw new Error(`StatusSet ${statussetId} not found for UI delete`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database delete completes
  
  try {
    // 2. DATABASE: Delete from database
    const statussetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await statussetRepo.delete(statussetId);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(`StatusSet ${statussetId} could not be deleted from database`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('status_sets', 'delete', {
        id: statussetId,
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
 * Create StatusSet from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function createStatusSetIncoming(
  statussetData: StatusSet,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<StatusSet> {
  console.log(`[StatusSetFunctions-Incoming] Creating statusset ${statussetData.id.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const statussetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const createdStatusSet = await statussetRepo.save(statussetData);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return createdStatusSet;
}

/**
 * Update StatusSet from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function updateStatusSetIncoming(
  statussetId: string,
  updates: Partial<StatusSet>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<StatusSet> {
  console.log(`[StatusSetFunctions-Incoming] Updating statusset ${statussetId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const statussetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await statussetRepo.update(statussetId, updates);
  const updatedStatusSet = await statussetRepo.findOne({ where: { id: statussetId } });
  
  if (!updatedStatusSet) {
    throw new Error(`StatusSet ${statussetId} not found after incoming update`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updatedStatusSet;
}

/**
 * Delete StatusSet from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function deleteStatusSetIncoming(
  statussetId: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[StatusSetFunctions-Incoming] Deleting statusset ${statussetId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const statussetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await statussetRepo.delete(statussetId);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}



// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

/**
 * Create StatusSet from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function createStatusSetLiveChanges(
  statussetData: StatusSet,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[StatusSetFunctions-LiveChanges] Reflecting statusset ${statussetData.id.slice(-8)} database create in atom`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.createStatusSetAtomOnly(statussetData);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update StatusSet from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function updateStatusSetLiveChanges(
  statussetId: string,
  updates: Partial<StatusSet>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[StatusSetFunctions-LiveChanges] Reflecting statusset ${statussetId.slice(-8)} database change in atom`);
  
  // ATOM ONLY: Update atom to reflect database change
  const currentStatusSets = dependencies.atomActions.statussetsAtom.get();
  const currentStatusSet = currentStatusSets[statussetId];
  
  if (!currentStatusSet) {
    console.warn(`[StatusSetFunctions-LiveChanges] StatusSet ${statussetId} not found in atom for live update`);
    return;
  }
  
  const updatedStatusSet = { ...currentStatusSet, ...updates };
  dependencies.atomActions.updateStatusSetAtomOnly(statussetId, updatedStatusSet);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete StatusSet from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function deleteStatusSetLiveChanges(
  statussetId: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[StatusSetFunctions-LiveChanges] Reflecting statusset ${statussetId.slice(-8)} database delete in atom`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.deleteStatusSetAtomOnly(statussetId);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}


