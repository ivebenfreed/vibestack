/**
 * Archetype Entity Manager
 * 
 * Extends EntityManager with DataForge archetype support for organization-specific entity creation.
 * Integrates archetype patterns with the existing multi-org DataForge infrastructure.
 */

import type { FieldDefinition } from '../json-rules-engine';
import type { OrgEntityDefinition } from '../org-entity-schema';
import { DDLGenerator } from '../DDLGenerator';
import { BulkOperationsService, type BulkCreateOptions, type BulkCreateResult, type BulkUpdateResult, type BulkDeleteResult } from '../BulkOperationsService';

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

export class DataForgeEntityManager {
  private config: DataForgeEntityManagerConfig;
  private bulkOperationsService: BulkOperationsService;

  constructor(config: DataForgeEntityManagerConfig) {
    this.config = config;
    
    // Initialize bulk operations service
    this.bulkOperationsService = new BulkOperationsService({
      kysely: config.kysely,
      rulesEngine: config.rulesEngine,
      getEntityConfig: this.getEntityConfig.bind(this),
      saveEntityData: this.saveEntityData.bind(this)
    });
  }

  /**
   * Get entity configuration for rules engine
   */
  async getEntityConfig(orgId: string, entityName: string): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Getting entity config: ${entityName} for org: ${orgId}`);
      
      // Get entity from entity_schemas table
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['entity_name', 'table_name', 'archetype', 'business_metadata'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity) {
        console.log(`[DataForgeEntityManager] Entity ${entityName} not found for org ${orgId}`);
        return null;
      }

      // Return configuration object for archetype entity validation
      return {
        tableName: entity.table_name,
        entityName: entity.entity_name,
        archetype: entity.archetype,
        orgId: orgId
      };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Error getting entity config:`, error);
      return null;
    }
  }

  /**
   * Create a single record (archetype-based)
   */
  async createRecord(orgId: string, entityName: string, data: any, userId?: string): Promise<any> {
    try {
      const config = await this.getEntityConfig(orgId, entityName);
      if (!config) {
        return { success: false, errors: [`Entity ${entityName} not found for org ${orgId}`] };
      }

      // Add system fields and archetype defaults
      const saveData = {
        ...data,
        id: crypto.randomUUID(),
        organization_id: orgId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Add creator/owner information if user is provided
        ...(userId && { created_by: userId })
      };

      // Apply archetype-specific defaults
      if (config.archetype) {
        const { ArchetypeRegistry } = await import('../ArchetypeRegistry');
        const archetypeClass = ArchetypeRegistry.getArchetypeClass(config.archetype);
        if (archetypeClass && archetypeClass.getFieldDefaults) {
          const archetypeDefaults = archetypeClass.getFieldDefaults();
          // Only add defaults for fields that aren't already provided
          for (const [field, defaultValue] of Object.entries(archetypeDefaults)) {
            if (saveData[field] === undefined) {
              saveData[field] = defaultValue;
            }
          }
        }
      }

      const result = await this.config.kysely
        .insertInto(config.tableName as any)
        .values(saveData as any)
        .returning(['id', 'created_at', 'updated_at'])
        .executeTakeFirst();

      if (!result) {
        return { success: false, errors: ['Failed to create record'] };
      }

      return { success: true, data: { ...saveData, ...result } };
    } catch (error) {
      return { 
        success: false, 
        errors: [`Failed to create record: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Update a single record (archetype-based)
   */
  async updateRecord(orgId: string, entityName: string, recordId: string, updates: any): Promise<any> {
    try {
      const config = await this.getEntityConfig(orgId, entityName);
      if (!config) {
        return { success: false, errors: [`Entity ${entityName} not found for org ${orgId}`] };
      }

      const result = await this.config.kysely
        .updateTable(config.tableName as any)
        .set({
          ...updates,
          updated_at: new Date().toISOString()
        } as any)
        .where('id', '=', recordId)
        .where('organization_id', '=', orgId)
        .returning(['id', 'updated_at'])
        .executeTakeFirst();

      if (!result) {
        return { success: false, errors: ['Record not found or no changes made'] };
      }

      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        errors: [`Failed to update record: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Delete a single record (archetype-based)
   */
  async deleteRecord(orgId: string, entityName: string, recordId: string, permanent: boolean = false): Promise<any> {
    try {
      const config = await this.getEntityConfig(orgId, entityName);
      if (!config) {
        return { success: false, errors: [`Entity ${entityName} not found for org ${orgId}`] };
      }

      let result;
      if (permanent) {
        // Hard delete
        result = await this.config.kysely
          .deleteFrom(config.tableName as any)
          .where('id', '=', recordId)
          .where('organization_id', '=', orgId)
          .returning(['id'])
          .executeTakeFirst();
      } else {
        // Soft delete (archetype pattern)
        result = await this.config.kysely
          .updateTable(config.tableName as any)
          .set({
            status: 'deleted',
            updated_at: new Date().toISOString()
          } as any)
          .where('id', '=', recordId)
          .where('organization_id', '=', orgId)
          .where('status', '!=', 'deleted')
          .returning(['id'])
          .executeTakeFirst();
      }

      if (!result) {
        return { success: false, errors: ['Record not found or already deleted'] };
      }

      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        errors: [`Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Get a single record (archetype-based)
   */
  async getRecord(orgId: string, entityName: string, recordId: string): Promise<any> {
    try {
      const config = await this.getEntityConfig(orgId, entityName);
      if (!config) {
        return { success: false, errors: [`Entity ${entityName} not found for org ${orgId}`] };
      }

      const result = await this.config.kysely
        .selectFrom(config.tableName as any)
        .selectAll()
        .where('id', '=', recordId)
        .where('organization_id', '=', orgId)
        .executeTakeFirst();

      if (!result) {
        return { success: false, errors: ['Record not found'] };
      }

      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        errors: [`Failed to get record: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Query records with filtering, sorting, and pagination
   */
  async queryRecords(orgId: string, entityName: string, options: any = {}): Promise<any> {
    try {
      const config = await this.getEntityConfig(orgId, entityName);
      if (!config) {
        return { success: false, errors: [`Entity ${entityName} not found for org ${orgId}`] };
      }

      let query = this.config.kysely
        .selectFrom(config.tableName as any)
        .selectAll()
        .where('organization_id', '=', orgId);

      // Apply filters
      if (options.filters) {
        query = this.applyFiltersToQuery(query, options.filters);
      }

      // Apply ordering
      if (options.orderBy) {
        const direction = options.orderDirection || 'asc';
        query = query.orderBy(options.orderBy as any, direction);
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.offset(options.offset);
      }

      const results = await query.execute();

      return {
        success: true,
        data: results,
        total: results.length
      };
    } catch (error) {
      return { 
        success: false, 
        errors: [`Failed to query records: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Apply filter conditions to a Kysely query
   */
  private applyFiltersToQuery(query: any, filter: Record<string, any>): any {
    for (const [field, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null) {
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case 'contains':
              query = query.where(field as any, 'ilike', `%${operatorValue}%`);
              break;
            case 'gt':
              query = query.where(field as any, '>', operatorValue);
              break;
            case 'lt':
              query = query.where(field as any, '<', operatorValue);
              break;
            case 'gte':
              query = query.where(field as any, '>=', operatorValue);
              break;
            case 'lte':
              query = query.where(field as any, '<=', operatorValue);
              break;
            case 'in':
              const inValues = Array.isArray(operatorValue) ? operatorValue : [operatorValue];
              query = query.where(field as any, 'in', inValues);
              break;
            case 'not_in':
              const notInValues = Array.isArray(operatorValue) ? operatorValue : [operatorValue];
              query = query.where(field as any, 'not in', notInValues);
              break;
            case 'starts_with':
              query = query.where(field as any, 'ilike', `${operatorValue}%`);
              break;
            case 'ends_with':
              query = query.where(field as any, 'ilike', `%${operatorValue}`);
              break;
            case 'is_null':
              query = operatorValue ? query.where(field as any, 'is', null) : query.where(field as any, 'is not', null);
              break;
            case 'not':
              query = query.where(field as any, '!=', operatorValue);
              break;
          }
        }
      } else {
        query = query.where(field as any, '=', value);
      }
    }
    return query;
  }

  /**
   * Legacy method - use createRecord instead
   */
  async saveEntityData(orgId: string, entityName: string, data: Record<string, any>): Promise<any> {
    return this.createRecord(orgId, entityName, data);
  }

  /**
   * Get entity details (metadata about the entity)
   */
  async getEntityDetails(orgId: string, entityName: string): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Getting entity details: ${entityName} for org: ${orgId}`);
      
      // Get entity details from entity_schemas table
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['entity_name', 'table_name', 'archetype', 'business_metadata', 'created_at', 'updated_at'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity) {
        return {
          success: false,
          error: `Entity ${entityName} not found`
        };
      }

      // Parse metadata
      let metadata;
      try {
        metadata = typeof entity.business_metadata === 'string' 
          ? JSON.parse(entity.business_metadata)
          : entity.business_metadata;
      } catch (parseError) {
        console.warn(`Failed to parse metadata for entity ${entityName}:`, parseError);
        metadata = {};
      }

      return {
        success: true,
        data: {
          entityName: entity.entity_name,
          tableName: entity.table_name,
          archetype: entity.archetype,
          fieldCount: Object.keys(metadata.fields || {}).length,
          fields: metadata.fields || {},
          createdAt: entity.created_at,
          updatedAt: entity.updated_at,
          syncable: metadata.syncable !== false
        }
      };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Error getting entity details:`, error);
      return {
        success: false,
        error: 'Failed to get entity details',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }



  /**
   * Save data to archetype entity with validation
   */
  async saveArchetypeEntityData(
    orgId: string,
    tableName: string,
    data: Record<string, any>
  ): Promise<{ success: boolean; data?: any; syncData?: any; errors?: string[] }> {
    try {
      // 1. Get archetype metadata
      const metadata = await this.getArchetypeMetadata(orgId, tableName);
      if (!metadata) {
        return {
          success: false,
          errors: [`Archetype entity ${tableName} not found for organization ${orgId}`]
        };
      }

      // 2. Validate data against archetype business logic
      const validation = this.validateArchetypeData(metadata.archetype, data);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // 3. Use parent EntityManager to save data (it handles org isolation)
      return await this.saveEntityData(orgId, tableName, validation.data);
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
    orgId: string,
    tableName: string,
    filters: Record<string, any> = {},
    options: { syncableOnly?: boolean; includeMetadata?: boolean } = {}
  ): Promise<ArchetypeQueryResult> {
    try {
      // 1. Query data using parent EntityManager
      const queryResult = await this.queryEntityData(orgId, tableName, filters, options.syncableOnly);
      if (!queryResult.success) {
        return {
          success: false,
          errors: queryResult.errors
        };
      }

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
      // Use OrgSchemaDO to list archetype entities
      if (!this.config.env?.ORG_SCHEMA) {
        return {
          success: false,
          errors: ['OrgSchemaDO not available in environment']
        };
      }

      const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
      const doStub = this.config.env.ORG_SCHEMA.get(doId);

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
    tableName: string,
    options: { dropTable?: boolean } = {}
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      // 1. Remove from OrgSchemaDO
      if (this.config.env?.ORG_SCHEMA) {
        const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
        const doStub = this.config.env.ORG_SCHEMA.get(doId);

        const response = await doStub.fetch(new Request(`http://localhost/archetype-entity/${tableName}`, {
          method: 'DELETE'
        }));

        if (!response.ok) {
          return {
            success: false,
            errors: ['Failed to remove entity from organization schema']
          };
        }
      }


      return { success: true };
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
   * Create archetype schema using OrgSchemaDO
   */
  private async createArchetypeSchema(
    orgId: string,
    archetype: string,
    tableName: string,
    customFields: Record<string, FieldDefinition>
  ): Promise<{ success: boolean; ddl?: string; errors?: string[] }> {
    try {
      if (!this.config.env?.ORG_SCHEMA) {
        return {
          success: false,
          errors: ['OrgSchemaDO not available in environment']
        };
      }

      const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
      const doStub = this.config.env.ORG_SCHEMA.get(doId);

      const response = await doStub.fetch(new Request('http://localhost/create-archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          archetype,
          tableName,
          fieldDefinitions: customFields
        })
      }));

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to create archetype schema: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get archetype metadata for an entity
   */
  private async getArchetypeMetadata(
    orgId: string,
    tableName: string
  ): Promise<{ archetype: string; tableName: string; fieldDefinitions: Record<string, FieldDefinition> } | null> {
    try {
      if (!this.config.env?.ORG_SCHEMA) {
        return null;
      }

      const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
      const doStub = this.config.env.ORG_SCHEMA.get(doId);

      const response = await doStub.fetch(new Request(`http://localhost/archetype-entity/${tableName}`));
      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (!result.success) {
        return null;
      }

      return {
        archetype: result.entity.extends,
        tableName: result.entity.tableName,
        fieldDefinitions: result.entity.customFields
      };
    } catch (error) {
      console.error('Failed to get archetype metadata:', error);
      return null;
    }
  }

  /**
   * Validate data against archetype business logic
   */
  private validateArchetypeData(
    archetype: string,
    data: Record<string, any>
  ): { valid: boolean; data: Record<string, any>; errors: string[] } {
    const errors: string[] = [];

    // Basic validation - ensure we have some data and no empty required fields
    if (!data || Object.keys(data).length === 0) {
      errors.push('Data cannot be empty');
    }

    // Ensure organization_id is present for multi-org isolation
    if (!data.organization_id) {
      errors.push('organization_id is required');
    }

    // Basic archetype-specific validation
    try {
      switch (archetype) {
        case 'record':
        case 'project':
        case 'task':
          // These archetypes typically require a name
          if (!data.name || data.name.trim() === '') {
            errors.push('name is required');
          }
          break;
        default:
          // Generic validation for unknown archetypes
          break;
      }

      return {
        valid: errors.length === 0,
        data: { ...data }, // Return validated data
        errors
      };
    } catch (error) {
      return {
        valid: false,
        data: {},
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  // ===== WEEK 3 DAY 1-2: DEBOUNCED MIGRATION MANAGEMENT METHODS =====


  /**
   * Bulk create multiple records for an entity
   */
  async bulkCreateRecords(
    orgId: string,
    entityName: string,
    records: any[],
    options: BulkCreateOptions = {}
  ): Promise<BulkCreateResult> {
    return this.bulkOperationsService.bulkCreateRecords(orgId, entityName, records, options);
  }

  /**
   * Bulk update records matching a filter
   */
  async bulkUpdateRecords(
    orgId: string,
    entityName: string,
    filter: Record<string, any>,
    updates: Record<string, any>
  ): Promise<BulkUpdateResult> {
    return this.bulkOperationsService.bulkUpdateRecords(orgId, entityName, filter, updates);
  }

  /**
   * Bulk delete records matching a filter
   */
  async bulkDeleteRecords(
    orgId: string,
    entityName: string,
    filter: Record<string, any>,
    permanent: boolean = false
  ): Promise<BulkDeleteResult> {
    return this.bulkOperationsService.bulkDeleteRecords(orgId, entityName, filter, permanent);
  }

  /**
   * Create entity with archetype pattern and custom fields
   */
  async createEntity(
    orgId: string,
    entityName: string,
    archetype: string,
    customFields: Record<string, any> = {}
  ): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Creating entity: ${entityName} (${archetype}) for org: ${orgId}`);
      
      // Get archetype fields and merge with custom fields
      const archetypeFields = await this.getArchetypeFields(archetype);
      
      // Convert customFields object to field definitions
      const customFieldDefs: Record<string, any> = {};
      for (const [fieldName, fieldConfig] of Object.entries(customFields)) {
        customFieldDefs[fieldName] = {
          name: fieldName,
          type: fieldConfig.type || 'text',
          required: fieldConfig.required || false,
          defaultValue: fieldConfig.defaultValue
        };
      }
      
      const allFields = { ...archetypeFields, ...customFieldDefs };

      // Generate table name using DDLGenerator
      const fullTableName = DDLGenerator.generateTableName(orgId, entityName);
      
      // Validate table name
      const tableValidation = DDLGenerator.validateTableName(fullTableName);
      if (!tableValidation.valid) {
        return {
          success: false,
          errors: [`Invalid table name: ${tableValidation.error}`]
        };
      }

      // Generate DDL using DDLGenerator
      const ddl = DDLGenerator.generateCreateTableDDL(fullTableName, allFields);

      // Execute DDL
      await this.config.kysely.executeQuery({
        sql: ddl,
        parameters: []
      });

      // Register entity in entity_schemas table (direct insert)
      await this.config.kysely
        .insertInto('entity_schemas')
        .values({
          org_id: orgId,
          entity_name: entityName,
          archetype,
          table_name: fullTableName,
          deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .execute();

      console.log(`[DataForgeEntityManager] Successfully created entity: ${fullTableName}`);
      
      return {
        success: true,
        tableName: fullTableName,
        immediate: true
      };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Failed to create entity:`, error);
      return {
        success: false,
        errors: [`Failed to create entity: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get basic fields for an archetype
   */
  private async getArchetypeFields(archetype: string): Promise<Record<string, any>> {
    // Base fields common to all archetypes
    const baseFields = {
      id: { name: 'id', type: 'text', required: true },
      organization_id: { name: 'organization_id', type: 'text', required: true },
      created_by: { name: 'created_by', type: 'text', required: false },
      created_at: { name: 'created_at', type: 'datetime', required: true },
      updated_at: { name: 'updated_at', type: 'datetime', required: true }
    };

    // Import and use the appropriate archetype class
    try {
      switch (archetype) {
        case 'record': {
          const { RecordArchetype } = await import('../archetypes/RecordArchetype');
          return { ...baseFields, ...RecordArchetype.fields };
        }
        case 'project': {
          const { ProjectArchetype } = await import('../archetypes/ProjectArchetype');
          return { ...baseFields, ...ProjectArchetype.fields };
        }
        case 'task': {
          const { TaskArchetype } = await import('../archetypes/TaskArchetype');
          return { ...baseFields, ...TaskArchetype.fields };
        }
        case 'document': {
          const { DocumentArchetype } = await import('../archetypes/DocumentArchetype');
          return { ...baseFields, ...DocumentArchetype.fields };
        }
        case 'file': {
          const { FileArchetype } = await import('../archetypes/FileArchetype');
          return { ...baseFields, ...FileArchetype.fields };
        }
        case 'activity': {
          const { ActivityArchetype } = await import('../archetypes/ActivityArchetype');
          return { ...baseFields, ...ActivityArchetype.fields };
        }
        case 'discussion': {
          const { DiscussionArchetype } = await import('../archetypes/DiscussionArchetype');
          return { ...baseFields, ...DiscussionArchetype.fields };
        }
        case 'collection': {
          const { CollectionArchetype } = await import('../archetypes/CollectionArchetype');
          return { ...baseFields, ...CollectionArchetype.fields };
        }
        default:
          console.warn(`Unknown archetype: ${archetype}, using base fields only`);
          return {
            ...baseFields,
            name: { name: 'name', type: 'text', required: false },
            description: { name: 'description', type: 'longtext', required: false },
            status: { name: 'status', type: 'text', required: false }
          };
      }
    } catch (error) {
      console.error(`Failed to load archetype ${archetype}:`, error);
      // Fallback to basic fields
      return {
        ...baseFields,
        name: { name: 'name', type: 'text', required: false },
        description: { name: 'description', type: 'longtext', required: false },
        status: { name: 'status', type: 'text', required: false }
      };
    }
  }

  /**
   * Soft delete an entity (moves to trash, preserves table and data)
   */
  async deleteEntity(orgId: string, entityName: string): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Soft deleting entity: ${entityName} for org: ${orgId} (data preserved for recovery)`);
      
      // Get entity details first
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['table_name as tableName', 'archetype'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity) {
        return {
          success: false,
          error: 'Entity not found'
        };
      }

      // SOFT DELETE ONLY - table and data are preserved for recovery
      // Table can be permanently deleted later via "empty trash" functionality
      await this.config.kysely
        .updateTable('entity_schemas')
        .set({ 
          deleted: true, 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .execute();

      return {
        success: true,
        message: `Entity ${entityName} has been moved to trash (data preserved for recovery)`,
        softDeleted: true,
        tableName: entity.tableName,
        recoverable: true
      };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Error deleting entity:`, error);
      return {
        success: false,
        error: 'Failed to delete entity',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Restore entity from trash (undelete)
   */
  async restoreEntity(orgId: string, entityName: string): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Restoring entity from trash: ${entityName} for org: ${orgId}`);
      
      // Check if entity exists in trash (deleted = true)
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['table_name as tableName', 'archetype', 'deleted_at'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '=', true)
        .executeTakeFirst();

      if (!entity) {
        return {
          success: false,
          error: `Entity ${entityName} not found in trash`
        };
      }

      // Restore entity by setting deleted = false
      await this.config.kysely
        .updateTable('entity_schemas')
        .set({ 
          deleted: false, 
          deleted_at: null,
          updated_at: new Date().toISOString() 
        })
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .execute();

      return {
        success: true,
        message: `Entity ${entityName} has been restored from trash`,
        restored: true,
        tableName: entity.tableName,
        deletedAt: entity.deleted_at
      };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Error restoring entity:`, error);
      return {
        success: false,
        error: 'Failed to restore entity',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Permanently delete entity and its table (empty trash)
   */
  async permanentDeleteEntity(orgId: string, entityName: string): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Permanently deleting entity: ${entityName} and its table`);
      
      // Check if entity exists in trash (deleted = true)
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['table_name as tableName', 'archetype', 'deleted_at'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '=', true)
        .executeTakeFirst();

      if (!entity) {
        return {
          success: false,
          error: `Entity ${entityName} not found in trash`
        };
      }

      // PERMANENT DELETE - DROP TABLE AND REMOVE SCHEMA
      const dropDDL = DDLGenerator.generateDropTableDDL(entity.tableName);
      await this.config.kysely.executeQuery({
        sql: dropDDL,
        parameters: []
      });
      console.log(`Permanently dropped table: ${entity.tableName}`);

      // Remove from entity_schemas table completely
      await this.config.kysely
        .deleteFrom('entity_schemas')
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .execute();
      console.log(`Permanently removed entity from entity_schemas: ${entityName}`);

      return {
        success: true,
        message: `Entity ${entityName} and all its data have been permanently deleted`,
        permanentlyDeleted: true,
        tableName: entity.tableName,
        warning: 'This action cannot be undone'
      };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Error permanently deleting entity:`, error);
      return {
        success: false,
        error: 'Failed to permanently delete entity',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List deleted entities (trash)
   */
  async listTrash(orgId: string): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Listing trash for org: ${orgId}`);
      
      const entities = await this.config.kysely
        .selectFrom('entity_schemas')
        .select([
          'entity_name',
          'table_name',
          'archetype', 
          'created_at',
          'deleted_at'
        ])
        .where('org_id', '=', orgId)
        .where('deleted', '=', true)
        .orderBy('deleted_at', 'desc')
        .execute();

      const formattedEntities = entities.map((entity: any) => ({
        entityName: entity.entity_name,
        tableName: entity.table_name,
        archetype: entity.archetype,
        createdAt: entity.created_at,
        deletedAt: entity.deleted_at,
        recoverable: true
      }));

      return {
        success: true,
        data: {
          entities: formattedEntities,
          total: formattedEntities.length
        }
      };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Error listing trash:`, error);
      return {
        success: false,
        error: 'Failed to list deleted entities',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add fields to an existing entity
   */
  async addFields(orgId: string, entityName: string, fields: any[]): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Adding fields to entity: ${entityName}`);

      // Get entity details
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['table_name as tableName', 'archetype'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity) {
        return { success: false, error: 'Entity not found' };
      }

      // Add columns to the table using DDLGenerator
      const addedFields: string[] = [];
      const errors: string[] = [];
      
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
        } catch (error) {
          if (error instanceof Error && error.message.includes('already exists')) {
            errors.push(`Field '${field.name}' already exists`);
          } else {
            errors.push(`Failed to add field '${field.name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Update schema tracking tables if any fields were successfully added
      if (addedFields.length > 0) {
        try {
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

          console.log(`[DataForgeEntityManager] Updated schema tracking for ${entityName} field additions`);
        } catch (error) {
          console.warn(`[DataForgeEntityManager] Failed to update schema tracking:`, error);
          // Don't fail the operation if schema tracking fails
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
      console.error(`[DataForgeEntityManager] Error adding fields:`, error);
      return {
        success: false,
        error: 'Failed to add fields',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove a field from an existing entity
   */
  async removeField(orgId: string, entityName: string, fieldName: string): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Removing field ${fieldName} from entity: ${entityName}`);

      // Get entity details
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['table_name as tableName', 'archetype'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity) {
        return { success: false, error: 'Entity not found' };
      }

      // Drop column from table using DDLGenerator
      const dropColumnDDL = DDLGenerator.generateDropColumnDDL(entity.tableName, fieldName);
      
      await this.config.kysely.executeQuery({
        sql: dropColumnDDL,
        parameters: []
      });

      return {
        success: true,
        message: `Removed field ${fieldName} from ${entityName}`
      };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Error removing field:`, error);
      return {
        success: false,
        error: 'Failed to remove field',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get schema for an organization (list of entities with their definitions)
   */
  async getSchema(orgId: string): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Getting schema for org: ${orgId}`);
      
      const entities = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['entity_name', 'archetype', 'table_name', 'business_metadata', 'created_at', 'updated_at'])
        .where('org_id', '=', orgId)
        .where('deleted', '!=', true)
        .execute();

      const schema = entities.map((entity: any) => ({
        entityName: entity.entity_name,
        archetype: entity.archetype,
        tableName: entity.table_name,
        businessMetadata: entity.business_metadata,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at
      }));

      return { success: true, data: schema };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Error getting schema:`, error);
      return {
        success: false,
        error: 'Failed to get schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all entities for an organization
   */
  async listEntities(orgId: string): Promise<any> {
    try {
      console.log(`[DataForgeEntityManager] Listing entities for org: ${orgId}`);
      
      const entities = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['entity_name as entityName', 'table_name as tableName', 'archetype', 'created_at', 'updated_at'])
        .where('org_id', '=', orgId)
        .where('deleted', '!=', true)
        .execute();

      console.log(`[DataForgeEntityManager] Found ${entities.length} entities`);

      const formattedEntities = entities.map((entity: any) => ({
        entityName: entity.entityName,
        tableName: entity.tableName,
        archetype: entity.archetype,
        fieldCount: 10,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
        syncable: true
      }));

      return {
        entities: formattedEntities,
        total: formattedEntities.length
      };
    } catch (error) {
      console.error(`[DataForgeEntityManager] Error listing entities:`, error);
      return {
        success: false,
        error: 'Failed to list entities',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Notify Legend State of schema changes to ensure proper synchronization
   */
  private notifySchemaChange(orgId: string, entityName: string, operation: 'create' | 'update' | 'delete'): void {
    console.log(`[ArchetypeEntityManager] Schema change notification: ${operation} on ${orgId}.${entityName}`);
    
    // TODO: Integrate with WebSocket system to notify Legend State clients
    // This ensures Legend State invalidates caches and reloads entity definitions
    // when schema changes occur in the archetype system
  }
}