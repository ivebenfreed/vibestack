/**
 * Custom Entity Reference Field Handler
 * 
 * Allows dynamic entity reference relationships with configurable target types and relationship semantics.
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

  // Handle array for multi-entity references
  if (Array.isArray(value)) {
    for (const entityId of value) {
      if (typeof entityId !== 'string' || !entityId.trim()) {
        errors.push({
          field: definition.name,
          code: 'INVALID_ENTITY_ID',
          message: `Invalid entity ID in ${definition.name}`,
          value: entityId
        });
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      transformedValue: value.filter(id => typeof id === 'string' && id.trim())
    };
  }

  // Handle single entity reference
  if (typeof value !== 'string' || !value.trim()) {
    errors.push({
      field: definition.name,
      code: 'INVALID_ENTITY_ID',
      message: `${definition.name} must be a valid entity ID`,
      value
    });
    return { valid: false, errors };
  }

  // Validate target entity type if specified
  const targetEntityType = definition.targetEntityType;
  if (targetEntityType && typeof targetEntityType !== 'string') {
    errors.push({
      field: definition.name,
      code: 'INVALID_TARGET_TYPE',
      message: `Target entity type must be specified for ${definition.name}`,
      value: targetEntityType
    });
  }

  // Validate relationship type configuration
  const relationshipType = definition.relationshipType || 'relates_to';
  const allowedTypes = [
    'subtask_of', 'child_of', 'belongs_to', 'depends_on', 'successor_of',
    'reply_to', 'references', 'relates_to', 'blocks', 'tagged_with'
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

  // Validate cardinality if specified
  const cardinality = definition.cardinality;
  if (cardinality) {
    const allowedCardinalities = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'];
    if (!allowedCardinalities.includes(cardinality)) {
      errors.push({
        field: definition.name,
        code: 'INVALID_CARDINALITY',
        message: `Invalid cardinality '${cardinality}' for ${definition.name}`,
        value: cardinality,
        allowedCardinalities
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: value.trim()
  };
}

// Custom entity references are stored in relationship tables, not as columns
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
    'entity_reference',
    entityName
  );
}

// NEW: Enhanced metadata methods for UI integration
export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const targetType = definition.targetEntityType || 'Entity';
  const relationshipType = definition.relationshipType || 'relates_to';
  
  return {
    entityReference: true,
    targetEntityType: targetType,
    relationshipType: relationshipType,
    cardinality: definition.cardinality || 'many-to-one',
    messages: {
      required: `${definition.name} is required`,
      invalid: `Please select a valid ${targetType}`,
      custom: {
        INVALID_ENTITY_ID: `${definition.name} must be a valid entity ID`,
        INVALID_TARGET_TYPE: `Target entity type must be specified for ${definition.name}`,
        INVALID_RELATIONSHIP_TYPE: `Invalid relationship type for ${definition.name}`,
        INVALID_CARDINALITY: `Invalid cardinality for ${definition.name}`
      }
    }
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  const targetType = definition.targetEntityType || 'Entity';
  
  return {
    width: 200,
    minWidth: 150,
    textAlign: 'left',
    showTooltip: true,
    placeholder: `Select ${targetType}`,
    format: 'entity-reference',
    entityType: targetType,
    relationshipType: definition.relationshipType || 'relates_to'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  const targetType = definition.targetEntityType || 'Entity';
  const isMultiple = definition.cardinality === 'one-to-many' || definition.cardinality === 'many-to-many';
  
  return {
    type: 'entity-selector',
    targetEntityType: targetType,
    multiple: isMultiple,
    searchable: true,
    clearable: !definition.required,
    showValidationOnBlur: true,
    relationshipContext: {
      relationshipType: definition.relationshipType || 'relates_to',
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
    requiresSpecialEditor: true, // Needs entity selector
    hasRichDisplay: true, // Shows entity names, not IDs
    supportsValidation: true,
    supportsFormatting: false,
    isRelationshipField: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  const targetType = definition.targetEntityType || 'Entity';
  const relationshipType = definition.relationshipType || 'relates_to';
  
  return {
    ariaLabel: `${definition.name} - select ${targetType} for ${relationshipType} relationship`,
    ariaDescription: `Choose one or more ${targetType} entities to establish ${relationshipType} relationship`,
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