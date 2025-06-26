import { Comment } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

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

// Atom Actions
export const commentActions = {
  createComment: (comment: Comment) => {
    const currentComments = commentsAtom.get();
    commentsAtom.set({ ...currentComments, [comment.id]: comment });
  },
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
  loadComments: (comments: Comment[]) => {
    const commentsRecord = comments.reduce((acc, comment) => {
      acc[comment.id] = comment;
      return acc;
    }, {} as Record<string, Comment>);
    commentsAtom.set(commentsRecord);
  },

  // Ensure comments are loaded (high-performance direct check)
  ensureLoaded: async () => {
    if (Object.keys(commentsAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const comments = await dataSource.getRepository(Comment).find({
        relations: ['author', 'task', 'project', 'parent']
      });
      commentActions.loadComments(comments);
    }
  }
};

// 3-Path Architecture Implementation using DataForge operations
export async function createCommentUI(commentData: any): Promise<Comment> {
  const { createCommentUI: createCommentOperation } = await import('@repo/dataforge/comment-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return createCommentOperation(commentData, {
    dataSource,
    atomActions: { ...commentActions, commentsAtom },
    outgoingChangeService: services?.outgoingChangeService,
    EntityClass: Comment
  });
}

export async function updateCommentUI(commentId: string, updates: any): Promise<Comment> {
  const { updateCommentUI: updateCommentOperation } = await import('@repo/dataforge/comment-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return updateCommentOperation(commentId, updates, {
    dataSource,
    atomActions: { ...commentActions, commentsAtom },
    outgoingChangeService: services?.outgoingChangeService,
    EntityClass: Comment
  });
}

export async function deleteCommentUI(commentId: string): Promise<boolean> {
  const { deleteCommentUI: deleteCommentOperation } = await import('@repo/dataforge/comment-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return deleteCommentOperation(commentId, {
    dataSource,
    atomActions: { ...commentActions, commentsAtom },
    outgoingChangeService: services?.outgoingChangeService,
    EntityClass: Comment
  });
}

export async function createCommentIncoming(commentData: Comment): Promise<Comment> {
  const { createCommentIncoming: createCommentOperation } = await import('@repo/dataforge/comment-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  
  const dataSource = await getGlobalDataSource();
  
  return createCommentOperation(commentData, {
    dataSource,
    EntityClass: Comment
  });
}

export async function updateCommentIncoming(commentId: string, updates: Partial<Comment>): Promise<Comment> {
  const { updateCommentIncoming: updateCommentOperation } = await import('@repo/dataforge/comment-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  
  const dataSource = await getGlobalDataSource();
  
  return updateCommentOperation(commentId, updates, {
    dataSource,
    EntityClass: Comment
  });
}

export async function deleteCommentIncoming(commentId: string): Promise<void> {
  const { deleteCommentIncoming: deleteCommentOperation } = await import('@repo/dataforge/comment-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  
  const dataSource = await getGlobalDataSource();
  
  await deleteCommentOperation(commentId, {
    dataSource,
    EntityClass: Comment
  });
}

export async function bulkCreateCommentsIncoming(commentsData: Comment[]): Promise<Comment[]> {
  console.log(`[CommentDomain] Bulk creating ${commentsData.length} comments - processing individually`);
  const results: Comment[] = [];
  
  for (const commentData of commentsData) {
    try {
      const comment = await createCommentIncoming(commentData);
      results.push(comment);
    } catch (error) {
      console.error(`[CommentDomain] Failed to create comment ${commentData.id}:`, error);
      throw error; // Re-throw to trigger fallback in IncomingChangeService
    }
  }
  
  return results;
}

export function createCommentLiveChanges(commentData: Comment): void {
  commentActions.createComment(commentData);
}

export function updateCommentLiveChanges(commentId: string, updates: Partial<Comment>): void {
  commentActions.updateCommentAtomOnly(commentId, updates);
}

export function deleteCommentLiveChanges(commentId: string): void {
  commentActions.deleteCommentAtomOnly(commentId);
}