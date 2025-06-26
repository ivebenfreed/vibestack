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
  createUserAtomOnly: (user: User) => {
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
  usersAtom: usersAtom, // Expose atom for DataForge operations
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

// 3-Path Architecture Implementation using DataForge operations
export async function createUserUI(userData: any): Promise<User> {
  const { createUserUI: createUserOperation } = await import('@repo/dataforge/user-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return createUserOperation(userData, {
    dataSource,
    atomActions: userActions,
    outgoingChangeService: services?.outgoingChangeService,
    EntityClass: User
  });
}

export async function updateUserUI(userId: string, updates: any): Promise<User> {
  const { updateUserUI: updateUserOperation } = await import('@repo/dataforge/user-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return updateUserOperation(userId, updates, {
    dataSource,
    atomActions: userActions,
    outgoingChangeService: services?.outgoingChangeService,
    EntityClass: User
  });
}

export async function deleteUserUI(userId: string): Promise<boolean> {
  const { deleteUserUI: deleteUserOperation } = await import('@repo/dataforge/user-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return deleteUserOperation(userId, {
    dataSource,
    atomActions: userActions,
    outgoingChangeService: services?.outgoingChangeService,
    EntityClass: User
  });
}

export async function createUserIncoming(userData: User): Promise<User> {
  const { createUserIncoming: createUserOperation } = await import('@repo/dataforge/user-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  
  const dataSource = await getGlobalDataSource();
  
  return createUserOperation(userData, {
    dataSource,
    EntityClass: User
  });
}

export async function updateUserIncoming(userId: string, updates: Partial<User>): Promise<User> {
  const { updateUserIncoming: updateUserOperation } = await import('@repo/dataforge/user-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  
  const dataSource = await getGlobalDataSource();
  
  return updateUserOperation(userId, updates, {
    dataSource,
    EntityClass: User
  });
}

export async function deleteUserIncoming(userId: string): Promise<void> {
  const { deleteUserIncoming: deleteUserOperation } = await import('@repo/dataforge/user-operations');
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  
  const dataSource = await getGlobalDataSource();
  
  await deleteUserOperation(userId, {
    dataSource,
    EntityClass: User
  });
}

export async function bulkCreateUsersIncoming(usersData: User[]): Promise<User[]> {
  console.log(`[UserDomain] Bulk creating ${usersData.length} users - processing individually`);
  const results: User[] = [];
  
  for (const userData of usersData) {
    try {
      const user = await createUserIncoming(userData);
      results.push(user);
    } catch (error) {
      console.error(`[UserDomain] Failed to create user ${userData.id}:`, error);
      throw error; // Re-throw to trigger fallback in IncomingChangeService
    }
  }
  
  return results;
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