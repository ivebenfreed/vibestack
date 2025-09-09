/**
 * Email Field Handler
 * 
 * Validates email addresses with proper format checking
 */

import type { FieldDefinition } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || null;
}

export function validate(value: any, definition: FieldDefinition, context: any): { valid: boolean; errors: any[]; transformedValue?: any } {
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
  const email = String(value).trim();

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_EMAIL',
      message: 'Invalid email format',
      value: email
    });
  }

  // Length validation
  if (email.length > 254) { // RFC 5321 limit
    errors.push({
      field: definition.name,
      code: 'EMAIL_TOO_LONG',
      message: 'Email address too long (max 254 characters)',
      value: email,
      constraint: 254
    });
  }

  // Custom regex validation if provided
  if (definition.regex) {
    const customRegex = new RegExp(definition.regex);
    if (!customRegex.test(email)) {
      errors.push({
        field: definition.name,
        code: 'PATTERN_MISMATCH',
        message: `Email does not match required pattern`,
        value: email,
        pattern: definition.regex
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: email.toLowerCase() // Normalize to lowercase
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  if (definition.defaultValue !== undefined) {
    return `'${definition.defaultValue}'`;
  }
  return definition.required ? null : 'NULL';
}