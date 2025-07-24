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
  await fs.mkdir(generatedDir, { recursive: true });
  
  // Generate the domain services export file
  const output = generateDomainServicesFile(domainEntities);
  const outputPath = path.join(generatedDir, 'dexie-domain-services.ts');
  await fs.writeFile(outputPath, output);
  
  console.log('✅ Generated Dexie domain services at:', outputPath);
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

function generateDomainServicesFile(entities: EntityInfo[]): string {
  const entityImports = entities.map(e => e.name).join(', ');
  
  const relationshipResolvers = generateRelationshipResolvers(entities);
  const serviceClasses = generateServiceClasses(entities);
  const exports = generateExports(entities);
  
  return `/**
 * Auto-generated Dexie Domain Service Extensions
 * 
 * This file provides relationship resolvers and enhanced domain services
 * for Dexie-based entities. It complements the existing domain services
 * in the app with DataForge-aware relationship resolution.
 * 
 * Generated at: ${new Date().toISOString()}
 */

import type { ${entityImports} } from './client-entities.js';

// ============================================================================
// Relationship Resolver Types
// ============================================================================

export interface ResolverContext {
  entityType?: string;
  projectId?: string;
  userId?: string;
  [key: string]: any;
}

export interface RelationshipResolver<T = any> {
  resolve(ids: string[], context?: ResolverContext): Promise<Map<string, T>>;
  resolveAvailable(context: ResolverContext): Promise<T[]>;
}

// ============================================================================
// Relationship Resolvers
// ============================================================================

${relationshipResolvers}

// ============================================================================
// Enhanced Domain Service Interfaces
// ============================================================================

${serviceClasses}

// ============================================================================
// Exports
// ============================================================================

${exports}
`;
}

function generateRelationshipResolvers(entities: EntityInfo[]): string {
  const resolvers: string[] = [];
  
  // Generate resolvers for each entity that has special relationships
  entities.forEach(entity => {
    const relationships = detectRelationships(entity);
    const setFilteredRels = relationships.filter(r => r.type === 'set-filtered');
    
    if (setFilteredRels.length > 0) {
      resolvers.push(`/**
 * Relationship resolver for ${entity.name}
 */
export const ${entity.name.toLowerCase()}Resolvers = {
${setFilteredRels.map(rel => `  /**
   * Resolve available ${rel.targetEntity} options based on context
   */
  async resolve${rel.targetEntity}Options(context: ResolverContext): Promise<${rel.targetEntity}[]> {
    // This would be implemented in the actual domain service
    // using Dexie queries with the filter configuration:
    // Filter by ${rel.filterConfig?.filterField} = ${rel.filterConfig?.filterType}
    return [];
  }`).join(',\n\n')}
};`);
    }
  });
  
  return resolvers.join('\n\n');
}

function generateServiceClasses(entities: EntityInfo[]): string {
  const interfaces: string[] = [];
  
  entities.forEach(entity => {
    const relationships = detectRelationships(entity);
    
    interfaces.push(`/**
 * Enhanced interface for ${entity.name} domain service
 */
export interface ${entity.name}DomainServiceInterface {
  // Standard CRUD operations (implemented in app domain services)
  createUI(input: any): Promise<${entity.name}>;
  updateUI(id: string, updates: any): Promise<${entity.name}>;
  deleteUI(id: string): Promise<boolean>;
  
  // Relationship resolvers
${relationships.map(rel => {
  if (rel.type === 'set-filtered') {
    return `  resolve${rel.targetEntity}Options(context: ResolverContext): Promise<${rel.targetEntity}[]>;`;
  } else if (rel.type === 'simple') {
    // Use the relation field name for the method name
    const methodName = rel.field.replace('Id', '');
    const capitalizedMethod = methodName.charAt(0).toUpperCase() + methodName.slice(1);
    return `  resolve${capitalizedMethod}(id: string): Promise<${rel.targetEntity} | null>;`;
  } else if (rel.type === 'junction') {
    return `  resolve${rel.targetEntity}s(entityId: string): Promise<${rel.targetEntity}[]>;`;
  }
  return '';
}).filter(Boolean).join('\n')}
}`);
  });
  
  return interfaces.join('\n\n');
}

function generateExports(entities: EntityInfo[]): string {
  return `// Export resolver collections
export const domainResolvers = {
${entities.map(e => {
  const relationships = detectRelationships(e);
  if (relationships.some(r => r.type === 'set-filtered')) {
    return `  ${e.name.toLowerCase()}: ${e.name.toLowerCase()}Resolvers,`;
  }
  return null;
}).filter(Boolean).join('\n')}
};

// Export relationship metadata for runtime use
export const RELATIONSHIP_METADATA = {
${entities.map(entity => {
  const relationships = detectRelationships(entity);
  if (relationships.length > 0) {
    return `  ${entity.name}: ${JSON.stringify(relationships, null, 4).split('\n').map((line, i) => i === 0 ? line : '  ' + line).join('\n')},`;
  }
  return null;
}).filter(Boolean).join('\n')}
};`;
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