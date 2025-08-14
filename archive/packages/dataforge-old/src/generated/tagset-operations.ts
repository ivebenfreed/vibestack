// Generated TagSet CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { TagSet } from './client-entities.js';

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

export interface CreateTagSetInput {
  // name is required
  // name cannot exceed 100 characters
  name: string;

  description?: string;
  // category cannot exceed 50 characters
  category?: string;

  isSystem: boolean;
  isActive: boolean;
  // defaultColor cannot exceed 7 characters
  defaultColor: string;

  displayOrder: number;
  isExclusive: boolean;
  maxTags?: number;
  metadata: any;
}

export interface UpdateTagSetInput extends Partial<CreateTagSetInput> {}



// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

/**
 * Validation functions for TagSet
 */

export function validateTagSetName(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('name is required');
  }

  if (typeof value === 'string' && value.length > 100) {
    errors.push('name cannot exceed 100 characters');
  }

  return errors;
}

export function validateTagSetCategory(value: any): string[] {
  const errors: string[] = [];

  if (typeof value === 'string' && value.length > 50) {
    errors.push('category cannot exceed 50 characters');
  }

  return errors;
}

export function validateTagSetDefaultColor(value: any): string[] {
  const errors: string[] = [];

  if (typeof value === 'string' && value.length > 7) {
    errors.push('defaultColor cannot exceed 7 characters');
  }

  return errors;
}

export function validateTagSetInput(input: CreateTagSetInput | UpdateTagSetInput): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if ('name' in input) {
    const fieldErrors = validateTagSetName(input.name);
    if (fieldErrors.length > 0) {
      errors.name = fieldErrors;
    }
  }

  if ('category' in input) {
    const fieldErrors = validateTagSetCategory(input.category);
    if (fieldErrors.length > 0) {
      errors.category = fieldErrors;
    }
  }

  if ('defaultColor' in input) {
    const fieldErrors = validateTagSetDefaultColor(input.defaultColor);
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
 * Business logic functions for TagSet
 */

export function getTagSetDefaults(): Partial<CreateTagSetInput> {
  return {
    isSystem: false,
    isActive: true,
    defaultColor: '#94a3b8',
    displayOrder: 0,
    isExclusive: false,
    metadata: {},
  };
}



// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

/**
 * Create TagSet from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function createTagSetUI(
  tagsetData: CreateTagSetInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<TagSet> {
  console.log(`[TagSetFunctions-UI] Creating new tagset`);
  
  // Validate input if validation function exists
  try {
    const validation = validateTagSetInput(tagsetData);
    if (!validation.isValid) {
      throw new Error(`Invalid tagset data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let tagsetWithDefaults;
  try {
    tagsetWithDefaults = {
      ...getTagSetDefaults(),
      ...tagsetData
    };
  } catch (error) {
    // Defaults function might not exist
    tagsetWithDefaults = {
      ...tagsetData
    };
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database create completes
  
  try {
    // 2. DATABASE: Create in database in background
    const tagsetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const createdTagSet = await tagsetRepo.save(tagsetWithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('tag_sets', 'insert', {
        ...createdTagSet,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return createdTagSet;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Update TagSet from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function updateTagSetUI(
  tagsetId: string,
  updates: UpdateTagSetInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<TagSet> {
  console.log(`[TagSetFunctions-UI] Updating tagset ${tagsetId.slice(-8)}`);
  
  // Validate input if validation function exists
  try {
    const validation = validateTagSetInput(updates);
    if (!validation.isValid) {
      throw new Error(`Invalid tagset update data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current tagset for optimistic update
  const currentTagSets = dependencies.atomActions.tagsetsAtom.get();
  const currentTagSet = currentTagSets[tagsetId];
  
  if (!currentTagSet) {
    throw new Error(`TagSet ${tagsetId} not found for UI update`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database update completes
  
  try {
    // 2. DATABASE: Update database in background
    const tagsetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Separate many-to-many relationships from regular fields
    // Separate many-to-many relationships from regular fields
    const { projects, ...regularUpdates } = updates as any;
    
    // Update regular fields if any
    if (Object.keys(regularUpdates).length > 0) {
      await tagsetRepo.update(tagsetId, regularUpdates);
    }
    
    // Handle many-to-many relationships using direct junction table manipulation
    
    if (projects !== undefined) {
      // Clear existing relations first
      await tagsetRepo
        .createQueryBuilder()
        .delete()
        .from('project_tag_sets')
        .where('"tagSetId" = :tagsetId', { tagsetId })
        .execute();
      
      // Add new relations if any
      if (projects && projects.length > 0) {
        const relatedIds = projects.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['tagSetId']: tagsetId, 
          ['projectId']: relatedId 
        }));
        await tagsetRepo
          .createQueryBuilder()
          .insert()
          .into('project_tag_sets')
          .values(values)
          .execute();
      }
    }
    
    // Load the updated entity without problematic relations to avoid createQueryBuilder issues
    const updatedTagSet = await tagsetRepo.findOne({ 
      where: { id: tagsetId }
    });
    
    if (!updatedTagSet) {
      throw new Error(`TagSet ${tagsetId} not found after database update`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('tag_sets', 'update', {
        ...updatedTagSet,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updatedTagSet;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Delete TagSet from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function deleteTagSetUI(
  tagsetId: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[TagSetFunctions-UI] Deleting tagset ${tagsetId.slice(-8)}`);
  
  // Get current tagset for potential revert
  const currentTagSets = dependencies.atomActions.tagsetsAtom.get();
  const tagsetToDelete = currentTagSets[tagsetId];
  
  if (!tagsetToDelete) {
    throw new Error(`TagSet ${tagsetId} not found for UI delete`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database delete completes
  
  try {
    // 2. DATABASE: Delete from database
    const tagsetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await tagsetRepo.delete(tagsetId);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(`TagSet ${tagsetId} could not be deleted from database`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('tag_sets', 'delete', {
        id: tagsetId,
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
 * Create TagSet from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function createTagSetIncoming(
  tagsetData: TagSet,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<TagSet> {
  console.log(`[TagSetFunctions-Incoming] Creating tagset ${tagsetData.id.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const tagsetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const createdTagSet = await tagsetRepo.save(tagsetData);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return createdTagSet;
}

/**
 * Update TagSet from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function updateTagSetIncoming(
  tagsetId: string,
  updates: Partial<TagSet>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<TagSet> {
  console.log(`[TagSetFunctions-Incoming] Updating tagset ${tagsetId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const tagsetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await tagsetRepo.update(tagsetId, updates);
  const updatedTagSet = await tagsetRepo.findOne({ where: { id: tagsetId } });
  
  if (!updatedTagSet) {
    throw new Error(`TagSet ${tagsetId} not found after incoming update`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updatedTagSet;
}

/**
 * Delete TagSet from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function deleteTagSetIncoming(
  tagsetId: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[TagSetFunctions-Incoming] Deleting tagset ${tagsetId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const tagsetRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await tagsetRepo.delete(tagsetId);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}



// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

/**
 * Create TagSet from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function createTagSetLiveChanges(
  tagsetData: TagSet,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[TagSetFunctions-LiveChanges] Reflecting tagset ${tagsetData.id.slice(-8)} database create in atom`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.createTagSetAtomOnly(tagsetData);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update TagSet from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function updateTagSetLiveChanges(
  tagsetId: string,
  updates: Partial<TagSet>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[TagSetFunctions-LiveChanges] Reflecting tagset ${tagsetId.slice(-8)} database change in atom`);
  
  // ATOM ONLY: Update atom to reflect database change
  const currentTagSets = dependencies.atomActions.tagsetsAtom.get();
  const currentTagSet = currentTagSets[tagsetId];
  
  if (!currentTagSet) {
    console.warn(`[TagSetFunctions-LiveChanges] TagSet ${tagsetId} not found in atom for live update`);
    return;
  }
  
  const updatedTagSet = { ...currentTagSet, ...updates };
  dependencies.atomActions.updateTagSetAtomOnly(tagsetId, updatedTagSet);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete TagSet from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function deleteTagSetLiveChanges(
  tagsetId: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[TagSetFunctions-LiveChanges] Reflecting tagset ${tagsetId.slice(-8)} database delete in atom`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.deleteTagSetAtomOnly(tagsetId);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}


