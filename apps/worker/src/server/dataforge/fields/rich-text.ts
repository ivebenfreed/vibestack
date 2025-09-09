/**
 * Rich Text Field - all rich text field logic in one place
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

  // Length validation (for rich text we might want to strip HTML for length checks)
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

  // Rich text specific validation - ensure it's valid HTML/markdown
  // TODO: Add HTML/markdown validation if needed

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: stringValue
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue;
  if (defaultValue === undefined || defaultValue === null) {
    return null;
  }
  return `'${String(defaultValue).replace(/'/g, "''")}'`;
}