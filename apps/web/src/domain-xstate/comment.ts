import { Comment } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// TODO: REFACTOR - Remove these DataForge operation wrappers
// These are being replaced by domain-dexie services (domainServices.comment)
// Components should use domainServices.comment.createUI/updateUI/deleteUI directly

// Export types for backward compatibility during refactoring
export type { CreateCommentInput, UpdateCommentInput } from '@repo/dataforge/comment-operations';

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

// TODO: REFACTOR - Remove these atom manipulation utilities
// These are legacy utilities that were used by DataForge operations
// Components should update atoms directly or use domain-dexie services

export const commentUtils = {
  loadComments: (comments: Comment[]) => {
    const commentsRecord = comments.reduce((acc, comment) => {
      acc[comment.id] = comment;
      return acc;
    }, {} as Record<string, Comment>);
    commentsAtom.set(commentsRecord);
  },
  
  clearComments: () => commentsAtom.set({}),
  
  // TODO: REFACTOR - This ensureLoaded pattern needs to be replaced
  // with view-based data loading like VibeGridDex
  ensureLoaded: async () => {
    console.log('[CommentUtils] ensureLoaded called - needs refactoring to view-based loading');
  }
};

