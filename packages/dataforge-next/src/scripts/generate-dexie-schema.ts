import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mikroOrmConfig from '../mikro-orm.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

interface DexieSchemaInfo {
  tableName: string;
  entityName: string;
  indexes: string[];
  primaryKey: string;
}

async function extractDexieSchema(): Promise<DexieSchemaInfo[]> {
  const orm = await MikroORM.init(mikroOrmConfig);
  const metadata = orm.getMetadata();
  const schemas: DexieSchemaInfo[] = [];

  // getAll() returns an object, not an array
  for (const meta of Object.values(metadata.getAll())) {
    // Skip abstract base classes
    if (meta.abstract) continue;
    
    // Skip system tables that shouldn't be in Dexie
    if (['Account', 'Session', 'Verification'].includes(meta.className)) continue;

    const schema: DexieSchemaInfo = {
      tableName: meta.tableName,
      entityName: meta.className,
      indexes: [],
      primaryKey: 'id',
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

    schemas.push(schema);
  }

  await orm.close();
  return schemas;
}

function generateDexieSchemaFile(schemas: DexieSchemaInfo[]): string {
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
    
    this.version(1).stores({
`;

  // Add schema definitions
  for (const schema of schemas) {
    const indexString = schema.indexes.join(', ');
    output += `      ${schema.tableName}: '${indexString}',\n`;
  }

  output += `    });
  }
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
`;

  return output;
}

async function main() {
  try {
    console.log('🔍 Extracting Dexie schema from MikroORM entities...');
    const schemas = await extractDexieSchema();
    
    console.log(`📦 Found ${schemas.length} tables for Dexie`);
    
    // Generate Dexie schema file
    const dexieSchema = generateDexieSchemaFile(schemas);
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