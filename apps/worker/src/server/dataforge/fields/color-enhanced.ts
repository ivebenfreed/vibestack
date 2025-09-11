/**
 * Enhanced Color Field Handler
 * 
 * Validates color values in multiple formats (hex, rgb, hsl, named colors)
 * Enhanced with rich UI metadata for color picker and visual preview
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function validate(value: any, definition: FieldDefinition, context: any): ValidationResult {
  // Handle null/undefined for optional fields
  if (value == null || value === '') {
    if (definition.required) {
      return {
        valid: false,
        errors: [`Field '${definition.name}' is required`]
      };
    }
    return { valid: true, errors: [] };
  }

  // Convert to string and trim
  const color = String(value).trim();
  let normalizedColor = color;
  let isValid = false;
  const errors: string[] = [];

  // Hex format (#RGB or #RRGGBB or #RRGGBBAA)
  if (color.match(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/)) {
    isValid = true;
    normalizedColor = color.toUpperCase();
  }
  // RGB format rgb(r, g, b) or rgba(r, g, b, a)
  else if (color.match(/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/i)) {
    isValid = true;
    // Parse and validate RGB values
    const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
    if (rgbMatch) {
      const [, r, g, b, a] = rgbMatch;
      const red = parseInt(r);
      const green = parseInt(g);
      const blue = parseInt(b);
      const alpha = a ? parseFloat(a) : 1;

      if (red > 255 || green > 255 || blue > 255) {
        errors.push(`Field '${definition.name}' RGB values must be between 0 and 255`);
        isValid = false;
      }

      if (alpha < 0 || alpha > 1) {
        errors.push(`Field '${definition.name}' alpha value must be between 0 and 1`);
        isValid = false;
      }
    }
  }
  // HSL format hsl(h, s%, l%) or hsla(h, s%, l%, a)
  else if (color.match(/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*[\d.]+)?\s*\)$/i)) {
    isValid = true;
    // Parse and validate HSL values
    const hslMatch = color.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([\d.]+))?\s*\)/i);
    if (hslMatch) {
      const [, h, s, l, a] = hslMatch;
      const hue = parseInt(h);
      const saturation = parseInt(s);
      const lightness = parseInt(l);
      const alpha = a ? parseFloat(a) : 1;

      if (hue > 360) {
        errors.push(`Field '${definition.name}' hue value must be between 0 and 360`);
        isValid = false;
      }

      if (saturation > 100 || lightness > 100) {
        errors.push(`Field '${definition.name}' saturation and lightness must be between 0% and 100%`);
        isValid = false;
      }

      if (alpha < 0 || alpha > 1) {
        errors.push(`Field '${definition.name}' alpha value must be between 0 and 1`);
        isValid = false;
      }
    }
  }
  // Named colors (if enum is provided with allowed color names)
  else if (definition.enum && definition.enum.includes(color.toLowerCase())) {
    isValid = true;
    normalizedColor = color.toLowerCase();
  }

  if (!isValid) {
    errors.push(`Field '${definition.name}' must be in hex (#RRGGBB), rgb(r,g,b), hsl(h,s%,l%), or named color format`);
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: isValid ? normalizedColor : undefined
  };
}

export function getDefaultValue(definition: FieldDefinition): string {
  return definition.defaultValue || '#000000';
}

export function getSqlType(definition: FieldDefinition): string {
  return 'TEXT';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultVal = getDefaultValue(definition);
  return `'${defaultVal}'`;
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const messages = {
    required: `${definition.name} is required`,
    custom: {
      INVALID_COLOR_FORMAT: `${definition.name} must be in hex (#RRGGBB), rgb(r,g,b), hsl(h,s%,l%), or named color format`,
      RGB_VALUES_OUT_OF_RANGE: 'RGB values must be between 0 and 255',
      ALPHA_VALUE_OUT_OF_RANGE: 'Alpha value must be between 0 and 1',
      HUE_VALUE_OUT_OF_RANGE: 'Hue value must be between 0 and 360',
      HSL_PERCENTAGE_OUT_OF_RANGE: 'Saturation and lightness must be between 0% and 100%'
    }
  };

  return {
    required: definition.required || false,
    enum: definition.enum,
    pattern: '^(#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})|rgba?\\(.*\\)|hsla?\\(.*\\))$',
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 120,
    minWidth: 100,
    textAlign: 'center',
    format: 'color-swatch',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: '#000000',
    customFormatter: 'color-display'
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'color-picker',
    showSwatches: true,
    allowTransparency: false,
    swatchColors: definition.enum || [
      '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
      '#000000', '#ffffff', '#808080', '#800000', '#808000', '#008000',
      '#800080', '#008080', '#000080', '#ffa500', '#ffc0cb', '#a52a2a'
    ],
    validateWhileTyping: true,
    showValidationOnBlur: true
  };
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false,
    requiresSpecialEditor: true,
    hasRichDisplay: true,
    supportsValidation: true,
    supportsFormatting: true
  };
}

export function getAccessibilityMetadata(definition: FieldDefinition): AccessibilityMetadata {
  return {
    ariaLabel: `${definition.name} color picker`,
    ariaDescription: `Select a color for ${definition.name}. Supports hex, RGB, HSL formats${definition.enum ? ' and named colors' : ''}`,
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