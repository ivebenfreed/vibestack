/**
 * Enhanced Image Field Handler
 * 
 * Image field with URL validation, file type checking, and display metadata
 * Enhanced with rich UI metadata for image upload and preview components
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || null;
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

  // Handle different input formats
  let imageUrl: string;
  let imageMetadata: any = {};

  if (typeof value === 'string') {
    // Simple URL string
    imageUrl = value.trim();
  } else if (typeof value === 'object' && value.url) {
    // Object with url and metadata
    imageUrl = value.url.trim();
    imageMetadata = value;
  } else {
    errors.push(`Field '${definition.name}' must be a valid image URL or object`);
    return { valid: false, errors };
  }

  // URL validation
  if (imageUrl && !imageUrl.match(/^https?:\/\//)) {
    imageUrl = `https://${imageUrl}`;
  }

  try {
    new URL(imageUrl);
  } catch (error) {
    errors.push(`Field '${definition.name}' must be a valid image URL`);
    return { valid: false, errors };
  }

  // Image format validation
  const allowedFormats = definition.enum || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const urlLower = imageUrl.toLowerCase();
  const hasValidExtension = allowedFormats.some(format => 
    urlLower.includes(`.${format}`) || urlLower.includes(`format=${format}`)
  );

  if (!hasValidExtension) {
    errors.push(`Field '${definition.name}' must be a valid image format (${allowedFormats.join(', ')})`);
  }

  // Size validation if provided in metadata
  if (imageMetadata.size && definition.maxSize) {
    const maxSizeBytes = definition.maxSize * 1024 * 1024; // Convert MB to bytes
    if (imageMetadata.size > maxSizeBytes) {
      errors.push(`Field '${definition.name}' image size exceeds maximum of ${definition.maxSize}MB`);
    }
  }

  // Dimension validation if provided
  if (imageMetadata.width && definition.maxWidth && imageMetadata.width > definition.maxWidth) {
    errors.push(`Field '${definition.name}' image width exceeds maximum of ${definition.maxWidth}px`);
  }

  if (imageMetadata.height && definition.maxHeight && imageMetadata.height > definition.maxHeight) {
    errors.push(`Field '${definition.name}' image height exceeds maximum of ${definition.maxHeight}px`);
  }

  // Create standardized response
  const transformedValue = typeof value === 'string' ? imageUrl : {
    ...imageMetadata,
    url: imageUrl
  };

  return {
    valid: errors.length === 0,
    errors,
    transformedValue
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'JSONB'; // Store as object with url, alt text, dimensions, etc.
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultVal = getDefaultValue(definition);
  if (defaultVal) {
    const jsonValue = typeof defaultVal === 'string' ? 
      { url: defaultVal } : defaultVal;
    return `'${JSON.stringify(jsonValue)}'::jsonb`;
  }
  return definition.required ? null : 'NULL';
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const allowedFormats = definition.enum || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  
  const messages = {
    required: `${definition.name} is required`,
    custom: {
      INVALID_IMAGE_URL: `${definition.name} must be a valid image URL`,
      INVALID_IMAGE_FORMAT: `Image must be in one of these formats: ${allowedFormats.join(', ')}`,
      IMAGE_TOO_LARGE: `Image size exceeds maximum of ${definition.maxSize || 10}MB`,
      IMAGE_TOO_WIDE: `Image width exceeds maximum of ${definition.maxWidth || 2000}px`,
      IMAGE_TOO_TALL: `Image height exceeds maximum of ${definition.maxHeight || 2000}px`
    }
  };

  return {
    required: definition.required || false,
    enum: allowedFormats,
    maxSize: definition.maxSize || 10, // MB
    maxWidth: definition.maxWidth || 2000,
    maxHeight: definition.maxHeight || 2000,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 120,
    minWidth: 80,
    textAlign: 'center',
    format: 'image',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: 'No image',
    customFormatter: 'image-thumbnail',
    previewSize: 'small'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  const allowedFormats = definition.enum || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  
  return {
    type: 'image',
    allowedFormats,
    maxSize: definition.maxSize || 10, // MB
    maxWidth: definition.maxWidth || 2000,
    maxHeight: definition.maxHeight || 2000,
    showPreview: true,
    enableDragDrop: true,
    enableUrlInput: true,
    cropAspectRatio: definition.aspectRatio,
    resizeOnUpload: definition.autoResize || false,
    validateWhileTyping: false,
    showValidationOnBlur: true
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: false,
    supportsFiltering: true,
    supportsGrouping: false,
    supportsAggregation: false,
    requiresSpecialEditor: true,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: false
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} image upload`,
    ariaDescription: `Upload or provide URL for ${definition.name} image. Supported formats: jpg, png, gif, webp`,
    role: 'button',
    ariaRequired: definition.required || false,
    ariaInvalid: false,
    ariaHasPopup: 'dialog'
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