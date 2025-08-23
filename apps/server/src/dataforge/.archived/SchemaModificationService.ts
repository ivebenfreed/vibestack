/**
 * Schema Modification Service
 * 
 * Handles dynamic entity field management - adding, modifying, and removing fields.
 */

import type { Kysely } from 'kysely';
import type { OrgEntityDefinition } from '../json-schema/org-entity-schema';

export interface SchemaModificationConfig {
  kysely: Kysely<any>;
  getEntityDefinition: (orgId: string, entityName: string) => Promise<OrgEntityDefinition | null>;
  updateEntityDefinition: (orgId: string, entityName: string, definition: OrgEntityDefinition) => Promise<void>;
}

export interface FieldDefinition {
  name: string;
  type: 'text' | 'number' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'enum';
  required?: boolean;
  defaultValue?: any;
  enumValues?: string[];
  validation?: Record<string, any>;
}

export interface AddFieldsResult {
  success: boolean;
  addedFields: Array<{ name: string; type: string; defaultValue?: any }>;
  errors: Array<{ field: string; error: string }>;
}

export interface ModifyFieldResult {
  success: boolean;
  field?: string;
  changes?: Record<string, any>;
  errors?: string[];
}

export interface RemoveFieldResult {
  success: boolean;
  field?: string;
  errors?: string[];
}

export class SchemaModificationService {
  constructor(private config: SchemaModificationConfig) {}

  /**
   * Add multiple fields to an existing entity
   */
  async addFields(
    orgId: string,
    entityName: string,
    fields: FieldDefinition[]
  ): Promise<AddFieldsResult> {
    const addedFields: Array<{ name: string; type: string; defaultValue?: any }> = [];
    const errors: Array<{ field: string; error: string }> = [];

    try {
      const entityDef = await this.config.getEntityDefinition(orgId, entityName);
      if (!entityDef) {
        return {
          success: false,
          addedFields: [],
          errors: [{ field: 'entity', error: `Entity ${entityName} not found` }]
        };
      }

      // Process each field
      for (const field of fields) {
        try {
          // Validate field definition
          const validation = this.validateFieldDefinition(field);
          if (!validation.valid) {
            errors.push({ field: field.name, error: validation.error! });
            continue;
          }

          // Add field to database table
          await this.addFieldToTable(entityDef.tableName!, field);
          
          // Update entity definition
          if (!entityDef.customFields) {
            entityDef.customFields = [];
          }
          entityDef.customFields.push(field);

          addedFields.push({
            name: field.name,
            type: field.type,
            defaultValue: field.defaultValue
          });
        } catch (fieldError) {
          errors.push({
            field: field.name,
            error: fieldError instanceof Error ? fieldError.message : 'Unknown error'
          });
        }
      }

      // Update entity definition
      if (addedFields.length > 0) {
        await this.config.updateEntityDefinition(orgId, entityName, entityDef);
      }

      return {
        success: errors.length === 0,
        addedFields,
        errors
      };
    } catch (error) {
      return {
        success: false,
        addedFields: [],
        errors: [{ 
          field: 'general', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }]
      };
    }
  }

  /**
   * Remove a field from an entity
   */
  async removeField(
    orgId: string,
    entityName: string,
    fieldName: string,
    options: { dropColumn?: boolean } = {}
  ): Promise<RemoveFieldResult> {
    try {
      const entityDef = await this.config.getEntityDefinition(orgId, entityName);
      if (!entityDef) {
        return { success: false, errors: [`Entity ${entityName} not found`] };
      }

      // Find and remove the field from custom fields
      const customFields = entityDef.customFields || [];
      const fieldIndex = customFields.findIndex(f => f.name === fieldName);
      
      if (fieldIndex === -1) {
        return { success: false, errors: [`Field ${fieldName} not found in entity ${entityName}`] };
      }

      // Remove from database if requested
      if (options.dropColumn) {
        await this.removeFieldFromTable(entityDef.tableName!, fieldName);
      }

      // Remove from entity definition
      customFields.splice(fieldIndex, 1);
      await this.config.updateEntityDefinition(orgId, entityName, entityDef);

      return {
        success: true,
        field: fieldName
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to remove field: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate a field definition
   */
  private validateFieldDefinition(field: FieldDefinition): { valid: boolean; error?: string } {
    if (!field.name || !field.type) {
      return { valid: false, error: 'Field must have name and type' };
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.name)) {
      return { valid: false, error: 'Field name must start with letter and contain only letters, numbers, underscores' };
    }

    const validTypes = ['text', 'number', 'decimal', 'boolean', 'date', 'datetime', 'enum'];
    if (!validTypes.includes(field.type)) {
      return { valid: false, error: `Invalid field type: ${field.type}. Must be one of: ${validTypes.join(', ')}` };
    }

    if (field.type === 'enum' && (!field.enumValues || field.enumValues.length === 0)) {
      return { valid: false, error: 'Enum fields must have enumValues array' };
    }

    return { valid: true };
  }

  /**
   * Add a field to the database table
   */
  private async addFieldToTable(tableName: string, field: FieldDefinition): Promise<void> {
    const pgType = this.mapFieldTypeToPostgreSQL(field);
    const nullable = !field.required ? 'NULL' : 'NOT NULL';
    const defaultClause = field.defaultValue !== undefined ? `DEFAULT '${field.defaultValue}'` : '';

    const alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${field.name} ${pgType} ${nullable} ${defaultClause}`.trim();
    
    await this.config.kysely.executeQuery({
      sql: alterSQL,
      parameters: []
    });
  }

  /**
   * Remove a field from the database table
   */
  private async removeFieldFromTable(tableName: string, fieldName: string): Promise<void> {
    const dropSQL = `ALTER TABLE ${tableName} DROP COLUMN ${fieldName}`;
    
    await this.config.kysely.executeQuery({
      sql: dropSQL,
      parameters: []
    });
  }

  /**
   * Map DataForge field types to PostgreSQL types
   */
  private mapFieldTypeToPostgreSQL(field: FieldDefinition): string {
    switch (field.type) {
      case 'text':
        return 'TEXT';
      case 'number':
        return 'INTEGER';
      case 'decimal':
        return 'DECIMAL(12,2)';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'DATE';
      case 'datetime':
        return 'TIMESTAMP';
      case 'enum':
        if (field.enumValues && field.enumValues.length > 0) {
          const values = field.enumValues.map(v => `'${v}'`).join(', ');
          return `TEXT CHECK (${field.name} IN (${values}))`;
        }
        return 'TEXT';
      default:
        return 'TEXT';
    }
  }
}