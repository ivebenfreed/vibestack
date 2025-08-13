// Database Manager - Handles real table creation and migrations
// Simulates actual database operations for the POC

import type { EntityConfig } from './json-rules-engine.js';

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
 * Database Manager for handling multi-org table creation and migrations
 */
export class DatabaseManager {
  private tables: Map<string, DatabaseTable> = new Map();
  private migrations: Map<string, Migration> = new Map();

  /**
   * Create a new organization-specific table
   */
  async createOrgTable(config: EntityConfig): Promise<DatabaseTable> {
    const tableName = `${config.orgId}_${config.name.toLowerCase()}s`;
    const tableKey = `${config.orgId}:${config.name}`;
    
    // Generate base columns from primitive
    const baseColumns = this.getBaseColumns(config.basePrimitive);
    
    // Generate custom columns from entity configuration
    const customColumns = this.generateCustomColumns(config.customFields);
    
    // Combine all columns
    const allColumns = [
      ...baseColumns,
      ...customColumns,
      // JSON column for future fields
      {
        name: 'custom_data',
        type: 'JSONB',
        nullable: false,
        default: "'{}'::jsonb"
      },
      // Organization isolation
      {
        name: 'organization_id',
        type: 'UUID',
        nullable: false
      }
    ];

    // Generate indexes
    const indexes = this.generateIndexes(tableName, config);

    // Generate constraints
    const constraints = this.generateConstraints(tableName, config);

    const table: DatabaseTable = {
      name: tableName,
      columns: allColumns,
      indexes,
      constraints,
      createdAt: new Date().toISOString(),
      orgId: config.orgId,
      entityName: config.name
    };

    // Generate and execute migration
    const migration = this.generateCreateTableMigration(table);
    await this.executeMigration(migration);

    // Store table definition
    this.tables.set(tableKey, table);

    return table;
  }

  /**
   * Add a custom field to existing table
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
   * Get base columns for a primitive type
   */
  private getBaseColumns(primitive: string): DatabaseColumn[] {
    const baseColumns: DatabaseColumn[] = [
      {
        name: 'id',
        type: 'UUID',
        nullable: false,
        default: 'gen_random_uuid()'
      },
      {
        name: 'created_at',
        type: 'TIMESTAMP WITH TIME ZONE',
        nullable: false,
        default: 'NOW()'
      },
      {
        name: 'updated_at',
        type: 'TIMESTAMP WITH TIME ZONE',
        nullable: false,
        default: 'NOW()'
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
   * Generate custom columns from field definitions
   */
  private generateCustomColumns(customFields: Record<string, any>): DatabaseColumn[] {
    return Object.entries(customFields).map(([fieldName, fieldDef]) => 
      this.generateColumnFromField(fieldName, fieldDef)
    );
  }

  /**
   * Generate database column from field definition
   */
  private generateColumnFromField(fieldName: string, fieldDef: any): DatabaseColumn {
    const columnName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
    
    let type: string;
    let constraint: string | undefined;

    switch (fieldDef.type) {
      case 'string':
        type = fieldDef.maxLength ? `VARCHAR(${fieldDef.maxLength})` : 'TEXT';
        break;
      case 'number':
        type = 'INTEGER';
        if (fieldDef.min !== undefined || fieldDef.max !== undefined) {
          const min = fieldDef.min ?? 'NULL';
          const max = fieldDef.max ?? 'NULL';
          constraint = `CHECK (${columnName} >= ${min}${max !== 'NULL' ? ` AND ${columnName} <= ${max}` : ''})`;
        }
        break;
      case 'boolean':
        type = 'BOOLEAN';
        break;
      case 'date':
        type = 'DATE';
        break;
      case 'email':
        type = 'TEXT';
        constraint = `CHECK (${columnName} ~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$')`;
        break;
      case 'url':
        type = 'TEXT';
        constraint = `CHECK (${columnName} ~* '^https?://')`;
        break;
      case 'enum':
        type = 'TEXT';
        if (fieldDef.enum && fieldDef.enum.length > 0) {
          const values = fieldDef.enum.map((v: string) => `'${v}'`).join(', ');
          constraint = `CHECK (${columnName} IN (${values}))`;
        }
        break;
      case 'array':
        type = 'JSONB';
        break;
      default:
        type = 'TEXT';
    }

    return {
      name: columnName,
      type,
      nullable: !fieldDef.required,
      default: fieldDef.default ? `'${fieldDef.default}'` : undefined,
      constraint
    };
  }

  /**
   * Generate indexes for the table
   */
  private generateIndexes(tableName: string, config: EntityConfig): string[] {
    const indexes: string[] = [
      // Primary key index (automatic)
      `CREATE UNIQUE INDEX ${tableName}_pkey ON ${tableName} (id);`,
      
      // Organization isolation index
      `CREATE INDEX ${tableName}_org_id_idx ON ${tableName} (organization_id);`,
      
      // Status index (common query pattern)
      `CREATE INDEX ${tableName}_status_idx ON ${tableName} (status);`,
      
      // Created date index
      `CREATE INDEX ${tableName}_created_at_idx ON ${tableName} (created_at);`
    ];

    // Custom field indexes
    Object.entries(config.customFields).forEach(([fieldName, fieldDef]) => {
      if (fieldDef.indexed) {
        const columnName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
        indexes.push(`CREATE INDEX ${tableName}_${columnName}_idx ON ${tableName} (${columnName});`);
      }
    });

    // JSON field indexes (for common query patterns)
    indexes.push(`CREATE INDEX ${tableName}_custom_data_gin_idx ON ${tableName} USING GIN (custom_data);`);

    return indexes;
  }

  /**
   * Generate table constraints
   */
  private generateConstraints(tableName: string, config: EntityConfig): string[] {
    const constraints: string[] = [
      // Foreign key to organizations
      `ALTER TABLE ${tableName} ADD CONSTRAINT ${tableName}_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);`,
      
      // Updated timestamp trigger
      `CREATE TRIGGER ${tableName}_updated_at_trigger BEFORE UPDATE ON ${tableName} FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ];

    return constraints;
  }

  /**
   * Generate CREATE TABLE migration
   */
  private generateCreateTableMigration(table: DatabaseTable): Migration {
    const columnDefs = table.columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.default) def += ` DEFAULT ${col.default}`;
      return def;
    }).join(',\n');

    const constraintDefs = table.columns
      .filter(col => col.constraint)
      .map(col => `  ${col.constraint}`)
      .join(',\n');

    let sql = `CREATE TABLE ${table.name} (\n${columnDefs}`;
    if (constraintDefs) {
      sql += `,\n${constraintDefs}`;
    }
    sql += `\n);`;

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
   * Execute a migration (simulated)
   */
  private async executeMigration(migration: Migration): Promise<void> {
    migration.status = 'executing';
    this.migrations.set(migration.id, migration);

    try {
      // Simulate database execution
      console.log(`Executing migration: ${migration.id}`);
      console.log(`SQL: ${migration.sql}`);
      
      // Simulate execution time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      migration.status = 'completed';
      migration.executedAt = new Date().toISOString();
      
      console.log(`✅ Migration completed: ${migration.id}`);
    } catch (error) {
      migration.status = 'failed';
      migration.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ Migration failed: ${migration.id} - ${migration.error}`);
      throw error;
    } finally {
      this.migrations.set(migration.id, migration);
    }
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
   * Generate database schema report
   */
  generateSchemaReport(): any {
    const tablesByOrg: Record<string, DatabaseTable[]> = {};
    const migrationsByOrg: Record<string, Migration[]> = {};

    // Group tables by organization
    this.getAllTables().forEach(table => {
      if (!tablesByOrg[table.orgId]) {
        tablesByOrg[table.orgId] = [];
      }
      tablesByOrg[table.orgId].push(table);
    });

    // Group migrations by organization
    this.getAllMigrations().forEach(migration => {
      if (!migrationsByOrg[migration.orgId]) {
        migrationsByOrg[migration.orgId] = [];
      }
      migrationsByOrg[migration.orgId].push(migration);
    });

    return {
      summary: {
        totalOrganizations: Object.keys(tablesByOrg).length,
        totalTables: this.getAllTables().length,
        totalMigrations: this.getAllMigrations().length,
        completedMigrations: this.getAllMigrations().filter(m => m.status === 'completed').length
      },
      organizations: Object.keys(tablesByOrg).map(orgId => ({
        orgId,
        tables: tablesByOrg[orgId]?.length || 0,
        migrations: migrationsByOrg[orgId]?.length || 0,
        entities: tablesByOrg[orgId]?.map(t => t.entityName) || []
      })),
      tables: tablesByOrg,
      migrations: migrationsByOrg
    };
  }
}