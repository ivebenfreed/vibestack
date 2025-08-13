// JSON Rules Engine - Alternative to Dynamic Function Execution
// Provides secure, declarative business logic without eval() or Function()

export interface Rule {
  field: string;
  operator: string;
  value: any;
  message?: string;
}

export interface RuleSet {
  rules: Rule[];
  operator?: 'and' | 'or';
}

export interface EntityConfig {
  name: string;
  orgId: string;
  basePrimitive: string;
  customFields: Record<string, FieldDefinition>;
  validationRules: RuleSet;
  workflows?: Record<string, string[]>;
  defaultValues?: Record<string, any>;
}

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'email' | 'url';
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  default?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: any;
}

/**
 * JSON Rules Engine - Secure alternative to dynamic code execution
 * Provides declarative validation and business logic without security risks
 */
export class JsonRulesEngine {
  /**
   * Validate data against a rule set
   */
  validateRules(data: any, ruleSet: RuleSet): ValidationResult {
    const errors: string[] = [];
    const operator = ruleSet.operator || 'and';
    
    let results: boolean[] = [];
    
    for (const rule of ruleSet.rules) {
      const result = this.evaluateRule(data, rule);
      if (!result.valid && result.message) {
        errors.push(result.message);
      }
      results.push(result.valid);
    }
    
    let isValid: boolean;
    if (operator === 'and') {
      isValid = results.every(r => r);
    } else { // 'or'
      isValid = results.some(r => r);
    }
    
    return {
      valid: isValid,
      errors: errors,
      data: isValid ? data : undefined
    };
  }

  /**
   * Evaluate a single rule against data
   */
  private evaluateRule(data: any, rule: Rule): { valid: boolean; message?: string } {
    const fieldValue = this.getFieldValue(data, rule.field);
    let valid = false;
    
    switch (rule.operator) {
      case 'required':
        valid = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        break;
        
      case 'equals':
        valid = fieldValue === rule.value;
        break;
        
      case 'not_equals':
        valid = fieldValue !== rule.value;
        break;
        
      case 'greater_than':
        valid = typeof fieldValue === 'number' && fieldValue > rule.value;
        break;
        
      case 'greater_than_equal':
        valid = typeof fieldValue === 'number' && fieldValue >= rule.value;
        break;
        
      case 'less_than':
        valid = typeof fieldValue === 'number' && fieldValue < rule.value;
        break;
        
      case 'less_than_equal':
        valid = typeof fieldValue === 'number' && fieldValue <= rule.value;
        break;
        
      case 'min_length':
        valid = typeof fieldValue === 'string' && fieldValue.length >= rule.value;
        break;
        
      case 'max_length':
        valid = typeof fieldValue === 'string' && fieldValue.length <= rule.value;
        break;
        
      case 'contains':
        valid = typeof fieldValue === 'string' && fieldValue.includes(rule.value);
        break;
        
      case 'starts_with':
        valid = typeof fieldValue === 'string' && fieldValue.startsWith(rule.value);
        break;
        
      case 'ends_with':
        valid = typeof fieldValue === 'string' && fieldValue.endsWith(rule.value);
        break;
        
      case 'regex':
        valid = typeof fieldValue === 'string' && new RegExp(rule.value).test(fieldValue);
        break;
        
      case 'email':
        valid = typeof fieldValue === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue);
        break;
        
      case 'url':
        valid = typeof fieldValue === 'string' && this.isValidUrl(fieldValue);
        break;
        
      case 'in':
        valid = Array.isArray(rule.value) && rule.value.includes(fieldValue);
        break;
        
      case 'not_in':
        valid = Array.isArray(rule.value) && !rule.value.includes(fieldValue);
        break;
        
      default:
        valid = false;
    }
    
    return {
      valid,
      message: valid ? undefined : (rule.message || `${rule.field} failed ${rule.operator} validation`)
    };
  }

  /**
   * Get field value from data object, supporting nested paths
   */
  private getFieldValue(data: any, fieldPath: string): any {
    return fieldPath.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, data);
  }

  /**
   * Validate URL format
   */
  private isValidUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Apply default values to data based on entity configuration
   */
  applyDefaults(data: any, config: EntityConfig): any {
    const result = { ...data };
    
    // Apply field defaults
    if (config.defaultValues) {
      for (const [field, defaultValue] of Object.entries(config.defaultValues)) {
        if (result[field] === undefined) {
          result[field] = defaultValue;
        }
      }
    }
    
    // Apply custom field defaults
    for (const [fieldName, fieldDef] of Object.entries(config.customFields)) {
      if (result[fieldName] === undefined && fieldDef.default !== undefined) {
        result[fieldName] = fieldDef.default;
      }
    }
    
    return result;
  }

  /**
   * Validate field types and basic constraints
   */
  validateFieldTypes(data: any, config: EntityConfig): ValidationResult {
    const errors: string[] = [];
    
    for (const [fieldName, fieldDef] of Object.entries(config.customFields)) {
      const value = data[fieldName];
      
      // Check required fields
      if (fieldDef.required && (value === undefined || value === null || value === '')) {
        errors.push(`${fieldName} is required`);
        continue;
      }
      
      // Skip type validation for undefined optional fields
      if (value === undefined || value === null) {
        continue;
      }
      
      // Type validation
      switch (fieldDef.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`${fieldName} must be a string`);
          } else {
            if (fieldDef.minLength && value.length < fieldDef.minLength) {
              errors.push(`${fieldName} must be at least ${fieldDef.minLength} characters`);
            }
            if (fieldDef.maxLength && value.length > fieldDef.maxLength) {
              errors.push(`${fieldName} must be no more than ${fieldDef.maxLength} characters`);
            }
            if (fieldDef.pattern && !new RegExp(fieldDef.pattern).test(value)) {
              errors.push(`${fieldName} format is invalid`);
            }
          }
          break;
          
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`${fieldName} must be a number`);
          } else {
            if (fieldDef.min !== undefined && value < fieldDef.min) {
              errors.push(`${fieldName} must be at least ${fieldDef.min}`);
            }
            if (fieldDef.max !== undefined && value > fieldDef.max) {
              errors.push(`${fieldName} must be no more than ${fieldDef.max}`);
            }
          }
          break;
          
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${fieldName} must be a boolean`);
          }
          break;
          
        case 'enum':
          if (!fieldDef.enum || !fieldDef.enum.includes(value)) {
            errors.push(`${fieldName} must be one of: ${fieldDef.enum?.join(', ')}`);
          }
          break;
          
        case 'email':
          if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${fieldName} must be a valid email address`);
          }
          break;
          
        case 'url':
          if (typeof value !== 'string' || !this.isValidUrl(value)) {
            errors.push(`${fieldName} must be a valid URL`);
          }
          break;
          
        case 'date':
          const dateValue = new Date(value);
          if (isNaN(dateValue.getTime())) {
            errors.push(`${fieldName} must be a valid date`);
          }
          break;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? data : undefined
    };
  }

  /**
   * Generate save data with proper structure
   */
  generateSaveData(data: any, config: EntityConfig): any {
    const now = new Date().toISOString();
    const result = { ...data };
    
    // Add system fields
    if (!result.id) {
      result.id = 'entity-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    if (!result.created_at) {
      result.created_at = now;
    }
    result.updated_at = now;
    
    // Add default status from primitive
    if (!result.status) {
      // Get default status from base primitive (would need to reference primitive data)
      result.status = 'draft'; // Default fallback
    }
    
    return result;
  }

  /**
   * Check workflow transitions
   */
  validateWorkflowTransition(currentStatus: string, newStatus: string, config: EntityConfig): ValidationResult {
    if (!config.workflows || !config.workflows[currentStatus]) {
      return { valid: true, errors: [] }; // No workflow restrictions
    }
    
    const allowedTransitions = config.workflows[currentStatus];
    const valid = allowedTransitions.includes(newStatus);
    
    return {
      valid,
      errors: valid ? [] : [`Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ')}`]
    };
  }
}