/**
 * Unified Schema Transformer
 * 
 * Provides consistent data transformation between different schema formats:
 * - Entity creation API format
 * - PostgreSQL business_metadata storage format  
 * - RuntimeSchemaGenerator format
 * - Client sync format
 * 
 * This ensures all pipelines use the same data transformations and field definitions.
 */

export interface UnifiedFieldDefinition {
  name: string;
  type: string;
  required: boolean;
  syncable: boolean;
  serverOnly: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
  enum?: string[];
}

export interface UnifiedEntityDefinition {
  name: string;
  tableName: string;
  archetype: string;
  fields: UnifiedFieldDefinition[];
  description?: string;
  syncable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoredBusinessMetadata {
  fields: Record<string, {
    type: string;
    required: boolean;
    syncable: boolean;
    serverOnly: boolean;
    defaultValue?: any;
    validation?: any;
    enum?: string[];
  }>;
  description: string;
  syncable: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientSyncableFields {
  [fieldName: string]: {
    type: string;
    required?: boolean;
    syncable?: boolean;
    enum?: string[];
    validation?: {
      pattern?: string;
      min?: number;
      max?: number;
    };
  };
}

export class UnifiedSchemaTransformer {

  /**
   * Convert API definition to unified format
   */
  static fromApiDefinition(apiDefinition: any): UnifiedEntityDefinition {
    const fields: UnifiedFieldDefinition[] = (apiDefinition.fields || []).map((field: any) => ({
      name: field.name,
      type: field.type,
      required: field.required || false,
      syncable: field.syncable !== false,
      serverOnly: field.serverOnly || false,
      defaultValue: field.defaultValue,
      validation: field.validation,
      enum: field.enum
    }));

    return {
      name: apiDefinition.name,
      tableName: apiDefinition.tableName,
      archetype: apiDefinition.archetype,
      fields,
      description: apiDefinition.description,
      syncable: apiDefinition.syncable !== false,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Convert unified format to business metadata for PostgreSQL storage
   */
  static toBusinessMetadata(unified: UnifiedEntityDefinition): StoredBusinessMetadata {
    const fields: Record<string, any> = {};
    
    unified.fields.forEach(field => {
      fields[field.name] = {
        type: field.type,
        required: field.required,
        syncable: field.syncable,
        serverOnly: field.serverOnly,
        defaultValue: field.defaultValue,
        validation: field.validation,
        enum: field.enum
      };
    });

    return {
      fields,
      description: unified.description || `Entity created via DataForge API`,
      syncable: unified.syncable,
      createdAt: unified.createdAt || new Date().toISOString(),
      updatedAt: unified.updatedAt
    };
  }

  /**
   * Convert stored business metadata back to unified format
   */
  static fromBusinessMetadata(
    entityName: string,
    tableName: string, 
    archetype: string,
    metadata: StoredBusinessMetadata
  ): UnifiedEntityDefinition {
    const fields: UnifiedFieldDefinition[] = Object.entries(metadata.fields || {}).map(([name, fieldDef]) => ({
      name,
      type: fieldDef.type,
      required: fieldDef.required || false,
      syncable: fieldDef.syncable !== false,
      serverOnly: fieldDef.serverOnly || false,
      defaultValue: fieldDef.defaultValue,
      validation: fieldDef.validation,
      enum: fieldDef.enum
    }));

    return {
      name: entityName,
      tableName,
      archetype,
      fields,
      description: metadata.description,
      syncable: metadata.syncable !== false,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt
    };
  }

  /**
   * Convert unified format to RuntimeSchemaGenerator format
   */
  static toSchemaGeneratorFormat(unified: UnifiedEntityDefinition): any {
    return {
      name: unified.name,
      tableName: unified.tableName,
      archetype: unified.archetype,
      fields: unified.fields.map(field => ({
        name: field.name,
        type: field.type,
        required: field.required,
        defaultValue: field.defaultValue,
        // Include all properties that RuntimeSchemaGenerator needs
        syncable: field.syncable,
        serverOnly: field.serverOnly,
        validation: field.validation,
        enum: field.enum
      }))
    };
  }

  /**
   * Convert unified format to client syncable fields format
   */
  static toClientSyncableFields(unified: UnifiedEntityDefinition): ClientSyncableFields {
    const syncableFields: ClientSyncableFields = {};
    
    unified.fields
      .filter(field => field.syncable && !field.serverOnly)
      .forEach(field => {
        syncableFields[field.name] = {
          type: field.type,
          required: field.required,
          syncable: field.syncable,
          enum: field.enum,
          validation: field.validation
        };
      });

    return syncableFields;
  }

  /**
   * Add system fields that are automatically added to all tables
   */
  static addSystemFields(unified: UnifiedEntityDefinition): UnifiedEntityDefinition {
    const systemFields: UnifiedFieldDefinition[] = [
      {
        name: 'id',
        type: 'uuid',
        required: true,
        syncable: true,
        serverOnly: false
      },
      {
        name: 'organization_id',
        type: 'text',
        required: true,
        syncable: false,
        serverOnly: true
      },
      {
        name: 'created_by',
        type: 'uuid',
        required: false,
        syncable: false,
        serverOnly: true
      },
      {
        name: 'created_at',
        type: 'datetime',
        required: true,
        syncable: true,
        serverOnly: false,
        defaultValue: 'NOW()'
      },
      {
        name: 'updated_at',
        type: 'datetime',
        required: true,
        syncable: true,
        serverOnly: false,
        defaultValue: 'NOW()'
      }
    ];

    return {
      ...unified,
      fields: [...systemFields, ...unified.fields]
    };
  }

  /**
   * Get complete field definition for table creation (including system fields)
   */
  static getCompleteFieldDefinition(unified: UnifiedEntityDefinition): UnifiedEntityDefinition {
    return this.addSystemFields(unified);
  }

  /**
   * Validate field consistency between stored and generated formats
   */
  static validateFieldConsistency(
    stored: StoredBusinessMetadata, 
    generated: UnifiedEntityDefinition
  ): { isConsistent: boolean; issues: string[] } {
    const issues: string[] = [];
    const storedFieldNames = Object.keys(stored.fields || {});
    const generatedFieldNames = generated.fields
      .filter(f => !['id', 'organization_id', 'created_by', 'created_at', 'updated_at'].includes(f.name))
      .map(f => f.name);

    // Check for missing fields
    const missingInGenerated = storedFieldNames.filter(name => !generatedFieldNames.includes(name));
    const missingInStored = generatedFieldNames.filter(name => !storedFieldNames.includes(name));

    if (missingInGenerated.length > 0) {
      issues.push(`Fields missing in generated schema: ${missingInGenerated.join(', ')}`);
    }

    if (missingInStored.length > 0) {
      issues.push(`Fields missing in stored schema: ${missingInStored.join(', ')}`);
    }

    // Check field type consistency
    for (const fieldName of storedFieldNames) {
      const storedField = stored.fields[fieldName];
      const generatedField = generated.fields.find(f => f.name === fieldName);
      
      if (generatedField && storedField.type !== generatedField.type) {
        issues.push(`Type mismatch for field '${fieldName}': stored='${storedField.type}', generated='${generatedField.type}'`);
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  }
}