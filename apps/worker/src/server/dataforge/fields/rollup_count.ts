/**
 * Rollup Count Field Handler
 * 
 * Counts related records via relationships. Stores count as integer in database,
 * updated automatically when relationships change.
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

  // Convert to integer
  let count: number;
  if (typeof value === 'string') {
    count = parseInt(value, 10);
    if (isNaN(count)) {
      errors.push({
        field: definition.name,
        code: 'INVALID_COUNT',
        message: `${definition.name} must be a valid number`,
        value
      });
      return { valid: false, errors };
    }
  } else if (typeof value === 'number') {
    count = Math.floor(value); // Ensure integer
  } else {
    errors.push({
      field: definition.name,
      code: 'INVALID_TYPE',
      message: `${definition.name} must be a number`,
      value
    });
    return { valid: false, errors };
  }

  // Validate non-negative
  if (count < 0) {
    errors.push({
      field: definition.name,
      code: 'NEGATIVE_COUNT',
      message: `${definition.name} cannot be negative`,
      value: count
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
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: count
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'INTEGER';
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
    type: 'count',
    relationshipType: definition.rollupConfig?.relationshipType || 'relates_to',
    targetEntityType: definition.rollupConfig?.targetEntityType,
    conditions: definition.rollupConfig?.conditions || {},
    refreshTriggers: ['relationship_created', 'relationship_deleted']
  };
}