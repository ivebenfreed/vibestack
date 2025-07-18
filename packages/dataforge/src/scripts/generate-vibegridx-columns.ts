import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

// Import the generated client entities
import * as ClientEntities from '../generated/client-entities.js';

// Import configuration
import {
  VIBEGRIDX_GENERATOR_CONFIG,
  type VibeGridXGeneratorConfig,
  getColumnWidth as getConfigColumnWidth,
  getMinColumnWidth as getConfigMinColumnWidth,
  getMaxColumnWidth as getConfigMaxColumnWidth,
  getPlaceholder as getConfigPlaceholder,
  isSystemField as isConfigSystemField,
  isHideable as isConfigHideable,
  mapDbTypeToCellType,
} from '../config/vibegridx-generator-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

/**
 * Main function to generate VibeGridX column configurations
 */
async function generateVibeGridXColumnFile(config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG) {
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
    const columnConfigOutput = generateVibeGridXColumns(entityClasses, config);
    const columnConfigPath = path.join(generatedDir, 'vibegridx-columns.ts');
    await fs.writeFile(columnConfigPath, columnConfigOutput);
    console.log('Generated VibeGridX column configurations at:', columnConfigPath);
}

/**
 * Generate VibeGridX column configurations from client entities
 */
function generateVibeGridXColumns(entityClasses: Function[], config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG): string {
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

// EnumOption interface for type-safe enum options
export interface EnumOption {
  value: string | number;
  label: string;
  cssClass?: string;
  color?: string;
  backgroundColor?: string;
  icon?: string;
  description?: string;
  group?: string;
  disabled?: boolean;
}

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
  hideable?: boolean;
  options?: EnumOption[]; // for select/enum type
  
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

    // Generate enum options if enabled
    if (config.outputOptions.generateEnumOptions) {
        output += generateEnumOptions();
    }

    output += `
// ============================================================================
// AUTO-GENERATED VIBEGRIDX COLUMN DEFINITIONS
// ============================================================================

`;

    // Generate column definitions for each entity
    for (const entity of entityClasses) {
        output += generateEntityVibeGridXColumns(entity, entityClasses, storage, config);
    }

    // Add entity configurations
    output += generateEntityConfigurations(entityClasses);

    // Add utility functions if enabled
    if (config.outputOptions.includeUtilityFunctions) {
        output += generateUtilityFunctions(entityClasses);
    }

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
function generateEntityVibeGridXColumns(entity: Function, allEntities: Function[], storage: any, config: VibeGridXGeneratorConfig): string {
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
        const colConfig = generateColumnConfigFromSchema(entity, propertyName, columnDef as any, config);
        
        output += `  {\n`;
        output += `    id: '${propertyName}',\n`;
        output += `    name: '${formatFieldLabel(propertyName)}',\n`;
        output += `    field: '${propertyName}' as keyof ${entityName},\n`;
        output += `    type: '${mapToVibeGridXType(colConfig.cellType)}',\n`;
        output += `    width: ${getConfigColumnWidth(colConfig.cellType, config, colConfig.validation?.maxLength)},\n`;
        output += `    minWidth: ${getConfigMinColumnWidth(colConfig.cellType, config)},\n`;
        output += `    maxWidth: ${getConfigMaxColumnWidth(colConfig.cellType, config)},\n`;
        output += `    editable: ${colConfig.editable},\n`;
        output += `    sortable: ${config.processingRules.sortableByDefault},\n`;
        output += `    filterable: ${config.processingRules.filterableByDefault},\n`;
        output += `    resizable: ${config.processingRules.resizableByDefault},\n`;
        output += `    hideable: ${isConfigHideable(propertyName, config)},\n`;
        
        // Add cellType for special types
        if (colConfig.cellType === 'uuid' || colConfig.cellType === 'json' || colConfig.cellType.startsWith('relationship')) {
            output += `    cellType: '${colConfig.cellType}',\n`;
        }
        
        if (colConfig.enumType) {
            output += `    options: Object.entries(${colConfig.enumType}Options).map(([value, label]) => ({\n`;
            output += `      value,\n`;
            output += `      label,\n`;
            output += `      cssClass: 'vibegridx-enum-badge-' + value.toLowerCase().replace(/[^a-z0-9]/g, '-')\n`;
            output += `    })),\n`;
        }
        
        if (colConfig.validation?.maxLength) {
            output += `    maxLength: ${colConfig.validation.maxLength},\n`;
        }
        
        if (colConfig.cellType === 'date') {
            const dateFormat = colConfig.dbType.includes('timestamp') 
                ? config.formatting.dateFormats.timestamp 
                : config.formatting.dateFormats.date;
            output += `    dateFormat: '${dateFormat}',\n`;
        }
        
        if (colConfig.nullable || colConfig.systemField) {
            output += `    placeholder: '${getConfigPlaceholder(propertyName, colConfig.cellType, config)}',\n`;
        }
        
        if (colConfig.validation?.required) {
            output += `    required: true,\n`;
        }
        
        // Add metadata
        if (colConfig.systemField || colConfig.businessLogic || colConfig.validation) {
            output += `    meta: {\n`;
            if (colConfig.systemField) {
                output += `      systemField: true,\n`;
            }
            if (colConfig.businessLogic && Object.keys(colConfig.businessLogic).length > 0) {
                output += `      businessLogic: ${JSON.stringify(colConfig.businessLogic, null, 8).split('\n').join('\n      ')},\n`;
            }
            if (colConfig.validation && Object.keys(colConfig.validation).length > 0) {
                output += `      validation: ${JSON.stringify(colConfig.validation, null, 8).split('\n').join('\n      ')},\n`;
            }
            output += `    },\n`;
        }
        
        output += `  },\n`;
    }
    
    // Generate relationship columns
    for (const [propertyName, relationDef] of Object.entries(relations)) {
        const relation = relationDef as any;
        const relConfig = generateRelationshipConfig(entity, propertyName, relation, allEntities, config);
        
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
            output += `    width: ${getConfigColumnWidth(cellType, config)},\n`;
            output += `    minWidth: ${getConfigMinColumnWidth(cellType, config)},\n`;
            output += `    maxWidth: ${getConfigMaxColumnWidth(cellType, config)},\n`;
            output += `    editable: ${relConfig.editable},\n`;
            output += `    sortable: ${config.processingRules.sortableByDefault},\n`;
            output += `    filterable: ${config.processingRules.filterableByDefault},\n`;
            output += `    resizable: ${config.processingRules.resizableByDefault},\n`;
            output += `    hideable: ${isConfigHideable(propertyName, config)},\n`;
            // Get the target entity's table name from its schema
            const targetSchema = findSchemaForEntity(relation.target);
            const targetTableName = targetSchema?.options?.tableName || `${relation.target.toLowerCase()}s`;
            
            output += `    cellType: '${cellType}',\n`;
            output += `    relationshipTable: '${targetTableName}',\n`;
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
function generateColumnConfigFromSchema(entity: Function, propertyName: string, columnDef: any, config: VibeGridXGeneratorConfig): any {
    const dbType = columnDef.type || 'text';
    const nullable = columnDef.nullable === true;
    const isSystem = isConfigSystemField(propertyName, config);
    
    // Determine cell type using config
    let cellType = 'text';
    let enumType = null;
    
    if (columnDef.enum) {
        cellType = 'enum';
        // Determine enum type name from metadata
        if (propertyName === 'status') {
            if (entity.name === 'Task') enumType = 'TaskStatus';
            else if (entity.name === 'Project') enumType = 'ProjectStatus';
        } else if (propertyName === 'priority') {
            enumType = 'TaskPriority';
        } else if (propertyName === 'role') {
            enumType = 'UserRole';
        }
    } else {
        // Use config mapping for database type to cell type
        cellType = mapDbTypeToCellType(dbType, config);
        
        // Special case for uuid and json that might not be in the mapping
        if (dbType === 'uuid') cellType = 'uuid';
        else if (['json', 'jsonb'].includes(dbType)) cellType = 'json';
    }
    
    // Generate validation
    const validation: any = {};
    if (columnDef.length) {
        validation.maxLength = columnDef.length;
    }
    if (!nullable && !isSystem) {
        validation.required = true;
    }
    if (config.typeDetection.fieldNamePatterns.email.test(propertyName)) {
        validation.pattern = config.validationPatterns.email;
    }
    if (config.typeDetection.fieldNamePatterns.url.test(propertyName)) {
        validation.pattern = config.validationPatterns.url;
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
    
    if (config.typeDetection.fieldNamePatterns.email.test(propertyName) || config.typeDetection.fieldNamePatterns.password.test(propertyName)) {
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
function generateRelationshipConfig(entity: Function, propertyName: string, relationDef: any, allEntities: Function[], config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG): any {
    const targetEntityName = relationDef.target;
    const isEditable = config.processingRules.relationshipEditableTypes.includes(relationDef.type);
    const nullable = relationDef.nullable !== false;
    
    const businessLogic = {
        auditLog: true,
        relationship: true,
        requiresValidReference: true,
        targetEntity: targetEntityName,
        requiresPermission: `${entity.name.toLowerCase()}:update:${propertyName}`
    };
    
    const searchFields = getSearchFields(targetEntityName);
    const allowCreate = config.processingRules.relationshipAllowCreateTypes.includes(relationDef.type);
    
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

// isSystemField function removed - use isConfigSystemField from config instead

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

// getColumnWidth function removed - use getConfigColumnWidth from config instead

// getMinColumnWidth function removed - use getConfigMinColumnWidth from config instead

// getMaxColumnWidth function removed - use getConfigMaxColumnWidth from config instead

// getPlaceholder function removed - use getConfigPlaceholder from config instead

/**
 * Generate entity configurations
 */
function generateEntityConfigurations(entityClasses: Function[]): string {
    let output = `
// ============================================================================
// ENTITY CONFIGURATIONS
// ============================================================================

// Entity configuration interface
export interface VibeGridXEntityConfig<T = any> {
  entityType: string;
  columns: VibeGridXColumns<T>;
  atom: {
    path: string;
    name: string;
  };
  updateFn: {
    path: string;
    name: string;
  };
  relationshipAtoms: Record<string, {
    path: string;
    name: string;
    displayField: string;
  }>;
}

`;

    // Generate individual entity configurations
    for (const entity of entityClasses) {
        const entityName = entity.name;
        const entityNameLower = entityName.toLowerCase();
        
        // Find all relationship columns for this entity
        const schema = findSchemaForEntity(entityName);
        const relations = schema?.options.relations || {};
        const relationshipAtoms: Record<string, any> = {};
        
        // Build relationship atom mappings
        for (const [propertyName, relationDef] of Object.entries(relations)) {
            const relation = relationDef as any;
            if (relation.type === 'many-to-one' || relation.type === 'one-to-one') {
                const targetEntity = relation.target;
                const targetEntityLower = targetEntity.toLowerCase();
                
                // Map common relationship names to their atoms
                if (propertyName === 'project' || targetEntity === 'Project') {
                    relationshipAtoms[propertyName] = {
                        path: '@/domain/project',
                        name: 'projectsAtom',
                        displayField: 'name'
                    };
                } else if (propertyName === 'assignee' || propertyName === 'user' || targetEntity === 'User') {
                    relationshipAtoms[propertyName] = {
                        path: '@/domain/user',
                        name: 'usersAtom',
                        displayField: 'displayName'
                    };
                } else if (propertyName === 'task' || targetEntity === 'Task') {
                    relationshipAtoms[propertyName] = {
                        path: '@/domain/task',
                        name: 'tasksAtom',
                        displayField: 'title'
                    };
                } else if (propertyName === 'comment' || targetEntity === 'Comment') {
                    relationshipAtoms[propertyName] = {
                        path: '@/domain/comment',
                        name: 'commentsAtom',
                        displayField: 'content'
                    };
                }
            }
        }
        
        output += `// ${entityName} entity configuration
export const ${entityName}EntityConfig: VibeGridXEntityConfig<${entityName}> = {
  entityType: '${entityNameLower}',
  columns: ${entityName}Columns,
  atom: {
    path: '@/domain/${entityNameLower}',
    name: '${entityNameLower}sAtom'
  },
  updateFn: {
    path: '@/domain/${entityNameLower}',
    name: 'update${entityName}UI'
  },
  relationshipAtoms: ${JSON.stringify(relationshipAtoms, null, 2).split('\n').join('\n  ')}
};

`;
    }
    
    // Generate master configuration object
    output += `// Master entity configuration registry
export const VIBEGRIDX_ENTITY_CONFIGS = {
${entityClasses.map(e => `  ${e.name.toLowerCase()}: ${e.name}EntityConfig`).join(',\n')}
} as const;

// Type-safe entity type union
export type VibeGridXEntityType = keyof typeof VIBEGRIDX_ENTITY_CONFIGS;

// Get entity configuration by type
export function getEntityConfig<T = any>(entityType: VibeGridXEntityType): VibeGridXEntityConfig<T> | undefined {
  return VIBEGRIDX_ENTITY_CONFIGS[entityType] as VibeGridXEntityConfig<T>;
}

`;
    
    return output;
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