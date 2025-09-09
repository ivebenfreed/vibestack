/**
 * Rollup Average Field Handler
 * 
 * Calculates average of numeric values from related records via relationships.
 * Stores average as decimal in database, updated automatically when relationships or target field values change.
 */

import type { FieldDefinition } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || 0;
}

export function validate(value: any, definition: FieldDefinition, context: any): { 
  valid: boolean; 
  errors: any[]; 
  transformedValue?: any; 
} {
  const errors: any[] = [];
  
  // Handle null/undefined - use default
  if (value == null || value === '') {
    return {
      valid: true,
      errors: [],
      transformedValue: 0
    };
  }

  // Convert to number
  let average: number;
  if (typeof value === 'string') {
    average = parseFloat(value);
    if (isNaN(average)) {
      errors.push({
        field: definition.name,
        code: 'INVALID_AVERAGE',
        message: `${definition.name} must be a valid number`,
        value
      });
      return { valid: false, errors };
    }
  } else if (typeof value === 'number') {
    average = value;
  } else {
    errors.push({
      field: definition.name,
      code: 'INVALID_TYPE',
      message: `${definition.name} must be a number`,
      value
    });
    return { valid: false, errors };
  }

  // Validate precision if specified
  if (definition.precision && typeof definition.precision === 'number') {
    const factor = Math.pow(10, definition.precision);
    average = Math.round(average * factor) / factor;
  }

  // Validate range if specified
  if (definition.min !== undefined && average < definition.min) {
    errors.push({
      field: definition.name,
      code: 'BELOW_MINIMUM',
      message: `${definition.name} must be at least ${definition.min}`,
      value: average,
      constraint: definition.min
    });
  }

  if (definition.max !== undefined && average > definition.max) {
    errors.push({
      field: definition.name,
      code: 'ABOVE_MAXIMUM',
      message: `${definition.name} must be at most ${definition.max}`,
      value: average,
      constraint: definition.max
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
        message: `Rollup average field ${definition.name} requires targetField in rollupConfig`,
        value: config
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: average
  };
}

export function getSqlType(definition: FieldDefinition): string {
  const precision = definition.precision || 4;
  const scale = definition.scale || precision;
  return `DECIMAL(15, ${scale})`; // Support decimal precision for averages
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue || 0;
  return String(defaultValue);
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
    type: 'average',
    relationshipType: definition.rollupConfig?.relationshipType || 'relates_to',
    targetEntityType: definition.rollupConfig?.targetEntityType,
    targetField: definition.rollupConfig?.targetField,
    conditions: definition.rollupConfig?.conditions || {},
    refreshTriggers: ['relationship_created', 'relationship_deleted', 'target_field_updated']
  };
}