/**
 * FieldManager Service
 * 
 * Centralized field management for DataForge API.
 * Handles base archetype fields, custom fields, validation, 
 * defaults, and conflict resolution.
 */

import type { ArchetypeType } from '../ArchetypeRegistry';
import { ArchetypeRegistry } from '../ArchetypeRegistry';

export interface FieldDefinition {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: any;
  syncable?: boolean;
  serverOnly?: boolean;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  description?: string;
  validation?: any;
}

export interface CustomFieldDefinition extends FieldDefinition {
  source: 'custom';
  addedBy?: string;
  addedAt?: Date;
  version?: string;
}

export interface BaseFieldDefinition extends FieldDefinition {
  source: 'archetype';
  archetype: ArchetypeType;
}

export interface FieldConflict {
  fieldName: string;
  type: 'name_collision' | 'type_mismatch' | 'constraint_conflict';
  baseField: FieldDefinition;
  customField: FieldDefinition;
  resolution?: 'reject' | 'prefix' | 'override' | 'merge';
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings?: string[];
  processedFields?: Map<string, FieldDefinition>;
}

export interface MergedFieldSet {
  baseFields: Map<string, BaseFieldDefinition>;
  customFields: Map<string, CustomFieldDefinition>;
  allFields: Map<string, FieldDefinition>;
  conflicts: FieldConflict[];
  metadata: {
    archetype: ArchetypeType;
    totalFields: number;
    baseFieldCount: number;
    customFieldCount: number;
    hasConflicts: boolean;
  };
}

export type ConflictStrategy = 'reject' | 'prefix' | 'override' | 'merge';

export interface FieldMergeOptions {
  conflictStrategy: ConflictStrategy;
  customFieldPrefix?: string;
  validateTypes?: boolean;
  preserveArchetypeDefaults?: boolean;
}

export class FieldManager {
  private baseFieldCache: Map<ArchetypeType, Map<string, BaseFieldDefinition>> = new Map();
  private customFieldRegistry: Map<string, Map<string, CustomFieldDefinition>> = new Map();

  /**
   * Get base fields for an archetype with caching
   */
  async getArchetypeFields(archetype: ArchetypeType): Promise<Map<string, BaseFieldDefinition>> {
    if (this.baseFieldCache.has(archetype)) {
      return this.baseFieldCache.get(archetype)!;
    }

    const archetypeClass = ArchetypeRegistry.getArchetypeClass(archetype);
    if (!archetypeClass) {
      throw new Error(`Unknown archetype: ${archetype}`);
    }

    const fields = new Map<string, BaseFieldDefinition>();
    const baseFields = archetypeClass.getFieldsArray();

    for (const field of baseFields) {
      fields.set(field.name, {
        ...field,
        source: 'archetype',
        archetype
      });
    }

    this.baseFieldCache.set(archetype, fields);
    return fields;
  }

  /**
   * Validate custom fields against base archetype fields
   */
  async validateCustomFields(
    customFields: FieldDefinition[], 
    archetype: ArchetypeType
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const processedFields = new Map<string, FieldDefinition>();
    
    const baseFields = await this.getArchetypeFields(archetype);

    for (const field of customFields) {
      // Check field name validity
      if (!this.isValidFieldName(field.name)) {
        errors.push(`Invalid field name: ${field.name}. Must be alphanumeric with underscores only.`);
        continue;
      }

      // Check for base field collisions
      if (baseFields.has(field.name)) {
        const baseField = baseFields.get(field.name)!;
        errors.push(
          `Custom field '${field.name}' conflicts with ${archetype} archetype field. ` +
          `Base field type: ${baseField.type}`
        );
        continue;
      }

      // Validate field type
      if (!this.isValidFieldType(field.type)) {
        errors.push(`Invalid field type '${field.type}' for field '${field.name}'`);
        continue;
      }

      // Validate enum fields
      if (field.type === 'enum' && (!field.enum || field.enum.length === 0)) {
        errors.push(`Enum field '${field.name}' must specify enum values`);
        continue;
      }

      // Validate constraints
      const constraintErrors = this.validateFieldConstraints(field);
      if (constraintErrors.length > 0) {
        errors.push(...constraintErrors);
        continue;
      }

      // Check for reserved field names
      if (this.isReservedFieldName(field.name)) {
        warnings.push(`Field '${field.name}' uses a reserved name pattern. Consider renaming.`);
      }

      processedFields.set(field.name, field);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      processedFields
    };
  }

  /**
   * Detect conflicts between base and custom fields
   */
  detectConflicts(
    baseFields: Map<string, BaseFieldDefinition>,
    customFields: FieldDefinition[]
  ): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    for (const customField of customFields) {
      if (baseFields.has(customField.name)) {
        const baseField = baseFields.get(customField.name)!;
        
        // Name collision
        conflicts.push({
          fieldName: customField.name,
          type: 'name_collision',
          baseField,
          customField
        });

        // Type mismatch (if somehow the same name got through)
        if (baseField.type !== customField.type) {
          conflicts.push({
            fieldName: customField.name,
            type: 'type_mismatch',
            baseField,
            customField
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Merge base and custom fields with conflict resolution
   */
  async mergeFieldDefinitions(
    archetype: ArchetypeType,
    customFields: FieldDefinition[],
    options: FieldMergeOptions = { conflictStrategy: 'reject' }
  ): Promise<MergedFieldSet> {
    const baseFields = await this.getArchetypeFields(archetype);
    const conflicts = this.detectConflicts(baseFields, customFields);
    
    const customFieldMap = new Map<string, CustomFieldDefinition>();
    const allFields = new Map<string, FieldDefinition>();

    // Add all base fields first
    for (const [name, field] of baseFields) {
      allFields.set(name, field);
    }

    // Process custom fields based on conflict strategy
    for (const customField of customFields) {
      const conflict = conflicts.find(c => c.fieldName === customField.name);
      
      if (conflict) {
        switch (options.conflictStrategy) {
          case 'reject':
            // Don't add conflicting fields
            break;
          
          case 'prefix':
            // Add with prefix
            const prefixedName = `${options.customFieldPrefix || 'custom'}_${customField.name}`;
            const prefixedField: CustomFieldDefinition = {
              ...customField,
              name: prefixedName,
              source: 'custom'
            };
            customFieldMap.set(prefixedName, prefixedField);
            allFields.set(prefixedName, prefixedField);
            break;
          
          case 'override':
            // Override base field (dangerous!)
            const overrideField: CustomFieldDefinition = {
              ...customField,
              source: 'custom'
            };
            customFieldMap.set(customField.name, overrideField);
            allFields.set(customField.name, overrideField);
            break;
          
          case 'merge':
            // Merge properties (keep base, add custom properties)
            const baseField = baseFields.get(customField.name)!;
            const mergedField: FieldDefinition = {
              ...baseField,
              ...customField,
              type: baseField.type, // Always keep base type
              required: baseField.required || customField.required,
              source: 'archetype' // Keep as archetype field
            };
            allFields.set(customField.name, mergedField);
            break;
        }
      } else {
        // No conflict, add custom field
        const customFieldDef: CustomFieldDefinition = {
          ...customField,
          source: 'custom'
        };
        customFieldMap.set(customField.name, customFieldDef);
        allFields.set(customField.name, customFieldDef);
      }
    }

    return {
      baseFields,
      customFields: customFieldMap,
      allFields,
      conflicts,
      metadata: {
        archetype,
        totalFields: allFields.size,
        baseFieldCount: baseFields.size,
        customFieldCount: customFieldMap.size,
        hasConflicts: conflicts.length > 0
      }
    };
  }

  /**
   * Apply field defaults properly (archetype defaults first, then custom)
   */
  async applyFieldDefaults(
    data: any,
    archetype: ArchetypeType,
    customFields?: Map<string, CustomFieldDefinition>
  ): Promise<any> {
    const result = { ...data };
    
    // Get archetype class for defaults
    const archetypeClass = ArchetypeRegistry.getArchetypeClass(archetype);
    if (!archetypeClass) {
      throw new Error(`Unknown archetype: ${archetype}`);
    }

    // Apply archetype defaults first
    const archetypeDefaults = archetypeClass.getFieldDefaults();
    for (const [fieldName, defaultValue] of Object.entries(archetypeDefaults)) {
      if (result[fieldName] === undefined || result[fieldName] === null) {
        result[fieldName] = defaultValue;
      }
    }

    // Apply custom field defaults (if they don't override archetype fields)
    if (customFields) {
      for (const [fieldName, field] of customFields) {
        if (field.defaultValue !== undefined && 
            (result[fieldName] === undefined || result[fieldName] === null)) {
          result[fieldName] = field.defaultValue;
        }
      }
    }

    return result;
  }

  /**
   * Resolve field defaults with proper precedence
   */
  resolveDefaults(
    archetype: ArchetypeType,
    providedData: any,
    customFields: Map<string, CustomFieldDefinition>
  ): any {
    // Precedence: provided data > custom defaults > archetype defaults
    const resolved = { ...providedData };
    
    // Get archetype defaults
    const archetypeClass = ArchetypeRegistry.getArchetypeClass(archetype);
    const archetypeDefaults = archetypeClass?.getFieldDefaults() || {};
    
    // Apply in reverse precedence order
    for (const [field, value] of Object.entries(archetypeDefaults)) {
      if (resolved[field] === undefined) {
        resolved[field] = value;
      }
    }
    
    for (const [field, def] of customFields) {
      if (resolved[field] === undefined && def.defaultValue !== undefined) {
        resolved[field] = def.defaultValue;
      }
    }
    
    return resolved;
  }

  /**
   * Validate field name format
   */
  private isValidFieldName(name: string): boolean {
    // Must start with letter, can contain letters, numbers, underscores
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * Check if field name is reserved
   */
  private isReservedFieldName(name: string): boolean {
    const reserved = [
      'id', 'created_at', 'updated_at', 'deleted_at',
      'organization_id', 'version', '_id', '_rev'
    ];
    return reserved.includes(name.toLowerCase());
  }

  /**
   * Validate field type
   */
  private isValidFieldType(type: string): boolean {
    const validTypes = [
      'text', 'longtext', 'rich_text', 'number', 'decimal', 'integer',
      'boolean', 'date', 'datetime', 'email', 'url', 'json', 'enum',
      'status_option', 'priority_option', 'category_option',
      'discussion_type_option', 'user_reference', 'entity_reference'
    ];
    return validTypes.includes(type);
  }

  /**
   * Validate field constraints
   */
  private validateFieldConstraints(field: FieldDefinition): string[] {
    const errors: string[] = [];

    // Number constraints
    if ((field.type === 'number' || field.type === 'integer' || field.type === 'decimal')) {
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        errors.push(`Field '${field.name}': min (${field.min}) cannot be greater than max (${field.max})`);
      }
    }

    // String constraints
    if ((field.type === 'text' || field.type === 'longtext')) {
      if (field.minLength !== undefined && field.maxLength !== undefined && 
          field.minLength > field.maxLength) {
        errors.push(`Field '${field.name}': minLength (${field.minLength}) cannot be greater than maxLength (${field.maxLength})`);
      }
    }

    // Pattern validation
    if (field.pattern) {
      try {
        new RegExp(field.pattern);
      } catch (e) {
        errors.push(`Field '${field.name}': invalid regex pattern '${field.pattern}'`);
      }
    }

    return errors;
  }

  /**
   * Extract custom fields from data for storage in custom_fields JSONB
   */
  extractCustomFieldData(
    data: any,
    customFields: Map<string, CustomFieldDefinition>
  ): { baseData: any; customData: any } {
    const baseData = { ...data };
    const customData: any = {};

    for (const [fieldName] of customFields) {
      if (fieldName in baseData) {
        customData[fieldName] = baseData[fieldName];
        delete baseData[fieldName];
      }
    }

    return { baseData, customData };
  }

  /**
   * Clear caches (useful for testing or when schemas change)
   */
  clearCache(): void {
    this.baseFieldCache.clear();
    this.customFieldRegistry.clear();
  }
}

// Export singleton instance
export const fieldManager = new FieldManager();