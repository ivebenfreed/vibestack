/**
 * Multi Select Field - all multi select field logic in one place
 */

import type { FieldDefinition } from '../services/FieldManager';

export function getDefaultValue(definition: FieldDefinition): any {
  if (definition.defaultValue !== undefined) {
    return Array.isArray(definition.defaultValue) ? definition.defaultValue : [definition.defaultValue];
  }
  return [];
}

export function validate(value: any, definition: FieldDefinition, context: any): { valid: boolean; errors: any[]; transformedValue?: any } {
  const errors: any[] = [];
  
  // Required validation
  if (definition.required && (!value || (Array.isArray(value) && value.length === 0))) {
    errors.push({
      field: definition.name,
      code: 'REQUIRED_FIELD',
      message: `Field '${definition.name}' is required`,
      value
    });
    return { valid: false, errors };
  }

  if (!value || (Array.isArray(value) && value.length === 0)) {
    return { valid: true, errors: [], transformedValue: [] };
  }

  // Ensure array format
  let arrayValue = Array.isArray(value) ? value : [value];
  
  // Convert all values to strings
  arrayValue = arrayValue.map(v => String(v));

  // Enum validation - all values must be in allowed options
  if (definition.enum && definition.enum.length > 0) {
    const invalidValues = arrayValue.filter(val => !definition.enum!.includes(val));
    if (invalidValues.length > 0) {
      errors.push({
        field: definition.name,
        code: 'INVALID_OPTIONS',
        message: `Field '${definition.name}' contains invalid options: ${invalidValues.join(', ')}. Must be from: ${definition.enum.join(', ')}`,
        value: invalidValues,
        constraint: definition.enum
      });
    }
  }

  // Min/max selection validation
  if (definition.min !== undefined && arrayValue.length < definition.min) {
    errors.push({
      field: definition.name,
      code: 'MIN_SELECTIONS',
      message: `Field '${definition.name}' must have at least ${definition.min} selections`,
      value: arrayValue.length,
      constraint: definition.min
    });
  }

  if (definition.max !== undefined && arrayValue.length > definition.max) {
    errors.push({
      field: definition.name,
      code: 'MAX_SELECTIONS',
      message: `Field '${definition.name}' must have no more than ${definition.max} selections`,
      value: arrayValue.length,
      constraint: definition.max
    });
  }

  // Remove duplicates
  const uniqueValues = [...new Set(arrayValue)];

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: uniqueValues
  };
}

export function getSqlType(definition: FieldDefinition): string {
  // Multi-select stored as JSONB array
  return 'JSONB';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue;
  if (defaultValue === undefined || defaultValue === null) {
    return "'[]'::jsonb";
  }
  
  if (Array.isArray(defaultValue)) {
    return `'${JSON.stringify(defaultValue)}'::jsonb`;
  }
  
  return `'["${String(defaultValue)}"]'::jsonb`;
}