/**
 * Boolean Field - all boolean field logic in one place
 */

import type { FieldDefinition } from '../services/FieldManager';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue ?? false;
}

export function validate(value: any, definition: FieldDefinition, context: any): { valid: boolean; errors: any[]; transformedValue?: any } {
  const errors: any[] = [];
  
  // Required validation (for boolean, false is still a valid value)
  if (definition.required && value === undefined) {
    errors.push({
      field: definition.name,
      code: 'REQUIRED_FIELD',
      message: `Field '${definition.name}' is required`,
      value
    });
    return { valid: false, errors };
  }

  if (value === undefined) {
    return { valid: true, errors: [], transformedValue: false };
  }

  // Type validation & coercion
  let boolValue: boolean;
  
  if (typeof value === 'boolean') {
    boolValue = value;
  } else if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes' || lowerValue === 'on') {
      boolValue = true;
    } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no' || lowerValue === 'off' || lowerValue === '') {
      boolValue = false;
    } else {
      errors.push({
        field: definition.name,
        code: 'INVALID_BOOLEAN',
        message: `Field '${definition.name}' must be a valid boolean value`,
        value
      });
      return { valid: false, errors };
    }
  } else if (typeof value === 'number') {
    boolValue = value !== 0;
  } else if (value === null) {
    boolValue = false;
  } else {
    boolValue = Boolean(value);
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: boolValue
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'BOOLEAN';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue;
  if (defaultValue === undefined || defaultValue === null) {
    return 'false';
  }
  return Boolean(defaultValue) ? 'true' : 'false';
}