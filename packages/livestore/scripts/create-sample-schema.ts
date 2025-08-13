/**
 * Create a sample LiveStore schema to demonstrate the system
 * This works independently of DataForge to show the schema structure
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(PACKAGE_ROOT, 'src/generated/sample-livestore-schema.ts');

// Sample LiveStore entities based on the VibeStack domain
const sampleEntities = {
  project: {
    archetype: 'project',
    entityName: 'Project',
    tableName: 'project',
    primaryKey: 'id',
    indexes: ['++id', 'organizationId', 'ownerId', 'status', 'createdAt'],
    fields: [
      {
        name: 'id',
        type: 'uuid',
        required: true,
        unique: true,
        indexed: true,
        sensitive: false,
        description: 'Unique project identifier'
      },
      {
        name: 'organizationId',
        type: 'uuid',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Organization this project belongs to'
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Project name',
        validation: { min: 1, max: 255 }
      },
      {
        name: 'description',
        type: 'text',
        required: false,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Project description'
      },
      {
        name: 'status',
        type: 'enum',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Current project status',
        validation: { enum: ['active', 'completed', 'on_hold', 'archived'] }
      },
      {
        name: 'ownerId',
        type: 'uuid',
        required: false,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Project owner ID'
      },
      {
        name: 'createdAt',
        type: 'date',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Creation timestamp'
      },
      {
        name: 'updatedAt',
        type: 'date',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Last update timestamp'
      }
    ],
    relationships: [
      {
        name: 'owner',
        type: 'many-to-one',
        target: 'User',
        foreignKey: 'ownerId'
      },
      {
        name: 'tasks',
        type: 'one-to-many',
        target: 'Task'
      },
      {
        name: 'organization',
        type: 'many-to-one',
        target: 'Organization',
        foreignKey: 'organizationId'
      }
    ],
    permissions: ['project.read', 'project.write', 'project.delete', 'project.admin'],
    isMultiTenant: true,
    isSystem: false,
    category: 'domain'
  },
  task: {
    archetype: 'task',
    entityName: 'Task',
    tableName: 'task',
    primaryKey: 'id',
    indexes: ['++id', 'organizationId', 'projectId', 'assigneeId', 'status', 'priority', 'dueDate'],
    fields: [
      {
        name: 'id',
        type: 'uuid',
        required: true,
        unique: true,
        indexed: true,
        sensitive: false,
        description: 'Unique task identifier'
      },
      {
        name: 'organizationId',
        type: 'uuid',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Organization this task belongs to'
      },
      {
        name: 'projectId',
        type: 'uuid',
        required: false,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Project this task belongs to'
      },
      {
        name: 'title',
        type: 'string',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Task title',
        validation: { min: 1, max: 255 }
      },
      {
        name: 'description',
        type: 'text',
        required: false,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Task description'
      },
      {
        name: 'status',
        type: 'enum',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Current task status',
        validation: { enum: ['todo', 'in_progress', 'review', 'done', 'blocked'] }
      },
      {
        name: 'priority',
        type: 'enum',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Task priority',
        validation: { enum: ['low', 'medium', 'high', 'urgent'] }
      },
      {
        name: 'assigneeId',
        type: 'uuid',
        required: false,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Assigned user ID'
      },
      {
        name: 'dueDate',
        type: 'date',
        required: false,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Task due date'
      },
      {
        name: 'estimatedDuration',
        type: 'number',
        required: false,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Estimated duration in minutes'
      },
      {
        name: 'createdAt',
        type: 'date',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Creation timestamp'
      },
      {
        name: 'updatedAt',
        type: 'date',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Last update timestamp'
      }
    ],
    relationships: [
      {
        name: 'project',
        type: 'many-to-one',
        target: 'Project',
        foreignKey: 'projectId'
      },
      {
        name: 'assignee',
        type: 'many-to-one',
        target: 'User',
        foreignKey: 'assigneeId'
      },
      {
        name: 'comments',
        type: 'one-to-many',
        target: 'Comment'
      },
      {
        name: 'organization',
        type: 'many-to-one',
        target: 'Organization',
        foreignKey: 'organizationId'
      }
    ],
    permissions: ['task.read', 'task.write', 'task.delete', 'task.admin'],
    isMultiTenant: true,
    isSystem: false,
    category: 'domain'
  },
  user: {
    archetype: 'user',
    entityName: 'User',
    tableName: 'user',
    primaryKey: 'id',
    indexes: ['++id', '&email', 'role', 'createdAt'],
    fields: [
      {
        name: 'id',
        type: 'uuid',
        required: true,
        unique: true,
        indexed: true,
        sensitive: false,
        description: 'Unique user identifier'
      },
      {
        name: 'email',
        type: 'email',
        required: true,
        unique: true,
        indexed: true,
        sensitive: true,
        description: 'User email address'
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'User display name',
        validation: { min: 1, max: 255 }
      },
      {
        name: 'image',
        type: 'url',
        required: false,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'User avatar image URL'
      },
      {
        name: 'role',
        type: 'enum',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'User role',
        validation: { enum: ['user', 'admin', 'super_admin'] }
      },
      {
        name: 'emailVerified',
        type: 'boolean',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Whether email is verified',
        defaultValue: false
      },
      {
        name: 'isSuperAdmin',
        type: 'boolean',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Whether user is super admin',
        defaultValue: false
      },
      {
        name: 'createdAt',
        type: 'date',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Creation timestamp'
      },
      {
        name: 'updatedAt',
        type: 'date',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Last update timestamp'
      }
    ],
    relationships: [
      {
        name: 'assignedTasks',
        type: 'one-to-many',
        target: 'Task'
      },
      {
        name: 'ownedProjects',
        type: 'one-to-many',
        target: 'Project'
      },
      {
        name: 'comments',
        type: 'one-to-many',
        target: 'Comment'
      }
    ],
    permissions: ['user.read', 'user.write', 'user.admin'],
    isMultiTenant: false,
    isSystem: false,
    category: 'identity'
  },
  organization: {
    archetype: 'organization',
    entityName: 'Organization',
    tableName: 'organization',
    primaryKey: 'id',
    indexes: ['++id', '&slug', 'tier', 'createdAt'],
    fields: [
      {
        name: 'id',
        type: 'uuid',
        required: true,
        unique: true,
        indexed: true,
        sensitive: false,
        description: 'Unique organization identifier'
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Organization name',
        validation: { min: 1, max: 255 }
      },
      {
        name: 'slug',
        type: 'string',
        required: true,
        unique: true,
        indexed: true,
        sensitive: false,
        description: 'Organization URL slug',
        validation: { pattern: '^[a-z0-9-]+$' }
      },
      {
        name: 'description',
        type: 'text',
        required: false,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Organization description'
      },
      {
        name: 'tier',
        type: 'enum',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Organization tier',
        validation: { enum: ['free', 'pro', 'enterprise'] },
        defaultValue: 'free'
      },
      {
        name: 'settings',
        type: 'json',
        required: false,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Organization settings',
        defaultValue: {}
      },
      {
        name: 'createdAt',
        type: 'date',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'Creation timestamp'
      },
      {
        name: 'updatedAt',
        type: 'date',
        required: true,
        unique: false,
        indexed: false,
        sensitive: false,
        description: 'Last update timestamp'
      }
    ],
    relationships: [
      {
        name: 'projects',
        type: 'one-to-many',
        target: 'Project'
      },
      {
        name: 'tasks',
        type: 'one-to-many',
        target: 'Task'
      }
    ],
    permissions: ['organization.read', 'organization.write', 'organization.admin'],
    isMultiTenant: false,
    isSystem: false,
    category: 'tenant'
  },
  // Server-only entity (would be filtered out in real implementation)
  account: {
    archetype: 'account',
    entityName: 'Account',
    tableName: 'account',
    primaryKey: 'id',
    indexes: ['++id', 'userId', 'type', 'provider'],
    fields: [
      {
        name: 'id',
        type: 'uuid',
        required: true,
        unique: true,
        indexed: true,
        sensitive: false,
        description: 'Unique account identifier'
      },
      {
        name: 'userId',
        type: 'uuid',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'User this account belongs to'
      },
      {
        name: 'type',
        type: 'string',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'OAuth provider type'
      },
      {
        name: 'provider',
        type: 'string',
        required: true,
        unique: false,
        indexed: true,
        sensitive: false,
        description: 'OAuth provider name'
      },
      {
        name: 'providerAccountId',
        type: 'string',
        required: true,
        unique: false,
        indexed: false,
        sensitive: true,
        description: 'Provider account ID'
      },
      {
        name: 'accessToken',
        type: 'string',
        required: false,
        unique: false,
        indexed: false,
        sensitive: true,
        description: 'OAuth access token'
      },
      {
        name: 'refreshToken',
        type: 'string',
        required: false,
        unique: false,
        indexed: false,
        sensitive: true,
        description: 'OAuth refresh token'
      }
    ],
    relationships: [
      {
        name: 'user',
        type: 'many-to-one',
        target: 'User',
        foreignKey: 'userId'
      }
    ],
    permissions: ['account.admin'], // Very restricted permissions
    isMultiTenant: false,
    isSystem: false,
    category: 'auth',
    context: 'server-only', // This marks it as server-only
    isServerOnly: true
  }
};

function generateEntityInterfaces(entities: typeof sampleEntities): string {
  let output = `// Generated LiveStore entity interfaces\n// Client-side entities only (server-only entities filtered out)\n\n`;

  for (const [archetype, entity] of Object.entries(entities)) {
    // Skip server-only entities (same filtering as DataForge)
    if (entity.context === 'server-only' || (entity as any).isServerOnly) {
      console.log(`⚠️ Filtering out server-only entity: ${entity.entityName}`);
      continue;
    }
    output += `// ${entity.entityName} (${archetype})\n`;
    output += `export interface LiveStore${entity.entityName} {\n`;
    
    for (const field of entity.fields) {
      const optional = field.required ? '' : '?';
      const typeAnnotation = field.type === 'array' ? 'any[]' : 
                           field.type === 'json' ? 'any' :
                           field.type === 'reference' ? 'string' :
                           field.type === 'date' ? 'Date' :
                           field.type === 'email' ? 'string' :
                           field.type === 'url' ? 'string' :
                           field.type === 'uuid' ? 'string' :
                           field.type === 'enum' ? 'string' :
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
      const typeAnnotation = rel.type === 'one-to-many' 
        ? `LiveStore${rel.target}[]` 
        : `LiveStore${rel.target}`;
      
      output += `  ${rel.name}?: ${typeAnnotation};\n`;
    }
    
    output += `}\n\n`;
  }

  return output;
}

function generateLiveStoreSchema(entities: typeof sampleEntities, version: number): string {
  // Filter out server-only entities before generating schema
  const clientEntities = Object.fromEntries(
    Object.entries(entities).filter(([_, entity]) => 
      entity.context !== 'server-only' && !(entity as any).isServerOnly
    )
  );
  
  console.log(`📊 Filtered ${Object.keys(entities).length} entities down to ${Object.keys(clientEntities).length} client entities`);
  
  const entityInterfaces = generateEntityInterfaces(entities);
  
  return `// Generated LiveStore schema - Sample Implementation
// Version ${version} - Generated at ${new Date().toISOString()}

import type * as Entities from './sample-livestore-entities.js';

export interface LiveStoreArchetypes {
${Object.entries(clientEntities).map(([archetype, entity]) => 
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
${Object.entries(clientEntities).map(([archetype, entity]) => 
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
          case 'enum':
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

  /**
   * Get organization-scoped query for entity
   */
  static getOrganizationQuery(archetype: string, organizationId: string): any {
    const entity = LiveStoreSchema.getEntity(archetype);
    if (!entity?.isMultiTenant) {
      return {};
    }
    return { organizationId };
  }

  /**
   * Check if user can access entity based on organization
   */
  static canAccessEntity(archetype: string, entityData: any, userOrganizationId: string): boolean {
    const entity = LiveStoreSchema.getEntity(archetype);
    if (!entity?.isMultiTenant) {
      return true; // Non-tenant entities are globally accessible
    }
    return entityData.organizationId === userOrganizationId;
  }

  /**
   * Get all archetypes for a category
   */
  static getArchetypesByCategory(category: string): string[] {
    return Object.entries(LiveStoreSchema.ENTITIES)
      .filter(([_, entity]) => entity.category === category)
      .map(([archetype]) => archetype);
  }

  /**
   * Get entity relationship definitions
   */
  static getRelationships(archetype: string): LiveStoreRelationshipDefinition[] {
    const entity = LiveStoreSchema.getEntity(archetype);
    return entity?.relationships || [];
  }

  /**
   * Get indexed fields for an entity
   */
  static getIndexedFields(archetype: string): string[] {
    const entity = LiveStoreSchema.getEntity(archetype);
    return entity?.fields.filter(field => field.indexed).map(field => field.name) || [];
  }
}

export default LiveStoreSchema;
`;
}

async function createSampleSchema(): Promise<void> {
  console.log('🚀 Creating sample LiveStore schema...');
  
  try {
    // Generate entity interfaces
    const entityInterfaces = generateEntityInterfaces(sampleEntities);
    
    // Generate schema class
    const schemaClass = generateLiveStoreSchema(sampleEntities, 1);
    
    // Ensure output directory exists
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    
    // Write entity interfaces
    const entitiesPath = path.join(path.dirname(OUTPUT_PATH), 'sample-livestore-entities.ts');
    await fs.writeFile(entitiesPath, entityInterfaces);
    
    // Write schema class
    await fs.writeFile(OUTPUT_PATH, schemaClass);
    
    console.log(`✅ Sample LiveStore schema generated successfully`);
    console.log(`📁 Entity interfaces: ${entitiesPath}`);
    console.log(`📁 Schema class: ${OUTPUT_PATH}`);
    console.log(`📊 ${Object.keys(sampleEntities).length} entities generated`);
    console.log(`🔗 ${Object.values(sampleEntities).reduce((acc, e) => acc + e.relationships.length, 0)} relationships defined`);
    console.log(`🏢 ${Object.values(sampleEntities).filter(e => e.isMultiTenant).length} multi-tenant entities`);
    
  } catch (error) {
    console.error('❌ Error creating sample schema:', error);
    throw error;
  }
}

// Run the generator
if (import.meta.url === `file://${__filename}`) {
  createSampleSchema().catch(error => {
    console.error('Generation failed:', error);
    process.exit(1);
  });
}

export { createSampleSchema };