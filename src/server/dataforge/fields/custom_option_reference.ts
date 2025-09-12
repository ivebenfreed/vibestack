/**
 * Custom Option Reference Field Type
 * 
 * References custom option sets with organization-specific options.
 * Used for archetype status, priority, and other enum-like fields.
 */

import type { FieldDefinition, EnhancedFieldHandler } from './types';

export function validate(value: any, definition: FieldDefinition, context: any): {
  valid: boolean;
  errors: any[];
  transformedValue?: any;
} {
  if (value === null || value === undefined) {
    if (definition.required) {
      return {
        valid: false,
        errors: [`Field '${definition.name}' is required`]
      };
    }
    return { valid: true, errors: [] };
  }

  // Value should be a string that matches one of the custom option values
  if (typeof value !== 'string') {
    return {
      valid: false,
      errors: [`Field '${definition.name}' must be a string option value`]
    };
  }

  // TODO: In full implementation, validate against actual custom options for org
  // For now, accept any string value
  return {
    valid: true,
    errors: [],
    transformedValue: value
  };
}

export function getDefaultValue(definition: FieldDefinition): any {
  // Default value will be resolved from custom option set at runtime
  return definition.defaultValue || null;
}

export function getSqlType(definition: FieldDefinition): string {
  // Store as TEXT - the option value
  return 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultValue = getDefaultValue(definition);
  if (defaultValue === null || defaultValue === undefined) {
    return null;
  }
  return `'${defaultValue}'`;
}

// Enhanced metadata methods for UI integration
export function getValidationMetadata(definition: FieldDefinition) {
  return {
    required: definition.required || false,
    optionReference: true,
    optionSetType: definition.optionSetType,
    archetype: definition.archetype,
    messages: {
      required: `${definition.name} selection is required`,
      invalid: `Please select a valid ${definition.optionSetType} option`
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition) {
  return {
    width: 120,
    textAlign: 'left' as const,
    format: 'option-badge' as const,
    showIcon: true,
    showColor: true,
    truncate: false,
    tooltipContent: `${definition.optionSetType} option from ${definition.archetype} archetype`
  };
}

export function getEditorMetadata(definition: FieldDefinition) {
  return {
    type: 'option-select' as const,
    searchable: false,
    clearable: !definition.required,
    showValidationOnBlur: true,
    showOptionColors: true,
    showOptionIcons: true,
    optionSetType: definition.optionSetType,
    archetype: definition.archetype,
    placeholder: `Select ${definition.optionSetType}...`
  };
}

export function getCapabilities() {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false,
    isOptionReference: true,
    requiresCustomOptions: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition) {
  return {
    ariaLabel: `${definition.name} ${definition.optionSetType} option`,
    ariaDescription: `Select ${definition.optionSetType} option for this ${definition.archetype}`,
    role: 'combobox' as const,
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