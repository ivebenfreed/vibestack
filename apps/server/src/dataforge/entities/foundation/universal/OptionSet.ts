/**
 * OptionSet Entity - Option Grouping and Validation System
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Groups related options together with cross-option validation rules and configuration schemas.
 * Supports form sections, configuration groups, feature sets, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';
import type { Option, OptionValidationRule } from './Option';

export interface OptionSetValidationRule {
  type: 'cross_field' | 'sum' | 'count' | 'custom';
  fields: string[]; // Option keys involved in validation
  operator?: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between';
  value?: any;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface OptionSetConditionalRule {
  condition: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'in';
    value: any;
  };
  actions: {
    type: 'show_section' | 'hide_section' | 'enable_options' | 'disable_options' | 'require_options';
    targets: string[]; // Option keys or section names
  }[];
}

export interface OptionSetFields extends BaseDomainEntityFields {
  name: string;
  display_name: string;
  description: string | null;
  category: string;
  set_type: string;
  validation_rules: OptionSetValidationRule[];
  conditional_rules: OptionSetConditionalRule[];
  ui_schema: any;
  sort_order: number;
  is_system_set: boolean;
  is_active: boolean;
  metadata: any;
}

export class OptionSet extends BaseDomainEntity {
  name!: string;
  display_name!: string;
  description?: string | null;
  category!: string; // form, settings, configuration, features, etc.
  set_type!: string; // section, group, wizard_step, schema, etc.
  validation_rules!: OptionSetValidationRule[];
  conditional_rules!: OptionSetConditionalRule[];
  ui_schema?: any; // UI layout and presentation configuration
  sort_order!: number;
  is_system_set!: boolean;
  is_active!: boolean;
  metadata?: any;

  constructor(data?: Partial<OptionSetFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'option_set';
    if (!this.category) this.category = 'general';
    if (!this.set_type) this.set_type = 'group';
    if (!this.validation_rules) this.validation_rules = [];
    if (!this.conditional_rules) this.conditional_rules = [];
    if (this.sort_order === undefined) this.sort_order = 100;
    if (this.is_system_set === undefined) this.is_system_set = false;
    if (this.is_active === undefined) this.is_active = true;
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for OptionSet table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      name: 'varchar(100)',
      display_name: 'varchar(200)',
      description: 'text',
      category: 'varchar(50)',
      set_type: 'varchar(50)',
      validation_rules: 'jsonb',
      conditional_rules: 'jsonb',
      ui_schema: 'jsonb',
      sort_order: 'integer',
      is_system_set: 'boolean',
      is_active: 'boolean',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for OptionSet table creation
   */
  static getOptionSetDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "option_set" (
        ${super.getDomainDDL()},
        name VARCHAR(100) NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general' NOT NULL,
        set_type VARCHAR(50) DEFAULT 'group' NOT NULL,
        validation_rules JSONB DEFAULT '[]' NOT NULL,
        conditional_rules JSONB DEFAULT '[]' NOT NULL,
        ui_schema JSONB,
        sort_order INTEGER DEFAULT 100 NOT NULL,
        is_system_set BOOLEAN DEFAULT FALSE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT unique_option_set_name_per_container UNIQUE (container_type, container_id, name),
        CONSTRAINT chk_valid_set_type CHECK (set_type IN ('group', 'section', 'wizard_step', 'schema', 'template'))
      );
    `;
  }

  /**
   * Get the indexes for OptionSet table
   */
  static getOptionSetIndexes(): string[] {
    return [
      ...super.getDomainIndexes('option_set'),
      `CREATE INDEX IF NOT EXISTS idx_option_set_name ON "option_set"(name);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set_category ON "option_set"(category);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set_type ON "option_set"(set_type);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set_sort_order ON "option_set"(sort_order);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set_active ON "option_set"(is_active);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set_system ON "option_set"(is_system_set);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set_metadata ON "option_set" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set_validation ON "option_set" USING GIN(validation_rules);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set_conditional ON "option_set" USING GIN(conditional_rules);`,
      `CREATE INDEX IF NOT EXISTS idx_option_set_container_name ON "option_set"(container_type, container_id, name);`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): OptionSetFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      name: this.name,
      display_name: this.display_name,
      description: this.description,
      category: this.category || 'general',
      set_type: this.set_type || 'group',
      validation_rules: this.validation_rules || [],
      conditional_rules: this.conditional_rules || [],
      ui_schema: this.ui_schema,
      sort_order: this.sort_order || 100,
      is_system_set: this.is_system_set || false,
      is_active: this.is_active !== false,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<OptionSetFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      display_name: this.display_name,
      description: this.description,
      validation_rules: this.validation_rules,
      conditional_rules: this.conditional_rules,
      ui_schema: this.ui_schema,
      sort_order: this.sort_order,
      is_active: this.is_active,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): OptionSetFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      name: this.name,
      display_name: this.display_name,
      description: this.description,
      category: this.category,
      set_type: this.set_type,
      validation_rules: this.validation_rules,
      conditional_rules: this.conditional_rules,
      ui_schema: this.ui_schema,
      sort_order: this.sort_order,
      is_system_set: this.is_system_set,
      is_active: this.is_active,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Validate a set of option values against this set's rules
   */
  validateValues(values: Record<string, any>, options: Option[]): { 
    valid: boolean; 
    errors: string[]; 
    warnings: string[];
    fieldErrors: Record<string, string[]>;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldErrors: Record<string, string[]> = {};

    // First validate individual options
    for (const option of options) {
      const value = values[option.key];
      const optionResult = option.validateValue(value);
      
      if (!optionResult.valid) {
        fieldErrors[option.key] = optionResult.errors;
        errors.push(...optionResult.errors);
      }
    }

    // Then validate cross-option rules
    for (const rule of this.validation_rules) {
      const ruleResult = this.validateRule(rule, values);
      
      if (!ruleResult.valid) {
        if (rule.severity === 'error') {
          errors.push(ruleResult.message);
        } else if (rule.severity === 'warning') {
          warnings.push(ruleResult.message);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fieldErrors
    };
  }

  /**
   * Validate a single cross-option rule
   */
  private validateRule(rule: OptionSetValidationRule, values: Record<string, any>): {
    valid: boolean;
    message: string;
  } {
    const fieldValues = rule.fields.map(field => values[field]);

    switch (rule.type) {
      case 'cross_field':
        return this.validateCrossField(rule, fieldValues);
      
      case 'sum':
        return this.validateSum(rule, fieldValues);
      
      case 'count':
        return this.validateCount(rule, fieldValues);
      
      case 'custom':
        // Custom validation would be handled by external validators
        return { valid: true, message: '' };
      
      default:
        return { valid: true, message: '' };
    }
  }

  /**
   * Validate cross-field rules
   */
  private validateCrossField(rule: OptionSetValidationRule, values: any[]): {
    valid: boolean;
    message: string;
  } {
    if (values.length < 2) {
      return { valid: true, message: '' };
    }

    const [first, second] = values;

    switch (rule.operator) {
      case 'equals':
        return {
          valid: first === second,
          message: first === second ? '' : rule.message
        };

      case 'not_equals':
        return {
          valid: first !== second,
          message: first !== second ? '' : rule.message
        };

      case 'greater_than':
        return {
          valid: typeof first === 'number' && typeof second === 'number' && first > second,
          message: (typeof first === 'number' && typeof second === 'number' && first > second) ? '' : rule.message
        };

      case 'less_than':
        return {
          valid: typeof first === 'number' && typeof second === 'number' && first < second,
          message: (typeof first === 'number' && typeof second === 'number' && first < second) ? '' : rule.message
        };

      default:
        return { valid: true, message: '' };
    }
  }

  /**
   * Validate sum rules
   */
  private validateSum(rule: OptionSetValidationRule, values: any[]): {
    valid: boolean;
    message: string;
  } {
    const numericValues = values.filter(v => typeof v === 'number');
    const sum = numericValues.reduce((acc, val) => acc + val, 0);

    switch (rule.operator) {
      case 'equals':
        return {
          valid: sum === rule.value,
          message: sum === rule.value ? '' : rule.message
        };

      case 'less_than':
        return {
          valid: sum < rule.value,
          message: sum < rule.value ? '' : rule.message
        };

      case 'greater_than':
        return {
          valid: sum > rule.value,
          message: sum > rule.value ? '' : rule.message
        };

      default:
        return { valid: true, message: '' };
    }
  }

  /**
   * Validate count rules
   */
  private validateCount(rule: OptionSetValidationRule, values: any[]): {
    valid: boolean;
    message: string;
  } {
    const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
    const count = nonEmptyValues.length;

    switch (rule.operator) {
      case 'equals':
        return {
          valid: count === rule.value,
          message: count === rule.value ? '' : rule.message
        };

      case 'greater_than':
        return {
          valid: count > rule.value,
          message: count > rule.value ? '' : rule.message
        };

      case 'less_than':
        return {
          valid: count < rule.value,
          message: count < rule.value ? '' : rule.message
        };

      default:
        return { valid: true, message: '' };
    }
  }

  /**
   * Apply conditional rules to determine which options should be visible/enabled
   */
  applyConditionalRules(values: Record<string, any>): {
    visibleSections: string[];
    hiddenSections: string[];
    enabledOptions: string[];
    disabledOptions: string[];
    requiredOptions: string[];
  } {
    const result = {
      visibleSections: [] as string[],
      hiddenSections: [] as string[],
      enabledOptions: [] as string[],
      disabledOptions: [] as string[],
      requiredOptions: [] as string[]
    };

    for (const rule of this.conditional_rules) {
      const conditionMet = this.evaluateCondition(rule.condition, values);

      if (conditionMet) {
        for (const action of rule.actions) {
          switch (action.type) {
            case 'show_section':
              result.visibleSections.push(...action.targets);
              break;
            case 'hide_section':
              result.hiddenSections.push(...action.targets);
              break;
            case 'enable_options':
              result.enabledOptions.push(...action.targets);
              break;
            case 'disable_options':
              result.disabledOptions.push(...action.targets);
              break;
            case 'require_options':
              result.requiredOptions.push(...action.targets);
              break;
          }
        }
      }
    }

    return result;
  }

  /**
   * Evaluate a conditional rule condition
   */
  private evaluateCondition(condition: OptionSetConditionalRule['condition'], values: Record<string, any>): boolean {
    const fieldValue = values[condition.field];

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return Array.isArray(fieldValue) && fieldValue.includes(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Get complete form schema for UI rendering
   */
  getFormSchema(options: Option[]): {
    setInfo: {
      name: string;
      title: string;
      description?: string;
      type: string;
    };
    fields: any[];
    validation: OptionSetValidationRule[];
    conditionalRules: OptionSetConditionalRule[];
    uiSchema?: any;
  } {
    const sortedOptions = options.sort((a, b) => a.sort_order - b.sort_order);

    return {
      setInfo: {
        name: this.name,
        title: this.display_name,
        description: this.description || undefined,
        type: this.set_type
      },
      fields: sortedOptions.map(option => option.getUIConfig()),
      validation: this.validation_rules,
      conditionalRules: this.conditional_rules,
      uiSchema: this.ui_schema
    };
  }

  /**
   * Add validation rule
   */
  addValidationRule(rule: OptionSetValidationRule): void {
    this.validation_rules.push(rule);
  }

  /**
   * Remove validation rule
   */
  removeValidationRule(index: number): void {
    this.validation_rules.splice(index, 1);
  }

  /**
   * Add conditional rule
   */
  addConditionalRule(rule: OptionSetConditionalRule): void {
    this.conditional_rules.push(rule);
  }

  /**
   * Remove conditional rule
   */
  removeConditionalRule(index: number): void {
    this.conditional_rules.splice(index, 1);
  }

  /**
   * Clone option set with modifications
   */
  clone(modifications: Partial<OptionSetFields>): OptionSet {
    return new OptionSet({
      ...this.toJSON(),
      ...modifications,
      id: undefined, // New option set gets new ID
      created_at: undefined,
      updated_at: undefined
    });
  }

  /**
   * Get option set statistics
   */
  getStats(): {
    totalValidationRules: number;
    totalConditionalRules: number;
    hasUISchema: boolean;
    isSystemSet: boolean;
    complexityScore: number;
  } {
    const complexityScore = 
      this.validation_rules.length * 2 +
      this.conditional_rules.length * 3 +
      (this.ui_schema ? 1 : 0);

    return {
      totalValidationRules: this.validation_rules.length,
      totalConditionalRules: this.conditional_rules.length,
      hasUISchema: !!this.ui_schema,
      isSystemSet: this.is_system_set,
      complexityScore
    };
  }

  /**
   * Generate default UI schema based on options
   */
  generateDefaultUISchema(options: Option[]): any {
    const schema = {
      type: 'object',
      properties: {} as any,
      required: [] as string[],
      fieldsets: [] as any[]
    };

    // Group options by category or type
    const groups = new Map<string, Option[]>();
    
    for (const option of options) {
      const groupKey = option.metadata?.group || 'general';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(option);
    }

    // Create fieldsets for each group
    for (const [groupName, groupOptions] of groups) {
      schema.fieldsets.push({
        title: groupName.charAt(0).toUpperCase() + groupName.slice(1),
        fields: groupOptions.map(opt => opt.key)
      });

      // Add properties for each option
      for (const option of groupOptions) {
        schema.properties[option.key] = option.getUIConfig();
        if (option.is_required) {
          schema.required.push(option.key);
        }
      }
    }

    return schema;
  }

  /**
   * Get option set summary
   */
  getSummary(): {
    name: string;
    displayName: string;
    type: string;
    category: string;
    isActive: boolean;
    ruleCount: number;
    conditionalCount: number;
  } {
    return {
      name: this.name,
      displayName: this.display_name,
      type: this.set_type,
      category: this.category,
      isActive: this.is_active,
      ruleCount: this.validation_rules.length,
      conditionalCount: this.conditional_rules.length
    };
  }
}

export default OptionSet;