/**
 * ContainerPermission Entity - Access Control Foundation
 * 
 * Adapted from archived DataForge MikroORM entity to Kysely-based system.
 * Provides fine-grained container-based access control for multi-org platform.
 * Extends BaseDomainEntity for container access control and archetype classification.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export interface ContainerPermissionFields extends BaseDomainEntityFields {
  user_id: string;
  permission_container_type: string;
  permission_container_id: string;
  role: string;
  granted_at: Date | null;
  granted_by_id: string | null;
  expires_at: Date | null;
  restrictions: any;
}

export class ContainerPermission extends BaseDomainEntity {
  user_id!: string;
  permission_container_type!: string; // project, department, workspace, user, system
  permission_container_id!: string;
  role!: string; // admin, owner, member, viewer
  granted_at?: Date | null;
  granted_by_id?: string | null;
  expires_at?: Date | null;
  restrictions?: any; // Field-level or operation-specific restrictions

  constructor(data?: Partial<ContainerPermissionFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'permission';
    if (!this.role) this.role = 'viewer';
    if (!this.restrictions) this.restrictions = {};
    if (!this.granted_at) this.granted_at = new Date();
  }

  /**
   * Get the Kysely schema definition for ContainerPermission table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      user_id: 'uuid',
      permission_container_type: 'varchar(50)',
      permission_container_id: 'uuid',
      role: 'varchar(50)',
      granted_at: 'timestamptz',
      granted_by_id: 'uuid',
      expires_at: 'timestamptz',
      restrictions: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for ContainerPermission table creation
   */
  static getContainerPermissionDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "container_permission" (
        ${super.getDomainDDL()},
        user_id UUID NOT NULL REFERENCES "user"(id),
        permission_container_type VARCHAR(50) NOT NULL,
        permission_container_id UUID NOT NULL,
        role VARCHAR(50) DEFAULT 'viewer' NOT NULL,
        granted_at TIMESTAMPTZ DEFAULT NOW(),
        granted_by_id UUID REFERENCES "user"(id),
        expires_at TIMESTAMPTZ,
        restrictions JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT unique_user_container_permission UNIQUE (user_id, permission_container_type, permission_container_id),
        CONSTRAINT chk_valid_role CHECK (role IN ('admin', 'owner', 'manager', 'member', 'contributor', 'viewer')),
        CONSTRAINT chk_expiry_after_grant CHECK (expires_at IS NULL OR expires_at > granted_at)
      );
    `;
  }

  /**
   * Get the indexes for ContainerPermission table
   */
  static getContainerPermissionIndexes(): string[] {
    return [
      ...super.getDomainIndexes('container_permission'),
      `CREATE INDEX IF NOT EXISTS idx_container_permission_user ON "container_permission"(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_container_permission_container ON "container_permission"(permission_container_type, permission_container_id);`,
      `CREATE INDEX IF NOT EXISTS idx_container_permission_role ON "container_permission"(role);`,
      `CREATE INDEX IF NOT EXISTS idx_container_permission_granted_at ON "container_permission"(granted_at);`,
      `CREATE INDEX IF NOT EXISTS idx_container_permission_expires_at ON "container_permission"(expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_container_permission_granted_by ON "container_permission"(granted_by_id);`,
      `CREATE INDEX IF NOT EXISTS idx_container_permission_restrictions ON "container_permission" USING GIN(restrictions);`,
      `CREATE INDEX IF NOT EXISTS idx_container_permission_active ON "container_permission"(user_id, permission_container_type, permission_container_id) WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW());`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): ContainerPermissionFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      user_id: this.user_id,
      permission_container_type: this.permission_container_type,
      permission_container_id: this.permission_container_id,
      role: this.role || 'viewer',
      granted_at: this.granted_at || new Date(),
      granted_by_id: this.granted_by_id,
      expires_at: this.expires_at,
      restrictions: this.restrictions || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<ContainerPermissionFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      role: this.role,
      expires_at: this.expires_at,
      restrictions: this.restrictions
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): ContainerPermissionFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      user_id: this.user_id,
      permission_container_type: this.permission_container_type,
      permission_container_id: this.permission_container_id,
      role: this.role,
      granted_at: this.granted_at,
      granted_by_id: this.granted_by_id,
      expires_at: this.expires_at,
      restrictions: this.restrictions
    };
  }

  // Business logic methods

  /**
   * Check if permission is currently active
   */
  isActive(): boolean {
    return this.status === 'active' && !this.isExpired();
  }

  /**
   * Check if permission has expired
   */
  isExpired(): boolean {
    if (!this.expires_at) return false;
    return this.expires_at < new Date();
  }

  /**
   * Check if permission will expire soon (within days)
   */
  isExpiringSoon(days: number = 7): boolean {
    if (!this.expires_at) return false;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + days);
    return this.expires_at <= warningDate && !this.isExpired();
  }

  /**
   * Get days until expiration
   */
  getDaysUntilExpiration(): number | null {
    if (!this.expires_at) return null;
    const diffTime = this.expires_at.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if user has admin role
   */
  isAdmin(): boolean {
    return this.role === 'admin';
  }

  /**
   * Check if user has owner role
   */
  isOwner(): boolean {
    return this.role === 'owner';
  }

  /**
   * Check if user has manager role
   */
  isManager(): boolean {
    return this.role === 'manager';
  }

  /**
   * Check if user has member role
   */
  isMember(): boolean {
    return this.role === 'member';
  }

  /**
   * Check if user has contributor role
   */
  isContributor(): boolean {
    return this.role === 'contributor';
  }

  /**
   * Check if user has viewer role
   */
  isViewer(): boolean {
    return this.role === 'viewer';
  }

  /**
   * Check if user can perform administrative actions
   */
  canAdminister(): boolean {
    return this.isAdmin() || this.isOwner();
  }

  /**
   * Check if user can manage resources
   */
  canManage(): boolean {
    return this.canAdminister() || this.isManager();
  }

  /**
   * Check if user can write/modify resources
   */
  canWrite(): boolean {
    return this.canManage() || this.isMember() || this.isContributor();
  }

  /**
   * Check if user can read resources
   */
  canRead(): boolean {
    return this.canWrite() || this.isViewer();
  }

  /**
   * Get permission level as numeric value (higher = more permissions)
   */
  getPermissionLevel(): number {
    const levels = {
      viewer: 10,
      contributor: 20,
      member: 30,
      manager: 40,
      admin: 50,
      owner: 60
    };
    return levels[this.role as keyof typeof levels] || 0;
  }

  /**
   * Check if this permission is higher than another role
   */
  isHigherThan(role: string): boolean {
    const otherLevel = new ContainerPermission({ role }).getPermissionLevel();
    return this.getPermissionLevel() > otherLevel;
  }

  /**
   * Check if user has specific restriction
   */
  hasRestriction(key: string): boolean {
    return this.restrictions && this.restrictions[key] !== undefined;
  }

  /**
   * Get restriction value
   */
  getRestriction(key: string): any {
    return this.restrictions?.[key];
  }

  /**
   * Add or update restriction
   */
  addRestriction(key: string, value: any): void {
    if (!this.restrictions) this.restrictions = {};
    this.restrictions[key] = value;
  }

  /**
   * Remove restriction
   */
  removeRestriction(key: string): void {
    if (this.restrictions) {
      delete this.restrictions[key];
    }
  }

  /**
   * Check if permission grants access to specific container
   */
  grantsAccessTo(containerType: string, containerId: string): boolean {
    return this.permission_container_type === containerType && 
           this.permission_container_id === containerId &&
           this.isActive();
  }

  /**
   * Extend permission expiration
   */
  extendExpiration(days: number): void {
    if (this.expires_at) {
      const newExpiry = new Date(this.expires_at);
      newExpiry.setDate(newExpiry.getDate() + days);
      this.expires_at = newExpiry;
    } else {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);
      this.expires_at = expiry;
    }
  }

  /**
   * Revoke permission (soft delete)
   */
  revoke(revokedBy?: string): void {
    this.status = 'archived';
    this.expires_at = new Date(); // Expire immediately
  }

  /**
   * Get permission summary
   */
  getSummary(): {
    containerType: string;
    containerId: string;
    role: string;
    permissionLevel: number;
    isActive: boolean;
    isExpired: boolean;
    daysUntilExpiration: number | null;
    restrictions: string[];
  } {
    return {
      containerType: this.permission_container_type,
      containerId: this.permission_container_id,
      role: this.role,
      permissionLevel: this.getPermissionLevel(),
      isActive: this.isActive(),
      isExpired: this.isExpired(),
      daysUntilExpiration: this.getDaysUntilExpiration(),
      restrictions: this.restrictions ? Object.keys(this.restrictions) : []
    };
  }
}

/**
 * Container Permission Utilities
 */
export class ContainerPermissionUtilities {
  /**
   * Valid permission roles
   */
  static readonly PERMISSION_ROLES = [
    'owner',
    'admin', 
    'manager',
    'member',
    'contributor',
    'viewer'
  ] as const;

  /**
   * Valid container types
   */
  static readonly CONTAINER_TYPES = [
    'organization',
    'department',
    'project',
    'workspace',
    'user',
    'system'
  ] as const;

  /**
   * Validate container permission data for creation
   */
  static validatePermissionData(data: Partial<ContainerPermissionFields>): string[] {
    const errors: string[] = [];

    if (!data.user_id) {
      errors.push('User ID is required');
    }

    if (!data.permission_container_type) {
      errors.push('Permission container type is required');
    } else if (!this.CONTAINER_TYPES.includes(data.permission_container_type as any)) {
      errors.push(`Invalid container type: ${data.permission_container_type}`);
    }

    if (!data.permission_container_id) {
      errors.push('Permission container ID is required');
    }

    if (data.role && !this.PERMISSION_ROLES.includes(data.role as any)) {
      errors.push(`Invalid role: ${data.role}`);
    }

    if (data.expires_at && data.granted_at && data.expires_at <= data.granted_at) {
      errors.push('Expiration date must be after grant date');
    }

    return errors;
  }

  /**
   * Create a new ContainerPermission instance with validation
   */
  static createPermission(data: Partial<ContainerPermissionFields>): ContainerPermission {
    const errors = this.validatePermissionData(data);
    if (errors.length > 0) {
      throw new Error(`Permission validation failed: ${errors.join(', ')}`);
    }

    return new ContainerPermission({
      user_id: data.user_id!,
      permission_container_type: data.permission_container_type!,
      permission_container_id: data.permission_container_id!,
      role: data.role || 'viewer',
      granted_at: data.granted_at || new Date(),
      granted_by_id: data.granted_by_id,
      expires_at: data.expires_at,
      restrictions: data.restrictions || {},
      container_type: data.container_type || 'system',
      container_id: data.container_id || 'permissions',
      status: data.status || 'active'
    });
  }

  /**
   * Filter permissions by container
   */
  static filterByContainer(permissions: ContainerPermission[], containerType: string, containerId: string): ContainerPermission[] {
    return permissions.filter(p => p.grantsAccessTo(containerType, containerId));
  }

  /**
   * Filter active permissions
   */
  static filterActive(permissions: ContainerPermission[]): ContainerPermission[] {
    return permissions.filter(p => p.isActive());
  }

  /**
   * Filter permissions by role
   */
  static filterByRole(permissions: ContainerPermission[], role: string): ContainerPermission[] {
    return permissions.filter(p => p.role === role);
  }

  /**
   * Filter permissions by user
   */
  static filterByUser(permissions: ContainerPermission[], userId: string): ContainerPermission[] {
    return permissions.filter(p => p.user_id === userId);
  }

  /**
   * Get highest permission level for user in container
   */
  static getHighestPermission(permissions: ContainerPermission[], userId: string, containerType: string, containerId: string): ContainerPermission | null {
    const userPermissions = permissions
      .filter(p => p.user_id === userId && p.grantsAccessTo(containerType, containerId))
      .sort((a, b) => b.getPermissionLevel() - a.getPermissionLevel());
    
    return userPermissions[0] || null;
  }

  /**
   * Check if user has permission level
   */
  static hasPermissionLevel(permissions: ContainerPermission[], userId: string, containerType: string, containerId: string, requiredLevel: string): boolean {
    const highest = this.getHighestPermission(permissions, userId, containerType, containerId);
    if (!highest) return false;
    
    const required = new ContainerPermission({ role: requiredLevel });
    return highest.getPermissionLevel() >= required.getPermissionLevel();
  }

  /**
   * Get permissions expiring soon
   */
  static getExpiringSoon(permissions: ContainerPermission[], days: number = 7): ContainerPermission[] {
    return permissions.filter(p => p.isExpiringSoon(days));
  }

  /**
   * Get expired permissions
   */
  static getExpired(permissions: ContainerPermission[]): ContainerPermission[] {
    return permissions.filter(p => p.isExpired());
  }

  /**
   * Group permissions by container
   */
  static groupByContainer(permissions: ContainerPermission[]): Record<string, ContainerPermission[]> {
    return permissions.reduce((groups, permission) => {
      const key = `${permission.permission_container_type}:${permission.permission_container_id}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(permission);
      return groups;
    }, {} as Record<string, ContainerPermission[]>);
  }

  /**
   * Group permissions by user
   */
  static groupByUser(permissions: ContainerPermission[]): Record<string, ContainerPermission[]> {
    return permissions.reduce((groups, permission) => {
      if (!groups[permission.user_id]) {
        groups[permission.user_id] = [];
      }
      groups[permission.user_id].push(permission);
      return groups;
    }, {} as Record<string, ContainerPermission[]>);
  }

  /**
   * Calculate permission statistics
   */
  static calculateStats(permissions: ContainerPermission[]) {
    const stats = {
      total: permissions.length,
      active: 0,
      expired: 0,
      expiringSoon: 0,
      byRole: {} as Record<string, number>,
      byContainer: {} as Record<string, number>,
      averagePermissionLevel: 0
    };

    let totalLevel = 0;

    permissions.forEach(permission => {
      if (permission.isActive()) stats.active++;
      if (permission.isExpired()) stats.expired++;
      if (permission.isExpiringSoon()) stats.expiringSoon++;

      // Count by role
      stats.byRole[permission.role] = (stats.byRole[permission.role] || 0) + 1;

      // Count by container type
      stats.byContainer[permission.permission_container_type] = 
        (stats.byContainer[permission.permission_container_type] || 0) + 1;

      totalLevel += permission.getPermissionLevel();
    });

    stats.averagePermissionLevel = permissions.length > 0 ? totalLevel / permissions.length : 0;

    return stats;
  }

  /**
   * Filter permission data for public API responses
   */
  static toPublicData(permission: ContainerPermission): Partial<ContainerPermissionFields> {
    return {
      id: permission.id,
      user_id: permission.user_id,
      permission_container_type: permission.permission_container_type,
      permission_container_id: permission.permission_container_id,
      role: permission.role,
      granted_at: permission.granted_at,
      expires_at: permission.expires_at,
      status: permission.status,
      created_at: permission.created_at,
      updated_at: permission.updated_at
    };
  }
}

export default ContainerPermission;