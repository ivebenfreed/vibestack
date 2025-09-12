/**
 * RecordManager - Handles record CRUD operations
 * 
 * Manages creating, reading, updating, and deleting records for entities.
 * Supports custom fields, validation, relationship handling, and archetype patterns.
 */

import type { FieldDefinition } from '../json-rules-engine';
import type { OrgEntityDefinition } from '../org-entity-schema';

export interface DataForgeEntityManagerConfig {
  kysely: any; // Kysely instance
  rulesEngine?: any; // JsonRulesEngine instance  
  env?: any; // Cloudflare environment
}

export class RecordManager {
  private config: DataForgeEntityManagerConfig;
  private configCache: Map<string, OrgEntityDefinition>;

  constructor(config: DataForgeEntityManagerConfig, configCache: Map<string, OrgEntityDefinition>) {
    this.config = config;
    this.configCache = configCache;
  }

  /**
   * Get entity configuration for rules engine
   */
  async getEntityConfig(orgId: string, entityName: string): Promise<any> {
    try {
      // Import EntityNameUtils for consistent name normalization
      const { EntityNameUtils } = await import('@/lib/entity-name-utils');
      
      // Normalize entity name to PascalCase for database lookup
      const normalizedEntityName = EntityNameUtils.toPascalCase(entityName);
      
      console.log(`[RecordManager] Getting entity config: ${normalizedEntityName} (original: ${entityName}) for org: ${orgId}`);
      
      // Get entity from entity_schemas table
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['entity_name', 'table_name', 'archetype', 'business_metadata'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', normalizedEntityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity) {
        console.log(`[RecordManager] Entity ${normalizedEntityName} not found for org ${orgId}`);
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
      console.error(`[RecordManager] Error getting entity config:`, error);
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

      // Get archetype definition to understand field types
      const { ArchetypeRegistry } = await import('../ArchetypeRegistry');
      const archetypeClass = ArchetypeRegistry.getArchetypeClass(config.archetype);
      
      // Get entity definition to understand custom fields
      const { getEntityDefinition } = await import('./entity-storage');
      const entityDef = await getEntityDefinition(this.config.kysely, orgId, entityName);
      
      let baseData: any;
      let customData: any = {};
      let relationshipData: any = {};
      
      // Separate relationship fields from data fields (archetype + custom)
      if (archetypeClass && archetypeClass.fields) {
        Object.entries(data).forEach(([fieldName, value]) => {
          const fieldDef = archetypeClass.fields[fieldName];
          if (fieldDef && (fieldDef.type === 'user_reference' || fieldDef.type === 'entity_reference')) {
            // This is an archetype relationship field - store for later processing
            relationshipData[fieldName] = value;
          }
        });
        
        // Remove archetype relationship fields from data to prevent column errors
        Object.keys(relationshipData).forEach(fieldName => {
          delete data[fieldName];
        });
      }
      
      // Handle custom relationship fields from entity definition
      if (entityDef && entityDef.customFields) {
        for (const customField of entityDef.customFields) {
          if (customField.type === 'custom_user_reference' || customField.type === 'custom_entity_reference') {
            if (data[customField.name] !== undefined) {
              relationshipData[customField.name] = data[customField.name];
              delete data[customField.name]; // Remove from data to prevent column errors
            } else if (customField.required) {
              // Check if required relationship field is missing
              return {
                success: false,
                errors: [`${customField.name}: Field '${customField.name}' is required`]
              };
            }
          }
        }
      }
      
      if (entityDef && entityDef.customFields && entityDef.customFields.length > 0) {
        // Use FieldManager to separate base and custom fields
        const { FieldManager } = await import('../services/FieldManager');
        const fieldManager = new FieldManager();
        
        // Convert custom fields array to map
        const customFieldsMap = new Map();
        for (const field of entityDef.customFields) {
          customFieldsMap.set(field.name, field);
        }
        
        // Extract custom field data
        const extracted = fieldManager.extractCustomFieldData(data, customFieldsMap);
        baseData = extracted.baseData;
        customData = extracted.customData;
      } else {
        // No custom fields defined, all data goes to base columns
        baseData = { ...data };
      }

      // Generate record ID
      const recordId = crypto.randomUUID();

      // Add system fields and archetype defaults to base data
      // NOTE: Don't add created_by here - it's a relationship field
      const saveData = {
        ...baseData,
        ...customData, // Custom fields are now real database columns, not JSONB
        id: recordId,
        organization_id: orgId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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

      // Validate data using complete field validation pipeline (archetype + custom fields)
      console.log(`🔍 [RecordManager] About to validate complete field set:`, { archetype: config.archetype, dataKeys: Object.keys(saveData), orgId });
      
      // Get all field definitions for this entity (archetype + custom)
      const allFieldDefinitions = new Map();
      
      // Add archetype field definitions
      const { ArchetypeOperations } = await import('../services/ArchetypeOperations');
      const archetypeOperations = new ArchetypeOperations({ env: this.config.env });
      const archetypeFields = await archetypeOperations.getArchetypeFields(config.archetype);
      Object.entries(archetypeFields).forEach(([name, config]: [string, any]) => {
        allFieldDefinitions.set(name, {
          name,
          type: config.type || 'text',
          required: config.required || false,
          defaultValue: config.defaultValue,
          unique: config.unique || false,
          indexed: config.indexed || false,
          min: config.min,
          max: config.max,
          enum: config.enum,
          regex: config.regex
        });
      });
      
      // Add custom field definitions from entity config (exclude relationship fields)
      if (entityDef && entityDef.customFields) {
        for (const customField of entityDef.customFields) {
          // Skip relationship fields - they are validated and processed separately
          if (customField.type === 'custom_user_reference' || customField.type === 'custom_entity_reference') {
            continue;
          }
          
          allFieldDefinitions.set(customField.name, {
            name: customField.name,
            type: customField.type,
            required: customField.required || false,
            defaultValue: customField.defaultValue,
            unique: customField.unique || false,
            indexed: customField.indexed || false,
            min: customField.min,
            max: customField.max,
            enum: customField.enum,
            regex: customField.regex
          });
        }
      }
      
      // Use FieldValidationPipeline directly with complete field set
      const { FieldValidationPipeline } = await import('../validation/FieldValidationPipeline');
      const pipeline = new FieldValidationPipeline();
      
      const validationResult = await pipeline.validate({
        data: saveData,
        fields: allFieldDefinitions,
        orgId,
        archetype: config.archetype
      });
      
      console.log(`🔍 [RecordManager] Complete validation result:`, { valid: validationResult.isValid, errors: validationResult.errors });
      
      // Convert validation result format
      const errors: string[] = [];
      
      if (!validationResult.isValid) {
        for (const error of validationResult.errors) {
          if (typeof error === 'string') {
            errors.push(error);
          } else if (error.message) {
            errors.push(`${error.field || 'Field'}: ${error.message}`);
          }
        }
      }
      
      if (errors.length > 0) {
        return {
          success: false,
          errors
        };
      }
      
      // Use the validated/transformed data
      const finalData = validationResult.transformedData || saveData;

      const result = await this.config.kysely
        .insertInto(config.tableName as any)
        .values(finalData as any)
        .returningAll()
        .executeTakeFirst();

      if (!result) {
        return { success: false, errors: ['Failed to create record'] };
      }

      // Note: Lore/canon documents are now created directly as Document entities
      // No auto-creation needed - documents use parent_entity_type/parent_entity_id relationships

      // Create relationship records for any relationship fields
      if (Object.keys(relationshipData).length > 0 || userId) {
        const { RelationshipFieldHandler } = await import('../services/RelationshipFieldHandler');
        
        // Add created_by relationship if userId provided
        if (userId) {
          relationshipData.created_by = userId;
        }
        
        for (const [fieldName, targetId] of Object.entries(relationshipData)) {
          if (targetId) { // Only create relationship if target ID is provided
            try {
              // Check if this is an archetype or custom relationship field
              let fieldDef = archetypeClass?.fields[fieldName];
              let fieldType = fieldDef?.type;
              
              // If not found in archetype, check custom fields
              if (!fieldDef && entityDef && entityDef.customFields) {
                const customField = entityDef.customFields.find(f => f.name === fieldName);
                if (customField) {
                  fieldDef = customField;
                  fieldType = customField.type;
                }
              }
              
              const relationshipDef = RelationshipFieldHandler.convertToRelationshipMetadata(
                fieldName,
                fieldType || 'user_reference',
                entityName,
                fieldDef
              );
              
              await RelationshipFieldHandler.createRelationship(
                this.config.kysely,
                orgId,
                entityName,
                recordId,
                relationshipDef,
                targetId,
                userId || 'system'
              );
            } catch (error) {
              console.warn(`Failed to create relationship ${fieldName}:`, error);
              // Don't fail the entire operation if relationship creation fails
            }
          }
        }
      }

      // Process rollup field updates if any relationships were created
      if (Object.keys(relationshipData).length > 0) {
        try {
          const { RollupEngine } = await import('../services/RollupEngine');
          const rollupEngine = new RollupEngine(this);
          
          // Refresh rollups for the newly created entity
          await rollupEngine.refreshEntityRollups(this.config.kysely, orgId, entityName, recordId);
          
          // Also refresh rollups for any target entities that might have rollup fields
          for (const [fieldName, targetId] of Object.entries(relationshipData)) {
            if (targetId) {
              try {
                const fieldDef = archetypeClass?.fields[fieldName] || 
                  entityDef?.customFields?.find(f => f.name === fieldName);
                
                if (fieldDef && fieldDef.targetEntityType) {
                  await rollupEngine.refreshEntityRollups(
                    this.config.kysely, 
                    orgId, 
                    fieldDef.targetEntityType, 
                    targetId
                  );
                }
              } catch (error) {
                console.warn(`Failed to refresh rollups for target entity ${targetId}:`, error);
              }
            }
          }
        } catch (error) {
          console.warn('Failed to process rollup updates:', error);
          // Don't fail the entire operation if rollup processing fails
        }
      }

      // Merge custom fields back into the response
      const responseData = { ...result };
      // Custom fields are now direct columns in the result, no need to merge from JSONB
      // No custom_fields JSONB column to clean up in new architecture

      return { success: true, data: responseData };
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
    console.log(`🔍 [RecordManager] updateRecord called:`, {
      orgId,
      entityName,
      recordId,
      updatesKeys: Object.keys(updates),
      updates: updates
    });

    // Filter out deprecated _resolved fields to prevent database errors
    // These fields were deprecated in September 2025 but may still exist in client-side data
    const filteredUpdates = Object.keys(updates).reduce((acc, key) => {
      if (key.endsWith('_resolved')) {
        console.log(`⚠️ [RecordManager] Filtering out deprecated _resolved field: ${key}`);
        return acc;
      }
      acc[key] = updates[key];
      return acc;
    }, {} as any);

    console.log(`🧹 [RecordManager] Filtered updates:`, {
      originalKeys: Object.keys(updates),
      filteredKeys: Object.keys(filteredUpdates),
      removedCount: Object.keys(updates).length - Object.keys(filteredUpdates).length
    });

    // Use filtered updates for the rest of the method
    updates = filteredUpdates;

    try {
      const config = await this.getEntityConfig(orgId, entityName);
      console.log(`⚙️ [RecordManager] Entity config:`, {
        hasConfig: !!config,
        tableName: config?.tableName
      });

      if (!config) {
        console.log(`❌ [RecordManager] Entity ${entityName} not found for org ${orgId}`);
        return { success: false, errors: [`Entity ${entityName} not found for org ${orgId}`] };
      }

      // Get entity definition to understand custom fields
      const { getEntityDefinition } = await import('./entity-storage');
      const entityDef = await getEntityDefinition(this.config.kysely, orgId, entityName);
      
      console.log(`📋 [RecordManager] Entity definition:`, {
        hasEntityDef: !!entityDef,
        customFieldsCount: entityDef?.customFields?.length || 0,
        customFields: entityDef?.customFields?.map(f => f.name) || []
      });
      
      let baseUpdates: any;
      let customUpdates: any = {};
      
      if (entityDef && entityDef.customFields && entityDef.customFields.length > 0) {
        // Use FieldManager to separate base and custom fields
        const { FieldManager } = await import('../services/FieldManager');
        const fieldManager = new FieldManager();
        
        // Convert custom fields array to map
        const customFieldsMap = new Map();
        for (const field of entityDef.customFields) {
          customFieldsMap.set(field.name, field);
        }
        
        console.log(`🔀 [RecordManager] Separating custom fields with FieldManager...`);
        
        // Extract custom field data
        const extracted = fieldManager.extractCustomFieldData(updates, customFieldsMap);
        baseUpdates = extracted.baseData;
        customUpdates = extracted.customData;

        console.log(`📊 [RecordManager] Field separation result:`, {
          baseUpdatesKeys: Object.keys(baseUpdates),
          customUpdatesKeys: Object.keys(customUpdates)
        });
      } else {
        // No custom fields defined, all data goes to base columns
        baseUpdates = { ...updates };
        console.log(`📊 [RecordManager] No custom fields, all data goes to base columns:`, {
          baseUpdatesKeys: Object.keys(baseUpdates)
        });
      }

      // Prepare update data
      const updateData: any = {
        ...baseUpdates,
        updated_at: new Date().toISOString()
      };

      console.log(`⚡ [RecordManager] Prepared update data:`, {
        updateDataKeys: Object.keys(updateData),
        updateData: updateData
      });

      // If there are custom field updates, add them directly as columns (new architecture)
      if (Object.keys(customUpdates).length > 0) {
        console.log(`📥 [RecordManager] Processing custom field updates as direct columns:`, customUpdates);
        
        // Custom fields are now real database columns, so we add them directly to updateData
        Object.assign(updateData, customUpdates);

        console.log(`🔄 [RecordManager] Custom fields added to update data as direct columns`);
      }

      // Remove system fields that shouldn't be updated
      delete updateData.id;
      delete updateData.organization_id;
      delete updateData.created_at;

      console.log(`🧹 [RecordManager] Final update data after cleanup:`, {
        finalKeys: Object.keys(updateData),
        finalData: updateData
      });

      console.log(`🚀 [RecordManager] Executing Kysely update query...`);

      const result = await this.config.kysely
        .updateTable(config.tableName as any)
        .set(updateData as any)
        .where('id', '=', recordId)
        .where('organization_id', '=', orgId)
        .returningAll()
        .executeTakeFirst();

      console.log(`📊 [RecordManager] Kysely update result:`, {
        hasResult: !!result,
        resultKeys: result ? Object.keys(result) : []
      });

      if (!result) {
        console.log(`❌ [RecordManager] No result from update query - record not found or no changes made`);
        return { success: false, errors: ['Record not found or no changes made'] };
      }

      // Merge custom fields back into the response
      const responseData = { ...result };
      // Custom fields are now direct columns in the result, no need to merge from JSONB
      console.log(`🔄 [RecordManager] Custom fields are already included as direct columns in result`);

      // No custom_fields JSONB column to clean up in new architecture

      console.log(`✅ [RecordManager] Update successful:`, {
        responseDataKeys: Object.keys(responseData)
      });

      return { success: true, data: responseData };
    } catch (error) {
      console.log(`💥 [RecordManager] Update failed with error:`, {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorObject: error
      });

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

      // Merge custom fields into the record
      let responseData = { ...result };
      // Custom fields are now direct columns in the result, no need to merge from JSONB
      // No custom_fields JSONB column to clean up in new architecture

      return { success: true, data: responseData };
    } catch (error) {
      return { 
        success: false, 
        errors: [`Failed to get record: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Query records with filtering, sorting, pagination, and reference resolution
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

      // Custom fields are now direct columns, no need to merge JSONB
      const mergedResults = results.map((record: any) => {
        // Custom fields are already included as direct columns in the record
        return { ...record };
      });

      // Resolve reference fields if requested
      if (options.resolveReferences && mergedResults.length > 0) {
        const { ReferenceResolver } = await import('../services/ReferenceResolver');
        const referenceResolver = new ReferenceResolver({ kysely: this.config.kysely });
        
        // Get reference field definitions from archetype or entity config
        const referenceFields: string[] = [];
        
        const { ArchetypeRegistry } = await import('../ArchetypeRegistry');
        const archetypeClass = ArchetypeRegistry.getArchetypeClass(config.archetype);
        
        if (archetypeClass?.fields) {
          for (const [fieldName, fieldConfig] of Object.entries(archetypeClass.fields)) {
            if (typeof fieldConfig === 'object' && 
                (fieldConfig.type === 'user_reference' || fieldConfig.type === 'entity_reference')) {
              referenceFields.push(fieldName);
            }
          }
        }

        const resolvedResults = await referenceResolver.resolveReferencesForRecords(
          orgId,
          entityName,
          mergedResults,
          referenceFields
        );

        return { success: true, data: resolvedResults, count: resolvedResults.length };
      }

      return { success: true, data: mergedResults, count: mergedResults.length };
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
      console.log(`[RecordManager] Getting entity details: ${entityName} for org: ${orgId}`);
      
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

      // Build simplified fields object for unified system
      const fields: Record<string, any> = {};
      if (metadata.allFields && Array.isArray(metadata.allFields)) {
        for (const field of metadata.allFields) {
          // Simplify field types to match actual usage
          let fieldType = field.type;
          
          // Convert complex field types to simple ones that match actual data
          if (fieldType === 'priority_set') {
            fieldType = 'text'; // Priority is stored as simple text like "high", "medium", "low"
          } else if (fieldType === 'status_set') {
            fieldType = 'text'; // Status is stored as simple text like "active", "completed", etc.
          } else if (fieldType === 'longtext') {
            fieldType = 'text'; // Simplify longtext to text
          }
          
          // Build rich field info for all fields
          const fieldInfo: any = {
            name: field.name,
            type: fieldType,
            required: field.required || false,
            description: field.description,
            defaultValue: field.defaultValue,
            unique: field.unique || false,
            indexed: field.indexed || false,
            min: field.min,
            max: field.max,
            enum: field.enum,
            regex: field.regex,
            maxLength: field.maxLength,
            minLength: field.minLength
          };

          // Add relationship-specific metadata
          if (fieldType === 'user_reference' || fieldType === 'entity_reference' || 
              fieldType === 'custom_user_reference' || fieldType === 'custom_entity_reference') {
            fieldInfo.relationshipType = field.relationshipType;
            fieldInfo.targetEntityType = field.targetEntityType;
            fieldInfo.cardinality = field.cardinality;
          }

          // Add rollup-specific metadata
          if (fieldType === 'rollup_concat' || fieldType === 'rollup_count' || 
              fieldType === 'rollup_sum' || fieldType === 'rollup_average') {
            fieldInfo.rollupConfig = field.rollupConfig;
          }

          // Add currency-specific metadata
          if (fieldType === 'currency') {
            fieldInfo.currencyConfig = field.currencyConfig;
          }

          // Clean up undefined values
          Object.keys(fieldInfo).forEach(key => {
            if (fieldInfo[key] === undefined) {
              delete fieldInfo[key];
            }
          });

          fields[field.name] = fieldInfo;
        }
      }

      return {
        success: true,
        data: {
          entityName: entity.entity_name,
          tableName: entity.table_name,
          archetype: entity.archetype,
          fieldCount: Object.keys(fields).length,
          fields: fields,
          createdAt: entity.created_at,
          updatedAt: entity.updated_at,
          syncable: metadata.syncable !== false
        }
      };
    } catch (error) {
      console.error(`[RecordManager] Error getting entity details:`, error);
      return {
        success: false,
        error: 'Failed to get entity details',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}