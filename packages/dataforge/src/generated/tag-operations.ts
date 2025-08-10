// Generated Tag CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { Tag } from './client-entities.js';

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

export interface CreateTagInput {
  // tagSetId is required
  // tagSetId must be a valid UUID
  // Business rule: foreignKey
  tagSetId: string;

  // name is required
  // name cannot exceed 50 characters
  name: string;

  // slug is required
  // slug cannot exceed 50 characters
  slug: string;

  // color is required
  // color cannot exceed 7 characters
  color: string;

  // icon cannot exceed 50 characters
  icon?: string;

  // variant cannot exceed 20 characters
  variant: string;

  sortOrder: number;
  // parentId must be a valid UUID
  // Business rule: foreignKey
  parentId?: string;

  isActive: boolean;
  usageCount: number;
  // lastUsedAt must be a valid date
  lastUsedAt?: Date;

  metadata: any;
}

export interface UpdateTagInput extends Partial<CreateTagInput> {}



// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

/**
 * Validation functions for Tag
 */

export function validateTagTagSetId(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('tagSetId is required');
  }

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('tagSetId must be a valid UUID');
  }

  return errors;
}

export function validateTagName(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('name is required');
  }

  if (typeof value === 'string' && value.length > 50) {
    errors.push('name cannot exceed 50 characters');
  }

  return errors;
}

export function validateTagSlug(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('slug is required');
  }

  if (typeof value === 'string' && value.length > 50) {
    errors.push('slug cannot exceed 50 characters');
  }

  return errors;
}

export function validateTagColor(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('color is required');
  }

  if (typeof value === 'string' && value.length > 7) {
    errors.push('color cannot exceed 7 characters');
  }

  return errors;
}

export function validateTagIcon(value: any): string[] {
  const errors: string[] = [];

  if (typeof value === 'string' && value.length > 50) {
    errors.push('icon cannot exceed 50 characters');
  }

  return errors;
}

export function validateTagVariant(value: any): string[] {
  const errors: string[] = [];

  if (typeof value === 'string' && value.length > 20) {
    errors.push('variant cannot exceed 20 characters');
  }

  return errors;
}

export function validateTagParentId(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('parentId must be a valid UUID');
  }

  return errors;
}

export function validateTagLastUsedAt(value: any): string[] {
  const errors: string[] = [];

  return errors;
}

export function validateTagInput(input: CreateTagInput | UpdateTagInput): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if ('tagSetId' in input) {
    const fieldErrors = validateTagTagSetId(input.tagSetId);
    if (fieldErrors.length > 0) {
      errors.tagSetId = fieldErrors;
    }
  }

  if ('name' in input) {
    const fieldErrors = validateTagName(input.name);
    if (fieldErrors.length > 0) {
      errors.name = fieldErrors;
    }
  }

  if ('slug' in input) {
    const fieldErrors = validateTagSlug(input.slug);
    if (fieldErrors.length > 0) {
      errors.slug = fieldErrors;
    }
  }

  if ('color' in input) {
    const fieldErrors = validateTagColor(input.color);
    if (fieldErrors.length > 0) {
      errors.color = fieldErrors;
    }
  }

  if ('icon' in input) {
    const fieldErrors = validateTagIcon(input.icon);
    if (fieldErrors.length > 0) {
      errors.icon = fieldErrors;
    }
  }

  if ('variant' in input) {
    const fieldErrors = validateTagVariant(input.variant);
    if (fieldErrors.length > 0) {
      errors.variant = fieldErrors;
    }
  }

  if ('parentId' in input) {
    const fieldErrors = validateTagParentId(input.parentId);
    if (fieldErrors.length > 0) {
      errors.parentId = fieldErrors;
    }
  }

  if ('lastUsedAt' in input) {
    const fieldErrors = validateTagLastUsedAt(input.lastUsedAt);
    if (fieldErrors.length > 0) {
      errors.lastUsedAt = fieldErrors;
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
 * Business logic functions for Tag
 */

export function getTagDefaults(): Partial<CreateTagInput> {
  return {
    variant: 'solid',
    sortOrder: 0,
    isActive: true,
    usageCount: 0,
    metadata: {},
  };
}



// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

/**
 * Create Tag from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function createTagUI(
  tagData: CreateTagInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<Tag> {
  console.log(`[TagFunctions-UI] Creating new tag`);
  
  // Validate input if validation function exists
  try {
    const validation = validateTagInput(tagData);
    if (!validation.isValid) {
      throw new Error(`Invalid tag data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let tagWithDefaults;
  try {
    tagWithDefaults = {
      ...getTagDefaults(),
      ...tagData
    };
  } catch (error) {
    // Defaults function might not exist
    tagWithDefaults = {
      ...tagData
    };
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database create completes
  
  try {
    // 2. DATABASE: Create in database in background
    const tagRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const createdTag = await tagRepo.save(tagWithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('tags', 'insert', {
        ...createdTag,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return createdTag;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Update Tag from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function updateTagUI(
  tagId: string,
  updates: UpdateTagInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<Tag> {
  console.log(`[TagFunctions-UI] Updating tag ${tagId.slice(-8)}`);
  
  // Validate input if validation function exists
  try {
    const validation = validateTagInput(updates);
    if (!validation.isValid) {
      throw new Error(`Invalid tag update data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current tag for optimistic update
  const currentTags = dependencies.atomActions.tagsAtom.get();
  const currentTag = currentTags[tagId];
  
  if (!currentTag) {
    throw new Error(`Tag ${tagId} not found for UI update`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database update completes
  
  try {
    // 2. DATABASE: Update database in background
    const tagRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Separate many-to-many relationships from regular fields
    // Separate many-to-many relationships from regular fields
    const { tasks, ...regularUpdates } = updates as any;
    
    // Update regular fields if any
    if (Object.keys(regularUpdates).length > 0) {
      await tagRepo.update(tagId, regularUpdates);
    }
    
    // Handle many-to-many relationships using direct junction table manipulation
    
    if (tasks !== undefined) {
      // Clear existing relations first
      await tagRepo
        .createQueryBuilder()
        .delete()
        .from('task_tags')
        .where('"tagId" = :tagId', { tagId })
        .execute();
      
      // Add new relations if any
      if (tasks && tasks.length > 0) {
        const relatedIds = tasks.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['tagId']: tagId, 
          ['taskId']: relatedId 
        }));
        await tagRepo
          .createQueryBuilder()
          .insert()
          .into('task_tags')
          .values(values)
          .execute();
      }
    }
    
    // Load the updated entity without problematic relations to avoid createQueryBuilder issues
    const updatedTag = await tagRepo.findOne({ 
      where: { id: tagId }
    });
    
    if (!updatedTag) {
      throw new Error(`Tag ${tagId} not found after database update`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('tags', 'update', {
        ...updatedTag,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updatedTag;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Delete Tag from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function deleteTagUI(
  tagId: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[TagFunctions-UI] Deleting tag ${tagId.slice(-8)}`);
  
  // Get current tag for potential revert
  const currentTags = dependencies.atomActions.tagsAtom.get();
  const tagToDelete = currentTags[tagId];
  
  if (!tagToDelete) {
    throw new Error(`Tag ${tagId} not found for UI delete`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database delete completes
  
  try {
    // 2. DATABASE: Delete from database
    const tagRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await tagRepo.delete(tagId);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(`Tag ${tagId} could not be deleted from database`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('tags', 'delete', {
        id: tagId,
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
 * Create Tag from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function createTagIncoming(
  tagData: Tag,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<Tag> {
  console.log(`[TagFunctions-Incoming] Creating tag ${tagData.id.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const tagRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const createdTag = await tagRepo.save(tagData);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return createdTag;
}

/**
 * Update Tag from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function updateTagIncoming(
  tagId: string,
  updates: Partial<Tag>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<Tag> {
  console.log(`[TagFunctions-Incoming] Updating tag ${tagId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const tagRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await tagRepo.update(tagId, updates);
  const updatedTag = await tagRepo.findOne({ where: { id: tagId } });
  
  if (!updatedTag) {
    throw new Error(`Tag ${tagId} not found after incoming update`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updatedTag;
}

/**
 * Delete Tag from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function deleteTagIncoming(
  tagId: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[TagFunctions-Incoming] Deleting tag ${tagId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const tagRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await tagRepo.delete(tagId);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}



// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

/**
 * Create Tag from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function createTagLiveChanges(
  tagData: Tag,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[TagFunctions-LiveChanges] Reflecting tag ${tagData.id.slice(-8)} database create in atom`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.createTagAtomOnly(tagData);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update Tag from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function updateTagLiveChanges(
  tagId: string,
  updates: Partial<Tag>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[TagFunctions-LiveChanges] Reflecting tag ${tagId.slice(-8)} database change in atom`);
  
  // ATOM ONLY: Update atom to reflect database change
  const currentTags = dependencies.atomActions.tagsAtom.get();
  const currentTag = currentTags[tagId];
  
  if (!currentTag) {
    console.warn(`[TagFunctions-LiveChanges] Tag ${tagId} not found in atom for live update`);
    return;
  }
  
  const updatedTag = { ...currentTag, ...updates };
  dependencies.atomActions.updateTagAtomOnly(tagId, updatedTag);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete Tag from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function deleteTagLiveChanges(
  tagId: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[TagFunctions-LiveChanges] Reflecting tag ${tagId.slice(-8)} database delete in atom`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.deleteTagAtomOnly(tagId);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}


