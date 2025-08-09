import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mikroOrmConfig from '../mikro-orm.config.js';

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
}

interface PropertyInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  columnName: string;
  isPrimary: boolean;
}

interface RelationInfo {
  name: string;
  type: 'ManyToOne' | 'OneToMany' | 'ManyToMany' | 'OneToOne';
  targetEntity: string;
  nullable: boolean;
  mappedBy?: string;
  inversedBy?: string;
}

async function extractEntityMetadata(): Promise<EntityInfo[]> {
  const orm = await MikroORM.init(mikroOrmConfig);
  const metadata = orm.getMetadata();
  const entities: EntityInfo[] = [];

  // Get all entity metadata - getAll() returns an object
  const allMetadata = metadata.getAll();
  const metadataArray = Object.values(allMetadata);
  
  for (const meta of metadataArray) {
    // Skip abstract base classes
    if (meta.abstract) continue;

    const entityInfo: EntityInfo = {
      name: meta.className,
      tableName: meta.tableName,
      properties: [],
      relations: [],
      isBase: false,
      extends: meta.extends || undefined,
    };

    // Extract properties - properties is an object, not an array
    for (const prop of Object.values(meta.properties) as any[]) {
      if (!prop.reference || prop.reference === 'scalar' || prop.reference === 'embedded') {
        entityInfo.properties.push({
          name: prop.name,
          type: mapMikroTypeToTS(prop.type),
          nullable: prop.nullable,
          defaultValue: prop.defaultRaw || prop.default,
          columnName: prop.fieldNames?.[0] || prop.name,
          isPrimary: prop.primary,
        });
      } else if (prop.reference) {
        // This is a relation
        entityInfo.relations.push({
          name: prop.name,
          type: mapReferenceToRelationType(prop.reference),
          targetEntity: prop.type,
          nullable: prop.nullable,
          mappedBy: prop.mappedBy,
          inversedBy: prop.inversedBy,
        });
      }
    }

    entities.push(entityInfo);
  }

  await orm.close();
  return entities;
}

function mapMikroTypeToTS(type: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'text': 'string',
    'uuid': 'string',
    'integer': 'number',
    'bigint': 'bigint',
    'boolean': 'boolean',
    'date': 'Date',
    'timestamptz': 'Date',
    'json': 'any',
    'jsonb': 'any',
  };
  return typeMap[type] || 'any';
}

function mapReferenceToRelationType(reference: string): 'ManyToOne' | 'OneToMany' | 'ManyToMany' | 'OneToOne' {
  switch (reference) {
    case 'm:1': return 'ManyToOne';
    case '1:m': return 'OneToMany';
    case 'm:n': return 'ManyToMany';
    case '1:1': return 'OneToOne';
    default: return 'ManyToOne';
  }
}

function generateClientEntities(entities: EntityInfo[]): string {
  let output = `// Generated client entities from MikroORM metadata\n\n`;

  // Generate const assertion enums (hardcoded for now, would extract from decorators)
  output += `// ============================================\n`;
  output += `// Enums (as const assertions)\n`;
  output += `// ============================================\n\n`;
  
  // TaskStatus
  output += `export const TaskStatus = {\n`;
  output += `  OPEN: 'open',\n`;
  output += `  IN_PROGRESS: 'in_progress',\n`;
  output += `  COMPLETED: 'completed'\n`;
  output += `} as const;\n`;
  output += `export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];\n\n`;
  
  // TaskPriority
  output += `export const TaskPriority = {\n`;
  output += `  LOW: 'low',\n`;
  output += `  MEDIUM: 'medium',\n`;
  output += `  HIGH: 'high'\n`;
  output += `} as const;\n`;
  output += `export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];\n\n`;
  
  // ProjectStatus
  output += `export const ProjectStatus = {\n`;
  output += `  ACTIVE: 'active',\n`;
  output += `  IN_PROGRESS: 'in_progress',\n`;
  output += `  COMPLETED: 'completed',\n`;
  output += `  ON_HOLD: 'on_hold'\n`;
  output += `} as const;\n`;
  output += `export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];\n\n`;
  
  output += `// ============================================\n`;
  output += `// Entity Interfaces\n`;
  output += `// ============================================\n\n`;

  // Generate interfaces for each entity
  for (const entity of entities) {
    // Skip base entities for client
    if (entity.name.includes('Base')) continue;

    output += `export interface ${entity.name} {\n`;
    
    // Add properties
    for (const prop of entity.properties) {
      const optional = prop.nullable ? '?' : '';
      output += `  ${prop.name}${optional}: ${prop.type};\n`;
    }

    // Add relation references (just IDs for client)
    for (const rel of entity.relations) {
      if (rel.type === 'ManyToOne' || rel.type === 'OneToOne') {
        const optional = rel.nullable ? '?' : '';
        // Only add Id suffix if the property doesn't already end with Id
        const fieldName = rel.name.endsWith('Id') ? rel.name : `${rel.name}Id`;
        output += `  ${fieldName}${optional}: string;\n`;
      }
    }

    output += `}\n\n`;
  }

  // Generate table name mapping
  output += `export const tableNames = {\n`;
  for (const entity of entities) {
    if (!entity.name.includes('Base')) {
      output += `  ${entity.name}: '${entity.tableName}',\n`;
    }
  }
  output += `} as const;\n\n`;

  // Generate type for table names
  output += `export type TableName = keyof typeof tableNames;\n`;
  output += `export type EntityType = ${entities.filter(e => !e.name.includes('Base')).map(e => e.name).join(' | ')};\n`;

  return output;
}

async function main() {
  try {
    console.log('🔍 Extracting MikroORM entity metadata...');
    const entities = await extractEntityMetadata();
    
    console.log(`📦 Found ${entities.length} entities`);
    
    // Generate client entities
    const clientEntities = generateClientEntities(entities);
    const clientPath = path.join(PACKAGE_ROOT, 'src/generated/client-entities.ts');
    
    await fs.mkdir(path.dirname(clientPath), { recursive: true });
    await fs.writeFile(clientPath, clientEntities);
    
    console.log('✅ Generated client-entities.ts');
    
    // TODO: Generate server entities if needed
    
  } catch (error) {
    console.error('❌ Error generating entities:', error);
    process.exit(1);
  }
}

main();