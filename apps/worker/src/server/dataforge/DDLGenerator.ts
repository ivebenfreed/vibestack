/**
 * DDL Generator Service
 * 
 * Handles direct SQL DDL generation for DataForge entities.
 * Provides clean separation between entity management and SQL generation.
 */

export interface FieldDefinition {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: any;
  unique?: boolean;
  indexed?: boolean;
}

export class DDLGenerator {
  /**
   * Generate CREATE TABLE DDL for an entity
   * Note: Relationship fields (user_reference, entity_reference) are NOT created as columns
   * They are stored in the org's relationship table instead
   */
  static generateCreateTableDDL(
    tableName: string, 
    fields: Record<string, FieldDefinition>,
    orgId?: string
  ): string {
    // Filter out relationship fields - they don't get columns
    const columnDefs = Object.entries(fields)
      .filter(([name, field]) => {
        // Skip relationship fields - they go to relationship table
        return field.type !== 'user_reference' && field.type !== 'entity_reference';
      })
      .map(([name, field]) => {
        const sqlType = this.getSqlType(field.type, orgId, name);
        const constraints = this.getColumnConstraints(field);
        return `${name} ${sqlType} ${constraints}`.trim();
      }).join(',\n    ');

    return `CREATE TABLE ${tableName} (\n    ${columnDefs}\n)`;
  }

  /**
   * Generate CREATE TABLE DDL with automatic foreign key constraints
   * Note: With the new relationship system, foreign keys are no longer needed
   * as relationships are stored in the org's relationship table
   */
  static generateCreateTableWithForeignKeysDDL(
    tableName: string,
    fields: Record<string, FieldDefinition>,
    orgId: string
  ): { tableSQL: string; foreignKeySQL: string[]; relationshipFields: Array<{name: string, type: string}> } {
    // Generate table creation SQL (relationship fields are automatically filtered out)
    const tableSQL = this.generateCreateTableDDL(tableName, fields, orgId);
    
    // No foreign keys needed with relationship system
    const foreignKeySQL: string[] = [];
    
    // Collect relationship fields for processing by RelationshipFieldHandler
    const relationshipFields: Array<{name: string, type: string}> = [];
    
    Object.entries(fields).forEach(([fieldName, field]) => {
      if (field.type === 'user_reference' || field.type === 'entity_reference') {
        relationshipFields.push({ name: fieldName, type: field.type });
      }
    });
    
    return { tableSQL, foreignKeySQL, relationshipFields };
  }

  /**
   * Generate ALTER TABLE to set replica identity for replication/updates
   * This is required for tables that need to support UPDATE operations with logical replication
   */
  static generateSetReplicaIdentityDDL(tableName: string): string {
    return `ALTER TABLE ${tableName} REPLICA IDENTITY FULL`;
  }

  /**
   * Generate ADD COLUMN DDL for field additions
   */
  static generateAddColumnDDL(
    tableName: string,
    fieldName: string,
    field: FieldDefinition
  ): string {
    const sqlType = this.getSqlType(field.type);
    const constraints = this.getColumnConstraints(field);
    return `ALTER TABLE ${tableName} ADD COLUMN ${fieldName} ${sqlType} ${constraints}`.trim();
  }

  /**
   * Generate DROP COLUMN DDL for field removal
   */
  static generateDropColumnDDL(tableName: string, fieldName: string): string {
    return `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${fieldName}`;
  }

  /**
   * Generate DROP TABLE DDL
   */
  static generateDropTableDDL(tableName: string): string {
    return `DROP TABLE IF EXISTS ${tableName}`;
  }

  /**
   * Generate foreign key constraint DDL for reference fields
   */
  static generateForeignKeyConstraintDDL(
    tableName: string,
    fieldName: string,
    fieldType: string,
    orgId?: string
  ): string | null {
    switch (fieldType) {
      case 'user_reference':
        return `ALTER TABLE ${tableName} ADD CONSTRAINT fk_${tableName}_${fieldName} FOREIGN KEY (${fieldName}) REFERENCES "user"(id) ON DELETE SET NULL`;
        
      case 'entity_reference':
        // For entity references, we need to determine the target entity from field naming
        const targetEntity = this.inferTargetEntityFromFieldName(fieldName);
        if (targetEntity && orgId) {
          const targetTable = DDLGenerator.generateTableName(orgId, targetEntity);
          return `ALTER TABLE ${tableName} ADD CONSTRAINT fk_${tableName}_${fieldName} FOREIGN KEY (${fieldName}) REFERENCES ${targetTable}(id) ON DELETE SET NULL`;
        }
        break;
    }
    return null;
  }

  /**
   * Infer target entity type from field naming conventions
   */
  private static inferTargetEntityFromFieldName(fieldName: string): string | null {
    // Handle common patterns:
    // project_id -> Project
    // parent_task_id -> Task (same entity type)
    // parent_document_id -> Document
    
    if (fieldName === 'parent_task_id') return 'Task';
    if (fieldName === 'parent_document_id') return 'Document';
    if (fieldName === 'parent_project_id') return 'Project';
    if (fieldName === 'project_id') return 'Project';
    if (fieldName === 'task_id') return 'Task';
    if (fieldName === 'document_id') return 'Document';
    
    // Generic pattern: remove _id and capitalize
    if (fieldName.endsWith('_id')) {
      const entityName = fieldName.replace(/_id$/, '');
      return entityName.charAt(0).toUpperCase() + entityName.slice(1);
    }
    
    return null;
  }


  /**
   * Convert field type to SQL type with proper foreign key handling
   */
  private static getSqlType(fieldType: string, orgId?: string, fieldName?: string): string {
    switch (fieldType) {
      case 'text': return 'TEXT';
      case 'longtext': return 'TEXT';
      case 'rich_text': return 'TEXT';
      case 'email': return 'TEXT';
      case 'url': return 'TEXT';
      case 'number': 
      case 'decimal': return 'NUMERIC';
      case 'integer': return 'INTEGER';
      case 'boolean': return 'BOOLEAN';
      case 'date': return 'DATE';
      case 'datetime': return 'TIMESTAMP WITHOUT TIME ZONE';
      case 'timestamp': return 'TIMESTAMP WITHOUT TIME ZONE';
      case 'json': return 'JSONB';
      
      // Option field types (stored as text with validation)
      case 'status_option': 
      case 'priority_option':
      case 'category_option':
      case 'discussion_type_option':
      case 'custom_option_reference': return 'TEXT';
      
      // Reference field types - these should be UUIDs with foreign keys
      case 'user_reference': 
        return 'UUID'; // FK constraint should be added separately
      case 'entity_reference':
        return 'UUID'; // FK constraint should be added separately
        
      default: return 'TEXT';
    }
  }

  /**
   * Generate column constraints
   */
  private static getColumnConstraints(field: FieldDefinition): string {
    const constraints: string[] = [];

    if (field.required) {
      constraints.push('NOT NULL');
    }

    if (field.unique) {
      constraints.push('UNIQUE');
    }

    if (field.defaultValue !== undefined) {
      let defaultVal;
      if (typeof field.defaultValue === 'string') {
        // Escape single quotes in string values
        const escapedValue = field.defaultValue.replace(/'/g, "''");
        defaultVal = `'${escapedValue}'`;
      } else if (Array.isArray(field.defaultValue)) {
        // Arrays need to be handled specially - convert to JSONB or array literal
        if (field.type === 'json' || field.type === 'jsonb') {
          defaultVal = `'${JSON.stringify(field.defaultValue)}'::jsonb`;
        } else {
          // For PostgreSQL array types, use ARRAY constructor
          // This shouldn't normally happen with our field types, but handle it safely
          defaultVal = `'{}'::text[]`;
        }
      } else if (typeof field.defaultValue === 'object' && field.defaultValue !== null) {
        // For objects (JSONB fields), properly format the default value
        defaultVal = `'${JSON.stringify(field.defaultValue)}'::jsonb`;
      } else if (field.defaultValue === null) {
        defaultVal = 'NULL';
      } else if (typeof field.defaultValue === 'boolean') {
        // Boolean values should be lowercase in SQL
        defaultVal = field.defaultValue ? 'true' : 'false';
      } else {
        // Numbers and other primitives
        defaultVal = field.defaultValue;
      }
      constraints.push(`DEFAULT ${defaultVal}`);
    }

    return constraints.join(' ');
  }

  /**
   * Generate organization-specific table name
   * Expects tableName to already be in snake_case format
   * Uses consistent snake_case without pluralization for predictability
   * Always returns lowercase to match PostgreSQL behavior
   */
  static generateTableName(orgId: string, tableName: string): string {
    // Table name should already be in snake_case format by the caller
    // Just combine with org prefix and ensure lowercase
    return `org_${orgId.replace(/-/g, '_')}_${tableName}`.toLowerCase();
  }

  /**
   * Validate field definition
   */
  static validateField(field: FieldDefinition): { valid: boolean; error?: string } {
    if (!field.name || typeof field.name !== 'string') {
      return { valid: false, error: 'Field name is required and must be a string' };
    }

    if (!field.type || typeof field.type !== 'string') {
      return { valid: false, error: 'Field type is required and must be a string' };
    }

    const validTypes = [
      'text', 'longtext', 'number', 'integer', 'boolean', 
      'date', 'datetime', 'timestamp', 'json', 'status_option'
    ];

    if (!validTypes.includes(field.type)) {
      return { valid: false, error: `Invalid field type: ${field.type}. Must be one of: ${validTypes.join(', ')}` };
    }

    return { valid: true };
  }

  /**
   * Validate table name
   */
  static validateTableName(tableName: string): { valid: boolean; error?: string } {
    if (!tableName || typeof tableName !== 'string') {
      return { valid: false, error: 'Table name is required and must be a string' };
    }

    // Check for SQL injection patterns
    if (/[;'"\\]/.test(tableName)) {
      return { valid: false, error: 'Table name contains invalid characters' };
    }

    // Check for reserved words
    const reservedWords = ['select', 'insert', 'update', 'delete', 'drop', 'create', 'table'];
    if (reservedWords.includes(tableName.toLowerCase())) {
      return { valid: false, error: `Table name cannot be a reserved SQL word: ${tableName}` };
    }

    return { valid: true };
  }
}