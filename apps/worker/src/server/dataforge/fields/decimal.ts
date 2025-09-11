/**
 * Decimal Field Handler
 * 
 * Handles decimal number validation with precision control and enhanced UI metadata.
 * Provides specialized decimal input with precision controls and validation.
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
    numValue = parseFloat(value);
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be a decimal number`]
    };
  }

  // Check if conversion resulted in NaN
  if (isNaN(numValue)) {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be a valid decimal number`]
    };
  }

  const errors: string[] = [];
  const precision = definition.precision || 2;

  // Check decimal precision
  const decimalPart = String(numValue).split('.')[1];
  if (decimalPart && decimalPart.length > precision) {
    errors.push(`Field '${definition.name}' cannot have more than ${precision} decimal places`);
  }

  // Range validation
  if (definition.min !== undefined && numValue < definition.min) {
    errors.push(`Field '${definition.name}' must be at least ${definition.min}`);
  }

  if (definition.max !== undefined && numValue > definition.max) {
    errors.push(`Field '${definition.name}' must be no more than ${definition.max}`);
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
    return typeof definition.defaultValue === 'number' ? definition.defaultValue : parseFloat(String(definition.defaultValue)) || 0.00;
  }
  return definition.min !== undefined ? Math.max(0.00, definition.min) : 0.00;
}

export function getSqlType(definition: FieldDefinition): string {
  const precision = definition.precision || 2;
  // Use NUMERIC for precise decimal storage
  return `NUMERIC(10, ${precision})`;
}

export function getSqlDefault(definition: FieldDefinition): string {
  const defaultVal = getDefaultValue(definition);
  const precision = definition.precision || 2;
  return defaultVal.toFixed(precision);
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const precision = definition.precision || 2;
  const messages = {
    required: `${definition.name} is required`,
    min: definition.min !== undefined ? `Must be at least ${definition.min}` : undefined,
    max: definition.max !== undefined ? `Must be no more than ${definition.max}` : undefined,
    custom: {
      INVALID_DECIMAL: `${definition.name} must be a valid decimal number`,
      TOO_MANY_DECIMALS: `${definition.name} cannot have more than ${precision} decimal places`,
      OUT_OF_RANGE: `${definition.name} must be between ${definition.min || 'any'} and ${definition.max || 'any'}`
    }
  };

  return {
    required: definition.required || false,
    min: definition.min,
    max: definition.max,
    step: definition.step || (1 / Math.pow(10, precision)),
    precision,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  const precision = definition.precision || 2;
  
  return {
    width: 120,
    minWidth: 100,
    textAlign: 'right',
    format: 'decimal',
    precision,
    showTooltip: true,
    placeholder: `0.${'0'.repeat(precision)}`,
    customFormatter: 'decimal-display'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  const precision = definition.precision || 2;
  
  return {
    type: 'number',
    step: definition.step || (1 / Math.pow(10, precision)),
    min: definition.min,
    max: definition.max,
    showSpinners: true,
    validateWhileTyping: true,
    showValidationOnBlur: true,
    allowDecimals: true,
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
    requiresSpecialEditor: false,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  const precision = definition.precision || 2;
  
  return {
    ariaLabel: `${definition.name} decimal input with ${precision} decimal places`,
    ariaDescription: `Enter a decimal number with up to ${precision} decimal places${definition.min !== undefined || definition.max !== undefined ? 
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