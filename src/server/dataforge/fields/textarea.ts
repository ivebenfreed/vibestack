/**
 * Enhanced Textarea Field Handler
 * 
 * Multi-line text field with character/word counting and formatting options
 * Enhanced with rich UI metadata for textarea components
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || '';
}

export function validate(value: any, definition: FieldDefinition, context: any): ValidationResult {
  const errors: string[] = [];
  
  // Handle null/undefined
  if (value == null || value === '') {
    if (definition.required) {
      errors.push(`Field '${definition.name}' is required`);
    }
    return { valid: errors.length === 0, errors };
  }

  // Convert to string
  const text = String(value).trim();

  // Length validation
  if (definition.min && text.length < definition.min) {
    errors.push(`Field '${definition.name}' must be at least ${definition.min} characters long`);
  }

  if (definition.max && text.length > definition.max) {
    errors.push(`Field '${definition.name}' cannot exceed ${definition.max} characters`);
  }

  // Word count validation
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  
  if (definition.minWords && wordCount < definition.minWords) {
    errors.push(`Field '${definition.name}' must contain at least ${definition.minWords} words`);
  }

  if (definition.maxWords && wordCount > definition.maxWords) {
    errors.push(`Field '${definition.name}' cannot exceed ${definition.maxWords} words`);
  }

  // Line count validation
  const lineCount = text.split('\n').length;
  
  if (definition.maxLines && lineCount > definition.maxLines) {
    errors.push(`Field '${definition.name}' cannot exceed ${definition.maxLines} lines`);
  }

  // Custom regex validation if provided
  if (definition.regex) {
    const customRegex = new RegExp(definition.regex);
    if (!customRegex.test(text)) {
      errors.push(`Field '${definition.name}' does not match required pattern`);
    }
  }

  // Profanity filter if enabled
  if (definition.profanityFilter) {
    const hasProfanity = checkProfanity(text);
    if (hasProfanity) {
      errors.push(`Field '${definition.name}' contains inappropriate content`);
    }
  }

  // URL detection if disallowed
  if (definition.disallowUrls) {
    const hasUrls = /https?:\/\/[^\s]+/.test(text);
    if (hasUrls) {
      errors.push(`Field '${definition.name}' cannot contain URLs`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: text
  };
}

function checkProfanity(text: string): boolean {
  // Basic profanity filter - in production, use a proper library
  const profanityWords = ['spam', 'test-profanity']; // Minimal list for demo
  const lowerText = text.toLowerCase();
  return profanityWords.some(word => lowerText.includes(word));
}

export function getSqlType(definition: FieldDefinition): string {
  // Use TEXT for unlimited length or VARCHAR if max length specified
  return definition.max ? `VARCHAR(${definition.max})` : 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  if (definition.defaultValue !== undefined) {
    return `'${definition.defaultValue.replace(/'/g, "''")}'`; // Escape single quotes
  }
  return definition.required ? null : 'NULL';
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const messages = {
    required: `${definition.name} is required`,
    custom: {
      TOO_SHORT: `Text must be at least ${definition.min || 0} characters long`,
      TOO_LONG: `Text cannot exceed ${definition.max || 'unlimited'} characters`,
      TOO_FEW_WORDS: `Text must contain at least ${definition.minWords || 0} words`,
      TOO_MANY_WORDS: `Text cannot exceed ${definition.maxWords || 'unlimited'} words`,
      TOO_MANY_LINES: `Text cannot exceed ${definition.maxLines || 'unlimited'} lines`,
      PATTERN_MISMATCH: 'Text does not match required format',
      INAPPROPRIATE_CONTENT: 'Text contains inappropriate content',
      URLS_NOT_ALLOWED: 'URLs are not allowed in this field'
    }
  };

  return {
    required: definition.required || false,
    min: definition.min,
    max: definition.max,
    minWords: definition.minWords,
    maxWords: definition.maxWords,
    maxLines: definition.maxLines,
    pattern: definition.regex,
    profanityFilter: definition.profanityFilter || false,
    disallowUrls: definition.disallowUrls || false,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 300,
    minWidth: 200,
    textAlign: 'left',
    format: 'text',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: definition.placeholder || 'Enter text...',
    customFormatter: 'multiline-text',
    maxLines: 3, // For preview truncation
    expandable: true
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'textarea',
    rows: definition.rows || 4,
    cols: definition.cols || 50,
    resize: definition.resize || 'vertical',
    placeholder: definition.placeholder || 'Enter text...',
    showCharacterCount: definition.showCharacterCount !== false,
    showWordCount: definition.showWordCount || false,
    showLineCount: definition.showLineCount || false,
    autoResize: definition.autoResize || false,
    spellCheck: definition.spellCheck !== false,
    autoComplete: definition.autoComplete || 'off',
    validateWhileTyping: false,
    showValidationOnBlur: true
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: false,
    supportsAggregation: false,
    requiresSpecialEditor: false,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: false
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} text area`,
    ariaDescription: `Enter multi-line text for ${definition.name}${definition.max ? `. Maximum ${definition.max} characters` : ''}`,
    role: 'textbox',
    ariaRequired: definition.required || false,
    ariaInvalid: false,
    ariaMultiline: true
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
  getAccessibilityMetadata
};