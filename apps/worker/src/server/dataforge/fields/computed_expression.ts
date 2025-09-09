/**
 * Computed Expression Field Handler
 * 
 * Handles simple expression-based computed fields for basic mathematical operations
 * and field references. Lighter weight than computed_formula for simple cases.
 */

import type { FieldDefinition } from '../types';

export interface ComputedExpressionConfig {
  expression: string;
  dependencies?: string[]; // Field names this expression depends on
  refreshOnChange?: boolean; // Auto-refresh when dependencies change
  description?: string;
}

export function getDefaultValue(definition: FieldDefinition): any {
  return definition.defaultValue || 0;
}

export function validate(value: any, definition: FieldDefinition, context: any): { 
  valid: boolean; 
  errors: any[]; 
  transformedValue?: any; 
} {
  const errors: any[] = [];
  
  // Validate the field definition has required expression (either direct or in computedConfig)
  const expression = definition.expression || definition.computedConfig?.expression;
  const dependencies = definition.dependencies || definition.computedConfig?.dependencies || [];
  
  if (!expression) {
    errors.push({
      field: definition.name,
      code: 'MISSING_EXPRESSION',
      message: `Computed expression field '${definition.name}' must have expression property`
    });
    return { valid: false, errors };
  }

  const config = {
    expression,
    dependencies,
    refreshOnChange: definition.refreshOnChange || definition.computedConfig?.refreshOnChange || true,
    description: definition.description || definition.computedConfig?.description
  } as ComputedExpressionConfig;
  
  // Validate expression exists and is a string
  if (!expression || typeof expression !== 'string') {
    errors.push({
      field: definition.name,
      code: 'INVALID_EXPRESSION',
      message: `Computed expression field '${definition.name}' must have a valid expression string`
    });
  }

  // Basic expression syntax validation
  if (expression) {
    // Check for basic safety - no function calls or dangerous operations
    const dangerousPatterns = [
      /\b(eval|Function|require|import|process|global)\b/,
      /\b(setTimeout|setInterval|clearTimeout|clearInterval)\b/,
      /\b(document|window|location|console)\b/
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(expression)) {
        errors.push({
          field: definition.name,
          code: 'UNSAFE_EXPRESSION',
          message: `Expression contains potentially unsafe operations`,
          pattern: pattern.toString()
        });
      }
    }
    
    // Check for valid mathematical expressions
    const validExpression = /^[\d\s+\-*/().,a-zA-Z_$]+$/.test(expression);
    if (!validExpression) {
      errors.push({
        field: definition.name,
        code: 'INVALID_EXPRESSION_SYNTAX',
        message: `Expression contains invalid characters. Only numbers, operators (+,-,*,/), parentheses, and field names allowed`
      });
    }
  }

  // For computed fields, we mainly validate the configuration
  // The actual value validation happens during computation
  if (value !== null && value !== undefined) {
    // Basic type coercion for numbers
    const numValue = Number(value);
    if (!Number.isFinite(numValue) && typeof value !== 'string') {
      errors.push({
        field: definition.name,
        code: 'INVALID_COMPUTED_VALUE',
        message: `Computed field result must be a valid number or string`,
        value
      });
    }
  }

  // Required field validation
  if (definition.required && (value == null || value === '')) {
    errors.push({
      field: definition.name,
      code: 'REQUIRED',
      message: `${definition.name} is required`
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    transformedValue: value
  };
}

export function getSqlType(definition: FieldDefinition): string {
  // Default to DECIMAL for numeric calculations, but could be TEXT for mixed results
  return 'DECIMAL(15,4)';
}

export function getSqlDefault(definition: FieldDefinition): string | null {
  if (definition.defaultValue !== undefined) {
    return String(Number(definition.defaultValue) || 0);
  }
  
  return definition.required ? null : '0';
}

/**
 * Check if this field is a computed field that needs special processing
 */
export function isComputedField(): boolean {
  return true;
}

/**
 * Get the computed field configuration for processing by ComputedFieldEngine
 */
export function getComputedConfig(definition: FieldDefinition): ComputedExpressionConfig | null {
  const expression = definition.expression || definition.computedConfig?.expression;
  if (!expression) return null;
  
  return {
    expression,
    dependencies: definition.dependencies || definition.computedConfig?.dependencies || [],
    refreshOnChange: definition.refreshOnChange || definition.computedConfig?.refreshOnChange || true,
    description: definition.description || definition.computedConfig?.description
  };
}

/**
 * Get dependencies for this computed expression
 */
export function getDependencies(definition: FieldDefinition): string[] {
  const expression = definition.expression || definition.computedConfig?.expression;
  const dependencies = definition.dependencies || definition.computedConfig?.dependencies;
  
  if (!expression) return [];
  
  // If dependencies are explicitly defined, use them
  if (dependencies && Array.isArray(dependencies)) {
    return dependencies;
  }
  
  // Otherwise, try to extract field names from the expression
  return extractFieldReferences(expression);
}

/**
 * Extract field references from an expression string
 * Looks for field names (alphanumeric + underscore patterns)
 */
function extractFieldReferences(expression: string): string[] {
  if (!expression) return [];
  
  // Match field-like patterns (letters, numbers, underscores, dots for nested fields)
  const fieldPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b/g;
  const matches = expression.match(fieldPattern) || [];
  
  // Filter out common mathematical constants and operators
  const mathConstants = new Set(['PI', 'E', 'true', 'false', 'null', 'undefined']);
  const fieldReferences = matches.filter(match => 
    !mathConstants.has(match) && 
    !/^\d+$/.test(match) // Not just numbers
  );
  
  // Return unique references
  return [...new Set(fieldReferences)];
}