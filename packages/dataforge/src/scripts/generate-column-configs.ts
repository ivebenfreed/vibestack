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

interface MetadataFilter {
    context: 'client' | 'server';
}

/**
 * Main function to generate column configurations
 */
async function generateColumnConfigurationFile() {
    // Get entity schemas from the generated client entities
    const entitySchemas: any[] = [];
    const entityClasses: Function[] = [];
    
    // Extract entity schemas and classes from ClientEntities
    for (const [key, value] of Object.entries(ClientEntities)) {
        if (key.endsWith('Schema') && value && typeof value === 'object' && 'options' in value) {
            entitySchemas.push(value);
        } else if (typeof value === 'function' && value.prototype) {
            // Skip utility functions and only include entity classes
            const excludedFunctions = ['getEntityRelationships', 'hasRelationshipConfig', 'getJunctionRelationships'];
            if (!excludedFunctions.includes(key) && value.name && value.name[0] === value.name[0].toUpperCase()) {
                entityClasses.push(value as Function);
            }
        }
    }
    
    console.log('Found entity schemas:', entitySchemas.map(s => s.options?.name));
    console.log('Generating column configurations for entities:', entityClasses.map(e => e.name));
    
    // Use client context filter
    const filter: MetadataFilter = { context: 'client' };
    
    // Ensure generated directory exists
    const generatedDir = path.join(PACKAGE_ROOT, 'src/generated');
    await fs.mkdir(generatedDir, { recursive: true });
    
    // Generate column configurations using the entity schemas
    const columnConfigOutput = generateColumnConfigurations(entitySchemas, entityClasses, filter);
    const columnConfigPath = path.join(generatedDir, 'column-configurations.ts');
    await fs.writeFile(columnConfigPath, columnConfigOutput);
    console.log('Generated column configurations at:', columnConfigPath);
}

/**
 * Generate full column configurations from client entities
 */
function generateColumnConfigurations(entitySchemas: any[], entityClasses: Function[], filter: MetadataFilter): string {
    const storage = getMetadataArgsStorage();
    
    let output = `// Generated TanStack column definitions - DO NOT EDIT
// Generated from client entities and TypeORM metadata

import type { ColumnDef } from '@tanstack/react-table';
import type {
  ClientMigrationStatus,
  Comment,
  LocalChanges,
  Project,
  SyncMetadata,
  Task,
  User,
} from './client-entities.js';

// ============================================================================
// TANSTACK COLUMN DEFINITION TYPES
// ============================================================================

// Extend TanStack's ColumnMeta with our cell configuration
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    cellType: 'text' | 'number' | 'boolean' | 'date' | 'enum' | 'uuid' | 'json' | 'relationship' | 'relationship-single' | 'relationship-multi' | 'relationship-collection';
    config?: {
      editable?: boolean;
      placeholder?: string;
      enumValues?: Record<string, string>;
      format?: string;
      showTime?: boolean;
      dateMin?: string;
      dateMax?: string;
      relationshipType?: string;
      displayField?: string;
      searchFields?: string[];
      allowCreate?: boolean;
      options?: Array<{ value: string; label: string }>;
      searchable?: boolean;
      numberMin?: number;
      numberMax?: number;
      step?: number;
      maxLength?: number;
      inputType?: string;
      [key: string]: any;
    };
    onSave?: (value: any, entity: TData) => Promise<void>;
    onValidate?: (value: any) => string | null;
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
  }
}

export type EntityColumnDefinitions<T = any> = Record<keyof T, ColumnDef<T>>;

// Cell renderer function type
export type CellRenderer<T = any> = (props: { getValue: () => any; row: { original: T }; column: { columnDef: { meta?: any } } }) => React.ReactNode;

// ============================================================================
// AUTO-GENERATED ENUM OPTIONS
// ============================================================================

`;

    // Generate enum options
    output += generateEnumOptions(entityClasses);

    output += `
// ============================================================================
// AUTO-GENERATED TANSTACK COLUMN DEFINITIONS
// ============================================================================

`;

    // Generate TanStack column definitions for each entity
    for (const entity of entityClasses) {
        output += generateEntityColumnDefinitions(entity, entityClasses, storage);
    }

    // Add utility functions
    output += generateUtilityFunctions();

    return output;
}

/**
 * Generate enum options for all entities
 */
function generateEnumOptions(entities: Function[]): string {
    let output = '';
    
    // Extract enums from ClientEntities exports
    const enumExports: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(ClientEntities)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value.constructor === 'function') {
            // Check if it's an enum
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
 * Generate TanStack column definitions for a single entity
 */
function generateEntityColumnDefinitions(entity: Function, allEntities: Function[], storage: any): string {
    const entityName = entity.name;
    
    // Find the corresponding schema for this entity
    const entitySchema = findSchemaForEntity(entityName);
    if (!entitySchema) {
        console.warn(`No schema found for entity ${entityName}`);
        return `// Column definitions for ${entityName}
export const ${entityName}Columns: EntityColumnDefinitions<${entityName}> = {
} as const;

export type ${entityName}ColumnKey = keyof typeof ${entityName}ColumnConfig;
export type ${entityName}ColumnDef = (typeof ${entityName}ColumnConfig)[${entityName}ColumnKey];

`;
    }
    
    const columns = entitySchema.options.columns || {};
    const relations = entitySchema.options.relations || {};
    
    let output = `// TanStack column definitions for ${entityName}\n`;
    output += `export const ${entityName}Columns: EntityColumnDefinitions<${entityName}> = {\n`;
    
    // Generate TanStack column definitions
    for (const [propertyName, columnDef] of Object.entries(columns)) {
        
        const config = generateColumnConfigFromSchema(entity, propertyName, columnDef as any);
        output += `  ${propertyName}: {\n`;
        output += `    id: '${propertyName}',\n`;
        output += `    accessorKey: '${propertyName}' as keyof ${entityName},\n`;
        output += `    header: '${formatFieldLabel(propertyName)}',\n`;
        output += `    size: ${getColumnSize(config.cellType, config.validation?.maxLength)},\n`;
        output += `    minSize: ${getMinColumnSize(config.cellType)},\n`;
        output += `    maxSize: ${config.cellType === 'text' ? 600 : 500},\n`;
        // System fields are always sortable and hideable
        // Only restrict hiding for non-nullable business fields that are truly required
        const isSystemField = config.systemField;
        const hasDefault = (columnDef as any)?.hasDefault || (columnDef as any)?.default !== undefined;
        const isRequiredBusinessField = !isSystemField && !config.nullable && !hasDefault;
        
        output += `    enableSorting: true,\n`;
        output += `    enableColumnFilter: true,\n`;
        output += `    enableHiding: ${!isRequiredBusinessField},\n`;
        output += `    enableResizing: true,\n`;
        output += `    meta: {\n`;
        output += `      cellType: '${config.cellType}',\n`;
        
        // Generate config object
        output += `      config: {\n`;
        output += `        editable: ${config.editable},\n`;
        
        if (config.cellType === 'text') {
            output += `        placeholder: 'Enter ${formatFieldLabel(propertyName).toLowerCase()}...',\n`;
            if (config.validation?.email) output += `        inputType: 'email',\n`;
            if (config.validation?.url) output += `        inputType: 'url',\n`;
            if (config.validation?.maxLength) output += `        maxLength: ${config.validation.maxLength},\n`;
        }
        
        if (config.cellType === 'enum' && config.enumType) {
            output += `        enumValues: ${config.enumType}Options,\n`;
        }
        
        if (config.cellType === 'date') {
            const showTime = config.dbType.includes('timestamp');
            output += `        format: '${showTime ? 'MMM dd, yyyy HH:mm' : 'MMM dd, yyyy'}',\n`;
            output += `        showTime: ${showTime},\n`;
        }
        
        if (config.cellType === 'number') {
            if (config.validation?.maxLength) output += `        numberMax: ${config.validation.maxLength},\n`;
        }
        
        output += `      },\n`;
        
        if (config.systemField) {
            output += `      systemField: ${config.systemField},\n`;
        }
        
        if (config.businessLogic && Object.keys(config.businessLogic).length > 0) {
            output += `      businessLogic: ${JSON.stringify(config.businessLogic, null, 8)},\n`;
        }
        
        output += `    },\n`;
        output += `  },\n`;
    }
    
    // Generate relationship column definitions
    for (const [propertyName, relationDef] of Object.entries(relations)) {
        const relation = relationDef as any;
        const relConfig = generateRelationshipConfigFromSchema(entity, propertyName, relation, allEntities);
        if (relConfig) {
            const cellType = getCellTypeForRelation(relation.type);
            
            // For many-to-one and one-to-one relationships, use the foreign key field as accessorKey
            // For other relationship types, use the relationship property name
            let accessorKey = propertyName;
            if (relation.type === 'many-to-one' || relation.type === 'one-to-one') {
                // Convert relationship property name to foreign key property name (e.g., 'project' -> 'projectId')
                accessorKey = `${propertyName}Id`;
            }
            
            output += `  ${propertyName}: {\n`;
            output += `    id: '${propertyName}',\n`;
            output += `    accessorKey: '${accessorKey}' as keyof ${entityName},\n`;
            output += `    header: '${formatFieldLabel(propertyName)}',\n`;
            output += `    size: ${getColumnSize(cellType)},\n`;
            output += `    minSize: ${getMinColumnSize(cellType)},\n`;
            output += `    maxSize: 400,\n`;
            output += `    enableSorting: false,\n`;
            output += `    enableColumnFilter: true,\n`;
            output += `    enableHiding: true,\n`;
            output += `    enableResizing: true,\n`;
            output += `    meta: {\n`;
            output += `      cellType: '${cellType}',\n`;
            output += `      config: {\n`;
            output += `        editable: ${relConfig.editable},\n`;
            output += `        relationshipType: '${relation.type}',\n`;
            output += `        displayField: '${relConfig.displayField || 'name'}',\n`;
            
            if (relConfig.searchFields) {
                output += `        searchFields: ${JSON.stringify(relConfig.searchFields)},\n`;
            }
            
            output += `        allowCreate: ${getAllowCreate(relation.type)},\n`;
            output += `        searchable: true,\n`;
            output += `      },\n`;
            
            if (relConfig.businessLogic) {
                output += `      businessLogic: ${JSON.stringify(relConfig.businessLogic, null, 8)},\n`;
            }
            
            output += `    },\n`;
            output += `  },\n`;
        }
    }
    
    output += `} as const;\n\n`;
    
    return output;
}

/**
 * Find schema for entity by name
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
 * Generate configuration for a column from schema
 */
function generateColumnConfigFromSchema(entity: Function, propertyName: string, columnDef: any): any {
    const dbType = columnDef.type || 'text';
    const nullable = columnDef.nullable === true;
    const isSystemField = ['id', 'clientId', 'createdAt', 'updatedAt'].includes(propertyName);
    
    // Determine cell type
    let cellType = 'text';
    let enumType = null;
    
    if (columnDef.enum) {
        cellType = 'enum';
        // Try to determine enum type name
        if (columnDef.enum && columnDef.enum.name) {
            enumType = columnDef.enum.name;
        } else {
            // Guess from property name and entity
            if (propertyName === 'status') {
                if (entity.name === 'Task') enumType = 'TaskStatus';
                else if (entity.name === 'Project') enumType = 'ProjectStatus';
                else if (entity.name === 'ClientMigrationStatus') enumType = 'MigrationStatus';
            } else if (propertyName === 'priority') {
                enumType = 'TaskPriority';
            } else if (propertyName === 'role') {
                enumType = 'UserRole';
            }
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
    
    // Generate validation metadata
    const validation: any = {};
    if (columnDef.length) {
        validation.maxLength = columnDef.length;
    }
    if (propertyName === 'email') {
        validation.email = true;
    }
    if (propertyName.includes('url') || propertyName.includes('Url')) {
        validation.url = true;
    }
    if (dbType === 'uuid') {
        validation.uuid = true;
    }
    
    // Generate business logic
    const businessLogic: any = {};
    if (propertyName === 'status') {
        businessLogic.auditLog = true;
        if (entity.name === 'Task') {
            businessLogic.allowedTransitions = {
                'open': ['in_progress', 'completed'],
                'in_progress': ['open', 'completed'],
                'completed': ['open']
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
    
    if (propertyName.endsWith('Id')) {
        businessLogic.relationship = true;
        businessLogic.requiresValidReference = true;
        const relationName = propertyName.replace(/Id$/, '');
        businessLogic.targetEntity = relationName.charAt(0).toUpperCase() + relationName.slice(1);
    }
    
    return {
        dbType: dbType.toString(),
        cellType,
        editable: !isSystemField,
        readonly: isSystemField,
        systemField: isSystemField,
        nullable,
        enumType,
        validation,
        businessLogic
    };
}

/**
 * Generate relationship configuration from schema
 */
function generateRelationshipConfigFromSchema(entity: Function, propertyName: string, relationDef: any, allEntities: Function[]): any {
    const targetEntityName = relationDef.target;
    const isEditable = relationDef.type !== 'one-to-many';
    const nullable = relationDef.nullable !== false;
    
    // Get join table info for many-to-many
    let joinTable, joinColumn, inverseJoinColumn;
    if (relationDef.type === 'many-to-many' && relationDef.joinTable) {
        joinTable = relationDef.joinTable.name;
        joinColumn = relationDef.joinTable.joinColumns?.[0]?.name;
        inverseJoinColumn = relationDef.joinTable.inverseJoinColumns?.[0]?.name;
    }
    
    // Get foreign key for many-to-one
    let foreignKey;
    if (relationDef.type === 'many-to-one' && relationDef.joinColumn) {
        foreignKey = relationDef.joinColumn.name;
    }
    
    const businessLogic = {
        auditLog: true,
        relationship: true,
        requiresValidReference: true,
        targetEntity: targetEntityName,
        requiresPermission: `${entity.name.toLowerCase()}:update:${propertyName}`
    };
    
    return {
        targetEntity: targetEntityName,
        editable: isEditable,
        nullable,
        displayField: getDisplayField({ name: targetEntityName } as Function),
        searchFields: getSearchFields({ name: targetEntityName } as Function),
        foreignKey,
        joinTable,
        joinColumn,
        inverseJoinColumn,
        businessLogic
    };
}

/**
 * Get cell type for relationship
 */
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
            return 'relationship';
    }
}

/**
 * Get allow create for relationship type
 */
function getAllowCreate(relationType: string): boolean {
    return relationType === 'many-to-one' || relationType === 'one-to-one';
}

/**
 * Get display field for entity
 */
function getDisplayField(entityClass: Function): string {
    // Simple heuristic - look for common display field names
    const commonFields = ['name', 'title', 'label', 'displayName'];
    // For now, default to 'name' or 'title'
    return 'name';
}

/**
 * Get search fields for entity
 */
function getSearchFields(entityClass: Function): string[] {
    // Simple heuristic for search fields
    const commonSearchFields = ['name', 'title', 'email', 'description'];
    if (entityClass.name === 'User') {
        return ['name', 'email'];
    } else if (entityClass.name === 'Project' || entityClass.name === 'Task') {
        return ['name', 'description'];
    }
    return ['name'];
}

/**
 * Format property name as label
 */
function formatFieldLabel(propertyName: string): string {
    return propertyName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/Id$/, ' ID')
        .replace(/_/g, ' ')
        .trim();
}

/**
 * Get column size based on cell type and constraints
 */
function getColumnSize(cellType: string, maxLength?: number): number {
    switch (cellType) {
        case 'uuid':
            return 120;
        case 'date':
            return 120;
        case 'number':
            return 100;
        case 'boolean':
            return 80;
        case 'enum':
            return 120;
        case 'text':
            if (maxLength) {
                if (maxLength <= 50) return 200;
                if (maxLength <= 100) return 250;
                if (maxLength <= 255) return 300;
                return 350;
            }
            return 250;
        case 'relationship-single':
        case 'relationship-multi':
        case 'relationship-collection':
            return 180;
        case 'json':
            return 220;
        default:
            return 150;
    }
}

/**
 * Get minimum column size based on cell type - prevents wrapping on small screens
 */
function getMinColumnSize(cellType: string): number {
    switch (cellType) {
        case 'uuid':
            return 100; // UUIDs need space to show truncated value
        case 'date':
            return 100; // Dates are compact: "Jan 15, 2024" fits in ~100px
        case 'number':
            return 80;  // Numbers are usually short
        case 'boolean':
            return 70;  // Booleans are compact
        case 'enum':
            return 100; // Enums need space for labels
        case 'text':
            return 120; // Text needs room for ellipsis to be useful
        case 'relationship-single':
        case 'relationship-multi':
            return 140; // Relationships need room for names + icon
        case 'relationship-collection':
            return 160; // Collections need more space
        case 'json':
            return 140; // JSON needs space for meaningful preview
        default:
            return 100;
    }
}

/**
 * Generate utility functions
 */
function generateUtilityFunctions(): string {
    return `
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getEditableColumns<T>(columns: EntityColumnDefinitions<T>): Array<keyof T> {
  return Object.keys(columns).filter(key => {
    const columnDef = columns[key as keyof T];
    return columnDef?.meta?.config?.editable === true;
  }) as Array<keyof T>;
}

export function getSystemFields<T>(columns: EntityColumnDefinitions<T>): Array<keyof T> {
  return Object.keys(columns).filter(key => {
    const columnDef = columns[key as keyof T];
    return columnDef?.meta?.systemField === true;
  }) as Array<keyof T>;
}

export function getRelationshipFields<T>(columns: EntityColumnDefinitions<T>): Array<keyof T> {
  return Object.keys(columns).filter(key => {
    const columnDef = columns[key as keyof T];
    return columnDef?.meta?.cellType?.startsWith('relationship');
  }) as Array<keyof T>;
}

export function getManyToManyFields<T>(columns: EntityColumnDefinitions<T>): Array<keyof T> {
  return Object.keys(columns).filter(key => {
    const columnDef = columns[key as keyof T];
    return columnDef?.meta?.config?.relationshipType === 'many-to-many';
  }) as Array<keyof T>;
}

export function getManyToOneFields<T>(columns: EntityColumnDefinitions<T>): Array<keyof T> {
  return Object.keys(columns).filter(key => {
    const columnDef = columns[key as keyof T];
    return columnDef?.meta?.config?.relationshipType === 'many-to-one';
  }) as Array<keyof T>;
}

export function getOneToManyFields<T>(columns: EntityColumnDefinitions<T>): Array<keyof T> {
  return Object.keys(columns).filter(key => {
    const columnDef = columns[key as keyof T];
    return columnDef?.meta?.config?.relationshipType === 'one-to-many';
  }) as Array<keyof T>;
}

export function getColumnsForCellRenderer<T>(columns: EntityColumnDefinitions<T>, renderer: CellRenderer<T>): ColumnDef<T>[] {
  return Object.values(columns).map(col => ({
    ...col as ColumnDef<T>,
    cell: renderer
  }));
}
`;
}

// Run the generator if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generateColumnConfigurationFile().catch(console.error);
} 