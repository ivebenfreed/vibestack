import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mikroOrmConfig from '../mikro-orm.config.js';
import { extractContextFromComment } from '../utils/entity-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

interface EntityInfo {
  name: string;
  tableName: string;
  properties: PropertyInfo[];
  relations: RelationInfo[];
  isBase: boolean;
  extends?: string;
  category?: 'domain' | 'system' | 'auth' | 'junction';
  context?: 'client-only' | 'server-only' | 'shared';
}

interface PropertyInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  columnName: string;
  isPrimary: boolean;
  enum?: string[];
  context?: 'client-only' | 'server-only' | 'shared';
}

interface RelationInfo {
  name: string;
  type: 'ManyToOne' | 'OneToMany' | 'ManyToMany' | 'OneToOne';
  targetEntity: string;
  nullable: boolean;
  mappedBy?: string;
  inversedBy?: string;
  pivotTable?: string;
  context?: 'client-only' | 'server-only' | 'shared';
}

async function extractEntityMetadata(): Promise<EntityInfo[]> {
  const orm = await MikroORM.init(mikroOrmConfig);
  const metadata = orm.getMetadata();
  
  const entities: EntityInfo[] = [];
  
  const allMetadata = Object.values(metadata.getAll());
  for (const meta of allMetadata) {
    // Determine category based on table name and structure
    let category: EntityInfo['category'] = 'domain';
    
    // Check if it's a junction table (typically has only foreign key columns)
    const scalarProps = Object.values(meta.properties).filter(p => p.reference === 'scalar' || p.reference === 'embedded');
    const relationProps = Object.values(meta.properties).filter(p => p.reference !== 'scalar' && p.reference !== 'embedded');
    
    // Junction tables typically have 0 scalar properties (or just composite PK) and 2 relations
    if (relationProps.length === 2 && scalarProps.length === 0) {
      category = 'junction';
    }
    
    // Categorize based on table name patterns
    const tableName = meta.tableName || '';
    if (tableName === 'accounts' || tableName === 'sessions' || tableName === 'verifications') {
      category = 'auth';
    } else if (tableName === 'change_history' || tableName === 'local_changes' || tableName === 'sync_metadata' || tableName === 'migrations') {
      category = 'system';
    }
    
    // Check for client-only or server-only context from entity comment
    const context = extractContextFromComment(meta.comment);
    
    const entity: EntityInfo = {
      name: meta.className,
      tableName: tableName,
      properties: [],
      relations: [],
      isBase: meta.abstract || false,
      extends: meta.extends,
      category,
      context,
    };
    
    // Extract properties and detect enums
    for (const prop of Object.values(meta.properties)) {
      if (prop.reference === 'scalar' || prop.reference === 'embedded') {
        const propInfo: PropertyInfo = {
          name: prop.name,
          type: mapType(prop.type),
          nullable: prop.nullable,
          defaultValue: prop.default,
          columnName: prop.fieldNames?.[0] || prop.name,
          isPrimary: prop.primary || false,
        };
        
        // Check if it's an enum property
        if (prop.enum && prop.items) {
          propInfo.enum = prop.items as string[];
        }
        
        // Check for field-level context from property comment
        const propContext = extractContextFromComment(prop.comment);
        if (propContext !== 'shared') {
          propInfo.context = propContext;
        }
        
        entity.properties.push(propInfo);
      } else {
        // It's a relation
        const relInfo: RelationInfo = {
          name: prop.name,
          type: prop.reference as any,
          targetEntity: prop.type,
          nullable: prop.nullable,
          mappedBy: prop.mappedBy,
          inversedBy: prop.inversedBy,
          pivotTable: prop.pivotTable,
        };
        
        // Check for field-level context from property comment
        const relContext = extractContextFromComment(prop.comment);
        if (relContext !== 'shared') {
          relInfo.context = relContext;
        }
        
        entity.relations.push(relInfo);
      }
    }
    
    entities.push(entity);
  }
  
  await orm.close();
  return entities;
}

function mapType(type: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'text': 'string',
    'number': 'number',
    'bigint': 'number',
    'boolean': 'boolean',
    'Date': 'Date',
    'date': 'Date',
    'datetime': 'Date',
    'json': 'any',
    'jsonb': 'any',
    'uuid': 'string',
    'enum': 'string',
    'array': 'any[]',
  };
  
  return typeMap[type] || 'any';
}

function extractEnums(entities: EntityInfo[]): Map<string, Set<string>> {
  const enums = new Map<string, Set<string>>();
  
  // Scan all properties for actual enum values from metadata
  for (const entity of entities) {
    for (const prop of entity.properties) {
      if (prop.enum && prop.enum.length > 0) {
        // Create enum name from entity + property name
        const enumName = entity.name + prop.name.charAt(0).toUpperCase() + prop.name.slice(1);
        enums.set(enumName, new Set(prop.enum));
      }
    }
  }
  
  // Create enums for common patterns found in the data
  // Look for properties that suggest enum-like behavior
  for (const entity of entities) {
    for (const prop of entity.properties) {
      // If property name suggests it's an enum-like field
      if (prop.type === 'string' && !prop.enum) {
        if (prop.name === 'status' || prop.name === 'legacyStatus') {
          // Generate enum name based on entity
          const enumName = entity.name + 'Status';
          if (!enums.has(enumName)) {
            // We can't know the values without looking at the entity definition
            // So we'll need to read from the actual entity files
          }
        } else if (prop.name === 'priority') {
          const enumName = entity.name + 'Priority';
          // Similar - need to extract from entity definition
        } else if (prop.name === 'role' || prop.name.endsWith('Role')) {
          const enumName = entity.name + 'Role';
          // Similar - need to extract from entity definition
        } else if (prop.name === 'type' || prop.name.endsWith('Type')) {
          const enumName = entity.name + 'Type';
          // Similar - need to extract from entity definition
        }
      }
    }
  }
  
  return enums;
}

function buildTableHierarchy(entities: EntityInfo[]): Record<string, string[]> {
  const hierarchy: Record<string, string[]> = {};
  
  // Initialize all non-base tables
  for (const entity of entities) {
    if (!entity.isBase && entity.tableName) {
      hierarchy[entity.tableName] = [];
    }
  }
  
  // Build hierarchy based on foreign key relationships
  for (const entity of entities) {
    if (entity.isBase || !entity.tableName) continue;
    
    // Find all ManyToOne relations (these indicate parent-child relationships)
    for (const rel of entity.relations) {
      if (rel.type === 'ManyToOne') {
        const parentEntity = entities.find(e => e.name === rel.targetEntity);
        if (parentEntity && !parentEntity.isBase && parentEntity.tableName) {
          // This entity is a child of the parent
          if (!hierarchy[parentEntity.tableName]) {
            hierarchy[parentEntity.tableName] = [];
          }
          if (!hierarchy[parentEntity.tableName].includes(entity.tableName)) {
            hierarchy[parentEntity.tableName].push(entity.tableName);
          }
        }
      }
    }
  }
  
  // Add junction tables to their related entities
  for (const entity of entities) {
    if (entity.category === 'junction' && entity.tableName) {
      // Junction tables are children of both related entities
      for (const rel of entity.relations) {
        const relatedEntity = entities.find(e => e.name === rel.targetEntity);
        if (relatedEntity && !relatedEntity.isBase && relatedEntity.tableName && hierarchy[relatedEntity.tableName]) {
          if (!hierarchy[relatedEntity.tableName].includes(entity.tableName)) {
            hierarchy[relatedEntity.tableName].push(entity.tableName);
          }
        }
      }
    }
  }
  
  return hierarchy;
}

function buildRelationshipConfigs(entities: EntityInfo[]): Record<string, any> {
  const configs: Record<string, any> = {};
  
  for (const entity of entities) {
    if (entity.isBase || entity.category === 'junction' || !entity.tableName) continue;
    
    const relationships: Record<string, any> = {};
    
    for (const rel of entity.relations) {
      const targetEntity = entities.find(e => e.name === rel.targetEntity);
      if (targetEntity && targetEntity.tableName) {
        relationships[rel.name] = {
          type: rel.type,
          target: targetEntity.tableName,
        };
        
        if (rel.pivotTable) {
          relationships[rel.name].through = rel.pivotTable;
        }
      }
    }
    
    if (Object.keys(relationships).length > 0) {
      configs[entity.tableName] = relationships;
    }
  }
  
  return configs;
}

function generateEntityExports(entities: EntityInfo[], forContext: 'client' | 'server'): string {
  let output = '// Generated entities from MikroORM metadata\n\n';
  
  // Extract enums from metadata
  const enums = extractEnums(entities);
  
  // ============================================
  // Enums (as const assertions) - only if we found any
  // ============================================
  if (enums.size > 0) {
    output += '// ============================================\n';
    output += '// Enums (as const assertions)\n';
    output += '// ============================================\n\n';
    
    for (const [enumName, values] of enums) {
      output += `export const ${enumName} = {\n`;
      for (const value of values) {
        const key = value.toUpperCase().replace(/[-\s]/g, '_');
        output += `  ${key}: '${value}',\n`;
      }
      output += '} as const;\n';
      output += `export type ${enumName} = typeof ${enumName}[keyof typeof ${enumName}];\n\n`;
    }
  }
  
  // ============================================
  // Entity Interfaces
  // ============================================
  output += '// ============================================\n';
  output += '// Entity Interfaces\n';
  output += '// ============================================\n\n';
  
  for (const entity of entities) {
    if (entity.isBase) continue;
    
    // Skip entities not meant for this context
    if (forContext === 'client' && entity.context === 'server-only') continue;
    if (forContext === 'server' && entity.context === 'client-only') continue;
    
    output += `export interface ${entity.name} {\n`;
    
    // Add properties
    for (const prop of entity.properties) {
      // Skip properties not meant for this context
      if (forContext === 'client' && prop.context === 'server-only') continue;
      if (forContext === 'server' && prop.context === 'client-only') continue;
      
      const optional = prop.nullable ? '?' : '';
      output += `  ${prop.name}${optional}: ${prop.type};\n`;
    }
    
    // Add relations (simplified - just as any for now)
    for (const rel of entity.relations) {
      // Skip relations not meant for this context
      if (forContext === 'client' && rel.context === 'server-only') continue;
      if (forContext === 'server' && rel.context === 'client-only') continue;
      
      const optional = rel.nullable ? '?' : '';
      output += `  ${rel.name}${optional}: any;\n`;
    }
    
    output += `}\n\n`;
  }
  
  // ============================================
  // Entity Classes (for backward compatibility)
  // ============================================
  output += '// ============================================\n';
  output += '// Entity Classes\n';
  output += '// ============================================\n\n';
  
  for (const entity of entities) {
    if (entity.isBase) continue;
    
    // Skip entities not meant for this context
    if (forContext === 'client' && entity.context === 'server-only') continue;
    if (forContext === 'server' && entity.context === 'client-only') continue;
    
    output += `export class ${entity.name} implements ${entity.name} {}\n`;
  }
  output += '\n';
  
  // ============================================
  // Table Name Mapping
  // ============================================
  output += '// ============================================\n';
  output += '// Table Name Mapping\n';
  output += '// ============================================\n\n';
  
  output += 'export const tableNames = {\n';
  for (const entity of entities) {
    if (!entity.isBase && entity.tableName) {
      // Skip entities not meant for this context
      if (forContext === 'client' && entity.context === 'server-only') continue;
      if (forContext === 'server' && entity.context === 'client-only') continue;
      
      output += `  ${entity.name}: '${entity.tableName}',\n`;
    }
  }
  output += '} as const;\n\n';
  
  // Filter entities for this context
  const contextEntities = entities.filter(e => {
    if (e.isBase) return false;
    if (forContext === 'client' && e.context === 'server-only') return false;
    if (forContext === 'server' && e.context === 'client-only') return false;
    return true;
  });
  
  output += 'export type TableName = keyof typeof tableNames;\n';
  output += `export type EntityType = ${contextEntities.map(e => e.name).join(' | ')};\n\n`;
  
  // ============================================
  // Domain Tables Configuration
  // ============================================
  output += '// ============================================\n';
  output += '// Domain Tables Configuration\n';
  output += '// ============================================\n\n';
  
  // Extract domain tables (non-system, non-auth tables) for this context
  const domainTables = entities
    .filter(e => {
      if (e.isBase || !e.tableName) return false;
      if (e.category !== 'domain' && e.category !== 'junction') return false;
      if (forContext === 'client' && e.context === 'server-only') return false;
      if (forContext === 'server' && e.context === 'client-only') return false;
      return true;
    })
    .map(e => e.tableName)
    .sort();
  
  // Build hierarchy dynamically
  const hierarchy = buildTableHierarchy(entities);
  
  // Build relationship configs
  const relationshipConfigs = buildRelationshipConfigs(entities);
  
  // Build junction table mapping
  const junctionMapping: Record<string, any> = {};
  for (const entity of entities.filter(e => e.category === 'junction')) {
    if (entity.tableName && entity.relations.length >= 2) {
      const source = entities.find(e => e.name === entity.relations[0].targetEntity);
      const target = entities.find(e => e.name === entity.relations[1].targetEntity);
      if (source?.tableName && target?.tableName) {
        junctionMapping[entity.tableName] = {
          source: source.tableName,
          target: target.tableName,
        };
      }
    }
  }
  
  // Generate configuration based on context
  if (forContext === 'client') {
    output += `export const CLIENT_DOMAIN_TABLES = ${JSON.stringify(domainTables, null, 2)};\n\n`;
    output += `export const CLIENT_DOMAIN_TABLE_HIERARCHY = ${JSON.stringify(hierarchy, null, 2)};\n\n`;
    output += `export const CLIENT_RELATIONSHIP_CONFIGS = ${JSON.stringify(relationshipConfigs, null, 2)};\n\n`;
    output += `export const CLIENT_JUNCTION_TABLE_MAPPING = ${JSON.stringify(junctionMapping, null, 2)};\n\n`;
    output += `export function getEntityRelationships(entityName: string): any {
  return CLIENT_RELATIONSHIP_CONFIGS[entityName as keyof typeof CLIENT_RELATIONSHIP_CONFIGS] || {};
}\n\n`;
  } else {
    output += `export const SERVER_DOMAIN_TABLES = ${JSON.stringify(domainTables, null, 2)};\n\n`;
    output += `export const SERVER_DOMAIN_TABLE_HIERARCHY = ${JSON.stringify(hierarchy, null, 2)};\n\n`;
    output += `export const SERVER_RELATIONSHIP_CONFIGS = ${JSON.stringify(relationshipConfigs, null, 2)};\n\n`;
    output += `export const SERVER_TRACKED_TABLES = SERVER_DOMAIN_TABLES;\n\n`;
    output += `export const SERVER_JUNCTION_TABLE_MAPPING = ${JSON.stringify(junctionMapping, null, 2)};\n\n`;
  }
  
  // Generate placeholder enums that the code expects but aren't in metadata
  // These are detected from usage in the codebase
  output += '// Placeholder enums for backward compatibility\n';
  output += '// TODO: Extract these from entity definitions or remove deprecated usage\n';
  
  const placeholderEnums = [
    { name: 'TaskStatus', values: ['open', 'in_progress', 'completed'] },
    { name: 'TaskPriority', values: ['low', 'medium', 'high'] },
    { name: 'ProjectStatus', values: ['active', 'in_progress', 'completed', 'on_hold'] },
    { name: 'UserRole', values: ['user', 'admin', 'super_admin'] },
    { name: 'DependencyType', values: ['finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish'] },
  ];
  
  for (const enumDef of placeholderEnums) {
    // Only add if not already defined
    if (!enums.has(enumDef.name)) {
      output += `export const ${enumDef.name} = {\n`;
      for (const value of enumDef.values) {
        const key = value.toUpperCase().replace(/[-\s]/g, '_');
        output += `  ${key}: '${value}',\n`;
      }
      output += '} as const;\n';
      output += `export type ${enumDef.name} = typeof ${enumDef.name}[keyof typeof ${enumDef.name}];\n\n`;
    }
  }
  
  // Add any missing classes that the code expects
  const expectedClasses = ['ClientMigration'];
  for (const className of expectedClasses) {
    if (!entities.some(e => e.name === className)) {
      output += `export class ${className} {}\n`;
    }
  }
  
  return output;
}

async function main() {
  try {
    console.log('🔍 Extracting MikroORM entity metadata...');
    const entities = await extractEntityMetadata();
    
    console.log(`📦 Found ${entities.length} entities`);
    
    // Generate entities for client and server contexts separately
    const clientEntityExports = generateEntityExports(entities, 'client');
    const serverEntityExports = generateEntityExports(entities, 'server');
    
    // Write to both client and server entities files
    const clientPath = path.join(PACKAGE_ROOT, 'src/generated/client-entities.ts');
    const serverPath = path.join(PACKAGE_ROOT, 'src/generated/server-entities.ts');
    
    await fs.mkdir(path.dirname(clientPath), { recursive: true });
    
    // Write context-specific content to each file
    await fs.writeFile(clientPath, clientEntityExports);
    await fs.writeFile(serverPath, serverEntityExports);
    
    console.log('✅ Generated client-entities.ts');
    console.log('✅ Generated server-entities.ts');
    
  } catch (error) {
    console.error('❌ Error generating entities:', error);
    process.exit(1);
  }
}

main();