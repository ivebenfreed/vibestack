/**
 * Enhanced Rating Field Handler
 * 
 * Star rating field with configurable maximum stars and visual feedback
 * Enhanced with rich UI metadata for interactive rating components
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || 0;
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
  const rating = Number(value);
  
  if (isNaN(rating)) {
    errors.push(`Field '${definition.name}' must be a valid number`);
    return { valid: false, errors };
  }

  // Must be integer
  if (!Number.isInteger(rating)) {
    errors.push(`Field '${definition.name}' must be a whole number`);
  }

  // Get max rating from field definition (default 5)
  const maxRating = definition.max || 5;
  const minRating = definition.min || 0;

  // Range validation
  if (rating < minRating) {
    errors.push(`Field '${definition.name}' rating cannot be less than ${minRating}`);
  }

  if (rating > maxRating) {
    errors.push(`Field '${definition.name}' rating cannot exceed ${maxRating}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: rating
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'INTEGER';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultVal = getDefaultValue(definition);
  return defaultVal !== null ? String(defaultVal) : null;
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const maxRating = definition.max || 5;
  const minRating = definition.min || 0;
  
  const messages = {
    required: `${definition.name} is required`,
    custom: {
      INVALID_RATING: `${definition.name} must be a valid number`,
      NOT_INTEGER: `${definition.name} must be a whole number`,
      RATING_TOO_LOW: `Rating cannot be less than ${minRating}`,
      RATING_TOO_HIGH: `Rating cannot exceed ${maxRating}`
    }
  };

  return {
    required: definition.required || false,
    min: minRating,
    max: maxRating,
    pattern: '^[0-9]+$',
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  const maxRating = definition.max || 5;
  
  return {
    width: 120,
    minWidth: 80,
    textAlign: 'center',
    format: 'rating',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: `0 - ${maxRating}`,
    customFormatter: 'star-rating'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  const maxRating = definition.max || 5;
  const minRating = definition.min || 0;
  
  return {
    type: 'rating',
    maxRating,
    minRating,
    starIcon: 'star',
    emptyStarIcon: 'star-outline',
    allowHalfStars: false,
    showLabels: true,
    size: 'medium',
    color: '#fbbf24', // yellow-400
    validateWhileTyping: true,
    showValidationOnBlur: true
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
    supportsFormatting: false
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  const maxRating = definition.max || 5;
  
  return {
    ariaLabel: `${definition.name} star rating`,
    ariaDescription: `Rate ${definition.name} from 0 to ${maxRating} stars. Use arrow keys to adjust rating`,
    role: 'slider',
    ariaRequired: definition.required || false,
    ariaInvalid: false,
    ariaValueMin: definition.min || 0,
    ariaValueMax: maxRating,
    ariaValueNow: definition.defaultValue || 0
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