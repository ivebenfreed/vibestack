/**
 * User Domain Service
 * 
 * Implements user-specific CRUD operations with business logic and sync tracking.
 * Uses the User entity type from DataForge for full type safety.
 */

import { User } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { nanoid } from 'nanoid';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// ============================================================================
// Input Types
// ============================================================================

export interface CreateUserInput {
  email: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'suspended';
  preferences?: Record<string, any>;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  avatarUrl?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'suspended';
  preferences?: Record<string, any>;
  lastLoginAt?: string;
}

// ============================================================================
// User Domain Service Implementation
// ============================================================================

export class UserDomainService extends BaseDomainService<User, CreateUserInput, UpdateUserInput> {
  tableName = 'users';
  entityName = 'User';
  
  protected getTable() {
    return db.users;
  }
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateUserInput): Promise<User> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Check for duplicate email
    const existingUser = await db.users.where('email').equals(input.email).first();
    if (existingUser) {
      throw new Error(`User with email ${input.email} already exists`);
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    const now = new Date().toISOString();
    const user: User = {
      id: nanoid(),
      email: processedInput.email,
      name: processedInput.name,
      avatarUrl: processedInput.avatarUrl || null,
      role: processedInput.role || 'member',
      status: processedInput.status || 'active',
      preferences: processedInput.preferences || {},
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      clientId: nanoid(),
    } as User;
    
    // Save to Dexie
    await db.users.add(user);
    
    // Track for outgoing sync
    await trackOutgoingChange('users', 'insert', user);
    
    console.log('[UserService] Created user', {
      id: user.id,
      email: user.email,
      name: user.name,
      trackingSync: true
    });
    
    // Call after hook if defined
    if (this.afterCreate) {
      await this.afterCreate(user);
    }
    
    return user;
  }
  
  async updateUI(id: string, updates: UpdateUserInput): Promise<User> {
    const existing = await db.users.get(id);
    if (!existing) {
      throw new Error(`User ${id} not found`);
    }
    
    // Validate input
    if (this.validateUpdate) {
      this.validateUpdate(id, updates);
    }
    
    // Check for duplicate email if email is being changed
    if (updates.email && updates.email !== existing.email) {
      const duplicateUser = await db.users.where('email').equals(updates.email).first();
      if (duplicateUser) {
        throw new Error(`User with email ${updates.email} already exists`);
      }
    }
    
    // Apply transformations
    const processedUpdates = this.beforeUpdate 
      ? this.beforeUpdate(id, updates, existing) 
      : updates;
    
    // Use base class helper for common update logic
    const updated = await this.performUpdate(id, processedUpdates);
    
    // Call after hook if defined
    if (this.afterUpdate) {
      await this.afterUpdate(updated, existing);
    }
    
    return updated;
  }
  
  async deleteUI(id: string): Promise<boolean> {
    // Check if user has assigned tasks before deleting
    const taskCount = await db.tasks.where('assigneeId').equals(id).count();
    if (taskCount > 0) {
      throw new Error(`Cannot delete user ${id} - they have ${taskCount} assigned tasks`);
    }
    
    // Check if user owns any projects
    const projectCount = await db.projects.where('ownerId').equals(id).count();
    if (projectCount > 0) {
      throw new Error(`Cannot delete user ${id} - they own ${projectCount} projects`);
    }
    
    return this.performDelete(id);
  }
  
  // ============================================================================
  // Incoming Operations (no sync tracking)
  // ============================================================================
  
  async createIncoming(user: User): Promise<User> {
    await db.users.put(user);
    console.log('[UserService] Created user from incoming sync', {
      id: user.id,
      email: user.email,
      name: user.name
    });
    return user;
  }
  
  async updateIncoming(id: string, updates: Partial<User>): Promise<User> {
    const existing = await db.users.get(id);
    if (!existing) {
      throw new Error(`User ${id} not found`);
    }
    
    const updated: User = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    
    await db.users.put(updated);
    console.log('[UserService] Updated user from incoming sync', {
      id: updated.id,
      updates
    });
    
    return updated;
  }
  
  async deleteIncoming(id: string): Promise<boolean> {
    const existing = await db.users.get(id);
    if (!existing) {
      return false;
    }
    
    await db.users.delete(id);
    console.log('[UserService] Deleted user from incoming sync', { id });
    
    return true;
  }
  
  // ============================================================================
  // Validation Hooks
  // ============================================================================
  
  protected validateCreate(input: CreateUserInput): void {
    if (!input.email || input.email.trim().length === 0) {
      throw new Error('User email is required');
    }
    
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('User name is required');
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new Error('Invalid email format');
    }
    
    if (input.name.length > 255) {
      throw new Error('User name cannot exceed 255 characters');
    }
  }
  
  protected validateUpdate(id: string, updates: UpdateUserInput): void {
    if (updates.email !== undefined) {
      if (updates.email.trim().length === 0) {
        throw new Error('User email cannot be empty');
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        throw new Error('Invalid email format');
      }
    }
    
    if (updates.name !== undefined) {
      if (updates.name.trim().length === 0) {
        throw new Error('User name cannot be empty');
      }
      
      if (updates.name.length > 255) {
        throw new Error('User name cannot exceed 255 characters');
      }
    }
  }
  
  // ============================================================================
  // Business Logic Hooks
  // ============================================================================
  
  protected beforeCreate(input: CreateUserInput): CreateUserInput {
    // Apply any default transformations
    return {
      ...input,
      // Normalize email to lowercase
      email: input.email.toLowerCase().trim(),
      // Trim name
      name: input.name.trim(),
      // Default to active status
      status: input.status || 'active',
      // Default to member role
      role: input.role || 'member',
      // Initialize empty preferences if not provided
      preferences: input.preferences || {},
    };
  }
  
  protected beforeUpdate(id: string, updates: UpdateUserInput, existing: User): UpdateUserInput {
    const processed = { ...updates };
    
    // Normalize email if being updated
    if (updates.email) {
      processed.email = updates.email.toLowerCase().trim();
    }
    
    // Trim name if being updated
    if (updates.name) {
      processed.name = updates.name.trim();
    }
    
    return processed;
  }
  
  // ============================================================================
  // Additional User-Specific Methods
  // ============================================================================
  
  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<User> {
    return this.updateUI(userId, {
      lastLoginAt: new Date().toISOString()
    });
  }
  
  /**
   * Update user status
   */
  async updateStatus(userId: string, status: 'active' | 'inactive' | 'suspended'): Promise<User> {
    return this.updateUI(userId, { status });
  }
  
  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: Record<string, any>): Promise<User> {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    // Merge with existing preferences
    const mergedPreferences = {
      ...user.preferences,
      ...preferences
    };
    
    return this.updateUI(userId, { preferences: mergedPreferences });
  }
  
  /**
   * Get user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.users.where('email').equals(normalizedEmail).first();
    return user || null;
  }
}