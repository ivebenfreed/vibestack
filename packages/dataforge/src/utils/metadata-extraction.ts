import 'reflect-metadata';
import { ENUM_TYPE_NAME_METADATA_KEY, ENUM_SOURCE_PATH_METADATA_KEY } from './decorators.js';

// Field category classification
export type FieldCategory = 
  | 'typeorm-managed-primary'     // id - managed by TypeORM
  | 'typeorm-managed-timestamp'   // createdAt, updatedAt - managed by TypeORM
  | 'system-managed'             // clientId - managed by sync system
  | 'relationship-foreign-key'   // projectId, assigneeId - user editable FKs
  | 'relationship-entity'        // project, assignee - populated entities
  | 'user-editable';            // title, description - user provided data

export interface FieldMetadata {
  name: string;
  type: string;
  nullable: boolean;
  default?: any;
  enum?: any;
  enumTypeName?: string;
  validation: ValidationRule[];
  businessLogic: BusinessRule[];
  category: FieldCategory;
  dbName?: string;
  isArray?: boolean;
}

export interface ValidationRule {
  type: 'minLength' | 'maxLength' | 'email' | 'uuid' | 'enum' | 'required' | 'date' | 'custom';
  value?: any;
  message?: string;
}

export interface BusinessRule {
  type: 'statusTransitions' | 'permissions' | 'auditLog' | 'foreignKey' | 'cascade';
  config?: any;
}

export interface EntityMetadata {
  name: string;
  tableName: string;
  fields: FieldMetadata[];
  relationships: RelationshipMetadata[];
}

export interface RelationshipMetadata {
  name: string;
  type: 'many-to-one' | 'one-to-many' | 'many-to-many';
  targetEntity: string;
  foreignKey?: string;
  joinTable?: string;
  nullable: boolean;
}

/**
 * Classify a field based on its name and column definition
 */
export function classifyField(fieldName: string, columnDef: any): FieldCategory {
  // TypeORM-managed primary key
  if (fieldName === 'id') {
    return 'typeorm-managed-primary';
  }
  
  // TypeORM-managed timestamps
  if (['createdAt', 'updatedAt'].includes(fieldName)) {
    return 'typeorm-managed-timestamp';
  }
  
  // System-managed fields
  if (['clientId'].includes(fieldName)) {
    return 'system-managed';
  }
  
  // Relationship foreign keys (user can set these)
  if (fieldName.endsWith('Id') && columnDef.type === 'uuid') {
    return 'relationship-foreign-key';
  }
  
  // Relationship entities (populated by TypeORM)
  if (columnDef.relation || columnDef.type === 'relation') {
    return 'relationship-entity';
  }
  
  // Everything else is user-editable
  return 'user-editable';
}

/**
 * Check if a field should be included in user input types
 */
export function isUserEditableField(category: FieldCategory): boolean {
  return category === 'user-editable' || category === 'relationship-foreign-key';
}

/**
 * Check if a field is managed by TypeORM and shouldn't be set manually
 */
export function isTypeORMManagedField(category: FieldCategory): boolean {
  return category === 'typeorm-managed-primary' || category === 'typeorm-managed-timestamp';
}

/**
 * Extract enum metadata from entity field
 */
export function extractEnumMetadata(entity: Function, fieldName: string, columnDef: any): { typeName?: string; values?: any; sourcePath?: string } {
  // Try to get enum type name from @EnumTypeName decorator
  const enumTypeName = Reflect.getMetadata(ENUM_TYPE_NAME_METADATA_KEY, entity.prototype, fieldName);
  const sourcePath = Reflect.getMetadata(ENUM_SOURCE_PATH_METADATA_KEY, entity.prototype, fieldName);
  
  if (enumTypeName && columnDef.enum) {
    return {
      typeName: enumTypeName,
      values: columnDef.enum,
      sourcePath
    };
  }
  
  // Fallback to naming conventions if no decorator
  if (columnDef.enum) {
    const entityName = entity.name;
    let fallbackName = null;
    
    if (fieldName === 'status') {
      fallbackName = `${entityName}Status`;
    } else if (fieldName === 'priority') {
      fallbackName = `${entityName}Priority`;
    } else if (fieldName === 'role') {
      fallbackName = 'UserRole';
    }
    
    if (fallbackName) {
      return {
        typeName: fallbackName,
        values: columnDef.enum
      };
    }
  }
  
  return {};
}

/**
 * Extract validation rules from class-validator decorators
 */
export function extractValidationRules(entity: Function, fieldName: string, columnDef: any): ValidationRule[] {
  const rules: ValidationRule[] = [];
  
  // Check if field is required (not nullable and no default)
  if (!columnDef.nullable && columnDef.default === undefined) {
    rules.push({
      type: 'required',
      message: `${fieldName} is required`
    });
  }
  
  // Length constraints for string fields
  if (columnDef.length && ['varchar', 'text'].includes(columnDef.type)) {
    rules.push({
      type: 'maxLength',
      value: columnDef.length,
      message: `${fieldName} cannot exceed ${columnDef.length} characters`
    });
  }
  
  // Email validation for email fields
  if (fieldName.toLowerCase().includes('email')) {
    rules.push({
      type: 'email',
      message: `${fieldName} must be a valid email address`
    });
  }
  
  // UUID validation for UUID fields
  if (columnDef.type === 'uuid') {
    rules.push({
      type: 'uuid',
      message: `${fieldName} must be a valid UUID`
    });
  }
  
  // Enum validation
  if (columnDef.enum) {
    rules.push({
      type: 'enum',
      value: columnDef.enum,
      message: `${fieldName} must be one of: ${Object.values(columnDef.enum).join(', ')}`
    });
  }
  
  // Date validation
  if (['date', 'timestamp', 'timestamptz'].includes(columnDef.type)) {
    rules.push({
      type: 'date',
      message: `${fieldName} must be a valid date`
    });
  }
  
  return rules;
}

/**
 * Extract business logic rules for a field
 */
export function extractBusinessLogic(entityName: string, fieldName: string, columnDef: any): BusinessRule[] {
  const rules: BusinessRule[] = [];
  
  // Status field business logic
  if (fieldName === 'status') {
    rules.push({
      type: 'auditLog',
      config: { reason: 'Status changes require audit trail' }
    });
    
    rules.push({
      type: 'statusTransitions',
      config: getStatusTransitions(entityName)
    });
    
    rules.push({
      type: 'permissions',
      config: [`${entityName.toLowerCase()}:update:status`]
    });
  }
  
  // Priority field business logic
  if (fieldName === 'priority') {
    rules.push({
      type: 'permissions',
      config: [`${entityName.toLowerCase()}:update:priority`]
    });
    
    rules.push({
      type: 'auditLog',
      config: { reason: 'Priority changes require audit trail' }
    });
  }
  
  // Foreign key relationships
  if (fieldName.endsWith('Id') && columnDef.type === 'uuid') {
    const targetEntity = fieldName.replace('Id', '');
    rules.push({
      type: 'foreignKey',
      config: {
        targetEntity: targetEntity.charAt(0).toUpperCase() + targetEntity.slice(1),
        required: !columnDef.nullable
      }
    });
  }
  
  return rules;
}

/**
 * Get status transition rules for different entities
 */
function getStatusTransitions(entityName: string): Record<string, string[]> {
  switch (entityName) {
    case 'Task':
      return {
        'open': ['in_progress', 'completed'],
        'in_progress': ['open', 'completed'],
        'completed': ['open']
      };
    
    case 'Project':
      return {
        'active': ['in_progress', 'on_hold', 'completed'],
        'in_progress': ['active', 'on_hold', 'completed'],
        'on_hold': ['active', 'in_progress'],
        'completed': ['active']
      };
    
    default:
      return {};
  }
}

/**
 * Generate TypeScript type string from column definition
 */
export function generateTypeScriptType(columnDef: any, enumTypeName?: string): string {
  if (enumTypeName) {
    return enumTypeName;
  }
  
  if (columnDef.type === 'boolean') {
    return 'boolean';
  }
  
  if (['int', 'integer', 'bigint', 'number', 'decimal', 'float'].includes(columnDef.type)) {
    return 'number';
  }
  
  if (['date', 'timestamp', 'timestamptz'].includes(columnDef.type)) {
    return 'Date';
  }
  
  if (columnDef.type === 'uuid') {
    return 'string';
  }
  
  if (['json', 'jsonb'].includes(columnDef.type)) {
    return 'any';
  }
  
  if (columnDef.array) {
    const baseType = generateTypeScriptType({ ...columnDef, array: false }, enumTypeName);
    return `${baseType}[]`;
  }
  
  // Default to string for text/varchar
  return 'string';
}

/**
 * Extract entity metadata from client schema
 */
export function extractEntityMetadata(entityName: string, entitySchema: any, entityClass: Function): EntityMetadata {
  const fields: FieldMetadata[] = [];
  const relationships: RelationshipMetadata[] = [];
  
  // Extract column metadata
  if (entitySchema.columns) {
    for (const [fieldName, columnDef] of Object.entries(entitySchema.columns)) {
      const category = classifyField(fieldName, columnDef);
      const enumMeta = extractEnumMetadata(entityClass, fieldName, columnDef);
      const validation = extractValidationRules(entityClass, fieldName, columnDef);
      const businessLogic = extractBusinessLogic(entityName, fieldName, columnDef);
      
      fields.push({
        name: fieldName,
        type: generateTypeScriptType(columnDef as any, enumMeta.typeName),
        nullable: (columnDef as any).nullable ?? false,
        default: (columnDef as any).default,
        enum: enumMeta.values,
        enumTypeName: enumMeta.typeName,
        validation,
        businessLogic,
        category,
        dbName: (columnDef as any).name || fieldName,
        isArray: (columnDef as any).array ?? false
      });
    }
  }
  
  // Extract relationship metadata
  if (entitySchema.relations) {
    for (const [relationName, relationDef] of Object.entries(entitySchema.relations)) {
      const relationInfo = relationDef as any;
      
      relationships.push({
        name: relationName,
        type: relationInfo.type,
        targetEntity: relationInfo.target,
        foreignKey: relationInfo.joinColumn?.name,
        joinTable: relationInfo.joinTable?.name,
        nullable: relationInfo.nullable ?? true
      });
      
      // Also add relationship entities to fields array for CRUD operations
      const isArray = relationInfo.type === 'one-to-many' || relationInfo.type === 'many-to-many';
      const targetEntityName = typeof relationInfo.target === 'function' ? relationInfo.target.name : relationInfo.target;
      const fieldType = isArray ? `${targetEntityName}[]` : targetEntityName;
      
      // Create business logic for relationship
      const relationshipBusinessLogic: BusinessRule[] = [{
        type: 'foreignKey',
        config: {
          relationshipType: relationInfo.type,
          targetEntity: targetEntityName,
          required: !relationInfo.nullable
        }
      }];
      
      fields.push({
        name: relationName,
        type: fieldType,
        nullable: relationInfo.nullable ?? true,
        validation: [],
        businessLogic: relationshipBusinessLogic,
        category: 'relationship-entity',
        isArray
      });
    }
  }
  
  return {
    name: entityName,
    tableName: entitySchema.tableName || entityName.toLowerCase(),
    fields,
    relationships
  };
}