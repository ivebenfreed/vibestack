/**
 * Enhanced Coordinates Field Handler
 * 
 * Geographic coordinates (latitude/longitude) field with validation and mapping integration
 * Enhanced with rich UI metadata for map picker components
 */

import type { FieldDefinition, ValidationResult, EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  if (definition.defaultValue !== undefined) {
    return definition.defaultValue;
  }
  return null;
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

  let coordinates: { latitude: number; longitude: number; accuracy?: number };

  // Handle different input formats
  if (typeof value === 'string') {
    // Parse "lat,lng" or "lat, lng" format
    const parts = value.split(',').map(s => s.trim());
    if (parts.length !== 2) {
      errors.push(`Field '${definition.name}' must be in "latitude,longitude" format`);
      return { valid: false, errors };
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lng)) {
      errors.push(`Field '${definition.name}' must contain valid numeric coordinates`);
      return { valid: false, errors };
    }

    coordinates = { latitude: lat, longitude: lng };
  } else if (typeof value === 'object' && value.latitude !== undefined && value.longitude !== undefined) {
    // Object format
    const lat = parseFloat(value.latitude);
    const lng = parseFloat(value.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      errors.push(`Field '${definition.name}' must contain valid numeric coordinates`);
      return { valid: false, errors };
    }

    coordinates = {
      latitude: lat,
      longitude: lng,
      accuracy: value.accuracy
    };
  } else {
    errors.push(`Field '${definition.name}' must be valid coordinates`);
    return { valid: false, errors };
  }

  // Validate latitude range
  if (coordinates.latitude < -90 || coordinates.latitude > 90) {
    errors.push(`Field '${definition.name}' latitude must be between -90 and 90 degrees`);
  }

  // Validate longitude range
  if (coordinates.longitude < -180 || coordinates.longitude > 180) {
    errors.push(`Field '${definition.name}' longitude must be between -180 and 180 degrees`);
  }

  // Validate precision (decimal places)
  const precision = definition.precision || 6;
  coordinates.latitude = parseFloat(coordinates.latitude.toFixed(precision));
  coordinates.longitude = parseFloat(coordinates.longitude.toFixed(precision));

  // Validate bounding box if specified
  if (definition.boundingBox) {
    const bbox = definition.boundingBox;
    const { latitude: lat, longitude: lng } = coordinates;

    if (lat < bbox.south || lat > bbox.north || lng < bbox.west || lng > bbox.east) {
      errors.push(`Field '${definition.name}' coordinates must be within specified region`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: coordinates
  };
}

export function getSqlType(definition: FieldDefinition): string {
  // Use PostGIS POINT if available, otherwise JSONB
  return definition.usePostGIS ? 'GEOMETRY(POINT, 4326)' : 'JSONB';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultVal = getDefaultValue(definition);
  if (defaultVal) {
    if (definition.usePostGIS) {
      const coords = typeof defaultVal === 'string' ? 
        defaultVal.split(',').map(s => s.trim()) : 
        [defaultVal.longitude, defaultVal.latitude];
      return `ST_GeomFromText('POINT(${coords[1]} ${coords[0]})', 4326)`;
    } else {
      const coordsObj = typeof defaultVal === 'string' ?
        { latitude: parseFloat(defaultVal.split(',')[0]), longitude: parseFloat(defaultVal.split(',')[1]) } :
        defaultVal;
      return `'${JSON.stringify(coordsObj)}'::jsonb`;
    }
  }
  return definition.required ? null : 'NULL';
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const messages = {
    required: `${definition.name} is required`,
    custom: {
      INVALID_COORDINATES_FORMAT: `${definition.name} must be valid coordinates`,
      INVALID_COORDINATE_VALUES: `Coordinates must be valid numbers`,
      LATITUDE_OUT_OF_RANGE: 'Latitude must be between -90 and 90 degrees',
      LONGITUDE_OUT_OF_RANGE: 'Longitude must be between -180 and 180 degrees',
      OUTSIDE_BOUNDING_BOX: 'Coordinates must be within specified region'
    }
  };

  return {
    required: definition.required || false,
    precision: definition.precision || 6,
    boundingBox: definition.boundingBox,
    pattern: '^-?([0-8]?[0-9]|90)\\.?[0-9]*,-?([0-9]{1,2}|1[0-7][0-9]|180)\\.?[0-9]*$',
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 180,
    minWidth: 150,
    textAlign: 'left',
    format: 'coordinates',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: '40.7128, -74.0060',
    customFormatter: 'coordinates-display',
    precision: definition.precision || 6
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'coordinates',
    showMapPicker: definition.showMapPicker !== false,
    showTextInput: definition.showTextInput !== false,
    enableGeolocation: definition.enableGeolocation || false,
    defaultZoom: definition.defaultZoom || 10,
    mapProvider: definition.mapProvider || 'openstreetmap',
    precision: definition.precision || 6,
    boundingBox: definition.boundingBox,
    markerColor: definition.markerColor || '#ef4444',
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
    ariaLabel: `${definition.name} coordinates input`,
    ariaDescription: `Enter geographic coordinates for ${definition.name}. Format: latitude, longitude (e.g., 40.7128, -74.0060)`,
    role: 'textbox',
    ariaRequired: definition.required || false,
    ariaInvalid: false,
    ariaHasPopup: definition.showMapPicker !== false ? 'dialog' : undefined
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