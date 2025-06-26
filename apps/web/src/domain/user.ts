import { User } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

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

// Atom Actions
export const userActions = {
  createUser: (user: User) => {
    const currentUsers = usersAtom.get();
    usersAtom.set({ ...currentUsers, [user.id]: user });
  },
  updateUserAtomOnly: (id: string, updates: Partial<User>) => {
    const currentUsers = usersAtom.get();
    const existingUser = currentUsers[id];
    if (existingUser) {
      usersAtom.set({ ...currentUsers, [id]: { ...existingUser, ...updates } });
    }
  },
  deleteUserAtomOnly: (id: string) => {
    const currentUsers = usersAtom.get();
    const { [id]: deleted, ...remaining } = currentUsers;
    usersAtom.set(remaining);
  },
  loadUsers: (users: User[]) => {
    const usersRecord = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, User>);
    usersAtom.set(usersRecord);
  },

  // Ensure users are loaded (high-performance direct check)
  ensureLoaded: async () => {
    if (Object.keys(usersAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const users = await dataSource.getRepository(User).find();
      userActions.loadUsers(users);
    }
  }
};

// 3-Path Architecture Wrapper Functions (stubs for now)
export async function createUserUI(userData: any): Promise<User> {
  throw new Error('createUserUI not implemented yet - use user operations from @repo/dataforge');
}

export async function updateUserUI(userId: string, updates: any): Promise<User> {
  throw new Error('updateUserUI not implemented yet - use user operations from @repo/dataforge');
}

export async function deleteUserUI(userId: string): Promise<boolean> {
  throw new Error('deleteUserUI not implemented yet - use user operations from @repo/dataforge');
}

export async function createUserIncoming(userData: User): Promise<User> {
  throw new Error('createUserIncoming not implemented yet - use user operations from @repo/dataforge');
}

export async function updateUserIncoming(userId: string, updates: Partial<User>): Promise<User> {
  throw new Error('updateUserIncoming not implemented yet - use user operations from @repo/dataforge');
}

export async function deleteUserIncoming(userId: string): Promise<void> {
  throw new Error('deleteUserIncoming not implemented yet - use user operations from @repo/dataforge');
}

export function createUserLiveChanges(userData: User): void {
  userActions.createUser(userData);
}

export function updateUserLiveChanges(userId: string, updates: Partial<User>): void {
  userActions.updateUserAtomOnly(userId, updates);
}

export function deleteUserLiveChanges(userId: string): void {
  userActions.deleteUserAtomOnly(userId);
}