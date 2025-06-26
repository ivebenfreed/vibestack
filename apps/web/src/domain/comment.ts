import { Comment } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// Import DataForge operations
import {
  createCommentUI as _createCommentUI,
  updateCommentUI as _updateCommentUI,
  deleteCommentUI as _deleteCommentUI,
  createCommentIncoming as _createCommentIncoming,
  updateCommentIncoming as _updateCommentIncoming,
  deleteCommentIncoming as _deleteCommentIncoming,
  createCommentLiveChanges as _createCommentLiveChanges,
  updateCommentLiveChanges as _updateCommentLiveChanges,
  deleteCommentLiveChanges as _deleteCommentLiveChanges,
  type CreateCommentInput,
  type UpdateCommentInput
} from '@repo/dataforge/comment-operations';

// Export types
export type { CreateCommentInput, UpdateCommentInput };

// Wrapper functions that handle dependencies internally
export async function createCommentUI(commentData: CreateCommentInput): Promise<Comment> {
  const dependencies = await getCommentDependencies();
  return _createCommentUI(commentData, dependencies);
}

export async function updateCommentUI(commentId: string, updates: UpdateCommentInput): Promise<Comment> {
  const dependencies = await getCommentDependencies();
  return _updateCommentUI(commentId, updates, dependencies);
}

export async function deleteCommentUI(commentId: string): Promise<boolean> {
  const dependencies = await getCommentDependencies();
  return _deleteCommentUI(commentId, dependencies);
}

export async function createCommentIncoming(commentData: Comment): Promise<Comment> {
  const dependencies = await getCommentDependencies();
  return _createCommentIncoming(commentData, dependencies);
}

export async function updateCommentIncoming(commentId: string, updates: Partial<Comment>): Promise<Comment> {
  const dependencies = await getCommentDependencies();
  return _updateCommentIncoming(commentId, updates, dependencies);
}

export async function deleteCommentIncoming(commentId: string): Promise<boolean> {
  const dependencies = await getCommentDependencies();
  return _deleteCommentIncoming(commentId, dependencies);
}

export function createCommentLiveChanges(commentData: Comment): void {
  const dependencies = { atomActions };
  return _createCommentLiveChanges(commentData, dependencies);
}

export function updateCommentLiveChanges(commentId: string, updates: Partial<Comment>): void {
  const dependencies = { atomActions };
  return _updateCommentLiveChanges(commentId, updates, dependencies);
}

export function deleteCommentLiveChanges(commentId: string): void {
  const dependencies = { atomActions };
  return _deleteCommentLiveChanges(commentId, dependencies);
}

// Main comments store - holds all comments in normalized format
export const commentsAtom = createAtom<Record<string, Comment>>({});

// React Hooks
export const useCommentAtoms = {
  allComments: () => {
    return useSelector(
      commentsAtom,
      (commentsRecord) => Object.values(commentsRecord),
      shallowEqual
    );
  },
  commentById: (id: string) => {
    return useSelector(
      commentsAtom,
      (commentsRecord) => commentsRecord[id] || null,
      shallowEqual
    );
  }
};

// ============================================================================
// Atom Utilities for DataForge Operations
// ============================================================================

export const atomActions = {
  createCommentAtomOnly: (comment: Comment) => {
    const currentComments = commentsAtom.get();
    commentsAtom.set({ ...currentComments, [comment.id]: comment });
  },
  
  updateCommentAtomOnly: (id: string, updates: Partial<Comment>) => {
    const currentComments = commentsAtom.get();
    const existingComment = currentComments[id];
    if (existingComment) {
      commentsAtom.set({ ...currentComments, [id]: { ...existingComment, ...updates } });
    }
  },
  
  deleteCommentAtomOnly: (id: string) => {
    const currentComments = commentsAtom.get();
    const { [id]: deleted, ...remaining } = currentComments;
    commentsAtom.set(remaining);
  },
  
  // Expose atom for DataForge operations
  commentsAtom: commentsAtom
};

export const commentUtils = {
  loadComments: (comments: Comment[]) => {
    const commentsRecord = comments.reduce((acc, comment) => {
      acc[comment.id] = comment;
      return acc;
    }, {} as Record<string, Comment>);
    commentsAtom.set(commentsRecord);
  },
  
  clearComments: () => commentsAtom.set({}),
  
  ensureLoaded: async () => {
    if (Object.keys(commentsAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const comments = await dataSource.getRepository(Comment).find({
        relations: ['author', 'task', 'project', 'parent']
      });
      commentUtils.loadComments(comments);
    }
  }
};

// Helper to get dependencies for DataForge operations
export async function getCommentDependencies() {
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return {
    dataSource,
    EntityClass: Comment,
    atomActions,
    outgoingChangeService: services?.outgoingChangeService || null
  };
}

export async function bulkCreateCommentsIncoming(commentsData: Comment[]): Promise<Comment[]> {
  if (commentsData.length === 0) return [];
  
  console.log(`[CommentDomain] Bulk creating ${commentsData.length} comments from incoming sync`);
  const startTime = Date.now();
  
  try {
    const { getGlobalDataSource } = await import('@/db/global-datasource');
    const dataSource = await getGlobalDataSource();
    
    // Apply to database in bulk
    const commentRepo = dataSource.getRepository(Comment);
    const result = await commentRepo.insert(commentsData);
    
    // Get the inserted comments (use original data since insert doesn't return full records)
    const insertedComments = commentsData;
    
    // Update atoms in batch
    const currentComments = commentsAtom.get();
    const newCommentsRecord = { ...currentComments };
    
    insertedComments.forEach(comment => {
      newCommentsRecord[comment.id] = comment;
    });
    
    commentsAtom.set(newCommentsRecord);
    
    const processingTime = Date.now() - startTime;
    const throughput = (commentsData.length / processingTime) * 1000;
    console.log(`[CommentDomain] ✅ Bulk inserted ${commentsData.length} comments in ${processingTime}ms (${throughput.toFixed(0)} comments/sec)`);
    
    return insertedComments;
    
  } catch (error) {
    console.error(`[CommentDomain] ❌ Bulk insert failed for ${commentsData.length} comments:`, error);
    throw error;
  }
}

