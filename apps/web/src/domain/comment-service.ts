/**
 * Comment Domain Service
 * 
 * Implements comment-specific CRUD operations with business logic and sync tracking.
 * Uses the Comment entity type from DataForge for full type safety.
 */

import { Comment } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { nanoid } from 'nanoid';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// ============================================================================
// Input Types
// ============================================================================

export interface CreateCommentInput {
  content: string;
  taskId?: string;
  projectId?: string;
  parentId?: string;
  authorId: string;
  mentions?: string[];
  attachments?: string[];
}

export interface UpdateCommentInput {
  content?: string;
  mentions?: string[];
  attachments?: string[];
  editedAt?: string;
}

// ============================================================================
// Comment Domain Service Implementation
// ============================================================================

export class CommentDomainService extends BaseDomainService<Comment, CreateCommentInput, UpdateCommentInput> {
  tableName = 'comments';
  entityName = 'Comment';
  
  protected getTable() {
    return db.comments;
  }
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateCommentInput): Promise<Comment> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Ensure comment is attached to either a task or project
    if (!input.taskId && !input.projectId) {
      throw new Error('Comment must be attached to either a task or project');
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    const now = new Date().toISOString();
    const comment: Comment = {
      id: nanoid(),
      content: processedInput.content,
      taskId: processedInput.taskId || null,
      projectId: processedInput.projectId || null,
      parentId: processedInput.parentId || null,
      authorId: processedInput.authorId,
      mentions: processedInput.mentions || [],
      attachments: processedInput.attachments || [],
      editedAt: null,
      createdAt: now,
      updatedAt: now,
      clientId: nanoid(),
    } as Comment;
    
    // Save to Dexie
    await db.comments.add(comment);
    
    // Track for outgoing sync
    await trackOutgoingChange('comments', 'insert', comment);
    
    console.log('[CommentService] Created comment', {
      id: comment.id,
      taskId: comment.taskId,
      projectId: comment.projectId,
      authorId: comment.authorId,
      trackingSync: true
    });
    
    // Call after hook if defined
    if (this.afterCreate) {
      await this.afterCreate(comment);
    }
    
    return comment;
  }
  
  async updateUI(id: string, updates: UpdateCommentInput): Promise<Comment> {
    const existing = await db.comments.get(id);
    if (!existing) {
      throw new Error(`Comment ${id} not found`);
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
    const finalUpdates: Partial<Comment> = {
      ...processedUpdates,
      // Set editedAt timestamp when content is updated
      editedAt: processedUpdates.content !== undefined && processedUpdates.content !== existing.content
        ? new Date().toISOString()
        : processedUpdates.editedAt || existing.editedAt,
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
    // Check if comment has replies before deleting
    const replyCount = await db.comments.where('parentId').equals(id).count();
    if (replyCount > 0) {
      throw new Error(`Cannot delete comment ${id} - it has ${replyCount} replies`);
    }
    
    return this.performDelete(id);
  }
  
  // ============================================================================
  // Incoming Operations (no sync tracking)
  // ============================================================================
  
  async createIncoming(comment: Comment): Promise<Comment> {
    await db.comments.put(comment);
    console.log('[CommentService] Created comment from incoming sync', {
      id: comment.id,
      taskId: comment.taskId,
      projectId: comment.projectId
    });
    return comment;
  }
  
  async updateIncoming(id: string, updates: Partial<Comment>): Promise<Comment> {
    const existing = await db.comments.get(id);
    if (!existing) {
      throw new Error(`Comment ${id} not found`);
    }
    
    const updated: Comment = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    
    await db.comments.put(updated);
    console.log('[CommentService] Updated comment from incoming sync', {
      id: updated.id,
      updates
    });
    
    return updated;
  }
  
  async deleteIncoming(id: string): Promise<boolean> {
    const existing = await db.comments.get(id);
    if (!existing) {
      return false;
    }
    
    await db.comments.delete(id);
    console.log('[CommentService] Deleted comment from incoming sync', { id });
    
    return true;
  }
  
  // ============================================================================
  // Validation Hooks
  // ============================================================================
  
  protected validateCreate(input: CreateCommentInput): void {
    if (!input.content || input.content.trim().length === 0) {
      throw new Error('Comment content is required');
    }
    
    if (!input.authorId) {
      throw new Error('Comment author is required');
    }
    
    if (input.content.length > 10000) {
      throw new Error('Comment content cannot exceed 10000 characters');
    }
  }
  
  protected validateUpdate(id: string, updates: UpdateCommentInput): void {
    if (updates.content !== undefined) {
      if (updates.content.trim().length === 0) {
        throw new Error('Comment content cannot be empty');
      }
      
      if (updates.content.length > 10000) {
        throw new Error('Comment content cannot exceed 10000 characters');
      }
    }
  }
  
  // ============================================================================
  // Business Logic Hooks
  // ============================================================================
  
  protected beforeCreate(input: CreateCommentInput): CreateCommentInput {
    // Apply any default transformations
    return {
      ...input,
      // Trim content
      content: input.content.trim(),
      // Initialize empty arrays if not provided
      mentions: input.mentions || [],
      attachments: input.attachments || [],
    };
  }
  
  protected beforeUpdate(id: string, updates: UpdateCommentInput, existing: Comment): UpdateCommentInput {
    const processed = { ...updates };
    
    // Trim content if being updated
    if (updates.content) {
      processed.content = updates.content.trim();
    }
    
    return processed;
  }
  
  // ============================================================================
  // Additional Comment-Specific Methods
  // ============================================================================
  
  /**
   * Get all comments for a task
   */
  async getTaskComments(taskId: string): Promise<Comment[]> {
    const comments = await db.comments
      .where('taskId')
      .equals(taskId)
      .toArray();
    
    // Sort by creation date (oldest first)
    return comments.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }
  
  /**
   * Get all comments for a project
   */
  async getProjectComments(projectId: string): Promise<Comment[]> {
    const comments = await db.comments
      .where('projectId')
      .equals(projectId)
      .toArray();
    
    // Sort by creation date (oldest first)
    return comments.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }
  
  /**
   * Get comment thread (comment and all its replies)
   */
  async getCommentThread(commentId: string): Promise<Comment[]> {
    const rootComment = await db.comments.get(commentId);
    if (!rootComment) {
      return [];
    }
    
    // Get all replies recursively
    const thread: Comment[] = [rootComment];
    const replies = await this.getCommentReplies(commentId);
    
    for (const reply of replies) {
      const subThread = await this.getCommentThread(reply.id);
      thread.push(...subThread);
    }
    
    return thread;
  }
  
  /**
   * Get direct replies to a comment
   */
  async getCommentReplies(parentId: string): Promise<Comment[]> {
    const replies = await db.comments
      .where('parentId')
      .equals(parentId)
      .toArray();
    
    // Sort by creation date (oldest first)
    return replies.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }
  
  /**
   * Create a reply to a comment
   */
  async createReply(parentId: string, input: Omit<CreateCommentInput, 'parentId'>): Promise<Comment> {
    const parent = await db.comments.get(parentId);
    if (!parent) {
      throw new Error(`Parent comment ${parentId} not found`);
    }
    
    // Reply inherits the task/project from parent
    return this.createUI({
      ...input,
      parentId,
      taskId: parent.taskId,
      projectId: parent.projectId,
    });
  }
}