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
  created_by_id: string | null;
  client_id: string | null;
  custom_fields: Generated<any>;
  created_at: Generated<Date>;
  updated_at: Date;`;

    switch (extendsValue) {
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
  generateCreateTableSQL(definition: OrgEntityDefinition): string {
    const baseColumns = this.getBaseArchetypeColumns(definition.extends);
    const customColumns = this.generateCustomColumns(definition.customFields);
    
    return `
CREATE TABLE ${definition.tableName} (
  ${baseColumns}${customColumns ? ',\n  ' + customColumns : ''}
);

-- Indexes for performance
CREATE INDEX idx_${definition.tableName}_org_status ON ${definition.tableName}(organization_id, status);
CREATE INDEX idx_${definition.tableName}_created_at ON ${definition.tableName}(created_at);
`;
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
  created_by_id UUID,
  client_id UUID,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()`;

    switch (extendsValue) {
      case 'base_projects':
        return baseColumns + `,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'medium',
  start_date DATE,
  end_date DATE,
  owner_id UUID`;

      case 'base_tasks':
        return baseColumns + `,
  project_id UUID NOT NULL,
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