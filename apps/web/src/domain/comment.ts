import { v4 as uuidv4 } from 'uuid';
import { DeepPartial } from 'typeorm';
import { Comment } from '@repo/dataforge/client-entities';
import { BaseRepository, BaseService, DatabaseServiceError, EventDispatcher } from './base';
import { OutgoingChangeProcessor } from '../sync/OutgoingChangeProcessor';
import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { useMemo } from 'react';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Note: Live changes types moved to centralized LiveChangesManager

// Main comments store - holds all comments in normalized format
const commentsAtom = createAtom<Record<string, Comment>>({});

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

  // Update individual comment
  updateComment: (commentId: string, updates: Partial<Comment>) => {
    const currentComments = commentsAtom.get();
    const currentComment = currentComments[commentId];
    
    if (!currentComment) {
      console.warn(`[CommentService] Comment ${commentId} not found for update`);
      return;
    }
    
    const updatedComment = { ...currentComment, ...updates, updatedAt: new Date() };
    
    // Update comments record
    commentsAtom.set({
      ...currentComments,
      [commentId]: updatedComment
    });
    
    console.log(`[CommentService] Updated comment ${commentId}`);
  },

  // Create comment
  createComment: (comment: Comment) => {
    const currentComments = commentsAtom.get();
    
    // Add to comments record
    commentsAtom.set({
      ...currentComments,
      [comment.id]: { ...comment, updatedAt: new Date() }
    });
    
    console.log(`[CommentService] Created comment ${comment.id}`);
  },

  // Delete comment
  deleteComment: (commentId: string) => {
    const currentComments = commentsAtom.get();
    
    // Remove from comments record
    const { [commentId]: removed, ...remainingComments } = currentComments;
    commentsAtom.set(remainingComments);
    
    console.log(`[CommentService] Deleted comment ${commentId}`);
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
    protected syncChangeManager: OutgoingChangeProcessor
  ) {
    super(commentRepository, 'comments', syncChangeManager);
    
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
  syncManager: OutgoingChangeProcessor
) {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before creating Comment domain');
  }
  
  const repository = new CommentRepository(dataSource);
  const service = new CommentService(repository, syncManager);
  
  return { repository, service };
} 