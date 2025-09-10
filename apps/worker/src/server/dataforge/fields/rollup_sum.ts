/**
 * Rollup Sum Field Handler - Frontend Calculation
 * 
 * Provides configuration for frontend calculation of sum aggregations.
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

export interface CalculationMetadata {
  calculationType: 'sum' | 'count' | 'average' | 'concat' | 'min' | 'max';
  sourceRelationship: string;
  sourceEntityType: string;
  sourceField: string;
  conditions?: Record<string, any>;
  aggregationFunction: string;
  realTimeUpdates: boolean;
  precision?: number;
  currency?: string;
}

export function getDefaultValue(definition: FieldDefinition): any {
  return 0; // Default sum is always 0
}

export function validate(value: any, definition: FieldDefinition, context: any): { 
  valid: boolean; 
  errors: any[]; 
  transformedValue?: any; 
} {
  // Rollup fields are read-only calculated values
  // They should not be directly validated as user input
  return {
    valid: true,
    errors: [],
    transformedValue: typeof value === 'number' ? value : 0
  };
}

// Rollup fields don't create database columns - they're calculated frontend values
export function getSqlType(definition: FieldDefinition): string | null {
  return null; // No database storage
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  return null; // No database storage
}

// NEW: Frontend calculation metadata
export function getCalculationMetadata(definition: FieldDefinition): CalculationMetadata {
  const config = definition.rollupConfig || {};
  
  return {
    calculationType: 'sum',
    sourceRelationship: config.relationshipType || 'relates_to',
    sourceEntityType: config.targetEntityType || 'Unknown',
    sourceField: config.targetField || 'amount',
    conditions: config.conditions || {},
    aggregationFunction: 'sum',
    realTimeUpdates: true,
    precision: definition.precision || 2,
    currency: definition.currency || config.currency
  };
}

// Enhanced metadata methods for UI integration
export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  return {
    readOnly: true,
    calculatedField: true,
    messages: {
      readOnly: `${definition.name} is automatically calculated and cannot be edited`,
      calculation: 'This field shows the sum of related values'
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  const config = definition.rollupConfig || {};
  const isCurrency = definition.type === 'currency' || config.currency;
  
  return {
    width: 140,
    minWidth: 100,
    textAlign: 'right',
    format: isCurrency ? 'currency' : 'number',
    precision: definition.precision || 2,
    showCalculationIndicator: true,
    isReadOnly: true,
    refreshOnDependencyChange: true,
    placeholder: isCurrency ? '$0.00' : '0',
    prefix: isCurrency ? '$' : undefined,
    showTooltip: true,
    tooltipContent: `Sum of ${config.targetField || 'values'} from related ${config.targetEntityType || 'records'}`
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'calculated-display',
    readOnly: true,
    showCalculationStatus: true,
    showRefreshButton: false, // Auto-refreshes
    calculationIndicator: 'sum'
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: false,
    supportsAggregation: true, // Can aggregate sums (sum of sums)
    requiresSpecialEditor: true, // Needs read-only calculated display
    hasRichDisplay: true, // Shows calculation status and formatting
    supportsValidation: false, // No user input validation
    supportsFormatting: true,
    isCalculatedField: true,
    isRollupField: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  const config = definition.rollupConfig || {};
  
  return {
    ariaLabel: `${definition.name} calculated sum field`,
    ariaDescription: `Automatically calculated sum of ${config.targetField || 'values'} from related ${config.targetEntityType || 'records'}. This field is read-only.`,
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