#!/usr/bin/env node
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

// ============================================================================
// Main Generation Function
// ============================================================================

async function generateDexieDomainServices() {
  console.log('[generate-dexie-domain-services] Starting generation...');
  
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
  const mappingLines = tableMapMatch[1].split(',').map(line => line.trim()).filter(line => line);
  mappingLines.forEach(line => {
    const match = line.match(/['"](.+?)['"]\s*:\s*['"](.+?)['"]/);
    if (match) {
      tableToEntityMap[match[1]] = match[2];
    }
  });
  
  // Extract domain tables by checking CLIENT_DOMAIN_TABLES
  const domainTablesMatch = schemaContent.match(/export const CLIENT_DOMAIN_TABLES = \[([\s\S]*?)\] as const;/);
  let domainTables: string[] = [];
  
  if (domainTablesMatch) {
    domainTables = domainTablesMatch[1]
      .split(',')
      .map(t => t.trim().replace(/['"]/g, ''))
      .filter(t => t);
  } else {
    // Fallback: exclude known system tables
    const systemTables = ['client_migration_status', 'local_changes', 'sync_metadata'];
    domainTables = Object.keys(tableToEntityMap).filter(t => !systemTables.includes(t));
  }
  
  // Convert table names to entity info using the map
  const entities = domainTables.map(tableName => ({
    name: tableToEntityMap[tableName] || tableNameToEntityName(tableName),
    tableName: tableName
  }));
  
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

function generateEntityDomainService(entity: { name: string; tableName: string }): string {
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

export interface ${entity.name}RelationshipContext {
  entityType?: string;
  projectId?: string;
  userId?: string;
  currentEntity?: any;
}

export class ${entity.name}DexieService {
  /**
   * Create a new ${entity.name}
   */
  async create(input: any): Promise<any> {
    const id = (globalThis as any).crypto.randomUUID();
    const now = new Date();
    
    const ${lowerName} = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.${entity.tableName}.add(${lowerName});
    return ${lowerName};
  }

  /**
   * Get ${entity.name} by ID
   */
  async getById(id: string): Promise<any> {
    return await db.${entity.tableName}.get(id);
  }

  /**
   * Get all ${entity.name}s
   */
  async getAll(): Promise<any[]> {
    return await db.${entity.tableName}.toArray();
  }

  /**
   * Update ${entity.name}
   */
  async update(id: string, updates: any): Promise<any> {
    const updatedAt = new Date();
    
    await db.${entity.tableName}.update(id, { ...updates, updatedAt });
    
    return await this.getById(id);
  }

  /**
   * Delete ${entity.name}
   */
  async delete(id: string): Promise<boolean> {
    await db.${entity.tableName}.delete(id);
    return true;
  }
${generateSpecialMethods(entity)}
}

// Export singleton instance
export const ${lowerName}DexieService = new ${entity.name}DexieService();
`;
}

function generateSpecialMethods(entity: { name: string; tableName: string }): string {
  const methods: string[] = [];
  
  // Add special methods for specific entities
  // These could be made more dynamic by reading relationship metadata
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
  
  if (entity.name === 'Project') {
    methods.push(`
  /**
   * Resolve User for a given ID
   */
  async resolveOwner(id: string): Promise<any> {
    return await db.users.get(id);
  }

  /**
   * Get Users for a Project
   */
  async getUsers(projectId: string): Promise<any[]> {
    const junctions = await db.project_members
      .where('projectId')
      .equals(projectId)
      .toArray();
    
    const userIds = junctions.map(j => j.userId);
    const users = await db.users.bulkGet(userIds);
    
    return users.filter(u => u !== undefined);
  }
  
  /**
   * Set Users for a Project
   */
  async setUsers(projectId: string, userIds: string[]): Promise<void> {
    await db.transaction('rw', db.project_members, async () => {
      // Remove existing relationships
      await db.project_members
        .where('projectId')
        .equals(projectId)
        .delete();
      
      // Add new relationships
      if (userIds.length > 0) {
        await db.project_members.bulkAdd(
          userIds.map(userId => ({
            projectId: projectId,
            userId: userId,
            role: 'member'
          }))
        );
      }
    });
  }`);
  }
  
  if (entity.name === 'Task') {
    methods.push(`
  /**
   * Get Tags for a Task
   */
  async getTags(taskId: string): Promise<any[]> {
    const junctions = await db.task_tags
      .where('taskId')
      .equals(taskId)
      .toArray();
    
    const tagIds = junctions.map(j => j.tagId);
    const tags = await db.tags.bulkGet(tagIds);
    
    return tags.filter(t => t !== undefined);
  }
  
  /**
   * Set Tags for a Task
   */
  async setTags(taskId: string, tagIds: string[]): Promise<void> {
    await db.transaction('rw', db.task_tags, async () => {
      // Remove existing relationships
      await db.task_tags
        .where('taskId')
        .equals(taskId)
        .delete();
      
      // Add new relationships
      if (tagIds.length > 0) {
        await db.task_tags.bulkAdd(
          tagIds.map(tagId => ({
            taskId: taskId,
            tagId: tagId
          }))
        );
      }
    });
  }`);
  }
  
  return methods.length > 0 ? '\n' + methods.join('\n') + '\n' : '';
}

function generateIndexFile(entities: { name: string; tableName: string }[]): string {
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
  
  const typeExports = entities.map(e => 
    `export type { ${e.name}RelationshipContext } from './${e.name.toLowerCase()}-dexie-service.js';`
  ).join('\n');
  
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

// Re-export types
${typeExports}
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