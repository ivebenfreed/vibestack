import 'reflect-metadata';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

// Import the generated client entities
import * as ClientEntities from '../generated/client-entities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

// ============================================================================
// Type Definitions
// ============================================================================

interface EntityInfo {
  name: string;
  schema: any;
  tableName: string;
}

interface RelationshipInfo {
  field: string;
  type: 'simple' | 'set-filtered' | 'junction';
  targetEntity: string;
  targetTable: string;
  displayField: string;
  filterConfig?: {
    filterField: string;
    filterType: string;
  };
  junctionConfig?: {
    table: string;
    sourceColumn: string;
    targetColumn: string;
  };
}

// ============================================================================
// Main Generator Function
// ============================================================================

async function generateDexieDomainServices() {
  console.log('[generate-dexie-domain-services] Starting generation...');
  
  // Get entity schemas from the generated client entities
  const entities = extractEntities();
  
  // Filter for domain entities only
  const domainEntities = entities.filter(entity => 
    ClientEntities.CLIENT_DOMAIN_TABLES.includes(`"${entity.tableName}"`)
  );
  
  console.log('Generating domain services for:', domainEntities.map(e => e.name));
  
  // Ensure generated directory exists
  const generatedDir = path.join(PACKAGE_ROOT, 'src/generated');
  const dexieDomainDir = path.join(generatedDir, 'dexie-domain');
  await fs.mkdir(dexieDomainDir, { recursive: true });
  
  // Generate individual domain service files
  for (const entity of domainEntities) {
    const serviceOutput = generateEntityDomainService(entity, domainEntities);
    const serviceFilePath = path.join(dexieDomainDir, `${entity.name.toLowerCase()}-dexie-service.ts`);
    await fs.writeFile(serviceFilePath, serviceOutput);
    console.log(`✅ Generated ${entity.name} domain service`);
  }
  
  // Generate the main export file
  const indexOutput = generateIndexFile(domainEntities);
  const indexPath = path.join(dexieDomainDir, 'index.ts');
  await fs.writeFile(indexPath, indexOutput);
  
  console.log('✅ Generated Dexie domain services index at:', indexPath);
}

// ============================================================================
// Entity Extraction
// ============================================================================

function extractEntities(): EntityInfo[] {
  const entities: EntityInfo[] = [];
  
  // Extract entity schemas and classes from ClientEntities
  for (const [key, value] of Object.entries(ClientEntities)) {
    if (key.endsWith('Schema') && value && typeof value === 'object' && 'options' in value) {
      const entityName = key.replace('Schema', '');
      const schema = value as any;
      entities.push({
        name: entityName,
        schema: schema,
        tableName: schema.options?.tableName || entityName.toLowerCase()
      });
    }
  }
  
  return entities;
}

// ============================================================================
// Relationship Pattern Detection
// ============================================================================

interface FilterableRelationship {
  type: 'direct-field' | 'junction-based';
  childEntity: string;
  parentEntity: string;
  childForeignKey: string;
  filterField?: string; // For direct-field filtering
  junctionTable?: string; // For junction-based filtering
  junctionSourceField?: string;
  junctionTargetField?: string;
  relatedEntity?: string; // The entity we filter by (e.g., Project)
  methodName: string;
}

function detectFilterableRelationships(entity: EntityInfo, allEntities: EntityInfo[]): FilterableRelationship[] {
  const filterableRelationships: FilterableRelationship[] = [];
  
  // Pattern 1: StatusDefinition -> StatusSet (filtered by entityType)
  if (entity.name === 'StatusDefinition') {
    filterableRelationships.push({
      type: 'direct-field',
      childEntity: 'StatusDefinition',
      parentEntity: 'StatusSet',
      childForeignKey: 'statusSetId',
      filterField: 'entityType',
      methodName: 'getStatusDefinitionsForEntityType'
    });
  }
  
  // Pattern 2: Tag -> TagSet -> Project (filtered through junction)
  if (entity.name === 'Tag') {
    filterableRelationships.push({
      type: 'junction-based',
      childEntity: 'Tag',
      parentEntity: 'TagSet',
      childForeignKey: 'tagSetId',
      junctionTable: 'project_tag_sets',
      junctionSourceField: 'projectId',
      junctionTargetField: 'tagSetId',
      relatedEntity: 'Project',
      methodName: 'getTagsForProject'
    });
    
    // Also add direct filtering by TagSet
    filterableRelationships.push({
      type: 'direct-field',
      childEntity: 'Tag',
      parentEntity: 'TagSet',
      childForeignKey: 'tagSetId',
      filterField: 'id',
      methodName: 'getTagsByTagSet'
    });
  }
  
  // Pattern 3: TagSet -> Project (get tag sets for a project)
  if (entity.name === 'TagSet') {
    filterableRelationships.push({
      type: 'junction-based',
      childEntity: 'TagSet',
      parentEntity: 'TagSet', // Self-reference through junction
      childForeignKey: 'id',
      junctionTable: 'project_tag_sets',
      junctionSourceField: 'projectId',
      junctionTargetField: 'tagSetId',
      relatedEntity: 'Project',
      methodName: 'getTagSetsForProject'
    });
  }
  
  return filterableRelationships;
}

// ============================================================================
// Relationship Detection
// ============================================================================

function detectRelationships(entity: EntityInfo): RelationshipInfo[] {
  const relationships: RelationshipInfo[] = [];
  const { name: entityName, schema } = entity;
  
  // Check for special set-filtered relationships
  if (entityName === 'StatusDefinition') {
    relationships.push({
      field: 'statusSetId',
      type: 'set-filtered',
      targetEntity: 'StatusSet',
      targetTable: 'status_sets',
      displayField: 'name',
      filterConfig: {
        filterField: 'entityType',
        filterType: 'context.entityType'
      }
    });
  }
  
  if (entityName === 'Tag') {
    relationships.push({
      field: 'tagSetId', 
      type: 'set-filtered',
      targetEntity: 'TagSet',
      targetTable: 'tag_sets',
      displayField: 'name',
      filterConfig: {
        filterField: 'projectId',
        filterType: 'context.projectId'
      }
    });
  }
  
  // Check for many-to-many relationships from junction table mapping
  const junctionMappings = ClientEntities.CLIENT_JUNCTION_TABLE_MAPPING;
  for (const [junctionTable, config] of Object.entries(junctionMappings)) {
    if (config.sourceEntity === entityName) {
      relationships.push({
        field: config.relationName,
        type: 'junction',
        targetEntity: config.targetEntity,
        targetTable: config.targetEntity.toLowerCase() + 's',
        displayField: getDisplayFieldForEntity(config.targetEntity),
        junctionConfig: {
          table: junctionTable,
          sourceColumn: config.sourceColumn,
          targetColumn: config.targetColumn
        }
      });
    }
  }
  
  // Check for simple foreign key relationships from relations
  if (schema.options?.relations) {
    Object.entries(schema.options.relations).forEach(([relationName, relationDef]: [string, any]) => {
      if (relationDef.type === 'many-to-one') {
        const fieldName = relationDef.joinColumn?.name || `${relationName}Id`;
        
        // Get the target entity from the relation definition
        const targetEntity = typeof relationDef.target === 'function' 
          ? relationDef.target.name 
          : relationDef.target;
        
        // Skip if already handled by special resolvers
        if (!relationships.some(r => r.field === fieldName) && targetEntity) {
          relationships.push({
            field: fieldName,
            type: 'simple',
            targetEntity: targetEntity,
            targetTable: relationDef.inverseSidePropertyPath || targetEntity.toLowerCase() + 's',
            displayField: getDisplayFieldForEntity(targetEntity)
          });
        }
      }
    });
  }
  
  return relationships;
}

function getDisplayFieldForEntity(entityName: string): string {
  const displayFieldMap: Record<string, string> = {
    'User': 'name',
    'Project': 'name',
    'StatusSet': 'name',
    'StatusDefinition': 'label',
    'TagSet': 'name',
    'Tag': 'name',
    'Comment': 'content'
  };
  
  return displayFieldMap[entityName] || 'name';
}

// ============================================================================
// Code Generation
// ============================================================================

function generateEntityDomainService(entity: EntityInfo, allEntities: EntityInfo[]): string {
  const relationships = detectRelationships(entity);
  const filterableRelationships = detectFilterableRelationships(entity, allEntities);
  const lowerName = entity.name.toLowerCase();
  
  // Collect all unique entity types needed for imports
  const importedEntities = new Set<string>();
  importedEntities.add(entity.name);
  relationships.forEach(r => {
    if (r.targetEntity !== entity.name) importedEntities.add(r.targetEntity);
  });
  filterableRelationships.forEach(r => {
    if (r.parentEntity !== entity.name) importedEntities.add(r.parentEntity);
    if (r.childEntity !== entity.name) importedEntities.add(r.childEntity);
  });
  
  const importsList = Array.from(importedEntities).join(', ');
  
  return `/**
 * Auto-generated Dexie Domain Service for ${entity.name}
 * 
 * This file provides CRUD operations and relationship resolvers
 * for the ${entity.name} entity using Dexie.
 * 
 * Generated at: ${new Date().toISOString()}
 */

import { db } from '../dexie-schema.js';
import type { ${importsList} } from '../client-entities.js';
import type { Create${entity.name}Input, Update${entity.name}Input } from '../${entity.name.toLowerCase()}-operations.js';

export interface ${entity.name}RelationshipContext {
  entityType?: string;
  projectId?: string;
  userId?: string;
  currentEntity?: Partial<${entity.name}>;
}

export class ${entity.name}DexieService {
  /**
   * Create a new ${entity.name}
   */
  async create(input: Create${entity.name}Input): Promise<${entity.name}> {
    const id = (globalThis as any).crypto.randomUUID();
    const now = new Date();
    
    const ${lowerName}: ${entity.name} = {
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
  async update(id: string, updates: Update${entity.name}Input): Promise<${entity.name} | undefined> {
    const updatedAt = new Date();
    
    await db.${entity.tableName}.update(id, {
      ...updates,
      updatedAt
    });
    
    return await this.getById(id);
  }

  /**
   * Delete ${entity.name}
   */
  async delete(id: string): Promise<boolean> {
    await db.${entity.tableName}.delete(id);
    return true;
  }

${generateRelationshipMethods(entity, relationships)}${generateFilterableMethods(entity, filterableRelationships)}
}

// Export singleton instance
export const ${lowerName}DexieService = new ${entity.name}DexieService();
`;
}

function generateRelationshipMethods(entity: EntityInfo, relationships: RelationshipInfo[]): string {
  const methods: string[] = [];
  
  // Add special set-filtered resolvers
  const setFilteredRels = relationships.filter(r => r.type === 'set-filtered');
  setFilteredRels.forEach(rel => {
    methods.push(`  /**
   * Get available ${rel.targetEntity} options based on context
   */
  async getAvailable${rel.targetEntity}s(context: ${entity.name}RelationshipContext): Promise<${rel.targetEntity}[]> {
    ${generateSetFilteredResolver(entity, rel)}
  }`);
  });
  
  // Add simple relationship resolvers
  const simpleRels = relationships.filter(r => r.type === 'simple');
  simpleRels.forEach(rel => {
    const methodName = rel.field.replace('Id', '');
    const capitalizedMethod = methodName.charAt(0).toUpperCase() + methodName.slice(1);
    methods.push(`  /**
   * Resolve ${rel.targetEntity} for a given ID
   */
  async resolve${capitalizedMethod}(id: string): Promise<${rel.targetEntity} | undefined> {
    return await db.${rel.targetTable}.get(id);
  }`);
  });
  
  // Add junction relationship resolvers
  const junctionRels = relationships.filter(r => r.type === 'junction');
  junctionRels.forEach(rel => {
    methods.push(`  /**
   * Get ${rel.targetEntity}s for a ${entity.name}
   */
  async get${rel.targetEntity}s(${entity.name.toLowerCase()}Id: string): Promise<${rel.targetEntity}[]> {
    const junctions = await db.${rel.junctionConfig!.table}
      .where('${rel.junctionConfig!.sourceColumn}')
      .equals(${entity.name.toLowerCase()}Id)
      .toArray();
    
    const ${rel.targetEntity.toLowerCase()}Ids = junctions.map(j => j.${rel.junctionConfig!.targetColumn});
    const ${rel.targetEntity.toLowerCase()}s = await db.${rel.targetTable}.bulkGet(${rel.targetEntity.toLowerCase()}Ids);
    
    return ${rel.targetEntity.toLowerCase()}s.filter((item): item is ${rel.targetEntity} => item !== undefined);
  }
  
  /**
   * Set ${rel.targetEntity}s for a ${entity.name}
   */
  async set${rel.targetEntity}s(${entity.name.toLowerCase()}Id: string, ${rel.targetEntity.toLowerCase()}Ids: string[]): Promise<void> {
    await db.transaction('rw', db.${rel.junctionConfig!.table}, async () => {
      // Remove existing relationships
      await db.${rel.junctionConfig!.table}
        .where('${rel.junctionConfig!.sourceColumn}')
        .equals(${entity.name.toLowerCase()}Id)
        .delete();
      
      // Add new relationships
      if (${rel.targetEntity.toLowerCase()}Ids.length > 0) {
        await db.${rel.junctionConfig!.table}.bulkAdd(
          ${rel.targetEntity.toLowerCase()}Ids.map(${rel.targetEntity.toLowerCase()}Id => ({
            ${rel.junctionConfig!.sourceColumn}: ${entity.name.toLowerCase()}Id,
            ${rel.junctionConfig!.targetColumn}: ${rel.targetEntity.toLowerCase()}Id
          }))
        );
      }
    });
  }`);
  });
  
  return methods.length > 0 ? '\n' + methods.join('\n\n') + '\n' : '';
}

function generateFilterableMethods(entity: EntityInfo, filterableRelationships: FilterableRelationship[]): string {
  const methods: string[] = [];
  
  filterableRelationships.forEach(rel => {
    if (rel.type === 'direct-field') {
      // Generate method for direct field filtering
      const paramName = rel.filterField === 'id' ? `${rel.parentEntity.toLowerCase()}Id` : rel.filterField;
      const paramType = rel.filterField === 'id' ? 'string' : 'string'; // Could be enhanced based on field type
      
      methods.push(`  /**
   * Get ${rel.childEntity}s filtered by ${rel.parentEntity} ${rel.filterField}
   */
  async ${rel.methodName}(${paramName}: ${paramType}): Promise<${rel.childEntity}[]> {
    ${rel.filterField === 'id' ? 
      `// Direct filtering by parent ID
    return await db.${entity.tableName}
      .where('${rel.childForeignKey}')
      .equals(${paramName})
      .toArray();` :
      `// Get parent entities filtered by ${rel.filterField}
    const parents = await db.${rel.parentEntity === 'StatusSet' ? 'status_sets' : rel.parentEntity === 'TagSet' ? 'tag_sets' : rel.parentEntity.toLowerCase() + 's'}
      .where('${rel.filterField}')
      .equals(${paramName})
      .toArray();
    
    const parentIds = parents.map(p => p.id);
    if (parentIds.length === 0) return [];
    
    // Get child entities that belong to these parents
    return await db.${entity.tableName}
      .where('${rel.childForeignKey}')
      .anyOf(parentIds)
      .toArray();`}
  }`);
    } else if (rel.type === 'junction-based') {
      // Generate method for junction-based filtering
      const paramName = `${rel.relatedEntity!.toLowerCase()}Id`;
      
      methods.push(`  /**
   * Get ${rel.childEntity}s filtered by ${rel.relatedEntity}
   */
  async ${rel.methodName}(${paramName}: string): Promise<${rel.childEntity}[]> {
    // Get junction records
    const junctions = await db.${rel.junctionTable}
      .where('${rel.junctionSourceField}')
      .equals(${paramName})
      .toArray();
    
    ${rel.childEntity === rel.parentEntity ? 
      `// Self-reference through junction table
    const ${entity.tableName.slice(0, -1)}Ids = junctions.map(j => j.${rel.junctionTargetField});
    if (${entity.tableName.slice(0, -1)}Ids.length === 0) return [];
    
    const ${entity.tableName} = await db.${entity.tableName}.bulkGet(${entity.tableName.slice(0, -1)}Ids);
    return ${entity.tableName}.filter((item): item is ${rel.childEntity} => item !== undefined);` :
      `// Get parent entities from junction
    const parentIds = junctions.map(j => j.${rel.junctionTargetField});
    if (parentIds.length === 0) return [];
    
    // Get child entities that belong to these parents
    return await db.${entity.tableName}
      .where('${rel.childForeignKey}')
      .anyOf(parentIds)
      .toArray();`}
  }`);
    }
  });
  
  return methods.length > 0 ? '\n' + methods.join('\n\n') + '\n' : '';
}

function generateSetFilteredResolver(entity: EntityInfo, rel: RelationshipInfo): string {
  if (entity.name === 'StatusDefinition' && rel.targetEntity === 'StatusSet') {
    return `    // Filter StatusSets by entityType from context
    const entityType = context.entityType || 'task';
    
    const statusSets = await db.status_sets
      .where('entityType')
      .equals(entityType)
      .toArray();
    
    // Additional filtering for active sets
    return statusSets.filter(set => set.isActive !== false);`;
  }
  
  if (entity.name === 'Tag' && rel.targetEntity === 'TagSet') {
    return `    // Filter TagSets based on project context
    let tagSets: ${rel.targetEntity}[] = [];
    
    if (context.projectId) {
      // Get tag sets associated with the project
      const projectTagSets = await db.project_tag_sets
        .where('projectId')
        .equals(context.projectId)
        .toArray();
      
      const tagSetIds = projectTagSets.map(pts => pts.tagSetId);
      tagSets = await db.tag_sets.bulkGet(tagSetIds);
      tagSets = tagSets.filter((set): set is ${rel.targetEntity} => set !== undefined);
    } else {
      // Get all active tag sets
      tagSets = await db.tag_sets
        .where('isActive')
        .equals(true)
        .toArray();
    }
    
    return tagSets;`;
  }
  
  // Default implementation
  return `    // TODO: Implement set-filtered resolver for ${rel.targetEntity}
    return [];`;
}

function generateIndexFile(entities: EntityInfo[]): string {
  const imports = entities.map(e => {
    const lowerName = e.name.toLowerCase();
    return `import { ${e.name}DexieService, ${lowerName}DexieService } from './${lowerName}-dexie-service.js';`;
  }).join('\n');
  
  const exports = entities.map(e => {
    const lowerName = e.name.toLowerCase();
    return `  ${lowerName}: ${lowerName}DexieService,`;
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
${entities.map(e => `  ${e.name}DexieService,\n  ${e.name.toLowerCase()}DexieService`).join(',\n')}
};

// Export as a single object for convenience
export const dexieDomainServices = {
${exports}
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