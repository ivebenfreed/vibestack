/**
 * Enhanced Slider Field Handler
 * 
 * Range slider field with configurable min/max values and step increments
 * Enhanced with rich UI metadata for interactive slider components
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  if (definition.defaultValue !== undefined) {
    return definition.defaultValue;
  }
  // Default to minimum value or 0
  return definition.min || 0;
}

export function validate(value: any, definition: FieldDefinition, context: any): ValidationResult {
  const errors: string[] = [];
  
  // Handle null/undefined
  if (value == null || value === '') {
    if (definition.required) {
      errors.push(`Field '${definition.name}' is required`);
    }
    return { valid: errors.length === 0, errors };
  }

  // Convert to number
  const sliderValue = Number(value);
  
  if (isNaN(sliderValue)) {
    errors.push(`Field '${definition.name}' must be a valid number`);
    return { valid: false, errors };
  }

  // Get range from field definition
  const minValue = definition.min ?? 0;
  const maxValue = definition.max ?? 100;
  const stepValue = definition.step || 1;

  // Range validation
  if (sliderValue < minValue) {
    errors.push(`Field '${definition.name}' value cannot be less than ${minValue}`);
  }

  if (sliderValue > maxValue) {
    errors.push(`Field '${definition.name}' value cannot exceed ${maxValue}`);
  }

  // Step validation
  const remainder = (sliderValue - minValue) % stepValue;
  if (Math.abs(remainder) > 0.001) { // Account for floating point precision
    errors.push(`Field '${definition.name}' value must be in increments of ${stepValue}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: sliderValue
  };
}

export function getSqlType(definition: FieldDefinition): string {
  // Use INTEGER if step is 1 and no decimal values expected
  const stepValue = definition.step || 1;
  return Number.isInteger(stepValue) ? 'INTEGER' : 'NUMERIC(10, 2)';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultVal = getDefaultValue(definition);
  return defaultVal !== null ? String(defaultVal) : null;
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const minValue = definition.min ?? 0;
  const maxValue = definition.max ?? 100;
  const stepValue = definition.step || 1;
  
  const messages = {
    required: `${definition.name} is required`,
    custom: {
      INVALID_SLIDER_VALUE: `${definition.name} must be a valid number`,
      VALUE_TOO_LOW: `Value cannot be less than ${minValue}`,
      VALUE_TOO_HIGH: `Value cannot exceed ${maxValue}`,
      INVALID_STEP: `Value must be in increments of ${stepValue}`
    }
  };

  return {
    required: definition.required || false,
    min: minValue,
    max: maxValue,
    step: stepValue,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  const minValue = definition.min ?? 0;
  const maxValue = definition.max ?? 100;
  const stepValue = definition.step || 1;
  
  return {
    width: 150,
    minWidth: 100,
    textAlign: 'center',
    format: 'number',
    precision: Number.isInteger(stepValue) ? 0 : 2,
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: `${minValue} - ${maxValue}`,
    customFormatter: 'slider-value',
    suffix: definition.unit || ''
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  const minValue = definition.min ?? 0;
  const maxValue = definition.max ?? 100;
  const stepValue = definition.step || 1;
  
  return {
    type: 'range',
    min: minValue,
    max: maxValue,
    step: stepValue,
    showValue: true,
    showTicks: definition.showTicks || false,
    tickInterval: definition.tickInterval || stepValue * 10,
    orientation: 'horizontal',
    size: 'medium',
    color: '#3b82f6', // blue-500
    validateWhileTyping: true,
    showValidationOnBlur: false
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
  const minValue = definition.min ?? 0;
  const maxValue = definition.max ?? 100;
  const stepValue = definition.step || 1;
  
  return {
    ariaLabel: `${definition.name} slider`,
    ariaDescription: `Adjust ${definition.name} from ${minValue} to ${maxValue} in increments of ${stepValue}`,
    role: 'slider',
    ariaRequired: definition.required || false,
    ariaInvalid: false,
    ariaValueMin: minValue,
    ariaValueMax: maxValue,
    ariaValueNow: definition.defaultValue || minValue,
    ariaOrientation: 'horizontal'
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