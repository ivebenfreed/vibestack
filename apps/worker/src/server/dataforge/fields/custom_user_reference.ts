/**
 * Custom User Reference Field Handler
 * 
 * Allows dynamic user reference relationships with configurable relationship types.
 * Creates relationships in per-org relationship tables instead of database columns.
 */

import type { FieldDefinition } from '../types';
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