// D1 Database Manager - Real SQLite database operations using Cloudflare D1
// Replaces simulated database operations with actual D1 SQL execution

import type { EntityConfig } from './json-rules-engine.js';
import type { Env } from './types.js';

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  constraint?: string;
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  indexes: string[];
  constraints: string[];
  createdAt: string;
  orgId: string;
  entityName: string;
}

export interface Migration {
  id: string;
  orgId: string;
  entityName: string;
  operation: 'create_table' | 'add_column' | 'modify_column' | 'add_index';
  sql: string;
  executedAt?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  error?: string;
}

/**
 * D1 Database Manager for real SQLite operations
 */
export class D1DatabaseManager {
  private db: D1Database;
  private tables: Map<string, DatabaseTable> = new Map();
  private migrations: Map<string, Migration> = new Map();

  constructor(env: Env) {
    this.db = env.DB;
  }

  /**
   * Initialize the database with required system tables
   */
  async initialize(): Promise<void> {
    // Create migrations tracking table
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS __migrations (
        id TEXT PRIMARY KEY,
        orgId TEXT NOT NULL,
        entityName TEXT NOT NULL,
        operation TEXT NOT NULL,
        sql TEXT NOT NULL,
        executedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'completed'
      )
    `).run();

    // Create organizations table (for foreign key references)
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Insert default organizations for multi-org testing
    const orgs = ['acme-corp', 'techflow-solutions', 'startup-inc'];
    for (const orgId of orgs) {
      await this.db.prepare(`
        INSERT OR IGNORE INTO organizations (id, name) 
        VALUES (?, ?)
      `).bind(orgId, orgId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())).run();
    }
  }

  /**
   * Create a new organization-specific table with real D1 execution
   */
  async createOrgTable(config: EntityConfig): Promise<DatabaseTable> {
    const tableName = `${config.orgId.replace(/-/g, '_')}_${config.name.toLowerCase()}s`;
    const tableKey = `${config.orgId}:${config.name}`;
    
    // Generate base columns from primitive
    const baseColumns = this.getBaseColumns(config.basePrimitive);
    
    // Generate custom columns from entity configuration
    const customColumns = this.generateCustomColumns(config.customFields);
    
    // Combine all columns
    const allColumns = [
      ...baseColumns,
      ...customColumns,
      // JSON column for future fields (SQLite uses TEXT for JSON)
      {
        name: 'custom_data',
        type: 'TEXT',
        nullable: false,
        default: "'{}'"
      },
      // Organization isolation
      {
        name: 'organization_id',
        type: 'TEXT',
        nullable: false
      }
    ];

    // Generate indexes (simplified for SQLite)
    const indexes = this.generateIndexes(tableName, config);

    const table: DatabaseTable = {
      name: tableName,
      columns: allColumns,
      indexes,
      constraints: [], // SQLite constraints are inline
      createdAt: new Date().toISOString(),
      orgId: config.orgId,
      entityName: config.name
    };

    // Generate and execute migration
    const migration = this.generateCreateTableMigration(table);
    await this.executeMigration(migration);

    // Store table definition in memory
    this.tables.set(tableKey, table);

    return table;
  }

  /**
   * Add a custom field to existing table with real D1 execution
   */
  async addCustomField(orgId: string, entityName: string, fieldName: string, fieldConfig: any): Promise<Migration> {
    const tableKey = `${orgId}:${entityName}`;
    const table = this.tables.get(tableKey);
    
    if (!table) {
      throw new Error(`Table not found: ${tableKey}`);
    }

    const column = this.generateColumnFromField(fieldName, fieldConfig);
    
    // Create migration for adding column
    const migration: Migration = {
      id: `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orgId,
      entityName,
      operation: 'add_column',
      sql: `ALTER TABLE ${table.name} ADD COLUMN ${column.name} ${column.type}${column.nullable ? '' : ' NOT NULL'}${column.default ? ` DEFAULT ${column.default}` : ''};`,
      status: 'pending'
    };

    // Execute migration
    await this.executeMigration(migration);

    // Update table definition
    table.columns.push(column);
    this.tables.set(tableKey, table);

    return migration;
  }

  /**
   * Get base columns for a primitive type (SQLite types)
   */
  private getBaseColumns(primitive: string): DatabaseColumn[] {
    const baseColumns: DatabaseColumn[] = [
      {
        name: 'id',
        type: 'TEXT PRIMARY KEY',
        nullable: false,
        default: undefined // SQLite will auto-generate if we use rowid, but we'll use UUIDs
      },
      {
        name: 'created_at',
        type: 'DATETIME',
        nullable: false,
        default: 'CURRENT_TIMESTAMP'
      },
      {
        name: 'updated_at',
        type: 'DATETIME',
        nullable: false,
        default: 'CURRENT_TIMESTAMP'
      }
    ];

    switch (primitive) {
      case 'Project':
        return [
          ...baseColumns,
          {
            name: 'name',
            type: 'TEXT',
            nullable: false
          },
          {
            name: 'description',
            type: 'TEXT',
            nullable: true
          },
          {
            name: 'status',
            type: 'TEXT',
            nullable: false,
            default: "'draft'"
          }
        ];
      
      case 'Task':
        return [
          ...baseColumns,
          {
            name: 'title',
            type: 'TEXT',
            nullable: false
          },
          {
            name: 'description',
            type: 'TEXT',
            nullable: true
          },
          {
            name: 'priority',
            type: 'TEXT',
            nullable: false,
            default: "'medium'"
          },
          {
            name: 'status',
            type: 'TEXT',
            nullable: false,
            default: "'todo'"
          },
          {
            name: 'due_date',
            type: 'DATE',
            nullable: true
          },
          {
            name: 'assigned_to',
            type: 'TEXT',
            nullable: true
          }
        ];
      
      default:
        return baseColumns;
    }
  }

  /**
   * Generate custom columns from field definitions (SQLite types)
   */
  private generateCustomColumns(customFields: Record<string, any>): DatabaseColumn[] {
    return Object.entries(customFields).map(([fieldName, fieldDef]) => 
      this.generateColumnFromField(fieldName, fieldDef)
    );
  }

  /**
   * Generate database column from field definition (SQLite compatible)
   */
  private generateColumnFromField(fieldName: string, fieldDef: any): DatabaseColumn {
    const columnName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
    
    let type: string;
    let constraint: string | undefined;

    switch (fieldDef.type) {
      case 'string':
        type = 'TEXT';
        if (fieldDef.minLength || fieldDef.maxLength) {
          const checks = [];
          if (fieldDef.minLength) checks.push(`LENGTH(${columnName}) >= ${fieldDef.minLength}`);
          if (fieldDef.maxLength) checks.push(`LENGTH(${columnName}) <= ${fieldDef.maxLength}`);
          if (checks.length > 0) {
            constraint = `CHECK (${checks.join(' AND ')})`;
          }
        }
        break;
      case 'number':
        type = 'INTEGER';
        if (fieldDef.min !== undefined || fieldDef.max !== undefined) {
          const checks = [];
          if (fieldDef.min !== undefined) checks.push(`${columnName} >= ${fieldDef.min}`);
          if (fieldDef.max !== undefined) checks.push(`${columnName} <= ${fieldDef.max}`);
          if (checks.length > 0) {
            constraint = `CHECK (${checks.join(' AND ')})`;
          }
        }
        break;
      case 'boolean':
        type = 'INTEGER'; // SQLite uses INTEGER for boolean (0/1)
        constraint = `CHECK (${columnName} IN (0, 1))`;
        break;
      case 'date':
        type = 'DATE';
        break;
      case 'email':
        type = 'TEXT';
        constraint = `CHECK (${columnName} LIKE '%@%.%')`;
        break;
      case 'url':
        type = 'TEXT';
        constraint = `CHECK (${columnName} LIKE 'http%://%')`;
        break;
      case 'enum':
        type = 'TEXT';
        if (fieldDef.enum && fieldDef.enum.length > 0) {
          const values = fieldDef.enum.map((v: string) => `'${v}'`).join(', ');
          constraint = `CHECK (${columnName} IN (${values}))`;
        }
        break;
      case 'array':
        type = 'TEXT'; // SQLite stores JSON as TEXT
        constraint = `CHECK (json_valid(${columnName}))`;
        break;
      default:
        type = 'TEXT';
    }

    // Handle SQLite-specific default values
    let defaultValue: string | undefined;
    if (fieldDef.default !== undefined) {
      if (fieldDef.type === 'boolean') {
        defaultValue = fieldDef.default ? '1' : '0';
      } else if (fieldDef.type === 'array') {
        defaultValue = `'${JSON.stringify(fieldDef.default)}'`;
      } else {
        defaultValue = `'${fieldDef.default}'`;
      }
    }

    return {
      name: columnName,
      type: constraint ? `${type} ${constraint}` : type,
      nullable: !fieldDef.required,
      default: defaultValue,
      constraint
    };
  }

  /**
   * Generate indexes for the table (SQLite compatible)
   */
  private generateIndexes(tableName: string, config: EntityConfig): string[] {
    const safeTableName = tableName.replace(/-/g, '_');
    const indexes: string[] = [
      // Organization isolation index
      `CREATE INDEX IF NOT EXISTS ${safeTableName}_org_id_idx ON ${safeTableName} (organization_id);`,
      
      // Status index (common query pattern)
      `CREATE INDEX IF NOT EXISTS ${safeTableName}_status_idx ON ${safeTableName} (status);`,
      
      // Created date index
      `CREATE INDEX IF NOT EXISTS ${safeTableName}_created_at_idx ON ${safeTableName} (created_at);`
    ];

    // Custom field indexes
    Object.entries(config.customFields).forEach(([fieldName, fieldDef]) => {
      if (fieldDef.indexed) {
        const columnName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
        indexes.push(`CREATE INDEX IF NOT EXISTS ${safeTableName}_${columnName}_idx ON ${safeTableName} (${columnName});`);
      }
    });

    return indexes;
  }

  /**
   * Generate CREATE TABLE migration (SQLite compatible)
   */
  private generateCreateTableMigration(table: DatabaseTable): Migration {
    const columnDefs = table.columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (!col.nullable && !col.type.includes('PRIMARY KEY')) def += ' NOT NULL';
      if (col.default) def += ` DEFAULT ${col.default}`;
      return def;
    }).join(',\n');

    let sql = `CREATE TABLE ${table.name} (\n${columnDefs}\n);`;

    // Add indexes as separate statements
    if (table.indexes.length > 0) {
      sql += '\n\n-- Indexes\n' + table.indexes.join('\n');
    }

    return {
      id: `migration_${Date.now()}_create_${table.name}`,
      orgId: table.orgId,
      entityName: table.entityName,
      operation: 'create_table',
      sql,
      status: 'pending'
    };
  }

  /**
   * Execute a migration using real D1 database
   */
  private async executeMigration(migration: Migration): Promise<void> {
    migration.status = 'executing';
    this.migrations.set(migration.id, migration);

    try {
      console.log(`Executing D1 migration: ${migration.id}`);
      console.log(`SQL: ${migration.sql}`);
      
      // Split SQL into individual statements for D1 execution
      const statements = migration.sql
        .split(/;\s*(?=\n|$)/)
        .filter(stmt => stmt.trim().length > 0);
      
      // Execute each statement
      for (const statement of statements) {
        const trimmedStmt = statement.trim();
        if (trimmedStmt) {
          await this.db.prepare(trimmedStmt).run();
        }
      }
      
      migration.status = 'completed';
      migration.executedAt = new Date().toISOString();
      
      // Record migration in database
      await this.db.prepare(`
        INSERT INTO __migrations (id, orgId, entityName, operation, sql, executedAt, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        migration.id,
        migration.orgId,
        migration.entityName,
        migration.operation,
        migration.sql,
        migration.executedAt,
        migration.status
      ).run();
      
      console.log(`✅ D1 Migration completed: ${migration.id}`);
    } catch (error) {
      migration.status = 'failed';
      migration.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Record failed migration
      try {
        await this.db.prepare(`
          INSERT INTO __migrations (id, orgId, entityName, operation, sql, status) 
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          migration.id,
          migration.orgId,
          migration.entityName,
          migration.operation,
          migration.sql,
          'failed'
        ).run();
      } catch (recordError) {
        console.error('Failed to record migration failure:', recordError);
      }
      
      console.log(`❌ D1 Migration failed: ${migration.id} - ${migration.error}`);
      throw error;
    } finally {
      this.migrations.set(migration.id, migration);
    }
  }

  /**
   * Insert data into a table
   */
  async insertRecord(tableName: string, data: Record<string, any>): Promise<any> {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);
    
    try {
      const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      console.log(`D1 Insert SQL: ${sql}`);
      console.log(`D1 Insert Values:`, values);
      
      const result = await this.db.prepare(sql).bind(...values).first();
      return result;
    } catch (error) {
      console.error(`D1 Insert Error for ${tableName}:`, error);
      console.error(`Insert data:`, data);
      throw error;
    }
  }

  /**
   * Query data from a table
   */
  async queryRecords(tableName: string, where: Record<string, any> = {}, limit = 100): Promise<any[]> {
    let sql = `SELECT * FROM ${tableName}`;
    const values: any[] = [];
    
    if (Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
      sql += ` WHERE ${conditions}`;
      values.push(...Object.values(where));
    }
    
    sql += ` LIMIT ${limit}`;
    
    const result = await this.db.prepare(sql).bind(...values).all();
    return result.results || [];
  }

  /**
   * Get table information from SQLite schema
   */
  async getTableInfo(tableName: string): Promise<any> {
    const result = await this.db.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name = ?`
    ).bind(tableName).first();
    
    return result;
  }

  /**
   * Get all tables for an organization
   */
  getOrgTables(orgId: string): DatabaseTable[] {
    return Array.from(this.tables.values()).filter(table => table.orgId === orgId);
  }

  /**
   * Get all migrations for an organization
   */
  getOrgMigrations(orgId: string): Migration[] {
    return Array.from(this.migrations.values()).filter(migration => migration.orgId === orgId);
  }

  /**
   * Get all tables across all organizations
   */
  getAllTables(): DatabaseTable[] {
    return Array.from(this.tables.values());
  }

  /**
   * Get all migrations across all organizations
   */
  getAllMigrations(): Migration[] {
    return Array.from(this.migrations.values());
  }

  /**
   * Get migrations from database
   */
  async getStoredMigrations(): Promise<Migration[]> {
    const result = await this.db.prepare(
      `SELECT * FROM __migrations ORDER BY executedAt DESC`
    ).all();
    
    return (result.results || []).map(row => ({
      id: row.id as string,
      orgId: row.orgId as string,
      entityName: row.entityName as string,
      operation: row.operation as Migration['operation'],
      sql: row.sql as string,
      executedAt: row.executedAt as string,
      status: row.status as Migration['status']
    }));
  }

  /**
   * Generate database schema report with real D1 data
   */
  async generateSchemaReport(): Promise<any> {
    const storedMigrations = await this.getStoredMigrations();
    const tablesByOrg: Record<string, DatabaseTable[]> = {};
    const migrationsByOrg: Record<string, Migration[]> = {};

    // Group tables by organization
    this.getAllTables().forEach(table => {
      if (!tablesByOrg[table.orgId]) {
        tablesByOrg[table.orgId] = [];
      }
      tablesByOrg[table.orgId].push(table);
    });

    // Group migrations by organization (include both in-memory and stored)
    [...this.getAllMigrations(), ...storedMigrations].forEach(migration => {
      if (!migrationsByOrg[migration.orgId]) {
        migrationsByOrg[migration.orgId] = [];
      }
      migrationsByOrg[migration.orgId].push(migration);
    });

    // Get actual table names from D1
    const actualTables = await this.db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__migrations' AND name != 'organizations'`
    ).all();

    return {
      summary: {
        totalOrganizations: Object.keys(tablesByOrg).length,
        totalTables: this.getAllTables().length,
        actualTablesInD1: actualTables.results?.length || 0,
        totalMigrations: [...this.getAllMigrations(), ...storedMigrations].length,
        completedMigrations: [...this.getAllMigrations(), ...storedMigrations].filter(m => m.status === 'completed').length
      },
      organizations: Object.keys(tablesByOrg).map(orgId => ({
        orgId,
        tables: tablesByOrg[orgId]?.length || 0,
        migrations: migrationsByOrg[orgId]?.length || 0,
        entities: tablesByOrg[orgId]?.map(t => t.entityName) || []
      })),
      actualTables: actualTables.results?.map(t => t.name) || [],
      tables: tablesByOrg,
      migrations: migrationsByOrg,
      storedMigrations: storedMigrations.slice(0, 10) // Latest 10 migrations
    };
  }
}