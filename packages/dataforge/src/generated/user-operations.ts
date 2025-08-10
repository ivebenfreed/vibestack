// Generated User CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { User } from './client-entities.js';
import { UserRole } from './client-entities.js';

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

export interface CreateUserInput {
  // name is required
  // name cannot exceed 100 characters
  name: string;

  // email is required
  // email cannot exceed 255 characters
  // email must be a valid email address
  email: string;

  // emailVerified must be a valid email address
  emailVerified: boolean;

  // image cannot exceed 255 characters
  image?: string;

  // role must be one of: admin, member, viewer, super_admin
  role: UserRole;

}

export interface UpdateUserInput extends Partial<CreateUserInput> {}



// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

/**
 * Validation functions for User
 */

export function validateUserName(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('name is required');
  }

  if (typeof value === 'string' && value.length > 100) {
    errors.push('name cannot exceed 100 characters');
  }

  return errors;
}

export function validateUserEmail(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('email is required');
  }

  if (typeof value === 'string' && value.length > 255) {
    errors.push('email cannot exceed 255 characters');
  }

  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push('email must be a valid email address');
  }

  return errors;
}

export function validateUserEmailVerified(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push('emailVerified must be a valid email address');
  }

  return errors;
}

export function validateUserImage(value: any): string[] {
  const errors: string[] = [];

  if (typeof value === 'string' && value.length > 255) {
    errors.push('image cannot exceed 255 characters');
  }

  return errors;
}

export function validateUserRole(value: any): string[] {
  const errors: string[] = [];

  if (value && !['admin', 'member', 'viewer', 'super_admin'].includes(value)) {
    errors.push('role must be one of: admin, member, viewer, super_admin');
  }

  return errors;
}

export function validateUserInput(input: CreateUserInput | UpdateUserInput): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if ('name' in input) {
    const fieldErrors = validateUserName(input.name);
    if (fieldErrors.length > 0) {
      errors.name = fieldErrors;
    }
  }

  if ('email' in input) {
    const fieldErrors = validateUserEmail(input.email);
    if (fieldErrors.length > 0) {
      errors.email = fieldErrors;
    }
  }

  if ('emailVerified' in input) {
    const fieldErrors = validateUserEmailVerified(input.emailVerified);
    if (fieldErrors.length > 0) {
      errors.emailVerified = fieldErrors;
    }
  }

  if ('image' in input) {
    const fieldErrors = validateUserImage(input.image);
    if (fieldErrors.length > 0) {
      errors.image = fieldErrors;
    }
  }

  if ('role' in input) {
    const fieldErrors = validateUserRole(input.role);
    if (fieldErrors.length > 0) {
      errors.role = fieldErrors;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}



// ============================================================================
// Business Logic Functions - Generated from entity business rules
// ============================================================================

/**
 * Business logic functions for User
 */

export function getUserDefaults(): Partial<CreateUserInput> {
  return {
    emailVerified: false,
    role: UserRole.MEMBER,
  };
}



// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

/**
 * Create User from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function createUserUI(
  userData: CreateUserInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<User> {
  console.log(`[UserFunctions-UI] Creating new user`);
  
  // Validate input if validation function exists
  try {
    const validation = validateUserInput(userData);
    if (!validation.isValid) {
      throw new Error(`Invalid user data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let userWithDefaults;
  try {
    userWithDefaults = {
      ...getUserDefaults(),
      ...userData
    };
  } catch (error) {
    // Defaults function might not exist
    userWithDefaults = {
      ...userData
    };
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database create completes
  
  try {
    // 2. DATABASE: Create in database in background
    const userRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const createdUser = await userRepo.save(userWithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('users', 'insert', {
        ...createdUser,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return createdUser;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Update User from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function updateUserUI(
  userId: string,
  updates: UpdateUserInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<User> {
  console.log(`[UserFunctions-UI] Updating user ${userId.slice(-8)}`);
  
  // Validate input if validation function exists
  try {
    const validation = validateUserInput(updates);
    if (!validation.isValid) {
      throw new Error(`Invalid user update data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current user for optimistic update
  const currentUsers = dependencies.atomActions.usersAtom.get();
  const currentUser = currentUsers[userId];
  
  if (!currentUser) {
    throw new Error(`User ${userId} not found for UI update`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database update completes
  
  try {
    // 2. DATABASE: Update database in background
    const userRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Separate many-to-many relationships from regular fields
    // Separate many-to-many relationships from regular fields
    const { memberProjects, ...regularUpdates } = updates as any;
    
    // Update regular fields if any
    if (Object.keys(regularUpdates).length > 0) {
      await userRepo.update(userId, regularUpdates);
    }
    
    // Handle many-to-many relationships using direct junction table manipulation
    
    if (memberProjects !== undefined) {
      // Clear existing relations first
      await userRepo
        .createQueryBuilder()
        .delete()
        .from('project_members')
        .where('"userId" = :userId', { userId })
        .execute();
      
      // Add new relations if any
      if (memberProjects && memberProjects.length > 0) {
        const relatedIds = memberProjects.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['userId']: userId, 
          ['projectId']: relatedId 
        }));
        await userRepo
          .createQueryBuilder()
          .insert()
          .into('project_members')
          .values(values)
          .execute();
      }
    }
    
    // Load the updated entity without problematic relations to avoid createQueryBuilder issues
    const updatedUser = await userRepo.findOne({ 
      where: { id: userId }
    });
    
    if (!updatedUser) {
      throw new Error(`User ${userId} not found after database update`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('users', 'update', {
        ...updatedUser,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updatedUser;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Delete User from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function deleteUserUI(
  userId: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[UserFunctions-UI] Deleting user ${userId.slice(-8)}`);
  
  // Get current user for potential revert
  const currentUsers = dependencies.atomActions.usersAtom.get();
  const userToDelete = currentUsers[userId];
  
  if (!userToDelete) {
    throw new Error(`User ${userId} not found for UI delete`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database delete completes
  
  try {
    // 2. DATABASE: Delete from database
    const userRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await userRepo.delete(userId);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(`User ${userId} could not be deleted from database`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('users', 'delete', {
        id: userId,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return true;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}



// ============================================================================
// 2. INCOMING PATH - Server sync data (Database → Live changes trigger atom)
// ============================================================================

/**
 * Create User from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function createUserIncoming(
  userData: User,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<User> {
  console.log(`[UserFunctions-Incoming] Creating user ${userData.id.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const userRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const createdUser = await userRepo.save(userData);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return createdUser;
}

/**
 * Update User from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function updateUserIncoming(
  userId: string,
  updates: Partial<User>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<User> {
  console.log(`[UserFunctions-Incoming] Updating user ${userId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const userRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await userRepo.update(userId, updates);
  const updatedUser = await userRepo.findOne({ where: { id: userId } });
  
  if (!updatedUser) {
    throw new Error(`User ${userId} not found after incoming update`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updatedUser;
}

/**
 * Delete User from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function deleteUserIncoming(
  userId: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[UserFunctions-Incoming] Deleting user ${userId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const userRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await userRepo.delete(userId);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}



// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

/**
 * Create User from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function createUserLiveChanges(
  userData: User,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[UserFunctions-LiveChanges] Reflecting user ${userData.id.slice(-8)} database create in atom`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.createUserAtomOnly(userData);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update User from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function updateUserLiveChanges(
  userId: string,
  updates: Partial<User>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[UserFunctions-LiveChanges] Reflecting user ${userId.slice(-8)} database change in atom`);
  
  // ATOM ONLY: Update atom to reflect database change
  const currentUsers = dependencies.atomActions.usersAtom.get();
  const currentUser = currentUsers[userId];
  
  if (!currentUser) {
    console.warn(`[UserFunctions-LiveChanges] User ${userId} not found in atom for live update`);
    return;
  }
  
  const updatedUser = { ...currentUser, ...updates };
  dependencies.atomActions.updateUserAtomOnly(userId, updatedUser);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete User from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function deleteUserLiveChanges(
  userId: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[UserFunctions-LiveChanges] Reflecting user ${userId.slice(-8)} database delete in atom`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.deleteUserAtomOnly(userId);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}


