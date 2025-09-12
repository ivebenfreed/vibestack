/**
 * Enhanced Phone Field Handler
 * 
 * Validates phone numbers with flexible formatting and optional international support
 * Enhanced with rich UI metadata for phone input with formatting assistance
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || null;
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

  // Convert to string and clean
  const phone = String(value).trim();

  // Remove common formatting characters for validation
  const cleanPhone = phone.replace(/[\s\-\(\)\+\.\s]/g, '');

  // Basic length validation (international numbers can be 7-15 digits)
  if (cleanPhone.length < 7) {
    errors.push(`Field '${definition.name}' phone number too short (minimum 7 digits)`);
  }

  if (cleanPhone.length > 15) {
    errors.push(`Field '${definition.name}' phone number too long (maximum 15 digits)`);
  }

  // Check if only contains valid characters
  if (!cleanPhone.match(/^[0-9]+$/)) {
    errors.push(`Field '${definition.name}' phone number contains invalid characters`);
  }

  // Custom regex validation if provided (for specific formats)
  if (definition.regex) {
    const customRegex = new RegExp(definition.regex);
    if (!customRegex.test(phone)) {
      errors.push(`Field '${definition.name}' phone number does not match required format`);
    }
  }

  // Format standardization (remove formatting, keep international prefix if present)
  let formattedPhone = cleanPhone;
  if (phone.startsWith('+')) {
    formattedPhone = '+' + cleanPhone;
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: formattedPhone
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

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const messages = {
    required: `${definition.name} is required`,
    custom: {
      INVALID_PHONE_FORMAT: `${definition.name} must be a valid phone number`,
      PHONE_TOO_SHORT: 'Phone number too short (minimum 7 digits)',
      PHONE_TOO_LONG: 'Phone number too long (maximum 15 digits)',
      INVALID_PHONE_CHARACTERS: 'Phone number contains invalid characters',
      PATTERN_MISMATCH: 'Phone number does not match required format'
    }
  };

  return {
    required: definition.required || false,
    pattern: definition.regex || '^[\\+]?[0-9\\s\\-\\(\\)\\.]{7,20}$',
    minLength: 7,
    maxLength: 15,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 140,
    minWidth: 120,
    textAlign: 'left',
    format: 'phone',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: '+1 (555) 123-4567',
    customFormatter: 'phone-number'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'tel',
    placeholder: '+1 (555) 123-4567',
    autoComplete: 'tel',
    inputMode: 'tel',
    validateWhileTyping: false,
    showValidationOnBlur: true,
    formatWhileTyping: true,
    allowInternational: true,
    supportedCountries: definition.enum // Optional list of country codes
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false,
    requiresSpecialEditor: false,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} phone number input`,
    ariaDescription: `Enter a phone number for ${definition.name}. International format supported with + prefix`,
    role: 'textbox',
    ariaRequired: definition.required || false,
    ariaInvalid: false,
    inputMode: 'tel'
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