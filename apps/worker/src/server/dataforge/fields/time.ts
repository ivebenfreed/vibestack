/**
 * Time Field Handler
 * 
 * Handles time validation with format checking and enhanced UI metadata.
 * Provides specialized time input with picker widget and validation.
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

  let timeString: string;
  if (typeof value !== 'string') {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be a time string`]
    };
  }

  timeString = value.trim();
  
  // Support multiple time formats
  const timeFormats = [
    /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM (24-hour)
    /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, // HH:MM:SS (24-hour)
    /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, // H:MM AM/PM (12-hour)
    /^(0?[1-9]|1[0-2]):[0-5][0-9]:[0-5][0-9]\s?(AM|PM)$/i // H:MM:SS AM/PM (12-hour)
  ];

  const isValidFormat = timeFormats.some(format => format.test(timeString));
  
  if (!isValidFormat) {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be a valid time (e.g., 14:30, 2:30 PM)`]
    };
  }

  // Normalize to 24-hour format HH:MM
  let normalizedTime = normalizeTimeFormat(timeString);

  // Additional validation for min/max times if specified
  const errors: string[] = [];

  if (definition.min && normalizedTime < definition.min) {
    errors.push(`Field '${definition.name}' must be at or after ${definition.min}`);
  }

  if (definition.max && normalizedTime > definition.max) {
    errors.push(`Field '${definition.name}' must be at or before ${definition.max}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: normalizedTime
  };
}

function normalizeTimeFormat(timeString: string): string {
  // Convert various time formats to HH:MM (24-hour)
  const time = timeString.trim();
  
  // Check for 12-hour format with AM/PM
  const amPmMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s?(AM|PM)$/i);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = amPmMatch[2];
    const period = amPmMatch[4].toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  
  // Handle 24-hour format - ensure HH:MM format
  const parts = time.split(':');
  const hours = parseInt(parts[0], 10).toString().padStart(2, '0');
  const minutes = parts[1];
  
  return `${hours}:${minutes}`;
}

export function getDefaultValue(definition: FieldDefinition): string | null {
  if (definition.defaultValue !== undefined) {
    return normalizeTimeFormat(String(definition.defaultValue));
  }
  return null;
}

export function getSqlType(definition: FieldDefinition): string {
  return 'TIME';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultVal = getDefaultValue(definition);
  return defaultVal ? `'${defaultVal}'` : null;
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const messages = {
    required: `${definition.name} is required`,
    min: definition.min ? `Must be at or after ${definition.min}` : undefined,
    max: definition.max ? `Must be at or before ${definition.max}` : undefined,
    custom: {
      INVALID_TIME_FORMAT: `${definition.name} must be a valid time (e.g., 14:30, 2:30 PM)`,
      TIME_OUT_OF_RANGE: `${definition.name} must be between ${definition.min || '00:00'} and ${definition.max || '23:59'}`
    }
  };

  return {
    required: definition.required || false,
    min: definition.min,
    max: definition.max,
    pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 120,
    minWidth: 100,
    textAlign: 'center',
    format: 'time',
    showTooltip: true,
    placeholder: 'HH:MM',
    customFormatter: 'time-display'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'time',
    min: definition.min,
    max: definition.max,
    validateWhileTyping: false,
    showValidationOnBlur: true,
    step: 60, // 1 minute steps
    format: definition.format || 'HH:MM'
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: false,
    supportsAggregation: false,
    requiresSpecialEditor: true,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} time input`,
    ariaDescription: `Enter a time in HH:MM format${definition.min || definition.max ? 
      ` between ${definition.min || '00:00'} and ${definition.max || '23:59'}` : ''}`,
    role: 'textbox',
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