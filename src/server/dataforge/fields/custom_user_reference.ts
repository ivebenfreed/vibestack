/**
 * Custom User Reference Field Handler
 * 
 * Allows dynamic user reference relationships with configurable relationship types.
 * Creates relationships in per-org relationship tables instead of database columns.
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
import { RelationshipFieldHandler } from '../services/RelationshipFieldHandler';

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

  // Handle array for multi-user references
  if (Array.isArray(value)) {
    for (const userId of value) {
      if (typeof userId !== 'string' || !userId.trim()) {
        errors.push({
          field: definition.name,
          code: 'INVALID_USER_ID',
          message: `Invalid user ID in ${definition.name}`,
          value: userId
        });
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      transformedValue: value.filter(id => typeof id === 'string' && id.trim())
    };
  }

  // Handle single user reference
  if (typeof value !== 'string' || !value.trim()) {
    errors.push({
      field: definition.name,
      code: 'INVALID_USER_ID',
      message: `${definition.name} must be a valid user ID`,
      value
    });
    return { valid: false, errors };
  }

  // Validate relationship type configuration
  const relationshipType = definition.relationshipType || 'relates_to';
  const allowedTypes = [
    'assigned_to', 'owned_by', 'created_by', 'authored_by', 'uploaded_by',
    'managed_by', 'reported_by', 'approved_by', 'performed_by', 'relates_to'
  ];
  
  if (!allowedTypes.includes(relationshipType)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_RELATIONSHIP_TYPE',
      message: `Invalid relationship type '${relationshipType}' for ${definition.name}`,
      value: relationshipType,
      allowedTypes
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: value.trim()
  };
}

// Custom user references are stored in relationship tables, not as columns
export function getSqlType(definition: FieldDefinition): string | null {
  return null; // No column created - stored in relationship table
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  return null; // No column created
}

/**
 * Check if this is a relationship field type
 */
export function isRelationshipField(): boolean {
  return true;
}

/**
 * Get relationship metadata for this field
 */
export function getRelationshipMetadata(fieldName: string, definition: FieldDefinition, entityName: string): any {
  return RelationshipFieldHandler.convertToRelationshipMetadata(
    fieldName,
    'user_reference',
    entityName
  );
}

// NEW: Enhanced metadata methods for UI integration
export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const relationshipType = definition.relationshipType || 'assigned_to';
  
  return {
    userReference: true,
    relationshipType: relationshipType,
    cardinality: definition.cardinality || 'many-to-one',
    messages: {
      required: `${definition.name} is required`,
      invalid: 'Please select a valid user',
      custom: {
        INVALID_USER_ID: `${definition.name} must be a valid user ID`,
        INVALID_RELATIONSHIP_TYPE: `Invalid relationship type for ${definition.name}`,
        INVALID_CARDINALITY: `Invalid cardinality for ${definition.name}`
      }
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 180,
    minWidth: 120,
    textAlign: 'left',
    showTooltip: true,
    placeholder: 'Select User',
    format: 'user-reference',
    relationshipType: definition.relationshipType || 'assigned_to'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  const isMultiple = definition.cardinality === 'one-to-many' || definition.cardinality === 'many-to-many';
  
  return {
    type: 'user-selector',
    multiple: isMultiple,
    searchable: true,
    clearable: !definition.required,
    showValidationOnBlur: true,
    showAvatar: true,
    relationshipContext: {
      relationshipType: definition.relationshipType || 'assigned_to',
      cardinality: definition.cardinality || 'many-to-one'
    }
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false, // No aggregation for relationships
    requiresSpecialEditor: true, // Needs user selector
    hasRichDisplay: true, // Shows user names/avatars, not IDs
    supportsValidation: true,
    supportsFormatting: false,
    isRelationshipField: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  const relationshipType = definition.relationshipType || 'assigned_to';
  
  return {
    ariaLabel: `${definition.name} - select user for ${relationshipType} relationship`,
    ariaDescription: `Choose one or more users to establish ${relationshipType} relationship`,
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
  getAccessibilityMetadata,
  // Relationship-specific methods
  isRelationshipField,
  getRelationshipMetadata
};