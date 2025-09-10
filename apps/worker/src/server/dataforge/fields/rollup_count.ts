/**
 * Rollup Count Field Handler - Frontend Calculation
 * 
 * Provides configuration for frontend calculation of count aggregations.
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
  return 0; // Default count is always 0
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
    transformedValue: typeof value === 'number' ? Math.max(0, Math.floor(value)) : 0
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
    calculationType: 'count',
    sourceRelationship: config.relationshipType || 'relates_to',
    sourceEntityType: config.targetEntityType || 'Unknown',
    sourceField: 'id', // Count records, not a specific field
    conditions: config.conditions || {},
    aggregationFunction: 'count',
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
      calculation: 'This field shows the count of related records'
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  const config = definition.rollupConfig || {};
  
  return {
    width: 100,
    minWidth: 80,
    textAlign: 'center',
    format: 'integer',
    showCalculationIndicator: true,
    isReadOnly: true,
    refreshOnDependencyChange: true,
    placeholder: '0',
    showTooltip: true,
    tooltipContent: `Count of related ${config.targetEntityType || 'records'}`
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'calculated-display',
    readOnly: true,
    showCalculationStatus: true,
    showRefreshButton: false, // Auto-refreshes
    calculationIndicator: 'count'
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true, // Count fields are good for grouping
    supportsAggregation: true, // Can aggregate counts (sum of counts)
    requiresSpecialEditor: true, // Needs read-only calculated display
    hasRichDisplay: true, // Shows calculation status
    supportsValidation: false, // No user input validation
    supportsFormatting: true,
    isCalculatedField: true,
    isRollupField: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  const config = definition.rollupConfig || {};
  
  return {
    ariaLabel: `${definition.name} calculated count field`,
    ariaDescription: `Automatically calculated count of related ${config.targetEntityType || 'records'}. This field is read-only.`,
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