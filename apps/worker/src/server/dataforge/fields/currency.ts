/**
 * Currency Field Handler
 * 
 * Validates monetary values with currency code support and precision control
 */

import type { FieldDefinition } from '../types';

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || { amount: 0, currency: 'USD' };
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

  let currencyData: any;

  // Handle different input formats
  if (typeof value === 'number') {
    // Simple number format - assume default currency
    currencyData = { amount: value, currency: 'USD' };
  } else if (typeof value === 'string') {
    // Try to parse string as number
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      errors.push({
        field: definition.name,
        code: 'INVALID_CURRENCY_FORMAT',
        message: 'Currency value must be a valid number',
        value
      });
      return { valid: false, errors };
    }
    currencyData = { amount: numValue, currency: 'USD' };
  } else if (typeof value === 'object' && value !== null) {
    // Object format with amount and currency
    currencyData = { ...value };
    if (currencyData.amount === undefined || currencyData.amount === null) {
      errors.push({
        field: definition.name,
        code: 'MISSING_AMOUNT',
        message: 'Currency must have an amount',
        value
      });
    }
  } else {
    errors.push({
      field: definition.name,
      code: 'INVALID_CURRENCY_FORMAT',
      message: 'Currency must be a number, string, or object with amount and currency',
      value
    });
    return { valid: false, errors };
  }

  // Validate amount
  const amount = Number(currencyData.amount);
  if (isNaN(amount)) {
    errors.push({
      field: definition.name,
      code: 'INVALID_AMOUNT',
      message: 'Currency amount must be a valid number',
      value: currencyData.amount
    });
  } else {
    // Min/max validation
    if (definition.min !== undefined && amount < definition.min) {
      errors.push({
        field: definition.name,
        code: 'AMOUNT_TOO_SMALL',
        message: `Amount must be at least ${definition.min}`,
        value: amount,
        constraint: definition.min
      });
    }
    
    if (definition.max !== undefined && amount > definition.max) {
      errors.push({
        field: definition.name,
        code: 'AMOUNT_TOO_LARGE',
        message: `Amount must not exceed ${definition.max}`,
        value: amount,
        constraint: definition.max
      });
    }

    // Precision validation (2 decimal places for most currencies)
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    const maxPrecision = definition.precision || 2;
    if (decimalPlaces > maxPrecision) {
      errors.push({
        field: definition.name,
        code: 'TOO_MANY_DECIMAL_PLACES',
        message: `Amount cannot have more than ${maxPrecision} decimal places`,
        value: amount,
        constraint: maxPrecision
      });
    }

    // Round to correct precision
    currencyData.amount = Math.round(amount * Math.pow(10, maxPrecision)) / Math.pow(10, maxPrecision);
  }

  // Validate currency code if provided
  if (currencyData.currency) {
    const currency = String(currencyData.currency).toUpperCase();
    
    // Check allowed currencies if specified
    if (definition.enum && definition.enum.length > 0) {
      if (!definition.enum.includes(currency)) {
        errors.push({
          field: definition.name,
          code: 'INVALID_CURRENCY',
          message: `Currency not allowed. Allowed: ${definition.enum.join(', ')}`,
          value: currency,
          allowedCurrencies: definition.enum
        });
      }
    } else {
      // Basic currency code format validation (3 letter codes)
      if (!currency.match(/^[A-Z]{3}$/)) {
        errors.push({
          field: definition.name,
          code: 'INVALID_CURRENCY_CODE',
          message: 'Currency code must be 3 uppercase letters (e.g., USD, EUR)',
          value: currency
        });
      }
    }
    
    currencyData.currency = currency;
  } else {
    // Default to USD if no currency specified
    currencyData.currency = 'USD';
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: currencyData
  };
}

export function getSqlType(definition: FieldDefinition): string {
  return 'JSONB'; // Store currency as JSON with amount and currency code
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  if (definition.defaultValue !== undefined) {
    if (typeof definition.defaultValue === 'number') {
      return `'{"amount": ${definition.defaultValue}, "currency": "USD"}'::jsonb`;
    }
    return `'${JSON.stringify(definition.defaultValue)}'::jsonb`;
  }
  return definition.required ? null : 'NULL';
}