import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mikroOrmConfig from '../mikro-orm.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

interface DrizzleTableInfo {
  entityName: string;
  tableName: string;
  columns: DrizzleColumnInfo[];
  relations: DrizzleRelationInfo[];
  indexes: DrizzleIndexInfo[];
  isBaseDomain: boolean;
}

interface DrizzleColumnInfo {
  name: string;
  type: string;
  drizzleType: string;
  nullable: boolean;
  primary: boolean;
  unique: boolean;
  default?: any;
}

interface DrizzleRelationInfo {
  name: string;
  type: 'many' | 'one';
  targetEntity: string;
  targetTable: string;
}

interface DrizzleIndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

async function extractDrizzleSchema(): Promise<DrizzleTableInfo[]> {
  const orm = await MikroORM.init({
    ...mikroOrmConfig,
    connect: false, // Don't connect to DB, just need metadata
  });
  const metadata = orm.getMetadata();
  const tables: DrizzleTableInfo[] = [];

  const allMetadata = Object.values(metadata.getAll());

  for (const meta of allMetadata as any[]) {
    // Skip abstract base classes
    if (meta.abstract) continue;

    const tableInfo: DrizzleTableInfo = {
      entityName: meta.className,
      tableName: meta.tableName,
      columns: [],
      relations: [],
      indexes: [],
      isBaseDomain: meta.extends?.includes('BaseDomainEntity') || false,
    };

    // Extract columns
    for (const prop of Object.values(meta.properties) as any[]) {
      // Skip Collection properties (OneToMany, ManyToMany)
      // These have 'kind' values like '1:m' or 'm:n'
      if (prop.kind === '1:m' || prop.kind === 'm:n') {
        // Add to relations but not columns
        if (prop.kind === '1:m') {
          tableInfo.relations.push({
            name: prop.name,
            type: 'many',
            targetEntity: prop.type,
            targetTable: prop.type.toLowerCase(),
          });
        } else if (prop.kind === 'm:n') {
          tableInfo.relations.push({
            name: prop.name,
            type: 'many',
            targetEntity: prop.type,
            targetTable: prop.type.toLowerCase(),
          });
        }
        continue;
      }
      
      if (!prop.reference || prop.reference === 'scalar' || prop.reference === 'embedded') {
        tableInfo.columns.push({
          name: prop.fieldNames?.[0] || prop.name,
          type: prop.type,
          drizzleType: mapToDrizzleType(prop.type, prop),
          nullable: prop.nullable,
          primary: prop.primary || false,
          unique: prop.unique || false,
          default: prop.defaultRaw || prop.default,
        });
      } else if (prop.reference === 'm:1' || prop.reference === '1:1') {
        // Add foreign key column
        const fkColumn = prop.fieldNames?.[0] || `${prop.name}Id`;
        const targetMeta = allMetadata.find((m: any) => m.className === prop.type);
        
        tableInfo.columns.push({
          name: fkColumn,
          type: 'uuid',
          drizzleType: 'uuid',
          nullable: prop.nullable,
          primary: false,
          unique: false,
          default: undefined,
        });

        tableInfo.relations.push({
          name: prop.name,
          type: 'one',
          targetEntity: prop.type,
          targetTable: targetMeta?.tableName || prop.type.toLowerCase(),
        });
      }
    }

    // Extract indexes
    for (const index of meta.indexes || []) {
      const idx = index as any;
      if (!idx.primary) {
        const properties = Array.isArray(idx.properties) ? idx.properties : [idx.properties];
        tableInfo.indexes.push({
          name: idx.name || `idx_${tableInfo.tableName}_${properties.join('_')}`,
          columns: properties,
          unique: idx.unique || false,
        });
      }
    }

    tables.push(tableInfo);
  }

  await orm.close();
  return tables;
}

function mapToDrizzleType(type: string, prop: any): string {
  const typeMap: Record<string, string> = {
    'string': 'text',
    'text': 'text',
    'uuid': 'uuid',
    'integer': 'integer',
    'bigint': 'bigint',
    'boolean': 'boolean',
    'date': 'timestamp',
    'timestamptz': 'timestamp',
    'json': 'jsonb',
    'jsonb': 'jsonb',
  };

  // Special cases
  if (prop.columnType === 'varchar' && prop.length) {
    return `varchar(${prop.length})`;
  }

  return typeMap[type] || 'text';
}

function generateDrizzleSchema(tables: DrizzleTableInfo[]): string {
  let output = `// Generated Drizzle ORM schema from MikroORM entities
import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  boolean, 
  integer,
  bigint,
  varchar,
  jsonb,
  index,
  uniqueIndex,
  primaryKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Table Definitions
// ============================================

`;

  // Generate table schemas
  for (const table of tables) {
    output += `export const ${table.entityName.toLowerCase()}Table = pgTable('${table.tableName}', {
`;

    // Add columns
    for (const col of table.columns) {
      let columnDef = `  ${col.name}: `;

      // Generate column type
      switch (col.drizzleType) {
        case 'uuid':
          columnDef += `uuid('${col.name}')`;
          if (col.primary) columnDef += `.primaryKey()`;
          if (col.default === 'gen_random_uuid()') columnDef += `.defaultRandom()`;
          break;
        case 'text':
          columnDef += `text('${col.name}')`;
          break;
        case 'integer':
          columnDef += `integer('${col.name}')`;
          if (col.default !== undefined) columnDef += `.default(${col.default})`;
          break;
        case 'bigint':
          columnDef += `bigint('${col.name}', { mode: 'bigint' })`;
          if (col.default !== undefined) columnDef += `.default(${col.default}n)`;
          break;
        case 'boolean':
          columnDef += `boolean('${col.name}')`;
          if (col.default !== undefined) columnDef += `.default(${col.default})`;
          break;
        case 'timestamp':
          columnDef += `timestamp('${col.name}', { mode: 'date' })`;
          if (col.default === 'now()') columnDef += `.defaultNow()`;
          break;
        case 'jsonb':
          columnDef += `jsonb('${col.name}')`;
          break;
        default:
          if (col.drizzleType.startsWith('varchar')) {
            columnDef += `${col.drizzleType.replace('varchar', 'varchar')}('${col.name}')`;
          } else {
            columnDef += `text('${col.name}')`;
          }
      }

      if (!col.nullable && !col.primary) columnDef += `.notNull()`;
      if (col.unique && !col.primary) columnDef += `.unique()`;

      columnDef += ',';
      output += columnDef + '\n';
    }

    output = output.slice(0, -2) + '\n'; // Remove last comma
    output += `}`;

    // Add indexes
    if (table.indexes.length > 0) {
      output += `, (table) => ({\n`;
      for (const idx of table.indexes) {
        const indexName = idx.name;
        const indexFn = idx.unique ? 'uniqueIndex' : 'index';
        // Convert MikroORM property names to Drizzle field names (camelCase to snake_case)
        const columns = idx.columns.map(c => {
          // Find the actual column in the table definition
          const field = table.columns.find(col => {
            const camelCase = col.name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            return camelCase === c;
          });
          
          if (field) {
            return `table.${field.name}`;
          }
          
          // Handle relationship fields - tagSet becomes tag_set_id
          if (c === 'tagSet') {
            return 'table.tag_set_id';
          }
          if (c === 'statusSet') {
            return 'table.status_set_id';
          }
          
          // Fallback: convert to snake_case
          let snakeCase = c.replace(/[A-Z]/g, (letter, index) => 
            index === 0 ? letter.toLowerCase() : `_${letter.toLowerCase()}`
          );
          
          // For relationship fields, check if we need to add _id suffix
          const relationshipField = table.columns.find(col => col.name === snakeCase + '_id' || col.name === snakeCase + 's_id');
          if (relationshipField) {
            return `table.${relationshipField.name}`;
          }
          
          return `table.${snakeCase}`;
        }).join(', ');
        output += `  ${indexName}: ${indexFn}('${indexName}').on(${columns}),\n`;
      }
      output += `})`;
    }

    output += `);\n\n`;
  }

  // Generate relations
  output += `// ============================================
// Relations
// ============================================

`;

  for (const table of tables) {
    if (table.relations.length === 0) continue;

    output += `export const ${table.entityName.toLowerCase()}Relations = relations(${table.entityName.toLowerCase()}Table, ({ one, many }) => ({
`;

    for (const rel of table.relations) {
      if (rel.type === 'one') {
        output += `  ${rel.name}: one(${rel.targetEntity.toLowerCase()}Table, {
    fields: [${table.entityName.toLowerCase()}Table.${rel.name}Id],
    references: [${rel.targetEntity.toLowerCase()}Table.id],
  }),\n`;
      } else {
        output += `  ${rel.name}: many(${rel.targetEntity.toLowerCase()}Table),\n`;
      }
    }

    output += `}));\n\n`;
  }

  // Export all schemas
  output += `// ============================================
// Export Schema
// ============================================

export const schema = {
`;

  for (const table of tables) {
    output += `  ${table.entityName.toLowerCase()}Table,\n`;
    if (table.relations.length > 0) {
      output += `  ${table.entityName.toLowerCase()}Relations,\n`;
    }
  }

  output += `};\n\n`;

  // Export types
  output += `// ============================================
// Type Exports
// ============================================

`;

  for (const table of tables) {
    output += `export type ${table.entityName} = typeof ${table.entityName.toLowerCase()}Table.$inferSelect;\n`;
    output += `export type New${table.entityName} = typeof ${table.entityName.toLowerCase()}Table.$inferInsert;\n`;
  }

  return output;
}

async function main() {
  try {
    console.log('🔍 Extracting Drizzle schema from MikroORM entities...');
    const tables = await extractDrizzleSchema();
    
    console.log(`📦 Found ${tables.length} tables for Drizzle`);
    
    // Generate Drizzle schema file
    const drizzleSchema = generateDrizzleSchema(tables);
    const schemaPath = path.join(PACKAGE_ROOT, 'src/generated/drizzle-schema.ts');
    
    await fs.mkdir(path.dirname(schemaPath), { recursive: true });
    await fs.writeFile(schemaPath, drizzleSchema);
    
    console.log('✅ Generated drizzle-schema.ts');
    
  } catch (error) {
    console.error('❌ Error generating Drizzle schema:', error);
    process.exit(1);
  }
}

main();