/**
 * Status Field Type
 * 
 * Universal workflow status field with semantic categories.
 * Unlike custom_option_reference, status has built-in workflow logic:
 * - not_active: not_started, draft, scheduled, uploading, open
 * - in_progress: active, review, processing, paused
 * - done: done, published, completed, available, complete, resolved
 * - closed: cancelled, archived, closed, blocked, inactive
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
  return definition.defaultValue || 'draft';
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

  // Status fields now require status sets - no backward compatibility
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

  const allowedStatuses = context.statusSetValues.map((sv: any) => sv.value);
  
  if (!allowedStatuses.includes(status)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_STATUS',
      message: `${definition.name} must be one of: ${allowedStatuses.join(', ')}`,
      value: status,
      allowedValues: allowedStatuses
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
  const defaultValue = definition.defaultValue || 'draft';
  return `'${defaultValue}'`;
}

// Enhanced metadata methods for UI integration
export function getValidationMetadata(definition: FieldDefinition, context?: any): ValidationMetadata {
  // Status fields require status sets - no fallbacks
  const allowedStatuses = context?.statusSetValues ? 
    context.statusSetValues.map((sv: any) => sv.value) : [];
  
  return {
    enum: allowedStatuses,
    isStatus: true,
    hasWorkflowLogic: true,
    workflowCategories: ['not_active', 'in_progress', 'done', 'closed'],
    statusSetId: definition.statusSetId,
    messages: {
      required: `${definition.name} status is required`,
      enum: 'Please select a valid status',
      custom: {
        INVALID_STATUS: `${definition.name} must be a valid status`,
        INVALID_TRANSITION: 'Invalid workflow transition'
      }
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 130,
    minWidth: 110,
    textAlign: 'center',
    format: 'status',
    showTooltip: true,
    placeholder: 'Select status',
    // Status-specific styling
    conditionalFormatting: [
      // Active/Success states
      { condition: 'value === "active"', className: 'status-active', style: { color: '#059669', backgroundColor: '#d1fae5' } },
      { condition: 'value === "done"', className: 'status-done', style: { color: '#059669', backgroundColor: '#d1fae5' } },
      { condition: 'value === "completed"', className: 'status-completed', style: { color: '#059669', backgroundColor: '#d1fae5' } },
      { condition: 'value === "published"', className: 'status-published', style: { color: '#059669', backgroundColor: '#d1fae5' } },
      
      // Warning/Progress states
      { condition: 'value === "review"', className: 'status-review', style: { color: '#d97706', backgroundColor: '#fef3c7' } },
      { condition: 'value === "paused"', className: 'status-paused', style: { color: '#d97706', backgroundColor: '#fef3c7' } },
      { condition: 'value === "blocked"', className: 'status-blocked', style: { color: '#dc2626', backgroundColor: '#fee2e2' } },
      
      // Inactive/Draft states
      { condition: 'value === "draft"', className: 'status-draft', style: { color: '#6b7280', backgroundColor: '#f3f4f6' } },
      { condition: 'value === "inactive"', className: 'status-inactive', style: { color: '#6b7280', backgroundColor: '#f3f4f6' } },
      { condition: 'value === "not_started"', className: 'status-not-started', style: { color: '#6b7280', backgroundColor: '#f3f4f6' } },
      
      // End states
      { condition: 'value === "archived"', className: 'status-archived', style: { color: '#4b5563', backgroundColor: '#e5e7eb' } },
      { condition: 'value === "cancelled"', className: 'status-cancelled', style: { color: '#6b7280', backgroundColor: '#f9fafb' } }
    ]
  };
}

export function getEditorMetadata(definition: FieldDefinition, context?: any): EditorMetadata {
  // Status fields require status sets - generate options from status set values only
  const statusOptions = context?.statusSetValues ? 
    context.statusSetValues.map((sv: any) => ({
      value: sv.value,
      label: sv.label,
      color: sv.color,
      backgroundColor: sv.backgroundColor,
      icon: sv.icon,
      workflowCategory: sv.workflowCategory
    })) : [];
  
  return {
    type: 'status-select',
    searchable: false,
    clearable: !definition.required,
    showValidationOnBlur: true,
    showStatusColors: true,
    showStatusIcons: true,
    groupByWorkflowCategory: true,
    showWorkflowTransitions: true,
    statusSetId: definition.statusSetId,
    options: statusOptions,
    placeholder: 'Select status...'
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
    requiresSpecialEditor: true, // Needs status selector with colors
    hasRichDisplay: true, // Color-coded display with badges
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} status`,
    ariaDescription: 'Select status from available workflow states',
    role: 'combobox'
  };
}

// NOTE: getStatusConfig helper function removed - 
// Status sets now provide canonical status configuration (label, color, icon, etc.)

// NOTE: Workflow category and transition functions removed - 
// Status sets now provide canonical workflowCategory information

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