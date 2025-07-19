/**
 * Dexie-based Comment Domain
 * 
 * This is a parallel implementation that uses Dexie live queries instead of atomic stores.
 * It provides the same interface as the atomic store version but uses Dexie for data persistence and reactivity.
 * 
 * Uses the same 3-path pattern as the XState domain:
 * - UI operations: Include manual sync tracking via trackOutgoingChange
 * - Incoming operations: Server sync without tracking (to avoid loops)
 * - Direct Dexie updates: For live queries to react
 */

import { Comment } from '@repo/dataforge/client-entities';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';
import { nanoid } from 'nanoid';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// ============================================================================
// Types
// ============================================================================

export interface CreateCommentInput {
  content: string;
  taskId?: string;
  projectId?: string;
  parentId?: string;
}

export interface UpdateCommentInput {
  content?: string;
}

// ============================================================================
// UI Operations (with sync tracking)
// ============================================================================

/**
 * Create Comment from UI - includes manual sync tracking
 */
export async function createCommentUI(commentData: CreateCommentInput): Promise<Comment> {
  const comment: Comment = {
    id: nanoid(),
    content: commentData.content,
    taskId: commentData.taskId,
    projectId: commentData.projectId,
    parentId: commentData.parentId,
    authorId: 'current-user', // TODO: Get from auth context
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientId: 'dexie-client', // TODO: Get from sync context
    userId: 'current-user', // TODO: Get from auth context
  };

  // Apply to Dexie
  await db.comments.add(comment);
  
  // Track for outgoing sync
  await trackOutgoingChange('comments', 'insert', comment);
  
  return comment;
}

/**
 * Update Comment from UI - includes manual sync tracking
 */
export async function updateCommentUI(commentId: string, updates: UpdateCommentInput): Promise<Comment> {
  const existingComment = await db.comments.get(commentId);
  if (!existingComment) {
    throw new Error(`Comment ${commentId} not found`);
  }

  const updatedComment: Comment = {
    ...existingComment,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Apply to Dexie
  await db.comments.put(updatedComment);
  
  // Track for outgoing sync
  await trackOutgoingChange('comments', 'update', updatedComment);
  
  return updatedComment;
}

/**
 * Delete Comment from UI - includes manual sync tracking
 */
export async function deleteCommentUI(commentId: string): Promise<boolean> {
  const existingComment = await db.comments.get(commentId);
  if (!existingComment) {
    return false;
  }

  try {
    await db.transaction('rw', db.comments, async () => {
      // Delete the comment and all its children
      await deleteCommentAndChildren(commentId);
    });
    
    // Track for outgoing sync
    await trackOutgoingChange('comments', 'delete', existingComment);
    
    return true;
  } catch (error) {
    console.error('Error deleting comment:', error);
    return false;
  }
}

/**
 * Helper to recursively delete comment and its children
 */
async function deleteCommentAndChildren(commentId: string): Promise<void> {
  // Find all children
  const children = await db.comments.where('parentId').equals(commentId).toArray();
  
  // Recursively delete children
  for (const child of children) {
    await deleteCommentAndChildren(child.id);
  }
  
  // Delete the comment itself
  await db.comments.delete(commentId);
}

// ============================================================================
// Incoming Operations (no sync tracking)
// ============================================================================

/**
 * Create Comment from incoming sync - no tracking to avoid loops
 */
export async function createCommentIncoming(commentData: Comment): Promise<Comment> {
  // Apply to Dexie without tracking
  await db.comments.add(commentData);
  return commentData;
}

/**
 * Update Comment from incoming sync - no tracking to avoid loops
 */
export async function updateCommentIncoming(commentId: string, updates: Partial<Comment>): Promise<Comment> {
  const existingComment = await db.comments.get(commentId);
  if (!existingComment) {
    throw new Error(`Comment ${commentId} not found`);
  }

  const updatedComment: Comment = {
    ...existingComment,
    ...updates,
  };

  // Apply to Dexie without tracking
  await db.comments.put(updatedComment);
  return updatedComment;
}

/**
 * Delete Comment from incoming sync - no tracking to avoid loops
 */
export async function deleteCommentIncoming(commentId: string): Promise<boolean> {
  try {
    await db.transaction('rw', db.comments, async () => {
      await deleteCommentAndChildren(commentId);
    });
    return true;
  } catch (error) {
    console.error('Error deleting comment:', error);
    return false;
  }
}

// ============================================================================
// Service Layer (legacy interface for compatibility)
// ============================================================================

export const commentService = {
  /**
   * Create a new comment (delegates to UI operation)
   */
  async create(commentData: CreateCommentInput): Promise<Comment> {
    return createCommentUI(commentData);
  },

  /**
   * Update a comment (delegates to UI operation)
   */
  async update(commentId: string, updates: UpdateCommentInput): Promise<Comment | null> {
    try {
      return await updateCommentUI(commentId, updates);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Delete a comment (delegates to UI operation)
   */
  async delete(commentId: string): Promise<boolean> {
    return deleteCommentUI(commentId);
  },

  /**
   * Get a single comment by ID
   */
  async get(commentId: string): Promise<Comment | null> {
    const comment = await db.comments.get(commentId);
    return comment || null;
  },

  /**
   * Get all comments
   */
  async getAll(): Promise<Comment[]> {
    return await db.comments.toArray();
  },

  /**
   * Get comments by task
   */
  async getByTask(taskId: string): Promise<Comment[]> {
    return await db.comments.where('taskId').equals(taskId).toArray();
  },

  /**
   * Get comments by project
   */
  async getByProject(projectId: string): Promise<Comment[]> {
    return await db.comments.where('projectId').equals(projectId).toArray();
  },
};

// ============================================================================
// Live Query Hooks (Replace Atomic Store Hooks)
// ============================================================================

export const useCommentQueries = {
  /**
   * Get all comments
   */
  allComments: () => {
    return useLiveQuery(async () => {
      const comments = await db.comments.toArray();
      return comments.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
  },

  /**
   * Get a single comment by ID
   */
  commentById: (id: string) => {
    return useLiveQuery(async () => {
      return await db.comments.get(id);
    }, [id]);
  },

  /**
   * Get comments by task ID
   */
  commentsByTask: (taskId: string) => {
    return useLiveQuery(async () => {
      if (!taskId) return [];
      const comments = await db.comments.where('taskId').equals(taskId).toArray();
      return comments.sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }, [taskId]);
  },

  /**
   * Get comments by project ID
   */
  commentsByProject: (projectId: string) => {
    return useLiveQuery(async () => {
      if (!projectId) return [];
      const comments = await db.comments.where('projectId').equals(projectId).toArray();
      return comments.sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }, [projectId]);
  },

  /**
   * Get comment count
   */
  commentCount: () => {
    return useLiveQuery(async () => {
      return await db.comments.count();
    });
  },

  /**
   * Get comments by author
   */
  commentsByAuthor: (authorId: string) => {
    return useLiveQuery(async () => {
      if (!authorId) return [];
      return await db.comments.where('authorId').equals(authorId).toArray();
    }, [authorId]);
  },

  /**
   * Get comment thread (comment with all replies)
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
      
      return allComments.sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }, [parentId]);
  },
};

// ============================================================================
// Repository Pattern (for complex operations)
// ============================================================================

export const commentRepository = {
  /**
   * Get comment with author details
   */
  async getCommentWithAuthor(commentId: string) {
    const [comment, author] = await Promise.all([
      db.comments.get(commentId),
      db.users.get(commentId) // This will need the authorId from comment
    ]);

    if (!comment) return null;

    const authorData = await db.users.get(comment.authorId);

    return {
      ...comment,
      author: authorData || null
    };
  },

  /**
   * Get comments with nested replies
   */
  async getCommentsWithReplies(parentIds: string[]): Promise<Map<string, Comment[]>> {
    const repliesMap = new Map<string, Comment[]>();
    
    for (const parentId of parentIds) {
      const replies = await db.comments.where('parentId').equals(parentId).toArray();
      repliesMap.set(parentId, replies);
      
      // Recursively get replies for each reply
      if (replies.length > 0) {
        const childReplies = await this.getCommentsWithReplies(replies.map(r => r.id));
        childReplies.forEach((value, key) => {
          repliesMap.set(key, value);
        });
      }
    }
    
    return repliesMap;
  },

  /**
   * Get task comments with authors
   */
  async getTaskCommentsWithAuthors(taskId: string) {
    const comments = await db.comments.where('taskId').equals(taskId).toArray();
    const authorIds = [...new Set(comments.map(c => c.authorId))];
    const authors = await db.users.bulkGet(authorIds);
    
    const authorsMap = new Map(
      authors.filter(Boolean).map(author => [author!.id, author])
    );
    
    return comments.map(comment => ({
      ...comment,
      author: authorsMap.get(comment.authorId) || null
    }));
  },
};

// ============================================================================
// Utilities
// ============================================================================

export const commentUtils = {
  /**
   * Load comments (for compatibility with atomic store pattern)
   */
  loadComments: async (comments: Comment[]) => {
    // Clear existing and load new comments
    await db.comments.clear();
    await db.comments.bulkAdd(comments);
  },
  
  /**
   * Clear all comments
   */
  clearComments: async () => {
    await db.comments.clear();
  },
  
  /**
   * Ensure loaded (compatibility method - Dexie is always "loaded")
   */
  ensureLoaded: async () => {
    // No-op for Dexie - data is always available from IndexedDB
    // This method exists for API compatibility with atomic store pattern
    return;
  },
  
  /**
   * Count comments by entity
   */
  async getCommentCounts() {
    const comments = await db.comments.toArray();
    
    const counts = {
      total: comments.length,
      byTask: new Map<string, number>(),
      byProject: new Map<string, number>(),
      byAuthor: new Map<string, number>(),
    };
    
    comments.forEach(comment => {
      if (comment.taskId) {
        counts.byTask.set(comment.taskId, (counts.byTask.get(comment.taskId) || 0) + 1);
      }
      if (comment.projectId) {
        counts.byProject.set(comment.projectId, (counts.byProject.get(comment.projectId) || 0) + 1);
      }
      counts.byAuthor.set(comment.authorId, (counts.byAuthor.get(comment.authorId) || 0) + 1);
    });
    
    return counts;
  },
};