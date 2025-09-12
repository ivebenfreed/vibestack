/**
 * Single Select Field - all single select field logic in one place
 */

import type { FieldDefinition } from '../services/FieldManager';

export function getDefaultValue(definition: FieldDefinition): any {
  if (definition.defaultValue !== undefined) {
    return definition.defaultValue;
  }
  // Return first enum option if available
  if (definition.enum && definition.enum.length > 0) {
    return definition.enum[0];
  }
  return null;
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

  // Type validation - should be string
  const stringValue = String(value);

  // Enum validation - must be in allowed options
  if (definition.enum && definition.enum.length > 0) {
    if (!definition.enum.includes(stringValue)) {
      errors.push({
        field: definition.name,
        code: 'INVALID_OPTION',
        message: `Field '${definition.name}' must be one of: ${definition.enum.join(', ')}`,
        value: stringValue,
        constraint: definition.enum
      });
    }
  }

  // TODO: Validate against custom options API if no enum provided
  // This would check against the unified options system

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: stringValue
  };
}

export function getSqlType(definition: FieldDefinition): string {
  // Single select stored as TEXT/VARCHAR
  if (definition.enum && definition.enum.length > 0) {
    const maxLength = Math.max(...definition.enum.map(option => option.length));
    if (maxLength <= 255) {
      return `VARCHAR(${maxLength})`;
    }
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

// Enhanced metadata methods for UI integration
export function getEditorMetadata(definition: FieldDefinition): any {
  const options = (definition.enum || []).map(value => ({
    value: value,
    label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')
  }));

  return {
    type: 'select',
    searchable: false,
    clearable: !definition.required,
    showValidationOnBlur: true,
    options
  };
}

export function getValidationMetadata(definition: FieldDefinition): any {
  return {
    messages: {
      required: `${definition.name} is required`
    },
    enum: definition.enum || []
  };
}

export function getDisplayMetadata(definition: FieldDefinition): any {
  return {
    width: 200,
    textAlign: 'left' as const
  };
}

export function getCapabilities(): any {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: false,
    supportsAggregation: false,
    requiresSpecialEditor: false,
    hasRichDisplay: false,
    supportsValidation: true,
    supportsFormatting: false
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): any {
  return {
    ariaLabel: `${definition.name} input`,
    role: 'textbox'
  };
}

// Export as enhanced field handler
export const handler = {
  validate,
  getDefaultValue,
  getSqlType,
  getSqlDefault,
  getValidationMetadata,
  getDisplayMetadata,
  getEditorMetadata,
  getCapabilities,
  getAccessibilityMetadata
};