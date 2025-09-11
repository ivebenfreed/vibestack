/**
 * Status Set Field Type
 * 
 * Field type that references a reusable status set for consistent workflow states.
 * This provides better semantic separation from legacy inline status values.
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
  return definition.defaultValue || null;
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
  let status: string;
  if (typeof value === 'string') {
    status = value.toLowerCase();
  } else {
    status = String(value).toLowerCase();
  }

  // Status set field requires statusSetId and statusSetValues from context
  if (!definition.statusSetId) {
    errors.push({
      field: definition.name,
      code: 'MISSING_STATUS_SET',
      message: `${definition.name} requires a status set to be assigned`
    });
    return { valid: false, errors };
  }

  if (!context?.statusSetValues || !Array.isArray(context.statusSetValues)) {
    errors.push({
      field: definition.name,
      code: 'MISSING_STATUS_SET_VALUES',
      message: `Status set values not found for ${definition.name}`
    });
    return { valid: false, errors };
  }

  // Validate against status set values
  const allowedStatuses = context.statusSetValues.map((sv: any) => sv.value);
  
  if (!allowedStatuses.includes(status)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_STATUS',
      message: `${definition.name} must be one of: ${allowedStatuses.join(', ')}`,
      value: status,
      allowedValues: allowedStatuses,
      statusSetId: definition.statusSetId
    });
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    transformedValue: status
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  if (definition.defaultValue) {
    return `'${definition.defaultValue}'`;
  }
  return null;
}

// Enhanced metadata methods for UI integration
export function getValidationMetadata(definition: FieldDefinition, context?: any): ValidationMetadata {
  let allowedStatuses: string[] = [];
  
  if (context?.statusSetValues) {
    allowedStatuses = context.statusSetValues.map((sv: any) => sv.value);
  }
  
  return {
    enum: allowedStatuses,
    isStatus: true,
    hasWorkflowLogic: true,
    statusSetId: definition.statusSetId,
    requiresStatusSet: true,
    messages: {
      required: `${definition.name} status is required`,
      enum: 'Please select a valid status from the status set',
      custom: {
        INVALID_STATUS: `${definition.name} must be a valid status from the assigned status set`,
        MISSING_STATUS_SET: `${definition.name} requires a status set assignment`,
        MISSING_STATUS_SET_VALUES: 'Status set values could not be loaded'
      }
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 130,
    minWidth: 110,
    textAlign: 'center',
    format: 'status-set',
    showTooltip: true,
    placeholder: 'Select status',
    statusSetId: definition.statusSetId,
    showStatusColors: true,
    showStatusIcons: true,
    groupByWorkflowCategory: true
  };
}

export function getEditorMetadata(definition: FieldDefinition, context?: any): EditorMetadata {
  // Generate status options from status set values
  let statusOptions: any[] = [];
  
  if (context?.statusSetValues) {
    statusOptions = context.statusSetValues.map((sv: any) => ({
      value: sv.value,
      label: sv.label,
      color: sv.color,
      backgroundColor: sv.backgroundColor,
      icon: sv.icon,
      workflowCategory: sv.workflowCategory
    }));
  }
  
  return {
    type: 'status-set-select',
    searchable: false,
    clearable: !definition.required,
    showValidationOnBlur: true,
    showStatusColors: true,
    showStatusIcons: true,
    groupByWorkflowCategory: true,
    showWorkflowTransitions: true,
    statusSetId: definition.statusSetId,
    options: statusOptions,
    placeholder: 'Select status...',
    requiresStatusSetAssignment: !definition.statusSetId
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false,
    isStatus: true,
    hasWorkflowLogic: true,
    supportsTransitions: true,
    requiresSpecialEditor: true, // Needs status set selector
    hasRichDisplay: true, // Color-coded display with badges
    supportsValidation: true,
    supportsFormatting: true,
    requiresStatusSet: true // Key distinction from basic status field
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} status from status set`,
    ariaDescription: 'Select status from assigned status set workflow states',
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