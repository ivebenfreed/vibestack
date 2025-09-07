/**
 * Foreign Key Manager
 * 
 * Handles dynamic foreign key constraint creation and management for DataForge entities.
 * Resolves entity references, manages constraint naming, and handles cascade behaviors.
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '@/server/db/schema';
import type { FieldDefinition } from '../json-rules-engine';

export interface ForeignKeyManagerConfig {
  kysely: Kysely<Database>;
}

export interface ForeignKeyConstraint {
  constraintName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface ForeignKeyResult {
  success: boolean;
  constraintsAdded: ForeignKeyConstraint[];
  errors?: string[];
  warnings?: string[];
  sql?: string[];
}

export class ForeignKeyManager {
  constructor(private config: ForeignKeyManagerConfig) {}

  /**
   * Add foreign key constraints to an entity table for all reference fields
   */
  async addForeignKeyConstraints(
    orgId: string, 
    entityName: string,
    dryRun: boolean = false
  ): Promise<ForeignKeyResult> {
    try {
      console.log(`[ForeignKeyManager] Processing foreign keys for ${entityName} (dryRun: ${dryRun})`);
      
      // Get entity configuration and reference fields
      const entityConfig = await this.getEntityConfiguration(orgId, entityName);
      if (!entityConfig) {
        return { 
          success: false, 
          errors: [`Entity ${entityName} not found`], 
          constraintsAdded: [] 
        };
      }

      const { tableName, referenceFields } = entityConfig;
      
      if (!referenceFields || referenceFields.length === 0) {
        return {
          success: true,
          constraintsAdded: [],
          warnings: ['No reference fields found - no foreign keys to add']
        };
      }

      const constraints: ForeignKeyConstraint[] = [];
      const sqlStatements: string[] = [];
      const errors: string[] = [];
      
      for (const field of referenceFields) {
        try {
          const constraint = await this.resolveForeignKeyConstraint(orgId, tableName, field);
          
          if (constraint) {
            constraints.push(constraint);
            sqlStatements.push(this.generateForeignKeySQL(constraint));
            console.log(`[ForeignKeyManager] Resolved constraint: ${constraint.constraintName}`);
          } else {
            console.warn(`[ForeignKeyManager] Could not resolve foreign key for field: ${field.name}`);
          }
        } catch (error) {
          const errorMsg = `Failed to resolve constraint for ${field.name}: ${error}`;
          errors.push(errorMsg);
          console.error(`[ForeignKeyManager] ${errorMsg}`);
        }
      }

      if (dryRun) {
        return {
          success: true,
          constraintsAdded: constraints,
          sql: sqlStatements,
          warnings: [`Dry run - ${constraints.length} foreign key constraints would be added`]
        };
      }

      // Execute foreign key additions in transaction
      const result = await this.config.kysely.transaction().execute(async (trx) => {
        const addedConstraints: ForeignKeyConstraint[] = [];
        
        for (const constraint of constraints) {
          try {
            const constraintSQL = this.generateForeignKeySQL(constraint);
            await sql.raw(constraintSQL).execute(trx);
            addedConstraints.push(constraint);
            console.log(`[ForeignKeyManager] Added: ${constraint.constraintName}`);
          } catch (error) {
            // Log but continue - some constraints may already exist
            console.warn(`[ForeignKeyManager] Failed to add ${constraint.constraintName}:`, error);
          }
        }
        
        return addedConstraints;
      });

      return {
        success: true,
        constraintsAdded: result,
        sql: sqlStatements,
        warnings: errors.length > 0 ? [`Some constraints failed: ${errors.join(', ')}`] : undefined
      };
      
    } catch (error) {
      console.error(`[ForeignKeyManager] Error adding foreign keys for ${entityName}:`, error);
      return {
        success: false,
        errors: [`Foreign key creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        constraintsAdded: []
      };
    }
  }

  /**
   * Remove foreign key constraints from an entity table
   */
  async removeForeignKeyConstraints(
    orgId: string,
    entityName: string,
    fieldNames?: string[]
  ): Promise<ForeignKeyResult> {
    try {
      const entityConfig = await this.getEntityConfiguration(orgId, entityName);
      if (!entityConfig) {
        return { 
          success: false, 
          errors: [`Entity ${entityName} not found`], 
          constraintsAdded: [] 
        };
      }

      const { tableName } = entityConfig;
      
      // Get existing foreign key constraints
      const existingConstraints = await this.getExistingForeignKeys(tableName);
      
      // Filter by field names if specified
      const constraintsToRemove = fieldNames 
        ? existingConstraints.filter(c => fieldNames.includes(c.sourceColumn))
        : existingConstraints;
      
      if (constraintsToRemove.length === 0) {
        return {
          success: true,
          constraintsAdded: [],
          warnings: ['No foreign key constraints found to remove']
        };
      }

      const sqlStatements: string[] = [];
      const removedConstraints: ForeignKeyConstraint[] = [];
      
      await this.config.kysely.transaction().execute(async (trx) => {
        for (const constraint of constraintsToRemove) {
          try {
            const dropSQL = `ALTER TABLE ${constraint.sourceTable} DROP CONSTRAINT IF EXISTS ${constraint.constraintName}`;
            await sql.raw(dropSQL).execute(trx);
            sqlStatements.push(dropSQL);
            removedConstraints.push(constraint);
            console.log(`[ForeignKeyManager] Removed: ${constraint.constraintName}`);
          } catch (error) {
            console.warn(`[ForeignKeyManager] Failed to remove ${constraint.constraintName}:`, error);
          }
        }
      });

      return {
        success: true,
        constraintsAdded: removedConstraints, // Reusing field for removed constraints
        sql: sqlStatements
      };
      
    } catch (error) {
      console.error(`[ForeignKeyManager] Error removing foreign keys:`, error);
      return {
        success: false,
        errors: [`Foreign key removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        constraintsAdded: []
      };
    }
  }

  /**
   * Get entity configuration with reference field information
   */
  private async getEntityConfiguration(orgId: string, entityName: string) {
    const { EntityNameUtils } = await import('@/lib/entity-name-utils');
    const normalizedEntityName = EntityNameUtils.toPascalCase(entityName);
    
    const entity = await this.config.kysely
      .selectFrom('entity_schemas')
      .select(['entity_name', 'table_name', 'business_metadata'])
      .where('org_id', '=', orgId)
      .where('entity_name', '=', normalizedEntityName)
      .where('deleted', '!=', true)
      .executeTakeFirst();

    if (!entity) return null;

    const metadata = typeof entity.business_metadata === 'string' 
      ? JSON.parse(entity.business_metadata)
      : entity.business_metadata;

    // Extract reference fields from all fields
    const allFields = metadata.allFields || [];
    const referenceFields = allFields.filter((field: FieldDefinition) => 
      field.type === 'user_reference' || field.type === 'entity_reference'
    );

    return {
      tableName: entity.table_name,
      referenceFields
    };
  }

  /**
   * Resolve foreign key constraint details for a reference field
   */
  private async resolveForeignKeyConstraint(
    orgId: string,
    sourceTable: string, 
    field: FieldDefinition
  ): Promise<ForeignKeyConstraint | null> {
    let targetTable: string;
    let targetColumn = 'id'; // Standard primary key column
    
    switch (field.type) {
      case 'user_reference':
        targetTable = '"user"'; // Quoted because 'user' is a PostgreSQL reserved word
        break;
        
      case 'entity_reference':
        const targetEntity = await this.resolveTargetEntity(orgId, field.name);
        if (!targetEntity) {
          console.warn(`[ForeignKeyManager] Could not resolve target entity for field: ${field.name}`);
          return null;
        }
        targetTable = targetEntity.tableName;
        break;
        
      default:
        return null;
    }
    
    // Verify target table exists
    const targetExists = await this.verifyTableExists(targetTable);
    if (!targetExists) {
      console.warn(`[ForeignKeyManager] Target table does not exist: ${targetTable}`);
      return null;
    }

    const constraintName = this.generateConstraintName(sourceTable, field.name);
    
    return {
      constraintName,
      sourceTable,
      sourceColumn: field.name,
      targetTable,
      targetColumn,
      onDelete: 'SET NULL', // Safe default - don't cascade delete referenced entities
      onUpdate: 'CASCADE'   // Update references when target ID changes
    };
  }

  /**
   * Resolve target entity for entity_reference fields using naming conventions
   */
  private async resolveTargetEntity(orgId: string, fieldName: string): Promise<{tableName: string, entityName: string} | null> {
    // Use enhanced pattern matching for field names
    let targetEntityName: string | null = null;
    
    // Specific patterns for common relationships
    if (fieldName === 'parent_task_id' || fieldName === 'task_id') {
      // Try to find Task entity
      targetEntityName = await this.findEntityByArchetype(orgId, 'task');
    } else if (fieldName === 'parent_project_id' || fieldName === 'project_id') {
      // Try to find Project entity  
      targetEntityName = await this.findEntityByArchetype(orgId, 'project');
    } else if (fieldName === 'parent_document_id' || fieldName === 'document_id') {
      // Try to find Document entity
      targetEntityName = await this.findEntityByArchetype(orgId, 'document');
    } else if (fieldName.endsWith('_id')) {
      // Generic pattern: remove _id and try to find entity
      const baseName = fieldName.replace(/_id$/, '').replace(/^parent_/, '');
      targetEntityName = await this.findEntityByName(orgId, baseName);
    }
    
    if (!targetEntityName) return null;
    
    // Generate table name for the target entity
    const tableName = `org_${orgId.replace(/-/g, '_')}_${targetEntityName.toLowerCase()}`;
    
    return { tableName, entityName: targetEntityName };
  }

  /**
   * Find entity by archetype (first match)
   */
  private async findEntityByArchetype(orgId: string, archetype: string): Promise<string | null> {
    const entity = await this.config.kysely
      .selectFrom('entity_schemas')
      .select('entity_name')
      .where('org_id', '=', orgId)
      .where('archetype', '=', archetype)
      .where('deleted', '!=', true)
      .executeTakeFirst();
      
    return entity?.entity_name || null;
  }

  /**
   * Find entity by partial name matching
   */
  private async findEntityByName(orgId: string, partialName: string): Promise<string | null> {
    const entities = await this.config.kysely
      .selectFrom('entity_schemas')
      .select('entity_name')
      .where('org_id', '=', orgId)
      .where('deleted', '!=', true)
      .execute();
    
    // Try exact match first
    const exactMatch = entities.find(e => 
      e.entity_name.toLowerCase() === partialName.toLowerCase()
    );
    if (exactMatch) return exactMatch.entity_name;
    
    // Try partial match
    const partialMatch = entities.find(e => 
      e.entity_name.toLowerCase().includes(partialName.toLowerCase())
    );
    if (partialMatch) return partialMatch.entity_name;
    
    return null;
  }

  /**
   * Verify that a table exists in the database
   */
  private async verifyTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.config.kysely
        .selectFrom('information_schema.tables')
        .select('table_name')
        .where('table_name', '=', tableName.replace(/"/g, '')) // Remove quotes for system tables
        .executeTakeFirst();
        
      return !!result;
    } catch (error) {
      console.warn(`[ForeignKeyManager] Error checking table existence for ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Generate standardized constraint name
   */
  private generateConstraintName(sourceTable: string, columnName: string): string {
    // Remove org prefix for cleaner names
    const cleanTableName = sourceTable.replace(/^org_[^_]+_[^_]+_[^_]+_[^_]+_[^_]+_/, '');
    return `fk_${cleanTableName}_${columnName}`.toLowerCase();
  }

  /**
   * Generate foreign key constraint SQL
   */
  private generateForeignKeySQL(constraint: ForeignKeyConstraint): string {
    return `ALTER TABLE ${constraint.sourceTable} ` +
           `ADD CONSTRAINT ${constraint.constraintName} ` +
           `FOREIGN KEY (${constraint.sourceColumn}) ` +
           `REFERENCES ${constraint.targetTable}(${constraint.targetColumn}) ` +
           `ON DELETE ${constraint.onDelete} ON UPDATE ${constraint.onUpdate}`;
  }

  /**
   * Get existing foreign key constraints for a table
   */
  private async getExistingForeignKeys(tableName: string): Promise<ForeignKeyConstraint[]> {
    try {
      const constraints = await this.config.kysely
        .selectFrom('information_schema.table_constraints as tc')
        .innerJoin('information_schema.key_column_usage as kcu', 
          'tc.constraint_name', 'kcu.constraint_name')
        .innerJoin('information_schema.constraint_column_usage as ccu',
          'tc.constraint_name', 'ccu.constraint_name')
        .select([
          'tc.constraint_name',
          'tc.table_name as source_table',
          'kcu.column_name as source_column', 
          'ccu.table_name as target_table',
          'ccu.column_name as target_column'
        ])
        .where('tc.constraint_type', '=', 'FOREIGN KEY')
        .where('tc.table_name', '=', tableName)
        .execute();

      return constraints.map((c: any) => ({
        constraintName: c.constraint_name,
        sourceTable: c.source_table,
        sourceColumn: c.source_column,
        targetTable: c.target_table,
        targetColumn: c.target_column,
        onDelete: 'SET NULL', // Default assumption
        onUpdate: 'CASCADE'   // Default assumption
      }));
    } catch (error) {
      console.warn(`[ForeignKeyManager] Error getting existing constraints:`, error);
      return [];
    }
  }

  /**
   * Check if foreign key constraints exist for an entity
   */
  async hasForeignKeyConstraints(orgId: string, entityName: string): Promise<boolean> {
    const entityConfig = await this.getEntityConfiguration(orgId, entityName);
    if (!entityConfig) return false;
    
    const existingConstraints = await this.getExistingForeignKeys(entityConfig.tableName);
    return existingConstraints.length > 0;
  }
}