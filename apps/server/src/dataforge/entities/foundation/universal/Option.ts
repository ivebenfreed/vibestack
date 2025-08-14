/**
 * Option Entity - Universal Configuration System
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Provides flexible configuration options with type validation and conditional logic.
 * Supports dropdown lists, settings, feature flags, dynamic forms, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export type OptionValueType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime' 
  | 'json' 
  | 'enum' 
  | 'multi_enum'
  | 'email'
  | 'url'
  | 'color'
  | 'file'
  | 'reference';

export interface OptionValidationRule {
  type: 'required' | 'min' | 'max' | 'regex' | 'custom';
  value?: any;
  message?: string;
}

export interface OptionConditionalLogic {
  condition: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  dependsOn: string; // Other option key
  value: any;
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'clear';
}

export interface OptionFields extends BaseDomainEntityFields {
  key: string;
  display_name: string;
  description: string | null;
  option_set_id: string | null;
  value_type: OptionValueType;
  default_value: any;
  allowed_values: any;
  validation_rules: OptionValidationRule[];
  conditional_logic: OptionConditionalLogic[];
  sort_order: number;
  is_required: boolean;
  is_readonly: boolean;
  is_visible: boolean;
  is_system_option: boolean;
  metadata: any;
}

export class Option extends BaseDomainEntity {
  key!: string;
  display_name!: string;
  description?: string | null;
  option_set_id?: string | null; // Groups related options
  value_type!: OptionValueType;
  default_value?: any;
  allowed_values?: any; // For enum types, reference constraints, etc.
  validation_rules!: OptionValidationRule[];
  conditional_logic!: OptionConditionalLogic[];
  sort_order!: number;
  is_required!: boolean;
  is_readonly!: boolean;
  is_visible!: boolean;
  is_system_option!: boolean;
  metadata?: any; // UI hints, help text, styling, etc.

  constructor(data?: Partial<OptionFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'option';
    if (!this.value_type) this.value_type = 'string';
    if (!this.validation_rules) this.validation_rules = [];
    if (!this.conditional_logic) this.conditional_logic = [];
    if (this.sort_order === undefined) this.sort_order = 100;
    if (this.is_required === undefined) this.is_required = false;
    if (this.is_readonly === undefined) this.is_readonly = false;
    if (this.is_visible === undefined) this.is_visible = true;
    if (this.is_system_option === undefined) this.is_system_option = false;
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for Option table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      key: 'varchar(100)',
      display_name: 'varchar(200)',
      description: 'text',
      option_set_id: 'uuid',
      value_type: 'varchar(50)',
      default_value: 'jsonb',
      allowed_values: 'jsonb',
      validation_rules: 'jsonb',
      conditional_logic: 'jsonb',
      sort_order: 'integer',
      is_required: 'boolean',
      is_readonly: 'boolean',
      is_visible: 'boolean',
      is_system_option: 'boolean',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for Option table creation
   */
  static getOptionDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "option" (
        ${super.getDomainDDL()},
        key VARCHAR(100) NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        description TEXT,
        option_set_id UUID REFERENCES "option_set"(id),
        value_type VARCHAR(50) DEFAULT 'string' NOT NULL,
        default_value JSONB,
        allowed_values JSONB,
        validation_rules JSONB DEFAULT '[]' NOT NULL,
        conditional_logic JSONB DEFAULT '[]' NOT NULL,
        sort_order INTEGER DEFAULT 100 NOT NULL,
        is_required BOOLEAN DEFAULT FALSE NOT NULL,
        is_readonly BOOLEAN DEFAULT FALSE NOT NULL,
        is_visible BOOLEAN DEFAULT TRUE NOT NULL,
        is_system_option BOOLEAN DEFAULT FALSE NOT NULL,
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT unique_option_key_per_container UNIQUE (container_type, container_id, key),
        CONSTRAINT chk_valid_value_type CHECK (value_type IN (
          'string', 'number', 'boolean', 'date', 'datetime', 'json', 
          'enum', 'multi_enum', 'email', 'url', 'color', 'file', 'reference'
        ))
      );
    `;
  }

  /**
   * Get the indexes for Option table
   */
  static getOptionIndexes(): string[] {
    return [
      ...super.getDomainIndexes('option'),
      `CREATE INDEX IF NOT EXISTS idx_option_key ON "option"(key);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set ON "option"(option_set_id);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_type ON "option"(value_type);`,
      `CREATE INDEX IF NOT EXISTS idx_option_sort_order ON "option"(sort_order);`,
      `CREATE INDEX IF NOT EXISTS idx_option_required ON "option"(is_required);`,
      `CREATE INDEX IF NOT EXISTS idx_option_visible ON "option"(is_visible);`,
      `CREATE INDEX IF NOT EXISTS idx_option_system ON "option"(is_system_option);`,
      `CREATE INDEX IF NOT EXISTS idx_option_metadata ON "option" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_option_validation ON "option" USING GIN(validation_rules);`,
      `CREATE INDEX IF NOT EXISTS idx_option_conditional ON "option" USING GIN(conditional_logic);`,
      `CREATE INDEX IF NOT EXISTS idx_option_container_key ON "option"(container_type, container_id, key);`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): OptionFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      key: this.key,
      display_name: this.display_name,
      description: this.description,
      option_set_id: this.option_set_id,
      value_type: this.value_type || 'string',
      default_value: this.default_value,
      allowed_values: this.allowed_values,
      validation_rules: this.validation_rules || [],
      conditional_logic: this.conditional_logic || [],
      sort_order: this.sort_order || 100,
      is_required: this.is_required || false,
      is_readonly: this.is_readonly || false,
      is_visible: this.is_visible !== false,
      is_system_option: this.is_system_option || false,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<OptionFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      display_name: this.display_name,
      description: this.description,
      option_set_id: this.option_set_id,
      default_value: this.default_value,
      allowed_values: this.allowed_values,
      validation_rules: this.validation_rules,
      conditional_logic: this.conditional_logic,
      sort_order: this.sort_order,
      is_required: this.is_required,
      is_readonly: this.is_readonly,
      is_visible: this.is_visible,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): OptionFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      key: this.key,
      display_name: this.display_name,
      description: this.description,
      option_set_id: this.option_set_id,
      value_type: this.value_type,
      default_value: this.default_value,
      allowed_values: this.allowed_values,
      validation_rules: this.validation_rules,
      conditional_logic: this.conditional_logic,
      sort_order: this.sort_order,
      is_required: this.is_required,
      is_readonly: this.is_readonly,
      is_visible: this.is_visible,
      is_system_option: this.is_system_option,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Validate a value against this option's type and rules
   */
  validateValue(value: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required
    if (this.is_required && (value === null || value === undefined || value === '')) {
      errors.push(`${this.display_name} is required`);
      return { valid: false, errors };
    }

    // Skip further validation if value is empty and not required
    if (!this.is_required && (value === null || value === undefined || value === '')) {
      return { valid: true, errors: [] };
    }

    // Type validation
    const typeValid = this.validateType(value);
    if (!typeValid.valid) {
      errors.push(...typeValid.errors);
    }

    // Value constraints (enum, allowed values)
    const constraintValid = this.validateConstraints(value);
    if (!constraintValid.valid) {
      errors.push(...constraintValid.errors);
    }

    // Custom validation rules
    const rulesValid = this.validateRules(value);
    if (!rulesValid.valid) {
      errors.push(...rulesValid.errors);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate value type
   */
  private validateType(value: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (this.value_type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${this.display_name} must be a string`);
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`${this.display_name} must be a valid number`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${this.display_name} must be true or false`);
        }
        break;

      case 'date':
      case 'datetime':
        if (!(value instanceof Date) && !this.isValidDateString(value)) {
          errors.push(`${this.display_name} must be a valid date`);
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          errors.push(`${this.display_name} must be a valid email address`);
        }
        break;

      case 'url':
        if (typeof value !== 'string' || !this.isValidUrl(value)) {
          errors.push(`${this.display_name} must be a valid URL`);
        }
        break;

      case 'color':
        if (typeof value !== 'string' || !this.isValidColor(value)) {
          errors.push(`${this.display_name} must be a valid color (hex code or CSS color name)`);
        }
        break;

      case 'json':
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          }
        } catch {
          errors.push(`${this.display_name} must be valid JSON`);
        }
        break;

      case 'enum':
        if (!this.allowed_values || !this.allowed_values.includes(value)) {
          errors.push(`${this.display_name} must be one of: ${this.allowed_values?.join(', ')}`);
        }
        break;

      case 'multi_enum':
        if (!Array.isArray(value)) {
          errors.push(`${this.display_name} must be an array`);
        } else if (this.allowed_values) {
          const invalidValues = value.filter(v => !this.allowed_values.includes(v));
          if (invalidValues.length > 0) {
            errors.push(`${this.display_name} contains invalid values: ${invalidValues.join(', ')}`);
          }
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate value constraints
   */
  private validateConstraints(value: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Additional constraint validation would go here
    // This could include things like min/max values, string length, etc.

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate custom rules
   */
  private validateRules(value: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of this.validation_rules) {
      switch (rule.type) {
        case 'required':
          if (!value) {
            errors.push(rule.message || `${this.display_name} is required`);
          }
          break;

        case 'min':
          if (typeof value === 'number' && value < rule.value) {
            errors.push(rule.message || `${this.display_name} must be at least ${rule.value}`);
          } else if (typeof value === 'string' && value.length < rule.value) {
            errors.push(rule.message || `${this.display_name} must be at least ${rule.value} characters`);
          }
          break;

        case 'max':
          if (typeof value === 'number' && value > rule.value) {
            errors.push(rule.message || `${this.display_name} must be at most ${rule.value}`);
          } else if (typeof value === 'string' && value.length > rule.value) {
            errors.push(rule.message || `${this.display_name} must be at most ${rule.value} characters`);
          }
          break;

        case 'regex':
          if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
            errors.push(rule.message || `${this.display_name} format is invalid`);
          }
          break;

        case 'custom':
          // Custom validation would be handled by external validators
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Helper validation methods
   */
  private isValidDateString(value: any): boolean {
    return typeof value === 'string' && !isNaN(Date.parse(value));
  }

  private isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private isValidUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private isValidColor(value: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(value) || /^[a-z-]+$/.test(value);
  }

  /**
   * Check if option should be visible based on conditional logic
   */
  shouldBeVisible(values: Record<string, any>): boolean {
    if (!this.is_visible) return false;

    for (const condition of this.conditional_logic) {
      if (condition.action === 'show' || condition.action === 'hide') {
        const dependentValue = values[condition.dependsOn];
        const conditionMet = this.evaluateCondition(condition, dependentValue);
        
        if (condition.action === 'show' && !conditionMet) return false;
        if (condition.action === 'hide' && conditionMet) return false;
      }
    }

    return true;
  }

  /**
   * Check if option should be enabled based on conditional logic
   */
  shouldBeEnabled(values: Record<string, any>): boolean {
    if (this.is_readonly) return false;

    for (const condition of this.conditional_logic) {
      if (condition.action === 'enable' || condition.action === 'disable') {
        const dependentValue = values[condition.dependsOn];
        const conditionMet = this.evaluateCondition(condition, dependentValue);
        
        if (condition.action === 'enable' && !conditionMet) return false;
        if (condition.action === 'disable' && conditionMet) return false;
      }
    }

    return true;
  }

  /**
   * Check if option should be required based on conditional logic
   */
  shouldBeRequired(values: Record<string, any>): boolean {
    let required = this.is_required;

    for (const condition of this.conditional_logic) {
      if (condition.action === 'require') {
        const dependentValue = values[condition.dependsOn];
        const conditionMet = this.evaluateCondition(condition, dependentValue);
        
        if (conditionMet) required = true;
      }
    }

    return required;
  }

  /**
   * Evaluate a conditional logic condition
   */
  private evaluateCondition(condition: OptionConditionalLogic, actualValue: any): boolean {
    switch (condition.condition) {
      case 'equals':
        return actualValue === condition.value;
      case 'not_equals':
        return actualValue !== condition.value;
      case 'contains':
        return Array.isArray(actualValue) ? actualValue.includes(condition.value) : false;
      case 'greater_than':
        return typeof actualValue === 'number' && actualValue > condition.value;
      case 'less_than':
        return typeof actualValue === 'number' && actualValue < condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(actualValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(actualValue);
      default:
        return false;
    }
  }

  /**
   * Get option configuration for UI rendering
   */
  getUIConfig(): {
    key: string;
    label: string;
    type: string;
    required: boolean;
    readonly: boolean;
    visible: boolean;
    defaultValue?: any;
    options?: any[];
    validation?: OptionValidationRule[];
    help?: string;
    placeholder?: string;
  } {
    return {
      key: this.key,
      label: this.display_name,
      type: this.value_type,
      required: this.is_required,
      readonly: this.is_readonly,
      visible: this.is_visible,
      defaultValue: this.default_value,
      options: this.allowed_values,
      validation: this.validation_rules,
      help: this.description || undefined,
      placeholder: this.metadata?.placeholder
    };
  }

  /**
   * Clone option with modifications
   */
  clone(modifications: Partial<OptionFields>): Option {
    return new Option({
      ...this.toJSON(),
      ...modifications,
      id: undefined, // New option gets new ID
      created_at: undefined,
      updated_at: undefined
    });
  }

  /**
   * Get option summary
   */
  getSummary(): {
    key: string;
    displayName: string;
    type: OptionValueType;
    required: boolean;
    hasConditionalLogic: boolean;
    hasValidation: boolean;
  } {
    return {
      key: this.key,
      displayName: this.display_name,
      type: this.value_type,
      required: this.is_required,
      hasConditionalLogic: this.conditional_logic.length > 0,
      hasValidation: this.validation_rules.length > 0
    };
  }
}

export default Option;