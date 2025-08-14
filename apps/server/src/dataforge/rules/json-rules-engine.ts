/**
 * JSON Rules Engine - Server-Only DataForge Implementation
 * 
 * Provides secure, declarative business logic without eval() or Function().
 * Moved from Function Factory POC to server-only DataForge system.
 */

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

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'email' | 'url' | 'json' | 'text' | 
        'status_option' | 'priority_option' | 'category_option' | 'discussion_type_option' | 
        'user_reference' | 'entity_reference' | 'rich_text' | 'datetime' | 'decimal' | 'integer' | 'longtext';
  required?: boolean;
  syncable?: boolean;        // NEW: Controls client sync
  serverOnly?: boolean;      // NEW: Server-only fields
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  default?: any;
  defaultValue?: any;        // Universal archetype compatibility
}

export interface EntityConfig {
  name: string;
  orgId: string;
  basePrimitive: 'Project' | 'Task' | 'Event' | 'Contact' | 'Record' | 'Document' | 'File' | 'Activity' | 'Discussion' | 'Collection';
  tableName: string;         // {orgId}_{entityName}s
  customFields: Record<string, FieldDefinition>;
  validationRules: RuleSet;
  workflows?: Record<string, string[]>;
  defaultValues?: Record<string, any>;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: any;
  syncableData?: any;       // NEW: Filtered data for client sync
}

/**
 * JSON Rules Engine - Secure alternative to dynamic code execution
 * Enhanced for server-only DataForge with sync field filtering
 */
export class JsonRulesEngine {
  /**
   * Complete validation pipeline: types, rules, workflow
   */
  validate(data: any, config: EntityConfig): ValidationResult {
    // Step 1: Apply defaults
    const dataWithDefaults = this.applyDefaults(data, config);
    
    // Step 2: Type validation
    const typeValidation = this.validateFieldTypes(dataWithDefaults, config);
    if (!typeValidation.valid) {
      return typeValidation;
    }
    
    // Step 3: Business rules validation
    const rulesValidation = this.validateRules(dataWithDefaults, config.validationRules);
    if (!rulesValidation.valid) {
      return rulesValidation;
    }
    
    // Step 4: Generate final data with sync filtering
    const saveData = this.generateSaveData(dataWithDefaults, config);
    const syncableData = this.filterSyncableFields(saveData, config);
    
    return {
      valid: true,
      errors: [],
      data: saveData,
      syncableData: syncableData
    };
  }

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
        case 'text':
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
          
        case 'json':
          // JSON fields are accepted as-is
          break;
          
        // Universal Archetype Field Types
        case 'longtext':
        case 'rich_text':
          if (typeof value !== 'string') {
            errors.push(`${fieldName} must be a string`);
          }
          break;
          
        case 'datetime':
          const datetimeValue = new Date(value);
          if (isNaN(datetimeValue.getTime())) {
            errors.push(`${fieldName} must be a valid datetime`);
          }
          break;
          
        case 'decimal':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`${fieldName} must be a decimal number`);
          }
          break;
          
        case 'integer':
          if (!Number.isInteger(value)) {
            errors.push(`${fieldName} must be an integer`);
          }
          break;
          
        case 'status_option':
        case 'priority_option':
        case 'category_option':
        case 'discussion_type_option':
          if (typeof value !== 'string') {
            errors.push(`${fieldName} must be a string option`);
          }
          break;
          
        case 'user_reference':
        case 'entity_reference':
          if (typeof value !== 'string') {
            errors.push(`${fieldName} must be a valid reference ID`);
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
      result.id = crypto.randomUUID();
    }
    if (!result.created_at) {
      result.created_at = now;
    }
    result.updated_at = now;
    result.organization_id = config.orgId;
    
    // Add default status from primitive
    if (!result.status) {
      result.status = 'active'; // Default for all primitives
    }
    
    return result;
  }

  /**
   * Filter data to only include syncable fields for client
   */
  filterSyncableFields(data: any, config: EntityConfig): any {
    const syncableData: any = {
      // Always include base archetype fields (always syncable)
      id: data.id,
      organization_id: data.organization_id,
      name: data.name,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at
    };

    // Add primitive-specific base fields
    switch (config.basePrimitive) {
      case 'Project':
        syncableData.description = data.description;
        syncableData.priority = data.priority;
        syncableData.start_date = data.start_date;
        syncableData.end_date = data.end_date;
        break;
      case 'Task':
        syncableData.project_id = data.project_id;
        syncableData.description = data.description;
        syncableData.priority = data.priority;
        syncableData.due_date = data.due_date;
        break;
      case 'Event':
        syncableData.description = data.description;
        syncableData.start_time = data.start_time;
        syncableData.end_time = data.end_time;
        syncableData.location = data.location;
        break;
      case 'Contact':
        syncableData.email = data.email;
        syncableData.phone = data.phone;
        syncableData.company = data.company;
        break;
      case 'Record':
        syncableData.category = data.category;
        syncableData.data = data.data;
        break;
      case 'Document':
        syncableData.title = data.title;
        syncableData.content = data.content;
        syncableData.version = data.version;
        break;
      case 'File':
        syncableData.filename = data.filename;
        syncableData.mime_type = data.mime_type;
        syncableData.file_size = data.file_size;
        syncableData.storage_key = data.storage_key;
        break;
      case 'Activity':
        syncableData.title = data.title;
        syncableData.start_time = data.start_time;
        syncableData.end_time = data.end_time;
        break;
      case 'Discussion':
        syncableData.content = data.content;
        syncableData.author_id = data.author_id;
        syncableData.discussion_type = data.discussion_type;
        break;
      case 'Collection':
        syncableData.collection_type = data.collection_type;
        syncableData.aggregates = data.aggregates;
        syncableData.filters = data.filters;
        break;
    }

    // Add only syncable custom fields
    for (const [fieldName, fieldDef] of Object.entries(config.customFields)) {
      if (fieldDef.syncable !== false && !fieldDef.serverOnly) {
        const snakeField = this.camelToSnake(fieldName);
        syncableData[snakeField] = data[snakeField] || data[fieldName];
      }
    }

    return syncableData;
  }

  /**
   * Check workflow transitions
   */
  validateWorkflowTransition(currentStatus: string, newStatus: string, config: EntityConfig): ValidationResult {
    if (!config.workflows || !config.workflows[currentStatus]) {
      return { valid: true, errors: [] };
    }
    
    const allowedTransitions = config.workflows[currentStatus];
    const valid = allowedTransitions.includes(newStatus);
    
    return {
      valid,
      errors: valid ? [] : [`Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ')}`]
    };
  }

  /**
   * Convert camelCase to snake_case for database fields
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}