/**
 * Dexie-based User Domain
 * 
 * This is a parallel implementation that uses Dexie live queries instead of atomic stores.
 * It provides the same interface as the atomic store version but uses Dexie for data persistence and reactivity.
 * 
 * Uses the same 3-path pattern as the XState domain:
 * - UI operations: Include manual sync tracking via trackOutgoingChange
 * - Incoming operations: Server sync without tracking (to avoid loops)
 * - Direct Dexie updates: For live queries to react
 */

import { User } from '@repo/dataforge/client-entities';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';
import { nanoid } from 'nanoid';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// ============================================================================
// Types
// ============================================================================

export interface CreateUserInput {
  email: string;
  name?: string;
  avatarUrl?: string;
  role?: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  avatarUrl?: string;
  role?: string;
}

// ============================================================================
// UI Operations (with sync tracking)
// ============================================================================

/**
 * Create User from UI - includes manual sync tracking
 */
export async function createUserUI(userData: CreateUserInput): Promise<User> {
  const user: User = {
    id: nanoid(),
    email: userData.email,
    name: userData.name || '',
    avatarUrl: userData.avatarUrl,
    role: userData.role || 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientId: 'dexie-client', // TODO: Get from sync context
    userId: 'current-user', // TODO: Get from auth context
  };

  // Apply to Dexie
  await db.users.add(user);
  
  // Track for outgoing sync
  await trackOutgoingChange('users', 'insert', user);
  
  return user;
}

/**
 * Update User from UI - includes manual sync tracking
 */
export async function updateUserUI(userId: string, updates: UpdateUserInput): Promise<User> {
  const existingUser = await db.users.get(userId);
  if (!existingUser) {
    throw new Error(`User ${userId} not found`);
  }

  const updatedUser: User = {
    ...existingUser,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Apply to Dexie
  await db.users.put(updatedUser);
  
  // Track for outgoing sync
  await trackOutgoingChange('users', 'update', updatedUser);
  
  return updatedUser;
}

/**
 * Delete User from UI - includes manual sync tracking
 */
export async function deleteUserUI(userId: string): Promise<boolean> {
  const existingUser = await db.users.get(userId);
  if (!existingUser) {
    return false;
  }

  try {
    await db.transaction('rw', db.users, db.project_members, db.tasks, db.projects, async () => {
      // Delete the user
      await db.users.delete(userId);
      
      // Clean up relationships
      await db.project_members.where('userId').equals(userId).delete();
      
      // Unassign tasks
      const userTasks = await db.tasks.where('assigneeId').equals(userId).toArray();
      for (const task of userTasks) {
        await db.tasks.put({ ...task, assigneeId: undefined, updatedAt: new Date().toISOString() });
      }
      
      // Update project ownership (you might want to handle this differently)
      const userProjects = await db.projects.where('ownerId').equals(userId).toArray();
      for (const project of userProjects) {
        await db.projects.put({ ...project, ownerId: undefined, updatedAt: new Date().toISOString() });
      }
    });
    
    // Track for outgoing sync
    await trackOutgoingChange('users', 'delete', existingUser);
    
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

// ============================================================================
// Incoming Operations (no sync tracking)
// ============================================================================

/**
 * Create User from incoming sync - no tracking to avoid loops
 */
export async function createUserIncoming(userData: User): Promise<User> {
  // Apply to Dexie without tracking
  await db.users.add(userData);
  return userData;
}

/**
 * Update User from incoming sync - no tracking to avoid loops
 */
export async function updateUserIncoming(userId: string, updates: Partial<User>): Promise<User> {
  const existingUser = await db.users.get(userId);
  if (!existingUser) {
    throw new Error(`User ${userId} not found`);
  }

  const updatedUser: User = {
    ...existingUser,
    ...updates,
  };

  // Apply to Dexie without tracking
  await db.users.put(updatedUser);
  return updatedUser;
}

/**
 * Delete User from incoming sync - no tracking to avoid loops
 */
export async function deleteUserIncoming(userId: string): Promise<boolean> {
  try {
    await db.transaction('rw', db.users, db.project_members, db.tasks, db.projects, async () => {
      // Delete the user
      await db.users.delete(userId);
      
      // Clean up relationships
      await db.project_members.where('userId').equals(userId).delete();
      
      // Unassign tasks
      const userTasks = await db.tasks.where('assigneeId').equals(userId).toArray();
      for (const task of userTasks) {
        await db.tasks.put({ ...task, assigneeId: undefined, updatedAt: new Date().toISOString() });
      }
      
      // Update project ownership
      const userProjects = await db.projects.where('ownerId').equals(userId).toArray();
      for (const project of userProjects) {
        await db.projects.put({ ...project, ownerId: undefined, updatedAt: new Date().toISOString() });
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

// ============================================================================
// Service Layer (legacy interface for compatibility)
// ============================================================================

export const userService = {
  /**
   * Create a new user (delegates to UI operation)
   */
  async create(userData: CreateUserInput): Promise<User> {
    return createUserUI(userData);
  },

  /**
   * Update a user (delegates to UI operation)
   */
  async update(userId: string, updates: UpdateUserInput): Promise<User | null> {
    try {
      return await updateUserUI(userId, updates);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Delete a user (delegates to UI operation)
   */
  async delete(userId: string): Promise<boolean> {
    return deleteUserUI(userId);
  },

  /**
   * Get a single user by ID
   */
  async get(userId: string): Promise<User | null> {
    const user = await db.users.get(userId);
    return user || null;
  },

  /**
   * Get all users
   */
  async getAll(): Promise<User[]> {
    return await db.users.toArray();
  },

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<User | null> {
    const user = await db.users.where('email').equals(email).first();
    return user || null;
  },
};

// ============================================================================
// Live Query Hooks (Replace Atomic Store Hooks)
// ============================================================================

export const useUserQueries = {
  /**
   * Get all users
   */
  allUsers: () => {
    return useLiveQuery(async () => {
      const users = await db.users.toArray();
      return users.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
  },

  /**
   * Get a single user by ID
   */
  userById: (id: string) => {
    return useLiveQuery(async () => {
      return await db.users.get(id);
    }, [id]);
  },

  /**
   * Get user by email
   */
  userByEmail: (email: string) => {
    return useLiveQuery(async () => {
      if (!email) return null;
      return await db.users.where('email').equals(email).first();
    }, [email]);
  },

  /**
   * Get user count
   */
  userCount: () => {
    return useLiveQuery(async () => {
      return await db.users.count();
    });
  },

  /**
   * Search users by name or email
   */
  searchUsers: (query: string) => {
    return useLiveQuery(async () => {
      if (!query.trim()) return [];
      
      const users = await db.users.toArray();
      const searchLower = query.toLowerCase();
      
      return users.filter(user => 
        user.name?.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    }, [query]);
  },
};

// ============================================================================
// Repository Pattern (for complex operations)
// ============================================================================

export const userRepository = {
  /**
   * Get user with their projects
   */
  async getUserWithProjects(userId: string) {
    const [user, ownedProjects, memberProjects] = await Promise.all([
      db.users.get(userId),
      db.projects.where('ownerId').equals(userId).toArray(),
      db.project_members.where('userId').equals(userId).toArray()
    ]);

    if (!user) return null;

    // Get projects where user is a member but not owner
    const memberProjectIds = memberProjects.map(m => m.projectId);
    const memberProjectsData = await db.projects.bulkGet(memberProjectIds);

    return {
      ...user,
      ownedProjects,
      memberProjects: memberProjectsData.filter(Boolean),
      totalProjects: ownedProjects.length + memberProjectsData.filter(Boolean).length
    };
  },

  /**
   * Get user with their tasks
   */
  async getUserWithTasks(userId: string) {
    const [user, assignedTasks] = await Promise.all([
      db.users.get(userId),
      db.tasks.where('assigneeId').equals(userId).toArray()
    ]);

    if (!user) return null;

    const tasksByStatus = assignedTasks.reduce((acc, task) => {
      if (!acc[task.status]) acc[task.status] = [];
      acc[task.status].push(task);
      return acc;
    }, {} as Record<string, typeof assignedTasks>);

    return {
      ...user,
      assignedTasks,
      tasksByStatus,
      totalTasks: assignedTasks.length,
      completedTasks: assignedTasks.filter(t => t.status === 'completed').length
    };
  },
};

// ============================================================================
// Utilities
// ============================================================================

export const userUtils = {
  /**
   * Load users (for compatibility with atomic store pattern)
   */
  loadUsers: async (users: User[]) => {
    // Clear existing and load new users
    await db.users.clear();
    await db.users.bulkAdd(users);
  },
  
  /**
   * Clear all users
   */
  clearUsers: async () => {
    await db.users.clear();
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
   * Get user activity summary
   */
  async getUserActivity(userId: string, days: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffIso = cutoffDate.toISOString();

    const [recentTasks, recentProjects] = await Promise.all([
      db.tasks
        .where('assigneeId').equals(userId)
        .and(task => task.updatedAt > cutoffIso)
        .toArray(),
      db.projects
        .where('ownerId').equals(userId)
        .and(project => project.updatedAt > cutoffIso)
        .toArray()
    ]);

    return {
      recentTasks: recentTasks.length,
      recentProjects: recentProjects.length,
      totalActivity: recentTasks.length + recentProjects.length,
      taskUpdates: recentTasks.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ).slice(0, 10)
    };
  },
};