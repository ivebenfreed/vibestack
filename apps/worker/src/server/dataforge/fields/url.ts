/**
 * URL Field Handler
 * 
 * Validates URLs with proper format checking and optional protocol enforcement
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

  // Convert to string and trim
  let url = String(value).trim();

  // Auto-prepend https:// if no protocol specified
  if (url && !url.match(/^https?:\/\//)) {
    url = `https://${url}`;
  }

  // URL validation using built-in URL constructor
  try {
    const parsedUrl = new URL(url);
    
    // Check allowed protocols if specified in field definition
    const allowedProtocols = definition.enum || ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      errors.push({
        field: definition.name,
        code: 'INVALID_PROTOCOL',
        message: `URL protocol not allowed. Allowed: ${allowedProtocols.join(', ')}`,
        value: url,
        allowedProtocols
      });
    }

    // Length validation
    if (url.length > 2048) { // Common URL length limit
      errors.push({
        field: definition.name,
        code: 'URL_TOO_LONG',
        message: 'URL too long (max 2048 characters)',
        value: url,
        constraint: 2048
      });
    }

    // Custom regex validation if provided
    if (definition.regex) {
      const customRegex = new RegExp(definition.regex);
      if (!customRegex.test(url)) {
        errors.push({
          field: definition.name,
          code: 'PATTERN_MISMATCH',
          message: `URL does not match required pattern`,
          value: url,
          pattern: definition.regex
        });
      }
    }

  } catch (error) {
    errors.push({
      field: definition.name,
      code: 'INVALID_URL',
      message: 'Invalid URL format',
      value: url
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: url
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