/**
 * Debounced Migration Service
 * 
 * Batches schema changes over 30 seconds to avoid rapid migrations.
 * Uses Kysely for all SQL operations instead of raw SQL.
 */

import type { Kysely } from 'kysely';
import type { HardcodedDatabase } from '../base/hardcoded-database';
import type { OrgEntityDefinition } from '../json-schema/org-entity-schema';
import type { RuntimeSchemaGenerator } from '../kysely-generator/runtime-schema-generator';

interface PendingMigration {
  id: string;
  organizationId: string;
  entityName: string;
  operation: 'create' | 'update' | 'delete';
  oldDefinition?: OrgEntityDefinition;
  newDefinition?: OrgEntityDefinition;
  scheduledFor: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

interface MigrationBatch {
  organizationId: string;
  migrations: PendingMigration[];
  batchId: string;
}

export class DebouncedMigrationService {
  private readonly DEBOUNCE_DELAY = 30000; // 30 seconds
  private pendingMigrations = new Map<string, PendingMigration>();
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private kysely: Kysely<HardcodedDatabase>,
    private schemaGenerator: RuntimeSchemaGenerator
  ) {}

  /**
   * Schedule a schema change with debouncing
   */
  async scheduleSchemaChange(
    organizationId: string,
    entityName: string,
    operation: 'create' | 'update' | 'delete',
    newDefinition?: OrgEntityDefinition,
    oldDefinition?: OrgEntityDefinition
  ): Promise<string> {
    const migrationKey = `${organizationId}:${entityName}`;
    const migrationId = crypto.randomUUID();
    
    // Cancel existing timer for this entity
    const existingTimer = this.timers.get(migrationKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Create migration record
    const migration: PendingMigration = {
      id: migrationId,
      organizationId,
      entityName,
      operation,
      oldDefinition,
      newDefinition,
      scheduledFor: new Date(Date.now() + this.DEBOUNCE_DELAY),
      status: 'pending',
      createdAt: new Date()
    };

    // Store in memory (replace any existing migration for this entity)
    this.pendingMigrations.set(migrationKey, migration);

    // Set new timer
    const timer = setTimeout(async () => {
      await this.processMigration(migrationKey);
    }, this.DEBOUNCE_DELAY);

    this.timers.set(migrationKey, timer);

    console.log(`[Migration] Scheduled ${operation} for ${organizationId}.${entityName} in ${this.DEBOUNCE_DELAY}ms`);
    return migrationId;
  }

  /**
   * Process a single migration using Kysely
   */
  private async processMigration(migrationKey: string): Promise<void> {
    const migration = this.pendingMigrations.get(migrationKey);
    if (!migration) {
      console.warn(`[Migration] No migration found for key: ${migrationKey}`);
      return;
    }

    try {
      migration.status = 'processing';
      
      console.log(`[Migration] Processing ${migration.operation} for ${migration.organizationId}.${migration.entityName}`);

      switch (migration.operation) {
        case 'create':
          await this.processCreateEntity(migration);
          break;
        case 'update':
          await this.processUpdateEntity(migration);
          break;
        case 'delete':
          await this.processDeleteEntity(migration);
          break;
      }

      migration.status = 'completed';
      console.log(`[Migration] Completed ${migration.operation} for ${migration.organizationId}.${migration.entityName}`);
      
    } catch (error) {
      migration.status = 'failed';
      console.error(`[Migration] Failed ${migration.operation} for ${migration.organizationId}.${migration.entityName}:`, error);
      throw error;
    } finally {
      // Clean up
      this.pendingMigrations.delete(migrationKey);
      this.timers.delete(migrationKey);
    }
  }

  /**
   * Create new entity table using Kysely schema builder
   */
  private async processCreateEntity(migration: PendingMigration): Promise<void> {
    if (!migration.newDefinition) {
      throw new Error('New definition required for create operation');
    }

    const { newDefinition } = migration;
    const tableName = newDefinition.tableName!;

    // Use Kysely schema builder instead of raw SQL
    await this.kysely.schema
      .createTable(tableName)
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo('gen_random_uuid()'))
      .addColumn('organization_id', 'uuid', (col) => col.notNull().references('organization.id'))
      .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo('now()'))
      .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo('now()'))
      .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('active'))
      .addColumn('name', 'varchar(255)', (col) => col.notNull())
      .$call((builder) => {
        // Add base archetype fields
        switch (newDefinition.basePrimitive) {
          case 'Project':
            return builder
              .addColumn('description', 'text')
              .addColumn('priority', 'varchar(50)', (col) => col.defaultTo('medium'))
              .addColumn('start_date', 'timestamptz')
              .addColumn('end_date', 'timestamptz')
              .addColumn('owner_id', 'uuid');
          case 'Task':
            return builder
              .addColumn('description', 'text')
              .addColumn('priority', 'varchar(50)', (col) => col.defaultTo('medium'))
              .addColumn('due_date', 'timestamptz')
              .addColumn('assignee_id', 'uuid')
              .addColumn('project_id', 'uuid');
          default:
            return builder.addColumn('description', 'text');
        }
      })
      .$call((builder) => {
        // Add custom fields
        let schemaBuilder = builder;
        for (const [fieldName, fieldDef] of Object.entries(newDefinition.customFields || {})) {
          const columnName = this.camelToSnake(fieldName);
          schemaBuilder = this.addColumnForFieldType(schemaBuilder, columnName, fieldDef);
        }
        return schemaBuilder;
      })
      .execute();

    // Add indexes using Kysely
    await this.addIndexesForEntity(tableName, newDefinition);
    
    console.log(`[Migration] Created table ${tableName} using Kysely schema builder`);
  }

  /**
   * Update existing entity table using Kysely ALTER TABLE
   */
  private async processUpdateEntity(migration: PendingMigration): Promise<void> {
    if (!migration.newDefinition || !migration.oldDefinition) {
      throw new Error('Both old and new definitions required for update operation');
    }

    const { newDefinition, oldDefinition } = migration;
    const tableName = newDefinition.tableName!;

    // Compare field changes
    const oldFields = oldDefinition.customFields || {};
    const newFields = newDefinition.customFields || {};

    // Add new fields
    for (const [fieldName, fieldDef] of Object.entries(newFields)) {
      if (!(fieldName in oldFields)) {
        const columnName = this.camelToSnake(fieldName);
        await this.addColumnUsingKysely(tableName, columnName, fieldDef);
        console.log(`[Migration] Added column ${columnName} to ${tableName}`);
      }
    }

    // Remove deleted fields
    for (const fieldName of Object.keys(oldFields)) {
      if (!(fieldName in newFields)) {
        const columnName = this.camelToSnake(fieldName);
        await this.dropColumnUsingKysely(tableName, columnName);
        console.log(`[Migration] Dropped column ${columnName} from ${tableName}`);
      }
    }

    // Update modified fields (type changes)
    for (const [fieldName, newFieldDef] of Object.entries(newFields)) {
      const oldFieldDef = oldFields[fieldName];
      if (oldFieldDef && this.hasFieldTypeChanged(oldFieldDef, newFieldDef)) {
        const columnName = this.camelToSnake(fieldName);
        await this.alterColumnUsingKysely(tableName, columnName, newFieldDef);
        console.log(`[Migration] Altered column ${columnName} in ${tableName}`);
      }
    }
  }

  /**
   * Delete entity table using Kysely
   */
  private async processDeleteEntity(migration: PendingMigration): Promise<void> {
    if (!migration.oldDefinition) {
      throw new Error('Old definition required for delete operation');
    }

    const tableName = migration.oldDefinition.tableName!;
    
    // Use Kysely to drop table
    await this.kysely.schema
      .dropTable(tableName)
      .ifExists()
      .execute();
      
    console.log(`[Migration] Dropped table ${tableName} using Kysely`);
  }

  /**
   * Add column using Kysely ALTER TABLE
   */
  private async addColumnUsingKysely(tableName: string, columnName: string, fieldDef: any): Promise<void> {
    let builder = this.kysely.schema.alterTable(tableName);
    builder = this.addColumnForFieldType(builder, columnName, fieldDef);
    await builder.execute();
  }

  /**
   * Drop column using Kysely ALTER TABLE
   */
  private async dropColumnUsingKysely(tableName: string, columnName: string): Promise<void> {
    await this.kysely.schema
      .alterTable(tableName)
      .dropColumn(columnName)
      .execute();
  }

  /**
   * Alter column using Kysely ALTER TABLE
   */
  private async alterColumnUsingKysely(tableName: string, columnName: string, fieldDef: any): Promise<void> {
    // Kysely doesn't have direct column type alteration, so we use raw SQL for this specific case
    const sqlType = this.getPostgreSQLTypeForField(fieldDef);
    await this.kysely.executeQuery({
      sql: `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${sqlType}`,
      parameters: []
    });
  }

  /**
   * Add column to schema builder based on field type
   */
  private addColumnForFieldType(builder: any, columnName: string, fieldDef: any): any {
    switch (fieldDef.type) {
      case 'string':
        return builder.addColumn(columnName, 'varchar(500)', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      case 'number':
        return builder.addColumn(columnName, 'numeric', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      case 'boolean':
        return builder.addColumn(columnName, 'boolean', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      case 'array':
        return builder.addColumn(columnName, 'jsonb', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      case 'text':
        return builder.addColumn(columnName, 'text', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      default:
        return builder.addColumn(columnName, 'jsonb', (col: any) => 
          fieldDef.required ? col.notNull() : col);
    }
  }

  /**
   * Get PostgreSQL type for field definition
   */
  private getPostgreSQLTypeForField(fieldDef: any): string {
    switch (fieldDef.type) {
      case 'string': return 'VARCHAR(500)';
      case 'number': return 'NUMERIC';
      case 'boolean': return 'BOOLEAN';
      case 'array': return 'JSONB';
      case 'text': return 'TEXT';
      default: return 'JSONB';
    }
  }

  /**
   * Add indexes for entity using Kysely
   */
  private async addIndexesForEntity(tableName: string, definition: OrgEntityDefinition): Promise<void> {
    // Add organization_id index (required for multi-org isolation)
    await this.kysely.schema
      .createIndex(`idx_${tableName}_org_id`)
      .on(tableName)
      .column('organization_id')
      .execute();

    // Add status index for common queries
    await this.kysely.schema
      .createIndex(`idx_${tableName}_status`)
      .on(tableName)
      .column('status')
      .execute();

    // Add custom field indexes
    for (const [fieldName, fieldDef] of Object.entries(definition.customFields || {})) {
      if (fieldDef.indexed) {
        const columnName = this.camelToSnake(fieldName);
        await this.kysely.schema
          .createIndex(`idx_${tableName}_${columnName}`)
          .on(tableName)
          .column(columnName)
          .execute();
      }
    }
  }

  /**
   * Check if field type has changed
   */
  private hasFieldTypeChanged(oldField: any, newField: any): boolean {
    return oldField.type !== newField.type || 
           oldField.required !== newField.required;
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Get all pending migrations (for monitoring)
   */
  getPendingMigrations(): PendingMigration[] {
    return Array.from(this.pendingMigrations.values());
  }

  /**
   * Cancel a pending migration
   */
  cancelMigration(organizationId: string, entityName: string): boolean {
    const migrationKey = `${organizationId}:${entityName}`;
    const timer = this.timers.get(migrationKey);
    
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(migrationKey);
      this.pendingMigrations.delete(migrationKey);
      console.log(`[Migration] Cancelled migration for ${migrationKey}`);
      return true;
    }
    
    return false;
  }

  /**
   * Force process all pending migrations immediately (for testing)
   */
  async flushAllPendingMigrations(): Promise<void> {
    const keys = Array.from(this.pendingMigrations.keys());
    await Promise.all(keys.map(key => this.processMigration(key)));
  }
}