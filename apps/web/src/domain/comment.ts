import { v4 as uuidv4 } from 'uuid';
import { DeepPartial } from 'typeorm';
import { Comment } from '@repo/dataforge/client-entities';
import { BaseRepository, BaseService, DatabaseServiceError, EventDispatcher } from './base';
import { OutgoingChangeService } from '../sync/OutgoingChangeService';
import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { useMemo } from 'react';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Note: Live changes types moved to centralized LiveChangesManager

// Main comments store - holds all comments in normalized format
export const commentsAtom = createAtom<Record<string, Comment>>({});

// Note: Live changes state removed - now handled centrally by LiveChangesManager

// ============================================================================
// React Hooks (Pure XState)
// ============================================================================

export const useCommentAtoms = {
  // All comments as sorted array
  allComments: () => {
    return useSelector(
      commentsAtom,
      (commentsRecord) => {
        const comments = Object.values(commentsRecord);
        return comments.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return bTime - aTime; // Latest first
        });
      },
      shallowEqual
    );
  },

  // Individual comment by ID
  comment: (commentId: string) => {
    return useSelector(
      commentsAtom,
      (commentsRecord) => commentsRecord[commentId] || null
    );
  },

  // Note: No need for separate commentIds with XState selectors

  // Comments by task
  commentsByTask: (taskId: string) => {
    return useSelector(
      commentsAtom,
      (commentsRecord) => {
        const comments = Object.values(commentsRecord);
        return comments.filter(comment => comment.taskId === taskId)
          .sort((a, b) => {
            const aTime = new Date(a.createdAt).getTime();
            const bTime = new Date(b.createdAt).getTime();
            return aTime - bTime; // Oldest first for comments
          });
      },
      shallowEqual
    );
  },

  // Comment stats
  commentStats: () => {
    return useSelector(
      commentsAtom,
      (commentsRecord) => {
        const comments = Object.values(commentsRecord);
        const total = comments.length;
        
        return { total };
      },
      shallowEqual
    );
  },

  // Note: Live changes state now managed centrally
};

// ============================================================================
// Actions (Pure XState)
// ============================================================================

export const commentActions = {
  // 🎯 COMPARTMENTALIZED LOADING: Atoms handle their own database loading
  ensureLoaded: async () => {
    const current = commentsAtom.get();
    if (Object.keys(current).length > 0) {
      console.log(`[CommentAtoms] Comments already loaded - skipping (${Object.keys(current).length} comments)`);
      return; // Already loaded
    }
    
    console.log('[CommentAtoms] Loading comments from database...');
    try {
      // ✅ FIXED: Use global datasource singleton to prevent race conditions
      const { getGlobalDataSource } = await import('../db/global-datasource');
      const dataSource = await getGlobalDataSource();
      
      if (!dataSource.isInitialized) {
        console.warn('[CommentAtoms] DataSource not ready, skipping load');
        return;
      }
      
      const comments = await dataSource.getRepository(Comment).find();
      
      // Create normalized record
      const commentsRecord: Record<string, Comment> = {};
      comments.forEach(comment => {
        commentsRecord[comment.id] = comment;
      });
      
      // Update atom
      commentsAtom.set(commentsRecord);
      console.log(`[CommentAtoms] ✅ Loaded ${comments.length} comments`);
      
    } catch (error) {
      console.error('[CommentAtoms] Failed to load comments:', error);
      // Don't throw - let components handle empty state gracefully
    }
  },

  // Bulk load comments (for external data sources)
  loadComments: (comments: Comment[]) => {
    console.log(`[CommentService] Loading ${comments.length} comments`);
    
    // Create normalized record - no presorting needed with XState selectors
    const commentsRecord: Record<string, Comment> = {};
    comments.forEach(comment => {
      commentsRecord[comment.id] = comment;
    });
    
    // Update atom
    commentsAtom.set(commentsRecord);
    
    console.log(`[CommentService] Bulk loaded ${comments.length} comments`);
  },

  // ✅ PURE FUNCTION UPDATE: Direct database + sync tracking (no optimistic update)
  updateComment: async (commentId: string, updates: Partial<Comment>) => {
    try {
      console.log(`[CommentAtoms] Background update for comment ${commentId.slice(-8)}: ${Object.keys(updates).join(', ')}`);
      
      const dataSource = await import('../db/newtypeorm/NewDataSource').then(m => m.getNewPGliteDataSource());
      const repository = (await dataSource).getRepository(Comment);
      
      // Get current comment
      const comment = await repository.findOne({ where: { id: commentId } });
      if (!comment) {
        throw new Error(`Comment with ID ${commentId} not found`);
      }
      
      // Apply updates
      const updatedData = {
        ...updates,
        updatedAt: new Date()
      };
      
      // Update database
      await repository.update(commentId, updatedData);
      const updated = await repository.findOne({ where: { id: commentId } });
      
      if (!updated) {
        throw new Error(`Failed to retrieve updated comment ${commentId}`);
      }
      
      // Get OutgoingChangeService from sync machine
      try {
        const { getGlobalOutgoingChangeService } = await import('../state-machines/machines/sync-machine-v2');
        const outgoingChangeService = getGlobalOutgoingChangeService();
        
        if (outgoingChangeService) {
          await outgoingChangeService.trackEntityChange('comments', 'update', updated);
        } else {
          console.warn('[CommentAtoms] No OutgoingChangeService available - sync tracking skipped');
        }
      } catch (error) {
        console.warn('[CommentAtoms] Failed to get OutgoingChangeService:', error);
      }
      
      console.log(`[CommentAtoms] Successfully updated comment ${commentId.slice(-8)} - live sync will update atoms`);
    } catch (error) {
      console.error(`[CommentAtoms] Failed to update comment ${commentId}:`, error);
      throw error; // Let VibeGrid handle the error
    }
  },

  // Internal atom-only update (used by service layer and fallback)
  updateCommentAtomOnly: (commentId: string, updates: Partial<Comment>) => {
    const currentComments = commentsAtom.get();
    const currentComment = currentComments[commentId];
    
    if (!currentComment) {
      console.warn(`[CommentAtoms] Comment ${commentId} not found for update`);
      return;
    }
    
    // ✅ FIXED: Don't modify updatedAt if it's already provided (e.g., from LiveChangesManager)
    const updatedComment = { 
      ...currentComment, 
      ...updates,
      ...(updates.updatedAt ? {} : { updatedAt: new Date() })
    };
    
    // Update comments record
    commentsAtom.set({
      ...currentComments,
      [commentId]: updatedComment
    });
    
    console.log(`[CommentAtoms] Updated comment atom ${commentId}`);
  },

  // ✅ PURE FUNCTION DELETE: Direct database + sync tracking (no service overhead)
  deleteComment: async (commentId: string) => {
    try {
      const dataSource = await import('../db/newtypeorm/NewDataSource').then(m => m.getNewPGliteDataSource());
      const repository = (await dataSource).getRepository(Comment);
      
      // Check if comment exists
      const comment = await repository.findOne({ where: { id: commentId } });
      if (!comment) {
        throw new Error(`Comment with ID ${commentId} not found`);
      }
      
      // Delete from database
      const result = await repository.delete(commentId);
      const success = (result.affected ?? 0) > 0;
      
      if (success) {
        // Get OutgoingChangeService from sync machine
        try {
          const { getGlobalOutgoingChangeService } = await import('../state-machines/machines/sync-machine-v2');
          const outgoingChangeService = getGlobalOutgoingChangeService();
          
          if (outgoingChangeService) {
            await outgoingChangeService.trackEntityChange('comments', 'delete', { id: commentId });
          } else {
            console.warn('[CommentAtoms] No OutgoingChangeService available - sync tracking skipped');
          }
        } catch (error) {
          console.warn('[CommentAtoms] Failed to get OutgoingChangeService:', error);
        }
        
        // Remove from atom
        commentActions.deleteCommentAtomOnly(commentId);
      }
      
      console.log(`[CommentAtoms] Deleted comment ${commentId} via pure function (with sync tracking)`);
    } catch (error) {
      console.error(`[CommentAtoms] Failed to delete comment ${commentId}:`, error);
      // Fallback to atom-only delete
      commentActions.deleteCommentAtomOnly(commentId);
    }
  },

  // Internal atom-only delete (used by service layer and fallback)
  deleteCommentAtomOnly: (commentId: string) => {
    const currentComments = commentsAtom.get();
    
    // Remove from comments record
    const { [commentId]: removed, ...remainingComments } = currentComments;
    commentsAtom.set(remainingComments);
    
    console.log(`[CommentAtoms] Deleted comment atom ${commentId}`);
  },

  // Create comment (always goes through service for proper creation workflow)
  createComment: (comment: Comment) => {
    const currentComments = commentsAtom.get();
    
    // Add to comments record
    commentsAtom.set({
      ...currentComments,
      [comment.id]: { ...comment, updatedAt: new Date() }
    });
    
    console.log(`[CommentAtoms] Created comment ${comment.id}`);
  },
};

// ============================================================================
// Note: Live Changes Integration removed - now handled centrally by LiveChangesManager
// ============================================================================

// ============================================================================
// Atomic Store Implementation (CommentAtomStore replacement)
// ============================================================================

class CommentAtomStore {
  // XState atoms for compatibility with existing interfaces
  commentsAtom = commentsAtom
  
  // Compatibility methods for existing code
  getCommentAtom = (id: string) => {
    return {
      get: () => {
        const commentsRecord = commentsAtom.get();
        return commentsRecord[id] || null;
      },
      isXStateAtom: true,
      commentId: id
    };
  }

  // Derived atom equivalent for compatibility
  allCommentsAtom = {
    get: () => Object.values(commentsAtom.get())
  }

  // Bulk load compatibility
  syncBulkLoad = {
    set: (comments: Comment[]) => commentActions.loadComments(comments)
  }

  // Note: Live changes methods removed - now handled centrally by LiveChangesManager
}

// Repository
export class CommentRepository extends BaseRepository<Comment> {
  constructor(dataSource: NewPGliteDataSource) {
    if (!dataSource.isInitialized) {
      throw new Error('DataSource must be initialized before creating CommentRepository');
    }
    super(dataSource.getRepository(Comment), 'comment', dataSource);
  }

  async findByTask(taskId: string): Promise<Comment[]> {
    return this.repository.find({ where: { taskId } as any });
  }
}

// Service
export class CommentService extends BaseService<Comment> {
  constructor(
    protected commentRepository: CommentRepository,
    protected outgoingChangeService: OutgoingChangeService
  ) {
    super(commentRepository, 'comments', outgoingChangeService);
    
    // Set up entity-specific sync processing methods
    this.resolveDependencies = this.resolveCommentDependencies.bind(this);
    this.validateSyncData = this.validateCommentSyncData.bind(this);
  }

  /**
   * Override to specify comment-specific date fields
   */
  getDateFields(): string[] {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * Override to handle comment-specific data processing
   */
  processSyncData(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): Record<string, any> {
    let processedData = super.processSyncData(data, operation);
    
    if (operation === 'INSERT' || operation === 'UPDATE') {
      // Handle entity-specific mappings for comments
      processedData = this.handleEntitySpecificMappings(processedData);
    }
    
    return processedData;
  }

  /**
   * Handle entity_type and entity_id mapping to specific foreign keys
   */
  private handleEntitySpecificMappings(data: Record<string, any>): Record<string, any> {
    const result = { ...data };
    
    const entityType = data.entityType || data.entity_type;
    const entityId = data.entityId || data.entity_id;
    
    if (entityType && entityId) {
      switch (entityType) {
        case 'task':
          result.taskId = entityId;
          break;
        case 'project':
          result.projectId = entityId;
          break;
        default:
          console.warn(`[CommentService] Unknown entityType '${entityType}' for comment ${data.id}`);
      }
    }
    
    return result;
  }

  /**
   * Resolve comment dependencies (parent-child relationships)
   */
  private async resolveCommentDependencies(data: Record<string, any>): Promise<Record<string, any>> {
    if (data.parentId) {
      const parentExists = await this.commentRepository.findById(data.parentId);
      if (!parentExists) {
        console.warn(`[CommentService] Comment ${data.id} has parent ${data.parentId}, but parent was not found. Proceeding with save.`);
      }
    }
    
    return data;
  }

  /**
   * Validate comment sync data
   */
  private validateCommentSyncData(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
    if (operation === 'INSERT') {
      if (!data.content || !data.authorId) {
        throw new Error(`Comment INSERT requires content and authorId. Received: ${JSON.stringify(data)}`);
      }
      
      if (!data.taskId && !data.projectId) {
        throw new Error(`Comment INSERT requires either taskId or projectId. Received: ${JSON.stringify(data)}`);
      }
    }
    
    if (operation === 'UPDATE' || operation === 'DELETE') {
      if (!data.id) {
        throw new Error(`Comment ${operation} requires an id. Received: ${JSON.stringify(data)}`);
      }
    }
  }

  async get(id: string): Promise<Comment | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to get comment with ID ${id}`,
        'get',
        error
      );
    }
  }

  async getByTask(taskId: string): Promise<Comment[]> {
    try {
      return await this.repository.findByTask(taskId);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to get comments for task with ID ${taskId}`,
        'getByTask',
        error
      );
    }
  }

  async createComment(commentData: {
    content: string;
    taskId: string;
    authorId: string;
    parentId?: string;
  }): Promise<Comment> {
    try {
      const now = new Date();
      const commentId = uuidv4();
      
      const newComment = {
        id: commentId,
        content: commentData.content,
        taskId: commentData.taskId,
        authorId: commentData.authorId,
        parentId: commentData.parentId || null,
        createdAt: now,
        updatedAt: now
      } as Comment;

      // ✅ USE INHERITED METHOD: createWithProcessing handles sync tracking automatically
      const createdComment = await this.createWithProcessing(newComment as Record<string, any>);
      
      // ✅ OPTIMISTIC UPDATE: Add new comment to atom immediately
      commentActions.createComment(createdComment);
      
      // Optimized event dispatching
      EventDispatcher.emit('comment:created', { comment: createdComment });
      
      return createdComment;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to create comment for task ${commentData.taskId}`,
        'createComment',
        error
      );
    }
  }

  async updateComment(id: string, changes: Partial<Comment>): Promise<Comment> {
    try {
      const comment = await this.repository.findById(id);
      if (!comment) {
        throw new Error(`Comment with ID ${id} not found`);
      }
      
      const updatedData = {
        ...changes,
        updatedAt: new Date()
      } as DeepPartial<Comment>;
      
      // ✅ USE INHERITED METHOD: updateWithProcessing handles sync tracking automatically
      const updatedComment = await this.updateWithProcessing(id, updatedData as Record<string, any>);
      
      // ✅ OPTIMISTIC UPDATE: Update comment in atom immediately
      commentActions.updateComment(id, updatedComment);
      
      // Optimized event dispatching
      EventDispatcher.emit('comment:updated', { comment: updatedComment });
      
      return updatedComment;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to update comment with ID ${id}`,
        'updateComment',
        error
      );
    }
  }

  async deleteComment(id: string): Promise<boolean> {
    try {
      const comment = await this.repository.findById(id);
      if (!comment) {
        throw new Error(`Comment with ID ${id} not found`);
      }
      
      // ✅ USE INHERITED METHOD: deleteWithProcessing handles sync tracking automatically
      const success = await this.deleteWithProcessing(id);
      
      // ✅ OPTIMISTIC UPDATE: Remove comment from atom immediately
      if (success) {
        commentActions.deleteComment(id);
      }
      
      // Optimized event dispatching
      EventDispatcher.emit('comment:deleted', { commentId: id });
      
      return success;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to delete comment with ID ${id}`,
        'deleteComment',
        error
      );
    }
  }

    // Note: Live changes methods removed - now handled centrally by LiveChangesManager

  // ============================================================================
  // ATOMIC STORE - INTEGRATED ATOMIC REACTIVITY
  // ============================================================================
  
  static atoms: CommentAtomStore;

  // ============================================================================
  // LIVE QUERY BUILDERS (using our existing patterns)
  // ============================================================================

  static createQueryBuilders(createQueryBuilder: Function) {
    return {
      all: () => {
        return createQueryBuilder(Comment, 'comment')
          // TEMPORARILY REMOVED - causing N+1 queries due to Promise-based relations
          // .leftJoinAndSelect('comment.author', 'author')
          // .leftJoinAndSelect('comment.task', 'task')
          // .leftJoinAndSelect('comment.project', 'project')
          // .leftJoinAndSelect('comment.parent', 'parent')
          .orderBy('comment.createdAt', 'DESC')
      },

      byTask: (taskId: string) => {
        return createQueryBuilder(Comment, 'comment')
          // TEMPORARILY REMOVED - causing N+1 queries due to Promise-based relations
          // .leftJoinAndSelect('comment.author', 'author')
          // .leftJoinAndSelect('comment.parent', 'parent')
          .where('comment.taskId = :taskId', { taskId })
          .orderBy('comment.createdAt', 'ASC') // Comments usually shown chronologically
      },

      byProject: (projectId: string) => {
        return createQueryBuilder(Comment, 'comment')
          // TEMPORARILY REMOVED - causing N+1 queries due to Promise-based relations
          // .leftJoinAndSelect('comment.author', 'author')
          // .leftJoinAndSelect('comment.parent', 'parent')
          .where('comment.projectId = :projectId', { projectId })
          .orderBy('comment.createdAt', 'ASC')
      },

      detail: (id: string) => {
        return createQueryBuilder(Comment, 'comment')
          // TEMPORARILY REMOVED - causing N+1 queries due to Promise-based relations
          // .leftJoinAndSelect('comment.author', 'author')
          // .leftJoinAndSelect('comment.task', 'task')
          // .leftJoinAndSelect('comment.project', 'project')
          // .leftJoinAndSelect('comment.parent', 'parent')
          // .leftJoinAndSelect('comment.children', 'children')
          .where('comment.id = :id', { id })
      },
    }
  }

  // ============================================================================
  // REMOVED: React Query sections eliminated (~650 lines)
  // Replaced with atomic reactivity via CommentService.atoms
  // ============================================================================
}

// ============================================================================
// ATOMIC STORE INSTANCE - Exported for Universal Entity Table v2
// ============================================================================

const commentAtoms = new CommentAtomStore();
CommentService.atoms = commentAtoms;

export { commentAtoms };

// Factory function for this domain
export function createCommentDomain(
  dataSource: NewPGliteDataSource, 
  outgoingChangeService: OutgoingChangeService
) {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before creating Comment domain');
  }
  
  const repository = new CommentRepository(dataSource);
  const service = new CommentService(repository, outgoingChangeService);
  
  return { repository, service };
}

// ============================================================================
// SINGLETON SERVICE INSTANCE - For VibeGrid Integration
// ============================================================================

let commentServiceInstance: CommentService | null = null;

export function setCommentService(service: CommentService): void {
  commentServiceInstance = service;
}

export async function getCommentService(): Promise<CommentService | null> {
  return commentServiceInstance;
}

export function hasCommentService(): boolean {
  return commentServiceInstance !== null;
} 