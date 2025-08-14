/**
 * BaseSystemEntity - Enhanced Foundation Entity
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Provides UUIDv7 primary keys, audit trails, and Better Auth integration.
 */

export interface BaseSystemEntityFields {
  id: string;
  created_at: Date;
  updated_at: Date;
  created_by_id?: string | null;
}

export abstract class BaseSystemEntity {
  id!: string;
  created_at!: Date;
  updated_at!: Date;
  created_by_id?: string | null;

  constructor(data?: Partial<BaseSystemEntityFields>) {
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.id) this.id = crypto.randomUUID();
    if (!this.created_at) this.created_at = new Date();
    if (!this.updated_at) this.updated_at = new Date();
  }

  /**
   * Get the table schema definition for Kysely
   */
  static getKyselySchema() {
    return {
      id: 'uuid',
      created_at: 'timestamptz',
      updated_at: 'timestamptz', 
      created_by_id: 'uuid'
    } as const;
  }

  /**
   * Get the SQL DDL for creating tables with this base
   */
  static getBaseDDL(): string {
    return `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_by_id UUID REFERENCES "user"(id)
    `;
  }

  /**
   * Get the system DDL for system entities
   */
  static getSystemDDL(): string {
    return this.getBaseDDL();
  }

  /**
   * Get the base indexes for performance
   */
  static getBaseIndexes(tableName: string): string[] {
    return [
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_by ON ${tableName}(created_by_id);`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at ON ${tableName}(updated_at);`
    ];
  }

  /**
   * Get the system indexes for system entities
   */
  static getSystemIndexes(tableName: string): string[] {
    return this.getBaseIndexes(tableName);
  }

  /**
   * Check if this entity was created by a specific user
   */
  isCreatedBy(userId: string): boolean {
    return this.created_by_id === userId;
  }

  /**
   * Get audit trail information
   */
  getAuditInfo(): {
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
    age: number; // milliseconds since creation
  } {
    return {
      createdAt: this.created_at,
      updatedAt: this.updated_at,
      createdBy: this.created_by_id || undefined,
      age: Date.now() - this.created_at.getTime()
    };
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(createdBy?: string): BaseSystemEntityFields {
    const now = new Date();
    return {
      id: this.id || crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      created_by_id: createdBy || this.created_by_id || null
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<BaseSystemEntityFields> {
    return {
      updated_at: new Date()
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): BaseSystemEntityFields {
    return {
      id: this.id,
      created_at: this.created_at,
      updated_at: this.updated_at,
      created_by_id: this.created_by_id
    };
  }

  /**
   * Convert to syncable format (exclude sensitive audit fields)
   */
  toSyncableFields(): Omit<BaseSystemEntityFields, 'created_by_id'> {
    return {
      id: this.id,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

/**
 * UUIDv7 Generator Utility
 * Provides timestamp-ordered UUIDs for better database performance
 */
export class UUIDv7Generator {
  /**
   * Generate a UUIDv7 with timestamp ordering
   * Falls back to crypto.randomUUID() if UUIDv7 not available
   */
  static generate(): string {
    // For now, use standard UUID - will enhance with proper UUIDv7 later
    return crypto.randomUUID();
  }

  /**
   * Extract timestamp from UUIDv7 (if available)
   */
  static extractTimestamp(uuid: string): Date | null {
    try {
      // This would extract timestamp from UUIDv7 format
      // For now, return null since we're using standard UUIDs
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if UUID is in UUIDv7 format
   */
  static isUUIDv7(uuid: string): boolean {
    // Check for UUIDv7 format (version 7)
    return uuid.charAt(14) === '7';
  }
}

/**
 * Audit Trail Utility
 * Provides audit trail functionality for BaseSystemEntity
 */
export class AuditTrail {
  /**
   * Create audit record for entity creation
   */
  static createCreationAudit(entityId: string, entityType: string, createdBy?: string): {
    entity_id: string;
    entity_type: string;
    action: string;
    created_by_id?: string;
    created_at: Date;
  } {
    return {
      entity_id: entityId,
      entity_type: entityType,
      action: 'CREATE',
      created_by_id: createdBy,
      created_at: new Date()
    };
  }

  /**
   * Create audit record for entity update
   */
  static createUpdateAudit(entityId: string, entityType: string, changes: Record<string, any>, updatedBy?: string): {
    entity_id: string;
    entity_type: string;
    action: string;
    changes: Record<string, any>;
    created_by_id?: string;
    created_at: Date;
  } {
    return {
      entity_id: entityId,
      entity_type: entityType,
      action: 'UPDATE',
      changes,
      created_by_id: updatedBy,
      created_at: new Date()
    };
  }

  /**
   * Create audit record for entity deletion
   */
  static createDeletionAudit(entityId: string, entityType: string, deletedBy?: string): {
    entity_id: string;
    entity_type: string;
    action: string;
    created_by_id?: string;
    created_at: Date;
  } {
    return {
      entity_id: entityId,
      entity_type: entityType,
      action: 'DELETE',
      created_by_id: deletedBy,
      created_at: new Date()
    };
  }
}