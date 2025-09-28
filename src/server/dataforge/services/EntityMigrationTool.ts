/**
 * Entity Migration Tool
 * 
 * Comprehensive migration tool for existing DataForge entity tables.
 * Handles both schema migrations (adding foreign keys) and data type conversions.
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '@/server/db/schema';
import { ForeignKeyManager } from './ForeignKeyManager';
import { DynamicSchemaManager } from './DynamicSchemaManager';

export interface EntityMigrationToolConfig {
  entityManager: any; // EntityManager instance for withKysely access
}

export interface MigrationPlan {
  entityName: string;
  tableName: string;
  archetype: string;
  migrations: {
    addForeignKeys: boolean;
    migrateCustomFields: boolean;
    convertTextToUuid: boolean;
  };
  referenceFields: Array<{
    fieldName: string;
    fieldType: string;
    currentType: string;
    targetType: string;
  }>;
  customFields: Array<{
    fieldName: string;
    fieldType: string;
  }>;
}

export interface MigrationResult {
  success: boolean;
  entitiesMigrated: number;
  foreignKeysAdded: number;
  customFieldsMigrated: number;
  textToUuidConverted: number;
  errors: string[];
  warnings: string[];
  results: Array<{
    entityName: string;
    success: boolean;
    operations: string[];
    errors?: string[];
  }>;
}

export class EntityMigrationTool {
  private foreignKeyManager: ForeignKeyManager;
  private schemaManager: DynamicSchemaManager;
  private entityManager: any;

  constructor(private config: EntityMigrationToolConfig) {
    this.entityManager = config.entityManager;
    this.foreignKeyManager = new ForeignKeyManager({ entityManager: this.entityManager });
    this.schemaManager = new DynamicSchemaManager({ entityManager: this.entityManager });
  }

  /**
   * Generate comprehensive migration plan for all entities in organization
   */
  async generateMigrationPlan(orgId: string): Promise<MigrationPlan[]> {
    console.log(`[EntityMigrationTool] Generating migration plan for org: ${orgId}`);
    
    try {
      // Get all entities for the organization
      const entities = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
          .selectFrom('entity_schemas')
          .select(['entity_name', 'table_name', 'archetype', 'business_metadata'])
          .where('org_id', '=', orgId)
          .where('deleted', '!=', true)
          .execute();
      });

      const plans: MigrationPlan[] = [];
      
      for (const entity of entities) {
        const plan = await this.generateEntityMigrationPlan(orgId, entity);
        if (plan) {
          plans.push(plan);
        }
      }
      
      console.log(`[EntityMigrationTool] Generated ${plans.length} migration plans`);
      return plans;
      
    } catch (error) {
      console.error(`[EntityMigrationTool] Error generating migration plan:`, error);
      return [];
    }
  }

  /**
   * Generate migration plan for a specific entity
   */
  private async generateEntityMigrationPlan(orgId: string, entity: any): Promise<MigrationPlan | null> {
    try {
      const metadata = typeof entity.business_metadata === 'string' 
        ? JSON.parse(entity.business_metadata)
        : entity.business_metadata;

      const allFields = metadata.allFields || [];
      const customFields = metadata.customFields || [];
      
      // Find reference fields that need foreign key constraints
      const referenceFields = allFields.filter((field: any) => 
        field.type === 'user_reference' || field.type === 'entity_reference'
      );

      // Check current column types for reference fields
      const currentSchema = await this.getTableSchema(entity.table_name);
      const referenceFieldDetails = [];
      
      for (const field of referenceFields) {
        const currentColumn = currentSchema.find(col => col.column_name === field.name);
        if (currentColumn) {
          referenceFieldDetails.push({
            fieldName: field.name,
            fieldType: field.type,
            currentType: currentColumn.data_type,
            targetType: 'uuid'
          });
        }
      }

      // Determine what migrations are needed
      const needsForeignKeys = referenceFields.length > 0 && 
        !(await this.foreignKeyManager.hasForeignKeyConstraints(orgId, entity.entity_name));
      
      const needsCustomFieldMigration = customFields.length > 0 && 
        (await this.schemaManager.hasUnmigratedCustomFields(orgId, entity.entity_name));
      
      const needsTextToUuidConversion = referenceFieldDetails.some(field => 
        field.currentType.toLowerCase() === 'text' && field.targetType === 'uuid'
      );

      // Only create plan if migrations are needed
      if (needsForeignKeys || needsCustomFieldMigration || needsTextToUuidConversion) {
        return {
          entityName: entity.entity_name,
          tableName: entity.table_name,
          archetype: entity.archetype,
          migrations: {
            addForeignKeys: needsForeignKeys,
            migrateCustomFields: needsCustomFieldMigration,
            convertTextToUuid: needsTextToUuidConversion
          },
          referenceFields: referenceFieldDetails,
          customFields: customFields.map((field: any) => ({
            fieldName: field.name,
            fieldType: field.type
          }))
        };
      }
      
      return null;
    } catch (error) {
      console.error(`[EntityMigrationTool] Error planning migration for ${entity.entity_name}:`, error);
      return null;
    }
  }

  /**
   * Execute comprehensive migration for all entities
   */
  async executeMigration(
    orgId: string, 
    dryRun: boolean = false,
    entityFilter?: string[]
  ): Promise<MigrationResult> {
    console.log(`[EntityMigrationTool] Starting migration for org ${orgId} (dryRun: ${dryRun})`);
    
    const migrationResult: MigrationResult = {
      success: true,
      entitiesMigrated: 0,
      foreignKeysAdded: 0,
      customFieldsMigrated: 0,
      textToUuidConverted: 0,
      errors: [],
      warnings: [],
      results: []
    };

    try {
      // Generate migration plan
      const plans = await this.generateMigrationPlan(orgId);
      const filteredPlans = entityFilter 
        ? plans.filter(plan => entityFilter.includes(plan.entityName))
        : plans;

      if (filteredPlans.length === 0) {
        migrationResult.warnings.push('No entities require migration');
        return migrationResult;
      }

      console.log(`[EntityMigrationTool] Found ${filteredPlans.length} entities requiring migration`);

      // Execute migrations for each entity
      for (const plan of filteredPlans) {
        try {
          const entityResult = await this.executeEntityMigration(orgId, plan, dryRun);
          migrationResult.results.push(entityResult);
          
          if (entityResult.success) {
            migrationResult.entitiesMigrated++;
          } else {
            migrationResult.success = false;
            migrationResult.errors.push(`${plan.entityName}: ${entityResult.errors?.join(', ')}`);
          }
          
        } catch (error) {
          const errorMsg = `Failed to migrate ${plan.entityName}: ${error}`;
          migrationResult.errors.push(errorMsg);
          migrationResult.results.push({
            entityName: plan.entityName,
            success: false,
            operations: [],
            errors: [errorMsg]
          });
          console.error(`[EntityMigrationTool] ${errorMsg}`);
        }
      }

      // Calculate totals
      migrationResult.foreignKeysAdded = migrationResult.results.reduce(
        (sum, result) => sum + result.operations.filter(op => op.includes('foreign key')).length, 0
      );
      migrationResult.customFieldsMigrated = migrationResult.results.reduce(
        (sum, result) => sum + result.operations.filter(op => op.includes('custom field')).length, 0
      );
      migrationResult.textToUuidConverted = migrationResult.results.reduce(
        (sum, result) => sum + result.operations.filter(op => op.includes('TEXT to UUID')).length, 0
      );

      console.log(`[EntityMigrationTool] Migration ${dryRun ? 'plan' : 'execution'} completed: ${migrationResult.entitiesMigrated}/${filteredPlans.length} entities`);
      
      return migrationResult;
      
    } catch (error) {
      console.error(`[EntityMigrationTool] Migration failed:`, error);
      migrationResult.success = false;
      migrationResult.errors.push(`Migration execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return migrationResult;
    }
  }

  /**
   * Execute migration for a specific entity
   */
  private async executeEntityMigration(
    orgId: string, 
    plan: MigrationPlan, 
    dryRun: boolean
  ): Promise<{ entityName: string; success: boolean; operations: string[]; errors?: string[] }> {
    const operations: string[] = [];
    const errors: string[] = [];
    let success = true;

    console.log(`[EntityMigrationTool] Migrating ${plan.entityName}...`);

    try {
      // Step 1: Convert TEXT reference fields to UUID
      if (plan.migrations.convertTextToUuid) {
        for (const field of plan.referenceFields) {
          if (field.currentType.toLowerCase() === 'text' && field.targetType === 'uuid') {
            try {
              if (!dryRun) {
                await this.convertTextColumnToUuid(plan.tableName, field.fieldName);
              }
              operations.push(`Converted ${field.fieldName} from TEXT to UUID`);
            } catch (error) {
              const errorMsg = `Failed to convert ${field.fieldName} to UUID: ${error}`;
              errors.push(errorMsg);
              success = false;
            }
          }
        }
      }

      // Step 2: Migrate custom fields to real columns
      if (plan.migrations.migrateCustomFields) {
        try {
          const customFieldResult = await this.schemaManager.migrateCustomFieldsToColumns(
            orgId, 
            plan.entityName, 
            dryRun
          );
          
          if (customFieldResult.success) {
            operations.push(`Migrated ${customFieldResult.migratedFields.length} custom fields to columns`);
          } else {
            errors.push(`Custom field migration failed: ${customFieldResult.errors?.join(', ')}`);
            success = false;
          }
        } catch (error) {
          errors.push(`Custom field migration error: ${error}`);
          success = false;
        }
      }

      // Step 3: Add foreign key constraints
      if (plan.migrations.addForeignKeys) {
        try {
          const fkResult = await this.foreignKeyManager.addForeignKeyConstraints(
            orgId, 
            plan.entityName, 
            dryRun
          );
          
          if (fkResult.success) {
            operations.push(`Added ${fkResult.constraintsAdded.length} foreign key constraints`);
          } else {
            errors.push(`Foreign key creation failed: ${fkResult.errors?.join(', ')}`);
            // Don't mark as failure since FK constraints are optional
            if (fkResult.warnings) {
              // Add warnings but continue
            }
          }
        } catch (error) {
          errors.push(`Foreign key error: ${error}`);
        }
      }

      return {
        entityName: plan.entityName,
        success: success && errors.length === 0,
        operations,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      return {
        entityName: plan.entityName,
        success: false,
        operations,
        errors: [`Entity migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Convert TEXT column to UUID (for reference fields)
   */
  private async convertTextColumnToUuid(tableName: string, columnName: string): Promise<void> {
    console.log(`[EntityMigrationTool] Converting ${tableName}.${columnName} from TEXT to UUID`);

    await this.entityManager.withKysely(async (kysely) => {
      return await kysely.transaction().execute(async (trx) => {
        // First, update any invalid UUID values to NULL
        const updateSQL = `UPDATE ${tableName} SET ${columnName} = NULL
           WHERE ${columnName} IS NOT NULL
           AND ${columnName} !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`;
        await sql.raw(updateSQL).execute(trx);

        // Then alter the column type
        const alterSQL = `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE UUID USING ${columnName}::UUID`;
        await sql.raw(alterSQL).execute(trx);
      });
    });

    console.log(`[EntityMigrationTool] Successfully converted ${tableName}.${columnName} to UUID`);
  }

  /**
   * Get current table schema
   */
  private async getTableSchema(tableName: string): Promise<Array<{column_name: string; data_type: string}>> {
    try {
      const schema = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
          .selectFrom('information_schema.columns')
          .select(['column_name', 'data_type'])
          .where('table_name', '=', tableName)
          .execute();
      });

      return schema;
    } catch (error) {
      console.warn(`[EntityMigrationTool] Could not get schema for ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Validate UUID format
   */
  private isValidUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}