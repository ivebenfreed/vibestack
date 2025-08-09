import 'reflect-metadata';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MetadataFilter } from '../utils/metadata-filter.js';
import { getTableCategory, shouldIncludeInServer } from '../utils/context.js';
import { getMetadataArgsStorage, DefaultNamingStrategy } from 'typeorm';

console.log('[generate-drizzle-schema] Starting Drizzle schema generation...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

/**
 * Main function to generate Drizzle schema from TypeORM entities
 */
async function generateDrizzleSchema() {
  console.log('[generate-drizzle-schema] Extracting entity metadata...');
  
  // Ensure generated directory exists
  const generatedDir = path.join(PACKAGE_ROOT, 'src/generated');
  await fs.mkdir(generatedDir, { recursive: true });
  
  // Extract entity metadata for all server entities
  const entityMetadataMap = await extractAllEntityMetadata();
  const junctionTables = extractJunctionTables(entityMetadataMap);
  
  // Generate Drizzle schema
  const schemaOutput = generateDrizzleSchemaFile(entityMetadataMap, junctionTables);
  
  // Write the generated file
  const outputPath = path.join(generatedDir, 'drizzle-schema.ts');
  await fs.writeFile(outputPath, schemaOutput);
  
  console.log(`[generate-drizzle-schema] Generated Drizzle schema at: ${outputPath}`);
}

/**
 * Extract metadata for all server entities using TypeORM metadata
 */
async function extractAllEntityMetadata(): Promise<Map<string, any>> {
  const filter = new MetadataFilter();
  const entities = await filter.discoverEntities();
  const entityMetadataMap = new Map<string, any>();
  
  console.log('[generate-drizzle-schema] Discovered entities:', entities.map(e => e.name));
  
  // Filter to server-only entities
  const serverEntities = entities.filter(entity => shouldIncludeInServer(entity));
  console.log('[generate-drizzle-schema] Server entities:', serverEntities.map(e => e.name));
  
  for (const entity of serverEntities) {
    const { columns, relations } = filter.filterEntityMetadata(entity, 'server');
    const tableName = filter.getTableName(entity);
    
    entityMetadataMap.set(entity.name, {
      name: entity.name,
      tableName,
      columns,
      relations,
      entity
    });
  }
  
  return entityMetadataMap;
}

/**
 * Extract junction tables from entity relationships
 */
function extractJunctionTables(entityMetadataMap: Map<string, any>): Array<any> {
  const storage = getMetadataArgsStorage();
  const junctionTables = new Map<string, any>();
  
  for (const [entityName, metadata] of entityMetadataMap) {
    for (const relation of metadata.relations) {
      if (relation.relationType === 'many-to-many') {
        const joinTableMeta = storage.joinTables.find(j => 
          j.target === metadata.entity && j.propertyName === relation.propertyName
        );
        
        if (joinTableMeta) {
          const targetEntityGetter = relation.type as () => Function;
          const targetEntityClass = targetEntityGetter();
          const targetEntityName = targetEntityClass?.name;
          
          if (!targetEntityName) continue;
          
          const namingStrategy = new DefaultNamingStrategy();
          const junctionTableName = joinTableMeta.name || namingStrategy.joinTableName(
            metadata.tableName,
            metadata.tableName, // This should be target table name but we'll simplify
            relation.propertyName,
            targetEntityName.toLowerCase()
          );
          
          if (!junctionTables.has(junctionTableName)) {
            // Determine column structure based on common patterns
            let columns: Array<{ name: string; type: string; references?: string }>;
            
            if (junctionTableName === 'task_tags') {
              columns = [
                { name: 'task_id', type: 'uuid', references: 'tasks.id' },
                { name: 'tag_id', type: 'uuid', references: 'tags.id' }
              ];
            } else if (junctionTableName === 'task_dependencies') {
              columns = [
                { name: 'dependent_task_id', type: 'uuid', references: 'tasks.id' },
                { name: 'dependency_task_id', type: 'uuid', references: 'tasks.id' }
              ];
            } else if (junctionTableName === 'project_members') {
              columns = [
                { name: 'project_id', type: 'uuid', references: 'projects.id' },
                { name: 'user_id', type: 'uuid', references: 'users.id' },
                { name: 'role', type: 'text' }
              ];
            } else {
              // Generic pattern
              const sourceTable = metadata.tableName;
              const targetTable = targetEntityName.toLowerCase() + 's';
              
              columns = [
                { name: `${sourceTable.slice(0, -1)}_id`, type: 'uuid', references: `${sourceTable}.id` },
                { name: `${targetTable.slice(0, -1)}_id`, type: 'uuid', references: `${targetTable}.id` }
              ];
            }
            
            junctionTables.set(junctionTableName, {
              name: junctionTableName,
              columns,
              sourceEntity: entityName,
              targetEntity: targetEntityName
            });
          }
        }
      }
    }
  }
  
  return Array.from(junctionTables.values());
}

/**
 * Map TypeORM column metadata to Drizzle column function
 */
function mapColumnToDrizzle(column: any): string {
  const storage = getMetadataArgsStorage();
  const originalColumnMeta = storage.columns.find(c => 
    c.target === column.target && c.propertyName === column.propertyName
  );
  
  if (!originalColumnMeta) {
    console.warn(`[generate-drizzle-schema] Could not find original metadata for column ${column.propertyName}`);
    return `text('${column.propertyName}')`;
  }
  
  const options = originalColumnMeta.options || {};
  const dbName = options.name || column.propertyName;
  const nullable = options.nullable ? '' : '.notNull()';
  const defaultValue = options.default !== undefined ? `.default(${JSON.stringify(options.default)})` : '';
  
  // Determine the column type
  let columnType: string;
  const type = options.type || 'text';
  
  switch (type) {
    case 'uuid':
      columnType = `uuid('${dbName}')`;
      break;
    case 'varchar':
    case 'text':
      if (options.length && options.length <= 255) {
        columnType = `varchar('${dbName}', { length: ${options.length} })`;
      } else {
        columnType = `text('${dbName}')`;
      }
      break;
    case 'integer':
    case 'int':
      columnType = `integer('${dbName}')`;
      break;
    case 'bigint':
      columnType = `bigint('${dbName}', { mode: 'number' })`;
      break;
    case 'decimal':
    case 'numeric':
      columnType = `numeric('${dbName}')`;
      break;
    case 'boolean':
      columnType = `boolean('${dbName}')`;
      break;
    case 'timestamptz':
    case 'timestamp':
      columnType = `timestamp('${dbName}', { withTimezone: true })`;
      break;
    case 'date':
      columnType = `date('${dbName}')`;
      break;
    case 'time':
      columnType = `time('${dbName}')`;
      break;
    case 'interval':
      columnType = `interval('${dbName}')`;
      break;
    case 'json':
    case 'jsonb':
      columnType = `json('${dbName}')`;
      break;
    case 'enum':
      if (options.enum) {
        const enumValues = Object.values(options.enum).map(v => `'${v}'`).join(', ');
        columnType = `text('${dbName}', { enum: [${enumValues}] })`;
      } else {
        columnType = `text('${dbName}')`;
      }
      break;
    default:
      console.warn(`[generate-drizzle-schema] Unknown column type: ${type}, defaulting to text`);
      columnType = `text('${dbName}')`;
  }
  
  return `${columnType}${defaultValue}${nullable}`;
}

/**
 * Generate the Drizzle schema TypeScript file
 */
function generateDrizzleSchemaFile(
  entityMetadataMap: Map<string, any>,
  junctionTables: Array<any>
): string {
  const entities = Array.from(entityMetadataMap.values());
  
  // Generate table definitions
  const tableDefinitions: string[] = [];
  
  // Entity tables
  for (const entity of entities) {
    const columns: string[] = [];
    
    // Regular columns
    for (const column of entity.columns) {
      const columnDef = mapColumnToDrizzle(column);
      columns.push(`  ${column.propertyName}: ${columnDef}`);
    }
    
    const tableDef = `export const ${entity.tableName} = pgTable('${entity.tableName}', {
${columns.join(',\n')}
});`;
    
    tableDefinitions.push(tableDef);
  }
  
  // Junction tables
  for (const junction of junctionTables) {
    const columns: string[] = [];
    
    for (const col of junction.columns) {
      const nullable = col.name.includes('role') ? '' : '.notNull()';
      const columnDef = col.type === 'uuid' 
        ? `uuid('${col.name}')${nullable}`
        : `text('${col.name}')${nullable}`;
      columns.push(`  ${toCamelCase(col.name)}: ${columnDef}`);
    }
    
    const tableDef = `export const ${junction.name} = pgTable('${junction.name}', {
${columns.join(',\n')}
});`;
    
    tableDefinitions.push(tableDef);
  }
  
  // Generate relationships (simplified for now)
  const relationshipDefinitions: string[] = [];
  
  for (const entity of entities) {
    if (entity.relations.length > 0) {
      const relations: string[] = [];
      
      for (const rel of entity.relations) {
        if (rel.relationType === 'many-to-one') {
          const targetEntityClass = (rel.type as () => Function)();
          const targetTableName = targetEntityClass.name.toLowerCase() + 's';
          relations.push(`    ${rel.propertyName}: one(${targetTableName})`);
        } else if (rel.relationType === 'one-to-many') {
          const targetEntityClass = (rel.type as () => Function)();
          const targetTableName = targetEntityClass.name.toLowerCase() + 's';
          relations.push(`    ${rel.propertyName}: many(${targetTableName})`);
        }
      }
      
      if (relations.length > 0) {
        const relationDef = `export const ${entity.tableName}Relations = relations(${entity.tableName}, ({ one, many }) => ({
${relations.join(',\n')}
}));`;
        
        relationshipDefinitions.push(relationDef);
      }
    }
  }
  
  // Generate type exports
  const typeExports = entities.map(entity => {
    const typeName = toPascalCase(entity.name);
    const selectType = `export type ${typeName} = typeof ${entity.tableName}.$inferSelect;`;
    const insertType = `export type New${typeName} = typeof ${entity.tableName}.$inferInsert;`;
    return [selectType, insertType].join('\n');
  }).join('\n\n');
  
  return `/**
 * Auto-generated Drizzle schema from TypeORM entities
 * Generated at: ${new Date().toISOString()}
 * 
 * This file is auto-generated. Do not edit manually.
 * Run 'pnpm generate-drizzle-schema' to regenerate.
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  integer, 
  bigint, 
  numeric, 
  boolean, 
  timestamp, 
  date, 
  time, 
  interval, 
  json 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =====================================
// TABLE DEFINITIONS
// =====================================

${tableDefinitions.join('\n\n')}

// =====================================
// RELATIONSHIPS
// =====================================

${relationshipDefinitions.join('\n\n')}

// =====================================
// TYPE EXPORTS
// =====================================

${typeExports}

// =====================================
// SCHEMA EXPORT
// =====================================

export const schema = {
  // Entity tables
${entities.map(e => `  ${e.tableName}`).join(',\n')},
  
  // Junction tables
${junctionTables.map(j => `  ${j.name}`).join(',\n')},
  
  // Relations
${entities.filter(e => e.relations.length > 0).map(e => `  ${e.tableName}Relations`).join(',\n')}
};

// Table name constants for migrations
export const TABLE_NAMES = {
${entities.map(e => `  ${e.name.toUpperCase()}: '${e.tableName}'`).join(',\n')},
${junctionTables.map(j => `  ${toPascalCase(j.name).toUpperCase()}: '${j.name}'`).join(',\n')}
} as const;
`;
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Run the generator
generateDrizzleSchema().catch(error => {
  console.error('[generate-drizzle-schema] Error:', error);
  process.exit(1);
});