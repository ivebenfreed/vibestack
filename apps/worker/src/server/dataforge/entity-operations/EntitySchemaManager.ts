/**
 * EntitySchemaManager - Handles entity schema operations
 * 
 * Manages creating, deleting, restoring entities and their schemas.
 * Handles entity lifecycle, trash management, and schema listing.
 */

import type { FieldDefinition } from '../json-rules-engine';
import type { OrgEntityDefinition } from '../org-entity-schema';
import { DDLGenerator } from '../DDLGenerator';

export interface DataForgeEntityManagerConfig {
  kysely: any; // Kysely instance
  rulesEngine?: any; // JsonRulesEngine instance  
  env?: any; // Cloudflare environment
}

export class EntitySchemaManager {
  private config: DataForgeEntityManagerConfig;
  private configCache: Map<string, OrgEntityDefinition>;

  constructor(config: DataForgeEntityManagerConfig, configCache: Map<string, OrgEntityDefinition>) {
    this.config = config;
    this.configCache = configCache;
  }

  /**
   * Generate background color from foreground color for badges
   */
  private getBackgroundColor(color: string): string {
    if (!color) return '#f3f4f6'; // Default gray background
    
    // Convert hex colors to light background variants
    const colorMap: Record<string, string> = {
      '#22c55e': '#dcfce7', // green
      '#10b981': '#d1fae5', // emerald  
      '#f59e0b': '#fef3c7', // yellow
      '#ef4444': '#fee2e2', // red
      '#dc2626': '#fee2e2', // dark red
      '#3b82f6': '#dbeafe', // blue
      '#8b5cf6': '#e5e7eb', // purple
      '#06b6d4': '#cffafe', // cyan
      '#6b7280': '#f3f4f6', // gray
    };
    
    return colorMap[color] || '#f3f4f6';
  }

  /**
   * Get entity configuration for rules engine (with caching)
   */
  async getEntityConfig(orgId: string, entityName: string): Promise<any> {
    try {
      // Import EntityNameUtils for consistent name normalization
      const { EntityNameUtils } = await import('@/lib/entity-name-utils');
      
      // Normalize entity name to PascalCase for database lookup
      const normalizedEntityName = EntityNameUtils.toPascalCase(entityName);
      
      // Check cache first
      const cacheKey = `${orgId}:${normalizedEntityName}`;
      if (this.configCache.has(cacheKey)) {
        const cached = this.configCache.get(cacheKey);
        console.log(`[EntitySchemaManager] Using cached entity config: ${normalizedEntityName}`);
        return {
          tableName: cached?.table_name,
          entityName: cached?.entity_name,
          archetype: cached?.archetype,
          orgId: orgId
        };
      }
      
      console.log(`[EntitySchemaManager] Getting entity config: ${normalizedEntityName} (original: ${entityName}) for org: ${orgId}`);
      
      // Get entity from entity_schemas table
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['entity_name', 'table_name', 'archetype', 'business_metadata'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', normalizedEntityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity) {
        console.log(`[EntitySchemaManager] Entity ${normalizedEntityName} not found for org ${orgId}`);
        return null;
      }

      // Cache the result
      this.configCache.set(cacheKey, {
        entity_name: entity.entity_name,
        table_name: entity.table_name,
        archetype: entity.archetype,
        business_metadata: entity.business_metadata
      });

      // Return configuration object for archetype entity validation
      return {
        tableName: entity.table_name,
        entityName: entity.entity_name,
        archetype: entity.archetype,
        orgId: orgId
      };
    } catch (error) {
      console.error(`[EntitySchemaManager] Error getting entity config:`, error);
      return null;
    }
  }

  /**
   * Create entity with archetype pattern and custom fields
   */
  async createEntity(
    orgId: string,
    entityName: string,
    archetype: string,
    customFields: FieldDefinition[] = [],
    options: any = {}
  ): Promise<any> {
    try {
      // Import required modules
      const { fieldManager } = await import('../services/FieldManager');
      const { EntityNameUtils } = await import('@/lib/entity-name-utils');
      
      // Normalize entity name using EntityNameUtils
      const normalizedEntityName = EntityNameUtils.toPascalCase(entityName);
      
      // For table name, convert to storage format (snake_case)
      const tableBaseName = EntityNameUtils.toStorageFormat(entityName);
      
      console.log(`[EntitySchemaManager] Creating entity: ${normalizedEntityName} (${archetype}) for org: ${orgId}`);
      
      // Check if entity with this name already exists
      const existingEntity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['entity_name', 'deleted'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', normalizedEntityName)
        .executeTakeFirst();
      
      if (existingEntity) {
        const status = existingEntity.deleted ? 'soft-deleted' : 'active';
        return {
          success: false,
          errors: [`Entity "${normalizedEntityName}" already exists (${status}). Please choose a different name or permanently delete the existing entity first.`]
        };
      }
      
      // Convert customFields to array format if needed
      let customFieldsArray: any[] = [];
      if (Array.isArray(customFields)) {
        customFieldsArray = customFields;
      } else if (customFields && typeof customFields === 'object') {
        customFieldsArray = Object.entries(customFields).map(([name, config]) => ({
          name,
          ...(typeof config === 'object' ? config : { type: 'text', defaultValue: config })
        }));
      }
      
      // Validate custom fields against archetype
      const validation = await fieldManager.validateCustomFields(customFieldsArray, archetype);
      if (!validation.success) {
        return {
          success: false,
          errors: validation.errors
        };
      }
      
      // Merge fields with proper conflict resolution
      const mergedFields = await fieldManager.mergeFieldDefinitions(
        archetype,
        customFieldsArray,
        {
          conflictStrategy: 'prefix',
          customFieldPrefix: 'custom',
          validateTypes: true,
          preserveArchetypeDefaults: true
        }
      );
      
      // Get system fields that all tables need
      const systemFields = await this.getArchetypeFields('base_system');
      
      // Get base fields for table creation - combine system fields with archetype fields
      const baseFieldsForTable: Record<string, any> = {};
      
      // First add system fields
      for (const [fieldName, fieldDef] of Object.entries(systemFields)) {
        baseFieldsForTable[fieldName] = fieldDef;
      }
      
      // Then add archetype-specific fields
      for (const [name, field] of mergedFields.baseFields) {
        baseFieldsForTable[name] = field;
      }
      
      // Add custom fields as real database columns (not JSONB)
      for (const [name, field] of mergedFields.customFields) {
        baseFieldsForTable[name] = field;
      }
      
      console.log('[EntitySchemaManager] Creating table with base fields + custom fields as real columns');
      console.log('[EntitySchemaManager] Base fields count:', mergedFields.baseFields.size);
      console.log('[EntitySchemaManager] Custom fields count:', mergedFields.customFields.size);
      
      // Generate table name
      const fullTableName = DDLGenerator.generateTableName(orgId, tableBaseName);
      
      // Validate table name
      const tableValidation = DDLGenerator.validateTableName(fullTableName);
      if (!tableValidation.valid) {
        return {
          success: false,
          errors: [`Invalid table name: ${tableValidation.error}`]
        };
      }
      
      // Generate DDL using DDLGenerator with base fields only (custom fields go in JSONB)
      // Note: DDLGenerator now automatically filters out relationship fields
      const ddl = DDLGenerator.generateCreateTableDDL(fullTableName, baseFieldsForTable, orgId);
      
      console.log('[EntitySchemaManager] Generated DDL:', ddl);
      console.log('[EntitySchemaManager] All fields:', JSON.stringify(baseFieldsForTable, null, 2));
      
      // Collect relationship fields for processing
      const relationshipFields: Array<{name: string, type: string}> = [];
      Object.entries(baseFieldsForTable).forEach(([fieldName, field]) => {
        if (field.type === 'user_reference' || field.type === 'entity_reference') {
          relationshipFields.push({ name: fieldName, type: field.type });
        }
      });
      
      // Execute DDL
      try {
        await this.config.kysely.executeQuery({
          sql: ddl,
          parameters: []
        });
        
        // Set replica identity to FULL to support UPDATE operations with logical replication
        const replicaIdentityDDL = DDLGenerator.generateSetReplicaIdentityDDL(fullTableName);
        console.log('[EntitySchemaManager] Setting replica identity:', replicaIdentityDDL);
        
        await this.config.kysely.executeQuery({
          sql: replicaIdentityDDL,
          parameters: []
        });
        
        // Process relationship fields if any exist
        if (relationshipFields.length > 0) {
          console.log('[EntitySchemaManager] Processing relationship fields:', relationshipFields);
          const { RelationshipFieldHandler } = await import('../services/RelationshipFieldHandler');
          
          for (const relField of relationshipFields) {
            const relationshipDef = RelationshipFieldHandler.convertToRelationshipMetadata(
              relField.name,
              relField.type,
              normalizedEntityName
            );
            
            // Store relationship field configuration
            await RelationshipFieldHandler.storeRelationshipFieldConfig(
              this.config.kysely,
              orgId,
              normalizedEntityName,
              relationshipDef
            );
            
            console.log(`[EntitySchemaManager] Configured relationship field: ${relField.name} as ${relationshipDef.relationshipType}`);
          }
        }
      } catch (sqlError: any) {
        console.error('[EntitySchemaManager] SQL execution error:', sqlError);
        console.error('[EntitySchemaManager] Failed SQL:', ddl);
        throw sqlError;
      }
      
      // Store entity definition with separated fields
      const entityDefinition = {
        archetype,
        baseFields: Array.from(mergedFields.baseFields.values()),
        customFields: Array.from(mergedFields.customFields.values()),
        allFields: Array.from(mergedFields.allFields.values()),
        version: '2.0' // New field management version
      };
      
      // Store in entity_schemas with complete field information
      const { storeEntityDefinition } = await import('./entity-storage');
      await storeEntityDefinition(this.config.kysely, orgId, normalizedEntityName, entityDefinition, fullTableName);
      
      console.log(`[EntitySchemaManager] Successfully created entity: ${fullTableName}`);
      
      // Auto-copy system option templates to custom options for new archetype
      try {
        const { ArchetypeOptionsManager } = await import('../services/ArchetypeOptionsManager');
        await ArchetypeOptionsManager.ensureArchetypeOptions(this.config.kysely, orgId, archetype);
        console.log(`[EntitySchemaManager] Auto-copied system option templates for archetype: ${archetype}`);
      } catch (error) {
        console.warn(`[EntitySchemaManager] Failed to auto-copy system options for archetype ${archetype}:`, error);
        // Don't fail entity creation if option copying fails
      }
      
      // Register rollup fields for automatic calculation
      try {
        const { RollupEngine } = await import('../services/RollupEngine');
        const rollupEngine = new RollupEngine(this);
        
        const rollupConfigs = await rollupEngine.registerRollupFields(
          orgId, 
          normalizedEntityName, 
          mergedFields.allFields
        );
        
        if (rollupConfigs.length > 0) {
          console.log(`[EntitySchemaManager] Registered ${rollupConfigs.length} rollup fields for entity: ${normalizedEntityName}`);
        }
      } catch (error) {
        console.warn(`[EntitySchemaManager] Failed to register rollup fields for entity ${normalizedEntityName}:`, error);
        // Don't fail entity creation if rollup registration fails
      }
      
      // Register computed fields for automatic calculation
      try {
        const { ComputedFieldEngine } = await import('../services/ComputedFieldEngine');
        const computedFieldEngine = new ComputedFieldEngine(this);
        const computedConfigs = await computedFieldEngine.registerComputedFields(
          orgId, 
          normalizedEntityName, 
          mergedFields.allFields
        );
        
        if (computedConfigs.length > 0) {
          console.log(`[EntitySchemaManager] Registered ${computedConfigs.length} computed fields for entity: ${normalizedEntityName}`);
        }
      } catch (error) {
        console.warn(`[EntitySchemaManager] Failed to register computed fields for entity ${normalizedEntityName}:`, error);
        // Don't fail entity creation if computed field registration fails
      }
      
      return {
        success: true,
        data: {
          entityName: normalizedEntityName,
          tableName: fullTableName,
          archetype,
          orgId,
          fields: {
            base: entityDefinition.baseFields,
            custom: entityDefinition.customFields,
            total: entityDefinition.allFields.length
          }
        },
        immediate: true
      };
    } catch (error) {
      console.error(`[EntitySchemaManager] Failed to create entity:`, error);
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

    // Special case for just getting system fields
    if (archetype === 'base_system') {
      return baseFields;
    }

    // Import and use the appropriate archetype class
    try {
      switch (archetype) {
        // REMOVED: universe and world are now core business logic, not DataForge archetypes
        // NOTE: 'universe' and 'world' are now hardcoded system entities with dedicated APIs
        // They are no longer user-configurable archetypes
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
      console.log(`[EntitySchemaManager] Soft deleting entity: ${entityName} for org: ${orgId} (data preserved for recovery)`);
      
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

      // Clear cache entry
      const cacheKey = `${orgId}:${entityName}`;
      this.configCache.delete(cacheKey);

      return {
        success: true,
        message: `Entity ${entityName} has been moved to trash (data preserved for recovery)`,
        softDeleted: true,
        tableName: entity.tableName,
        recoverable: true
      };
    } catch (error) {
      console.error(`[EntitySchemaManager] Error deleting entity:`, error);
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
      console.log(`[EntitySchemaManager] Restoring entity from trash: ${entityName} for org: ${orgId}`);
      
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

      // Clear cache entry (it will be repopulated on next access)
      const cacheKey = `${orgId}:${entityName}`;
      this.configCache.delete(cacheKey);

      return {
        success: true,
        message: `Entity ${entityName} has been restored from trash`,
        restored: true,
        tableName: entity.tableName,
        deletedAt: entity.deleted_at
      };
    } catch (error) {
      console.error(`[EntitySchemaManager] Error restoring entity:`, error);
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
      console.log(`[EntitySchemaManager] Permanently deleting entity: ${entityName} and its table`);
      
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

      // Clear cache entry
      const cacheKey = `${orgId}:${entityName}`;
      this.configCache.delete(cacheKey);

      return {
        success: true,
        message: `Entity ${entityName} and all its data have been permanently deleted`,
        permanentlyDeleted: true,
        tableName: entity.tableName,
        warning: 'This action cannot be undone'
      };
    } catch (error) {
      console.error(`[EntitySchemaManager] Error permanently deleting entity:`, error);
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
      console.log(`[EntitySchemaManager] Listing trash for org: ${orgId}`);
      
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
      console.error(`[EntitySchemaManager] Error listing trash:`, error);
      return {
        success: false,
        error: 'Failed to list deleted entities',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get schema for an organization (list of entities with their definitions)
   */
  async getSchema(orgId: string): Promise<any> {
    try {
      console.log(`[EntitySchemaManager] Getting enhanced schema for org: ${orgId}`);
      
      const entities = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['entity_name', 'archetype', 'table_name', 'business_metadata', 'created_at', 'updated_at'])
        .where('org_id', '=', orgId)
        .where('deleted', '!=', true)
        .execute();

      console.log(`[EntitySchemaManager] Found ${entities.length} entities from database`);
      console.log(`[EntitySchemaManager] Entity names:`, entities.map((e: any) => e.entity_name).sort());

      // Import field handler for enhanced processing
      const { getEnhancedFieldHandler } = await import('../fields');

      const enhancedSchema = await Promise.all(entities.map(async (entity: any) => {
        try {
          // Get the stored entity definition
          let storedFields: any[] = [];
          if (entity.business_metadata?.allFields) {
            storedFields = entity.business_metadata.allFields;
          } else if (entity.business_metadata?.baseFields && entity.business_metadata?.customFields) {
            storedFields = [...entity.business_metadata.baseFields, ...entity.business_metadata.customFields];
          } else {
            // Fallback: get archetype fields for older entities
            const archetypeFields = await this.getArchetypeFields(entity.archetype);
            storedFields = Object.values(archetypeFields);
          }

          // Process each field through enhanced field handlers
          const enhancedFields = await Promise.all(storedFields.map(async (field: any) => {
            try {
              const handler = getEnhancedFieldHandler(field.type);
              
              // Extract all enhanced metadata
              let enhancedField = {
                name: field.name,
                type: field.type,
                required: field.required || false,
                defaultValue: handler.getDefaultValue ? handler.getDefaultValue(field) : field.defaultValue,
                
                // Enhanced metadata from handlers
                validation: handler.getValidationMetadata ? handler.getValidationMetadata(field) : {},
                display: handler.getDisplayMetadata ? handler.getDisplayMetadata(field) : {},
                editor: handler.getEditorMetadata ? handler.getEditorMetadata(field) : {},
                capabilities: handler.getCapabilities ? handler.getCapabilities() : {},
                accessibility: handler.getAccessibilityMetadata ? handler.getAccessibilityMetadata(field) : {},
                
                // Include original field definition
                ...field
              };

              // Special handling for field set fields (priority, status, etc.)
              if (field.isFieldSet && field.fieldSetType && field.fieldSetRef) {
                try {
                  // Load options from the options API (using same query as options endpoint)
                  const options = await this.config.kysely
                    .selectFrom('custom_options')
                    .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
                    .select([
                      'custom_options.value as option_key', 
                      'custom_options.label', 
                      'custom_options.description', 
                      'custom_options.color', 
                      'custom_options.icon', 
                      'custom_options.sort_order'
                    ])
                    .where('custom_option_sets.org_id', '=', orgId)
                    .where('custom_option_sets.option_set_type', '=', field.fieldSetType)
                    .where('custom_options.is_active', '=', true)
                    .orderBy('custom_options.sort_order', 'asc')
                    .orderBy('custom_options.label', 'asc')
                    .execute();

                  if (options.length > 0) {
                    // Populate editor metadata with options and colors
                    enhancedField.editor = {
                      type: 'select',
                      searchable: false,
                      clearable: false,
                      showValidationOnBlur: true,
                      options: options.map((opt: any) => ({
                        value: opt.option_key,
                        label: opt.label,
                        color: opt.color,
                        backgroundColor: this.getBackgroundColor(opt.color),
                        icon: opt.icon,
                        description: opt.description
                      }))
                    };

                    // Also populate validation enum values
                    enhancedField.validation = {
                      ...enhancedField.validation,
                      enum: options.map((opt: any) => opt.option_key)
                    };
                  }
                } catch (optionsError) {
                  console.warn(`[EntitySchemaManager] Failed to load options for field ${field.name}:`, optionsError);
                }
              }

              return enhancedField;
            } catch (fieldError) {
              console.warn(`[EntitySchemaManager] Failed to enhance field ${field.name}:`, fieldError);
              // Return original field if enhancement fails
              return field;
            }
          }));

          return {
            entityName: entity.entity_name,
            archetype: entity.archetype,
            tableName: entity.table_name,
            businessMetadata: entity.business_metadata,
            createdAt: entity.created_at,
            updatedAt: entity.updated_at,
            
            // Enhanced field definitions with metadata
            fields: enhancedFields,
            fieldCount: enhancedFields.length
          };
        } catch (entityError) {
          console.error(`[EntitySchemaManager] Failed to enhance entity ${entity.entity_name}:`, entityError);
          // Return basic entity info if enhancement fails
          return {
            entityName: entity.entity_name,
            archetype: entity.archetype,
            tableName: entity.table_name,
            businessMetadata: entity.business_metadata,
            createdAt: entity.created_at,
            updatedAt: entity.updated_at,
            fields: [],
            fieldCount: 0
          };
        }
      }));

      console.log(`[EntitySchemaManager] Enhanced schema with field metadata for ${enhancedSchema.length} entities`);

      return { success: true, data: enhancedSchema };
    } catch (error) {
      console.error(`[EntitySchemaManager] Error getting enhanced schema:`, error);
      return {
        success: false,
        error: 'Failed to get enhanced schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all entities for an organization
   */
  async listEntities(orgId: string): Promise<any> {
    try {
      console.log(`[EntitySchemaManager] Listing entities for org: ${orgId}`);
      
      const entities = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['entity_name as entityName', 'table_name as tableName', 'archetype', 'created_at', 'updated_at'])
        .where('org_id', '=', orgId)
        .where('deleted', '!=', true)
        .execute();

      console.log(`[EntitySchemaManager] Found ${entities.length} entities`);

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
      console.error(`[EntitySchemaManager] Error listing entities:`, error);
      return {
        success: false,
        error: 'Failed to list entities',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}