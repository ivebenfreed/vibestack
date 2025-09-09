/**
 * FieldManager - Handles field operations
 * 
 * Manages adding, removing, soft deleting, and restoring fields in entities.
 * Implements soft delete pattern for fields similar to entity soft delete.
 */

import type { FieldDefinition } from '../json-rules-engine';
import type { OrgEntityDefinition } from '../org-entity-schema';
import { DDLGenerator } from '../DDLGenerator';

export interface DataForgeEntityManagerConfig {
  kysely: any; // Kysely instance
  rulesEngine?: any; // JsonRulesEngine instance  
  env?: any; // Cloudflare environment
}

export class FieldManager {
  private config: DataForgeEntityManagerConfig;
  private configCache: Map<string, OrgEntityDefinition>;

  constructor(config: DataForgeEntityManagerConfig, configCache: Map<string, OrgEntityDefinition>) {
    this.config = config;
    this.configCache = configCache;
  }

  /**
   * Add fields to an existing entity
   */
  async addFields(orgId: string, entityName: string, fields: any[]): Promise<any> {
    try {
      console.log(`[FieldManager] Adding fields to entity: ${entityName}`);

      // Import required modules
      const { fieldManager } = await import('../services/FieldManager');
      const { getEntityDefinition, storeEntityDefinition } = await import('./entity-storage');

      // Get entity details and current definition
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['table_name as tableName', 'archetype', 'business_metadata'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity) {
        return { success: false, error: 'Entity not found' };
      }

      // Get current entity definition
      const currentDefinition = await getEntityDefinition(this.config.kysely, orgId, entityName);
      if (!currentDefinition) {
        return { success: false, error: 'Entity definition not found' };
      }

      // Validate new fields
      const validation = await fieldManager.validateCustomFields(fields, entity.archetype);
      if (!validation.success) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Add columns to the table using DDLGenerator
      const addedFields: string[] = [];
      const errors: string[] = [];
      const addedFieldDefs: any[] = [];
      
      for (const field of fields) {
        try {
          // Validate field definition
          const fieldValidation = DDLGenerator.validateField(field);
          if (!fieldValidation.valid) {
            errors.push(`Invalid field '${field.name}': ${fieldValidation.error}`);
            continue;
          }

          // Generate ADD COLUMN DDL
          const alterSql = DDLGenerator.generateAddColumnDDL(entity.tableName, field.name, field);
          
          await this.config.kysely.executeQuery({
            sql: alterSql,
            parameters: []
          });
          
          addedFields.push(field.name);
          addedFieldDefs.push({
            ...field,
            source: 'custom'
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes('already exists')) {
            errors.push(`Field '${field.name}' already exists`);
          } else {
            errors.push(`Failed to add field '${field.name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Update entity definition if any fields were successfully added
      if (addedFields.length > 0) {
        try {
          // Update the entity definition with new fields
          const updatedDefinition = {
            ...currentDefinition,
            customFields: [...(currentDefinition.customFields || []), ...addedFieldDefs],
            allFields: [...(currentDefinition.allFields || []), ...addedFieldDefs],
            version: currentDefinition.version || '2.0'
          };

          // Store updated definition in entity_schemas
          await this.config.kysely
            .updateTable('entity_schemas')
            .set({
              business_metadata: updatedDefinition,
              updated_at: new Date().toISOString()
            })
            .where('org_id', '=', orgId)
            .where('entity_name', '=', entityName)
            .execute();

          console.log(`[FieldManager] Updated entity definition for ${entityName}`);

          // Update schema_metadata to trigger WAL events for cache invalidation
          await this.config.kysely
            .insertInto('schema_metadata')
            .values({
              key: `entity_${orgId}_${entityName}_fields_modified`,
              value: JSON.stringify({
                action: 'add_fields',
                entityName,
                addedFields,
                timestamp: new Date().toISOString()
              }),
              updated_at: new Date()
            })
            .onConflict((oc) => 
              oc.column('key').doUpdateSet({
                value: (eb) => eb.ref('excluded.value'),
                updated_at: (eb) => eb.ref('excluded.updated_at')
              })
            )
            .execute();

          console.log(`[FieldManager] Updated schema tracking for ${entityName} field additions`);
        } catch (error) {
          console.error(`[FieldManager] Failed to update entity definition:`, error);
          // Don't fail the operation if metadata update fails, but log the error
        }
      }

      if (errors.length > 0 && addedFields.length === 0) {
        // Complete failure
        return {
          success: false,
          error: 'Failed to add any fields',
          errors: errors
        };
      } else if (errors.length > 0) {
        // Partial success
        return {
          success: true,
          message: `Added ${addedFields.length} field(s) to ${entityName}`,
          addedFields: addedFields,
          warnings: errors
        };
      } else {
        // Complete success
        return {
          success: true,
          message: `Added ${addedFields.length} field(s) to ${entityName}`,
          addedFields: addedFields
        };
      }
    } catch (error) {
      console.error(`[FieldManager] Error adding fields:`, error);
      return {
        success: false,
        error: 'Failed to add fields',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove a field from an existing entity (now calls softDeleteField instead of hard delete)
   */
  async removeField(orgId: string, entityName: string, fieldName: string): Promise<any> {
    console.log(`[FieldManager] removeField called - redirecting to softDeleteField for safety`);
    return this.softDeleteField(orgId, entityName, fieldName);
  }

  /**
   * Soft delete a field (moves to trash, preserves column and data)
   */
  async softDeleteField(orgId: string, entityName: string, fieldName: string, userId?: string): Promise<any> {
    try {
      console.log(`[FieldManager] Soft deleting field ${fieldName} from entity: ${entityName} (data preserved for recovery)`);

      // Import required modules
      const { getEntityDefinition } = await import('./entity-storage');

      // Get entity details and current definition
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['table_name as tableName', 'archetype', 'business_metadata'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity) {
        return { success: false, error: 'Entity not found' };
      }

      // Get current entity definition
      const currentDefinition = await getEntityDefinition(this.config.kysely, orgId, entityName);
      if (!currentDefinition) {
        return { success: false, error: 'Entity definition not found' };
      }

      // Check if field exists in definition
      const allFields = currentDefinition.allFields || [];
      const fieldExists = allFields.some((f: any) => f.name === fieldName);
      if (!fieldExists) {
        return { success: false, error: `Field '${fieldName}' not found in entity definition` };
      }

      // Check if field is a base/archetype field (shouldn't be removed)
      const baseFields = currentDefinition.baseFields || [];
      const isBaseField = baseFields.some((f: any) => f.name === fieldName);
      if (isBaseField) {
        return { success: false, error: `Cannot remove base field '${fieldName}' from archetype` };
      }

      // Check if field is already soft deleted
      const existingFieldsTrash = await this.config.kysely
        .selectFrom('fields_trash')
        .select(['field_name'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('field_name', '=', fieldName)
        .executeTakeFirst();

      if (existingFieldsTrash) {
        return { success: false, error: `Field '${fieldName}' is already in trash` };
      }

      // Get the field definition to store in trash
      const fieldDef = allFields.find((f: any) => f.name === fieldName);

      // SOFT DELETE ONLY - column and data are preserved for recovery
      // Add entry to fields_trash table
      await this.config.kysely
        .insertInto('fields_trash')
        .values({
          id: crypto.randomUUID(),
          org_id: orgId,
          entity_name: entityName,
          field_name: fieldName,
          field_definition: fieldDef,
          table_name: entity.tableName,
          deleted_by: userId || 'system',
          deleted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .execute();

      // Update entity definition to mark field as deleted (but preserve in trash)
      try {
        const updatedDefinition = {
          ...currentDefinition,
          customFields: (currentDefinition.customFields || []).map((f: any) => 
            f.name === fieldName ? { ...f, deleted: true, deleted_at: new Date().toISOString() } : f
          ),
          allFields: (currentDefinition.allFields || []).map((f: any) => 
            f.name === fieldName ? { ...f, deleted: true, deleted_at: new Date().toISOString() } : f
          ),
          version: currentDefinition.version || '2.0'
        };

        // Store updated definition in entity_schemas
        await this.config.kysely
          .updateTable('entity_schemas')
          .set({
            business_metadata: updatedDefinition,
            updated_at: new Date().toISOString()
          })
          .where('org_id', '=', orgId)
          .where('entity_name', '=', entityName)
          .execute();

        console.log(`[FieldManager] Updated entity definition after soft deleting field ${fieldName}`);

        // Update schema_metadata to trigger WAL events for cache invalidation
        await this.config.kysely
          .insertInto('schema_metadata')
          .values({
            key: `entity_${orgId}_${entityName}_fields_modified`,
            value: JSON.stringify({
              action: 'soft_delete_field',
              entityName,
              deletedField: fieldName,
              timestamp: new Date().toISOString()
            }),
            updated_at: new Date()
          })
          .onConflict((oc) => 
            oc.column('key').doUpdateSet({
              value: (eb) => eb.ref('excluded.value'),
              updated_at: (eb) => eb.ref('excluded.updated_at')
            })
          )
          .execute();

        console.log(`[FieldManager] Updated schema tracking for ${entityName} field soft deletion`);
      } catch (error) {
        console.error(`[FieldManager] Failed to update entity definition:`, error);
        // Don't fail the operation if metadata update fails, but log the error
      }

      return {
        success: true,
        message: `Field ${fieldName} has been moved to trash (data preserved for recovery)`,
        softDeleted: true,
        fieldName,
        entityName,
        recoverable: true
      };
    } catch (error) {
      console.error(`[FieldManager] Error soft deleting field:`, error);
      return {
        success: false,
        error: 'Failed to soft delete field',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Restore field from trash (undelete)
   */
  async restoreField(orgId: string, entityName: string, fieldName: string): Promise<any> {
    try {
      console.log(`[FieldManager] Restoring field ${fieldName} from trash for entity: ${entityName}`);

      // Check if field exists in trash
      const trashedField = await this.config.kysely
        .selectFrom('fields_trash')
        .select(['id', 'field_definition', 'table_name', 'deleted_at'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('field_name', '=', fieldName)
        .executeTakeFirst();

      if (!trashedField) {
        return { success: false, error: `Field '${fieldName}' not found in trash` };
      }

      // Get current entity definition
      const { getEntityDefinition } = await import('./entity-storage');
      const currentDefinition = await getEntityDefinition(this.config.kysely, orgId, entityName);
      if (!currentDefinition) {
        return { success: false, error: 'Entity definition not found' };
      }

      // Remove from fields_trash table
      await this.config.kysely
        .deleteFrom('fields_trash')
        .where('id', '=', trashedField.id)
        .execute();

      // Update entity definition to restore field
      try {
        const updatedDefinition = {
          ...currentDefinition,
          customFields: (currentDefinition.customFields || []).map((f: any) => 
            f.name === fieldName ? { ...f, deleted: false, deleted_at: null } : f
          ),
          allFields: (currentDefinition.allFields || []).map((f: any) => 
            f.name === fieldName ? { ...f, deleted: false, deleted_at: null } : f
          ),
          version: currentDefinition.version || '2.0'
        };

        // If field wasn't in entity definition, add it back
        const fieldInDefinition = currentDefinition.allFields?.some((f: any) => f.name === fieldName);
        if (!fieldInDefinition && trashedField.field_definition) {
          const restoredFieldDef = { ...trashedField.field_definition, deleted: false, deleted_at: null };
          updatedDefinition.customFields = [...(updatedDefinition.customFields || []), restoredFieldDef];
          updatedDefinition.allFields = [...(updatedDefinition.allFields || []), restoredFieldDef];
        }

        // Store updated definition in entity_schemas
        await this.config.kysely
          .updateTable('entity_schemas')
          .set({
            business_metadata: updatedDefinition,
            updated_at: new Date().toISOString()
          })
          .where('org_id', '=', orgId)
          .where('entity_name', '=', entityName)
          .execute();

        console.log(`[FieldManager] Updated entity definition after restoring field ${fieldName}`);

        // Update schema_metadata to trigger WAL events for cache invalidation
        await this.config.kysely
          .insertInto('schema_metadata')
          .values({
            key: `entity_${orgId}_${entityName}_fields_modified`,
            value: JSON.stringify({
              action: 'restore_field',
              entityName,
              restoredField: fieldName,
              timestamp: new Date().toISOString()
            }),
            updated_at: new Date()
          })
          .onConflict((oc) => 
            oc.column('key').doUpdateSet({
              value: (eb) => eb.ref('excluded.value'),
              updated_at: (eb) => eb.ref('excluded.updated_at')
            })
          )
          .execute();

        console.log(`[FieldManager] Updated schema tracking for ${entityName} field restoration`);
      } catch (error) {
        console.error(`[FieldManager] Failed to update entity definition:`, error);
        // Don't fail the operation if metadata update fails, but log the error
      }

      return {
        success: true,
        message: `Field ${fieldName} has been restored from trash`,
        restored: true,
        fieldName,
        entityName,
        deletedAt: trashedField.deleted_at
      };
    } catch (error) {
      console.error(`[FieldManager] Error restoring field:`, error);
      return {
        success: false,
        error: 'Failed to restore field',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Permanently delete field and drop its column (empty field trash)
   */
  async permanentDeleteField(orgId: string, entityName: string, fieldName: string): Promise<any> {
    try {
      console.log(`[FieldManager] Permanently deleting field ${fieldName} from entity: ${entityName} and dropping column`);

      // Check if field exists in trash
      const trashedField = await this.config.kysely
        .selectFrom('fields_trash')
        .select(['id', 'field_definition', 'table_name', 'deleted_at'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('field_name', '=', fieldName)
        .executeTakeFirst();

      if (!trashedField) {
        return { success: false, error: `Field '${fieldName}' not found in trash` };
      }

      // PERMANENT DELETE - DROP COLUMN AND REMOVE FROM TRASH
      const dropColumnDDL = DDLGenerator.generateDropColumnDDL(trashedField.table_name, fieldName);
      
      await this.config.kysely.executeQuery({
        sql: dropColumnDDL,
        parameters: []
      });
      console.log(`Permanently dropped column: ${fieldName} from ${trashedField.table_name}`);

      // Remove from fields_trash table completely
      await this.config.kysely
        .deleteFrom('fields_trash')
        .where('id', '=', trashedField.id)
        .execute();
      console.log(`Permanently removed field from fields_trash: ${fieldName}`);

      // Update entity definition to completely remove the field
      try {
        const { getEntityDefinition } = await import('./entity-storage');
        const currentDefinition = await getEntityDefinition(this.config.kysely, orgId, entityName);
        
        if (currentDefinition) {
          const updatedDefinition = {
            ...currentDefinition,
            customFields: (currentDefinition.customFields || []).filter((f: any) => f.name !== fieldName),
            allFields: (currentDefinition.allFields || []).filter((f: any) => f.name !== fieldName),
            version: currentDefinition.version || '2.0'
          };

          // Store updated definition in entity_schemas
          await this.config.kysely
            .updateTable('entity_schemas')
            .set({
              business_metadata: updatedDefinition,
              updated_at: new Date().toISOString()
            })
            .where('org_id', '=', orgId)
            .where('entity_name', '=', entityName)
            .execute();

          console.log(`[FieldManager] Updated entity definition after permanent field deletion ${fieldName}`);

          // Update schema_metadata to trigger WAL events for cache invalidation
          await this.config.kysely
            .insertInto('schema_metadata')
            .values({
              key: `entity_${orgId}_${entityName}_fields_modified`,
              value: JSON.stringify({
                action: 'permanent_delete_field',
                entityName,
                permanentlyDeletedField: fieldName,
                timestamp: new Date().toISOString()
              }),
              updated_at: new Date()
            })
            .onConflict((oc) => 
              oc.column('key').doUpdateSet({
                value: (eb) => eb.ref('excluded.value'),
                updated_at: (eb) => eb.ref('excluded.updated_at')
              })
            )
            .execute();

          console.log(`[FieldManager] Updated schema tracking for ${entityName} permanent field deletion`);
        }
      } catch (error) {
        console.error(`[FieldManager] Failed to update entity definition:`, error);
        // Don't fail the operation if metadata update fails, but log the error
      }

      return {
        success: true,
        message: `Field ${fieldName} and all its data have been permanently deleted`,
        permanentlyDeleted: true,
        fieldName,
        entityName,
        warning: 'This action cannot be undone'
      };
    } catch (error) {
      console.error(`[FieldManager] Error permanently deleting field:`, error);
      return {
        success: false,
        error: 'Failed to permanently delete field',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List deleted fields (field trash) for an entity
   */
  async listFieldTrash(orgId: string, entityName: string): Promise<any> {
    try {
      console.log(`[FieldManager] Listing field trash for entity: ${entityName} in org: ${orgId}`);
      
      const trashedFields = await this.config.kysely
        .selectFrom('fields_trash')
        .select([
          'field_name',
          'field_definition',
          'table_name',
          'deleted_by',
          'deleted_at'
        ])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .orderBy('deleted_at', 'desc')
        .execute();

      const formattedFields = trashedFields.map((field: any) => ({
        fieldName: field.field_name,
        fieldDefinition: field.field_definition,
        tableName: field.table_name,
        deletedBy: field.deleted_by,
        deletedAt: field.deleted_at,
        recoverable: true
      }));

      return {
        success: true,
        data: {
          fields: formattedFields,
          total: formattedFields.length,
          entityName
        }
      };
    } catch (error) {
      console.error(`[FieldManager] Error listing field trash:`, error);
      return {
        success: false,
        error: 'Failed to list deleted fields',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}