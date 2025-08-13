/**
 * LiveStore Schema Generator
 * Generates LiveStore schema definitions from DataForge MikroORM entities
 * Similar to the Dexie schema generator but for LiveStore multi-tenant architecture
 */

import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Import DataForge config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DATAFORGE_ROOT = path.resolve(__dirname, '../../dataforge');
const VERSION_HISTORY_PATH = path.join(PACKAGE_ROOT, 'src/livestore-schema-history.json');
const OUTPUT_PATH = path.join(PACKAGE_ROOT, 'src/generated/livestore-schema.ts');

// Import DataForge MikroORM config
const mikroOrmConfigPath = path.join(DATAFORGE_ROOT, 'dist/mikro-orm.config.js');

interface LiveStoreEntityInfo {
  archetype: string;
  entityName: string;
  tableName: string;
  primaryKey: string;
  indexes: string[];
  fields: LiveStoreField[];
  relationships: LiveStoreRelationship[];
  permissions: string[];
  isMultiTenant: boolean;
  isSystem?: boolean;
  isJunction?: boolean;
  category?: string;
  context?: string;
}

interface LiveStoreField {
  name: string;
  type: LiveStoreFieldType;
  required: boolean;
  unique: boolean;
  indexed: boolean;
  sensitive: boolean;
  description?: string;
  defaultValue?: any;
  validation?: FieldValidation;
}

interface LiveStoreRelationship {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  target: string;
  foreignKey?: string;
  joinTable?: string;
  cascade?: boolean;
}

interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
  custom?: string;
}

type LiveStoreFieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'json' 
  | 'uuid' 
  | 'email' 
  | 'url' 
  | 'text' 
  | 'enum' 
  | 'reference' 
  | 'array';

interface LiveStoreSchemaVersion {
  version: number;
  generatedAt: string;
  schemaHash: string;
  entities: Record<string, LiveStoreEntityInfo>;
  migrations: LiveStoreMigration[];
}

interface LiveStoreMigration {
  version: number;
  description: string;
  up: string;
  down: string;
  entities: string[];
}

interface LiveStoreVersionHistory {
  currentVersion: number;
  versions: LiveStoreSchemaVersion[];
}

/**
 * Load version history from file
 */
async function loadVersionHistory(): Promise<LiveStoreVersionHistory> {
  try {
    const content = await fs.readFile(VERSION_HISTORY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.log('🔍 No LiveStore version history found, starting fresh');
    return {
      currentVersion: 1,
      versions: []
    };
  }
}

/**
 * Save version history to file
 */
async function saveVersionHistory(history: LiveStoreVersionHistory): Promise<void> {
  await fs.writeFile(VERSION_HISTORY_PATH, JSON.stringify(history, null, 2));
}

/**
 * Calculate hash of schema for comparison
 */
function calculateSchemaHash(entities: Record<string, LiveStoreEntityInfo>): string {
  const sortedEntities = Object.keys(entities).sort().reduce((acc, key) => {
    acc[key] = entities[key];
    return acc;
  }, {} as Record<string, LiveStoreEntityInfo>);
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(sortedEntities))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Extract context from entity comments (same as DataForge)
 */
function extractContextFromComment(comment?: string): string | undefined {
  if (!comment) return undefined;
  
  if (comment.includes('context:client-only')) {
    return 'client-only';
  } else if (comment.includes('context:server-only')) {
    return 'server-only';
  }
  
  // Legacy format support
  if (comment === 'client-only') {
    return 'client-only';
  } else if (comment === 'server-only') {
    return 'server-only';
  }
  
  return 'shared';
}

/**
 * Extract category from entity comments (same as DataForge)
 */
function extractCategoryFromComment(comment?: string): string | undefined {
  if (!comment) return 'domain';
  
  if (comment.includes('category:system')) {
    return 'system';
  } else if (comment.includes('category:auth')) {
    return 'auth';
  } else if (comment.includes('category:junction')) {
    return 'junction';
  } else if (comment.includes('category:domain')) {
    return 'domain';
  }
  
  return 'domain';
}

/**
 * Extract property context from comments (same as DataForge)
 */
function extractPropertyContextFromComment(comment?: string): string {
  if (!comment) return 'shared';
  
  if (comment.includes('context:client-only')) {
    return 'client-only';
  } else if (comment.includes('context:server-only')) {
    return 'server-only';
  }
  
  return 'shared';
}

/**
 * Check if an entity is a junction table (same logic as DataForge)
 */
function isJunctionTable(metadata: any): boolean {
  const properties = Object.values(metadata.properties) as any[];
  const scalarProps = properties.filter(p => p.kind === 'scalar' || p.kind === 'enum');
  const relationProps = properties.filter(p => p.kind === 'm:1' || p.kind === '1:1');
  
  // Junction tables typically have minimal scalar properties and exactly 2 relations
  return scalarProps.length <= 1 && relationProps.length === 2;
}

/**
 * Map MikroORM types to LiveStore types
 */
function mapToLiveStoreType(mikroType: string, propertyInfo: any): LiveStoreFieldType {
  const typeMap: Record<string, LiveStoreFieldType> = {
    'string': 'string',
    'text': 'text',
    'number': 'number',
    'integer': 'number',
    'bigint': 'number',
    'float': 'number',
    'double': 'number',
    'decimal': 'number',
    'boolean': 'boolean',
    'date': 'date',
    'datetime': 'date',
    'timestamp': 'date',
    'json': 'json',
    'jsonb': 'json',
    'uuid': 'uuid',
    'enum': 'enum'
  };

  // Check for email pattern
  if (propertyInfo.name === 'email' || propertyInfo.name?.includes('email')) {
    return 'email';
  }

  // Check for URL pattern
  if (propertyInfo.name?.includes('url') || propertyInfo.name?.includes('link')) {
    return 'url';
  }

  // Check for array types
  if (propertyInfo.array) {
    return 'array';
  }

  // Check for foreign keys
  if (propertyInfo.reference) {
    return 'reference';
  }

  return typeMap[mikroType?.toLowerCase()] || 'string';
}

/**
 * Determine if field is sensitive based on name patterns
 */
function isSensitiveField(fieldName: string): boolean {
  const sensitivePatterns = [
    'password', 'token', 'secret', 'key', 'hash',
    'ssn', 'social', 'credit', 'bank', 'account',
    'phone', 'address', 'salary', 'medical'
  ];
  
  return sensitivePatterns.some(pattern => 
    fieldName.toLowerCase().includes(pattern)
  );
}

/**
 * Get default permissions for entity archetype
 */
function getDefaultPermissions(archetype: string): string[] {
  const permissionMap: Record<string, string[]> = {
    'project': ['project.read', 'project.write', 'project.delete', 'project.admin'],
    'task': ['task.read', 'task.write', 'task.delete', 'task.admin'],
    'file': ['file.read', 'file.write', 'file.delete', 'file.admin'],
    'discussion': ['discussion.read', 'discussion.write', 'discussion.delete', 'discussion.admin'],
    'user': ['user.read', 'user.write', 'user.admin'],
    'organization': ['organization.read', 'organization.write', 'organization.admin'],
    'comment': ['comment.read', 'comment.write', 'comment.delete'],
    'tag': ['tag.read', 'tag.write', 'tag.delete'],
    'status': ['status.read', 'status.write', 'status.delete']
  };

  return permissionMap[archetype] || [`${archetype}.read`, `${archetype}.write`];
}

/**
 * Extract LiveStore entities from MikroORM metadata
 */
async function extractLiveStoreEntities(): Promise<Record<string, LiveStoreEntityInfo>> {
  // Dynamically import the MikroORM config
  const { default: mikroOrmConfig } = await import(mikroOrmConfigPath);
  
  const orm = await MikroORM.init(mikroOrmConfig);
  const metadata = orm.getMetadata();
  const entities: Record<string, LiveStoreEntityInfo> = {};

  for (const meta of Object.values(metadata.getAll())) {
    // Skip abstract base classes
    if (meta.abstract) continue;
    
    // Skip server-only entities (they shouldn't be in LiveStore client)
    const context = extractContextFromComment(meta.comment);
    if (context === 'server-only') {
      console.log(`⚠️ Skipping server-only entity: ${meta.className}`);
      continue;
    }
    
    const category = extractCategoryFromComment(meta.comment);
    const archetype = meta.tableName.replace(/_/g, ''); // Convert snake_case to archetype
    
    // Detect junction tables (same as DataForge)
    const isJunction = isJunctionTable(meta);
    
    // Extract fields
    const fields: LiveStoreField[] = [];
    const relationships: LiveStoreRelationship[] = [];
    
    for (const prop of Object.values(meta.properties) as any[]) {
      // Skip server-only properties (same filtering as DataForge)
      const propContext = extractPropertyContextFromComment(prop.comment);
      if (propContext === 'server-only') {
        console.log(`  ⚠️ Skipping server-only property: ${meta.className}.${prop.name}`);
        continue;
      }

      if (prop.reference) {
        // Handle relationships
        relationships.push({
          name: prop.name,
          type: prop.reference === 'm:1' ? 'many-to-one' : 
                prop.reference === '1:m' ? 'one-to-many' :
                prop.reference === '1:1' ? 'one-to-one' : 'many-to-many',
          target: prop.type,
          foreignKey: prop.fieldNames?.[0],
          cascade: prop.cascade?.includes('persist') || prop.cascade?.includes('remove')
        });
      } else {
        // Handle regular fields
        fields.push({
          name: prop.name,
          type: mapToLiveStoreType(prop.type, prop),
          required: !prop.nullable && !prop.optional,
          unique: prop.unique || false,
          indexed: prop.index || prop.primary || false,
          sensitive: isSensitiveField(prop.name),
          description: prop.comment,
          defaultValue: prop.default,
          validation: {
            min: prop.length?.[0],
            max: prop.length?.[1],
            enum: prop.items
          }
        });
      }
    }

    // Extract indexes
    const indexes: string[] = [];
    
    // Add primary key
    const primaryProp = Object.values(meta.properties).find((p: any) => p.primary);
    const primaryKey = primaryProp?.name || 'id';
    
    // Add indexed fields
    for (const prop of Object.values(meta.properties) as any[]) {
      if (prop.index && !prop.primary) {
        indexes.push(prop.name);
      }
      if (prop.unique && !prop.primary) {
        indexes.push(`unique:${prop.name}`);
      }
    }

    // Add composite indexes
    for (const index of meta.indexes) {
      const idx = index as any;
      if (!idx.primary) {
        const properties = Array.isArray(idx.properties) ? idx.properties : [idx.properties];
        const indexName = idx.unique ? `unique:${properties.join(',')}` : properties.join(',');
        indexes.push(indexName);
      }
    }

    const entityInfo: LiveStoreEntityInfo = {
      archetype,
      entityName: meta.className,
      tableName: meta.tableName,
      primaryKey,
      indexes,
      fields,
      relationships,
      permissions: getDefaultPermissions(archetype),
      isMultiTenant: fields.some(f => f.name === 'organizationId') || 
                     relationships.some(r => r.name === 'organization'),
      isSystem: category === 'system',
      isJunction: isJunction,
      category,
      context: context || 'shared'
    };

    entities[archetype] = entityInfo;
  }

  await orm.close();
  return entities;
}

/**
 * Generate TypeScript interfaces for LiveStore entities
 */
function generateEntityInterfaces(entities: Record<string, LiveStoreEntityInfo>): string {
  let output = `// Generated LiveStore entity interfaces from DataForge entities\n\n`;

  for (const [archetype, entity] of Object.entries(entities)) {
    output += `// ${entity.entityName} (${archetype})\n`;
    output += `export interface LiveStore${entity.entityName} {\n`;
    
    for (const field of entity.fields) {
      const optional = field.required ? '' : '?';
      const typeAnnotation = field.type === 'array' ? 'any[]' : 
                           field.type === 'json' ? 'any' :
                           field.type === 'reference' ? 'string' :
                           field.type === 'date' ? 'Date' :
                           field.type;
      
      if (field.description) {
        output += `  /** ${field.description} */\n`;
      }
      if (field.sensitive) {
        output += `  /** @sensitive */\n`;
      }
      
      output += `  ${field.name}${optional}: ${typeAnnotation};\n`;
    }
    
    for (const rel of entity.relationships) {
      const typeAnnotation = rel.type === 'one-to-many' || rel.type === 'many-to-many' 
        ? `LiveStore${rel.target}[]` 
        : `LiveStore${rel.target}`;
      
      output += `  ${rel.name}?: ${typeAnnotation};\n`;
    }
    
    output += `}\n\n`;
  }

  return output;
}

/**
 * Generate LiveStore schema class
 */
function generateLiveStoreSchema(entities: Record<string, LiveStoreEntityInfo>, version: number): string {
  let output = `// Generated LiveStore schema from DataForge entities
// Version ${version} - Generated at ${new Date().toISOString()}

import type * as Entities from './livestore-entities.js';

export interface LiveStoreArchetypes {
${Object.entries(entities).map(([archetype, entity]) => 
  `  ${archetype}: Entities.LiveStore${entity.entityName};`
).join('\n')}
}

export interface LiveStoreEntityDefinition {
  archetype: string;
  entityName: string;
  tableName: string;
  primaryKey: string;
  indexes: string[];
  fields: LiveStoreFieldDefinition[];
  relationships: LiveStoreRelationshipDefinition[];
  permissions: string[];
  isMultiTenant: boolean;
  isSystem?: boolean;
  category?: string;
}

export interface LiveStoreFieldDefinition {
  name: string;
  type: LiveStoreFieldType;
  required: boolean;
  unique: boolean;
  indexed: boolean;
  sensitive: boolean;
  description?: string;
  defaultValue?: any;
  validation?: FieldValidation;
}

export interface LiveStoreRelationshipDefinition {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  target: string;
  foreignKey?: string;
  joinTable?: string;
  cascade?: boolean;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
  custom?: string;
}

export type LiveStoreFieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'json' 
  | 'uuid' 
  | 'email' 
  | 'url' 
  | 'text' 
  | 'enum' 
  | 'reference' 
  | 'array';

export class LiveStoreSchema {
  static readonly VERSION = ${version};
  static readonly GENERATED_AT = '${new Date().toISOString()}';
  
  static readonly ENTITIES: Record<string, LiveStoreEntityDefinition> = {
${Object.entries(entities).map(([archetype, entity]) => 
  `    ${archetype}: ${JSON.stringify(entity, null, 6)}`
).join(',\n')}
  };

  static readonly ARCHETYPES = Object.keys(LiveStoreSchema.ENTITIES) as Array<keyof LiveStoreArchetypes>;
  
  static readonly MULTI_TENANT_ENTITIES = Object.entries(LiveStoreSchema.ENTITIES)
    .filter(([_, entity]) => entity.isMultiTenant)
    .map(([archetype]) => archetype);

  static readonly SYSTEM_ENTITIES = Object.entries(LiveStoreSchema.ENTITIES)
    .filter(([_, entity]) => entity.isSystem)
    .map(([archetype]) => archetype);

  /**
   * Get entity definition by archetype
   */
  static getEntity(archetype: string): LiveStoreEntityDefinition | undefined {
    return LiveStoreSchema.ENTITIES[archetype];
  }

  /**
   * Get all entities for a category
   */
  static getEntitiesByCategory(category: string): LiveStoreEntityDefinition[] {
    return Object.values(LiveStoreSchema.ENTITIES)
      .filter(entity => entity.category === category);
  }

  /**
   * Get all multi-tenant entities
   */
  static getMultiTenantEntities(): LiveStoreEntityDefinition[] {
    return Object.values(LiveStoreSchema.ENTITIES)
      .filter(entity => entity.isMultiTenant);
  }

  /**
   * Get field definition
   */
  static getField(archetype: string, fieldName: string): LiveStoreFieldDefinition | undefined {
    const entity = LiveStoreSchema.getEntity(archetype);
    return entity?.fields.find(field => field.name === fieldName);
  }

  /**
   * Get all sensitive fields for an entity
   */
  static getSensitiveFields(archetype: string): string[] {
    const entity = LiveStoreSchema.getEntity(archetype);
    return entity?.fields.filter(field => field.sensitive).map(field => field.name) || [];
  }

  /**
   * Get default permissions for an entity
   */
  static getPermissions(archetype: string): string[] {
    const entity = LiveStoreSchema.getEntity(archetype);
    return entity?.permissions || [];
  }

  /**
   * Check if archetype exists
   */
  static hasArchetype(archetype: string): boolean {
    return archetype in LiveStoreSchema.ENTITIES;
  }

  /**
   * Validate entity data against schema
   */
  static validateEntity(archetype: string, data: any): { valid: boolean; errors: string[]; } {
    const entity = LiveStoreSchema.getEntity(archetype);
    if (!entity) {
      return { valid: false, errors: [\`Unknown archetype: \${archetype}\`] };
    }

    const errors: string[] = [];

    // Check required fields
    for (const field of entity.fields.filter(f => f.required)) {
      if (!(field.name in data) || data[field.name] === null || data[field.name] === undefined) {
        errors.push(\`Required field missing: \${field.name}\`);
      }
    }

    // Check field types and validation
    for (const field of entity.fields) {
      if (field.name in data && data[field.name] !== null) {
        const value = data[field.name];
        
        // Basic type checking
        switch (field.type) {
          case 'string':
          case 'text':
          case 'email':
          case 'url':
          case 'uuid':
            if (typeof value !== 'string') {
              errors.push(\`Field \${field.name} must be a string\`);
            }
            break;
          case 'number':
            if (typeof value !== 'number') {
              errors.push(\`Field \${field.name} must be a number\`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              errors.push(\`Field \${field.name} must be a boolean\`);
            }
            break;
          case 'date':
            if (!(value instanceof Date) && typeof value !== 'string') {
              errors.push(\`Field \${field.name} must be a Date or date string\`);
            }
            break;
          case 'array':
            if (!Array.isArray(value)) {
              errors.push(\`Field \${field.name} must be an array\`);
            }
            break;
        }

        // Validation rules
        if (field.validation) {
          if (field.validation.min !== undefined && typeof value === 'string' && value.length < field.validation.min) {
            errors.push(\`Field \${field.name} must be at least \${field.validation.min} characters\`);
          }
          if (field.validation.max !== undefined && typeof value === 'string' && value.length > field.validation.max) {
            errors.push(\`Field \${field.name} must be at most \${field.validation.max} characters\`);
          }
          if (field.validation.pattern && typeof value === 'string' && !new RegExp(field.validation.pattern).test(value)) {
            errors.push(\`Field \${field.name} does not match required pattern\`);
          }
          if (field.validation.enum && !field.validation.enum.includes(value)) {
            errors.push(\`Field \${field.name} must be one of: \${field.validation.enum.join(', ')}\`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export default LiveStoreSchema;
`;

  return output;
}

/**
 * Main generation function
 */
async function generateLiveStoreSchemaFile(): Promise<void> {
  console.log('🚀 Generating LiveStore schema from DataForge entities...');

  try {
    // Load version history
    const history = await loadVersionHistory();
    
    // Extract entities from MikroORM
    const entities = await extractLiveStoreEntities();
    
    // Calculate schema hash
    const schemaHash = calculateSchemaHash(entities);
    
    // Check if schema has changed
    const lastVersion = history.versions[history.versions.length - 1];
    if (lastVersion && lastVersion.schemaHash === schemaHash) {
      console.log('✅ Schema unchanged - no generation needed');
      return;
    }
    
    // Increment version
    const newVersion = history.currentVersion + 1;
    
    // Generate entity interfaces
    const entityInterfaces = generateEntityInterfaces(entities);
    
    // Generate schema class
    const schemaClass = generateLiveStoreSchema(entities, newVersion);
    
    // Ensure output directory exists
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    
    // Write entity interfaces
    const entitiesPath = path.join(path.dirname(OUTPUT_PATH), 'livestore-entities.ts');
    await fs.writeFile(entitiesPath, entityInterfaces);
    
    // Write schema class
    await fs.writeFile(OUTPUT_PATH, schemaClass);
    
    // Update version history
    const newVersionEntry: LiveStoreSchemaVersion = {
      version: newVersion,
      generatedAt: new Date().toISOString(),
      schemaHash,
      entities,
      migrations: [] // Migrations will be added separately
    };
    
    history.versions.push(newVersionEntry);
    history.currentVersion = newVersion;
    
    await saveVersionHistory(history);
    
    console.log(`✅ LiveStore schema v${newVersion} generated successfully`);
    console.log(`📁 Entity interfaces: ${entitiesPath}`);
    console.log(`📁 Schema class: ${OUTPUT_PATH}`);
    console.log(`📊 ${Object.keys(entities).length} entities processed`);
    console.log(`🔗 ${Object.values(entities).reduce((acc, e) => acc + e.relationships.length, 0)} relationships found`);
    console.log(`🏢 ${Object.values(entities).filter(e => e.isMultiTenant).length} multi-tenant entities`);
    
  } catch (error) {
    console.error('❌ Error generating LiveStore schema:', error);
    throw error;
  }
}

// Run the generator
if (import.meta.url === `file://${__filename}`) {
  generateLiveStoreSchemaFile().catch(error => {
    console.error('Generation failed:', error);
    process.exit(1);
  });
}

export { generateLiveStoreSchemaFile as generateLiveStoreSchema };