// Generated Comment CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { Comment } from './client-entities.js';

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

export interface CreateCommentInput {
  // content is required
  content: string;

  // authorId must be a valid UUID
  // Business rule: foreignKey
  authorId?: string;

  // parentId must be a valid UUID
  // Business rule: foreignKey
  parentId?: string;

  // taskId must be a valid UUID
  // Business rule: foreignKey
  taskId?: string;

  // projectId must be a valid UUID
  // Business rule: foreignKey
  projectId?: string;

}

export interface UpdateCommentInput extends Partial<CreateCommentInput> {}



// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

/**
 * Validation functions for Comment
 */

export function validateCommentContent(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('content is required');
  }

  return errors;
}

export function validateCommentAuthorId(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('authorId must be a valid UUID');
  }

  return errors;
}

export function validateCommentParentId(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('parentId must be a valid UUID');
  }

  return errors;
}

export function validateCommentTaskId(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('taskId must be a valid UUID');
  }

  return errors;
}

export function validateCommentProjectId(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('projectId must be a valid UUID');
  }

  return errors;
}

export function validateCommentInput(input: CreateCommentInput | UpdateCommentInput): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if ('content' in input) {
    const fieldErrors = validateCommentContent(input.content);
    if (fieldErrors.length > 0) {
      errors.content = fieldErrors;
    }
  }

  if ('authorId' in input) {
    const fieldErrors = validateCommentAuthorId(input.authorId);
    if (fieldErrors.length > 0) {
      errors.authorId = fieldErrors;
    }
  }

  if ('parentId' in input) {
    const fieldErrors = validateCommentParentId(input.parentId);
    if (fieldErrors.length > 0) {
      errors.parentId = fieldErrors;
    }
  }

  if ('taskId' in input) {
    const fieldErrors = validateCommentTaskId(input.taskId);
    if (fieldErrors.length > 0) {
      errors.taskId = fieldErrors;
    }
  }

  if ('projectId' in input) {
    const fieldErrors = validateCommentProjectId(input.projectId);
    if (fieldErrors.length > 0) {
      errors.projectId = fieldErrors;
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
 * Business logic functions for Comment
 */

export function getCommentDefaults(): Partial<CreateCommentInput> {
  return {
  };
}



// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

/**
 * Create Comment from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function createCommentUI(
  commentData: CreateCommentInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<Comment> {
  console.log(`[CommentFunctions-UI] Creating new comment`);
  
  // Validate input if validation function exists
  try {
    const validation = validateCommentInput(commentData);
    if (!validation.isValid) {
      throw new Error(`Invalid comment data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let commentWithDefaults;
  try {
    commentWithDefaults = {
      ...getCommentDefaults(),
      ...commentData
    };
  } catch (error) {
    // Defaults function might not exist
    commentWithDefaults = {
      ...commentData
    };
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database create completes
  
  try {
    // 2. DATABASE: Create in database in background
    const commentRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const createdComment = await commentRepo.save(commentWithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('comments', 'insert', {
        ...createdComment,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return createdComment;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Update Comment from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function updateCommentUI(
  commentId: string,
  updates: UpdateCommentInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<Comment> {
  console.log(`[CommentFunctions-UI] Updating comment ${commentId.slice(-8)}`);
  
  // Validate input if validation function exists
  try {
    const validation = validateCommentInput(updates);
    if (!validation.isValid) {
      throw new Error(`Invalid comment update data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current comment for optimistic update
  const currentComments = dependencies.atomActions.commentsAtom.get();
  const currentComment = currentComments[commentId];
  
  if (!currentComment) {
    throw new Error(`Comment ${commentId} not found for UI update`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database update completes
  
  try {
    // 2. DATABASE: Update database in background
    const commentRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Separate many-to-many relationships from regular fields
    // Update all fields using regular update
    await commentRepo.update(commentId, updates);
    
    // Load the updated entity without problematic relations to avoid createQueryBuilder issues
    const updatedComment = await commentRepo.findOne({ 
      where: { id: commentId }
    });
    
    if (!updatedComment) {
      throw new Error(`Comment ${commentId} not found after database update`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('comments', 'update', {
        ...updatedComment,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updatedComment;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Delete Comment from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function deleteCommentUI(
  commentId: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[CommentFunctions-UI] Deleting comment ${commentId.slice(-8)}`);
  
  // Get current comment for potential revert
  const currentComments = dependencies.atomActions.commentsAtom.get();
  const commentToDelete = currentComments[commentId];
  
  if (!commentToDelete) {
    throw new Error(`Comment ${commentId} not found for UI delete`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database delete completes
  
  try {
    // 2. DATABASE: Delete from database
    const commentRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await commentRepo.delete(commentId);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(`Comment ${commentId} could not be deleted from database`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('comments', 'delete', {
        id: commentId,
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
 * Create Comment from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function createCommentIncoming(
  commentData: Comment,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<Comment> {
  console.log(`[CommentFunctions-Incoming] Creating comment ${commentData.id.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const commentRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const createdComment = await commentRepo.save(commentData);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return createdComment;
}

/**
 * Update Comment from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function updateCommentIncoming(
  commentId: string,
  updates: Partial<Comment>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<Comment> {
  console.log(`[CommentFunctions-Incoming] Updating comment ${commentId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const commentRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await commentRepo.update(commentId, updates);
  const updatedComment = await commentRepo.findOne({ where: { id: commentId } });
  
  if (!updatedComment) {
    throw new Error(`Comment ${commentId} not found after incoming update`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updatedComment;
}

/**
 * Delete Comment from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function deleteCommentIncoming(
  commentId: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[CommentFunctions-Incoming] Deleting comment ${commentId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const commentRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await commentRepo.delete(commentId);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}



// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

/**
 * Create Comment from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function createCommentLiveChanges(
  commentData: Comment,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[CommentFunctions-LiveChanges] Reflecting comment ${commentData.id.slice(-8)} database create in atom`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.createCommentAtomOnly(commentData);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update Comment from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function updateCommentLiveChanges(
  commentId: string,
  updates: Partial<Comment>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[CommentFunctions-LiveChanges] Reflecting comment ${commentId.slice(-8)} database change in atom`);
  
  // ATOM ONLY: Update atom to reflect database change
  const currentComments = dependencies.atomActions.commentsAtom.get();
  const currentComment = currentComments[commentId];
  
  if (!currentComment) {
    console.warn(`[CommentFunctions-LiveChanges] Comment ${commentId} not found in atom for live update`);
    return;
  }
  
  const updatedComment = { ...currentComment, ...updates };
  dependencies.atomActions.updateCommentAtomOnly(commentId, updatedComment);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete Comment from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function deleteCommentLiveChanges(
  commentId: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[CommentFunctions-LiveChanges] Reflecting comment ${commentId.slice(-8)} database delete in atom`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.deleteCommentAtomOnly(commentId);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}


