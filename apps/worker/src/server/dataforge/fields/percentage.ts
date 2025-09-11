/**
 * Percentage Field Handler
 * 
 * Handles percentage validation with 0-100% range and enhanced UI metadata.
 * Provides specialized percentage input with % symbol and validation.
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

  // Convert to number if it's a string, handle % suffix
  let numValue: number;
  if (typeof value === 'string') {
    const cleanValue = value.replace('%', '').trim();
    numValue = parseFloat(cleanValue);
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be a percentage`]
    };
  }

  // Check if conversion resulted in NaN
  if (isNaN(numValue)) {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be a valid percentage`]
    };
  }

  const errors: string[] = [];
  const precision = definition.precision || 1;
  const min = definition.min !== undefined ? definition.min : 0;
  const max = definition.max !== undefined ? definition.max : 100;

  // Check decimal precision
  const decimalPart = String(numValue).split('.')[1];
  if (decimalPart && decimalPart.length > precision) {
    errors.push(`Field '${definition.name}' cannot have more than ${precision} decimal place${precision === 1 ? '' : 's'}`);
  }

  // Range validation (default 0-100%)
  if (numValue < min) {
    errors.push(`Field '${definition.name}' must be at least ${min}%`);
  }

  if (numValue > max) {
    errors.push(`Field '${definition.name}' must be no more than ${max}%`);
  }

  // Round to specified precision
  const roundedValue = Math.round(numValue * Math.pow(10, precision)) / Math.pow(10, precision);

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: roundedValue
  };
}

export function getDefaultValue(definition: FieldDefinition): number {
  if (definition.defaultValue !== undefined) {
    const val = typeof definition.defaultValue === 'number' ? definition.defaultValue : parseFloat(String(definition.defaultValue).replace('%', '')) || 0;
    return Math.min(100, Math.max(0, val)); // Clamp to 0-100%
  }
  return definition.min !== undefined ? Math.max(0, definition.min) : 0;
}

export function getSqlType(definition: FieldDefinition): string {
  const precision = definition.precision || 1;
  // Store as decimal with appropriate precision for percentages
  return `NUMERIC(5, ${precision})`;
}

export function getSqlDefault(definition: FieldDefinition): string {
  const defaultVal = getDefaultValue(definition);
  const precision = definition.precision || 1;
  return defaultVal.toFixed(precision);
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const precision = definition.precision || 1;
  const min = definition.min !== undefined ? definition.min : 0;
  const max = definition.max !== undefined ? definition.max : 100;
  
  const messages = {
    required: `${definition.name} is required`,
    min: `Must be at least ${min}%`,
    max: `Must be no more than ${max}%`,
    custom: {
      INVALID_PERCENTAGE: `${definition.name} must be a valid percentage`,
      TOO_MANY_DECIMALS: `${definition.name} cannot have more than ${precision} decimal place${precision === 1 ? '' : 's'}`,
      OUT_OF_RANGE: `${definition.name} must be between ${min}% and ${max}%`
    }
  };

  return {
    required: definition.required || false,
    min,
    max,
    step: definition.step || (1 / Math.pow(10, precision)),
    precision,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  const precision = definition.precision || 1;
  
  return {
    width: 100,
    minWidth: 80,
    textAlign: 'right',
    format: 'percentage',
    precision,
    suffix: '%',
    showTooltip: true,
    placeholder: `0.${'0'.repeat(precision)}%`,
    customFormatter: 'percentage-display'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  const precision = definition.precision || 1;
  const min = definition.min !== undefined ? definition.min : 0;
  const max = definition.max !== undefined ? definition.max : 100;
  
  return {
    type: 'percentage',
    step: definition.step || (1 / Math.pow(10, precision)),
    min,
    max,
    showSpinners: true,
    validateWhileTyping: true,
    showValidationOnBlur: true,
    suffix: '%',
    precision,
    inputMode: 'decimal'
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: true,
    requiresSpecialEditor: true,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  const precision = definition.precision || 1;
  const min = definition.min !== undefined ? definition.min : 0;
  const max = definition.max !== undefined ? definition.max : 100;
  
  return {
    ariaLabel: `${definition.name} percentage input`,
    ariaDescription: `Enter a percentage value with up to ${precision} decimal place${precision === 1 ? '' : 's'} between ${min}% and ${max}%`,
    role: 'spinbutton',
    ariaRequired: definition.required || false,
    ariaInvalid: false,
    ariaValueMin: min,
    ariaValueMax: max,
    ariaValueText: '% (percentage)'
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