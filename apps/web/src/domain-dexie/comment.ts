/**
 * Comment Domain - Re-export from new domain service architecture
 * 
 * This file now re-exports from the new formalized domain services.
 * The old implementation has been moved to comment-service.ts
 */

import { domainServices } from './index';
import type { Comment } from '@repo/dataforge/client-entities';
import type { CreateCommentInput, UpdateCommentInput } from './comment-service';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';

// Re-export types
export type { Comment } from '@repo/dataforge/client-entities';
export type { CreateCommentInput, UpdateCommentInput } from './comment-service';

// ============================================================================
// Function Exports (for backward compatibility)
// ============================================================================

export const createCommentUI = (input: CreateCommentInput): Promise<Comment> => domainServices.comment.createUI(input);
export const updateCommentUI = (id: string, updates: UpdateCommentInput): Promise<Comment> => domainServices.comment.updateUI(id, updates);
export const deleteCommentUI = (id: string): Promise<boolean> => domainServices.comment.deleteUI(id);
export const createCommentIncoming = (comment: Comment): Promise<Comment> => domainServices.comment.createIncoming(comment);
export const updateCommentIncoming = (id: string, updates: Partial<Comment>): Promise<Comment> => domainServices.comment.updateIncoming(id, updates);
export const deleteCommentIncoming = (id: string): Promise<boolean> => domainServices.comment.deleteIncoming(id);

// ============================================================================
// Live Query Hooks (kept for backward compatibility)
// ============================================================================

export const useCommentQueries = {
  /**
   * Get all comments (reactive)
   */
  allComments: () => {
    return useLiveQuery(() => 
      db.comments.toArray().then(comments => 
        comments.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      )
    ) || [];
  },

  /**
   * Get a single comment by ID (reactive)
   */
  commentById: (id: string) => {
    return useLiveQuery(
      () => id ? db.comments.get(id) : undefined,
      [id]
    );
  },

  /**
   * Get comments by task ID (reactive)
   */
  commentsByTask: (taskId: string) => {
    return useLiveQuery(() => {
      if (!taskId) return [];
      return db.comments
        .where('taskId')
        .equals(taskId)
        .toArray()
        .then(comments => 
          comments.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        );
    }, [taskId]) || [];
  },

  /**
   * Get comments by project ID (reactive)
   */
  commentsByProject: (projectId: string) => {
    return useLiveQuery(() => {
      if (!projectId) return [];
      return db.comments
        .where('projectId')
        .equals(projectId)
        .toArray()
        .then(comments => 
          comments.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        );
    }, [projectId]) || [];
  },

  /**
   * Get comment count (reactive)
   */
  commentCount: () => {
    return useLiveQuery(() => db.comments.count()) || 0;
  },

  /**
   * Get comments by author (reactive)
   */
  commentsByAuthor: (authorId: string) => {
    return useLiveQuery(
      () => authorId ? db.comments.where('authorId').equals(authorId).toArray() : [],
      [authorId]
    ) || [];
  },

  /**
   * Get comment thread (comment with all replies) (reactive)
   */
  commentThread: (parentId: string) => {
    return useLiveQuery(async () => {
      if (!parentId) return [];
      
      const allComments: Comment[] = [];
      const queue = [parentId];
      
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const children = await db.comments.where('parentId').equals(currentId).toArray();
        allComments.push(...children);
        queue.push(...children.map(c => c.id));
      }
      
      return allComments.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }, [parentId]) || [];
  },
};

