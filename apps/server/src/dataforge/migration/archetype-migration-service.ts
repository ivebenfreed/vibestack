/**
 * DataForge Debounced Migration Service
 * 
 * Connects DataForge archetype system to debounced migrations.
 * Batches archetype entity schema changes over 30 seconds to avoid rapid migrations.
 * Integrates with existing FoundationEntityRegistry and OrgSchemaDO.
 */

import type { Kysely } from 'kysely';
import { FoundationEntityRegistry, type FieldDefinition } from '../entities/foundation';

interface ArchetypeMigration {
  id: string;
  organizationId: string;
  entityName: string;
  archetype: string;
  operation: 'create' | 'update' | 'delete';
  oldFields?: Record<string, FieldDefinition>;
  newFields?: Record<string, FieldDefinition>;
  scheduledFor: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

interface ArchetypeMigrationBatch {
  organizationId: string;
  migrations: ArchetypeMigration[];
  batchId: string;
}

export class ArchetypeMigrationService {
  private readonly DEBOUNCE_DELAY = 30000; // 30 seconds
  private pendingMigrations = new Map<string, ArchetypeMigration>();
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private kysely: Kysely<any>,
    private orgSchemaBinding: any // Cloudflare DO binding
  ) {}

  /**
   * Schedule archetype entity schema change with debouncing
   * 
   * @param organizationId - Organization ID for isolation
   * @param entityName - Custom entity name (e.g., 'client_projects')
   * @param archetype - DataForge archetype pattern (project, task, etc.)
   * @param operation - Type of schema change
   * @param newFields - New custom fields definition
   * @param oldFields - Previous custom fields (for updates)
   */
  async scheduleArchetypeSchemaChange(
    organizationId: string,
    entityName: string,
    archetype: string,
    operation: 'create' | 'update' | 'delete',
    newFields?: Record<string, FieldDefinition>,
    oldFields?: Record<string, FieldDefinition>
  ): Promise<string> {
    // Validate archetype pattern
    if (!FoundationEntityRegistry.isValidArchetypePattern(archetype)) {
      throw new Error(`Invalid archetype: ${archetype}. Supported: ${FoundationEntityRegistry.getUniversalArchetypes().join(', ')}`);
    }

    const migrationKey = `${organizationId}:${entityName}`;
    const migrationId = crypto.randomUUID();
    
    console.log(`[Archetype Migration] Scheduling ${operation} for ${archetype} entity: ${organizationId}.${entityName}`);
    
    // Cancel existing timer for this entity
    const existingTimer = this.timers.get(migrationKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      console.log(`[Archetype Migration] Cancelled previous migration for ${migrationKey}`);
    }

    // Create migration record
    const migration: ArchetypeMigration = {
      id: migrationId,
      organizationId,
      entityName,
      archetype,
      operation,
      oldFields,
      newFields,
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

    console.log(`[Archetype Migration] Scheduled ${operation} for ${archetype} entity ${organizationId}.${entityName} in ${this.DEBOUNCE_DELAY}ms`);
    return migrationId;
  }

  /**
   * Process a single archetype migration
   */
  private async processMigration(migrationKey: string): Promise<void> {
    const migration = this.pendingMigrations.get(migrationKey);
    if (!migration) {
      console.warn(`[Archetype Migration] No migration found for key: ${migrationKey}`);
      return;
    }

    try {
      migration.status = 'processing';
      
      console.log(`[Archetype Migration] Processing ${migration.operation} for ${migration.archetype} entity ${migration.organizationId}.${migration.entityName}`);

      switch (migration.operation) {
        case 'create':
          await this.processCreateArchetypeEntity(migration);
          break;
        case 'update':
          await this.processUpdateArchetypeEntity(migration);
          break;
        case 'delete':
          await this.processDeleteArchetypeEntity(migration);
          break;
      }

      migration.status = 'completed';
      console.log(`[Archetype Migration] ✅ Completed ${migration.operation} for ${migration.archetype} entity ${migration.organizationId}.${migration.entityName}`);
      
    } catch (error) {
      migration.status = 'failed';
      console.error(`[Archetype Migration] ❌ Failed ${migration.operation} for ${migration.archetype} entity ${migration.organizationId}.${migration.entityName}:`, error);
      
      // Try to clear temp schema even on failure to avoid stale data
      try {
        await this.clearTempSchemaAfterMigration(migration.organizationId, migration.entityName);
      } catch (clearError) {
        console.warn(`[Archetype Migration] Warning: Failed to clear temp schema on error:`, clearError);
      }
      
      throw error;
    } finally {
      // Clean up
      this.pendingMigrations.delete(migrationKey);
      this.timers.delete(migrationKey);
    }
  }

  /**
   * Create new archetype entity using OrgSchemaDO
   */
  private async processCreateArchetypeEntity(migration: ArchetypeMigration): Promise<void> {
    if (!migration.newFields) {
      throw new Error('New fields required for create operation');
    }

    const { organizationId, entityName, archetype, newFields } = migration;
    const tableName = `${organizationId}_${entityName}`;

    console.log(`[Archetype Migration] Creating ${archetype} entity table: ${tableName}`);

    // Get OrgSchemaDO instance for this organization
    const doId = this.orgSchemaBinding.idFromName(organizationId);
    const doStub = this.orgSchemaBinding.get(doId);

    // Use OrgSchemaDO to generate DDL
    const response = await doStub.fetch(new Request('http://localhost/create-archetype', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: organizationId,
        archetype,
        tableName: entityName,
        fieldDefinitions: newFields
      })
    }));

    const schemaResult = await response.json();
    if (!schemaResult.success) {
      throw new Error(`Failed to create archetype entity: ${schemaResult.error}`);
    }

    // Execute the DDL in PostgreSQL
    if (schemaResult.ddl) {
      await this.executeDDLStatements(schemaResult.ddl);
      console.log(`[Archetype Migration] ✅ Executed DDL for ${tableName}`);
    }

    // SIMPLIFIED DO INTEGRATION: Clear temp schema after successful PostgreSQL migration
    await this.clearTempSchemaAfterMigration(organizationId, entityName);

    console.log(`[Archetype Migration] ✅ Created ${archetype} entity ${tableName} with ${Object.keys(newFields).length} custom fields`);
  }

  /**
   * Update existing archetype entity with field changes
   */
  private async processUpdateArchetypeEntity(migration: ArchetypeMigration): Promise<void> {
    if (!migration.newFields || !migration.oldFields) {
      throw new Error('Both old and new fields required for update operation');
    }

    const { organizationId, entityName, archetype, newFields, oldFields } = migration;
    const tableName = `${organizationId}_${entityName}`;

    console.log(`[Archetype Migration] Updating ${archetype} entity table: ${tableName}`);

    // Compare field changes
    const fieldsToAdd = this.getFieldsToAdd(oldFields, newFields);
    const fieldsToRemove = this.getFieldsToRemove(oldFields, newFields);
    const fieldsToModify = this.getFieldsToModify(oldFields, newFields);

    // Process field additions
    for (const [fieldName, fieldDef] of Object.entries(fieldsToAdd)) {
      await this.addColumnToArchetypeEntity(tableName, fieldName, fieldDef);
      console.log(`[Archetype Migration] ➕ Added field '${fieldName}' to ${tableName}`);
    }

    // Process field removals
    for (const fieldName of fieldsToRemove) {
      await this.removeColumnFromArchetypeEntity(tableName, fieldName);
      console.log(`[Archetype Migration] ➖ Removed field '${fieldName}' from ${tableName}`);
    }

    // Process field modifications
    for (const [fieldName, fieldDef] of Object.entries(fieldsToModify)) {
      await this.modifyColumnInArchetypeEntity(tableName, fieldName, fieldDef);
      console.log(`[Archetype Migration] ✏️  Modified field '${fieldName}' in ${tableName}`);
    }

    console.log(`[Archetype Migration] ✅ Updated ${archetype} entity ${tableName}: +${Object.keys(fieldsToAdd).length} fields, -${fieldsToRemove.length} fields, ~${Object.keys(fieldsToModify).length} fields`);
  }

  /**
   * Delete archetype entity table
   */
  private async processDeleteArchetypeEntity(migration: ArchetypeMigration): Promise<void> {
    const { organizationId, entityName, archetype } = migration;
    const tableName = `${organizationId}_${entityName}`;

    console.log(`[Archetype Migration] Deleting ${archetype} entity table: ${tableName}`);

    // Drop the table using Kysely
    await this.kysely.schema
      .dropTable(tableName)
      .ifExists()
      .execute();

    console.log(`[Archetype Migration] ✅ Deleted ${archetype} entity table ${tableName}`);
  }

  /**
   * Execute DDL statements (handles multi-statement DDL)
   */
  private async executeDDLStatements(ddl: string): Promise<void> {
    // Split DDL by semicolons and execute each statement
    const statements = ddl
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      await this.kysely.executeQuery({
        sql: statement,
        parameters: []
      });
    }
  }

  /**
   * Add column to existing archetype entity
   */
  private async addColumnToArchetypeEntity(
    tableName: string, 
    fieldName: string, 
    fieldDef: FieldDefinition
  ): Promise<void> {
    let builder = this.kysely.schema.alterTable(tableName);
    builder = this.addColumnForFieldType(builder, fieldName, fieldDef);
    await builder.execute();
  }

  /**
   * Remove column from archetype entity
   */
  private async removeColumnFromArchetypeEntity(tableName: string, fieldName: string): Promise<void> {
    await this.kysely.schema
      .alterTable(tableName)
      .dropColumn(fieldName)
      .execute();
  }

  /**
   * Modify column in archetype entity
   */
  private async modifyColumnInArchetypeEntity(
    tableName: string, 
    fieldName: string, 
    fieldDef: FieldDefinition
  ): Promise<void> {
    // PostgreSQL column type modification
    const sqlType = this.getPostgreSQLTypeForField(fieldDef);
    await this.kysely.executeQuery({
      sql: `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} TYPE ${sqlType}`,
      parameters: []
    });
  }

  /**
   * Add column to schema builder based on field type
   */
  private addColumnForFieldType(builder: any, fieldName: string, fieldDef: FieldDefinition): any {
    switch (fieldDef.type) {
      case 'text':
        return builder.addColumn(fieldName, 'text', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      case 'decimal':
        return builder.addColumn(fieldName, 'numeric', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      case 'boolean':
        return builder.addColumn(fieldName, 'boolean', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      case 'json':
        return builder.addColumn(fieldName, 'jsonb', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      case 'date':
        return builder.addColumn(fieldName, 'timestamptz', (col: any) => 
          fieldDef.required ? col.notNull() : col);
      default:
        return builder.addColumn(fieldName, 'text', (col: any) => 
          fieldDef.required ? col.notNull() : col);
    }
  }

  /**
   * Get PostgreSQL type for field definition
   */
  private getPostgreSQLTypeForField(fieldDef: FieldDefinition): string {
    switch (fieldDef.type) {
      case 'text': return 'TEXT';
      case 'decimal': return 'NUMERIC';
      case 'boolean': return 'BOOLEAN';
      case 'json': return 'JSONB';
      case 'date': return 'TIMESTAMPTZ';
      default: return 'TEXT';
    }
  }

  /**
   * Get fields that need to be added
   */
  private getFieldsToAdd(
    oldFields: Record<string, FieldDefinition>,
    newFields: Record<string, FieldDefinition>
  ): Record<string, FieldDefinition> {
    const fieldsToAdd: Record<string, FieldDefinition> = {};
    
    for (const [fieldName, fieldDef] of Object.entries(newFields)) {
      if (!(fieldName in oldFields)) {
        fieldsToAdd[fieldName] = fieldDef;
      }
    }
    
    return fieldsToAdd;
  }

  /**
   * Get fields that need to be removed
   */
  private getFieldsToRemove(
    oldFields: Record<string, FieldDefinition>,
    newFields: Record<string, FieldDefinition>
  ): string[] {
    const fieldsToRemove: string[] = [];
    
    for (const fieldName of Object.keys(oldFields)) {
      if (!(fieldName in newFields)) {
        fieldsToRemove.push(fieldName);
      }
    }
    
    return fieldsToRemove;
  }

  /**
   * Get fields that need to be modified
   */
  private getFieldsToModify(
    oldFields: Record<string, FieldDefinition>,
    newFields: Record<string, FieldDefinition>
  ): Record<string, FieldDefinition> {
    const fieldsToModify: Record<string, FieldDefinition> = {};
    
    for (const [fieldName, newFieldDef] of Object.entries(newFields)) {
      const oldFieldDef = oldFields[fieldName];
      if (oldFieldDef && this.hasFieldChanged(oldFieldDef, newFieldDef)) {
        fieldsToModify[fieldName] = newFieldDef;
      }
    }
    
    return fieldsToModify;
  }

  /**
   * Check if field definition has changed
   */
  private hasFieldChanged(oldField: FieldDefinition, newField: FieldDefinition): boolean {
    return oldField.type !== newField.type || 
           oldField.required !== newField.required;
  }

  /**
   * Clear temporary schema data in DO after successful PostgreSQL migration
   * This implements the simplified DO integration approach - DOs are used only for
   * DDL generation during migrations, then cleared to avoid long-term caching
   */
  private async clearTempSchemaAfterMigration(organizationId: string, entityName: string): Promise<void> {
    try {
      const doId = this.orgSchemaBinding.idFromName(organizationId);
      const doStub = this.orgSchemaBinding.get(doId);

      // Clear the specific entity from DO temporary storage
      await doStub.fetch(new Request(`http://localhost/clear-temp-schema/${entityName}`, {
        method: 'DELETE'
      }));

      console.log(`[Archetype Migration] 🧹 Cleared temp schema for ${organizationId}.${entityName}`);
    } catch (error) {
      // Non-critical error - log but don't fail migration
      console.warn(`[Archetype Migration] Warning: Failed to clear temp schema for ${organizationId}.${entityName}:`, error);
    }
  }

  /**
   * Get all pending migrations (for monitoring)
   */
  getPendingMigrations(): ArchetypeMigration[] {
    return Array.from(this.pendingMigrations.values());
  }

  /**
   * Get pending migrations for a specific organization
   */
  getPendingMigrationsForOrg(organizationId: string): ArchetypeMigration[] {
    return Array.from(this.pendingMigrations.values())
      .filter(migration => migration.organizationId === organizationId);
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
      console.log(`[Archetype Migration] Cancelled migration for ${migrationKey}`);
      return true;
    }
    
    return false;
  }

  /**
   * Force process all pending migrations immediately (for testing)
   */
  async flushAllPendingMigrations(): Promise<void> {
    const keys = Array.from(this.pendingMigrations.keys());
    console.log(`[Archetype Migration] Force processing ${keys.length} pending migrations`);
    await Promise.all(keys.map(key => this.processMigration(key)));
  }

  /**
   * Force process pending migrations for a specific organization
   */
  async flushPendingMigrationsForOrg(organizationId: string): Promise<void> {
    const keys = Array.from(this.pendingMigrations.keys())
      .filter(key => key.startsWith(`${organizationId}:`));
    console.log(`[Archetype Migration] Force processing ${keys.length} pending migrations for org ${organizationId}`);
    await Promise.all(keys.map(key => this.processMigration(key)));
  }

  /**
   * Get migration statistics
   */
  getMigrationStats(): {
    totalPending: number;
    byOrganization: Record<string, number>;
    byArchetype: Record<string, number>;
    byOperation: Record<string, number>;
  } {
    const migrations = this.getPendingMigrations();
    
    const byOrganization: Record<string, number> = {};
    const byArchetype: Record<string, number> = {};
    const byOperation: Record<string, number> = {};
    
    for (const migration of migrations) {
      byOrganization[migration.organizationId] = (byOrganization[migration.organizationId] || 0) + 1;
      byArchetype[migration.archetype] = (byArchetype[migration.archetype] || 0) + 1;
      byOperation[migration.operation] = (byOperation[migration.operation] || 0) + 1;
    }
    
    return {
      totalPending: migrations.length,
      byOrganization,
      byArchetype,
      byOperation
    };
  }
}