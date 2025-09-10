/**
 * Status Field Handler
 * 
 * Handles status fields with workflow states and enhanced UI integration.
 * Uses single-select pattern with semantic status states.
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

  // Get allowed statuses from field definition or use defaults
  const allowedStatuses = definition.enum || [
    'draft', 'active', 'inactive', 'archived', 
    'not_started', 'done', 'blocked', 'cancelled',
    'review', 'published', 'completed', 'paused'
  ];
  
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
export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const allowedStatuses = definition.enum || [
    'draft', 'active', 'inactive', 'archived', 
    'not_started', 'done', 'blocked', 'cancelled'
  ];
  
  return {
    enum: allowedStatuses,
    messages: {
      required: `${definition.name} is required`,
      enum: 'Please select a valid status',
      custom: {
        INVALID_STATUS: `${definition.name} must be a valid status`
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

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  // Generate status options based on field definition or defaults
  const statusOptions = (definition.enum || [
    'draft', 'active', 'inactive', 'archived'
  ]).map(status => {
    const statusConfig = getStatusConfig(status);
    return {
      value: status,
      label: statusConfig.label,
      color: statusConfig.color,
      backgroundColor: statusConfig.backgroundColor,
      icon: statusConfig.icon
    };
  });
  
  return {
    type: 'select',
    searchable: false,
    clearable: !definition.required,
    showValidationOnBlur: true,
    options: statusOptions
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false,
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

// Helper function for status configuration
function getStatusConfig(status: string): { label: string; color: string; backgroundColor: string; icon: string } {
  const statusConfigs: Record<string, { label: string; color: string; backgroundColor: string; icon: string }> = {
    // Active/Success states
    active: { label: 'Active', color: '#059669', backgroundColor: '#d1fae5', icon: 'check-circle' },
    done: { label: 'Done', color: '#059669', backgroundColor: '#d1fae5', icon: 'check-circle' },
    completed: { label: 'Completed', color: '#059669', backgroundColor: '#d1fae5', icon: 'check-circle' },
    published: { label: 'Published', color: '#059669', backgroundColor: '#d1fae5', icon: 'check-circle' },
    
    // Warning/Progress states  
    review: { label: 'In Review', color: '#d97706', backgroundColor: '#fef3c7', icon: 'clock' },
    paused: { label: 'Paused', color: '#d97706', backgroundColor: '#fef3c7', icon: 'pause-circle' },
    blocked: { label: 'Blocked', color: '#dc2626', backgroundColor: '#fee2e2', icon: 'x-circle' },
    
    // Inactive/Draft states
    draft: { label: 'Draft', color: '#6b7280', backgroundColor: '#f3f4f6', icon: 'edit' },
    inactive: { label: 'Inactive', color: '#6b7280', backgroundColor: '#f3f4f6', icon: 'pause' },
    not_started: { label: 'Not Started', color: '#6b7280', backgroundColor: '#f3f4f6', icon: 'circle' },
    
    // End states
    archived: { label: 'Archived', color: '#4b5563', backgroundColor: '#e5e7eb', icon: 'archive' },
    cancelled: { label: 'Cancelled', color: '#6b7280', backgroundColor: '#f9fafb', icon: 'x' }
  };
  
  return statusConfigs[status] || { label: status.charAt(0).toUpperCase() + status.slice(1), color: '#6b7280', backgroundColor: '#f3f4f6', icon: 'circle' };
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