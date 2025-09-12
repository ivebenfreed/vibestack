/**
 * Multi Select Field - all multi select field logic in one place
 */

import type { FieldDefinition } from '../services/FieldManager';

export function getDefaultValue(definition: FieldDefinition): any {
  if (definition.defaultValue !== undefined) {
    return Array.isArray(definition.defaultValue) ? definition.defaultValue : [definition.defaultValue];
  }
  return [];
}

export function validate(value: any, definition: FieldDefinition, context: any): { valid: boolean; errors: any[]; transformedValue?: any } {
  const errors: any[] = [];
  
  // Required validation
  if (definition.required && (!value || (Array.isArray(value) && value.length === 0))) {
    errors.push({
      field: definition.name,
      code: 'REQUIRED_FIELD',
      message: `Field '${definition.name}' is required`,
      value
    });
    return { valid: false, errors };
  }

  // Ensure array format (handle empty arrays properly)
  let arrayValue = Array.isArray(value) ? value : (value ? [value] : []);
  
  // Convert all values to strings
  arrayValue = arrayValue.map(v => String(v));

  // Min/max selection validation (check this FIRST, even for empty arrays)
  if (definition.min !== undefined && arrayValue.length < definition.min) {
    errors.push({
      field: definition.name,
      code: 'MIN_SELECTIONS',
      message: `Field '${definition.name}' must have at least ${definition.min} selections`,
      value: arrayValue.length,
      constraint: definition.min
    });
  }

  if (definition.max !== undefined && arrayValue.length > definition.max) {
    errors.push({
      field: definition.name,
      code: 'MAX_SELECTIONS',
      message: `Field '${definition.name}' must have no more than ${definition.max} selections`,
      value: arrayValue.length,
      constraint: definition.max
    });
  }

  // Early return for empty arrays (after min validation)
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return { valid: errors.length === 0, errors, transformedValue: [] };
  }

  // Enum validation - all values must be in allowed options
  if (definition.enum && definition.enum.length > 0) {
    const invalidValues = arrayValue.filter(val => !definition.enum!.includes(val));
    if (invalidValues.length > 0) {
      errors.push({
        field: definition.name,
        code: 'INVALID_OPTIONS',
        message: `Field '${definition.name}' contains invalid options: ${invalidValues.join(', ')}. Must be from: ${definition.enum.join(', ')}`,
        value: invalidValues,
        constraint: definition.enum
      });
    }
  }

  // Remove duplicates
  const uniqueValues = [...new Set(arrayValue)];

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: uniqueValues
  };
}

export function getSqlType(definition: FieldDefinition): string {
  // Multi-select stored as JSONB array
  return 'JSONB';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = definition.defaultValue;
  if (defaultValue === undefined || defaultValue === null) {
    return "'[]'::jsonb";
  }
  
  if (Array.isArray(defaultValue)) {
    return `'${JSON.stringify(defaultValue)}'::jsonb`;
  }
  
  return `'["${String(defaultValue)}"]'::jsonb`;
}

/**
 * Enhanced metadata methods for UI integration
 */
export function getValidationMetadata(definition: FieldDefinition) {
  return {
    messages: {
      required: `${definition.name} is required`,
      minSelections: definition.min ? `Select at least ${definition.min} options` : undefined,
      maxSelections: definition.max ? `Select no more than ${definition.max} options` : undefined,
      invalidOptions: definition.enum ? `Must select from: ${definition.enum.join(', ')}` : undefined
    },
    constraints: {
      min: definition.min,
      max: definition.max,
      enum: definition.enum
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition) {
  return {
    width: 250,
    textAlign: 'left' as const,
    format: 'tags',
    maxDisplayItems: 3,
    showBadges: true,
    compactMode: true,
    tooltipContent: `Multi-select field with ${definition.enum?.length || 0} available options`
  };
}

export function getEditorMetadata(definition: FieldDefinition) {
  const options = definition.enum ? definition.enum.map((value: string) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1), // Capitalize first letter
    color: getTagColor(value), // Generate colors for tags
    backgroundColor: getTagBackgroundColor(getTagColor(value))
  })) : [];

  return {
    type: 'multi-select' as const,
    searchable: true,
    clearable: true,
    showValidationOnBlur: true,
    multiple: true,
    maxSelections: definition.max,
    minSelections: definition.min,
    options
  };
}

export function getCapabilities() {
  return {
    supportsSorting: false, // Multi-select arrays don't sort well
    supportsFiltering: true,
    supportsGrouping: false,
    supportsAggregation: false,
    requiresSpecialEditor: true,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: true,
    isMultiValue: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition) {
  return {
    ariaLabel: `${definition.name} multi-select tags`,
    ariaDescription: `Select multiple options from ${definition.enum?.length || 0} available choices`,
    role: 'combobox',
    ariaMultiselectable: true
  };
}

/**
 * Generate colors for tag values based on hash of the value
 */
function getTagColor(value: string): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // yellow
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#6b7280'  // gray
  ];
  
  // Simple hash function to assign consistent colors
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) & 0xffffffff;
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Generate background color from foreground color
 */
function getTagBackgroundColor(color: string): string {
  const colorMap: Record<string, string> = {
    '#3b82f6': '#dbeafe', // blue
    '#10b981': '#d1fae5', // emerald  
    '#f59e0b': '#fef3c7', // yellow
    '#ef4444': '#fee2e2', // red
    '#8b5cf6': '#ede9fe', // violet
    '#06b6d4': '#cffafe', // cyan
    '#84cc16': '#ecfccb', // lime
    '#f97316': '#fed7aa', // orange
    '#ec4899': '#fce7f3', // pink
    '#6b7280': '#f3f4f6'  // gray
  };
  
  return colorMap[color] || '#f3f4f6';
}