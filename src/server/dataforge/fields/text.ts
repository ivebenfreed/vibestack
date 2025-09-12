/**
 * Text Field - all text field logic in one place
 */

import type { FieldDefinition } from '../services/FieldManager';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue ?? '';
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
  const stringValue = String(value);

  // Length validation
  if (definition.minLength && stringValue.length < definition.minLength) {
    errors.push({
      field: definition.name,
      code: 'MIN_LENGTH',
      message: `Field '${definition.name}' must be at least ${definition.minLength} characters`,
      value: stringValue.length,
      constraint: definition.minLength
    });
  }

  if (definition.maxLength && stringValue.length > definition.maxLength) {
    errors.push({
      field: definition.name,
      code: 'MAX_LENGTH',
      message: `Field '${definition.name}' must be no more than ${definition.maxLength} characters`,
      value: stringValue.length,
      constraint: definition.maxLength
    });
  }

  // Pattern validation
  if (definition.pattern) {
    try {
      const regex = new RegExp(definition.pattern);
      if (!regex.test(stringValue)) {
        errors.push({
          field: definition.name,
          code: 'PATTERN_MISMATCH',
          message: `Field '${definition.name}' does not match required pattern`,
          value: stringValue,
          constraint: definition.pattern
        });
      }
    } catch (e) {
      errors.push({
        field: definition.name,
        code: 'INVALID_PATTERN',
        message: `Field '${definition.name}' has invalid regex pattern`,
        constraint: definition.pattern
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: stringValue
  };
}

export function getSqlType(definition: FieldDefinition): string {
  if (definition.type === 'longtext') {
    return 'TEXT';
  }
  if (definition.maxLength && definition.maxLength <= 255) {
    return `VARCHAR(${definition.maxLength})`;
  }
  return 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue;
  if (defaultValue === undefined || defaultValue === null) {
    return null;
  }
  return `'${String(defaultValue).replace(/'/g, "''")}'`;
}