/**
 * Number Field - all number field logic in one place
 */

import type { FieldDefinition } from '../services/FieldManager';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue ?? 0;
}

export function validate(value: any, definition: FieldDefinition, context: any): { valid: boolean; errors: any[]; transformedValue?: any } {
  const errors: any[] = [];
  
  // Required validation
  if (definition.required && (value === undefined || value === null || value === '')) {
    errors.push({
      field: definition.name,
      code: 'REQUIRED_FIELD',
      message: `Field '${definition.name}' is required`,
      value
    });
    return { valid: false, errors };
  }

  if (value === undefined || value === null || value === '') {
    return { valid: true, errors: [] };
  }

  // Type validation & coercion
  let numValue = Number(value);
  if (isNaN(numValue)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_NUMBER',
      message: `Field '${definition.name}' must be a valid number`,
      value
    });
    return { valid: false, errors };
  }

  // Integer validation if specified
  if (definition.type === 'integer' && !Number.isInteger(numValue)) {
    numValue = Math.round(numValue);
  }

  // Min/max validation
  if (definition.min !== undefined && numValue < definition.min) {
    errors.push({
      field: definition.name,
      code: 'MIN_VALUE',
      message: `Field '${definition.name}' must be at least ${definition.min}`,
      value: numValue,
      constraint: definition.min
    });
  }

  if (definition.max !== undefined && numValue > definition.max) {
    errors.push({
      field: definition.name,
      code: 'MAX_VALUE',
      message: `Field '${definition.name}' must be no more than ${definition.max}`,
      value: numValue,
      constraint: definition.max
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: numValue
  };
}

export function getSqlType(definition: FieldDefinition): string {
  switch (definition.type) {
    case 'integer':
      return 'INTEGER';
    case 'decimal':
      return 'DECIMAL';
    case 'number':
    default:
      return 'NUMERIC';
  }
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue;
  if (defaultValue === undefined || defaultValue === null) {
    return null;
  }
  return String(Number(defaultValue));
}