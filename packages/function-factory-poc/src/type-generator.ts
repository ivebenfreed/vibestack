// TypeScript Type Generator - Creates type definitions for custom entities
// Generates client-side interfaces and API helpers

import type { EntityConfig } from './json-rules-engine.js';
import type { DatabaseTable } from './database-manager.js';

export interface GeneratedType {
  orgId: string;
  entityName: string;
  interface: string;
  apiHelper: string;
  validationHelper: string;
  generatedAt: string;
}

export interface TypeGenerationReport {
  totalTypes: number;
  organizationSummary: Record<string, number>;
  generatedFiles: GeneratedType[];
}

/**
 * TypeScript Type Generator for multi-org entities
 */
export class TypeGenerator {
  private generatedTypes: Map<string, GeneratedType> = new Map();

  /**
   * Generate TypeScript types for an entity configuration
   */
  generateEntityTypes(config: EntityConfig, table: DatabaseTable): GeneratedType {
    const typeKey = `${config.orgId}:${config.name}`;
    
    const interfaceCode = this.generateInterface(config, table);
    const apiHelperCode = this.generateApiHelper(config);
    const validationHelperCode = this.generateValidationHelper(config);

    const generatedType: GeneratedType = {
      orgId: config.orgId,
      entityName: config.name,
      interface: interfaceCode,
      apiHelper: apiHelperCode,
      validationHelper: validationHelperCode,
      generatedAt: new Date().toISOString()
    };

    this.generatedTypes.set(typeKey, generatedType);
    return generatedType;
  }

  /**
   * Generate TypeScript interface
   */
  private generateInterface(config: EntityConfig, table: DatabaseTable): string {
    const baseFields = this.getBaseInterfaceFields(config.basePrimitive);
    const customFields = this.generateCustomFields(config.customFields);

    return `// Generated TypeScript interface for ${config.name}
// Organization: ${config.orgId}
// Generated at: ${new Date().toISOString()}

export interface ${config.name} {
${baseFields.map(field => `  ${field}`).join('\n')}
${customFields.map(field => `  ${field}`).join('\n')}
  
  // System fields
  organization_id: string;
  custom_data?: Record<string, any>;
}

export interface ${config.name}CreateInput {
${baseFields.filter(f => !f.includes('id:') && !f.includes('created_at:') && !f.includes('updated_at:')).map(field => `  ${field}`).join('\n')}
${customFields.map(field => `  ${field}`).join('\n')}
}

export interface ${config.name}UpdateInput {
${baseFields.filter(f => !f.includes('id:') && !f.includes('created_at:')).map(field => `  ${field.replace(/:/g, '?:')}}`).join('\n')}
${customFields.map(field => `  ${field.replace(/:/g, '?:')}`).join('\n')}
}

export interface ${config.name}Query {
${baseFields.map(field => `  ${field.replace(/:/g, '?:')}}`).join('\n')}
${customFields.map(field => `  ${field.replace(/:/g, '?:')}`).join('\n')}
}`;
  }

  /**
   * Get base interface fields for primitive type
   */
  private getBaseInterfaceFields(primitive: string): string[] {
    const baseFields = [
      'id: string',
      'created_at: Date',
      'updated_at: Date'
    ];

    switch (primitive) {
      case 'Project':
        return [
          ...baseFields,
          'name: string',
          'description?: string',
          'status: "draft" | "active" | "on_hold" | "completed" | "cancelled"'
        ];
      
      case 'Task':
        return [
          ...baseFields,
          'title: string',
          'description?: string',
          'priority: "low" | "medium" | "high" | "urgent"',
          'status: "todo" | "in_progress" | "review" | "done" | "cancelled"',
          'due_date?: Date',
          'assigned_to?: string'
        ];
      
      default:
        return baseFields;
    }
  }

  /**
   * Generate custom field type definitions
   */
  private generateCustomFields(customFields: Record<string, any>): string[] {
    return Object.entries(customFields).map(([fieldName, fieldDef]) => {
      let type = this.getTypeScriptType(fieldDef);
      const optional = fieldDef.required ? '' : '?';
      return `${fieldName}${optional}: ${type}`;
    });
  }

  /**
   * Convert field definition to TypeScript type
   */
  private getTypeScriptType(fieldDef: any): string {
    switch (fieldDef.type) {
      case 'string':
      case 'email':
      case 'url':
        return 'string';
      
      case 'number':
        return 'number';
      
      case 'boolean':
        return 'boolean';
      
      case 'date':
        return 'Date';
      
      case 'enum':
        if (fieldDef.enum && fieldDef.enum.length > 0) {
          return fieldDef.enum.map((v: string) => `"${v}"`).join(' | ');
        }
        return 'string';
      
      case 'array':
        const itemType = fieldDef.items || 'any';
        return `${this.getTypeScriptType({ type: itemType })}[]`;
      
      default:
        return 'any';
    }
  }

  /**
   * Generate API helper code
   */
  private generateApiHelper(config: EntityConfig): string {
    return `// Generated API helpers for ${config.name}
// Organization: ${config.orgId}

const BASE_URL = '/entity/${config.orgId}/${config.name}';

export class ${config.name}API {
  /**
   * Validate entity data against business rules
   */
  static async validate(data: ${config.name}CreateInput): Promise<{
    valid: boolean;
    errors: string[];
    data?: ${config.name}CreateInput;
  }> {
    const response = await fetch(\`\${BASE_URL}/validate\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }

  /**
   * Save new entity
   */
  static async create(data: ${config.name}CreateInput): Promise<{
    success: boolean;
    data?: ${config.name};
    errors?: string[];
  }> {
    const response = await fetch(\`\${BASE_URL}/save\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }

  /**
   * Update existing entity
   */
  static async update(id: string, data: ${config.name}UpdateInput): Promise<{
    success: boolean;
    data?: ${config.name};
    errors?: string[];
  }> {
    const response = await fetch(\`\${BASE_URL}/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }

  /**
   * Query entities with filters
   */
  static async query(filters: ${config.name}Query = {}): Promise<{
    success: boolean;
    data?: ${config.name}[];
    total?: number;
  }> {
    const response = await fetch(\`\${BASE_URL}/query\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    });
    
    return response.json();
  }

  /**
   * Get entity by ID
   */
  static async getById(id: string): Promise<{
    success: boolean;
    data?: ${config.name};
  }> {
    const response = await fetch(\`\${BASE_URL}/\${id}\`, {
      method: 'GET'
    });
    
    return response.json();
  }

  /**
   * Delete entity
   */
  static async delete(id: string): Promise<{
    success: boolean;
  }> {
    const response = await fetch(\`\${BASE_URL}/\${id}\`, {
      method: 'DELETE'
    });
    
    return response.json();
  }
}`;
  }

  /**
   * Generate validation helper code
   */
  private generateValidationHelper(config: EntityConfig): string {
    const validationRules = config.validationRules || { rules: [] };
    
    return `// Generated validation helpers for ${config.name}
// Organization: ${config.orgId}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ${config.name}Validator {
  /**
   * Client-side validation (mirrors server-side rules)
   */
  static validate(data: Partial<${config.name}>): ValidationResult {
    const errors: string[] = [];

    ${this.generateValidationCode(config.customFields, validationRules)}

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual field
   */
  static validateField(fieldName: keyof ${config.name}, value: any): ValidationResult {
    const errors: string[] = [];

    switch (fieldName) {
${Object.entries(config.customFields).map(([fieldName, fieldDef]) => 
  this.generateFieldValidation(fieldName, fieldDef)
).join('\n')}
      default:
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get field constraints
   */
  static getFieldConstraints(): Record<string, any> {
    return ${JSON.stringify(config.customFields, null, 4)};
  }

  /**
   * Get validation rules
   */
  static getValidationRules(): any {
    return ${JSON.stringify(validationRules, null, 4)};
  }
}`;
  }

  /**
   * Generate validation code for all fields
   */
  private generateValidationCode(customFields: Record<string, any>, validationRules: any): string {
    const fieldValidations = Object.entries(customFields).map(([fieldName, fieldDef]) => {
      const validations = [];

      if (fieldDef.required) {
        validations.push(`
    if (!data.${fieldName}) {
      errors.push('${fieldName} is required');
    }`);
      }

      if (fieldDef.type === 'string') {
        if (fieldDef.minLength) {
          validations.push(`
    if (data.${fieldName} && data.${fieldName}.length < ${fieldDef.minLength}) {
      errors.push('${fieldName} must be at least ${fieldDef.minLength} characters');
    }`);
        }
        if (fieldDef.maxLength) {
          validations.push(`
    if (data.${fieldName} && data.${fieldName}.length > ${fieldDef.maxLength}) {
      errors.push('${fieldName} must be no more than ${fieldDef.maxLength} characters');
    }`);
        }
      }

      if (fieldDef.type === 'number') {
        if (fieldDef.min !== undefined) {
          validations.push(`
    if (data.${fieldName} !== undefined && data.${fieldName} < ${fieldDef.min}) {
      errors.push('${fieldName} must be at least ${fieldDef.min}');
    }`);
        }
        if (fieldDef.max !== undefined) {
          validations.push(`
    if (data.${fieldName} !== undefined && data.${fieldName} > ${fieldDef.max}) {
      errors.push('${fieldName} must be no more than ${fieldDef.max}');
    }`);
        }
      }

      if (fieldDef.type === 'email') {
        validations.push(`
    if (data.${fieldName} && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.${fieldName})) {
      errors.push('${fieldName} must be a valid email address');
    }`);
      }

      if (fieldDef.type === 'url') {
        validations.push(`
    if (data.${fieldName}) {
      try { new URL(data.${fieldName}); } 
      catch { errors.push('${fieldName} must be a valid URL'); }
    }`);
      }

      if (fieldDef.type === 'enum' && fieldDef.enum) {
        const enumValues = fieldDef.enum.map((v: string) => `'${v}'`).join(', ');
        validations.push(`
    if (data.${fieldName} && ![${enumValues}].includes(data.${fieldName})) {
      errors.push('${fieldName} must be one of: ${fieldDef.enum.join(', ')}');
    }`);
      }

      return validations.join('');
    }).join('');

    // Add custom business rule validations
    const businessRules = validationRules.rules?.map((rule: any) => {
      const condition = this.generateRuleCondition(rule);
      return `
    if (data.${rule.field} !== undefined && !(${condition})) {
      errors.push('${rule.message || `${rule.field} failed ${rule.operator} validation`}');
    }`;
    }).join('') || '';

    return fieldValidations + businessRules;
  }

  /**
   * Generate field-specific validation
   */
  private generateFieldValidation(fieldName: string, fieldDef: any): string {
    return `      case '${fieldName}':
        // Field type: ${fieldDef.type}
        if (value !== undefined) {
          // Add specific validation logic here
        }
        break;`;
  }

  /**
   * Generate rule condition for business rules
   */
  private generateRuleCondition(rule: any): string {
    const field = `data.${rule.field}`;
    
    switch (rule.operator) {
      case 'greater_than':
        return `${field} > ${rule.value}`;
      case 'greater_than_equal':
        return `${field} >= ${rule.value}`;
      case 'less_than':
        return `${field} < ${rule.value}`;
      case 'less_than_equal':
        return `${field} <= ${rule.value}`;
      case 'equals':
        return `${field} === '${rule.value}'`;
      case 'not_equals':
        return `${field} !== '${rule.value}'`;
      case 'starts_with':
        return `${field}.startsWith('${rule.value}')`;
      case 'ends_with':
        return `${field}.endsWith('${rule.value}')`;
      case 'contains':
        return `${field}.includes('${rule.value}')`;
      case 'min_length':
        return `${field}.length >= ${rule.value}`;
      case 'max_length':
        return `${field}.length <= ${rule.value}`;
      default:
        return 'true';
    }
  }

  /**
   * Get all generated types for an organization
   */
  getOrgTypes(orgId: string): GeneratedType[] {
    return Array.from(this.generatedTypes.values()).filter(type => type.orgId === orgId);
  }

  /**
   * Get all generated types
   */
  getAllTypes(): GeneratedType[] {
    return Array.from(this.generatedTypes.values());
  }

  /**
   * Generate type generation report
   */
  generateReport(): TypeGenerationReport {
    const allTypes = this.getAllTypes();
    const organizationSummary: Record<string, number> = {};

    allTypes.forEach(type => {
      organizationSummary[type.orgId] = (organizationSummary[type.orgId] || 0) + 1;
    });

    return {
      totalTypes: allTypes.length,
      organizationSummary,
      generatedFiles: allTypes
    };
  }
}