#!/usr/bin/env node
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

// ============================================================================
// Types and Interfaces
// ============================================================================

interface RelationshipInfo {
  propertyName: string;
  type: 'many-to-many' | 'one-to-many' | 'many-to-one';
  targetEntity: string;
  junctionTable?: string;
  joinColumn?: string;
  inverseJoinColumn?: string;
}

interface EntityInfo {
  name: string;
  tableName: string;
  relationships?: any[];
}

// ============================================================================
// Main Generation Function
// ============================================================================

async function generateDexieDomainServices() {
  console.log('[generate-dexie-domain-services] Starting generation...');
  
  // Read the generated client entities to get relationship information
  const clientEntitiesPath = path.join(PACKAGE_ROOT, 'src/generated/client-entities.ts');
  const clientEntitiesContent = await fs.readFile(clientEntitiesPath, 'utf-8');
  
  // Read the generated dexie schema to get entity information
  const schemaPath = path.join(PACKAGE_ROOT, 'src/generated/dexie-schema.ts');
  const schemaContent = await fs.readFile(schemaPath, 'utf-8');
  
  // Extract TABLE_TO_ENTITY_MAP to get proper entity names
  const tableMapMatch = schemaContent.match(/export const TABLE_TO_ENTITY_MAP = \{([\s\S]*?)\} as const;/);
  if (!tableMapMatch) {
    throw new Error('Could not find TABLE_TO_ENTITY_MAP in dexie-schema.ts');
  }
  
  // Parse the table to entity mappings
  const tableToEntityMap: Record<string, string> = {};
  const mappingLines = tableMapMatch[1]?.split(',').map(line => line.trim()).filter(line => line) || [];
  mappingLines.forEach(line => {
    const match = line.match(/['"](.+?)['"]\s*:\s*['"](.+?)['"]/);
    if (match && match[1] && match[2]) {
      tableToEntityMap[match[1]] = match[2];
    }
  });
  
  // Extract domain tables by checking CLIENT_DOMAIN_TABLES
  const domainTablesMatch = schemaContent.match(/export const CLIENT_DOMAIN_TABLES = \[([\s\S]*?)\] as const;/);
  let domainTables: string[] = [];
  
  if (domainTablesMatch) {
    domainTables = (domainTablesMatch[1] || '')
      .split(',')
      .map(t => t.trim().replace(/['"]/g, ''))
      .filter(t => t);
  } else {
    // Fallback: exclude known system tables
    const systemTables = ['client_migration_status', 'local_changes', 'sync_metadata'];
    domainTables = Object.keys(tableToEntityMap).filter(t => !systemTables.includes(t));
  }
  
  // Extract junction table mapping and relationship configs from client entities
  const junctionTableMapping = extractJunctionTableMapping(clientEntitiesContent);
  const relationshipConfigs = extractRelationshipConfigs(clientEntitiesContent);
  
  // Convert table names to entity info using the map and extract relationships
  const entities: EntityInfo[] = domainTables.map(tableName => {
    const entityName = tableToEntityMap[tableName] || tableNameToEntityName(tableName);
    const relationships = extractRelationshipsForEntity(entityName, tableName, junctionTableMapping, relationshipConfigs);
    return {
      name: entityName,
      tableName: tableName,
      relationships
    };
  });
  
  console.log('Generating domain services for:', entities.map(e => e.name));
  
  // Ensure generated directory exists
  const generatedDir = path.join(PACKAGE_ROOT, 'src/generated');
  const dexieDomainDir = path.join(generatedDir, 'dexie-domain');
  await fs.mkdir(dexieDomainDir, { recursive: true });
  
  // Generate individual domain service files
  for (const entity of entities) {
    const serviceOutput = generateEntityDomainService(entity);
    const serviceFilePath = path.join(dexieDomainDir, `${entity.name.toLowerCase()}-dexie-service.ts`);
    await fs.writeFile(serviceFilePath, serviceOutput);
    console.log(`✅ Generated ${entity.name} domain service`);
  }
  
  // Generate index file
  const indexOutput = generateIndexFile(entities);
  const indexFilePath = path.join(dexieDomainDir, 'index.ts');
  await fs.writeFile(indexFilePath, indexOutput);
  console.log(`✅ Generated Dexie domain services index at: ${indexFilePath}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract junction table mapping from client entities content
 */
function extractJunctionTableMapping(content: string): any {
  const match = content.match(/export const CLIENT_JUNCTION_TABLE_MAPPING = \{([\s\S]*?)\} as const;/);
  if (!match) return {};
  
  try {
    // Create a function that returns the object
    const fn = new Function('return {' + match[1] + '};');
    return fn();
  } catch (e) {
    console.warn('Could not parse junction table mapping:', e);
    return {};
  }
}

/**
 * Extract relationship configs from client entities content
 */
function extractRelationshipConfigs(content: string): any {
  const match = content.match(/export const CLIENT_RELATIONSHIP_CONFIGS: Record<string, RelationshipConfig> = \{([\s\S]*?)\} as const;/);
  if (!match) return {};
  
  try {
    // Create a function that returns the object
    const fn = new Function('return {' + match[1] + '};');
    return fn();
  } catch (e) {
    console.warn('Could not parse relationship configs:', e);
    return {};
  }
}

/**
 * Extract relationship information for a given entity
 */
function extractRelationshipsForEntity(
  entityName: string,
  tableName: string,
  junctionTableMapping: any,
  relationshipConfigs: any
): RelationshipInfo[] {
  const relationships: RelationshipInfo[] = [];
  
  // Extract junction relationships from mapping
  Object.entries(junctionTableMapping).forEach(([junctionTable, config]: [string, any]) => {
    if (config.sourceEntity === entityName) {
      relationships.push({
        propertyName: config.relationName,
        type: 'many-to-many',
        targetEntity: config.targetEntity,
        junctionTable: junctionTable,
        joinColumn: config.sourceColumn,
        inverseJoinColumn: config.targetColumn
      });
    }
  });
  
  // Extract other relationships from relationship configs
  const entityConfig = relationshipConfigs[tableName] || relationshipConfigs[entityName.toLowerCase()];
  if (entityConfig) {
    // Add many-to-one relationships
    if (entityConfig.requiredReferences) {
      entityConfig.requiredReferences.forEach((ref: any) => {
        const propertyName = ref.field.replace(/Id$/, ''); // Remove 'Id' suffix
        relationships.push({
          propertyName: propertyName,
          type: 'many-to-one',
          targetEntity: tableNameToEntityName(ref.targetEntity)
        });
      });
    }
    
    // Add self-references
    if (entityConfig.selfReferences) {
      entityConfig.selfReferences.forEach((ref: any) => {
        relationships.push({
          propertyName: ref.field,
          type: 'many-to-one',
          targetEntity: entityName
        });
      });
    }
  }
  
  // Infer one-to-many relationships from other entities' many-to-one
  Object.entries(relationshipConfigs).forEach(([otherTable, otherConfig]: [string, any]) => {
    if (otherConfig.requiredReferences) {
      otherConfig.requiredReferences.forEach((ref: any) => {
        if (ref.targetEntity === tableName) {
          const otherEntityName = tableNameToEntityName(otherTable);
          const propertyName = otherEntityName.toLowerCase() + 's'; // Simple pluralization
          
          // Check if we already have this relationship
          if (!relationships.some(r => r.propertyName === propertyName)) {
            relationships.push({
              propertyName: propertyName,
              type: 'one-to-many',
              targetEntity: otherEntityName
            });
          }
        }
      });
    }
  });
  
  return relationships;
}

function tableNameToEntityName(tableName: string): string {
  // Convert snake_case to PascalCase
  // e.g., 'status_definitions' -> 'StatusDefinition'
  // e.g., 'tag_sets' -> 'TagSet'
  // e.g., 'tasks' -> 'Task'
  
  // Split by underscore and process each part
  const parts = tableName.split('_');
  
  // Convert each part to singular form and capitalize
  const pascalParts = parts.map(part => {
    // Remove trailing 's' for plurals (but keep 'status' as is)
    let singular = part;
    if (part.endsWith('s') && part !== 'status') {
      singular = part.slice(0, -1);
    }
    
    // Capitalize first letter
    return singular.charAt(0).toUpperCase() + singular.slice(1);
  });
  
  return pascalParts.join('');
}

// ============================================================================
// Code Generation
// ============================================================================

function generateEntityDomainService(entity: { name: string; tableName: string; relationships?: any[] }): string {
  const lowerName = entity.name.toLowerCase();
  
  return `/**
 * Auto-generated Dexie Domain Service for ${entity.name}
 * 
 * This file provides CRUD operations and relationship resolvers
 * for the ${entity.name} entity using Dexie.
 * 
 * Generated at: ${new Date().toISOString()}
 */

import { db } from '../dexie-schema.js';
import type { ${entity.name} } from '../client-entities.js';

// Type definitions for ${entity.name}
export interface ${entity.name}UpdateInput {
  // Basic fields that can be updated (excluding relationships and computed fields)
  [key: string]: any;
}

export class ${entity.name}DexieService {
  /**
   * Create a new ${entity.name}
   */
  async create(input: Record<string, any>): Promise<${entity.name}> {
    const id = (globalThis as any).crypto.randomUUID();
    const now = new Date();
    
    const ${lowerName} = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    } as ${entity.name};
    
    await db.${entity.tableName}.add(${lowerName});
    return ${lowerName};
  }

  /**
   * Get ${entity.name} by ID
   */
  async getById(id: string): Promise<${entity.name} | undefined> {
    return await db.${entity.tableName}.get(id);
  }

  /**
   * Get all ${entity.name}s
   */
  async getAll(): Promise<${entity.name}[]> {
    return await db.${entity.tableName}.toArray();
  }

  /**
   * Update ${entity.name}
   */
  async update(id: string, updates: Record<string, any>): Promise<${entity.name} | undefined> {
    const updatedAt = new Date();
    
    // Use type assertion to avoid circular reference issues
    const updateData: any = { ...updates, updatedAt };
    await (db.${entity.tableName} as any).update(id, updateData);
    
    return await this.getById(id);
  }

  /**
   * Delete ${entity.name}
   */
  async delete(id: string): Promise<boolean> {
    await db.${entity.tableName}.delete(id);
    return true;
  }
${generateSpecialMethods(entity)}${generateRelationshipMethods(entity)}
}

// Export singleton instance
export const ${lowerName}DexieService = new ${entity.name}DexieService();
`;
}

function generateSpecialMethods(entity: EntityInfo): string {
  const methods: string[] = [];
  
  // Add entity-specific custom methods that aren't standard relationships
  if (entity.name === 'StatusDefinition') {
    methods.push(`
  /**
   * Get StatusDefinitions for a specific entity type
   */
  async getStatusDefinitionsForEntityType(entityType: string): Promise<any[]> {
    const statusSets = await db.status_sets
      .where('entityType')
      .equals(entityType)
      .toArray();
    
    const statusSetIds = statusSets.map(ss => ss.id);
    
    const statusDefinitions = await db.status_definitions
      .where('statusSetId')
      .anyOf(statusSetIds)
      .toArray();
    
    return statusDefinitions;
  }`);
  }
  
  if (entity.name === 'Tag') {
    methods.push(`
  /**
   * Get Tags for a specific project
   */
  async getTagsForProject(projectId: string): Promise<any[]> {
    // Get tag sets associated with the project
    const projectTagSets = await db.project_tag_sets
      .where('projectId')
      .equals(projectId)
      .toArray();
    
    const tagSetIds = projectTagSets.map(pts => pts.tagSetId);
    
    const tags = await db.tags
      .where('tagSetId')
      .anyOf(tagSetIds)
      .toArray();
    
    return tags;
  }`);
  }
  
  // Note: Project.members and Task.tags relationships are now handled by generateRelationshipMethods
  
  return methods.length > 0 ? '\n' + methods.join('\n') + '\n' : '';
}

/**
 * Generate comprehensive relationship methods for an entity
 */
function generateRelationshipMethods(entity: EntityInfo): string {
  const methods: string[] = [];
  
  // Group relationships by type
  const manyToManyRelations = hasRelationships(entity) ? entity.relationships.filter(r => r.type === 'many-to-many') : [];
  const oneToManyRelations = hasRelationships(entity) ? entity.relationships.filter(r => r.type === 'one-to-many') : [];
  const manyToOneRelations = hasRelationships(entity) ? entity.relationships.filter(r => r.type === 'many-to-one') : [];
  
  // Generate many-to-many relationship methods
  for (const relation of manyToManyRelations) {
    const methodBaseName = relation.propertyName.charAt(0).toUpperCase() + relation.propertyName.slice(1);
    const targetTableName = camelToSnakeCase(relation.targetEntity) + 's';
    const targetIdField = relation.inverseJoinColumn || `${camelToSnakeCase(relation.targetEntity)}_id`;
    const sourceIdField = relation.joinColumn || `${camelToSnakeCase(entity.name)}_id`;
    
    // Get method
    methods.push(`
  /**
   * Get ${relation.propertyName} for this ${entity.name}
   */
  async get${methodBaseName}(${camelCase(entity.name)}Id: string): Promise<any[]> {
    const junctions = await db.${relation.junctionTable}
      .where('${sourceIdField}')
      .equals(${camelCase(entity.name)}Id)
      .toArray();
    
    const targetIds = junctions.map(j => j.${targetIdField});
    const targets = await db.${targetTableName}.bulkGet(targetIds);
    
    return targets.filter(t => t !== undefined);
  }`);
    
    // Set method
    methods.push(`
  /**
   * Set ${relation.propertyName} for this ${entity.name}
   */
  async set${methodBaseName}(${camelCase(entity.name)}Id: string, targetIds: string[]): Promise<void> {
    await db.transaction('rw', db.${relation.junctionTable}, async () => {
      // Remove existing relationships
      await db.${relation.junctionTable}
        .where('${sourceIdField}')
        .equals(${camelCase(entity.name)}Id)
        .delete();
      
      // Add new relationships
      if (targetIds.length > 0) {
        const now = new Date();
        await db.${relation.junctionTable}.bulkAdd(
          targetIds.map(targetId => ({
            ${sourceIdField}: ${camelCase(entity.name)}Id,
            ${targetIdField}: targetId,${relation.junctionTable === 'project_members' ? `
            role: 'member',` : ''}
            createdAt: now,
            updatedAt: now
          }))
        );
      }
    });
  }`);
    
    // Add method
    methods.push(`
  /**
   * Add ${relation.propertyName} to this ${entity.name}
   */
  async add${methodBaseName}(${camelCase(entity.name)}Id: string, targetIds: string[]): Promise<void> {
    if (targetIds.length === 0) return;
    
    const now = new Date();
    const newRelations = targetIds.map(targetId => ({
      ${sourceIdField}: ${camelCase(entity.name)}Id,
      ${targetIdField}: targetId,
      createdAt: now,
      updatedAt: now
    }));
    
    await db.${relation.junctionTable}.bulkAdd(newRelations);
  }`);
    
    // Remove method
    methods.push(`
  /**
   * Remove ${relation.propertyName} from this ${entity.name}
   */
  async remove${methodBaseName}(${camelCase(entity.name)}Id: string, targetIds: string[]): Promise<void> {
    if (targetIds.length === 0) return;
    
    await db.${relation.junctionTable}
      .where('${sourceIdField}')
      .equals(${camelCase(entity.name)}Id)
      .and(item => targetIds.includes(item.${targetIdField}))
      .delete();
  }`);
    
    // Has method
    methods.push(`
  /**
   * Check if ${entity.name} has a specific ${relation.targetEntity}
   */
  async has${methodBaseName.slice(0, -1)}(${camelCase(entity.name)}Id: string, targetId: string): Promise<boolean> {
    const count = await db.${relation.junctionTable}
      .where('[${sourceIdField}+${targetIdField}]')
      .equals([${camelCase(entity.name)}Id, targetId])
      .count();
    
    return count > 0;
  }`);
    
    // Count method
    methods.push(`
  /**
   * Get count of ${relation.propertyName} for this ${entity.name}
   */
  async get${methodBaseName}Count(${camelCase(entity.name)}Id: string): Promise<number> {
    return await db.${relation.junctionTable}
      .where('${sourceIdField}')
      .equals(${camelCase(entity.name)}Id)
      .count();
  }`);
  }
  
  // Generate many-to-one relationship methods (simple resolver)
  for (const relation of manyToOneRelations) {
    const methodName = relation.propertyName.charAt(0).toUpperCase() + relation.propertyName.slice(1);
    const targetTableName = camelToSnakeCase(relation.targetEntity) + 's';
    const foreignKeyField = `${relation.propertyName}Id`;
    
    methods.push(`
  /**
   * Resolve ${relation.propertyName} for a given ID
   */
  async resolve${methodName}(id: string): Promise<any> {
    return await db.${targetTableName}.get(id);
  }`);
  }
  
  // Generate one-to-many relationship methods
  for (const relation of oneToManyRelations) {
    const methodBaseName = relation.propertyName.charAt(0).toUpperCase() + relation.propertyName.slice(1);
    const targetTableName = camelToSnakeCase(relation.targetEntity) + 's';
    const foreignKeyField = `${camelCase(entity.name)}Id`;
    
    methods.push(`
  /**
   * Get ${relation.propertyName} for this ${entity.name}
   */
  async get${methodBaseName}(${camelCase(entity.name)}Id: string): Promise<any[]> {
    return await db.${targetTableName}
      .where('${foreignKeyField}')
      .equals(${camelCase(entity.name)}Id)
      .toArray();
  }`);
    
    methods.push(`
  /**
   * Get count of ${relation.propertyName} for this ${entity.name}
   */
  async get${methodBaseName}Count(${camelCase(entity.name)}Id: string): Promise<number> {
    return await db.${targetTableName}
      .where('${foreignKeyField}')
      .equals(${camelCase(entity.name)}Id)
      .count();
  }`);
  }
  
  return methods.length > 0 ? '\n' + methods.join('\n') + '\n' : '';
}

/**
 * Convert camelCase to snake_case
 */
function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
}

/**
 * Convert PascalCase to camelCase
 */
function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function generateIndexFile(entities: EntityInfo[]): string {
  const imports = entities.map(e => {
    const lowerName = e.name.toLowerCase();
    return `import { ${e.name}DexieService, ${lowerName}DexieService } from './${lowerName}-dexie-service.js';`;
  }).join('\n');
  
  const exports = entities.map(e => {
    const lowerName = e.name.toLowerCase();
    return `  ${e.name}DexieService,
  ${lowerName}DexieService,`;
  }).join('\n');
  
  const serviceMap = entities.map(e => {
    const lowerName = e.name.toLowerCase();
    // Handle special cases where lowercase doesn't match the service name
    const serviceName = e.name === 'StatusDefinition' ? 'statusDefinition' :
                       e.name === 'StatusSet' ? 'statusSet' :
                       e.name === 'TagSet' ? 'tagSet' :
                       lowerName;
    return `  ${serviceName}: ${lowerName}DexieService,`;
  }).join('\n');
  
  return `/**
 * Auto-generated Dexie Domain Services Index
 * 
 * This file exports all Dexie domain services for easy access.
 * 
 * Generated at: ${new Date().toISOString()}
 */

${imports}

// Export all services
export {
${exports}
};

// Export as a single object for convenience
export const dexieDomainServices = {
${serviceMap}
};
`;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  try {
    await generateDexieDomainServices();
  } catch (error) {
    console.error('❌ Error generating Dexie domain services:', error);
    process.exitCode = 1;
  }
}

main().catch(console.error);
// Type guard for entity metadata
function hasRelationships(entity: any): entity is { relationships: RelationshipInfo[] } {
  return entity && Array.isArray(entity.relationships);
}
