/**
 * User Entity - Special Platform Entity
 * 
 * Adapted from archived DataForge MikroORM entity to Kysely-based system.
 * Extends BaseUserEntity for Better Auth compatibility while maintaining platform-level classification.
 * Users are special entities that exist at the platform level, not within containers.
 */

import { BaseUserEntity } from '../../base/BaseUserEntity';
import type { BaseUserEntityFields } from '../../base/BaseUserEntity';

export interface UserFields extends BaseUserEntityFields {
  // Inherits all fields from BaseUserEntity
  // Additional user-specific fields can be added here if needed
}

export class User extends BaseUserEntity {
  constructor(data?: Partial<UserFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set user-specific defaults
    if (!this.role) this.role = 'member';
    // Archetype is not set for users as they exist at platform level
  }

  /**
   * Get the Kysely schema definition for User table
   */
  static getKyselySchema() {
    return super.getKyselySchema();
  }

  /**
   * Get the SQL DDL for User table creation
   */
  static getUserDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "user" (
        ${super.getUserDDL()},
        CONSTRAINT chk_user_role CHECK (role IN ('super_admin', 'admin', 'member', 'owner', 'user')),
        CONSTRAINT chk_user_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$')
      );
    `;
  }

  /**
   * Get the indexes for User table
   */
  static getUserIndexes(): string[] {
    return [
      ...super.getUserIndexes('user'),
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON "user"(email) WHERE email IS NOT NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_user_is_super_admin ON "user"(is_super_admin);`,
      `CREATE INDEX IF NOT EXISTS idx_user_role ON "user"(role);`,
      `CREATE INDEX IF NOT EXISTS idx_user_better_auth_id ON "user"(better_auth_user_id);`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): UserFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      name: this.name,
      email: this.email,
      email_verified: this.email_verified || false,
      image: this.image,
      is_super_admin: this.is_super_admin || false,
      role: this.role || 'member',
      better_auth_user_id: this.better_auth_user_id
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<UserFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      name: this.name,
      email: this.email,
      email_verified: this.email_verified,
      image: this.image,
      is_super_admin: this.is_super_admin,
      role: this.role,
      better_auth_user_id: this.better_auth_user_id
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): UserFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      name: this.name,
      email: this.email,
      email_verified: this.email_verified,
      image: this.image,
      is_super_admin: this.is_super_admin,
      role: this.role,
      better_auth_user_id: this.better_auth_user_id
    };
  }

  // Business logic methods

  /**
   * Check if user is a super administrator
   */
  isSuperAdmin(): boolean {
    return this.is_super_admin;
  }

  /**
   * Check if user is an administrator (role-based)
   */
  isAdmin(): boolean {
    return this.role === 'admin' || this.isSuperAdmin();
  }

  /**
   * Check if user is a moderator or higher
   */
  isModerator(): boolean {
    return ['moderator', 'admin'].includes(this.role) || this.isSuperAdmin();
  }

  /**
   * Check if user can manage organizations
   */
  canManageOrganizations(): boolean {
    return this.isSuperAdmin();
  }

  /**
   * Check if user has verified email
   */
  hasVerifiedEmail(): boolean {
    return this.email_verified && !!this.email;
  }

  /**
   * Get display name (name or email fallback)
   */
  getDisplayName(): string {
    return this.name || this.email || `User ${this.id.slice(0, 8)}`;
  }

  /**
   * Get user initials for avatar fallback
   */
  getInitials(): string {
    if (this.name) {
      return this.name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (this.email) {
      return this.email[0].toUpperCase();
    }
    return 'U';
  }

  /**
   * Check if user account is complete
   */
  isAccountComplete(): boolean {
    return !!(this.name && this.email && this.email_verified);
  }

  /**
   * Get user's profile image URL or generate avatar URL
   */
  getAvatarUrl(): string {
    if (this.image) {
      return this.image;
    }
    // Generate a simple avatar URL using initials
    const initials = this.getInitials();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
  }

  /**
   * Update user's role with validation
   */
  updateRole(newRole: string): void {
    const validRoles = ['member', 'moderator', 'admin'];
    if (validRoles.includes(newRole)) {
      this.role = newRole;
    } else {
      throw new Error(`Invalid role: ${newRole}. Valid roles: ${validRoles.join(', ')}`);
    }
  }

  /**
   * Mark email as verified
   */
  verifyEmail(): void {
    this.email_verified = true;
  }

  /**
   * Check if user has been active recently (within last 30 days)
   */
  isRecentlyActive(): boolean {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.updated_at > thirtyDaysAgo;
  }
}

/**
 * User Entity Utilities
 */
export class UserUtilities {
  /**
   * Generate a secure random username
   */
  static generateUsername(email?: string): string {
    if (email) {
      const localPart = email.split('@')[0];
      return `${localPart}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return `user_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate user data for creation
   */
  static validateUserData(data: Partial<UserFields>): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Invalid email format');
    }

    if (data.role && !['member', 'moderator', 'admin'].includes(data.role)) {
      errors.push('Invalid role');
    }

    return errors;
  }

  /**
   * Create a new User instance with validation
   */
  static createUser(data: Partial<UserFields>): User {
    const errors = this.validateUserData(data);
    if (errors.length > 0) {
      throw new Error(`User validation failed: ${errors.join(', ')}`);
    }

    return new User({
      name: data.name!,
      email: data.email,
      email_verified: data.email_verified || false,
      image: data.image,
      is_super_admin: data.is_super_admin || false,
      role: data.role || 'member',
      better_auth_user_id: data.better_auth_user_id
    });
  }

  /**
   * Filter user data for public API responses
   */
  static toPublicData(user: User): Partial<UserFields> {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }
}

export default User;