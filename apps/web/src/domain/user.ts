import { User } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// Import DataForge operations
import {
  createUserUI as _createUserUI,
  updateUserUI as _updateUserUI,
  deleteUserUI as _deleteUserUI,
  createUserIncoming as _createUserIncoming,
  updateUserIncoming as _updateUserIncoming,
  deleteUserIncoming as _deleteUserIncoming,
  createUserLiveChanges as _createUserLiveChanges,
  updateUserLiveChanges as _updateUserLiveChanges,
  deleteUserLiveChanges as _deleteUserLiveChanges,
  type CreateUserInput,
  type UpdateUserInput
} from '@repo/dataforge/user-operations';

// Export types
export type { CreateUserInput, UpdateUserInput };

// Wrapper functions that handle dependencies internally
export async function createUserUI(userData: CreateUserInput): Promise<User> {
  const dependencies = await getUserDependencies();
  return _createUserUI(userData, dependencies);
}

export async function updateUserUI(userId: string, updates: UpdateUserInput): Promise<User> {
  const dependencies = await getUserDependencies();
  return _updateUserUI(userId, updates, dependencies);
}

export async function deleteUserUI(userId: string): Promise<boolean> {
  const dependencies = await getUserDependencies();
  return _deleteUserUI(userId, dependencies);
}

export async function createUserIncoming(userData: User): Promise<User> {
  const dependencies = await getUserDependencies();
  return _createUserIncoming(userData, dependencies);
}

export async function updateUserIncoming(userId: string, updates: Partial<User>): Promise<User> {
  const dependencies = await getUserDependencies();
  return _updateUserIncoming(userId, updates, dependencies);
}

export async function deleteUserIncoming(userId: string): Promise<boolean> {
  const dependencies = await getUserDependencies();
  return _deleteUserIncoming(userId, dependencies);
}

export function createUserLiveChanges(userData: User): void {
  const dependencies = { atomActions };
  return _createUserLiveChanges(userData, dependencies);
}

export function updateUserLiveChanges(userId: string, updates: Partial<User>): void {
  const dependencies = { atomActions };
  return _updateUserLiveChanges(userId, updates, dependencies);
}

export function deleteUserLiveChanges(userId: string): void {
  const dependencies = { atomActions };
  return _deleteUserLiveChanges(userId, dependencies);
}

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

// ============================================================================
// Atom Utilities for DataForge Operations
// ============================================================================

export const atomActions = {
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
  
  // Expose atom for DataForge operations
  usersAtom: usersAtom
};

export const userUtils = {
  loadUsers: (users: User[]) => {
    const usersRecord = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, User>);
    usersAtom.set(usersRecord);
  },
  
  clearUsers: () => usersAtom.set({}),
  
  ensureLoaded: async () => {
    if (Object.keys(usersAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const users = await dataSource.getRepository(User).find();
      userUtils.loadUsers(users);
    }
  }
};

// Helper to get dependencies for DataForge operations
export async function getUserDependencies() {
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return {
    dataSource,
    EntityClass: User,
    atomActions,
    outgoingChangeService: services?.outgoingChangeService || null
  };
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

