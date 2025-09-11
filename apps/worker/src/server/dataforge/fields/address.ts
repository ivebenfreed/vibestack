/**
 * Enhanced Address Field Handler
 * 
 * Multi-line address field with structured validation and formatting
 * Enhanced with rich UI metadata for address input components
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

  let addressData: any;

  // Handle different input formats
  if (typeof value === 'string') {
    // Simple string address
    addressData = {
      fullAddress: value.trim(),
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: ''
    };
  } else if (typeof value === 'object') {
    // Structured address object
    addressData = {
      fullAddress: value.fullAddress || '',
      street: value.street || '',
      city: value.city || '',
      state: value.state || value.region || '',
      country: value.country || '',
      postalCode: value.postalCode || value.zipCode || ''
    };
  } else {
    errors.push(`Field '${definition.name}' must be a valid address`);
    return { valid: false, errors };
  }

  // Validate required components if specified
  if (definition.requireStreet && !addressData.street) {
    errors.push(`Field '${definition.name}' street address is required`);
  }

  if (definition.requireCity && !addressData.city) {
    errors.push(`Field '${definition.name}' city is required`);
  }

  if (definition.requireState && !addressData.state) {
    errors.push(`Field '${definition.name}' state/region is required`);
  }

  if (definition.requireCountry && !addressData.country) {
    errors.push(`Field '${definition.name}' country is required`);
  }

  if (definition.requirePostalCode && !addressData.postalCode) {
    errors.push(`Field '${definition.name}' postal/zip code is required`);
  }

  // Postal code format validation by country
  if (addressData.postalCode && addressData.country) {
    const postalValidation = validatePostalCode(addressData.postalCode, addressData.country);
    if (!postalValidation.valid) {
      errors.push(`Field '${definition.name}' ${postalValidation.message}`);
    }
  }

  // Country validation if enum is provided
  if (definition.enum && addressData.country && !definition.enum.includes(addressData.country)) {
    errors.push(`Field '${definition.name}' country not supported: ${addressData.country}`);
  }

  // Build full address if components provided
  if (!addressData.fullAddress && (addressData.street || addressData.city)) {
    const parts = [
      addressData.street,
      addressData.city,
      addressData.state,
      addressData.postalCode,
      addressData.country
    ].filter(Boolean);
    addressData.fullAddress = parts.join(', ');
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: addressData
  };
}

function validatePostalCode(postalCode: string, country: string): { valid: boolean; message?: string } {
  const patterns = {
    'US': /^[0-9]{5}(-[0-9]{4})?$/,
    'CA': /^[A-Za-z][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]$/,
    'GB': /^[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}$/,
    'DE': /^[0-9]{5}$/,
    'FR': /^[0-9]{5}$/,
    'AU': /^[0-9]{4}$/,
    'JP': /^[0-9]{3}-[0-9]{4}$/
  };

  const pattern = patterns[country.toUpperCase()];
  if (pattern && !pattern.test(postalCode)) {
    return {
      valid: false,
      message: `invalid postal code format for ${country}`
    };
  }

  return { valid: true };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'JSONB'; // Store structured address data
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  const defaultVal = getDefaultValue(definition);
  if (defaultVal) {
    const addressObj = typeof defaultVal === 'string' ? 
      { fullAddress: defaultVal } : defaultVal;
    return `'${JSON.stringify(addressObj)}'::jsonb`;
  }
  return definition.required ? null : 'NULL';
}

export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  const messages = {
    required: `${definition.name} is required`,
    custom: {
      INVALID_ADDRESS_FORMAT: `${definition.name} must be a valid address`,
      STREET_REQUIRED: 'Street address is required',
      CITY_REQUIRED: 'City is required',
      STATE_REQUIRED: 'State/region is required',
      COUNTRY_REQUIRED: 'Country is required',
      POSTAL_CODE_REQUIRED: 'Postal/zip code is required',
      INVALID_POSTAL_CODE: 'Invalid postal code format',
      UNSUPPORTED_COUNTRY: 'Country not supported'
    }
  };

  return {
    required: definition.required || false,
    requireStreet: definition.requireStreet || false,
    requireCity: definition.requireCity || false,
    requireState: definition.requireState || false,
    requireCountry: definition.requireCountry || false,
    requirePostalCode: definition.requirePostalCode || false,
    supportedCountries: definition.enum,
    messages
  };
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 250,
    minWidth: 200,
    textAlign: 'left',
    format: 'address',
    showPreview: true,
    showLabel: true,
    showTooltip: true,
    placeholder: 'Enter address',
    customFormatter: 'address-formatted',
    maxLines: 3
  };
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'address',
    showFullAddressField: true,
    showStructuredFields: definition.showStructuredFields || false,
    enableAddressLookup: definition.enableAddressLookup || false,
    enableGeocode: definition.enableGeocode || false,
    supportedCountries: definition.enum,
    requireStreet: definition.requireStreet || false,
    requireCity: definition.requireCity || false,
    requireState: definition.requireState || false,
    requireCountry: definition.requireCountry || false,
    requirePostalCode: definition.requirePostalCode || false,
    validateWhileTyping: false,
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
    ariaLabel: `${definition.name} address input`,
    ariaDescription: `Enter address for ${definition.name}. You can type the full address or use structured fields`,
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