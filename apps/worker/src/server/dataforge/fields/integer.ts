/**
 * Integer Field Handler
 * 
 * Handles integer number validation with range checking and enhanced UI metadata.
 * Provides specialized integer input with step controls and validation.
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function validate(value: any, definition: FieldDefinition, context: any): ValidationResult {
  // Handle null/undefined for optional fields
  if (value == null || value === '') {
    if (definition.required) {
      return {
        valid: false,
        errors: [`Field '${definition.name}' is required`]
      };
    }
    return { valid: true, errors: [] };
  }

  // Convert to number if it's a string
  let numValue: number;
  if (typeof value === 'string') {
    numValue = parseInt(value, 10);
  } else if (typeof value === 'number') {
    numValue = Math.floor(value); // Ensure integer
  } else {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be an integer`]
    };
  }

  // Check if conversion resulted in NaN
  if (isNaN(numValue)) {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be a valid integer`]
    };
  }

  // Check if it's actually an integer (no decimal part)
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be an integer (no decimal places)`]
    };
  }

  const errors: string[] = [];

  // Range validation
  if (definition.min !== undefined && numValue < definition.min) {
    errors.push(`Field '${definition.name}' must be at least ${definition.min}`);
  }

  if (definition.max !== undefined && numValue > definition.max) {
    errors.push(`Field '${definition.name}' must be no more than ${definition.max}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: numValue
  };
}

export function getDefaultValue(definition: FieldDefinition): number {
  if (definition.defaultValue !== undefined) {
    return typeof definition.defaultValue === 'number' ? Math.floor(definition.defaultValue) : parseInt(String(definition.defaultValue), 10) || 0;
  }
  return definition.min !== undefined ? Math.max(0, definition.min) : 0;
}

export function getSqlType(definition: FieldDefinition): string {
  return 'INTEGER';
}

export function getSqlDefault(definition: FieldDefinition): string {
  const defaultVal = getDefaultValue(definition);
  return String(defaultVal);
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const messages = {
    required: `${definition.name} is required`,
    min: definition.min !== undefined ? `Must be at least ${definition.min}` : undefined,
    max: definition.max !== undefined ? `Must be no more than ${definition.max}` : undefined,
    custom: {
      INVALID_INTEGER: `${definition.name} must be a valid integer`,
      NOT_INTEGER: `${definition.name} must be an integer (no decimal places)`,
      OUT_OF_RANGE: `${definition.name} must be between ${definition.min || 'any'} and ${definition.max || 'any'}`
    }
  };

  return {
    required: definition.required || false,
    min: definition.min,
    max: definition.max,
    step: definition.step || 1,
    pattern: '^-?\\d+$',
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 100,
    minWidth: 80,
    textAlign: 'right',
    format: 'integer',
    showTooltip: true,
    placeholder: definition.min !== undefined ? String(definition.min) : '0',
    customFormatter: 'integer-display'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'number',
    step: definition.step || 1,
    min: definition.min,
    max: definition.max,
    showSpinners: true,
    validateWhileTyping: true,
    showValidationOnBlur: true,
    allowDecimals: false,
    inputMode: 'numeric'
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: true,
    requiresSpecialEditor: false,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} integer input`,
    ariaDescription: `Enter an integer value${definition.min !== undefined || definition.max !== undefined ? 
      ` between ${definition.min || 'any'} and ${definition.max || 'any'}` : ''}`,
    role: 'spinbutton',
    ariaRequired: definition.required || false,
    ariaInvalid: false
  };
}

// Export as enhanced field handler
export const handler: EnhancedFieldHandler = {
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