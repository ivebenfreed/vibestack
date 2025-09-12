/**
 * Date Field - all date field logic in one place
 */

import type { FieldDefinition } from '../services/FieldManager';

export function getDefaultValue(definition: FieldDefinition): any {
  if (definition.defaultValue === 'now' || definition.defaultValue === 'current_timestamp') {
    return new Date().toISOString();
  }
  return definition.defaultValue ?? null;
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

  // Type validation
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    errors.push({
      field: definition.name,
      code: 'INVALID_DATE',
      message: `Field '${definition.name}' must be a valid date`,
      value
    });
    return { valid: false, errors };
  }

  // Min/max date validation
  if (definition.min) {
    const minDate = new Date(definition.min);
    if (!isNaN(minDate.getTime()) && date < minDate) {
      errors.push({
        field: definition.name,
        code: 'MIN_DATE',
        message: `Field '${definition.name}' must be after ${minDate.toISOString().split('T')[0]}`,
        value: date.toISOString(),
        constraint: definition.min
      });
    }
  }

  if (definition.max) {
    const maxDate = new Date(definition.max);
    if (!isNaN(maxDate.getTime()) && date > maxDate) {
      errors.push({
        field: definition.name,
        code: 'MAX_DATE',
        message: `Field '${definition.name}' must be before ${maxDate.toISOString().split('T')[0]}`,
        value: date.toISOString(),
        constraint: definition.max
      });
    }
  }

  // Reality validation - start_date vs due_date
  if (definition.name === 'start_date' && context.data?.due_date) {
    const dueDate = new Date(context.data.due_date);
    if (!isNaN(dueDate.getTime()) && date >= dueDate) {
      errors.push({
        field: definition.name,
        code: 'START_DATE_AFTER_DUE_DATE',
        message: 'Start date must be before due date',
        value: date.toISOString(),
        constraint: context.data.due_date
      });
    }
  }

  if (definition.name === 'due_date' && context.data?.start_date) {
    const startDate = new Date(context.data.start_date);
    if (!isNaN(startDate.getTime()) && date <= startDate) {
      errors.push({
        field: definition.name,
        code: 'DUE_DATE_BEFORE_START_DATE',
        message: 'Due date must be after start date',
        value: date.toISOString(),
        constraint: context.data.start_date
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: date.toISOString()
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return definition.type === 'datetime' ? 'TIMESTAMP' : 'DATE';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue;
  if (defaultValue === undefined || defaultValue === null) {
    return null;
  }
  
  if (defaultValue === 'now' || defaultValue === 'current_timestamp') {
    return 'CURRENT_TIMESTAMP';
  }
  
  const date = new Date(defaultValue);
  if (!isNaN(date.getTime())) {
    return `'${date.toISOString()}'`;
  }
  
  return `'${defaultValue}'`;
}