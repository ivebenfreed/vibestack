/**
 * Email Field Handler
 * 
 * Validates email addresses with proper format checking and rich metadata
 */

import type { FieldDefinition } from '../types';
import type {
  ValidationResult,
  ValidationMetadata,
  DisplayMetadata,
  EditorMetadata,
  FieldCapabilities,
  AccessibilityMetadata,
  EnhancedFieldHandler
} from './types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || null;
}

export function validate(value: any, definition: FieldDefinition, context: any): { valid: boolean; errors: any[]; transformedValue?: any } {
  const errors: any[] = [];
  
  // Handle null/undefined
  if (value == null || value === '') {
    if (definition.required) {
      errors.push({
        field: definition.name,
        code: 'REQUIRED',
        message: `${definition.name} is required`
      });
    }
    return { valid: errors.length === 0, errors };
  }

  // Convert to string
  const email = String(value).trim();

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_EMAIL',
      message: 'Invalid email format',
      value: email
    });
  }

  // Length validation
  if (email.length > 254) { // RFC 5321 limit
    errors.push({
      field: definition.name,
      code: 'EMAIL_TOO_LONG',
      message: 'Email address too long (max 254 characters)',
      value: email,
      constraint: 254
    });
  }

  // Custom regex validation if provided
  if (definition.regex) {
    const customRegex = new RegExp(definition.regex);
    if (!customRegex.test(email)) {
      errors.push({
        field: definition.name,
        code: 'PATTERN_MISMATCH',
        message: `Email does not match required pattern`,
        value: email,
        pattern: definition.regex
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: email.toLowerCase() // Normalize to lowercase
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  if (definition.defaultValue !== undefined) {
    return `'${definition.defaultValue}'`;
  }
  return definition.required ? null : 'NULL';
}

// NEW: Enhanced metadata methods
export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  return {
    emailFormat: true,
    maxLength: 254, // RFC 5321 limit
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    messages: {
      required: `${definition.name} is required`,
      pattern: 'Please enter a valid email address',
      maxLength: 'Email address is too long (maximum 254 characters)',
      custom: {
        INVALID_EMAIL: 'Invalid email format',
        EMAIL_TOO_LONG: 'Email address too long (max 254 characters)'
      }
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 250,
    minWidth: 150,
    textAlign: 'left',
    showTooltip: true,
    placeholder: 'user@example.com',
    format: 'lowercase'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'email',
    validateWhileTyping: true,
    showValidationOnBlur: true,
    allowClear: true
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false,
    requiresSpecialEditor: true,
    hasRichDisplay: false,
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} email input`,
    ariaDescription: `Enter a valid email address for ${definition.name}`,
    role: 'textbox'
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