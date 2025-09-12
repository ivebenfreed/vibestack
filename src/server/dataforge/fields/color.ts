/**
 * Color Field Handler
 * 
 * Validates color values in multiple formats (hex, rgb, hsl, named colors)
 * Enhanced with rich UI metadata for color picker and visual preview
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || '#000000';
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

  // Convert to string and trim
  const color = String(value).trim();
  let normalizedColor = color;

  // Validate different color formats
  let isValid = false;

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
        errors.push({
          field: definition.name,
          code: 'RGB_VALUES_OUT_OF_RANGE',
          message: 'RGB values must be between 0 and 255',
          value: color
        });
        isValid = false;
      }

      if (alpha < 0 || alpha > 1) {
        errors.push({
          field: definition.name,
          code: 'ALPHA_VALUE_OUT_OF_RANGE',
          message: 'Alpha value must be between 0 and 1',
          value: color
        });
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
        errors.push({
          field: definition.name,
          code: 'HUE_VALUE_OUT_OF_RANGE',
          message: 'Hue value must be between 0 and 360',
          value: color
        });
        isValid = false;
      }

      if (saturation > 100 || lightness > 100) {
        errors.push({
          field: definition.name,
          code: 'HSL_PERCENTAGE_OUT_OF_RANGE',
          message: 'Saturation and lightness must be between 0% and 100%',
          value: color
        });
        isValid = false;
      }

      if (alpha < 0 || alpha > 1) {
        errors.push({
          field: definition.name,
          code: 'ALPHA_VALUE_OUT_OF_RANGE',
          message: 'Alpha value must be between 0 and 1',
          value: color
        });
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
    errors.push({
      field: definition.name,
      code: 'INVALID_COLOR_FORMAT',
      message: 'Color must be in hex (#RRGGBB), rgb(r,g,b), hsl(h,s%,l%), or named color format',
      value: color
    });
  }

  // Custom regex validation if provided
  if (isValid && definition.regex) {
    const customRegex = new RegExp(definition.regex);
    if (!customRegex.test(color)) {
      errors.push({
        field: definition.name,
        code: 'PATTERN_MISMATCH',
        message: `Color does not match required pattern`,
        value: color,
        pattern: definition.regex
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: normalizedColor
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