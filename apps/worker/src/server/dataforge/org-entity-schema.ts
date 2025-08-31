/**
 * Multi-Org Entity Schema Format
 * 
 * Defines the JSON schema format for organization-specific entity definitions.
 * Each org can create custom entities that extend base archetypes.
 */

import type { EntityConfig, FieldDefinition, RuleSet } from '../rules/json-rules-engine';

export interface OrgEntityDefinition {
  name: string;
  extends: 'base_universe' | 'base_world' | 'base_projects' | 'base_tasks' | 'base_events' | 'base_contacts' | 'base_records' | 'base_documents' | 'base_files' | 'base_activities' | 'base_discussions' | 'base_collections';
  tableName: string;        // Auto-generated: {orgId}_{entityName}s
  customFields: Record<string, FieldDefinition>;
  validationRules?: RuleSet;
  workflows?: Record<string, string[]>;
  defaultValues?: Record<string, any>;
}

export interface OrgSchema {
  orgId: string;
  entities: Record<string, OrgEntityDefinition>;
  version: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Example org schema can be found in test-fixtures/test-data.ts
 * 
 * This keeps production code free of hardcoded company references.
 * Use SAMPLE_SCHEMAS.exampleOrgSchema for testing.
 */

export class OrgSchemaManager {
  /**
   * Create entity config from org entity definition
   */
  createEntityConfig(orgId: string, entityName: string, definition: OrgEntityDefinition): EntityConfig {
    return {
      name: entityName,
      orgId: orgId,
      basePrimitive: this.mapExtendsToPrimitive(definition.extends),
      tableName: definition.tableName,
      customFields: definition.customFields,
      validationRules: definition.validationRules || { rules: [] },
      workflows: definition.workflows,
      defaultValues: definition.defaultValues,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Map extends field to base primitive (DataForge Archetype System)
   */
  private mapExtendsToPrimitive(extendsValue: string): 'Universe' | 'World' | 'Project' | 'Task' | 'Event' | 'Contact' | 'Record' | 'Document' | 'File' | 'Activity' | 'Discussion' | 'Collection' {
    switch (extendsValue) {
      case 'base_universe': return 'Universe';
      case 'base_world': return 'World';
      case 'base_projects': return 'Project';
      case 'base_tasks': return 'Task';
      case 'base_events': return 'Event';
      case 'base_contacts': return 'Contact';
      case 'base_records': return 'Record';
      case 'base_documents': return 'Document';
      case 'base_files': return 'File';
      case 'base_activities': return 'Activity';
      case 'base_discussions': return 'Discussion';
      case 'base_collections': return 'Collection';
      default: throw new Error(`Unknown base archetype: ${extendsValue}`);
    }
  }

  /**
   * Generate table name for org entity
   */
  generateTableName(orgId: string, entityName: string): string {
    let cleanOrgId = orgId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const cleanEntityName = entityName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    // Ensure table name starts with letter (not number)
    if (/^[0-9]/.test(cleanOrgId)) {
      cleanOrgId = `org_${cleanOrgId}`;
    }
    
    return `${cleanOrgId}_${cleanEntityName}s`;
  }

  /**
   * Validate org schema structure
   */
  validateOrgSchema(schema: OrgSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!schema.orgId || schema.orgId.trim() === '') {
      errors.push('orgId is required');
    }

    if (!schema.entities || typeof schema.entities !== 'object') {
      errors.push('entities object is required');
    } else {
      for (const [entityName, definition] of Object.entries(schema.entities)) {
        const entityErrors = this.validateEntityDefinition(entityName, definition);
        errors.push(...entityErrors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual entity definition
   */
  private validateEntityDefinition(entityName: string, definition: OrgEntityDefinition): string[] {
    const errors: string[] = [];

    if (!definition.extends || !['base_universe', 'base_world', 'base_projects', 'base_tasks', 'base_events', 'base_contacts', 'base_records', 'base_documents', 'base_files', 'base_activities', 'base_discussions', 'base_collections'].includes(definition.extends)) {
      errors.push(`${entityName}: extends must be one of the supported base archetypes`);
    }

    if (!definition.customFields || typeof definition.customFields !== 'object') {
      errors.push(`${entityName}: customFields object is required`);
    } else {
      for (const [fieldName, fieldDef] of Object.entries(definition.customFields)) {
        if (!fieldDef.type || !['string', 'number', 'boolean', 'date', 'enum', 'email', 'url', 'json', 'text'].includes(fieldDef.type)) {
          errors.push(`${entityName}.${fieldName}: invalid type`);
        }
        
        if (fieldDef.type === 'enum' && (!fieldDef.enum || !Array.isArray(fieldDef.enum))) {
          errors.push(`${entityName}.${fieldName}: enum fields must have enum array`);
        }
      }
    }

    return errors;
  }

  /**
   * Get syncable schema for client (filters out server-only fields)
   */
  getSyncableSchema(schema: OrgSchema): any {
    const syncableEntities: any = {};

    for (const [entityName, definition] of Object.entries(schema.entities)) {
      const syncableFields: Record<string, FieldDefinition> = {};
      
      // Include only syncable custom fields
      for (const [fieldName, fieldDef] of Object.entries(definition.customFields)) {
        if (fieldDef.syncable !== false && !fieldDef.serverOnly) {
          syncableFields[fieldName] = fieldDef;
        }
      }

      syncableEntities[entityName] = {
        extends: definition.extends,
        tableName: definition.tableName,
        syncableFields: syncableFields
      };
    }

    return {
      orgId: schema.orgId,
      entities: syncableEntities,
      version: schema.version
    };
  }
}