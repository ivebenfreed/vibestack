/**
 * Priority Field Handler
 * 
 * Handles priority fields with predefined priority levels and enhanced UI integration.
 * Uses single-select pattern with semantic priority levels.
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
  return definition.defaultValue || 'medium';
}

export function validate(value: any, definition: FieldDefinition, context: any): { 
  valid: boolean; 
  errors: any[]; 
  transformedValue?: any; 
} {
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
  let priority: string;
  if (typeof value === 'string') {
    priority = value.toLowerCase();
  } else {
    priority = String(value).toLowerCase();
  }

  // Validate against allowed priority levels
  const allowedPriorities = ['low', 'medium', 'high', 'critical'];
  if (!allowedPriorities.includes(priority)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_PRIORITY',
      message: `${definition.name} must be one of: ${allowedPriorities.join(', ')}`,
      value: priority,
      allowedValues: allowedPriorities
    });
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    transformedValue: priority
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue || 'medium';
  return `'${defaultValue}'`;
}

// Enhanced metadata methods for UI integration
export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  return {
    enum: ['low', 'medium', 'high', 'critical'],
    messages: {
      required: `${definition.name} is required`,
      enum: 'Please select a valid priority level',
      custom: {
        INVALID_PRIORITY: `${definition.name} must be low, medium, high, or critical`
      }
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 120,
    minWidth: 100,
    textAlign: 'center',
    format: 'priority',
    showTooltip: true,
    placeholder: 'Select priority',
    // Priority-specific styling
    conditionalFormatting: [
      { condition: 'value === "critical"', className: 'priority-critical', style: { color: '#dc2626', fontWeight: 'bold' } },
      { condition: 'value === "high"', className: 'priority-high', style: { color: '#ea580c', fontWeight: 'semibold' } },
      { condition: 'value === "medium"', className: 'priority-medium', style: { color: '#d97706' } },
      { condition: 'value === "low"', className: 'priority-low', style: { color: '#65a30d' } }
    ]
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'select',
    searchable: false,
    clearable: !definition.required,
    showValidationOnBlur: true,
    // Priority options with styling
    options: [
      { value: 'low', label: 'Low', color: '#65a30d', icon: 'arrow-down' },
      { value: 'medium', label: 'Medium', color: '#d97706', icon: 'minus' },
      { value: 'high', label: 'High', color: '#ea580c', icon: 'arrow-up' },
      { value: 'critical', label: 'Critical', color: '#dc2626', icon: 'alert-triangle' }
    ]
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false,
    requiresSpecialEditor: true, // Needs priority selector
    hasRichDisplay: true, // Color-coded display
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} priority level`,
    ariaDescription: 'Select priority level: Low, Medium, High, or Critical',
    role: 'combobox'
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