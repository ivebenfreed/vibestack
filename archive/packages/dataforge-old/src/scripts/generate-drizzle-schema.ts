import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mikroOrmConfig from '../mikro-orm.config.js';
import { extractContextFromComment } from '../utils/entity-context.js';

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
  const junctionTables = new Map<string, DrizzleTableInfo>(); // Track junction tables

  const allMetadata = Object.values(metadata.getAll());

  // First pass: collect all junction table names
  const junctionTableNames = new Set<string>();
  for (const meta of allMetadata as any[]) {
    if (meta.abstract) continue;
    for (const prop of Object.values(meta.properties) as any[]) {
      if (prop.kind === 'm:n' && prop.owner) {
        junctionTableNames.add(prop.pivotTable);
      }
    }
  }
  
  for (const meta of allMetadata as any[]) {
    // Skip abstract base classes
    if (meta.abstract) continue;
    
    // Skip client-only entities (Drizzle is server-side only)
    const entityContext = extractContextFromComment(meta.comment);
    if (entityContext === 'client-only') {
      console.log(`⏭️  Skipping client-only entity: ${meta.className}`);
      continue;
    }
    
    // Skip junction tables (they'll be handled separately)
    if (junctionTableNames.has(meta.tableName)) {
      continue;
    }
    
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
        // Find the target metadata to get the actual table name
        const targetMeta = allMetadata.find((m: any) => m.className === prop.type);
        const targetTableName = targetMeta?.tableName || prop.type.toLowerCase() + 's';
        
        // Add to relations but not columns
        if (prop.kind === '1:m') {
          tableInfo.relations.push({
            name: prop.name,
            type: 'many',
            targetEntity: prop.type,
            targetTable: targetTableName,
          });
        } else if (prop.kind === 'm:n') {
          tableInfo.relations.push({
            name: prop.name,
            type: 'many',
            targetEntity: prop.type,
            targetTable: targetTableName,
          });
          
          // Extract junction table info if this is the owning side
          if (prop.owner) {
            const pivotTableName = prop.pivotTable;
            const namingStrategy = orm.config.getNamingStrategy();
            
            // Get the join column names
            const joinColumn = prop.joinColumns?.[0] || namingStrategy.joinKeyColumnName(meta.className, 'id');
            const inverseJoinColumn = prop.inverseJoinColumns?.[0] || namingStrategy.joinKeyColumnName(prop.type, 'id');
            
            // Create junction table if not already created
            if (!junctionTables.has(pivotTableName)) {
              junctionTables.set(pivotTableName, {
                entityName: pivotTableName, // Use table name as entity name for junction tables
                tableName: pivotTableName,
                columns: [
                  {
                    name: joinColumn,
                    type: 'uuid',
                    drizzleType: 'uuid',
                    nullable: false,
                    primary: false,
                    unique: false,
                    default: undefined,
                  },
                  {
                    name: inverseJoinColumn,
                    type: 'uuid',
                    drizzleType: 'uuid',
                    nullable: false,
                    primary: false,
                    unique: false,
                    default: undefined,
                  }
                ],
                relations: [],
                indexes: [],
                isBaseDomain: false,
              });
            }
          }
        }
        continue;
      }
      
      if (prop.kind === 'm:1' || prop.kind === '1:1') {
        // Add foreign key column
        let fkColumn = prop.fieldNames?.[0] || `${prop.name}Id`;
        
        // Fix known incorrect mappings
        if (meta.className === 'Comment') {
          if (prop.name === 'task') {
            fkColumn = 'task_id';
          } else if (prop.name === 'author') {
            fkColumn = 'author_id';
          }
        }
        
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
      } else if (!prop.reference || prop.reference === 'scalar' || prop.reference === 'embedded') {
        tableInfo.columns.push({
          name: prop.fieldNames?.[0] || prop.name,
          type: prop.type,
          drizzleType: mapToDrizzleType(prop.type, prop),
          nullable: prop.nullable,
          primary: prop.primary || false,
          unique: prop.unique || false,
          default: prop.defaultRaw || prop.default,
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

  // Add junction tables to the main tables array
  for (const junctionTable of junctionTables.values()) {
    tables.push(junctionTable);
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
    // Use the exact table name from the database for the export name
    // This ensures 1:1 mapping and no conflicts
    const exportName = table.tableName;
    output += `export const ${exportName} = pgTable('${table.tableName}', {
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
            // Extract length from varchar(n) if present
            const lengthMatch = col.drizzleType.match(/varchar\((\d+)\)/);
            if (lengthMatch) {
              columnDef += `varchar('${col.name}', { length: ${lengthMatch[1]} })`;
            } else {
              columnDef += `varchar('${col.name}')`;
            }
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

    const exportName = table.tableName;
    // For relation names, convert to camelCase for consistency
    const relationName = table.tableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) + 'Relations';
    output += `export const ${relationName} = relations(${exportName}, ({ one, many }) => ({
`;

    for (const rel of table.relations) {
      const targetExportName = rel.targetTable;
      if (rel.type === 'one') {
        // Find the actual foreign key column name from the table columns
        let fieldName = `${rel.name}_id`;
        
        // Look for the actual foreign key column in the table
        const fkColumn = table.columns.find(col => 
          col.name === `${rel.name}_id` || 
          col.name === `${rel.name}s_id` ||
          col.name === fieldName
        );
        
        if (fkColumn) {
          fieldName = fkColumn.name;
        } else {
          // Handle special cases for known mappings
          if (rel.name === 'account' && table.tableName === 'users') {
            fieldName = 'accounts_id';
          } else if (rel.name === 'account' && table.tableName === 'sessions') {
            fieldName = 'accounts_id';
          } else if (rel.name === 'tagSet') {
            fieldName = 'tag_set_id';
          } else if (rel.name === 'statusSet') {
            fieldName = 'status_set_id';
          }
        }
        
        output += `  ${rel.name}: one(${targetExportName}, {
    fields: [${exportName}.${fieldName}],
    references: [${targetExportName}.id],
  }),\n`;
      } else {
        output += `  ${rel.name}: many(${targetExportName}),\n`;
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
    const exportName = table.tableName;
    output += `  ${exportName},\n`;
    if (table.relations.length > 0) {
      const relationName = table.tableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) + 'Relations';
      output += `  ${relationName},\n`;
    }
  }

  output += `};\n\n`;

  // Export types
  output += `// ============================================
// Type Exports
// ============================================

`;

  for (const table of tables) {
    const exportName = table.tableName;
    output += `export type ${table.entityName} = typeof ${exportName}.$inferSelect;\n`;
    output += `export type New${table.entityName} = typeof ${exportName}.$inferInsert;\n`;
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