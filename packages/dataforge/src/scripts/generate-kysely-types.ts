import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mikroOrmConfig from '../mikro-orm.config.js';
import { extractContextFromComment } from '../utils/entity-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

interface KyselyTableInfo {
  entityName: string;
  tableName: string;
  columns: KyselyColumnInfo[];
  relations: KyselyRelationInfo[];
}

interface KyselyColumnInfo {
  name: string;
  type: string;
  kyselyType: string;
  nullable: boolean;
  generated: boolean;
  hasDefault: boolean;
}

interface KyselyRelationInfo {
  name: string;
  type: 'many' | 'one';
  targetEntity: string;
  targetTable: string;
  columnName?: string;
}

function mapToKyselyType(type: string, prop: any): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'text': 'string',
    'uuid': 'string',
    'integer': 'number',
    'bigint': 'bigint',
    'boolean': 'boolean',
    'date': 'Date',
    'timestamptz': 'Date',
    'json': 'unknown',
    'jsonb': 'unknown',
    'array': 'string[]',
    'tsrange': 'string',
    'interval': 'string',
  };

  // Special cases
  if (prop.columnType === 'varchar') {
    return 'string';
  }
  
  // Handle arrays
  if (prop.type === 'array' || prop.type.endsWith('[]')) {
    return 'string[]';
  }

  // Handle JSON with proper typing if we know the shape
  if ((type === 'json' || type === 'jsonb') && prop.type === 'object') {
    return 'Record<string, any>';
  }

  return typeMap[type] || 'string';
}

async function extractKyselySchema(): Promise<KyselyTableInfo[]> {
  const orm = await MikroORM.init({
    ...mikroOrmConfig,
    connect: false,
  });
  
  const metadata = orm.getMetadata();
  const tables: KyselyTableInfo[] = [];
  const junctionTables = new Map<string, KyselyTableInfo>();
  const allMetadata = Object.values(metadata.getAll());

  // First pass: collect junction table names
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
    if (meta.abstract) continue;
    
    // Skip client-only entities for server types
    const entityContext = extractContextFromComment(meta.comment);
    if (entityContext === 'client-only') {
      console.log(`⏭️  Skipping client-only entity: ${meta.className}`);
      continue;
    }
    
    // Skip junction tables (handled separately)
    if (junctionTableNames.has(meta.tableName)) {
      continue;
    }
    
    const tableInfo: KyselyTableInfo = {
      entityName: meta.className,
      tableName: meta.tableName,
      columns: [],
      relations: [],
    };

    // Extract columns
    for (const prop of Object.values(meta.properties) as any[]) {
      // Handle relations
      if (prop.kind === '1:m' || prop.kind === 'm:n') {
        const targetMeta = allMetadata.find((m: any) => m.className === prop.type);
        const targetTableName = targetMeta?.tableName || prop.type.toLowerCase();
        
        tableInfo.relations.push({
          name: prop.name,
          type: 'many',
          targetEntity: prop.type,
          targetTable: targetTableName,
        });
        
        // Handle junction tables for m:n
        if (prop.kind === 'm:n' && prop.owner) {
          const pivotTableName = prop.pivotTable;
          const namingStrategy = orm.config.getNamingStrategy();
          
          const joinColumn = prop.joinColumns?.[0] || namingStrategy.joinKeyColumnName(meta.tableName, 'id');
          const inverseJoinColumn = prop.inverseJoinColumns?.[0] || namingStrategy.joinKeyColumnName(prop.type, 'id');
          
          if (!junctionTables.has(pivotTableName)) {
            junctionTables.set(pivotTableName, {
              entityName: pivotTableName,
              tableName: pivotTableName,
              columns: [
                {
                  name: joinColumn,
                  type: 'uuid',
                  kyselyType: 'string',
                  nullable: false,
                  generated: false,
                  hasDefault: false,
                },
                {
                  name: inverseJoinColumn,
                  type: 'uuid',
                  kyselyType: 'string',
                  nullable: false,
                  generated: false,
                  hasDefault: false,
                }
              ],
              relations: [],
            });
          }
        }
        continue;
      }
      
      if (prop.kind === 'm:1' || prop.kind === '1:1') {
        // Add foreign key column
        let fkColumn = prop.fieldNames?.[0] || `${prop.name}_id`;
        
        const targetMeta = allMetadata.find((m: any) => m.className === prop.type);
        
        tableInfo.columns.push({
          name: fkColumn,
          type: 'uuid',
          kyselyType: 'string | null',
          nullable: prop.nullable,
          generated: false,
          hasDefault: false,
        });

        tableInfo.relations.push({
          name: prop.name,
          type: 'one',
          targetEntity: prop.type,
          targetTable: targetMeta?.tableName || prop.type.toLowerCase(),
          columnName: fkColumn,
        });
      } else if (!prop.reference || prop.reference === 'scalar' || prop.reference === 'embedded') {
        const columnName = prop.fieldNames?.[0] || prop.name;
        const isGenerated = prop.defaultRaw === 'gen_random_uuid()' || 
                           prop.defaultRaw === 'now()' ||
                           prop.primary;
        const hasDefault = prop.defaultRaw !== undefined || prop.default !== undefined;
        
        tableInfo.columns.push({
          name: columnName,
          type: prop.type,
          kyselyType: mapToKyselyType(prop.type, prop),
          nullable: prop.nullable,
          generated: isGenerated,
          hasDefault: hasDefault,
        });
      }
    }

    tables.push(tableInfo);
  }

  // Add junction tables
  for (const junctionTable of junctionTables.values()) {
    tables.push(junctionTable);
  }

  await orm.close();
  return tables;
}

function generateKyselyTypes(tables: KyselyTableInfo[]): string {
  let output = `// Generated Kysely database types from MikroORM entities
// This replaces the need for Drizzle schema in queries

import type { ColumnType, Generated, Selectable, Insertable, Updateable } from 'kysely';

// ============================================
// Table Types
// ============================================

`;

  // Generate table interfaces
  for (const table of tables) {
    const interfaceName = table.entityName.replace(/_/g, '');
    
    output += `export interface ${interfaceName}Table {\n`;
    
    for (const col of table.columns) {
      let typeStr = col.kyselyType;
      
      // Handle generated columns
      if (col.generated) {
        if (col.nullable) {
          typeStr = `Generated<${typeStr} | null>`;
        } else {
          typeStr = `Generated<${typeStr}>`;
        }
      } else if (col.hasDefault && !col.nullable) {
        // Columns with defaults can be omitted on insert
        typeStr = `ColumnType<${typeStr}, ${typeStr} | undefined, ${typeStr}>`;
      } else if (col.nullable) {
        typeStr = `${typeStr} | null`;
      }
      
      output += `  ${col.name}: ${typeStr};\n`;
    }
    
    output += `}\n\n`;
  }

  // Generate the database interface
  output += `// ============================================
// Database Interface
// ============================================

export interface Database {
`;

  for (const table of tables) {
    const interfaceName = table.entityName.replace(/_/g, '');
    output += `  ${table.tableName}: ${interfaceName}Table;\n`;
  }

  output += `}\n\n`;

  // Generate helper types
  output += `// ============================================
// Helper Types for CRUD Operations
// ============================================

`;

  for (const table of tables) {
    const typeName = table.entityName;
    const interfaceName = table.entityName.replace(/_/g, '');
    
    output += `export type ${typeName} = Selectable<${interfaceName}Table>;\n`;
    output += `export type New${typeName} = Insertable<${interfaceName}Table>;\n`;
    output += `export type ${typeName}Update = Updateable<${interfaceName}Table>;\n\n`;
  }

  // Generate a type map for runtime access
  output += `// ============================================
// Entity to Table Mapping
// ============================================

export const tableNames = {
`;

  for (const table of tables) {
    output += `  ${table.entityName}: '${table.tableName}' as const,\n`;
  }

  output += `} as const;\n\n`;

  // Export type for table names
  output += `export type TableName = keyof Database;\n`;
  output += `export type EntityName = keyof typeof tableNames;\n`;

  return output;
}

async function main() {
  try {
    console.log('🔍 Extracting Kysely types from MikroORM entities...');
    const tables = await extractKyselySchema();
    
    console.log(`📦 Found ${tables.length} tables for Kysely`);
    
    // Generate Kysely types file
    const kyselyTypes = generateKyselyTypes(tables);
    const typesPath = path.join(PACKAGE_ROOT, 'src/generated/kysely-types.ts');
    
    await fs.mkdir(path.dirname(typesPath), { recursive: true });
    await fs.writeFile(typesPath, kyselyTypes);
    
    console.log('✅ Generated kysely-types.ts');
    
  } catch (error) {
    console.error('❌ Error generating Kysely types:', error);
    process.exit(1);
  }
}

main();