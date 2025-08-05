import { User } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// TODO: REFACTOR - Remove these DataForge operation wrappers
// These are being replaced by domain-dexie services (domainServices.user)
// Components should use domainServices.user.createUI/updateUI/deleteUI directly

// Export types for backward compatibility during refactoring
export type { CreateUserInput, UpdateUserInput } from '@repo/dataforge/user-operations';

// Main users store - holds all users in normalized format
export const usersAtom = createAtom<Record<string, User>>({});

// React Hooks
export const useUserAtoms = {
  allUsers: () => {
    return useSelector(
      usersAtom,
      (usersRecord) => Object.values(usersRecord),
      shallowEqual
    );
  },
  userById: (id: string) => {
    return useSelector(
      usersAtom,
      (usersRecord) => usersRecord[id] || null,
      shallowEqual
    );
  }
};

// TODO: REFACTOR - Remove these atom manipulation utilities
// These are legacy utilities that were used by DataForge operations
// Components should update atoms directly or use domain-dexie services

export const userUtils = {
  loadUsers: (users: User[]) => {
    const usersRecord = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, User>);
    usersAtom.set(usersRecord);
  },
  
  clearUsers: () => usersAtom.set({}),
  
  // TODO: REFACTOR - This ensureLoaded pattern needs to be replaced
  // with view-based data loading like VibeGridDex
  ensureLoaded: async () => {
    console.log('[UserUtils] ensureLoaded called - needs refactoring to view-based loading');
  }
};

