/**
 * BaseAuthEntity - Better Auth Compatible Foundation Entity
 * 
 * Adapted from archived DataForge for Better Auth integration.
 * Provides UUIDv7 primary keys with snake_case field names for Better Auth compatibility.
 */

export interface BaseAuthEntityFields {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export abstract class BaseAuthEntity {
  id!: string;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<BaseAuthEntityFields>) {
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.id) this.id = crypto.randomUUID();
    if (!this.created_at) this.created_at = new Date();
    if (!this.updated_at) this.updated_at = new Date();
  }

  /**
   * Get the Kysely schema definition for Better Auth tables
   */
  static getKyselySchema() {
    return {
      id: 'uuid',
      created_at: 'timestamptz',
      updated_at: 'timestamptz'
    } as const;
  }

  /**
   * Get the SQL DDL for Better Auth compatible tables
   */
  static getAuthDDL(): string {
    return `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    `;
  }

  /**
   * Get the base indexes for Better Auth tables
   */
  static getAuthIndexes(tableName: string): string[] {
    return [
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at ON ${tableName}(updated_at);`
    ];
  }

  /**
   * Prepare data for database insertion (Better Auth compatible)
   */
  prepareForInsert(): BaseAuthEntityFields {
    const now = new Date();
    return {
      id: this.id || crypto.randomUUID(),
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Prepare data for database update (Better Auth compatible)
   */
  prepareForUpdate(): Partial<BaseAuthEntityFields> {
    return {
      updated_at: new Date()
    };
  }

  /**
   * Convert to JSON for Better Auth compatibility
   */
  toJSON(): BaseAuthEntityFields {
    return {
      id: this.id,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Check if entity is recently created (within last hour)
   */
  isRecentlyCreated(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.created_at > oneHourAgo;
  }

  /**
   * Check if entity has been updated since creation
   */
  hasBeenUpdated(): boolean {
    return this.updated_at.getTime() > this.created_at.getTime() + 1000; // 1 second tolerance
  }

  /**
   * Get entity age in minutes
   */
  getAgeInMinutes(): number {
    return Math.floor((Date.now() - this.created_at.getTime()) / (1000 * 60));
  }

  /**
   * Get time since last update in minutes
   */
  getMinutesSinceUpdate(): number {
    return Math.floor((Date.now() - this.updated_at.getTime()) / (1000 * 60));
  }
}

/**
 * Better Auth Integration Utility
 * Provides utilities for integrating with Better Auth system
 */
export class BetterAuthIntegration {
  /**
   * Validate Better Auth field naming conventions
   */
  static validateFieldNaming(fields: Record<string, any>): boolean {
    // Better Auth expects snake_case field names
    for (const fieldName of Object.keys(fields)) {
      if (fieldName !== fieldName.toLowerCase() || fieldName.includes('-')) {
        return false;
      }
    }
    return true;
  }

  /**
   * Convert camelCase to snake_case for Better Auth compatibility
   */
  static toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase for TypeScript compatibility
   */
  static toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Transform object keys to snake_case for database operations
   */
  static toSnakeCaseObject<T extends Record<string, any>>(obj: T): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[this.toSnakeCase(key)] = value;
    }
    return result;
  }

  /**
   * Transform object keys to camelCase for TypeScript operations
   */
  static toCamelCaseObject<T extends Record<string, any>>(obj: T): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[this.toCamelCase(key)] = value;
    }
    return result;
  }

  /**
   * Create Better Auth compatible configuration for custom tables
   */
  static createAuthConfig(tableName: string, additionalFields: Record<string, any> = {}) {
    return {
      tableName: tableName,
      fields: {
        id: { type: 'string' as const, required: true },
        created_at: { type: 'date' as const, required: true },
        updated_at: { type: 'date' as const, required: true },
        ...additionalFields
      },
      generateId: false, // Let database handle UUID generation
      caseSensitive: false,
      fieldMapping: {
        // Map Better Auth fields to our snake_case database fields
        createdAt: 'created_at',
        updatedAt: 'updated_at'
      }
    };
  }
}