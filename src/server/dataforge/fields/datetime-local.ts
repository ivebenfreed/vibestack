/**
 * Enhanced DateTime-Local Field Handler
 * 
 * Combined date and time input with timezone handling and business validation
 * Enhanced with rich UI metadata for datetime picker components
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  if (definition.defaultValue !== undefined) {
    return definition.defaultValue;
  }
  return null;
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

  // Convert to Date object
  let dateTime: Date;
  
  try {
    dateTime = new Date(value);
    if (isNaN(dateTime.getTime())) {
      errors.push(`Field '${definition.name}' must be a valid datetime`);
      return { valid: false, errors };
    }
  } catch (error) {
    errors.push(`Field '${definition.name}' must be a valid datetime`);
    return { valid: false, errors };
  }

  // Business hours validation if specified
  if (definition.businessHoursOnly) {
    const hour = dateTime.getHours();
    const startHour = definition.businessStart || 9;
    const endHour = definition.businessEnd || 17;
    
    if (hour < startHour || hour >= endHour) {
      errors.push(`Field '${definition.name}' must be within business hours (${startHour}:00 - ${endHour}:00)`);
    }
  }

  // Weekend validation if specified
  if (definition.weekdaysOnly) {
    const dayOfWeek = dateTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
      errors.push(`Field '${definition.name}' must be on a weekday`);
    }
  }

  // Future date validation
  if (definition.futureOnly) {
    const now = new Date();
    if (dateTime <= now) {
      errors.push(`Field '${definition.name}' must be in the future`);
    }
  }

  // Past date validation
  if (definition.pastOnly) {
    const now = new Date();
    if (dateTime >= now) {
      errors.push(`Field '${definition.name}' must be in the past`);
    }
  }

  // Min/max datetime validation
  if (definition.min) {
    const minDate = new Date(definition.min);
    if (dateTime < minDate) {
      errors.push(`Field '${definition.name}' must be after ${minDate.toLocaleString()}`);
    }
  }

  if (definition.max) {
    const maxDate = new Date(definition.max);
    if (dateTime > maxDate) {
      errors.push(`Field '${definition.name}' must be before ${maxDate.toLocaleString()}`);
    }
  }

  // Cross-field validation for start/end dates
  if (context && definition.name.includes('start') && context.end_datetime) {
    const endDate = new Date(context.end_datetime);
    if (dateTime >= endDate) {
      errors.push(`Field '${definition.name}' must be before end datetime`);
    }
  }

  if (context && definition.name.includes('end') && context.start_datetime) {
    const startDate = new Date(context.start_datetime);
    if (dateTime <= startDate) {
      errors.push(`Field '${definition.name}' must be after start datetime`);
    }
  }

  // Convert to ISO string for consistent storage
  const isoString = dateTime.toISOString();

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: isoString
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'TIMESTAMP WITH TIME ZONE';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultVal = getDefaultValue(definition);
  if (defaultVal) {
    if (defaultVal === 'now') {
      return 'now()';
    }
    const date = new Date(defaultVal);
    return `'${date.toISOString()}'`;
  }
  return definition.required ? null : 'NULL';
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const messages = {
    required: `${definition.name} is required`,
    custom: {
      INVALID_DATETIME: `${definition.name} must be a valid date and time`,
      OUTSIDE_BUSINESS_HOURS: `Date must be within business hours (${definition.businessStart || 9}:00 - ${definition.businessEnd || 17}:00)`,
      WEEKEND_NOT_ALLOWED: `${definition.name} must be on a weekday`,
      MUST_BE_FUTURE: `${definition.name} must be in the future`,
      MUST_BE_PAST: `${definition.name} must be in the past`,
      BEFORE_MIN_DATE: `${definition.name} must be after minimum date`,
      AFTER_MAX_DATE: `${definition.name} must be before maximum date`,
      START_AFTER_END: 'Start datetime must be before end datetime',
      END_BEFORE_START: 'End datetime must be after start datetime'
    }
  };

  return {
    required: definition.required || false,
    min: definition.min,
    max: definition.max,
    businessHoursOnly: definition.businessHoursOnly || false,
    weekdaysOnly: definition.weekdaysOnly || false,
    futureOnly: definition.futureOnly || false,
    pastOnly: definition.pastOnly || false,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 180,
    minWidth: 160,
    textAlign: 'left',
    format: 'datetime',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: 'Select date & time',
    customFormatter: 'datetime-local',
    dateFormat: definition.dateFormat || 'MMM dd, yyyy',
    timeFormat: definition.timeFormat || 'HH:mm'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'datetime-local',
    showSeconds: definition.showSeconds || false,
    use24Hour: definition.use24Hour || true,
    enableTimeZone: definition.enableTimeZone || false,
    businessHoursOnly: definition.businessHoursOnly || false,
    weekdaysOnly: definition.weekdaysOnly || false,
    futureOnly: definition.futureOnly || false,
    pastOnly: definition.pastOnly || false,
    min: definition.min,
    max: definition.max,
    step: definition.step || 1, // minutes
    validateWhileTyping: false,
    showValidationOnBlur: true
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false,
    requiresSpecialEditor: true,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} date and time picker`,
    ariaDescription: `Select date and time for ${definition.name}. Use keyboard navigation or click to open calendar`,
    role: 'textbox',
    ariaRequired: definition.required || false,
    ariaInvalid: false,
    ariaHasPopup: 'dialog'
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