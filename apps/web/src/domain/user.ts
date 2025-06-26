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
  if (usersData.length === 0) return [];
  
  console.log(`[UserDomain] Bulk creating ${usersData.length} users from incoming sync`);
  const startTime = Date.now();
  
  try {
    const { getGlobalDataSource } = await import('@/db/global-datasource');
    const dataSource = await getGlobalDataSource();
    
    // Apply to database in bulk
    const userRepo = dataSource.getRepository(User);
    const result = await userRepo.insert(usersData);
    
    // Get the inserted users (use original data since insert doesn't return full records)
    const insertedUsers = usersData;
    
    // Update atoms in batch
    const currentUsers = usersAtom.get();
    const newUsersRecord = { ...currentUsers };
    
    insertedUsers.forEach(user => {
      newUsersRecord[user.id] = user;
    });
    
    usersAtom.set(newUsersRecord);
    
    const processingTime = Date.now() - startTime;
    const throughput = (usersData.length / processingTime) * 1000;
    console.log(`[UserDomain] ✅ Bulk inserted ${usersData.length} users in ${processingTime}ms (${throughput.toFixed(0)} users/sec)`);
    
    return insertedUsers;
    
  } catch (error) {
    console.error(`[UserDomain] ❌ Bulk insert failed for ${usersData.length} users:`, error);
    throw error;
  }
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