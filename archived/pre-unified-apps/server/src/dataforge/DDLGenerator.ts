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
   */
  static generateCreateTableDDL(
    tableName: string, 
    fields: Record<string, FieldDefinition>
  ): string {
    const columnDefs = Object.entries(fields).map(([name, field]) => {
      const sqlType = this.getSqlType(field.type);
      const constraints = this.getColumnConstraints(field);
      return `${name} ${sqlType} ${constraints}`.trim();
    }).join(',\n    ');

    return `CREATE TABLE ${tableName} (\n    ${columnDefs}\n)`;
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
   * Convert field type to SQL type
   */
  private static getSqlType(fieldType: string): string {
    switch (fieldType) {
      case 'text': return 'TEXT';
      case 'longtext': return 'TEXT';
      case 'number': return 'NUMERIC';
      case 'integer': return 'INTEGER';
      case 'boolean': return 'BOOLEAN';
      case 'date': return 'DATE';
      case 'datetime': return 'TIMESTAMP';
      case 'timestamp': return 'TIMESTAMP';
      case 'json': return 'JSONB';
      case 'status_option': return 'TEXT';
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
      const defaultVal = typeof field.defaultValue === 'string' 
        ? `'${field.defaultValue}'` 
        : field.defaultValue;
      constraints.push(`DEFAULT ${defaultVal}`);
    }

    return constraints.join(' ');
  }

  /**
   * Generate organization-specific table name
   */
  static generateTableName(orgId: string, entityName: string): string {
    return `org_${orgId.replace(/-/g, '_')}_${entityName.toLowerCase()}s`;
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