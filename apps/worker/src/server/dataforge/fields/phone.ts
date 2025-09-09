/**
 * Phone Field Handler
 * 
 * Validates phone numbers with flexible formatting and optional international support
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

  // Convert to string and clean
  const phone = String(value).trim();

  // Remove common formatting characters for validation
  const cleanPhone = phone.replace(/[\s\-\(\)\+\.\s]/g, '');

  // Basic length validation (international numbers can be 7-15 digits)
  if (cleanPhone.length < 7) {
    errors.push({
      field: definition.name,
      code: 'PHONE_TOO_SHORT',
      message: 'Phone number too short (minimum 7 digits)',
      value: phone,
      constraint: 7
    });
  }

  if (cleanPhone.length > 15) {
    errors.push({
      field: definition.name,
      code: 'PHONE_TOO_LONG',
      message: 'Phone number too long (maximum 15 digits)',
      value: phone,
      constraint: 15
    });
  }

  // Check if only contains valid characters
  if (!cleanPhone.match(/^[0-9]+$/)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_PHONE_CHARACTERS',
      message: 'Phone number contains invalid characters',
      value: phone
    });
  }

  // Custom regex validation if provided (for specific formats)
  if (definition.regex) {
    const customRegex = new RegExp(definition.regex);
    if (!customRegex.test(phone)) {
      errors.push({
        field: definition.name,
        code: 'PATTERN_MISMATCH',
        message: `Phone number does not match required format`,
        value: phone,
        pattern: definition.regex
      });
    }
  }

  // Format standardization (remove formatting, keep international prefix if present)
  let formattedPhone = cleanPhone;
  if (phone.startsWith('+')) {
    formattedPhone = '+' + cleanPhone;
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: formattedPhone
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