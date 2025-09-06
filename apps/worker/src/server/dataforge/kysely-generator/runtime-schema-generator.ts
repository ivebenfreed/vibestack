/**
 * Runtime Schema Generator for DataForge
 * 
 * Generates SQL DDL for entity tables with proper field separation.
 * Supports base archetype fields as columns and custom fields in JSONB.
 */

export interface TableDefinition {
  name: string;
  tableName: string;
  archetype: string;
  fields: any[];
  includeCustomFieldsColumn?: boolean;
}

export class RuntimeSchemaGenerator {
  /**
   * Generate CREATE TABLE SQL with enhanced field support
   */
  generateCreateTableSQL(definition: TableDefinition): string {
    const { tableName, fields, includeCustomFieldsColumn } = definition;
    
    // Separate base and custom fields
    const baseFields = fields.filter(f => f.source === 'archetype' || !f.source);
    const customFields = fields.filter(f => f.source === 'custom');
    
    let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    
    // Always include system fields
    sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
    sql += `  organization_id UUID NOT NULL,\n`;
    
    // Add base archetype fields as actual columns
    for (const field of baseFields) {
      if (field.name === 'id' || field.name === 'organization_id') {
        continue; // Skip system fields already added
      }
      
      const columnDef = this.generateColumnDefinition(field);
      sql += `  ${columnDef},\n`;
    }
    
    // Add custom_fields JSONB column if requested or if there are custom fields
    if (includeCustomFieldsColumn || customFields.length > 0) {
      sql += `  custom_fields JSONB DEFAULT '{}',\n`;
      sql += `  field_metadata JSONB DEFAULT '{}',\n`;
    }
    
    // Add timestamp fields
    sql += `  created_at TIMESTAMPTZ DEFAULT NOW(),\n`;
    sql += `  updated_at TIMESTAMPTZ DEFAULT NOW(),\n`;
    sql += `  created_by UUID,\n`;
    sql += `  deleted_at TIMESTAMPTZ\n`;
    sql += `);\n\n`;
    
    // Add indexes
    sql += this.generateIndexes(tableName, baseFields);
    
    // Add update trigger for updated_at
    sql += this.generateUpdateTrigger(tableName);
    
    // Add comments documenting custom fields
    if (customFields.length > 0) {
      sql += `\n-- Custom fields stored in custom_fields JSONB:\n`;
      for (const field of customFields) {
        sql += `-- ${field.name} (${field.type}): ${field.description || 'No description'}\n`;
      }
    }
    
    return sql;
  }
  
  /**
   * Generate column definition for a field
   */
  private generateColumnDefinition(field: any): string {
    let def = `${field.name} `;
    
    // Map field type to SQL type
    switch (field.type) {
      case 'text':
      case 'longtext':
      case 'rich_text':
      case 'status_option':
      case 'priority_option':
      case 'category_option':
      case 'discussion_type_option':
        def += 'TEXT';
        break;
      
      case 'number':
      case 'decimal':
        def += 'DECIMAL(15,4)';
        break;
      
      case 'integer':
        def += 'INTEGER';
        break;
      
      case 'boolean':
        def += 'BOOLEAN';
        break;
      
      case 'date':
        def += 'DATE';
        break;
      
      case 'datetime':
        def += 'TIMESTAMPTZ';
        break;
      
      case 'json':
        def += 'JSONB';
        break;
      
      case 'user_reference':
      case 'entity_reference':
        def += 'UUID';
        break;
      
      case 'email':
      case 'url':
        def += 'TEXT';
        break;
      
      default:
        def += 'TEXT';
    }
    
    // Add constraints
    if (field.required) {
      def += ' NOT NULL';
    }
    
    if (field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        def += ` DEFAULT '${field.defaultValue}'`;
      } else if (typeof field.defaultValue === 'boolean') {
        def += ` DEFAULT ${field.defaultValue}`;
      } else if (typeof field.defaultValue === 'number') {
        def += ` DEFAULT ${field.defaultValue}`;
      } else if (field.defaultValue === null) {
        def += ' DEFAULT NULL';
      }
    }
    
    return def;
  }
  
  /**
   * Generate indexes for the table
   */
  private generateIndexes(tableName: string, fields: any[]): string {
    let sql = '';
    
    // Organization ID index (for multi-tenancy)
    sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_org_id ON ${tableName}(organization_id);\n`;
    
    // Status index (commonly queried)
    if (fields.some(f => f.name === 'status')) {
      sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${tableName}(status);\n`;
    }
    
    // Created/Updated indexes for sorting
    sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at DESC);\n`;
    sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at ON ${tableName}(updated_at DESC);\n`;
    
    // Soft delete index
    sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_deleted_at ON ${tableName}(deleted_at) WHERE deleted_at IS NULL;\n`;
    
    // Reference field indexes
    for (const field of fields) {
      if (field.type === 'user_reference' || field.type === 'entity_reference') {
        sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_${field.name} ON ${tableName}(${field.name});\n`;
      }
    }
    
    // GIN index for custom_fields JSONB
    sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_custom_fields ON ${tableName} USING gin(custom_fields);\n`;
    
    return sql;
  }
  
  /**
   * Generate update trigger for updated_at
   */
  private generateUpdateTrigger(tableName: string): string {
    return `
-- Create or replace the update trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName};
CREATE TRIGGER update_${tableName}_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;
  }
  
  /**
   * Generate ALTER TABLE statements for adding fields
   */
  generateAddFieldSQL(tableName: string, field: any): string {
    if (field.source === 'custom') {
      // Custom fields don't need ALTER TABLE, they go in JSONB
      return `-- Custom field '${field.name}' will be stored in custom_fields JSONB column`;
    }
    
    // Base fields get actual columns
    const columnDef = this.generateColumnDefinition(field);
    return `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnDef};`;
  }
  
  /**
   * Generate ALTER TABLE statements for removing fields
   */
  generateRemoveFieldSQL(tableName: string, fieldName: string, isCustom: boolean): string {
    if (isCustom) {
      // Custom fields are removed from JSONB
      return `UPDATE ${tableName} SET custom_fields = custom_fields - '${fieldName}';`;
    }
    
    // Base fields (dangerous - usually shouldn't be allowed)
    return `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${fieldName};`;
  }
}