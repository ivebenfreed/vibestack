/**
 * Enhanced Markdown Field Handler
 * 
 * Markdown text field with syntax validation and preview capabilities
 * Enhanced with rich UI metadata for markdown editor components
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
  const markdown = String(value);

  // Length validation
  if (definition.min && markdown.length < definition.min) {
    errors.push(`Field '${definition.name}' must be at least ${definition.min} characters long`);
  }

  if (definition.max && markdown.length > definition.max) {
    errors.push(`Field '${definition.name}' cannot exceed ${definition.max} characters`);
  }

  // Validate markdown syntax if enabled
  if (definition.validateSyntax) {
    const syntaxErrors = validateMarkdownSyntax(markdown);
    if (syntaxErrors.length > 0) {
      errors.push(...syntaxErrors.map(err => `Field '${definition.name}' ${err}`));
    }
  }

  // Header structure validation
  if (definition.requireHeaders) {
    const hasHeaders = /^#+ .+$/m.test(markdown);
    if (!hasHeaders) {
      errors.push(`Field '${definition.name}' must contain at least one header`);
    }
  }

  // Link validation if specified
  if (definition.validateLinks) {
    const linkErrors = validateMarkdownLinks(markdown);
    if (linkErrors.length > 0) {
      errors.push(...linkErrors.map(err => `Field '${definition.name}' ${err}`));
    }
  }

  // Image validation if specified
  if (definition.validateImages) {
    const imageErrors = validateMarkdownImages(markdown);
    if (imageErrors.length > 0) {
      errors.push(...imageErrors.map(err => `Field '${definition.name}' ${err}`));
    }
  }

  // Disallow HTML if specified
  if (definition.disallowHtml) {
    const hasHtml = /<[^>]+>/.test(markdown);
    if (hasHtml) {
      errors.push(`Field '${definition.name}' cannot contain HTML tags`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: markdown
  };
}

function validateMarkdownSyntax(markdown: string): string[] {
  const errors: string[] = [];
  
  // Check for unmatched brackets
  const openBrackets = (markdown.match(/\[/g) || []).length;
  const closeBrackets = (markdown.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push('unmatched square brackets');
  }

  // Check for unmatched parentheses in links
  const openParens = (markdown.match(/\(/g) || []).length;
  const closeParens = (markdown.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push('unmatched parentheses');
  }

  // Check for proper code block formatting
  const codeBlocks = markdown.match(/```/g);
  if (codeBlocks && codeBlocks.length % 2 !== 0) {
    errors.push('unclosed code block');
  }

  return errors;
}

function validateMarkdownLinks(markdown: string): string[] {
  const errors: string[] = [];
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(markdown)) !== null) {
    const [, linkText, linkUrl] = match;
    
    if (!linkText.trim()) {
      errors.push('empty link text found');
    }
    
    if (!linkUrl.trim()) {
      errors.push('empty link URL found');
    }
    
    // Basic URL validation for external links
    if (linkUrl.startsWith('http') && !isValidUrl(linkUrl)) {
      errors.push(`invalid URL: ${linkUrl}`);
    }
  }

  return errors;
}

function validateMarkdownImages(markdown: string): string[] {
  const errors: string[] = [];
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = imageRegex.exec(markdown)) !== null) {
    const [, altText, imageUrl] = match;
    
    if (!altText.trim()) {
      errors.push('image missing alt text');
    }
    
    if (!imageUrl.trim()) {
      errors.push('image missing URL');
    }
    
    // Basic URL validation for external images
    if (imageUrl.startsWith('http') && !isValidUrl(imageUrl)) {
      errors.push(`invalid image URL: ${imageUrl}`);
    }
  }

  return errors;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
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
      TOO_SHORT: `Markdown must be at least ${definition.min || 0} characters long`,
      TOO_LONG: `Markdown cannot exceed ${definition.max || 'unlimited'} characters`,
      INVALID_MARKDOWN_SYNTAX: 'Invalid markdown syntax',
      UNMATCHED_BRACKETS: 'Unmatched square brackets in markdown',
      UNMATCHED_PARENTHESES: 'Unmatched parentheses in markdown',
      UNCLOSED_CODE_BLOCK: 'Unclosed code block in markdown',
      EMPTY_LINK_TEXT: 'Link found with empty text',
      EMPTY_LINK_URL: 'Link found with empty URL',
      INVALID_LINK_URL: 'Invalid link URL',
      MISSING_IMAGE_ALT_TEXT: 'Image missing alt text',
      MISSING_IMAGE_URL: 'Image missing URL',
      INVALID_IMAGE_URL: 'Invalid image URL',
      HTML_NOT_ALLOWED: 'HTML tags are not allowed',
      HEADERS_REQUIRED: 'Content must contain at least one header'
    }
  };

  return {
    required: definition.required || false,
    min: definition.min,
    max: definition.max,
    validateSyntax: definition.validateSyntax || false,
    validateLinks: definition.validateLinks || false,
    validateImages: definition.validateImages || false,
    requireHeaders: definition.requireHeaders || false,
    disallowHtml: definition.disallowHtml || false,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 350,
    minWidth: 250,
    textAlign: 'left',
    format: 'markdown',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: definition.placeholder || 'Enter markdown...',
    customFormatter: 'markdown-preview',
    maxLines: 5, // For preview truncation
    expandable: true
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'markdown',
    showPreview: definition.showPreview !== false,
    showSyntaxHighlighting: definition.showSyntaxHighlighting !== false,
    showToolbar: definition.showToolbar !== false,
    enableTables: definition.enableTables !== false,
    enableTaskLists: definition.enableTaskLists !== false,
    enableMath: definition.enableMath || false,
    enableDiagrams: definition.enableDiagrams || false,
    placeholder: definition.placeholder || 'Enter markdown...',
    validateSyntax: definition.validateSyntax || false,
    validateLinks: definition.validateLinks || false,
    validateImages: definition.validateImages || false,
    disallowHtml: definition.disallowHtml || false,
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
    requiresSpecialEditor: true,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} markdown editor`,
    ariaDescription: `Enter markdown text for ${definition.name}. Use markdown syntax for formatting${definition.max ? `. Maximum ${definition.max} characters` : ''}`,
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