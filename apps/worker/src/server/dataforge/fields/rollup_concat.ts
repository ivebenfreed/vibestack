/**
 * Rollup Concat Field Handler
 * 
 * Concatenates text values from related records via relationships. Stores as text in database,
 * updated automatically when relationships or target field values change.
 */

import type { FieldDefinition } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || '';
}

export function validate(value: any, definition: FieldDefinition, context: any): { 
  valid: boolean; 
  errors: any[]; 
  transformedValue?: any; 
} {
  const errors: any[] = [];
  
  // Handle null/undefined - use default
  if (value == null) {
    return {
      valid: true,
      errors: [],
      transformedValue: ''
    };
  }

  // Convert to string
  let concatenated: string;
  if (typeof value === 'string') {
    concatenated = value;
  } else {
    concatenated = String(value);
  }

  // Validate length constraints
  if (definition.maxLength && concatenated.length > definition.maxLength) {
    errors.push({
      field: definition.name,
      code: 'TEXT_TOO_LONG',
      message: `${definition.name} cannot exceed ${definition.maxLength} characters`,
      value: concatenated,
      constraint: definition.maxLength,
      actualLength: concatenated.length
    });
  }

  if (definition.minLength && concatenated.length < definition.minLength) {
    errors.push({
      field: definition.name,
      code: 'TEXT_TOO_SHORT',
      message: `${definition.name} must be at least ${definition.minLength} characters`,
      value: concatenated,
      constraint: definition.minLength,
      actualLength: concatenated.length
    });
  }

  // Validate rollup configuration
  if (!definition.rollupConfig) {
    errors.push({
      field: definition.name,
      code: 'MISSING_ROLLUP_CONFIG',
      message: `Rollup field ${definition.name} requires rollupConfig`,
      value
    });
  } else {
    const config = definition.rollupConfig;
    if (!config.relationshipType) {
      errors.push({
        field: definition.name,
        code: 'MISSING_RELATIONSHIP_TYPE',
        message: `Rollup field ${definition.name} requires relationshipType in rollupConfig`,
        value: config
      });
    }
    
    if (!config.targetEntityType) {
      errors.push({
        field: definition.name,
        code: 'MISSING_TARGET_ENTITY',
        message: `Rollup field ${definition.name} requires targetEntityType in rollupConfig`,
        value: config
      });
    }
    
    if (!config.targetField) {
      errors.push({
        field: definition.name,
        code: 'MISSING_TARGET_FIELD',
        message: `Rollup concat field ${definition.name} requires targetField in rollupConfig`,
        value: config
      });
    }

    // Validate separator if specified
    const separator = config.separator;
    if (separator && typeof separator !== 'string') {
      errors.push({
        field: definition.name,
        code: 'INVALID_SEPARATOR',
        message: `Rollup concat separator must be a string`,
        value: separator
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: concatenated
  };
}

export function getSqlType(definition: FieldDefinition): string {
  // Use TEXT for unlimited length, or VARCHAR with specific limit
  if (definition.maxLength && definition.maxLength <= 255) {
    return `VARCHAR(${definition.maxLength})`;
  }
  return 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue;
  if (defaultValue !== undefined) {
    return `'${String(defaultValue).replace(/'/g, "''")}'`; // Escape single quotes
  }
  return "''"; // Empty string default
}

/**
 * Check if this is a rollup field type
 */
export function isRollupField(): boolean {
  return true;
}

/**
 * Get rollup configuration for this field
 */
export function getRollupConfig(definition: FieldDefinition): any {
  return {
    type: 'concat',
    relationshipType: definition.rollupConfig?.relationshipType || 'relates_to',
    targetEntityType: definition.rollupConfig?.targetEntityType,
    targetField: definition.rollupConfig?.targetField,
    separator: definition.rollupConfig?.separator || ', ',
    conditions: definition.rollupConfig?.conditions || {},
    refreshTriggers: ['relationship_created', 'relationship_deleted', 'target_field_updated']
  };
}