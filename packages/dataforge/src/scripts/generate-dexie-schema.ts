import 'reflect-metadata';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { extractEntityMetadata, EntityMetadata as BaseEntityMetadata, RelationshipMetadata } from '../utils/metadata-extraction.js';
import { getDexieIndexedProperties } from '../utils/context.js';
import * as ClientEntities from '../generated/client-entities.js';

// Extended metadata interface to include indexed fields
interface EntityMetadata extends BaseEntityMetadata {
  indexedFields?: string[];
}

console.log('[generate-dexie-schema] Starting Dexie schema generation...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const VERSION_HISTORY_PATH = path.join(PACKAGE_ROOT, 'src/dexie-version-history.json');

// Junction table type definitions
interface JunctionTable {
  name: string;
  columns: Array<{ name: string; type: string }>;
  indexes: string[];
}

interface VersionHistory {
  currentVersion: number;
  versions: Array<{
    version: number;
    generatedAt: string;
    schemaHash: string;
    stores: Record<string, string>;
  }>;
}

/**
 * Load version history from file
 */
async function loadVersionHistory(): Promise<VersionHistory> {
  try {
    const content = await fs.readFile(VERSION_HISTORY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // If file doesn't exist, return initial version
    console.log('[generate-dexie-schema] No version history found, starting fresh');
    return {
      currentVersion: 0,
      versions: []
    };
  }
}

/**
 * Save version history to file
 */
async function saveVersionHistory(history: VersionHistory): Promise<void> {
  await fs.writeFile(VERSION_HISTORY_PATH, JSON.stringify(history, null, 2));
}

/**
 * Calculate hash of schema for comparison
 */
function calculateSchemaHash(stores: Record<string, string>): string {
  const sortedStores = Object.keys(stores).sort().reduce((acc, key) => {
    acc[key] = stores[key] || '';
    return acc;
  }, {} as Record<string, string>);
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(sortedStores))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Main function to generate Dexie schema from TypeORM entities
 */
async function generateDexieSchema() {
  console.log('[generate-dexie-schema] Extracting entity metadata...');
  
  // Ensure generated directory exists
  const generatedDir = path.join(PACKAGE_ROOT, 'src/generated');
  await fs.mkdir(generatedDir, { recursive: true });
  
  // Load version history
  const history = await loadVersionHistory();
  
  // Extract entity metadata
  const entityMetadataMap = extractAllEntityMetadata();
  const junctionTables = extractJunctionTables(entityMetadataMap);
  
  // Generate current schema stores
  const currentStores = generateStoreDefinitions(entityMetadataMap, junctionTables);
  const currentSchemaHash = calculateSchemaHash(currentStores);
  
  // Check if schema has changed
  const lastVersion = history.versions[history.versions.length - 1];
  const hasChanged = !lastVersion || lastVersion.schemaHash !== currentSchemaHash;
  
  if (hasChanged) {
    // Increment version and add to history
    const newVersion = history.currentVersion + 1;
    console.log(`[generate-dexie-schema] Schema changed, incrementing version from ${history.currentVersion} to ${newVersion}`);
    
    history.currentVersion = newVersion;
    history.versions.push({
      version: newVersion,
      generatedAt: new Date().toISOString(),
      schemaHash: currentSchemaHash,
      stores: currentStores
    });
    
    // Save updated history
    await saveVersionHistory(history);
  } else {
    console.log(`[generate-dexie-schema] Schema unchanged, keeping version ${history.currentVersion}`);
  }
  
  // Generate Dexie schema with version history
  const schemaOutput = generateDexieSchemaFile(entityMetadataMap, junctionTables, history);
  
  // Write the generated file
  const outputPath = path.join(generatedDir, 'dexie-schema.ts');
  await fs.writeFile(outputPath, schemaOutput);
  
  console.log(`[generate-dexie-schema] Generated Dexie schema at: ${outputPath}`);
}

/**
 * Extract metadata for all client entities
 */
function extractAllEntityMetadata(): Map<string, EntityMetadata> {
  const entityMetadataMap = new Map<string, EntityMetadata>();
  
  // Get all client table names (domain + system + utility)
  const domainTableNames = ClientEntities.CLIENT_DOMAIN_TABLES.map(table => String(table).replace(/"/g, ''));
  const systemTableNames = ClientEntities.CLIENT_SYSTEM_TABLES.map(table => String(table).replace(/"/g, ''));
  const utilityTableNames = ClientEntities.CLIENT_UTILITY_TABLES ? 
    ClientEntities.CLIENT_UTILITY_TABLES.map(table => String(table).replace(/"/g, '')) : [];
  
  const allClientTableNames = [...domainTableNames, ...systemTableNames, ...utilityTableNames];
  console.log('[generate-dexie-schema] All client tables:', allClientTableNames);
  
  // Extract entity schemas and classes
  const entitySchemas: Array<{ name: string; schema: any }> = [];
  const entityClasses: Array<{ name: string; entityClass: Function }> = [];
  
  for (const [key, value] of Object.entries(ClientEntities)) {
    if (key.endsWith('Schema') && value && typeof value === 'object' && 'options' in value) {
      const entityName = key?.replace('Schema', '');
      entitySchemas.push({ name: entityName, schema: value });
    } else if (typeof value === 'function' && value.prototype && !key.endsWith('Schema')) {
      const excludedFunctions = ['getEntityRelationships', 'hasRelationshipConfig', 'getJunctionRelationships'];
      if (!excludedFunctions.includes(key) && value.name && value.name[0] === value.name[0]?.toUpperCase()) {
        entityClasses.push({ name: key, entityClass: value as Function });
      }
    }
  }
  
  // Process each entity
  for (const { name: entityName, schema } of entitySchemas) {
    const entityClass = entityClasses.find(e => e.name === entityName)?.entityClass;
    if (!entityClass) {
      console.warn(`[generate-dexie-schema] No entity class found for ${entityName}`);
      continue;
    }
    
    const schemaOptions = schema.options || schema._schema || schema;
    const tableName = schemaOptions.tableName;
    
    // Process all client entities (domain + system + utility)
    if (!allClientTableNames.includes(tableName)) {
      console.log(`[generate-dexie-schema] Skipping non-client entity: ${entityName} (${tableName})`);
      continue;
    }
    
    const metadata = extractEntityMetadata(entityName, schemaOptions, entityClass);
    
    // Extract indexes from schema and entity class
    const indexedFields = extractIndexedFields(schemaOptions, entityClass, metadata);
    (metadata as EntityMetadata).indexedFields = indexedFields;
    
    entityMetadataMap.set(entityName, metadata);
  }
  
  return entityMetadataMap;
}

/**
 * Extract indexed fields from entity schema and TypeORM metadata
 */
function extractIndexedFields(schemaOptions: any, entityClass?: Function, metadata?: EntityMetadata): string[] {
  const indexedFields: string[] = [];
  const columnNameToPropertyMap = new Map<string, string>();
  
  // Build mapping from database column names to TypeScript property names
  if (metadata) {
    for (const field of metadata.fields) {
      if (field.dbName && field.dbName !== field.name) {
        columnNameToPropertyMap.set(field.dbName, field.name);
      }
    }
  }
  
  // Helper function to convert database column name to property name
  const toPropertyName = (columnName: string): string => {
    return columnNameToPropertyMap.get(columnName) || columnName;
  };
  
  // Extract indexes from schema
  if (schemaOptions.indices) {
    for (const index of schemaOptions.indices) {
      if (typeof index === 'string') {
        indexedFields.push(toPropertyName(index));
      } else if (index.columnNames && Array.isArray(index.columnNames)) {
        // Convert column names to property names
        const propertyNames = index.columnNames.map(toPropertyName);
        indexedFields.push(...propertyNames);
      }
    }
  }
  
  // Also check for individual column indexes
  if (schemaOptions.columns) {
    for (const [propertyName, columnDef] of Object.entries(schemaOptions.columns)) {
      if ((columnDef as any).index === true) {
        // propertyName is already the TypeScript property name
        indexedFields.push(propertyName);
      }
    }
  }
  
  // Extract indexes from our custom @DexieIndex() decorator
  if (entityClass) {
    try {
      const dexieIndexedProps = getDexieIndexedProperties(entityClass);
      indexedFields.push(...dexieIndexedProps);
      
      // Temporary hardcoded fix for LocalChanges processedSync index
      // TODO: Fix decorator extraction to work with original entity classes
      if (entityClass.name === 'LocalChanges') {
        indexedFields.push('processedSync');
      }
      
      // Temporary hardcoded fix for EntityDependency entityType index
      if (entityClass.name === 'EntityDependency') {
        indexedFields.push('entityType');
      }
    } catch (error) {
      console.warn(`[generate-dexie-schema] Failed to extract Dexie indexes from class metadata:`, error);
    }
  }
  
  console.log(`[generate-dexie-schema] Extracted indexes for entity:`, indexedFields);
  return indexedFields;
}

/**
 * Extract junction tables from entity relationships
 */
function extractJunctionTables(entityMetadataMap: Map<string, EntityMetadata>): JunctionTable[] {
  const junctionTables = new Map<string, JunctionTable>();
  
  for (const [entityName, metadata] of entityMetadataMap) {
    for (const relationship of metadata.relationships) {
      if (relationship.type === 'many-to-many' && relationship.joinTable) {
        const tableName = relationship.joinTable;
        
        // Determine column names based on naming patterns
        // Use camelCase for Dexie properties
        let columns: Array<{ name: string; type: string }>;
        let indexes: string[];
        
        if (tableName === 'task_tags') {
          columns = [
            { name: 'taskId', type: 'string' },
            { name: 'tagId', type: 'string' }
          ];
          indexes = ['[taskId+tagId]', 'taskId', 'tagId'];
        } else if (tableName === 'task_dependencies') {
          columns = [
            { name: 'dependentTaskId', type: 'string' },
            { name: 'dependencyTaskId', type: 'string' }
          ];
          indexes = ['[dependentTaskId+dependencyTaskId]', 'dependentTaskId', 'dependencyTaskId'];
        } else if (tableName === 'project_members') {
          columns = [
            { name: 'projectId', type: 'string' },
            { name: 'userId', type: 'string' },
            { name: 'role', type: 'string' }
          ];
          indexes = ['[projectId+userId]', 'projectId', 'userId'];
        } else if (tableName === 'project_tags') {
          columns = [
            { name: 'projectId', type: 'string' },
            { name: 'tagId', type: 'string' }
          ];
          indexes = ['[projectId+tagId]', 'projectId', 'tagId'];
        } else if (tableName === 'project_subtasks') {
          columns = [
            { name: 'projectId', type: 'string' },
            { name: 'taskId', type: 'string' }
          ];
          indexes = ['[projectId+taskId]', 'projectId', 'taskId'];
        } else if (tableName === 'project_status_sets') {
          columns = [
            { name: 'projectId', type: 'string' },
            { name: 'statusSetId', type: 'string' }
          ];
          indexes = ['[projectId+statusSetId]', 'projectId', 'statusSetId'];
        } else if (tableName === 'project_tag_sets') {
          columns = [
            { name: 'projectId', type: 'string' },
            { name: 'tagSetId', type: 'string' }
          ];
          indexes = ['[projectId+tagSetId]', 'projectId', 'tagSetId'];
        } else {
          // Generic pattern - use camelCase
          const sourceEntity = entityName.charAt(0).toLowerCase() + entityName.slice(1);
          const targetEntity = relationship.targetEntity.charAt(0).toLowerCase() + relationship.targetEntity.slice(1);
          columns = [
            { name: `${sourceEntity}Id`, type: 'string' },
            { name: `${targetEntity}Id`, type: 'string' }
          ];
          indexes = [`[${sourceEntity}Id+${targetEntity}Id]`, `${sourceEntity}Id`, `${targetEntity}Id`];
        }
        
        junctionTables.set(tableName, {
          name: tableName,
          columns,
          indexes
        });
      }
    }
  }
  
  return Array.from(junctionTables.values());
}

/**
 * Generate indexes for an entity
 */
function generateEntityIndexes(metadata: EntityMetadata): string[] {
  const indexes: string[] = ['id']; // Primary key
  const addedIndexes = new Set<string>(['id']); // Track to avoid duplicates
  
  // Helper to add index if not already present
  const addIndex = (index: string) => {
    if (!addedIndexes.has(index)) {
      indexes.push(index);
      addedIndexes.add(index);
    }
  };
  
  // Add indexes from schema metadata (includes @Index() decorators)
  if (metadata.indexedFields || []) {
    for (const indexedField of metadata.indexedFields || []) {
      addIndex(indexedField);
    }
  }
  
  // Add foreign keys (using TypeScript property names)
  for (const field of metadata.fields) {
    if (field.category === 'relationship-foreign-key' && field.name !== 'id') {
      addIndex(field.name);
    }
  }
  
  // Add commonly queried fields
  if (metadata.fields.some(f => f.name === 'updatedAt')) {
    addIndex('updatedAt');
  }
  if (metadata.fields.some(f => f.name === 'clientId')) {
    addIndex('clientId');
  }
  
  // Add entity-specific compound indexes
  if (metadata.name === 'Task') {
    addIndex('[statusId+priority]');
    // Add legacy status if it exists
    if (metadata.fields.some(f => f.name === 'legacyStatus')) {
      addIndex('legacyStatus');
    }
  } else if (metadata.name === 'Project') {
    addIndex('status');
  } else if (metadata.name === 'User') {
    // Add unique indexes (no need to check, just remove from normal indexes)
    const emailField = metadata.fields.find(f => f.name === 'email');
    const usernameField = metadata.fields.find(f => f.name === 'username');
    if (emailField) {
      indexes.push('&email');
      addedIndexes.add('email');
    }
    if (usernameField) {
      indexes.push('&username');
      addedIndexes.add('username');
    }
  } else if (metadata.name === 'StatusDefinition') {
    addIndex('name');
    addIndex('isDefault');
  } else if (metadata.name === 'Tag') {
    addIndex('name');
  }
  
  return indexes;
}

/**
 * Generate store definitions for current schema
 */
function generateStoreDefinitions(
  entityMetadataMap: Map<string, EntityMetadata>,
  junctionTables: JunctionTable[]
): Record<string, string> {
  const stores: Record<string, string> = {};
  
  // Entity tables - use camelCase table names
  for (const entity of entityMetadataMap.values()) {
    const indexes = generateEntityIndexes(entity);
    const camelCaseTableName = toCamelCase(entity.tableName);
    stores[camelCaseTableName] = indexes.join(', ');
  }
  
  // Junction tables - use camelCase table names
  for (const junction of junctionTables) {
    const camelCaseTableName = toCamelCase(junction.name);
    stores[camelCaseTableName] = junction.indexes.join(', ');
  }
  
  return stores;
}

/**
 * Convert snake_case to camelCase for Dexie table names
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Generate the Dexie schema TypeScript file
 */
function generateDexieSchemaFile(
  entityMetadataMap: Map<string, EntityMetadata>,
  junctionTables: JunctionTable[],
  history: VersionHistory
): string {
  const entities = Array.from(entityMetadataMap.values());
  
  // Generate store configurations using camelCase table names
  const storeConfigs: string[] = [];
  
  // Entity tables
  for (const entity of entities) {
    const indexes = generateEntityIndexes(entity);
    const camelCaseTableName = toCamelCase(entity.tableName);
    storeConfigs.push(`      ${camelCaseTableName}: '${indexes.join(', ')}'`);
  }
  
  // Junction tables
  for (const junction of junctionTables) {
    const camelCaseTableName = toCamelCase(junction.name);
    storeConfigs.push(`      ${camelCaseTableName}: '${junction.indexes.join(', ')}'`);
  }
  
  // Generate junction table interfaces
  const junctionInterfaces = junctionTables.map(junction => {
    const fields = junction.columns.map(col => `  ${col.name}: ${col.type};`).join('\n');
    return `interface ${toPascalCase(junction.name)} {\n${fields}\n}`;
  }).join('\n\n');
  
  // Generate import statements for entities
  const entityImports = entities.map(e => e.name).join(', ');
  
  // Generate version blocks
  const versionBlocks = history.versions.map(version => {
    const storeEntries = Object.entries(version.stores)
      .map(([table, indexes]) => `        ${table}: '${indexes}'`)
      .join(',\n');
    
    return `    // Version ${version.version} - Generated at ${version.generatedAt}
    this.version(${version.version}).stores({
${storeEntries}
    });`;
  }).join('\n\n');
  
  return `/**
 * Auto-generated Dexie schema from TypeORM entities
 * Generated at: ${new Date().toISOString()}
 * Current Version: ${history.currentVersion}
 * 
 * This file is auto-generated. Do not edit manually.
 * Run 'pnpm forge:build' to regenerate.
 * 
 * Schema version is automatically incremented when changes are detected.
 */

import { Dexie, Table } from 'dexie';
import type { 
  ${entityImports}
} from '../client-entities.js';

// Junction table types
${junctionInterfaces}

/**
 * Dexie database class with TypeORM entity types
 * 
 * Version History:
${history.versions.map(v => ` * - Version ${v.version}: ${v.generatedAt}`).join('\n')}
 */
export class VibeStackDB extends Dexie {
  // Entity tables - using TypeORM entity types with camelCase names
${entities.map(e => `  ${toCamelCase(e.tableName)}!: Table<${e.name}>;`).join('\n')}
  
  // Junction tables
${junctionTables.map(j => `  ${toCamelCase(j.name)}!: Table<${toPascalCase(j.name)}>;`).join('\n')}
  
  constructor() {
    super('vibestack-db');
    
${versionBlocks}
  }
}

// Export singleton instance
export const db = new VibeStackDB();

// Helper type for entity names (camelCase for Dexie)
export type EntityTableName = ${entities.map(e => `'${toCamelCase(e.tableName)}'`).join(' | ')};

// Helper type for junction table names (camelCase for Dexie)
export type JunctionTableName = ${junctionTables.map(j => `'${toCamelCase(j.name)}'`).join(' | ')};

// Combined table names
export type TableName = EntityTableName | JunctionTableName;

// Export metadata for runtime use (camelCase names for Dexie)
export const ENTITY_TABLES = [
${entities.map(e => `  '${toCamelCase(e.tableName)}'`).join(',\n')}
] as const;

// Export domain tables separately for generators (camelCase names for Dexie)
export const CLIENT_DOMAIN_TABLES = [
${entities.filter(e => {
  // System tables based on context
  const systemTables = ['client_migration_status', 'local_changes', 'sync_metadata'];
  return !systemTables.includes(e.tableName);
}).map(e => `  '${toCamelCase(e.tableName)}'`).join(',\n')}
] as const;

export const JUNCTION_TABLES = [
${junctionTables.map(j => `  '${toCamelCase(j.name)}'`).join(',\n')}
] as const;

// Export type mapping for sync operations (Dexie table name -> Entity name)
export const TABLE_TO_ENTITY_MAP = {
${entities.map(e => `  '${toCamelCase(e.tableName)}': '${e.name}'`).join(',\n')}
} as const;

// Export mapping from Dexie table names to database table names for sync
export const DEXIE_TO_DB_TABLE_MAP = {
${entities.map(e => `  '${toCamelCase(e.tableName)}': '${e.tableName}'`).join(',\n')},
${junctionTables.map(j => `  '${toCamelCase(j.name)}': '${j.name}'`).join(',\n')}
} as const;
`;
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Run the generator
generateDexieSchema().catch(error => {
  console.error('[generate-dexie-schema] Error:', error);
  process.exit(1);
});