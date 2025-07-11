import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

// Import the generated client entities
import * as ClientEntities from '../generated/client-entities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

/**
 * Main function to generate VibeGridX column configurations
 */
async function generateVibeGridXColumnFile() {
    // Get entity classes from ClientEntities
    const entityClasses: Function[] = [];
    
    for (const [key, value] of Object.entries(ClientEntities)) {
        if (typeof value === 'function' && value.prototype) {
            const excludedFunctions = ['getEntityRelationships', 'hasRelationshipConfig', 'getJunctionRelationships'];
            if (!excludedFunctions.includes(key) && value.name && value.name[0] === value.name[0].toUpperCase()) {
                entityClasses.push(value as Function);
            }
        }
    }
    
    console.log('Generating VibeGridX column configurations for entities:', entityClasses.map(e => e.name));
    
    // Ensure generated directory exists
    const generatedDir = path.join(PACKAGE_ROOT, 'src/generated');
    await fs.mkdir(generatedDir, { recursive: true });
    
    // Generate column configurations
    const columnConfigOutput = generateVibeGridXColumns(entityClasses);
    const columnConfigPath = path.join(generatedDir, 'vibegridx-columns.ts');
    await fs.writeFile(columnConfigPath, columnConfigOutput);
    console.log('Generated VibeGridX column configurations at:', columnConfigPath);
}

/**
 * Generate VibeGridX column configurations from client entities
 */
function generateVibeGridXColumns(entityClasses: Function[]): string {
    const storage = getMetadataArgsStorage();
    
    // Generate dynamic imports
    const entityImports = entityClasses.map(entityClass => entityClass.name).sort().join(',\n  ');
    
    let output = `// Generated VibeGridX column definitions - DO NOT EDIT
// Generated from client entities and TypeORM metadata

// We'll define our own extended Column type for generation
// since the actual VibeGridX Column has a different structure
import type {
  ${entityImports},
} from './client-entities.js';

// ============================================================================
// VIBEGRIDX COLUMN TYPES
// ============================================================================

// Define our extended Column interface for generation
export interface VibeGridXColumn<T = any> {
  id: string;
  name: string;
  field: keyof T & string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'select';
  width: number;
  editable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  options?: string[] | any[]; // for select/enum type
  
  // Relationship fields
  cellType?: 'relationship-single' | 'relationship-multi' | 'relationship-collection' | string;
  relationshipTable?: string;
  relationshipDisplayField?: string;
  
  // Display formatting
  displayFormat?: string;
  align?: 'left' | 'center' | 'right';
  placeholder?: string;
  
  // Validation
  required?: boolean;
  validate?: (value: any) => string | null;
  
  // Number/Date/Text specific options
  precision?: number;
  min?: number;
  max?: number;
  dateFormat?: string;
  maxLength?: number;
  
  // Enum options
  enumOptions?: any[];
  
  // Extended metadata
  meta?: {
    systemField?: boolean;
    businessLogic?: {
      allowedTransitions?: Record<string, string[]>;
      requiresPermission?: string;
      auditLog?: boolean;
      relationship?: boolean;
      requiresValidReference?: boolean;
      targetEntity?: string;
      sensitive?: boolean;
      maskInLogs?: boolean;
      restrictedValues?: string[];
    };
    validation?: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
      pattern?: string;
      custom?: (value: any) => string | null;
    };
    relationshipConfig?: {
      relationshipType?: 'many-to-one' | 'one-to-one' | 'many-to-many' | 'one-to-many';
      searchFields?: string[];
      allowCreate?: boolean;
      searchable?: boolean;
    };
  };
}

export type VibeGridXColumns<T> = VibeGridXColumn<T>[];

// Cell types for utility functions
export type CellType = 
  | 'text' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'enum' 
  | 'uuid' 
  | 'json' 
  | 'relationship-single' 
  | 'relationship-multi' 
  | 'relationship-collection';

// ============================================================================
// AUTO-GENERATED ENUM OPTIONS
// ============================================================================

`;

    // Generate enum options
    output += generateEnumOptions();

    output += `
// ============================================================================
// AUTO-GENERATED VIBEGRIDX COLUMN DEFINITIONS
// ============================================================================

`;

    // Generate column definitions for each entity
    for (const entity of entityClasses) {
        output += generateEntityVibeGridXColumns(entity, entityClasses, storage);
    }

    // Add utility functions
    output += generateUtilityFunctions(entityClasses);

    return output;
}

/**
 * Generate enum options
 */
function generateEnumOptions(): string {
    let output = '';
    
    // Extract enums from ClientEntities
    const enumExports: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(ClientEntities)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value.constructor === 'function') {
            const enumValues = Object.values(value);
            if (enumValues.length > 0 && enumValues.every(v => typeof v === 'string')) {
                enumExports[key] = value;
            }
        }
    }

    // Generate enum options
    for (const [enumName, enumObj] of Object.entries(enumExports)) {
        output += `export const ${enumName}Options: Record<string, string> = {\n`;
        for (const [key, value] of Object.entries(enumObj)) {
            const label = key.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            output += `  '${value}': '${label}',\n`;
        }
        output += `} as const;\n\n`;
    }

    return output;
}

/**
 * Generate VibeGridX columns for a single entity
 */
function generateEntityVibeGridXColumns(entity: Function, allEntities: Function[], storage: any): string {
    const entityName = entity.name;
    
    // Find the entity schema
    const entitySchema = findSchemaForEntity(entityName);
    if (!entitySchema) {
        console.warn(`No schema found for entity ${entityName}`);
        return `// No columns generated for ${entityName} - schema not found\n\n`;
    }
    
    const columns = entitySchema.options.columns || {};
    const relations = entitySchema.options.relations || {};
    
    let output = `// VibeGridX columns for ${entityName}\n`;
    output += `export const ${entityName}Columns: VibeGridXColumns<${entityName}> = [\n`;
    
    // Generate column definitions
    for (const [propertyName, columnDef] of Object.entries(columns)) {
        const config = generateColumnConfigFromSchema(entity, propertyName, columnDef as any);
        
        output += `  {\n`;
        output += `    id: '${propertyName}',\n`;
        output += `    name: '${formatFieldLabel(propertyName)}',\n`;
        output += `    field: '${propertyName}' as keyof ${entityName},\n`;
        output += `    type: '${mapToVibeGridXType(config.cellType)}',\n`;
        output += `    width: ${getColumnWidth(config.cellType, config.validation?.maxLength)},\n`;
        output += `    minWidth: ${getMinColumnWidth(config.cellType)},\n`;
        output += `    maxWidth: ${getMaxColumnWidth(config.cellType)},\n`;
        output += `    editable: ${config.editable},\n`;
        output += `    sortable: ${!config.systemField},\n`;
        output += `    filterable: true,\n`;
        output += `    resizable: true,\n`;
        
        // Add cellType for special types
        if (config.cellType === 'uuid' || config.cellType === 'json' || config.cellType.startsWith('relationship')) {
            output += `    cellType: '${config.cellType}',\n`;
        }
        
        if (config.enumType) {
            output += `    options: Object.entries(${config.enumType}Options).map(([value, label]) => ({ value, label })),\n`;
        }
        
        if (config.validation?.maxLength) {
            output += `    maxLength: ${config.validation.maxLength},\n`;
        }
        
        if (config.cellType === 'date') {
            output += `    dateFormat: '${config.dbType.includes('timestamp') ? 'MMM dd, yyyy HH:mm' : 'MMM dd, yyyy'}',\n`;
        }
        
        if (config.nullable || config.systemField) {
            output += `    placeholder: '${getPlaceholder(propertyName, config.cellType)}',\n`;
        }
        
        if (config.validation?.required) {
            output += `    required: true,\n`;
        }
        
        // Add metadata
        if (config.systemField || config.businessLogic || config.validation) {
            output += `    meta: {\n`;
            if (config.systemField) {
                output += `      systemField: true,\n`;
            }
            if (config.businessLogic && Object.keys(config.businessLogic).length > 0) {
                output += `      businessLogic: ${JSON.stringify(config.businessLogic, null, 8).split('\n').join('\n      ')},\n`;
            }
            if (config.validation && Object.keys(config.validation).length > 0) {
                output += `      validation: ${JSON.stringify(config.validation, null, 8).split('\n').join('\n      ')},\n`;
            }
            output += `    },\n`;
        }
        
        output += `  },\n`;
    }
    
    // Generate relationship columns
    for (const [propertyName, relationDef] of Object.entries(relations)) {
        const relation = relationDef as any;
        const relConfig = generateRelationshipConfig(entity, propertyName, relation, allEntities);
        
        if (relConfig) {
            const cellType = getCellTypeForRelation(relation.type);
            
            output += `  {\n`;
            output += `    id: '${propertyName}',\n`;
            output += `    name: '${formatFieldLabel(propertyName)}',\n`;
            
            // For many-to-one, use the foreign key field
            if (relation.type === 'many-to-one' || relation.type === 'one-to-one') {
                output += `    field: '${propertyName}Id' as keyof ${entityName},\n`;
            } else {
                output += `    field: '${propertyName}' as keyof ${entityName},\n`;
            }
            
            output += `    type: 'select',\n`;
            output += `    width: ${getColumnWidth(cellType)},\n`;
            output += `    minWidth: ${getMinColumnWidth(cellType)},\n`;
            output += `    maxWidth: ${getMaxColumnWidth(cellType)},\n`;
            output += `    editable: ${relConfig.editable},\n`;
            output += `    sortable: ${relation.type === 'many-to-one' || relation.type === 'one-to-one'},\n`;
            output += `    filterable: true,\n`;
            output += `    resizable: true,\n`;
            output += `    cellType: '${cellType}',\n`;
            output += `    relationshipTable: '${propertyName}',\n`;
            output += `    relationshipDisplayField: '${relConfig.displayField || 'name'}',\n`;
            
            // Add relationship metadata
            output += `    meta: {\n`;
            output += `      relationshipConfig: {\n`;
            output += `        relationshipType: '${relation.type}',\n`;
            output += `        searchFields: ${JSON.stringify(relConfig.searchFields || ['name'])},\n`;
            output += `        allowCreate: ${relConfig.allowCreate || false},\n`;
            output += `        searchable: true,\n`;
            output += `      },\n`;
            if (relConfig.businessLogic) {
                output += `      businessLogic: ${JSON.stringify(relConfig.businessLogic, null, 8).split('\n').join('\n      ')},\n`;
            }
            output += `    },\n`;
            output += `  },\n`;
        }
    }
    
    output += `];\n\n`;
    
    return output;
}

/**
 * Find schema for entity
 */
function findSchemaForEntity(entityName: string): any {
    for (const [key, value] of Object.entries(ClientEntities)) {
        if (key === `${entityName}Schema` && value && typeof value === 'object' && 'options' in value) {
            return value;
        }
    }
    return null;
}

/**
 * Generate column config from schema
 */
function generateColumnConfigFromSchema(entity: Function, propertyName: string, columnDef: any): any {
    const dbType = columnDef.type || 'text';
    const nullable = columnDef.nullable === true;
    const isSystem = isSystemField(propertyName);
    
    // Determine cell type
    let cellType = 'text';
    let enumType = null;
    
    if (columnDef.enum) {
        cellType = 'enum';
        // Determine enum type name
        if (propertyName === 'status') {
            if (entity.name === 'Task') enumType = 'TaskStatus';
            else if (entity.name === 'Project') enumType = 'ProjectStatus';
        } else if (propertyName === 'priority') {
            enumType = 'TaskPriority';
        } else if (propertyName === 'role') {
            enumType = 'UserRole';
        }
    } else if (['int', 'integer', 'bigint', 'number', 'decimal', 'float'].includes(dbType)) {
        cellType = 'number';
    } else if (dbType === 'boolean') {
        cellType = 'boolean';
    } else if (['date', 'timestamp', 'timestamptz'].includes(dbType)) {
        cellType = 'date';
    } else if (dbType === 'uuid') {
        cellType = 'uuid';
    } else if (['json', 'jsonb'].includes(dbType)) {
        cellType = 'json';
    }
    
    // Generate validation
    const validation: any = {};
    if (columnDef.length) {
        validation.maxLength = columnDef.length;
    }
    if (!nullable && !isSystem) {
        validation.required = true;
    }
    if (propertyName === 'email') {
        validation.pattern = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
    }
    if (propertyName.includes('url') || propertyName.includes('Url')) {
        validation.pattern = '^https?://.*';
    }
    
    // Generate business logic
    const businessLogic: any = {};
    if (propertyName === 'status') {
        businessLogic.auditLog = true;
        if (entity.name === 'Task') {
            businessLogic.allowedTransitions = {
                'open': ['in_progress', 'completed'],
                'in_progress': ['open', 'completed'],
                'completed': ['open', 'in_progress']
            };
            businessLogic.requiresPermission = 'task:update:status';
        } else if (entity.name === 'Project') {
            businessLogic.allowedTransitions = {
                'active': ['in_progress', 'on_hold', 'completed'],
                'in_progress': ['active', 'on_hold', 'completed'],
                'on_hold': ['active', 'in_progress'],
                'completed': ['active']
            };
            businessLogic.requiresPermission = 'project:update:status';
        }
    }
    
    if (propertyName === 'priority' && entity.name === 'Task') {
        businessLogic.requiresPermission = 'task:update:priority';
        businessLogic.auditLog = true;
    }
    
    if (propertyName === 'role' && entity.name === 'User') {
        businessLogic.requiresPermission = 'user:update:role';
        businessLogic.auditLog = true;
        businessLogic.restrictedValues = ['super_admin'];
    }
    
    if (propertyName.endsWith('Id') && !isSystem) {
        businessLogic.relationship = true;
        businessLogic.requiresValidReference = true;
        const relationName = propertyName.replace(/Id$/, '');
        businessLogic.targetEntity = relationName.charAt(0).toUpperCase() + relationName.slice(1);
    }
    
    if (propertyName === 'email' || propertyName === 'password') {
        businessLogic.sensitive = true;
        businessLogic.maskInLogs = true;
    }
    
    return {
        dbType: dbType.toString(),
        cellType,
        editable: !isSystem,
        nullable,
        systemField: isSystem,
        enumType,
        validation: Object.keys(validation).length > 0 ? validation : undefined,
        businessLogic: Object.keys(businessLogic).length > 0 ? businessLogic : undefined
    };
}

/**
 * Generate relationship config
 */
function generateRelationshipConfig(entity: Function, propertyName: string, relationDef: any, allEntities: Function[]): any {
    const targetEntityName = relationDef.target;
    const isEditable = relationDef.type === 'many-to-one' || relationDef.type === 'one-to-one';
    const nullable = relationDef.nullable !== false;
    
    const businessLogic = {
        auditLog: true,
        relationship: true,
        requiresValidReference: true,
        targetEntity: targetEntityName,
        requiresPermission: `${entity.name.toLowerCase()}:update:${propertyName}`
    };
    
    const searchFields = getSearchFields(targetEntityName);
    const allowCreate = relationDef.type === 'many-to-one' || relationDef.type === 'one-to-one';
    
    return {
        targetEntity: targetEntityName,
        editable: isEditable,
        nullable,
        displayField: getDisplayField(targetEntityName),
        searchFields,
        allowCreate,
        businessLogic
    };
}

/**
 * Utility functions
 */
function isSystemField(propertyName: string): boolean {
    return ['id', 'clientId', 'createdAt', 'updatedAt'].includes(propertyName);
}

function mapToVibeGridXType(cellType: string): string {
    switch (cellType) {
        case 'text':
        case 'uuid':
        case 'json':
            return 'text';
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'date':
            return 'date';
        case 'enum':
            return 'enum';
        default:
            return 'text';
    }
}

function shouldIncludeRelationship(relationType: string): boolean {
    // Include all relationships
    return true;
}

function getCellTypeForRelation(relationType: string): string {
    switch (relationType) {
        case 'many-to-one':
        case 'one-to-one':
            return 'relationship-single';
        case 'many-to-many':
            return 'relationship-multi';
        case 'one-to-many':
            return 'relationship-collection';
        default:
            return 'relationship-single';
    }
}

function getDisplayField(entityName: string): string {
    // Simple heuristic for display field
    if (entityName === 'User') return 'name';
    if (entityName === 'Project') return 'name';
    if (entityName === 'Task') return 'title';
    return 'name';
}

function getSearchFields(entityName: string): string[] {
    // Simple heuristic for search fields
    if (entityName === 'User') {
        return ['name', 'email'];
    } else if (entityName === 'Project' || entityName === 'Task') {
        return ['name', 'description'];
    }
    return ['name'];
}

function formatFieldLabel(propertyName: string): string {
    return propertyName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/Id$/, '')
        .replace(/_/g, ' ')
        .trim();
}

function getColumnWidth(cellType: string, maxLength?: number): number {
    switch (cellType) {
        case 'uuid':
            return 120;
        case 'date':
            return 150;
        case 'number':
            return 100;
        case 'boolean':
            return 80;
        case 'enum':
            return 120;
        case 'text':
            if (maxLength) {
                if (maxLength <= 50) return 150;
                if (maxLength <= 100) return 200;
                return 250;
            }
            return 200;
        case 'relationship-single':
            return 180;
        case 'relationship-multi':
            return 220;
        case 'relationship-collection':
            return 200;
        case 'json':
            return 220;
        default:
            return 150;
    }
}

function getMinColumnWidth(cellType: string): number {
    switch (cellType) {
        case 'uuid':
            return 100;
        case 'date':
            return 120;
        case 'number':
            return 80;
        case 'boolean':
            return 70;
        case 'enum':
            return 100;
        case 'text':
            return 120;
        case 'relationship-single':
            return 140;
        case 'relationship-multi':
            return 160;
        case 'relationship-collection':
            return 160;
        case 'json':
            return 140;
        default:
            return 100;
    }
}

function getMaxColumnWidth(cellType: string): number {
    switch (cellType) {
        case 'uuid':
            return 150;
        case 'date':
            return 200;
        case 'number':
            return 150;
        case 'boolean':
            return 100;
        case 'enum':
            return 200;
        case 'text':
            return 600;
        case 'relationship-single':
            return 400;
        case 'relationship-multi':
            return 400;
        case 'relationship-collection':
            return 500;
        case 'json':
            return 500;
        default:
            return 400;
    }
}

function getPlaceholder(propertyName: string, cellType: string): string {
    if (cellType === 'date') return 'Select date...';
    if (cellType === 'number') return '0';
    if (cellType === 'enum') return 'Select...';
    if (cellType === 'relationship-single' || cellType === 'relationship-multi') return 'Select...';
    return `Enter ${formatFieldLabel(propertyName).toLowerCase()}...`;
}

/**
 * Generate utility functions
 */
function generateUtilityFunctions(entityClasses: Function[]): string {
    return `
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Get columns for a specific entity
export function getColumnsForEntity<T>(entityName: string): VibeGridXColumns<T> | undefined {
  switch (entityName) {
${entityClasses.map(e => `    case '${e.name}':\n      return ${e.name}Columns as VibeGridXColumns<T>;`).join('\n')}
    default:
      return undefined;
  }
}

// Filter columns by type
export function filterColumnsByType<T>(columns: VibeGridXColumns<T>, cellType: CellType): VibeGridXColumns<T> {
  return columns.filter(col => col.cellType === cellType);
}

// Get editable columns
export function getEditableColumns<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.editable === true);
}

// Get sortable columns
export function getSortableColumns<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.sortable === true);
}

// Get system fields
export function getSystemFields<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.meta?.systemField === true);
}

// Get relationship columns
export function getRelationshipColumns<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.cellType?.startsWith('relationship'));
}

// Get many-to-many columns
export function getManyToManyColumns<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.meta?.relationshipConfig?.relationshipType === 'many-to-many');
}

// Get many-to-one columns
export function getManyToOneColumns<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.meta?.relationshipConfig?.relationshipType === 'many-to-one');
}

// Get one-to-many columns
export function getOneToManyColumns<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.meta?.relationshipConfig?.relationshipType === 'one-to-many');
}

// Get columns with business logic
export function getColumnsWithBusinessLogic<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.meta?.businessLogic && Object.keys(col.meta.businessLogic).length > 0);
}

// Get columns requiring permission
export function getColumnsRequiringPermission<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.meta?.businessLogic?.requiresPermission);
}

// Get columns with validation
export function getColumnsWithValidation<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.meta?.validation && Object.keys(col.meta.validation).length > 0);
}

// Get required columns
export function getRequiredColumns<T>(columns: VibeGridXColumns<T>): VibeGridXColumns<T> {
  return columns.filter(col => col.meta?.validation?.required === true);
}

// Validate column value
export function validateColumnValue<T>(column: VibeGridXColumn<T>, value: any): string | null {
  const validation = column.meta?.validation;
  if (!validation) return null;
  
  if (validation.required && (value === null || value === undefined || value === '')) {
    return \`\${column.name} is required\`;
  }
  
  if (validation.maxLength && typeof value === 'string' && value.length > validation.maxLength) {
    return \`\${column.name} must be at most \${validation.maxLength} characters\`;
  }
  
  if (validation.minLength && typeof value === 'string' && value.length < validation.minLength) {
    return \`\${column.name} must be at least \${validation.minLength} characters\`;
  }
  
  if (validation.min && typeof value === 'number' && value < validation.min) {
    return \`\${column.name} must be at least \${validation.min}\`;
  }
  
  if (validation.max && typeof value === 'number' && value > validation.max) {
    return \`\${column.name} must be at most \${validation.max}\`;
  }
  
  if (validation.pattern && typeof value === 'string') {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(value)) {
      return \`\${column.name} has invalid format\`;
    }
  }
  
  if (validation.custom) {
    return validation.custom(value);
  }
  
  return null;
}

// Check if state transition is allowed
export function isTransitionAllowed<T>(column: VibeGridXColumn<T>, currentValue: string, newValue: string): boolean {
  const transitions = column.meta?.businessLogic?.allowedTransitions;
  if (!transitions) return true;
  
  const allowedValues = transitions[currentValue];
  return allowedValues ? allowedValues.includes(newValue) : false;
}

// Check if user has permission for column
export function hasPermissionForColumn<T>(column: VibeGridXColumn<T>, userPermissions: string[]): boolean {
  const requiredPermission = column.meta?.businessLogic?.requiresPermission;
  if (!requiredPermission) return true;
  
  return userPermissions.includes(requiredPermission);
}

// Type-safe relationship data lookup tables
export type RelationshipTables = {
  project: Record<string, any>;
  assignee: Record<string, any>;
  owner: Record<string, any>;
  members: Record<string, any>;
  author: Record<string, any>;
  parent: Record<string, any>;
  task: Record<string, any>;
  dependencies: Record<string, any>;
};

// Export for type safety in components
export const relationshipTables: RelationshipTables = {
  project: {},
  assignee: {},
  owner: {},
  members: {},
  author: {},
  parent: {},
  task: {},
  dependencies: {}
};
`;
}

// Run the generator if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generateVibeGridXColumnFile().catch(console.error);
}