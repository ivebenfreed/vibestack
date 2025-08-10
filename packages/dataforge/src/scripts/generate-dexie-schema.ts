import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import mikroOrmConfig from '../mikro-orm.config.js';
import { extractContextFromComment, extractCategoryFromComment } from '../utils/entity-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const VERSION_HISTORY_PATH = path.join(PACKAGE_ROOT, 'src/dexie-version-history.json');

interface DexieSchemaInfo {
  tableName: string;
  entityName: string;
  indexes: string[];
  primaryKey: string;
  isJunction?: boolean;
  isSystem?: boolean;
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
    console.log('🔍 No version history found, starting fresh');
    return {
      currentVersion: 1,
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

async function extractDexieSchema(): Promise<DexieSchemaInfo[]> {
  const orm = await MikroORM.init(mikroOrmConfig);
  const metadata = orm.getMetadata();
  const schemas: DexieSchemaInfo[] = [];

  // getAll() returns an object, not an array
  for (const meta of Object.values(metadata.getAll())) {
    // Skip abstract base classes
    if (meta.abstract) continue;
    
    // Skip server-only entities (they shouldn't be in Dexie)
    const context = extractContextFromComment(meta.comment);
    if (context === 'server-only') continue;
    
    // Get category to identify system tables
    const category = extractCategoryFromComment(meta.comment);

    const schema: DexieSchemaInfo = {
      tableName: meta.tableName,
      entityName: meta.className,
      indexes: [],
      primaryKey: 'id',
      isJunction: false,
      isSystem: category === 'system',
    };

    // Add primary key as first index
    const primaryProp = Object.values(meta.properties).find((p: any) => p.primary);
    if (primaryProp) {
      schema.primaryKey = primaryProp.name;
      schema.indexes.push(`++${primaryProp.name}`);
    }

    // Add other indexed fields
    for (const prop of Object.values(meta.properties) as any[]) {
      if (prop.index && !prop.primary) {
        schema.indexes.push(prop.fieldNames[0] || prop.name);
      }
      
      // Add unique constraints as indexes
      if (prop.unique && !prop.primary) {
        schema.indexes.push(`&${prop.fieldNames[0] || prop.name}`);
      }
    }

    // Add composite indexes
    for (const index of meta.indexes) {
      // Type guard for index properties
      const idx = index as any;
      if (!idx.primary) {
        const properties = Array.isArray(idx.properties) ? idx.properties : [idx.properties];
        const fields = properties.join('+');
        if (idx.unique) {
          schema.indexes.push(`&[${fields}]`);
        } else {
          schema.indexes.push(`[${fields}]`);
        }
      }
    }

    // Add foreign key fields as indexes for better query performance
    for (const prop of Object.values(meta.properties) as any[]) {
      if (prop.reference === 'm:1' || prop.reference === '1:1') {
        const fkField = prop.fieldNames[0] || `${prop.name}Id`;
        if (!schema.indexes.some(idx => idx.includes(fkField))) {
          schema.indexes.push(fkField);
        }
      }
    }

    // Add common fields for domain entities
    if (meta.extends && meta.extends.includes('BaseDomainEntity')) {
      const commonIndexes = ['clientId', 'version', 'deleted', 'createdAt', 'updatedAt'];
      for (const field of commonIndexes) {
        if (!schema.indexes.some(idx => idx.includes(field))) {
          schema.indexes.push(field);
        }
      }
    }

    // Special handling for local_changes table - add processedSync index for Dexie
    if (schema.tableName === 'local_changes') {
      if (!schema.indexes.some(idx => idx.includes('processedSync'))) {
        schema.indexes.push('processedSync');
      }
    }

    schemas.push(schema);
  }

  await orm.close();
  return schemas;
}

function generateDexieSchemaFile(schemas: DexieSchemaInfo[], history: VersionHistory): string {
  let output = `// Generated Dexie schema from MikroORM entities
import Dexie, { type Table } from 'dexie';
import type * as Entities from './client-entities.js';

export interface DexieSchema extends Dexie {
`;

  // Add table definitions
  for (const schema of schemas) {
    output += `  ${schema.tableName}: Table<Entities.${schema.entityName}>;\n`;
  }

  output += `}\n\n`;

  // Create the database class
  output += `class VibeStackDatabase extends Dexie implements DexieSchema {\n`;
  
  // Add table properties
  for (const schema of schemas) {
    output += `  ${schema.tableName}!: Table<Entities.${schema.entityName}>;\n`;
  }

  output += `
  constructor() {
    super('VibeStackDB');
    
`;

  // Generate version blocks from history
  if (history.versions.length > 0) {
    for (const version of history.versions) {
      output += `    // Version ${version.version} - Generated at ${version.generatedAt}\n`;
      output += `    this.version(${version.version}).stores({\n`;
      
      for (const [table, indexes] of Object.entries(version.stores)) {
        output += `      ${table}: '${indexes}',\n`;
      }
      
      output += `    });\n\n`;
    }
  } else {
    // If no history, use current schema
    output += `    this.version(${history.currentVersion}).stores({\n`;
    
    for (const schema of schemas) {
      const indexString = schema.indexes.join(', ');
      output += `      ${schema.tableName}: '${indexString}',\n`;
    }
    
    output += `    });\n`;
  }

  output += `  }
}

export const db = new VibeStackDatabase();

// Helper function to clear all data
export async function clearDatabase() {
  const tables = [
`;

  for (const schema of schemas) {
    output += `    '${schema.tableName}',\n`;
  }

  output += `  ];
  
  for (const tableName of tables) {
    await db.table(tableName).clear();
  }
}

// Helper function to get table by name
export function getTable(tableName: string): Table<any> | undefined {
  return (db as any)[tableName];
}

// Export table names for reference
export const dexieTableNames = [
`;

  for (const schema of schemas) {
    output += `  '${schema.tableName}',\n`;
  }

  output += `] as const;

export type DexieTableName = typeof dexieTableNames[number];

// Re-export commonly used constants from client-entities
export { 
  CLIENT_DOMAIN_TABLES,
  CLIENT_DOMAIN_TABLE_HIERARCHY,
  CLIENT_JUNCTION_TABLE_MAPPING 
} from './client-entities.js';

// Dynamically generated table lists based on actual metadata
export const ENTITY_TABLES = [
${schemas.filter(s => !s.isJunction).map(s => `  '${s.tableName}'`).join(',\n')}
] as const;

// System tables (client-side system tables like local_changes)
export const SYSTEM_TABLES = [
${schemas.filter(s => s.isSystem).map(s => `  '${s.tableName}'`).join(',\n')}
] as const;

// Domain tables (non-system entity tables)
export const DOMAIN_TABLES = [
${schemas.filter(s => !s.isSystem && !s.isJunction).map(s => `  '${s.tableName}'`).join(',\n')}
] as const;

// Junction tables (many-to-many relationships)
export const JUNCTION_TABLES = [
${schemas.filter(s => s.isJunction).map(s => `  '${s.tableName}'`).join(',\n')}
] as const;

// Mapping from Dexie table names to database table names
export const DEXIE_TO_DB_TABLE_MAP = {
${schemas.map(s => `  ${s.tableName}: '${s.tableName}'`).join(',\n')}
} as const;
`;

  return output;
}

async function main() {
  try {
    console.log('🔍 Extracting Dexie schema from MikroORM entities...');
    
    // Load version history
    const history = await loadVersionHistory();
    
    const schemas = await extractDexieSchema();
    
    console.log(`📦 Found ${schemas.length} tables for Dexie`);
    
    // Generate current schema stores
    const currentStores: Record<string, string> = {};
    for (const schema of schemas) {
      currentStores[schema.tableName] = schema.indexes.join(', ');
    }
    
    const currentSchemaHash = calculateSchemaHash(currentStores);
    
    // Check if schema has changed
    const lastVersion = history.versions[history.versions.length - 1];
    const hasChanged = !lastVersion || lastVersion.schemaHash !== currentSchemaHash;
    
    if (hasChanged) {
      // Increment version and add to history
      const newVersion = history.currentVersion + 1;
      console.log(`📈 Schema changed, incrementing version from ${history.currentVersion} to ${newVersion}`);
      
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
      console.log(`✅ Schema unchanged, keeping version ${history.currentVersion}`);
    }
    
    // Generate Dexie schema file with version history
    const dexieSchema = generateDexieSchemaFile(schemas, history);
    const schemaPath = path.join(PACKAGE_ROOT, 'src/generated/dexie-schema.ts');
    
    await fs.mkdir(path.dirname(schemaPath), { recursive: true });
    await fs.writeFile(schemaPath, dexieSchema);
    
    console.log('✅ Generated dexie-schema.ts');
    
  } catch (error) {
    console.error('❌ Error generating Dexie schema:', error);
    process.exit(1);
  }
}

main();