/**
 * User Domain - Re-export from new domain service architecture
 * 
 * This file now re-exports from the new formalized domain services.
 * The old implementation has been moved to user-service.ts
 */

import { domainServices } from './index';
import type { User } from '@repo/dataforge/client-entities';
import type { CreateUserInput, UpdateUserInput } from './user-service';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';

// Re-export types
export type { User } from '@repo/dataforge/client-entities';
export type { CreateUserInput, UpdateUserInput } from './user-service';

// ============================================================================
// Function Exports (for backward compatibility)
// ============================================================================

export const createUserUI = (input: CreateUserInput): Promise<User> => domainServices.user.createUI(input);
export const updateUserUI = (id: string, updates: UpdateUserInput): Promise<User> => domainServices.user.updateUI(id, updates);
export const deleteUserUI = (id: string): Promise<boolean> => domainServices.user.deleteUI(id);
export const createUserIncoming = (user: User): Promise<User> => domainServices.user.createIncoming(user);
export const updateUserIncoming = (id: string, updates: Partial<User>): Promise<User> => domainServices.user.updateIncoming(id, updates);
export const deleteUserIncoming = (id: string): Promise<boolean> => domainServices.user.deleteIncoming(id);

// ============================================================================
// Live Query Hooks (kept for backward compatibility)
// ============================================================================

export const useUserQueries = {
  /**
   * Get all users (reactive)
   */
  allUsers: () => {
    return useLiveQuery(() => 
      db.users.toArray().then(users => 
        users.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      )
    ) || [];
  },

  /**
   * Get a single user by ID (reactive)
   */
  userById: (id: string) => {
    return useLiveQuery(
      () => id ? db.users.get(id) : undefined,
      [id]
    );
  },

  /**
   * Get user by email (reactive)
   */
  userByEmail: (email: string) => {
    return useLiveQuery(
      () => email ? db.users.where('email').equals(email).first() : undefined,
      [email]
    );
  },

  /**
   * Get user count (reactive)
   */
  userCount: () => {
    return useLiveQuery(() => db.users.count()) || 0;
  },

  /**
   * Search users by name or email (reactive)
   */
  searchUsers: (query: string) => {
    return useLiveQuery(() => {
      if (!query.trim()) return [];
      
      const searchLower = query.toLowerCase();
      return db.users
        .filter(user => 
          user.name?.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        )
        .toArray();
    }, [query]) || [];
  },
};

