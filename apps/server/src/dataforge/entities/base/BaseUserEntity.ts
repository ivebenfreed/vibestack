/**
 * Base User Entity - Special Authentication Entity
 * 
 * Base class specifically designed for User entity that needs Better Auth compatibility
 * while maintaining some domain entity features. This is a hybrid approach for the
 * special case of user management in a multi-org platform.
 */

import { BaseSystemEntity, type BaseSystemEntityFields } from './BaseSystemEntity';

export interface BaseUserEntityFields extends BaseSystemEntityFields {
  // Better Auth compatibility fields
  name: string | null;
  email: string | null;
  email_verified: boolean;
  image: string | null;
  
  // Platform-specific fields
  is_super_admin: boolean;
  role: string;
  better_auth_user_id: string | null;
  
  // Organization context fields
  default_organization_id: string | null;
  last_used_organization_id: string | null;
  last_org_access_at: Date | null;
  
  // Minimal domain classification (but no container - users exist at platform level)
  status: string;
}

export abstract class BaseUserEntity extends BaseSystemEntity {
  name?: string | null;
  email?: string | null;
  email_verified!: boolean;
  image?: string | null;
  is_super_admin!: boolean;
  role!: string;
  better_auth_user_id?: string | null;
  default_organization_id?: string | null;
  last_used_organization_id?: string | null;
  last_org_access_at?: Date | null;
  status!: string;

  constructor(data?: Partial<BaseUserEntityFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults specific to user entities
    if (this.email_verified === undefined) this.email_verified = false;
    if (!this.is_super_admin) this.is_super_admin = false;
    if (!this.role) this.role = 'user';
    if (!this.status) this.status = 'active';
  }

  /**
   * Get the base Kysely schema for user entities
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      name: 'varchar(255)',
      email: 'varchar(255)',
      email_verified: 'boolean',
      image: 'varchar(500)',
      is_super_admin: 'boolean',
      role: 'varchar(50)',
      better_auth_user_id: 'varchar(255)',
      default_organization_id: 'text',
      last_used_organization_id: 'text',
      last_org_access_at: 'timestamp',
      status: 'varchar(50)'
    } as const;
  }

  /**
   * Get the base DDL for user entities (partial, to be completed by implementing class)
   */
  static getUserDDL(): string {
    return `
      ${super.getSystemDDL()},
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      email_verified BOOLEAN DEFAULT FALSE NOT NULL,
      image VARCHAR(500),
      is_super_admin BOOLEAN DEFAULT FALSE NOT NULL,
      role VARCHAR(50) DEFAULT 'user' NOT NULL,
      better_auth_user_id VARCHAR(255) UNIQUE,
      status VARCHAR(50) DEFAULT 'active' NOT NULL
    `;
  }

  /**
   * Get the base indexes for user entities
   */
  static getUserIndexes(tableName: string): string[] {
    return [
      ...super.getSystemIndexes(tableName),
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_email ON "${tableName}"(email) WHERE email IS NOT NULL;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_better_auth_user ON "${tableName}"(better_auth_user_id) WHERE better_auth_user_id IS NOT NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_role ON "${tableName}"(role);`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON "${tableName}"(status);`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_super_admin ON "${tableName}"(is_super_admin) WHERE is_super_admin = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_active_users ON "${tableName}"(status, role) WHERE status = 'active';`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): BaseUserEntityFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      name: this.name,
      email: this.email,
      email_verified: this.email_verified,
      image: this.image,
      is_super_admin: this.is_super_admin,
      role: this.role,
      better_auth_user_id: this.better_auth_user_id,
      status: this.status
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<BaseUserEntityFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      name: this.name,
      email: this.email,
      email_verified: this.email_verified,
      image: this.image,
      is_super_admin: this.is_super_admin,
      role: this.role,
      better_auth_user_id: this.better_auth_user_id,
      status: this.status
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): BaseUserEntityFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      name: this.name,
      email: this.email,
      email_verified: this.email_verified,
      image: this.image,
      is_super_admin: this.is_super_admin,
      role: this.role,
      better_auth_user_id: this.better_auth_user_id,
      status: this.status
    };
  }

  // User-specific business logic methods

  /**
   * Check if user is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Check if user is super admin
   */
  isSuperAdmin(): boolean {
    return this.is_super_admin;
  }

  /**
   * Check if email is verified
   */
  isEmailVerified(): boolean {
    return this.email_verified;
  }

  /**
   * Check if user is linked to Better Auth
   */
  isBetterAuthLinked(): boolean {
    return !!this.better_auth_user_id;
  }

  /**
   * Activate user
   */
  activate(): void {
    this.status = 'active';
  }

  /**
   * Deactivate user
   */
  deactivate(): void {
    this.status = 'inactive';
  }

  /**
   * Suspend user
   */
  suspend(): void {
    this.status = 'suspended';
  }

  /**
   * Verify email
   */
  verifyEmail(): void {
    this.email_verified = true;
  }

  /**
   * Make super admin
   */
  makeSuperAdmin(): void {
    this.is_super_admin = true;
    this.role = 'super_admin';
  }

  /**
   * Remove super admin privileges
   */
  removeSuperAdmin(): void {
    this.is_super_admin = false;
    if (this.role === 'super_admin') {
      this.role = 'user';
    }
  }

  /**
   * Link to Better Auth user
   */
  linkBetterAuth(betterAuthUserId: string): void {
    this.better_auth_user_id = betterAuthUserId;
  }

  /**
   * Unlink from Better Auth
   */
  unlinkBetterAuth(): void {
    this.better_auth_user_id = null;
  }

  /**
   * Update profile
   */
  updateProfile(name?: string, image?: string): void {
    if (name !== undefined) this.name = name;
    if (image !== undefined) this.image = image;
  }

  /**
   * Validate user data
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      errors.push('Invalid email format');
    }

    if (!['user', 'admin', 'super_admin', 'member', 'owner'].includes(this.role)) {
      errors.push('Invalid role');
    }

    if (!['active', 'inactive', 'suspended', 'pending', 'deleted'].includes(this.status)) {
      errors.push('Invalid status');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get user display name
   */
  getDisplayName(): string {
    return this.name || this.email || 'Unknown User';
  }

  /**
   * Get user initials
   */
  getInitials(): string {
    if (this.name) {
      return this.name
        .split(' ')
        .map(part => part.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
    }
    if (this.email) {
      return this.email.charAt(0).toUpperCase();
    }
    return 'U';
  }

  /**
   * Check if user has minimum role
   */
  hasRole(minimumRole: string): boolean {
    const roleHierarchy = {
      'user': 0,
      'member': 1,
      'admin': 2,
      'owner': 3,
      'super_admin': 4
    };

    const userLevel = roleHierarchy[this.role as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[minimumRole as keyof typeof roleHierarchy] || 0;

    return userLevel >= requiredLevel;
  }

  /**
   * Get user summary for public API
   */
  getPublicSummary(): {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
    status: string;
    isActive: boolean;
    isEmailVerified: boolean;
    displayName: string;
    initials: string;
  } {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      image: this.image,
      role: this.role,
      status: this.status,
      isActive: this.isActive(),
      isEmailVerified: this.isEmailVerified(),
      displayName: this.getDisplayName(),
      initials: this.getInitials()
    };
  }

  /**
   * Get user summary for admin API (includes sensitive fields)
   */
  getAdminSummary(): {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
    status: string;
    isActive: boolean;
    isSuperAdmin: boolean;
    isEmailVerified: boolean;
    isBetterAuthLinked: boolean;
    betterAuthUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    displayName: string;
  } {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      image: this.image,
      role: this.role,
      status: this.status,
      isActive: this.isActive(),
      isSuperAdmin: this.isSuperAdmin(),
      isEmailVerified: this.isEmailVerified(),
      isBetterAuthLinked: this.isBetterAuthLinked(),
      betterAuthUserId: this.better_auth_user_id,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
      displayName: this.getDisplayName()
    };
  }
}

export default BaseUserEntity;