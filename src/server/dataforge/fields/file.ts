/**
 * File Field Handler
 * 
 * Handles file references with metadata validation
 * Stores file URLs/paths with optional size and type validation
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

  // File can be stored as string (URL/path) or object (with metadata)
  let fileData: any;
  
  if (typeof value === 'string') {
    // Simple string format - just URL/path
    fileData = { url: value.trim() };
  } else if (typeof value === 'object') {
    // Object format with metadata
    fileData = { ...value };
    if (!fileData.url) {
      errors.push({
        field: definition.name,
        code: 'MISSING_FILE_URL',
        message: 'File must have a URL or path',
        value
      });
    }
  } else {
    errors.push({
      field: definition.name,
      code: 'INVALID_FILE_FORMAT',
      message: 'File must be a URL string or object with metadata',
      value
    });
    return { valid: false, errors };
  }

  // Validate URL if present
  if (fileData.url) {
    const url = String(fileData.url).trim();
    
    // Basic URL validation
    try {
      new URL(url);
    } catch (error) {
      // Could be a relative path - check if it looks like a valid path
      if (!url.match(/^\//) && !url.match(/^[a-zA-Z]:\\/) && !url.match(/^\w+:\/\//)) {
        errors.push({
          field: definition.name,
          code: 'INVALID_FILE_PATH',
          message: 'File must be a valid URL or absolute path',
          value: url
        });
      }
    }
  }

  // Validate file size if provided
  if (fileData.size !== undefined) {
    const size = Number(fileData.size);
    if (isNaN(size) || size < 0) {
      errors.push({
        field: definition.name,
        code: 'INVALID_FILE_SIZE',
        message: 'File size must be a non-negative number',
        value: fileData.size
      });
    }
    
    // Check max size constraint
    if (definition.max && size > definition.max) {
      errors.push({
        field: definition.name,
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds maximum allowed (${definition.max} bytes)`,
        value: size,
        constraint: definition.max
      });
    }
  }

  // Validate file type if provided
  if (fileData.type && definition.enum) {
    const allowedTypes = definition.enum;
    if (!allowedTypes.includes(fileData.type)) {
      errors.push({
        field: definition.name,
        code: 'INVALID_FILE_TYPE',
        message: `File type not allowed. Allowed: ${allowedTypes.join(', ')}`,
        value: fileData.type,
        allowedTypes
      });
    }
  }

  // Validate filename if provided
  if (fileData.filename) {
    const filename = String(fileData.filename).trim();
    if (filename.length > 255) {
      errors.push({
        field: definition.name,
        code: 'FILENAME_TOO_LONG',
        message: 'Filename too long (max 255 characters)',
        value: filename,
        constraint: 255
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: fileData
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'JSONB'; // Store file metadata as JSON
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  if (definition.defaultValue !== undefined) {
    if (typeof definition.defaultValue === 'string') {
      return `'{"url": "${definition.defaultValue}"}'::jsonb`;
    }
    return `'${JSON.stringify(definition.defaultValue)}'::jsonb`;
  }
  return definition.required ? null : 'NULL';
}