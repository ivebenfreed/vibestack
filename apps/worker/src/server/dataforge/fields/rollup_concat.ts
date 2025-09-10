/**
 * Rollup Concat Field Handler - Frontend Calculation
 * 
 * Provides configuration for frontend calculation of text concatenation from related records.
 * Values are calculated in real-time from related records, not stored in database.
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
import type { CalculationMetadata } from './rollup_sum';

export function getDefaultValue(definition: FieldDefinition): any {
  return ''; // Default concatenation is always empty string
}

export function validate(value: any, definition: FieldDefinition, context: any): { 
  valid: boolean; 
  errors: any[]; 
  transformedValue?: any; 
} {
  // Rollup fields are read-only calculated values
  return {
    valid: true,
    errors: [],
    transformedValue: typeof value === 'string' ? value : String(value || '')
  };
}

// Rollup fields don't create database columns - they're calculated frontend values
export function getSqlType(definition: FieldDefinition): string | null {
  return null; // No database storage
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  return null; // No database storage
}

// Frontend calculation metadata
export function getCalculationMetadata(definition: FieldDefinition): CalculationMetadata {
  const config = definition.rollupConfig || {};
  
  return {
    calculationType: 'concat',
    sourceRelationship: config.relationshipType || 'relates_to',
    sourceEntityType: config.targetEntityType || 'Unknown',
    sourceField: config.targetField || 'name',
    conditions: config.conditions || {},
    aggregationFunction: 'concat',
    realTimeUpdates: true
  };
}

// Enhanced metadata methods for UI integration
export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  return {
    readOnly: true,
    calculatedField: true,
    messages: {
      readOnly: `${definition.name} is automatically calculated and cannot be edited`,
      calculation: 'This field shows concatenated text from related records'
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  const config = definition.rollupConfig || {};
  
  return {
    width: 200,
    minWidth: 150,
    textAlign: 'left',
    format: 'text',
    showCalculationIndicator: true,
    isReadOnly: true,
    refreshOnDependencyChange: true,
    placeholder: '',
    showTooltip: true,
    tooltipContent: `Concatenated ${config.targetField || 'values'} from related ${config.targetEntityType || 'records'} (separated by "${config.separator || ', '}")`
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'calculated-display',
    readOnly: true,
    showCalculationStatus: true,
    showRefreshButton: false, // Auto-refreshes
    calculationIndicator: 'concat'
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true, // Text fields are good for grouping
    supportsAggregation: false, // No aggregation of concatenated text
    requiresSpecialEditor: true, // Needs read-only calculated display
    hasRichDisplay: true, // Shows calculation status
    supportsValidation: false, // No user input validation
    supportsFormatting: false, // Simple text display
    isCalculatedField: true,
    isRollupField: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  const config = definition.rollupConfig || {};
  
  return {
    ariaLabel: `${definition.name} calculated concatenated text field`,
    ariaDescription: `Automatically calculated concatenation of ${config.targetField || 'values'} from related ${config.targetEntityType || 'records'}. This field is read-only.`,
    role: 'status',
    ariaLive: 'polite' // Announces when value changes
  };
}

/**
 * Check if this is a rollup field type
 */
export function isRollupField(): boolean {
  return true;
}

/**
 * Get rollup configuration for frontend calculation
 */
export function getRollupConfig(definition: FieldDefinition): any {
  return getCalculationMetadata(definition);
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
  // Rollup-specific methods
  isRollupField,
  getRollupConfig,
  getCalculationMetadata
};