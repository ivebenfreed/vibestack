import { v4 as uuidv4 } from 'uuid';
import { DeepPartial } from 'typeorm';
import { User } from '@repo/dataforge/client-entities';
import { BaseRepository, BaseService, DatabaseServiceError, EventDispatcher } from './base';
import { OutgoingChangeProcessor } from '../sync/OutgoingChangeProcessor';
import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { useMemo } from 'react';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Note: Live changes types moved to centralized LiveChangesManager

// Main users store - holds all users in normalized format
export const usersAtom = createAtom<Record<string, User>>({});

// Note: Live changes state removed - now handled centrally by LiveChangesManager

// ============================================================================
// React Hooks (Pure XState)
// ============================================================================

export const useUserAtoms = {
  // All users as sorted array
  allUsers: () => {
    return useSelector(
      usersAtom,
      (usersRecord) => {
        const users = Object.values(usersRecord);
        return users.sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          return aName.localeCompare(bName); // Alphabetical order
        });
      },
      shallowEqual
    );
  },

  // Individual user by ID
  user: (userId: string) => {
    return useSelector(
      usersAtom,
      (usersRecord) => usersRecord[userId] || null
    );
  },

  // Note: No need for separate userIds with XState selectors

  // User stats
  userStats: () => {
    return useSelector(
      usersAtom,
      (usersRecord) => {
        const users = Object.values(usersRecord);
        const total = users.length;
        
        return { total };
      },
      shallowEqual
    );
  },

  // Note: Live changes state now managed centrally
};

// ============================================================================
// Actions (Pure XState)
// ============================================================================

export const userActions = {
  // 🎯 COMPARTMENTALIZED LOADING: Atoms handle their own database loading
  ensureLoaded: async () => {
    const current = usersAtom.get();
    if (Object.keys(current).length > 0) {
      console.log(`[UserAtoms] Users already loaded - skipping (${Object.keys(current).length} users)`);
      return; // Already loaded
    }
    
    console.log('[UserAtoms] Loading users from database...');
    try {
      // ✅ FIXED: Use global datasource singleton to prevent race conditions
      const { getGlobalDataSource } = await import('../db/global-datasource');
      const dataSource = await getGlobalDataSource();
      
      if (!dataSource.isInitialized) {
        console.warn('[UserAtoms] DataSource not ready, skipping load');
        return;
      }
      
      const users = await dataSource.getRepository(User).find();
      
      // Create normalized record
      const usersRecord: Record<string, User> = {};
      users.forEach(user => {
        usersRecord[user.id] = user;
      });
      
      // Update atom
      usersAtom.set(usersRecord);
      console.log(`[UserAtoms] ✅ Loaded ${users.length} users`);
      
    } catch (error) {
      console.error('[UserAtoms] Failed to load users:', error);
      // Don't throw - let components handle empty state gracefully
    }
  },

  // Bulk load users (for external data sources)
  loadUsers: (users: User[]) => {
    // Create normalized record - no presorting needed with XState selectors
    const usersRecord: Record<string, User> = {};
    users.forEach(user => {
      usersRecord[user.id] = user;
    });
    
    // Update atom
    usersAtom.set(usersRecord);
    console.log(`[UserAtoms] Bulk loaded ${users.length} users`);
  },

  // Update individual user
  updateUser: (userId: string, updates: Partial<User>) => {
    const currentUsers = usersAtom.get();
    const currentUser = currentUsers[userId];
    
    if (!currentUser) {
      console.warn(`[UserService] User ${userId} not found for update`);
      return;
    }
    
    const updatedUser = { ...currentUser, ...updates, updatedAt: new Date() };
    
    // Update users record
    usersAtom.set({
      ...currentUsers,
      [userId]: updatedUser
    });
    
    console.log(`[UserService] Updated user ${userId}`);
  },

  // Create user
  createUser: (user: User) => {
    const currentUsers = usersAtom.get();
    
    // Add to users record
    usersAtom.set({
      ...currentUsers,
      [user.id]: { ...user, updatedAt: new Date() }
    });
    
    console.log(`[UserService] Created user ${user.id}`);
  },

  // Delete user
  deleteUser: (userId: string) => {
    const currentUsers = usersAtom.get();
    
    // Remove from users record
    const { [userId]: removed, ...remainingUsers } = currentUsers;
    usersAtom.set(remainingUsers);
    
    console.log(`[UserService] Deleted user ${userId}`);
  },
};

// ============================================================================
// Note: Live Changes Integration removed - now handled centrally by LiveChangesManager
// ============================================================================

// ============================================================================
// Atomic Store Implementation (UserAtomStore replacement)
// ============================================================================

class UserAtomStore {
  // XState atoms for compatibility with existing interfaces
  usersAtom = usersAtom
  
  // Compatibility methods for existing code
  getUserAtom = (id: string) => {
    return {
      get: () => {
        const usersRecord = usersAtom.get();
        return usersRecord[id] || null;
      },
      isXStateAtom: true,
      userId: id
    };
  }

  // Derived atom equivalent for compatibility
  allUsersAtom = {
    get: () => Object.values(usersAtom.get())
  }

  // Bulk load compatibility
  syncBulkLoad = {
    set: (users: User[]) => userActions.loadUsers(users)
  }

  // Note: Live changes methods removed - now handled centrally by LiveChangesManager
}

// Repository
export class UserRepository extends BaseRepository<User> {
  constructor(dataSource: NewPGliteDataSource) {
    if (!dataSource.isInitialized) {
      throw new Error('DataSource must be initialized before creating UserRepository');
    }
    super(dataSource.getRepository(User), 'user', dataSource);
  }

  // User-specific repository methods can be added here
}

// Service
export class UserService extends BaseService<User> {
  constructor(
    protected userRepository: UserRepository,
    protected syncChangeManager: OutgoingChangeProcessor
  ) {
    super(userRepository, 'users', syncChangeManager);
    
    // Set up entity-specific sync processing methods
    this.validateSyncData = this.validateUserSyncData.bind(this);
  }

  /**
   * Override to specify user-specific date fields
   */
  getDateFields(): string[] {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * Validate user sync data
   */
  private validateUserSyncData(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
    if (operation === 'INSERT') {
      if (!data.name || !data.email) {
        throw new Error(`User INSERT requires name and email. Received: ${JSON.stringify(data)}`);
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error(`Invalid email format: ${data.email}`);
      }
    }
    
    if (operation === 'UPDATE' || operation === 'DELETE') {
      if (!data.id) {
        throw new Error(`User ${operation} requires an id. Received: ${JSON.stringify(data)}`);
      }
    }
  }

  async get(id: string): Promise<User | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to get user with ID ${id}`,
        'get',
        error
      );
    }
  }

  async createUser(userData: { name: string; email: string }): Promise<User> {
    try {
      const now = new Date();
      const userId = uuidv4();
      
      const newUser = {
        id: userId,
        name: userData.name,
        email: userData.email,
        createdAt: now,
        updatedAt: now
      } as User;

            // ✅ USE INHERITED METHOD: createWithProcessing handles sync tracking automatically
      const createdUser = await this.createWithProcessing(newUser as Record<string, any>);
      
      // ✅ OPTIMISTIC UPDATE: Add new user to atom immediately
      userActions.createUser(createdUser);
      
      // Optimized event dispatching
      EventDispatcher.emit('user:created', { user: createdUser });
      
      return createdUser;
    } catch (error) {
      throw new DatabaseServiceError(
        'Failed to create user',
        'createUser',
        error
      );
    }
  }

  async updateUser(id: string, changes: Partial<User>): Promise<User> {
    try {
      const user = await this.repository.findById(id);
      if (!user) {
        throw new Error(`User with ID ${id} not found`);
      }
      
      const updatedData = {
        ...changes,
        updatedAt: new Date()
      } as DeepPartial<User>;
      
            // ✅ USE INHERITED METHOD: updateWithProcessing handles sync tracking automatically
      const updatedUser = await this.updateWithProcessing(id, updatedData as Record<string, any>);
      
      // ✅ OPTIMISTIC UPDATE: Update user in atom immediately
      userActions.updateUser(id, updatedUser);
      
      // Optimized event dispatching
      EventDispatcher.emit('user:updated', { user: updatedUser });
      
      return updatedUser;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to update user with ID ${id}`,
        'updateUser',
        error
      );
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const user = await this.repository.findById(id);
      if (!user) {
        throw new Error(`User with ID ${id} not found`);
      }
      
            // ✅ USE INHERITED METHOD: deleteWithProcessing handles sync tracking automatically
      const success = await this.deleteWithProcessing(id);
      
      // ✅ OPTIMISTIC UPDATE: Remove user from atom immediately
      if (success) {
        userActions.deleteUser(id);
      }
      
      // Optimized event dispatching
      EventDispatcher.emit('user:deleted', { userId: id });
      
      return success;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to delete user with ID ${id}`,
        'deleteUser',
        error
      );
    }
  }

  // ============================================================================
  // ATOMIC STORE - INTEGRATED ATOMIC REACTIVITY
  // ============================================================================
  
  static atoms: UserAtomStore;

  // Note: Live changes methods removed - now handled centrally by LiveChangesManager

  // ============================================================================
  // LIVE QUERY BUILDERS (using our existing patterns)
  // ============================================================================
  
  static createQueryBuilders(createQueryBuilder: Function) {
    return {
      all: () => {
        return createQueryBuilder(User, 'user')
          .orderBy('user.name', 'ASC')
      },

      detail: (id: string) => {
        return createQueryBuilder(User, 'user')
          .where('user.id = :id', { id })
      },
    }
  }

  // ============================================================================
  // REMOVED: React Query sections eliminated (~200 lines)
  // Replaced with atomic reactivity via UserService.atoms
  // ============================================================================
}

// ============================================================================
// ATOMIC STORE INSTANCE - Exported for Universal Entity Table v2
// ============================================================================

// 🎯 FIX: Use lazy initialization to prevent circular dependency
const userAtoms = new UserAtomStore();

// Lazy getter for UserService.atoms to avoid initialization order issues
Object.defineProperty(UserService, 'atoms', {
  get() {
    return userAtoms;
  },
  enumerable: true,
  configurable: true
});

export { userAtoms };

// Factory function for this domain
export function createUserDomain(
  dataSource: NewPGliteDataSource, 
  syncManager: OutgoingChangeProcessor
) {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before creating User domain');
  }
  
  const repository = new UserRepository(dataSource);
  const service = new UserService(repository, syncManager);
  
  return { repository, service };
} 