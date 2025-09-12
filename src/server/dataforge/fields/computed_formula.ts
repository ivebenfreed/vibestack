/**
 * Computed Formula Field Handler
 * 
 * Handles expression-based computed fields that evaluate mathematical and logical expressions.
 * Uses backend computation for data-intensive calculations and complex expressions.
 */

import type { FieldDefinition } from '../types';

export interface ComputedFieldConfig {
  expression: string;
  dependencies: string[];
  computeLocation: 'backend' | 'frontend' | 'hybrid';
  refreshTriggers: string[];
  resultType: 'number' | 'text' | 'boolean' | 'date' | 'json';
  precision?: number; // For decimal results
  cacheResults: boolean;
  description?: string;
}

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || null;
}

export function validate(value: any, definition: FieldDefinition, context: any): { 
  valid: boolean; 
  errors: any[]; 
  transformedValue?: any; 
} {
  const errors: any[] = [];
  
  // Validate the field definition has required expression (either direct or in computedConfig)
  const expression = definition.expression || definition.computedConfig?.expression;
  const dependencies = definition.dependencies || definition.computedConfig?.dependencies || [];
  const computeLocation = definition.computeLocation || definition.computedConfig?.computeLocation || 'backend';
  const resultType = definition.resultType || definition.computedConfig?.resultType || 'number';
  const refreshTriggers = definition.refreshTriggers || definition.computedConfig?.refreshTriggers || [];
  const cacheResults = definition.cacheResults !== undefined ? definition.cacheResults : (definition.computedConfig?.cacheResults !== undefined ? definition.computedConfig.cacheResults : true);
  
  if (!expression) {
    errors.push({
      field: definition.name,
      code: 'MISSING_EXPRESSION',
      message: `Computed field '${definition.name}' must have expression property`
    });
    return { valid: false, errors };
  }

  const config = {
    expression,
    dependencies,
    computeLocation,
    resultType,
    refreshTriggers,
    cacheResults,
    precision: definition.precision || definition.computedConfig?.precision,
    description: definition.description || definition.computedConfig?.description
  } as ComputedFieldConfig;
  
  // Validate expression exists
  if (!expression || typeof expression !== 'string') {
    errors.push({
      field: definition.name,
      code: 'INVALID_EXPRESSION',
      message: `Computed field '${definition.name}' must have a valid expression string`
    });
  }

  // Validate result type
  const validTypes = ['number', 'text', 'boolean', 'date', 'json'];
  if (!config.resultType || !validTypes.includes(config.resultType)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_RESULT_TYPE',
      message: `Computed field result type must be one of: ${validTypes.join(', ')}`
    });
  }

  // Validate compute location
  const validLocations = ['backend', 'frontend', 'hybrid'];
  if (!config.computeLocation || !validLocations.includes(config.computeLocation)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_COMPUTE_LOCATION',
      message: `Compute location must be one of: ${validLocations.join(', ')}`
    });
  }

  // For stored values, validate the computed result
  if (value !== null && value !== undefined) {
    // Basic type validation based on result type
    switch (config.resultType) {
      case 'number':
        if (typeof value !== 'number' && !Number.isFinite(Number(value))) {
          errors.push({
            field: definition.name,
            code: 'INVALID_NUMBER_RESULT',
            message: `Computed field '${definition.name}' result must be a number`,
            value
          });
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            field: definition.name,
            code: 'INVALID_BOOLEAN_RESULT',
            message: `Computed field '${definition.name}' result must be a boolean`,
            value
          });
        }
        break;
      case 'text':
        // Text can be any type that converts to string
        break;
      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          errors.push({
            field: definition.name,
            code: 'INVALID_DATE_RESULT',
            message: `Computed field '${definition.name}' result must be a valid date`,
            value
          });
        }
        break;
    }
  }

  // Required field validation
  if (definition.required && (value == null || value === '')) {
    errors.push({
      field: definition.name,
      code: 'REQUIRED',
      message: `${definition.name} is required`
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: value
  };
}

export function getSqlType(definition: FieldDefinition): string {
  const config = definition.computedConfig as ComputedFieldConfig;
  if (!config) return 'TEXT';

  switch (config.resultType) {
    case 'number':
      return config.precision ? `DECIMAL(15,${config.precision})` : 'DECIMAL(15,4)';
    case 'boolean':
      return 'BOOLEAN';
    case 'date':
      return 'TIMESTAMP';
    case 'json':
      return 'JSONB';
    case 'text':
    default:
      return 'TEXT';
  }
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const config = definition.computedConfig as ComputedFieldConfig;
  
  if (definition.defaultValue !== undefined) {
    const defaultVal = definition.defaultValue;
    
    // Handle different result types
    switch (config?.resultType) {
      case 'number':
        return String(Number(defaultVal) || 0);
      case 'boolean':
        return String(Boolean(defaultVal)).toLowerCase();
      case 'text':
        return `'${String(defaultVal).replace(/'/g, "''")}'`;
      case 'date':
        return `'${new Date(defaultVal).toISOString()}'`;
      case 'json':
        return `'${JSON.stringify(defaultVal)}'::jsonb`;
      default:
        return `'${String(defaultVal).replace(/'/g, "''")}'`;
    }
  }
  
  return definition.required ? null : 'NULL';
}

/**
 * Check if this field is a computed field that needs special processing
 */
export function isComputedField(): boolean {
  return true;
}

/**
 * Get the computed field configuration for processing by ComputedFieldEngine
 */
export function getComputedConfig(definition: FieldDefinition): ComputedFieldConfig | null {
  const expression = definition.expression || definition.computedConfig?.expression;
  if (!expression) return null;
  
  return {
    expression,
    dependencies: definition.dependencies || definition.computedConfig?.dependencies || [],
    computeLocation: definition.computeLocation || definition.computedConfig?.computeLocation || 'backend',
    resultType: definition.resultType || definition.computedConfig?.resultType || 'number',
    refreshTriggers: definition.refreshTriggers || definition.computedConfig?.refreshTriggers || [],
    cacheResults: definition.cacheResults !== undefined ? definition.cacheResults : (definition.computedConfig?.cacheResults !== undefined ? definition.computedConfig.cacheResults : true),
    precision: definition.precision || definition.computedConfig?.precision,
    description: definition.description || definition.computedConfig?.description
  };
}

/**
 * Determine if this field should trigger recalculation of other computed fields
 */
export function getRefreshTriggers(definition: FieldDefinition): string[] {
  return definition.refreshTriggers || definition.computedConfig?.refreshTriggers || [];
}