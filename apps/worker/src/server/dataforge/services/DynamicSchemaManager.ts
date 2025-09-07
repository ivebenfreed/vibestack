/**
 * Dynamic Schema Manager
 * 
 * Handles migration of custom fields from JSONB to real columns
 * and manages ongoing schema evolution for DataForge entities.
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '@/server/db/schema';
import type { FieldDefinition } from '../json-rules-engine';

export interface DynamicSchemaManagerConfig {
  kysely: Kysely<Database>;
}

export interface MigrationResult {
  success: boolean;
  migratedFields: string[];
  errors?: string[];
  warnings?: string[];
  sql?: string[];
}

export class DynamicSchemaManager {
  constructor(private config: DynamicSchemaManagerConfig) {}

  /**
   * Migrate custom fields from JSONB to real columns for a specific entity
   */
  async migrateCustomFieldsToColumns(
    orgId: string, 
    entityName: string,
    dryRun: boolean = false
  ): Promise<MigrationResult> {
    try {
      console.log(`[DynamicSchemaManager] Starting migration for ${entityName} (dryRun: ${dryRun})`);
      
      // Get entity configuration and custom fields
      const entityConfig = await this.getEntityConfiguration(orgId, entityName);
      if (!entityConfig) {
        return { success: false, errors: [`Entity ${entityName} not found`], migratedFields: [] };
      }

      const { tableName, customFields } = entityConfig;
      
      if (!customFields || customFields.length === 0) {
        return { 
          success: true, 
          migratedFields: [], 
          warnings: ['No custom fields to migrate'] 
        };
      }

      // Get existing data from custom_fields JSONB
      const existingData = await this.extractCustomFieldData(tableName);
      
      // Generate ALTER TABLE statements for each custom field
      const migrationSql: string[] = [];
      const migratedFields: string[] = [];
      
      for (const field of customFields) {
        try {
          const columnDDL = this.generateColumnDDL(field);
          const alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${field.name} ${columnDDL};`;
          
          migrationSql.push(alterSQL);
          migratedFields.push(field.name);
          
          console.log(`[DynamicSchemaManager] Prepared column: ${field.name} ${columnDDL}`);
        } catch (error) {
          console.error(`[DynamicSchemaManager] Error preparing field ${field.name}:`, error);
          return { 
            success: false, 
            errors: [`Failed to prepare column ${field.name}: ${error}`],
            migratedFields: []
          };
        }
      }

      if (dryRun) {
        return {
          success: true,
          migratedFields,
          sql: migrationSql,
          warnings: [`Dry run - ${migrationSql.length} columns would be added`]
        };
      }

      // Execute migration in transaction
      const result = await this.config.kysely.transaction().execute(async (trx) => {
        // Add all columns
        for (const sqlStr of migrationSql) {
          await sql.raw(sqlStr).execute(trx);
        }

        // Migrate data from JSONB to columns
        await this.migrateDataToColumns(trx, tableName, customFields, existingData);
        
        // Update entity schema to mark fields as migrated
        await this.updateEntitySchema(trx, orgId, entityName, customFields);
        
        return { success: true };
      });

      console.log(`[DynamicSchemaManager] Migration completed for ${entityName}`);
      
      return {
        success: true,
        migratedFields,
        sql: migrationSql
      };
      
    } catch (error) {
      console.error(`[DynamicSchemaManager] Migration failed for ${entityName}:`, error);
      return {
        success: false,
        errors: [`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        migratedFields: []
      };
    }
  }

  /**
   * Add new custom field as real column (for new fields going forward)
   */
  async addCustomFieldAsColumn(
    orgId: string,
    entityName: string, 
    field: FieldDefinition
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const entityConfig = await this.getEntityConfiguration(orgId, entityName);
      if (!entityConfig) {
        return { success: false, error: `Entity ${entityName} not found` };
      }

      const { tableName } = entityConfig;
      const columnDDL = this.generateColumnDDL(field);
      const alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${field.name} ${columnDDL}`;
      
      await sql.raw(alterSQL).execute(this.config.kysely);
      
      console.log(`[DynamicSchemaManager] Added custom field column: ${field.name}`);
      return { success: true };
      
    } catch (error) {
      console.error(`[DynamicSchemaManager] Failed to add custom field column:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get entity configuration including custom fields
   */
  private async getEntityConfiguration(orgId: string, entityName: string) {
    const entity = await this.config.kysely
      .selectFrom('entity_schemas')
      .select(['entity_name', 'table_name', 'business_metadata'])
      .where('org_id', '=', orgId)
      .where('entity_name', '=', entityName)
      .where('deleted', '!=', true)
      .executeTakeFirst();

    if (!entity) return null;

    const metadata = typeof entity.business_metadata === 'string' 
      ? JSON.parse(entity.business_metadata)
      : entity.business_metadata;

    return {
      tableName: entity.table_name,
      customFields: metadata.customFields || []
    };
  }

  /**
   * Extract existing data from custom_fields JSONB column
   */
  private async extractCustomFieldData(tableName: string): Promise<Record<string, any>[]> {
    try {
      const result = await this.config.kysely
        .selectFrom(tableName as any)
        .select(['id', 'custom_fields'])
        .where('custom_fields', '!=', this.config.kysely.raw('\'{}\'::jsonb'))
        .execute();
        
      return result.map((row: any) => ({
        id: row.id,
        customFields: row.custom_fields || {}
      }));
    } catch (error) {
      console.warn(`[DynamicSchemaManager] Could not extract custom field data:`, error);
      return [];
    }
  }

  /**
   * Generate proper PostgreSQL column DDL for field type
   */
  private generateColumnDDL(field: FieldDefinition): string {
    let ddl = '';
    
    // Map field types to PostgreSQL types
    switch (field.type) {
      case 'text':
      case 'longtext':
      case 'email':
      case 'url':
        ddl += 'TEXT';
        break;
      case 'number':
      case 'decimal':
        ddl += 'NUMERIC';
        break;
      case 'integer':
        ddl += 'INTEGER';
        break;
      case 'boolean':
        ddl += 'BOOLEAN';
        break;
      case 'date':
        ddl += 'DATE';
        break;
      case 'datetime':
        ddl += 'TIMESTAMP WITHOUT TIME ZONE';
        break;
      case 'json':
        ddl += 'JSONB';
        break;
      case 'user_reference':
      case 'entity_reference':
        ddl += 'UUID';
        // TODO: Add foreign key constraints
        break;
      default:
        ddl += 'TEXT';
    }
    
    // Add constraints
    if (field.required) {
      ddl += ' NOT NULL';
    }
    
    // Add default value
    if (field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        ddl += ` DEFAULT '${field.defaultValue}'`;
      } else if (typeof field.defaultValue === 'boolean') {
        ddl += ` DEFAULT ${field.defaultValue ? 'true' : 'false'}`;
      } else if (typeof field.defaultValue === 'number') {
        ddl += ` DEFAULT ${field.defaultValue}`;
      } else if (typeof field.defaultValue === 'object') {
        ddl += ` DEFAULT '${JSON.stringify(field.defaultValue)}'::jsonb`;
      }
    }
    
    return ddl;
  }

  /**
   * Migrate data from JSONB custom_fields to individual columns
   */
  private async migrateDataToColumns(
    trx: any,
    tableName: string, 
    customFields: FieldDefinition[],
    existingData: Record<string, any>[]
  ): Promise<void> {
    console.log(`[DynamicSchemaManager] Migrating ${existingData.length} records`);
    
    for (const record of existingData) {
      const updates: Record<string, any> = {};
      
      // Extract each custom field value
      for (const field of customFields) {
        const value = record.customFields[field.name];
        if (value !== undefined) {
          updates[field.name] = value;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await trx
          .updateTable(tableName)
          .set(updates)
          .where('id', '=', record.id)
          .execute();
      }
    }
    
    // Clear the custom_fields JSONB column after successful migration
    await trx
      .updateTable(tableName)
      .set({ custom_fields: sql`'{}'::jsonb` })
      .execute();
  }

  /**
   * Update entity schema to mark custom fields as migrated to columns
   */
  private async updateEntitySchema(
    trx: any,
    orgId: string,
    entityName: string,
    migratedFields: FieldDefinition[]
  ): Promise<void> {
    // Update business_metadata to mark fields as migrated
    const entity = await trx
      .selectFrom('entity_schemas')
      .select('business_metadata')
      .where('org_id', '=', orgId)
      .where('entity_name', '=', entityName)
      .executeTakeFirst();
      
    if (entity) {
      const metadata = typeof entity.business_metadata === 'string' 
        ? JSON.parse(entity.business_metadata)
        : entity.business_metadata;
      
      // Mark custom fields as migrated to columns  
      if (metadata.customFields) {
        metadata.customFields = metadata.customFields.map((field: FieldDefinition) => ({
          ...field,
          source: 'column', // Changed from 'custom' to 'column'
          migrated: true,
          migratedAt: new Date().toISOString()
        }));
      }
      
      await trx
        .updateTable('entity_schemas')
        .set({ 
          business_metadata: JSON.stringify(metadata),
          updated_at: new Date()
        })
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .execute();
    }
  }

  /**
   * Check if entity has unmigrated custom fields
   */
  async hasUnmigratedCustomFields(orgId: string, entityName: string): Promise<boolean> {
    const entityConfig = await this.getEntityConfiguration(orgId, entityName);
    if (!entityConfig?.customFields) return false;
    
    return entityConfig.customFields.some((field: FieldDefinition & { migrated?: boolean }) => 
      !field.migrated
    );
  }
}