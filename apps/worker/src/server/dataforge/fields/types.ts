/**
 * Enhanced Field Handler Types
 * 
 * Comprehensive metadata interfaces for rich frontend data grid support
 */

import type { FieldDefinition } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  transformedValue?: any;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
  constraint?: any;
  pattern?: string;
}

export interface ValidationMetadata {
  // Basic constraints
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  precision?: number;
  
  // Type-specific validation flags
  emailFormat?: boolean;
  urlProtocols?: string[];
  phoneFormat?: 'international' | 'national' | 'e164';
  colorFormats?: ('hex' | 'rgb' | 'hsl' | 'named')[];
  currencyCode?: string;
  fileMaxSize?: number;
  fileAllowedTypes?: string[];
  
  // Business logic validation
  businessRules?: {
    mustBeBefore?: string;
    mustBeAfter?: string;
    dependsOn?: string[];
    conditionalRequired?: {
      when: string;
      equals: any;
    };
  };
  
  // Custom validation messages
  messages?: {
    required?: string;
    pattern?: string;
    min?: string;
    max?: string;
    custom?: Record<string, string>;
  };
}

export interface DisplayMetadata {
  // Column properties
  label?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  
  // Cell formatting
  format?: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold';
  
  // Visual enhancements
  showColorPreview?: boolean;
  showFilePreview?: boolean;
  truncateAt?: number;
  showTooltip?: boolean;
  
  // Conditional styling
  conditionalFormatting?: {
    condition: string;
    className: string;
    style?: Record<string, string>;
  }[];
}

export interface EditorMetadata {
  type: 'text' | 'textarea' | 'select' | 'multi-select' | 'date' | 'datetime' | 
        'file' | 'color' | 'currency' | 'phone' | 'email' | 'url' | 
        'relationship-select' | 'computed' | 'rollup' | 'number' | 'boolean';
  
  // Editor-specific settings
  multiline?: boolean;
  rows?: number;
  cols?: number;
  maxFiles?: number;
  acceptTypes?: string[];
  allowClear?: boolean;
  searchable?: boolean;
  creatable?: boolean;
  
  // Rich text editor
  richTextFeatures?: ('bold' | 'italic' | 'underline' | 'link' | 'list')[];
  
  // Date/time picker
  dateFormat?: string;
  timeFormat?: string;
  showTime?: boolean;
  minDate?: string;
  maxDate?: string;
  
  // Number input
  step?: number;
  showSpinners?: boolean;
  
  // Validation UI
  showValidationOnBlur?: boolean;
  showValidationOnChange?: boolean;
  validateWhileTyping?: boolean;
}

export interface FieldCapabilities {
  supportsSorting: boolean;
  supportsFiltering: boolean;
  supportsGrouping: boolean;
  supportsAggregation: boolean;
  requiresSpecialEditor: boolean;
  hasRichDisplay: boolean;
  supportsValidation: boolean;
  supportsFormatting: boolean;
}

export interface AccessibilityMetadata {
  ariaLabel?: string;
  ariaDescription?: string;
  tabIndex?: number;
  role?: string;
}

/**
 * Enhanced Field Handler Interface
 * 
 * Each field handler must implement all methods for comprehensive metadata extraction
 */
export interface EnhancedFieldHandler {
  // Original methods (preserved for compatibility)
  validate(value: any, definition: FieldDefinition, context: any): ValidationResult;
  getDefaultValue(definition: FieldDefinition): any;
  getSqlType(definition: FieldDefinition): string;
  getSqlDefault(definition: FieldDefinition): string | null;
  
  // NEW: Rich metadata extraction methods
  getValidationMetadata(definition: FieldDefinition): ValidationMetadata;
  getDisplayMetadata(definition: FieldDefinition): DisplayMetadata;
  getEditorMetadata(definition: FieldDefinition): EditorMetadata;
  getCapabilities(): FieldCapabilities;
  getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata;
}

/**
 * Enhanced Enum Option with rich metadata
 */
export interface EnhancedEnumOption {
  value: string;
  label: string;
  color?: string;
  backgroundColor?: string;
  icon?: string;
  iconColor?: string;
  group?: string;
  disabled?: boolean;
  description?: string;
  sortOrder?: number;
  metadata?: Record<string, any>;
}

/**
 * Relationship Configuration for reference fields
 */
export interface RelationshipMetadata {
  type: 'user_reference' | 'entity_reference' | 'custom_user_reference' | 'custom_entity_reference';
  targetEntityType?: string;
  cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  displayField?: string;
  searchFields?: string[];
  filterBy?: Record<string, any>;
  sortBy?: string;
  allowCreate?: boolean;
  createTemplate?: Record<string, any>;
  cascadeDelete?: boolean;
}

/**
 * Computed Field Configuration
 */
export interface ComputedMetadata {
  expression: string;
  dependencies: string[];
  resultType: string;
  refreshTriggers: ('field_changed' | 'record_created' | 'record_updated')[];
  cacheResults?: boolean;
  computeLocation: 'frontend' | 'backend' | 'both';
  debugMode?: boolean;
}

/**
 * Rollup Field Configuration
 */
export interface RollupMetadata {
  type: 'count' | 'sum' | 'average' | 'concat' | 'min' | 'max';
  relationshipType: string;
  targetEntityType: string;
  targetField?: string;
  conditions?: Record<string, any>;
  separator?: string;
  precision?: number;
  nullHandling?: 'ignore' | 'zero' | 'empty';
}