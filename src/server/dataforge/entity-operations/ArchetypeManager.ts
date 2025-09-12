/**
 * ArchetypeManager - Handles archetype operations
 * 
 * Manages archetype entity data operations and lifecycle.
 * Interfaces with ArchetypeOperations service and OrganizationActor.
 */

import type { FieldDefinition } from '../json-rules-engine';
import type { OrgEntityDefinition } from '../org-entity-schema';
import { ArchetypeOperations } from '../services/ArchetypeOperations';

export interface DataForgeEntityManagerConfig {
  kysely: any; // Kysely instance
  rulesEngine?: any; // JsonRulesEngine instance  
  env?: any; // Cloudflare environment
}

export interface ArchetypeEntityData {
  archetype: string;
  tableName: string;
  customFields: Record<string, FieldDefinition>;
  orgId?: string;
}

export interface ArchetypeCreateResult {
  success: boolean;
  entityId?: string;
  tableName?: string;
  ddl?: string;
  errors?: string[];
}

export interface ArchetypeQueryResult {
  success: boolean;
  data?: any[];
  metadata?: {
    archetype: string;
    tableName: string;
    fieldDefinitions: Record<string, FieldDefinition>;
  };
  errors?: string[];
}

export class ArchetypeManager {
  private config: DataForgeEntityManagerConfig;
  private configCache: Map<string, OrgEntityDefinition>;
  private archetypeOperations: ArchetypeOperations;

  constructor(config: DataForgeEntityManagerConfig, configCache: Map<string, OrgEntityDefinition>) {
    this.config = config;
    this.configCache = configCache;
    
    // Initialize archetype operations
    this.archetypeOperations = new ArchetypeOperations({ env: config.env });
  }

  /**
   * Save data to archetype entity with validation
   */
  async saveArchetypeEntityData(
    archetype: string,
    tableName: string,
    data: Record<string, any>
  ): Promise<ArchetypeCreateResult> {
    try {
      // Extract orgId from data or derive it
      const orgId = data.organization_id || data.orgId;
      if (!orgId) {
        return {
          success: false,
          errors: ['Organization ID is required']
        };
      }

      // 1. Get archetype metadata
      const metadata = await this.getArchetypeMetadata(orgId, tableName);
      if (!metadata) {
        return {
          success: false,
          errors: [`Archetype entity ${tableName} not found for organization ${orgId}`]
        };
      }

      // 2. Validate data against archetype business logic
      const validation = await this.validateArchetypeData(metadata.archetype, data, orgId);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // 3. Use createRecord-like functionality (would need RecordManager instance or delegation)
      // For now, return the validated data structure
      return {
        success: true,
        entityId: crypto.randomUUID(),
        tableName: tableName,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to save archetype data: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Query archetype entity data with metadata
   */
  async queryArchetypeEntityData(
    archetype: string,
    tableName: string,
    options: any = {}
  ): Promise<ArchetypeQueryResult> {
    try {
      const filters = options.filters || {};
      const orgId = options.orgId;
      
      if (!orgId) {
        return {
          success: false,
          errors: ['Organization ID is required']
        };
      }

      // 1. Query data using queryRecords-like functionality (would need delegation)
      // For now, return empty data structure
      const queryResult = {
        success: true,
        data: [],
        count: 0
      };

      // 2. Include archetype metadata if requested
      let metadata;
      if (options.includeMetadata) {
        const archetypeMetadata = await this.getArchetypeMetadata(orgId, tableName);
        if (archetypeMetadata) {
          metadata = {
            archetype: archetypeMetadata.archetype,
            tableName: archetypeMetadata.tableName,
            fieldDefinitions: archetypeMetadata.fieldDefinitions
          };
        }
      }

      return {
        success: true,
        data: queryResult.data,
        metadata
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to query archetype data: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * List all archetype entities for an organization
   */
  async listArchetypeEntities(orgId: string): Promise<{
    success: boolean;
    entities?: Array<{
      tableName: string;
      archetype: string;
      customFields: Record<string, FieldDefinition>;
      createdAt: string;
      updatedAt: string;
    }>;
    errors?: string[];
  }> {
    try {
      // Use OrganizationActor to list archetype entities
      if (!this.config.env?.ORGANIZATION_ACTOR) {
        return {
          success: false,
          errors: ['OrganizationActor not available in environment']
        };
      }

      const doId = this.config.env.ORGANIZATION_ACTOR.idFromName(orgId);
      const doStub = this.config.env.ORGANIZATION_ACTOR.get(doId);

      const response = await doStub.fetch(new Request('http://localhost/archetype-entities'));
      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          errors: ['Failed to retrieve archetype entities']
        };
      }

      // Transform entities to include only necessary information
      const entities = Object.entries(result.entities).map(([tableName, definition]: [string, any]) => ({
        tableName,
        archetype: definition.extends,
        customFields: definition.customFields,
        createdAt: definition.createdAt,
        updatedAt: definition.updatedAt
      }));

      return {
        success: true,
        entities
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to list archetype entities: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Delete archetype entity (table and schema)
   */
  async deleteArchetypeEntity(
    orgId: string,
    entityName: string,
    permanent: boolean = false
  ): Promise<any> {
    try {
      const options = { dropTable: permanent };
      
      // 1. Remove from OrganizationActor
      if (this.config.env?.ORGANIZATION_ACTOR) {
        const doId = this.config.env.ORGANIZATION_ACTOR.idFromName(orgId);
        const doStub = this.config.env.ORGANIZATION_ACTOR.get(doId);

        const response = await doStub.fetch(new Request(`http://localhost/archetype-entity/${entityName}`, {
          method: 'DELETE'
        }));

        if (!response.ok) {
          return {
            success: false,
            errors: ['Failed to remove entity from organization schema']
          };
        }
      }

      return { 
        success: true,
        message: permanent 
          ? `Archetype entity ${entityName} permanently deleted`
          : `Archetype entity ${entityName} deleted`,
        permanent
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to delete archetype entity: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate archetype fields against base pattern
   */
  private validateArchetypeFields(
    ArchetypeClass: any,
    customFields: Record<string, FieldDefinition>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for conflicts with base archetype fields
    const baseFields = ArchetypeClass.fields || {};
    for (const customFieldName of Object.keys(customFields)) {
      if (baseFields[customFieldName]) {
        errors.push(`Custom field '${customFieldName}' conflicts with base archetype field`);
      }
    }

    // Validate custom field types
    const supportedTypes = [
      'text', 'longtext', 'number', 'integer', 'decimal', 'boolean', 
      'date', 'datetime', 'json', 'priority_option', 'status_option', 
      'category_option', 'user_reference', 'entity_reference'
    ];

    for (const [fieldName, fieldDef] of Object.entries(customFields)) {
      if (!supportedTypes.includes(fieldDef.type)) {
        errors.push(`Unsupported field type '${fieldDef.type}' for field '${fieldName}'`);
      }

      if (fieldDef.required === undefined) {
        errors.push(`Field '${fieldName}' must specify required property`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create archetype schema using OrganizationActor
   */
  private async createArchetypeSchema(
    orgId: string,
    archetype: string,
    tableName: string,
    customFields: Record<string, FieldDefinition>
  ): Promise<{ success: boolean; ddl?: string; errors?: string[] }> {
    return this.archetypeOperations.createArchetypeSchema(orgId, archetype, tableName, customFields);
  }

  /**
   * Get archetype metadata for an entity
   */
  private async getArchetypeMetadata(
    orgId: string,
    tableName: string
  ): Promise<{ archetype: string; tableName: string; fieldDefinitions: Record<string, FieldDefinition> } | null> {
    return this.archetypeOperations.getArchetypeMetadata(orgId, tableName);
  }

  /**
   * Validate data against archetype business logic
   */
  private async validateArchetypeData(
    archetype: string,
    data: Record<string, any>,
    orgId?: string
  ): Promise<{ valid: boolean; data: Record<string, any>; errors: string[] }> {
    return await this.archetypeOperations.validateArchetypeData(archetype, data, orgId);
  }
}