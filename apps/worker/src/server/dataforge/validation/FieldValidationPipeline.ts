/**
 * Field Validation Pipeline
 * 
 * Modular validation system for DataForge fields.
 * Each validator handles a specific aspect of field validation.
 */

import type { FieldDefinition } from '../services/FieldManager';

export interface ValidationContext {
  data: any;
  fields: Map<string, FieldDefinition>;
  archetype: string;
  organizationId: string;
  userId?: string;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
  constraint?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
  transformedData?: any;
}

/**
 * Base interface for field validators
 */
export interface IFieldValidator {
  name: string;
  order: number;
  validate(context: ValidationContext): Promise<ValidationResult>;
}

/**
 * Type validator - ensures field values match their declared types
 */
export class TypeValidator implements IFieldValidator {
  name = 'TypeValidator';
  order = 1;

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const transformedData = { ...context.data };

    for (const [fieldName, fieldDef] of context.fields) {
      const value = context.data[fieldName];
      
      // Skip undefined/null for optional fields
      if ((value === undefined || value === null) && !fieldDef.required) {
        continue;
      }

      const typeError = this.validateType(fieldName, value, fieldDef);
      if (typeError) {
        errors.push(typeError);
      } else {
        // Apply type coercion if needed
        const coerced = this.coerceType(value, fieldDef.type);
        if (coerced !== value) {
          transformedData[fieldName] = coerced;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      transformedData
    };
  }

  private validateType(field: string, value: any, def: FieldDefinition): ValidationError | null {
    switch (def.type) {
      case 'text':
      case 'longtext':
      case 'rich_text':
        if (typeof value !== 'string') {
          return {
            field,
            code: 'INVALID_TYPE',
            message: `Field '${field}' must be a string`,
            value
          };
        }
        break;

      case 'number':
      case 'decimal':
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field,
            code: 'INVALID_TYPE',
            message: `Field '${field}' must be a number`,
            value
          };
        }
        break;

      case 'integer':
        if (!Number.isInteger(value)) {
          return {
            field,
            code: 'INVALID_TYPE',
            message: `Field '${field}' must be an integer`,
            value
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            field,
            code: 'INVALID_TYPE',
            message: `Field '${field}' must be a boolean`,
            value
          };
        }
        break;

      case 'date':
      case 'datetime':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return {
            field,
            code: 'INVALID_TYPE',
            message: `Field '${field}' must be a valid date`,
            value
          };
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          return {
            field,
            code: 'INVALID_EMAIL',
            message: `Field '${field}' must be a valid email address`,
            value
          };
        }
        break;

      case 'url':
        if (typeof value !== 'string' || !this.isValidUrl(value)) {
          return {
            field,
            code: 'INVALID_URL',
            message: `Field '${field}' must be a valid URL`,
            value
          };
        }
        break;

      case 'json':
        if (typeof value === 'string') {
          try {
            JSON.parse(value);
          } catch {
            return {
              field,
              code: 'INVALID_JSON',
              message: `Field '${field}' must be valid JSON`,
              value
            };
          }
        }
        break;
    }

    return null;
  }

  private coerceType(value: any, type: string): any {
    switch (type) {
      case 'string':
      case 'text':
      case 'longtext':
        return value?.toString() || value;
      
      case 'number':
      case 'decimal':
        const num = Number(value);
        return isNaN(num) ? value : num;
      
      case 'integer':
        const int = parseInt(value, 10);
        return isNaN(int) ? value : int;
      
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);
      
      case 'date':
      case 'datetime':
        if (typeof value === 'string' || typeof value === 'number') {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date.toISOString();
        }
        return value;
      
      default:
        return value;
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Required field validator
 */
export class RequiredFieldValidator implements IFieldValidator {
  name = 'RequiredFieldValidator';
  order = 2;

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    for (const [fieldName, fieldDef] of context.fields) {
      if (fieldDef.required) {
        const value = context.data[fieldName];
        
        if (value === undefined || value === null || value === '') {
          errors.push({
            field: fieldName,
            code: 'REQUIRED_FIELD',
            message: `Field '${fieldName}' is required`,
            value
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Constraint validator - checks min/max, length, patterns, etc.
 */
export class ConstraintValidator implements IFieldValidator {
  name = 'ConstraintValidator';
  order = 3;

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    for (const [fieldName, fieldDef] of context.fields) {
      const value = context.data[fieldName];
      
      if (value === undefined || value === null) {
        continue;
      }

      // String length constraints
      if (typeof value === 'string') {
        if (fieldDef.minLength !== undefined && value.length < fieldDef.minLength) {
          errors.push({
            field: fieldName,
            code: 'MIN_LENGTH',
            message: `Field '${fieldName}' must be at least ${fieldDef.minLength} characters`,
            value: value.length,
            constraint: fieldDef.minLength
          });
        }

        if (fieldDef.maxLength !== undefined && value.length > fieldDef.maxLength) {
          errors.push({
            field: fieldName,
            code: 'MAX_LENGTH',
            message: `Field '${fieldName}' must be no more than ${fieldDef.maxLength} characters`,
            value: value.length,
            constraint: fieldDef.maxLength
          });
        }

        // Pattern validation
        if (fieldDef.pattern) {
          try {
            const regex = new RegExp(fieldDef.pattern);
            if (!regex.test(value)) {
              errors.push({
                field: fieldName,
                code: 'PATTERN_MISMATCH',
                message: `Field '${fieldName}' does not match required pattern`,
                value,
                constraint: fieldDef.pattern
              });
            }
          } catch (e) {
            errors.push({
              field: fieldName,
              code: 'INVALID_PATTERN',
              message: `Field '${fieldName}' has invalid regex pattern`,
              constraint: fieldDef.pattern
            });
          }
        }
      }

      // Number constraints
      if (typeof value === 'number') {
        if (fieldDef.min !== undefined && value < fieldDef.min) {
          errors.push({
            field: fieldName,
            code: 'MIN_VALUE',
            message: `Field '${fieldName}' must be at least ${fieldDef.min}`,
            value,
            constraint: fieldDef.min
          });
        }

        if (fieldDef.max !== undefined && value > fieldDef.max) {
          errors.push({
            field: fieldName,
            code: 'MAX_VALUE',
            message: `Field '${fieldName}' must be no more than ${fieldDef.max}`,
            value,
            constraint: fieldDef.max
          });
        }
      }

      // Enum validation
      if (fieldDef.enum && fieldDef.enum.length > 0) {
        if (!fieldDef.enum.includes(value)) {
          errors.push({
            field: fieldName,
            code: 'INVALID_ENUM',
            message: `Field '${fieldName}' must be one of: ${fieldDef.enum.join(', ')}`,
            value,
            constraint: fieldDef.enum
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Reference validator - validates entity and user references
 */
export class ReferenceValidator implements IFieldValidator {
  name = 'ReferenceValidator';
  order = 4;

  constructor(
    private validateUserRef?: (userId: string, orgId: string) => Promise<boolean>,
    private validateEntityRef?: (entityId: string, entityType: string, orgId: string) => Promise<boolean>
  ) {}

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    for (const [fieldName, fieldDef] of context.fields) {
      const value = context.data[fieldName];
      
      if (!value) continue;

      if (fieldDef.type === 'user_reference' && this.validateUserRef) {
        const isValid = await this.validateUserRef(value, context.organizationId);
        if (!isValid) {
          errors.push({
            field: fieldName,
            code: 'INVALID_USER_REF',
            message: `Field '${fieldName}' references non-existent user`,
            value
          });
        }
      }

      if (fieldDef.type === 'entity_reference' && this.validateEntityRef) {
        // Extract entity type from field name convention (e.g., project_id -> project)
        const entityType = fieldName.replace(/_id$/, '');
        const isValid = await this.validateEntityRef(value, entityType, context.organizationId);
        if (!isValid) {
          warnings.push({
            field: fieldName,
            code: 'INVALID_ENTITY_REF',
            message: `Field '${fieldName}' references non-existent ${entityType}`,
            value
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

/**
 * Business rule validator - applies custom business logic
 */
export class BusinessRuleValidator implements IFieldValidator {
  name = 'BusinessRuleValidator';
  order = 5;

  constructor(private rules?: any[]) {}

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Example business rules
    const data = context.data;

    // Rule: Due date must be in the future
    if (data.due_date && new Date(data.due_date) < new Date()) {
      errors.push({
        field: 'due_date',
        code: 'PAST_DUE_DATE',
        message: 'Due date must be in the future',
        value: data.due_date
      });
    }

    // Rule: If status is completed, actual_hours should be set
    if (data.status === 'completed' && !data.actual_hours) {
      errors.push({
        field: 'actual_hours',
        code: 'MISSING_ACTUAL_HOURS',
        message: 'Actual hours must be set when status is completed',
        value: data.actual_hours
      });
    }

    // Rule: Priority critical requires assignee
    if (data.priority === 'critical' && !data.assignee_id) {
      errors.push({
        field: 'assignee_id',
        code: 'CRITICAL_NEEDS_ASSIGNEE',
        message: 'Critical priority items must have an assignee',
        value: data.assignee_id
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Main validation pipeline orchestrator
 */
export class FieldValidationPipeline {
  private validators: IFieldValidator[] = [];

  constructor(validators?: IFieldValidator[]) {
    this.validators = validators || this.getDefaultValidators();
    // Sort validators by order
    this.validators.sort((a, b) => a.order - b.order);
  }

  private getDefaultValidators(): IFieldValidator[] {
    return [
      new TypeValidator(),
      new RequiredFieldValidator(),
      new ConstraintValidator(),
      new ReferenceValidator(),
      new BusinessRuleValidator()
    ];
  }

  /**
   * Run validation pipeline
   */
  async validate(context: ValidationContext): Promise<ValidationResult> {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationError[] = [];
    let transformedData = { ...context.data };

    for (const validator of this.validators) {
      const result = await validator.validate({
        ...context,
        data: transformedData
      });

      if (!result.valid) {
        allErrors.push(...result.errors);
      }

      if (result.warnings) {
        allWarnings.push(...result.warnings);
      }

      if (result.transformedData) {
        transformedData = result.transformedData;
      }

      // Stop on critical errors (from first 2 validators)
      if (!result.valid && validator.order <= 2) {
        break;
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
      transformedData: allErrors.length === 0 ? transformedData : undefined
    };
  }

  /**
   * Add custom validator
   */
  addValidator(validator: IFieldValidator): void {
    this.validators.push(validator);
    this.validators.sort((a, b) => a.order - b.order);
  }

  /**
   * Remove validator by name
   */
  removeValidator(name: string): void {
    this.validators = this.validators.filter(v => v.name !== name);
  }
}

// Export singleton instance
export const fieldValidationPipeline = new FieldValidationPipeline();