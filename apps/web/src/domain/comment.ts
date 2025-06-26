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

// 3-Path Architecture Wrapper Functions (stubs for now)
export async function createCommentUI(commentData: any): Promise<Comment> {
  throw new Error('createCommentUI not implemented yet - use comment operations from @repo/dataforge');
}

export async function updateCommentUI(commentId: string, updates: any): Promise<Comment> {
  throw new Error('updateCommentUI not implemented yet - use comment operations from @repo/dataforge');
}

export async function deleteCommentUI(commentId: string): Promise<boolean> {
  throw new Error('deleteCommentUI not implemented yet - use comment operations from @repo/dataforge');
}

export async function createCommentIncoming(commentData: Comment): Promise<Comment> {
  throw new Error('createCommentIncoming not implemented yet - use comment operations from @repo/dataforge');
}

export async function updateCommentIncoming(commentId: string, updates: Partial<Comment>): Promise<Comment> {
  throw new Error('updateCommentIncoming not implemented yet - use comment operations from @repo/dataforge');
}

export async function deleteCommentIncoming(commentId: string): Promise<void> {
  throw new Error('deleteCommentIncoming not implemented yet - use comment operations from @repo/dataforge');
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