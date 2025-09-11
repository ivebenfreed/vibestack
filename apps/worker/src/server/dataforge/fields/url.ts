/**
 * Enhanced URL Field Handler
 * 
 * Validates URLs with proper format checking and optional protocol enforcement
 * Enhanced with rich UI metadata for URL input with link preview
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

  // Convert to string and trim
  let url = String(value).trim();

  // Auto-prepend https:// if no protocol specified
  if (url && !url.match(/^https?:\/\//)) {
    url = `https://${url}`;
  }

  // URL validation using built-in URL constructor
  try {
    const parsedUrl = new URL(url);
    
    // Check allowed protocols if specified in field definition
    const allowedProtocols = definition.enum || ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      errors.push(`Field '${definition.name}' protocol not allowed. Allowed: ${allowedProtocols.join(', ')}`);
    }

    // Length validation
    if (url.length > 2048) { // Common URL length limit
      errors.push(`Field '${definition.name}' URL too long (max 2048 characters)`);
    }

    // Custom regex validation if provided
    if (definition.regex) {
      const customRegex = new RegExp(definition.regex);
      if (!customRegex.test(url)) {
        errors.push(`Field '${definition.name}' URL does not match required pattern`);
      }
    }

  } catch (error) {
    errors.push(`Field '${definition.name}' invalid URL format`);
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: url
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
      INVALID_URL_FORMAT: `${definition.name} must be a valid URL`,
      INVALID_PROTOCOL: `URL protocol not allowed. Allowed: ${(definition.enum || ['http:', 'https:']).join(', ')}`,
      URL_TOO_LONG: 'URL too long (max 2048 characters)',
      PATTERN_MISMATCH: 'URL does not match required pattern'
    }
  };

  return {
    required: definition.required || false,
    enum: definition.enum,
    pattern: '^https?:\/\/.*',
    maxLength: 2048,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 200,
    minWidth: 150,
    textAlign: 'left',
    format: 'url',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: 'https://example.com',
    customFormatter: 'url-link',
    truncateAt: 50
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'url',
    placeholder: 'https://example.com',
    autoComplete: 'url',
    inputMode: 'url',
    validateWhileTyping: true,
    showValidationOnBlur: true,
    showLinkPreview: true,
    allowedProtocols: definition.enum || ['http:', 'https:']
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
    ariaLabel: `${definition.name} URL input`,
    ariaDescription: `Enter a valid URL for ${definition.name}. Protocol (http:// or https://) will be added automatically if not specified`,
    role: 'textbox',
    ariaRequired: definition.required || false,
    ariaInvalid: false,
    inputMode: 'url'
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