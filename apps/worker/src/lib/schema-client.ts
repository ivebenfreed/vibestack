import { uiLog } from '@/logger';
const log = uiLog('lib/schema-client.ts');
/**
 * Client-Side Schema Loading
 * 
 * Loads organization-specific entity schemas from the server API.
 * Provides caching and real-time updates for dynamic entity schemas.
 */

export interface OrgEntitySchema {
  orgId: string;
  entities: Record<string, EntityDefinition>;
  version: string;
}

export interface EntityDefinition {
  archetype: string;
  tableName: string;
  syncableFields: Record<string, FieldDefinition>;
  customFields?: Record<string, FieldDefinition>;
  relationshipFields?: Record<string, RelationshipFieldDefinition>;
  allFields?: Record<string, FieldDefinition>;
  businessMetadata?: any;
}

export interface FieldDefinition {
  type: string;
  required?: boolean;
  syncable?: boolean;
  enum?: string[];
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface RelationshipFieldDefinition {
  name: string;
  type: 'user_reference' | 'entity_reference';
  relationshipType?: string;
  targetEntityType?: string;
  cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  properties?: Record<string, any>;
}

export interface SchemaLoadResult {
  success: boolean;
  schema?: OrgEntitySchema;
  error?: string;
  cached?: boolean;
}

export class OrgSchemaClient {
  private cache = new Map<string, { schema: OrgEntitySchema; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly BASE_URL = '/api/dataforge';


  /**
   * Load schema for an organization with caching and retry logic
   */
  async loadOrgSchema(orgId: string, maxRetries: number = 3): Promise<SchemaLoadResult> {
    try {
      // Check cache first
      const cached = this.getCachedSchema(orgId);
      if (cached) {
        return {
          success: true,
          schema: cached,
          cached: true
        };
      }

      // Retry logic with exponential backoff
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Add delay for retries (exponential backoff)
          if (attempt > 0) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
            log.info(`Retrying schema load for ${orgId} after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          // Load schema from PostgreSQL-native Universal Archetype API (same as POC)
          const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/schema`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (!response.ok) {
            throw new Error(`Schema loading failed: ${response.status} ${response.statusText}`);
          }

          // If we got here, the request succeeded - continue with normal processing
          const rawData = await response.json();
          
          log.info('🔍 Schema client raw response:', rawData);
          
          // Handle the new API format - check if it's the wrapped response format
          let schemaArray: any[];
          if (rawData && typeof rawData === 'object' && 'success' in rawData) {
            if (!rawData.success) {
              return {
                success: false,
                error: rawData.error || 'Server returned error'
              };
            }
            schemaArray = rawData.schema;
          } else if (Array.isArray(rawData)) {
            // Legacy format - direct array
            schemaArray = rawData;
          } else {
            return {
              success: false,
              error: 'Invalid schema format: expected wrapped response or array of entities'
            };
          }

          if (!Array.isArray(schemaArray)) {
            return {
              success: false,
              error: 'Invalid schema format: schema field must be an array'
            };
          }

          // Continue with the rest of the processing (moving it here)
          const processedSchema = this.processSchemaResponse(orgId, schemaArray);
          
          // Cache the result
          this.cache.set(orgId, {
            schema: processedSchema,
            timestamp: Date.now()
          });

          return {
            success: true,
            schema: processedSchema
          };
          
        } catch (error) {
          lastError = error as Error;
          log.error(`Schema loading attempt ${attempt + 1} failed for org ${orgId}:`, error);
          
          // If it's a network error and we have more retries, continue
          if (attempt < maxRetries - 1 && 
              (error instanceof TypeError || // Network errors
               (error as any)?.message?.includes('fetch'))) {
            continue;
          }
          // Otherwise, throw the error
          throw error;
        }
      }

      // If we exhausted all retries, throw the last error
      throw lastError || new Error('Schema loading failed after all retries');
      
    } catch (error) {
      log.error('Failed to load org schema:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process the schema response into the expected format with relationship support
   */
  private processSchemaResponse(orgId: string, schemaArray: any[]): OrgEntitySchema {
    // Transform array of entities into schema format
    const entities: Record<string, any> = {};
    
    schemaArray.forEach(entity => {
        // Extract complete entity definition from businessMetadata
        const businessMetadata = entity.businessMetadata || {};
        
        // Process fields from the actual server response structure
        const fields = businessMetadata.fields || [];
        
        // Separate fields by category based on field type for enhanced schema structure
        const syncableFields: Record<string, FieldDefinition> = {};
        const customFieldsMap: Record<string, FieldDefinition> = {};
        const relationshipFieldsMap: Record<string, RelationshipFieldDefinition> = {};
        
        // Process all fields and categorize them based on type
        fields.forEach((field: any) => {
          // Check if this is a relationship field
          if (field.type === 'user_reference' || field.type === 'entity_reference') {
            const relationshipDef: RelationshipFieldDefinition = {
              name: field.name,
              type: field.type as 'user_reference' | 'entity_reference',
              relationshipType: field.relationshipType || field.type,
              targetEntityType: field.targetEntityType,
              cardinality: field.cardinality || 'many-to-one',
              properties: field.properties || {}
            };
            
            relationshipFieldsMap[field.name] = relationshipDef;
          } else {
            // Regular syncable field
            const fieldDef: FieldDefinition = {
              type: field.type,
              required: field.required || false,
              syncable: field.syncable !== false,
              enum: field.enum || field.enumOptions?.map((opt: any) => opt.value) || undefined,
              defaultValue: field.defaultValue || undefined,
              validation: field.validation || undefined
            };
            
            syncableFields[field.name] = fieldDef;
            
            // For now, treat all non-relationship fields as syncable
            // In the future, we could distinguish based on metadata flags
          }
        });
        
        // Add default timestamp fields if not already present
        if (!syncableFields.created_at) {
          syncableFields.created_at = { type: 'timestamp', required: false, syncable: false };
        }
        if (!syncableFields.updated_at) {
          syncableFields.updated_at = { type: 'timestamp', required: false, syncable: false };
        }

        log.info('🔍 Processing entity with enhanced structure:', {
          entityName: entity.entityName,
          tableName: entity.tableName,
          archetype: entity.archetype,
          syncableFieldCount: Object.keys(syncableFields).length,
          customFieldCount: Object.keys(customFieldsMap).length,
          relationshipFieldCount: Object.keys(relationshipFieldsMap).length
        });
        
        entities[entity.entityName] = {
          tableName: entity.tableName,
          archetype: entity.archetype,
          syncableFields,
          customFields: customFieldsMap,
          relationshipFields: relationshipFieldsMap,
          allFields: { ...syncableFields, ...customFieldsMap },
          businessMetadata
        };
      });

      const schema: OrgEntitySchema = {
        orgId: orgId,
        version: Date.now().toString(),
        entities
      };
      
      log.info('🔍 Schema client processed schema:', schema);
      
      return schema;
  }

  /**
   * Get schema for specific entity
   */
  async getEntitySchema(orgId: string, entityName: string): Promise<EntityDefinition | null> {
    const result = await this.loadOrgSchema(orgId);
    if (!result.success || !result.schema) {
      return null;
    }

    return result.schema.entities[entityName] || null;
  }

  /**
   * Get all syncable fields for an entity (excludes relationship fields)
   */
  async getSyncableFields(orgId: string, entityName: string): Promise<Record<string, FieldDefinition> | null> {
    const entitySchema = await this.getEntitySchema(orgId, entityName);
    if (!entitySchema) {
      return null;
    }

    // Filter only syncable fields (these are real database columns)
    const syncableFields: Record<string, FieldDefinition> = {};
    for (const [fieldName, fieldDef] of Object.entries(entitySchema.syncableFields)) {
      if (fieldDef.syncable !== false) {
        syncableFields[fieldName] = fieldDef;
      }
    }

    return syncableFields;
  }

  /**
   * Get custom fields for an entity (real database columns added by user)
   */
  async getCustomFields(orgId: string, entityName: string): Promise<Record<string, FieldDefinition> | null> {
    const entitySchema = await this.getEntitySchema(orgId, entityName);
    if (!entitySchema) {
      return null;
    }

    return entitySchema.customFields || {};
  }

  /**
   * Get relationship fields for an entity (stored in relationship tables)
   */
  async getRelationshipFields(orgId: string, entityName: string): Promise<Record<string, RelationshipFieldDefinition> | null> {
    const entitySchema = await this.getEntitySchema(orgId, entityName);
    if (!entitySchema) {
      return null;
    }

    return entitySchema.relationshipFields || {};
  }

  /**
   * Get all fields including relationships for complete entity definition
   */
  async getAllFields(orgId: string, entityName: string): Promise<{
    syncableFields: Record<string, FieldDefinition>;
    customFields: Record<string, FieldDefinition>;
    relationshipFields: Record<string, RelationshipFieldDefinition>;
  } | null> {
    const entitySchema = await this.getEntitySchema(orgId, entityName);
    if (!entitySchema) {
      return null;
    }

    return {
      syncableFields: entitySchema.syncableFields,
      customFields: entitySchema.customFields || {},
      relationshipFields: entitySchema.relationshipFields || {}
    };
  }

  /**
   * Generate form fields from entity schema (includes relationship fields)
   */
  async generateFormFields(orgId: string, entityName: string): Promise<FormFieldConfig[]> {
    const allFieldData = await this.getAllFields(orgId, entityName);
    if (!allFieldData) {
      return [];
    }

    const formFields: FormFieldConfig[] = [];

    // Process syncable fields (real database columns)
    for (const [fieldName, fieldDef] of Object.entries(allFieldData.syncableFields)) {
      if (fieldDef.syncable !== false) {
        const formField: FormFieldConfig = {
          name: fieldName,
          label: this.generateFieldLabel(fieldName),
          type: this.mapFieldTypeToInputType(fieldDef.type),
          required: fieldDef.required || false,
          validation: fieldDef.validation,
          fieldCategory: 'syncable'
        };

        // Add enum options if available
        if (fieldDef.enum) {
          formField.options = fieldDef.enum.map(value => ({
            value,
            label: this.generateOptionLabel(value)
          }));
        }

        formFields.push(formField);
      }
    }

    // Process custom fields (user-added database columns)
    for (const [fieldName, fieldDef] of Object.entries(allFieldData.customFields)) {
      const formField: FormFieldConfig = {
        name: fieldName,
        label: this.generateFieldLabel(fieldName),
        type: this.mapFieldTypeToInputType(fieldDef.type),
        required: fieldDef.required || false,
        validation: fieldDef.validation,
        fieldCategory: 'custom'
      };

      // Add enum options if available
      if (fieldDef.enum) {
        formField.options = fieldDef.enum.map(value => ({
          value,
          label: this.generateOptionLabel(value)
        }));
      }

      formFields.push(formField);
    }

    // Process relationship fields (stored in relationship tables)
    for (const [fieldName, relationshipDef] of Object.entries(allFieldData.relationshipFields)) {
      const formField: FormFieldConfig = {
        name: fieldName,
        label: this.generateFieldLabel(fieldName),
        type: this.mapRelationshipTypeToInputType(relationshipDef.type),
        required: false, // Relationships are typically optional
        fieldCategory: 'relationship',
        relationshipType: relationshipDef.relationshipType,
        targetEntityType: relationshipDef.targetEntityType,
        cardinality: relationshipDef.cardinality
      };

      formFields.push(formField);
    }

    return formFields;
  }

  /**
   * Validate data against entity schema
   */
  async validateEntityData(orgId: string, entityName: string, data: any): Promise<ValidationResult> {
    const entitySchema = await this.getEntitySchema(orgId, entityName);
    if (!entitySchema) {
      return {
        valid: false,
        errors: [`Entity schema not found: ${entityName}`]
      };
    }

    const errors: string[] = [];
    const syncableFields = entitySchema.syncableFields;

    // Validate required fields
    for (const [fieldName, fieldDef] of Object.entries(syncableFields)) {
      if (fieldDef.required && (data[fieldName] === undefined || data[fieldName] === null || data[fieldName] === '')) {
        errors.push(`Field ${fieldName} is required`);
      }

      // Validate field types
      if (data[fieldName] !== undefined && data[fieldName] !== null) {
        const typeError = this.validateFieldType(fieldName, data[fieldName], fieldDef);
        if (typeError) {
          errors.push(typeError);
        }
      }

      // Validate enums
      if (fieldDef.enum && data[fieldName] && !fieldDef.enum.includes(data[fieldName])) {
        errors.push(`Field ${fieldName} must be one of: ${fieldDef.enum.join(', ')}`);
      }

      // Validate patterns
      if (fieldDef.validation?.pattern && data[fieldName]) {
        const regex = new RegExp(fieldDef.validation.pattern);
        if (!regex.test(data[fieldName])) {
          errors.push(`Field ${fieldName} does not match required pattern`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Clear cache for organization
   */
  clearCache(orgId?: string): void {
    if (orgId) {
      this.cache.delete(orgId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Preload schemas for multiple organizations
   */
  async preloadSchemas(orgIds: string[]): Promise<void> {
    await Promise.all(orgIds.map(orgId => this.loadOrgSchema(orgId)));
  }

  /**
   * Add fields to an existing entity
   */
  async addFields(orgId: string, entityName: string, fields: any[]): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities/${entityName}/fields`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ fields })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Add fields failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error adding fields'
        };
      }

      // Clear cache to force reload of schema on next access
      this.clearCache(orgId);
      
      log.info(`[Schema] Successfully added ${fields.length} fields to entity: ${entityName}`);
      return { success: true };
      
    } catch (error) {
      log.error('Failed to add fields to entity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove field from an existing entity
   */
  async removeField(orgId: string, entityName: string, fieldName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities/${entityName}/fields/${fieldName}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Remove field failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error removing field'
        };
      }

      // Clear cache to force reload of schema on next access
      this.clearCache(orgId);
      
      log.info(`[Schema] Successfully removed field '${fieldName}' from entity: ${entityName}`);
      return { success: true };
      
    } catch (error) {
      log.error('Failed to remove field from entity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new entity schema
   */
  async createEntitySchema(orgId: string, entityData: any): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(entityData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Create failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error creating entity schema'
        };
      }

      // Clear cache to force reload of schema on next access
      this.clearCache(orgId);
      
      log.info(`[Schema] Successfully created entity schema: ${entityData.name}`);
      return { success: true };
      
    } catch (error) {
      log.error('Failed to create entity schema:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Soft delete an entity schema (move to trash, preserving data)
   */
  async deleteEntitySchema(orgId: string, entityName: string): Promise<{ success: boolean; error?: string; softDeleted?: boolean }> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities/${entityName}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error deleting entity schema'
        };
      }

      // Clear cache to force reload of schema on next access
      this.clearCache(orgId);
      
      log.info(`[Schema] Successfully soft deleted entity schema: ${entityName} (recoverable)`);
      return { 
        success: true, 
        softDeleted: result.softDeleted,
      };
      
    } catch (error) {
      log.error('Failed to delete entity schema:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Restore an entity schema from trash
   */
  async restoreEntitySchema(orgId: string, entityName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities/${entityName}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Restore failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error restoring entity schema'
        };
      }

      // Clear cache to force reload of schema on next access
      this.clearCache(orgId);
      
      log.info(`[Schema] Successfully restored entity schema: ${entityName}`);
      return { success: true };
      
    } catch (error) {
      log.error('Failed to restore entity schema:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Permanently delete an entity schema and its data (empty trash)
   */
  async permanentlyDeleteEntitySchema(orgId: string, entityName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities/${entityName}/permanent`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Permanent delete failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error permanently deleting entity schema'
        };
      }

      // Clear cache to force reload of schema on next access
      this.clearCache(orgId);
      
      log.info(`[Schema] Successfully permanently deleted entity schema: ${entityName} (irreversible)`);
      return { success: true };
      
    } catch (error) {
      log.error('Failed to permanently delete entity schema:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List deleted entity schemas (trash)
   */
  async listTrashEntities(orgId: string): Promise<{ success: boolean; entities?: any[]; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities/trash`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `List trash failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error listing trash'
        };
      }

      log.info(`[Schema] Successfully listed ${result.data.total} deleted entities`);
      return { 
        success: true,
        entities: result.data.entities
      };
      
    } catch (error) {
      log.error('Failed to list trash entities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods

  private getCachedSchema(orgId: string): OrgEntitySchema | null {
    const cached = this.cache.get(orgId);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(orgId);
      return null;
    }

    return cached.schema;
  }

  private cacheSchema(orgId: string, schema: OrgEntitySchema): void {
    const timestamp = Date.now();
    
    // Cache in memory
    this.cache.set(orgId, {
      schema,
      timestamp
    });
    
    // 🚀 OPTIMIZED: Also cache in localStorage for faster app startup
    try {
      const cacheKey = `vibestack-schema-${orgId}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        schema,
        timestamp
      }));
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  private generateFieldLabel(fieldName: string): string {
    // Convert camelCase to Title Case
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private generateOptionLabel(value: string): string {
    // Convert kebab-case or snake_case to Title Case
    return value
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  private mapFieldTypeToInputType(fieldType: string): string {
    switch (fieldType) {
      case 'string': return 'text';
      case 'number': return 'number';
      case 'boolean': return 'checkbox';
      case 'text': return 'textarea';
      case 'array': return 'select';
      case 'date': return 'date';
      case 'datetime': return 'datetime-local';
      case 'email': return 'email';
      case 'url': return 'url';
      case 'json': return 'textarea';
      case 'jsonb': return 'textarea';
      default: return 'text';
    }
  }

  private mapRelationshipTypeToInputType(relationshipType: 'user_reference' | 'entity_reference'): string {
    switch (relationshipType) {
      case 'user_reference': return 'user-select';
      case 'entity_reference': return 'entity-select';
      default: return 'select';
    }
  }

  private validateFieldType(fieldName: string, value: any, fieldDef: FieldDefinition): string | null {
    switch (fieldDef.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `Field ${fieldName} must be a string`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' && !isNaN(Number(value))) {
          return `Field ${fieldName} must be a number`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Field ${fieldName} must be a boolean`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return `Field ${fieldName} must be an array`;
        }
        break;
    }
    return null;
  }
}

// Types for form generation
export interface FormFieldConfig {
  name: string;
  label: string;
  type: string;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
  options?: Array<{
    value: string;
    label: string;
  }>;
  fieldCategory?: 'syncable' | 'custom' | 'relationship';
  relationshipType?: string;
  targetEntityType?: string;
  cardinality?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Singleton instance
export const orgSchemaClient = new OrgSchemaClient();