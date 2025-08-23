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
  extends: string;
  tableName: string;
  syncableFields: Record<string, FieldDefinition>;
}

export interface FieldDefinition {
  type: string;
  required?: boolean;
  syncable?: boolean;
  enum?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
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
   * Load schema for an organization with caching
   */
  async loadOrgSchema(orgId: string): Promise<SchemaLoadResult> {
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

      // Load schema from PostgreSQL-native Universal Archetype API (same as POC)
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/schema`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Schema loading failed: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      
      console.log('🔍 Schema client raw response:', rawData);
      
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

      // Transform array of entities into schema format
      const entities: Record<string, any> = {};
      
      schemaArray.forEach(entity => {
        entities[entity.entityName] = {
          tableName: entity.tableName,
          archetype: entity.archetype,
          syncableFields: {
            // Default fields that all entities have
            name: { type: 'text', required: true, syncable: true },
            description: { type: 'text', required: false, syncable: true },
            status: { type: 'text', required: false, syncable: true },
            created_at: { type: 'timestamp', required: false, syncable: false },
            updated_at: { type: 'timestamp', required: false, syncable: false }
          }
        };
      });

      const schema: OrgEntitySchema = {
        orgId: orgId,
        version: Date.now().toString(),
        entities
      };
      console.log('🔍 Schema client processed schema:', schema);
      
      // Cache the schema
      this.cacheSchema(orgId, schema);
      
      // Schema loaded - Legend State handles initialization automatically
      console.log('[Schema] ✅ Organization schema loaded - Legend State will handle initialization');

      return {
        success: true,
        schema: schema,
        cached: false
      };
    } catch (error) {
      console.error('Failed to load org schema:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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
   * Get all syncable fields for an entity
   */
  async getSyncableFields(orgId: string, entityName: string): Promise<Record<string, FieldDefinition> | null> {
    const entitySchema = await this.getEntitySchema(orgId, entityName);
    if (!entitySchema) {
      return null;
    }

    // Filter only syncable fields
    const syncableFields: Record<string, FieldDefinition> = {};
    for (const [fieldName, fieldDef] of Object.entries(entitySchema.syncableFields)) {
      if (fieldDef.syncable !== false) {
        syncableFields[fieldName] = fieldDef;
      }
    }

    return syncableFields;
  }

  /**
   * Generate form fields from entity schema
   */
  async generateFormFields(orgId: string, entityName: string): Promise<FormFieldConfig[]> {
    const syncableFields = await this.getSyncableFields(orgId, entityName);
    if (!syncableFields) {
      return [];
    }

    const formFields: FormFieldConfig[] = [];

    for (const [fieldName, fieldDef] of Object.entries(syncableFields)) {
      const formField: FormFieldConfig = {
        name: fieldName,
        label: this.generateFieldLabel(fieldName),
        type: this.mapFieldTypeToInputType(fieldDef.type),
        required: fieldDef.required || false,
        validation: fieldDef.validation
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
      
      console.log(`[Schema] Successfully created entity schema: ${entityData.name}`);
      return { success: true };
      
    } catch (error) {
      console.error('Failed to create entity schema:', error);
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
      
      console.log(`[Schema] Successfully soft deleted entity schema: ${entityName} (recoverable)`);
      return { 
        success: true, 
        softDeleted: result.softDeleted,
      };
      
    } catch (error) {
      console.error('Failed to delete entity schema:', error);
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
      
      console.log(`[Schema] Successfully restored entity schema: ${entityName}`);
      return { success: true };
      
    } catch (error) {
      console.error('Failed to restore entity schema:', error);
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
      
      console.log(`[Schema] Successfully permanently deleted entity schema: ${entityName} (irreversible)`);
      return { success: true };
      
    } catch (error) {
      console.error('Failed to permanently delete entity schema:', error);
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

      console.log(`[Schema] Successfully listed ${result.data.total} deleted entities`);
      return { 
        success: true,
        entities: result.data.entities
      };
      
    } catch (error) {
      console.error('Failed to list trash entities:', error);
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
      default: return 'text';
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
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Singleton instance
export const orgSchemaClient = new OrgSchemaClient();