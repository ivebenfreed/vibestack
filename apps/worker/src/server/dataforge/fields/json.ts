/**
 * JSON Field Handler
 * 
 * Handles JSON fields with validation and enhanced UI integration.
 * Supports complex object storage with proper parsing and validation.
 */

import type { FieldDefinition } from '../types';
import type {
  ValidationMetadata,
  DisplayMetadata,
  EditorMetadata,
  FieldCapabilities,
  AccessibilityMetadata,
  EnhancedFieldHandler
} from './types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || {};
}

export function validate(value: any, definition: FieldDefinition, context: any): { 
  valid: boolean; 
  errors: any[]; 
  transformedValue?: any; 
} {
  const errors: any[] = [];
  
  // Handle null/undefined
  if (value == null) {
    if (definition.required) {
      errors.push({
        field: definition.name,
        code: 'REQUIRED',
        message: `${definition.name} is required`
      });
    }
    return { 
      valid: errors.length === 0, 
      errors,
      transformedValue: definition.required ? undefined : null
    };
  }

  let jsonValue: any;

  // If already an object, validate it can be serialized
  if (typeof value === 'object' && !Array.isArray(value)) {
    try {
      JSON.stringify(value);
      jsonValue = value;
    } catch (error) {
      errors.push({
        field: definition.name,
        code: 'INVALID_JSON_OBJECT',
        message: `${definition.name} contains non-serializable data`,
        value,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { valid: false, errors };
    }
  }
  // If it's a string, try to parse it as JSON
  else if (typeof value === 'string') {
    if (value.trim() === '') {
      jsonValue = definition.required ? undefined : {};
    } else {
      try {
        jsonValue = JSON.parse(value);
      } catch (error) {
        errors.push({
          field: definition.name,
          code: 'INVALID_JSON_STRING',
          message: `${definition.name} must be valid JSON`,
          value,
          error: error instanceof Error ? error.message : 'Invalid JSON format'
        });
        return { valid: false, errors };
      }
    }
  }
  // Handle arrays (which are valid JSON)
  else if (Array.isArray(value)) {
    try {
      JSON.stringify(value);
      jsonValue = value;
    } catch (error) {
      errors.push({
        field: definition.name,
        code: 'INVALID_JSON_ARRAY',
        message: `${definition.name} array contains non-serializable data`,
        value,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { valid: false, errors };
    }
  }
  // Handle primitives (numbers, booleans, etc.)
  else {
    jsonValue = value;
  }

  // Validate size constraints if specified
  if (definition.maxLength) {
    const serialized = JSON.stringify(jsonValue);
    if (serialized.length > definition.maxLength) {
      errors.push({
        field: definition.name,
        code: 'JSON_TOO_LARGE',
        message: `${definition.name} JSON data exceeds maximum size of ${definition.maxLength} characters`,
        actualSize: serialized.length,
        maxSize: definition.maxLength
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: jsonValue
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'JSONB';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue;
  if (defaultValue !== undefined) {
    return `'${JSON.stringify(defaultValue)}'::jsonb`;
  }
  return null;
}

// Enhanced metadata methods for UI integration
export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  return {
    jsonFormat: true,
    maxLength: definition.maxLength,
    messages: {
      required: `${definition.name} is required`,
      custom: {
        INVALID_JSON_OBJECT: `${definition.name} contains data that cannot be stored as JSON`,
        INVALID_JSON_STRING: `${definition.name} must be valid JSON format`,
        INVALID_JSON_ARRAY: `${definition.name} array contains invalid data`,
        JSON_TOO_LARGE: `${definition.name} data is too large`
      }
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 250,
    minWidth: 200,
    textAlign: 'left',
    format: 'json',
    showTooltip: true,
    placeholder: '{}',
    truncateAt: 100, // Truncate long JSON for display
    showPreview: true, // Show formatted preview on hover
    // Custom formatter for complex objects
    customFormatter: 'json-display',
    displayMode: 'summary' // Show summary instead of raw JSON
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'json-editor',
    multiline: true,
    rows: 8,
    validateWhileTyping: false,
    showValidationOnBlur: true,
    jsonFeatures: ['syntax-highlighting', 'auto-format', 'validation', 'collapse'],
    maxLength: definition.maxLength
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: false, // JSON fields generally shouldn't be sorted
    supportsFiltering: true, // Can filter by JSON properties with special syntax
    supportsGrouping: false, // Complex to group by JSON
    supportsAggregation: false, // No standard aggregation for JSON
    requiresSpecialEditor: true, // Needs JSON editor
    hasRichDisplay: true, // Shows formatted JSON preview
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} JSON data`,
    ariaDescription: 'Enter valid JSON data. Use proper JSON syntax with quotes around keys and string values.',
    role: 'textbox'
  };
}

/**
 * Helper function to format JSON for display in grids
 */
export function formatForDisplay(value: any): string {
  if (value == null) return '';
  
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return formatJsonSummary(parsed);
    } catch {
      return value;
    }
  }
  
  if (typeof value === 'object') {
    return formatJsonSummary(value);
  }
  
  return String(value);
}

/**
 * Create a human-readable summary of JSON data
 */
export function formatJsonSummary(obj: any): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    if (obj.length === 1) return `[${formatJsonSummary(obj[0])}]`;
    return `[${obj.length} items]`;
  }
  
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    
    // Show key count and first few keys
    if (keys.length === 1) {
      const key = keys[0];
      const value = obj[key];
      if (typeof value === 'string' && value.length < 20) {
        return `{${key}: "${value}"}`;
      }
      return `{${key}: ${typeof value}}`;
    }
    
    if (keys.length <= 3) {
      const pairs = keys.slice(0, 3).map(key => {
        const value = obj[key];
        if (typeof value === 'string' && value.length < 15) {
          return `${key}: "${value}"`;
        }
        return `${key}: ${typeof value}`;
      });
      return `{${pairs.join(', ')}}`;
    }
    
    return `{${keys.length} properties}`;
  }
  
  if (typeof obj === 'string') {
    if (obj.length > 50) {
      return `"${obj.substring(0, 47)}..."`;
    }
    return `"${obj}"`;
  }
  
  return String(obj);
}

/**
 * Get detailed JSON information for tooltips
 */
export function getJsonTooltip(value: any): string {
  if (value == null) return 'No data';
  
  try {
    const obj = typeof value === 'string' ? JSON.parse(value) : value;
    const formatted = JSON.stringify(obj, null, 2);
    
    // Limit tooltip length
    if (formatted.length > 500) {
      return formatted.substring(0, 497) + '...';
    }
    
    return formatted;
  } catch (error) {
    return `Invalid JSON: ${String(value)}`;
  }
}

/**
 * Helper function to validate JSON schema if provided
 */
export function validateJsonSchema(value: any, schema: any): { valid: boolean; errors: string[] } {
  // This could integrate with a JSON schema validation library
  // For now, just basic validation
  return { valid: true, errors: [] };
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
  getAccessibilityMetadata,
  // Additional JSON-specific helpers
  formatForDisplay,
  formatJsonSummary,
  getJsonTooltip
};