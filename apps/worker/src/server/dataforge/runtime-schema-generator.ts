/**
 * Runtime Kysely Schema Generator
 * 
 * Generates TypeScript interfaces and Kysely schemas from JSON entity definitions.
 * Replaces build-time code generation with runtime schema compilation.
 */

import type { HardcodedDatabase } from '../base/hardcoded-database';
import type { OrgSchema, OrgEntityDefinition } from '../json-schema/org-entity-schema';
import type { FieldDefinition } from '../rules/json-rules-engine';

export interface GeneratedOrgDatabase extends HardcodedDatabase {
  [tableName: string]: any; // Dynamic org tables
}

export class RuntimeSchemaGenerator {
  /**
   * Generate Kysely table interface from entity definition
   */
  generateTableInterface(orgId: string, entityName: string, definition: OrgEntityDefinition): string {
    const baseFields = this.getBaseArchetypeFields(definition.extends);
    const customFields = this.generateCustomFields(definition.customFields);
    
    return `
export interface ${this.toPascal(definition.tableName)}Table {
  ${baseFields}
  ${customFields}
}

export type ${this.toPascal(entityName)} = Selectable<${this.toPascal(definition.tableName)}Table>;
export type New${this.toPascal(entityName)} = Insertable<${this.toPascal(definition.tableName)}Table>;
export type ${this.toPascal(entityName)}Update = Updateable<${this.toPascal(definition.tableName)}Table>;
`;
  }

  /**
   * Generate org database interface from org schema
   */
  generateOrgDatabaseInterface(schema: OrgSchema): string {
    const entityInterfaces = Object.entries(schema.entities)
      .map(([entityName, definition]) => {
        return `${definition.tableName}: ${this.toPascal(definition.tableName)}Table;`;
      })
      .join('\n  ');

    return `
export interface ${this.toPascal(schema.orgId)}Database extends HardcodedDatabase {
  // Dynamic org-specific entities
  ${entityInterfaces}
}

// Sync database schema (only syncable fields)
export interface ${this.toPascal(schema.orgId)}SyncDatabase {
  ${this.generateSyncInterfaces(schema)}
}
`;
  }

  /**
   * Generate sync-only interfaces (filtered fields)
   */
  private generateSyncInterfaces(schema: OrgSchema): string {
    return Object.entries(schema.entities)
      .map(([entityName, definition]) => {
        const syncableFields = this.getSyncableFields(definition);
        return `${definition.tableName}: {
    id: string;
    organization_id: string;
    ${this.getBaseArchetypeFields(definition.extends)}
    ${syncableFields}
    created_at: Date;
    updated_at: Date;
  };`;
      })
      .join('\n  ');
  }

  /**
   * Get base archetype fields based on extends
   */
  private getBaseArchetypeFields(extendsValue: string): string {
    const baseFields = `
  id: Generated<string>;
  organization_id: string | null;
  name: string;
  status: Generated<string>;
  created_by: string | null;
  client_id: string | null;
  custom_fields: Generated<any>;
  created_at: Generated<Date>;
  updated_at: Date;`;

    switch (extendsValue) {
      case 'base_universe':
        return baseFields + `
  description: string | null;
  owner_id: string;`;

      case 'base_world':
        return baseFields + `
  description: string | null;
  universe_id: string | null;
  state: Generated<string>;
  world_type: Generated<string>;
  priority: Generated<string>;`;

      case 'base_projects':
        return baseFields + `
  description: string | null;
  priority: Generated<string>;
  start_date: Date | null;
  end_date: Date | null;
  owner_id: string | null;`;

      case 'base_tasks':
        return baseFields + `
  project_id: string;
  description: string | null;
  priority: Generated<string>;
  start_date: Date | null;
  due_date: Date | null;
  completed_date: Date | null;
  assignee_id: string | null;`;

      case 'base_events':
        return baseFields + `
  description: string | null;
  event_date: Date;
  location: string | null;`;

      case 'base_contacts':
        return baseFields + `
  email: string | null;
  phone: string | null;
  company: string | null;`;

      default:
        return baseFields;
    }
  }

  /**
   * Generate custom field TypeScript types
   */
  private generateCustomFields(customFields: Record<string, FieldDefinition>): string {
    return Object.entries(customFields)
      .map(([fieldName, fieldDef]) => {
        const tsType = this.fieldTypeToTSType(fieldDef.type);
        const nullable = fieldDef.required ? '' : ' | null';
        const snakeFieldName = this.camelToSnake(fieldName);
        return `${snakeFieldName}: ${tsType}${nullable};`;
      })
      .join('\n  ');
  }

  /**
   * Get only syncable fields for sync interface
   */
  private getSyncableFields(definition: OrgEntityDefinition): string {
    return Object.entries(definition.customFields)
      .filter(([_, fieldDef]) => fieldDef.syncable !== false && !fieldDef.serverOnly)
      .map(([fieldName, fieldDef]) => {
        const tsType = this.fieldTypeToTSType(fieldDef.type);
        const nullable = fieldDef.required ? '' : ' | null';
        const snakeFieldName = this.camelToSnake(fieldName);
        return `${snakeFieldName}: ${tsType}${nullable};`;
      })
      .join('\n    ');
  }

  /**
   * Convert JSON field type to TypeScript type
   */
  private fieldTypeToTSType(type: string): string {
    switch (type) {
      case 'string':
      case 'text':
      case 'email':
      case 'url':
      case 'enum':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
        return 'Date';
      case 'json':
        return 'any';
      default:
        return 'string';
    }
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert string to PascalCase
   */
  private toPascal(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Generate SQL DDL for creating org table
   */
  generateCreateTableSQL(definition: any): string {
    // Generate columns from fields array directly
    const columns = this.generateColumnsFromFields(definition.fields);
    
    // Always add system columns
    const systemColumns = `
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()`;
    
    return `
CREATE TABLE ${definition.tableName} (${systemColumns},
  ${columns}
);

-- Set replica identity for WAL replication support
ALTER TABLE ${definition.tableName} REPLICA IDENTITY FULL;

-- Indexes for performance
CREATE INDEX idx_${definition.tableName}_org_status ON ${definition.tableName}(organization_id);
CREATE INDEX idx_${definition.tableName}_created_at ON ${definition.tableName}(created_at);
`;
  }
  
  /**
   * Generate SQL columns from field definitions
   */
  private generateColumnsFromFields(fields: any[]): string {
    return fields.map(field => {
      const sqlType = this.mapFieldTypeToSQL(field.type);
      const nullable = field.required ? ' NOT NULL' : '';
      const defaultValue = field.defaultValue ? ` DEFAULT '${field.defaultValue}'` : '';
      const columnName = this.camelToSnake(field.name);
      return `${columnName} ${sqlType}${nullable}${defaultValue}`;
    }).join(',\n  ');
  }
  
  /**
   * Map field types to SQL types
   */
  private mapFieldTypeToSQL(fieldType: string): string {
    const typeMap: Record<string, string> = {
      'text': 'VARCHAR(255)',
      'longtext': 'TEXT',
      'rich_text': 'TEXT',
      'number': 'NUMERIC',
      'decimal': 'DECIMAL(10,2)',
      'integer': 'INTEGER',
      'boolean': 'BOOLEAN',
      'date': 'DATE',
      'datetime': 'TIMESTAMPTZ',
      'email': 'VARCHAR(255)',
      'url': 'TEXT',
      'json': 'JSONB',
      'status_option': 'VARCHAR(50)',
      'priority_option': 'VARCHAR(50)',
      'category_option': 'VARCHAR(100)',
      'discussion_type_option': 'VARCHAR(100)',
      'user_reference': 'UUID',
      'entity_reference': 'UUID'
    };
    
    return typeMap[fieldType] || 'TEXT';
  }

  /**
   * Get base archetype SQL columns
   */
  private getBaseArchetypeColumns(extendsValue: string): string {
    const baseColumns = `
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_by UUID,
  client_id UUID,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()`;

    switch (extendsValue) {
      case 'base_universe':
        // Universe archetype: personal life operating system container
        return baseColumns + `,
  description TEXT,
  owner_id UUID NOT NULL`;

      case 'base_world':
        // World archetype: life areas or business domains
        return baseColumns + `,
  description TEXT,
  universe_id UUID,
  state VARCHAR(50) DEFAULT 'exploring',
  world_type VARCHAR(100) DEFAULT 'personal',
  priority VARCHAR(50) DEFAULT 'medium'`;

      case 'base_projects':
        return baseColumns + `,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'medium',
  start_date DATE,
  end_date DATE,
  owner_id UUID`;

      case 'base_tasks':
        return baseColumns + `,
  project_id UUID,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'medium',
  start_date DATE,
  due_date DATE,
  completed_date TIMESTAMPTZ,
  assignee_id UUID`;

      case 'base_events':
        return baseColumns + `,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT`;

      case 'base_contacts':
        return baseColumns + `,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255)`;
      
      case 'base_records':
        // Record archetype: structured data entities
        return baseColumns + `,
  description TEXT,
  record_type VARCHAR(255) NOT NULL,
  data JSONB,
  parent_record_id UUID,
  owner_id UUID`;
      
      case 'base_documents':
        // Document archetype: text documents and notes
        return baseColumns + `,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  category VARCHAR(100),
  author_id UUID,
  parent_document_id UUID`;
      
      case 'base_files':
        // File archetype: file storage and assets
        return baseColumns + `,
  file_path TEXT NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_by UUID`;
      
      case 'base_activities':
        // Activity archetype: events and logs
        return baseColumns + `,
  activity_type VARCHAR(100) NOT NULL,
  description TEXT,
  entity_type VARCHAR(100),
  entity_id VARCHAR(255),
  actor_id UUID,
  metadata JSONB`;
      
      case 'base_discussions':
        // Discussion archetype: conversations and threads
        return baseColumns + `,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  discussion_type VARCHAR(100),
  author_id UUID,
  parent_discussion_id UUID`;
      
      case 'base_collections':
        // Collection archetype: groups of related items
        return baseColumns + `,
  description TEXT,
  collection_type VARCHAR(100) NOT NULL,
  items JSONB,
  owner_id UUID`;
      
      case 'base_entities':
        // Generic fallback (shouldn't be used anymore)
        return baseColumns + `,
  description TEXT`;

      default:
        return baseColumns;
    }
  }

  /**
   * Generate SQL columns for custom fields
   */
  private generateCustomColumns(customFields: Record<string, FieldDefinition>): string {
    return Object.entries(customFields)
      .map(([fieldName, fieldDef]) => {
        const sqlType = this.fieldTypeToSQLType(fieldDef.type);
        const nullable = fieldDef.required ? ' NOT NULL' : '';
        const defaultValue = fieldDef.default ? ` DEFAULT '${fieldDef.default}'` : '';
        const snakeFieldName = this.camelToSnake(fieldName);
        return `${snakeFieldName} ${sqlType}${nullable}${defaultValue}`;
      })
      .join(',\n  ');
  }

  /**
   * Convert JSON field type to SQL type
   */
  private fieldTypeToSQLType(type: string): string {
    switch (type) {
      case 'string':
      case 'email':
      case 'url':
      case 'enum':
        return 'VARCHAR(255)';
      case 'text':
        return 'TEXT';
      case 'number':
        return 'INTEGER';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'TIMESTAMPTZ';
      case 'json':
        return 'JSONB';
      default:
        return 'TEXT';
    }
  }
}