import 'reflect-metadata';
import { MetadataFilter } from '../utils/metadata-filter.js';
import { getTableCategory, TableCategory, isServerEntity, isClientEntity, shouldIncludeInServer, shouldIncludeInClient } from '../utils/context.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMetadataArgsStorage } from 'typeorm';
import { ENUM_TYPE_NAME_METADATA_KEY, ENUM_SOURCE_PATH_METADATA_KEY } from '../utils/decorators.js';
import { EntitySchema, DefaultNamingStrategy, NamingStrategyInterface, ColumnType as TypeOrmColumnType } from 'typeorm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

/**
 * Get table hierarchy based on entity relationships
 * Returns a map of table name to dependency level
 * Level 0 = no dependencies (root)
 * Level 1+ = has dependencies on other tables
 */
function getTableHierarchy(entities: Function[], filter: MetadataFilter): Map<string, number> {
    const hierarchy = new Map<string, number>(); // Key: Entity Class Name
    const parentRelations = new Map<string, Set<string>>(); // Key: Entity Class Name, Value: Set<Parent Entity Class Name>
    const entityMap = new Map(entities.map(e => [e.name, e])); // Map name to entity for easy lookup

    // First pass: collect all entities and their direct parents
    entities.forEach(entity => {
        const entityName = entity.name;
        const { relations } = filter.filterEntityMetadata(entity, 'server'); // Use server context to get full hierarchy

        // Initialize empty parent set
        if (!parentRelations.has(entityName)) {
            parentRelations.set(entityName, new Set<string>());
        }

        // Add parent relationships from ManyToOne relations
        relations.forEach(relation => {
            if (relation.relationType !== 'many-to-one') {
                return;
            }

            const relationTypeFn = relation.type as () => Function;
            const targetEntityClass = relationTypeFn();
            const targetEntityName = targetEntityClass?.name;

            if (targetEntityName && entityMap.has(targetEntityName)) { // Ensure parent is in the list
                if (targetEntityName === entityName) {
                    // INFO: Ignoring self-referencing parent Comment.parent for hierarchy level calculation.
                    // console.info(`INFO: Ignoring self-referencing parent ${entityName}.${relation.propertyName} for hierarchy level calculation.`);
                } else {
                    parentRelations.get(entityName)!.add(targetEntityName);
                }
            }
        });
    });

    // Second pass: calculate levels
    function calculateLevel(entityName: string, visited = new Set<string>()): number {
        if (visited.has(entityName)) {
            // Attempt to get table name for better warning
            const entityClass = entityMap.get(entityName);
            const tableName = entityClass ? filter.getTableName(entityClass) : entityName;
            console.warn('Circular dependency detected involving table:', tableName);
            // Assign a high level to break cycle, but allow others to proceed
            // Alternatively, could return Infinity or throw an error
            return 1000; // Assign arbitrary high level
        }

        if (hierarchy.has(entityName)) {
            return hierarchy.get(entityName)!;
        }

        const parents = parentRelations.get(entityName) || new Set();
        if (parents.size === 0) {
            hierarchy.set(entityName, 0);
            return 0;
        }

        visited.add(entityName);
        const parentLevels = Array.from(parents).map(p => calculateLevel(p, new Set(visited))); // Pass copy of visited
        visited.delete(entityName); // Backtrack

        const level = Math.max(...parentLevels) + 1;
        // Handle case where circular dependency returned high number
        const safeLevel = level >= 1000 ? 0 : level; 
        hierarchy.set(entityName, safeLevel);
        return safeLevel;
    }

    // Calculate levels for all entities that have relations defined
    for (const entityName of parentRelations.keys()) {
        if (!hierarchy.has(entityName)) { // Only calculate if not already done (e.g. by dependency)
             calculateLevel(entityName);
        }
    }
    
    // Ensure all passed entities get a level (level 0 if no parents/relations)
    entities.forEach(entity => {
        if (!hierarchy.has(entity.name)) {
            hierarchy.set(entity.name, 0);
        }
    });

    return hierarchy; // Map of Entity Class Name -> Level
}

// Define a minimal local interface for ColumnMetadataArgs properties used below
interface MinimalColumnMetadataArgs {
    target: Function | string | undefined; // Allow undefined target for safety
    propertyName: string;
    // Allow any string for mode, as resolveColumnType handles specific known ones
    mode?: string | undefined; 
    options?: {
        type?: any; // Use any for flexibility as TypeORM column types can be complex
        // Add other options used by resolveColumnType if needed
        // Example: enum?: any;
    };
}

// Update function signature to use the minimal interface
function resolveColumnType(colMeta: MinimalColumnMetadataArgs): string {
    const type = colMeta.options?.type;
    // Safely get target name for logging
    const targetName = typeof colMeta.target === 'function' ? colMeta.target.name : String(colMeta.target || 'unknown');

    if (typeof type === 'string') {
        // Basic check if it's a known TypeORM type string
        // This check might need refinement based on specific types used
        const knownTypes: TypeOrmColumnType[] = [
             'int', 'int2', 'int4', 'int8', 'smallint', 'integer', 'bigint',
             'decimal', 'numeric', 'real', 'float', 'float4', 'float8', 'double precision', 'money',
             'character varying', 'varchar', 'character', 'char', 'text', 'citext', 'hstore', 'bytea',
             'bit', 'varbit', 'bit varying',
             'timetz', 'timestamptz', 'timestamp', 'timestamp without time zone', 'timestamp with time zone',
             'date', 'time', 'time without time zone', 'time with time zone', 'interval',
             'bool', 'boolean', 'enum', // Enum type itself is handled by the 'enum' option
             'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle',
             'cidr', 'inet', 'macaddr', 'tsvector', 'tsquery',
             'uuid', 'xml', 'json', 'jsonb',
             'simple-array', 'simple-json', 'simple-enum',
             'int64', 'unsigned big int', // From other drivers, maybe needed?
             'datetime', 'longtext', 'mediumtext', 'tinytext', // MySQL
             'geometry', 'geography', // PostGIS
             'tsrange', // Add specific types you use
             // Add any other custom or specific types used in @Column({ type: ... })
         ];
         if ((knownTypes as string[]).includes(type.toLowerCase())) {
             return type.toLowerCase();
         }
         // Use targetName for logging
         console.warn(`WARN: Unknown string type '${type}' provided for ${targetName}.${colMeta.propertyName}. Using as is.`);
         return type; // Return the unknown string type directly
    }

    // Check specific TypeORM modes
    if (colMeta.mode === 'createDate') return 'timestamptz';
    if (colMeta.mode === 'updateDate') return 'timestamptz';
    if (colMeta.mode === 'deleteDate') return 'timestamptz';
    if (colMeta.mode === 'version') return 'integer';

    // Check reflected type (less reliable) - only if target is an object (Function)
    if (typeof colMeta.target === 'function') { 
        const reflectedType = Reflect.getMetadata("design:type", colMeta.target, colMeta.propertyName);
        if (reflectedType) {
            switch (reflectedType.name) {
                case 'String': return 'text'; // Default string type
                case 'Number':
                    console.warn(`WARN: Inferred 'double precision' for ${targetName}.${colMeta.propertyName} from 'Number' type. If a specific integer, decimal, or other numeric type is required, please specify it explicitly using @Column({ type: 'your_type' }) in the original entity.`);
                    return 'double precision';
                case 'Boolean': return 'boolean';
                case 'Date': return 'timestamptz'; // Default date type
                // case 'Array': return 'simple-array'; // simple-array needs specific handling based on element type
                case 'Buffer': return 'bytea';
            }
        }
    } else {
         console.warn(`WARN: Cannot get reflected type for ${targetName}.${colMeta.propertyName} because target is not a function. Recommend specifying an explicit type in @Column.`);
    }

    // Use targetName for logging
    console.warn(`WARN: Could not resolve column type for ${targetName}.${colMeta.propertyName}. Defaulting to 'text'. Please specify it explicitly using @Column({ type: 'your_type' }) in the original entity.`);
    return 'text'; // Final fallback
}

async function generateContextEntities() {
    const filter = new MetadataFilter();
    const entities = await filter.discoverEntities();
    
    // Ensure generated directory exists
    const generatedDir = path.join(PACKAGE_ROOT, 'src/generated');
    await fs.mkdir(generatedDir, { recursive: true });
    
    console.log('Discovered entities:', entities.map(e => e.name));
    
    // Generate server context
    const serverOutput = generateContextOutput(entities, 'server', filter);
    const serverPath = path.join(generatedDir, 'server-entities.ts');
    await fs.writeFile(serverPath, serverOutput);
    console.log('Generated server entities at:', serverPath);

    // Generate client context
    const clientOutput = generateContextOutput(entities, 'client', filter);
    const clientPath = path.join(generatedDir, 'client-entities.ts');
    await fs.writeFile(clientPath, clientOutput);
    console.log('Generated client entities at:', clientPath);
}

function generateContextOutput(
    entities: Function[],
    context: 'server' | 'client',
    filter: MetadataFilter
): string {
    // Separate parts of the output
    let headerOutput = `// Generated ${context} entities - DO NOT EDIT\n\n`;
    let enumImportOutput = '\n// Enum Imports (dynamically generated)\n'; // Placeholder for dynamic imports
    let enumExportOutput = '\n// Enum Exports\n'; // Placeholder for re-exports
    let classOutput = '\n// Generated Classes (for type checking and validation)\n'; // For generated classes
    let bodyOutput = '\n// Entity Schemas (for TypeORM metadata)\n'; // For schema definitions
    let footerOutput = '\n// Exports\n'; // For final exports like entity arrays

    // Base imports (non-dynamic)
    headerOutput += `import { EntitySchema } from 'typeorm';\n`;
    headerOutput += `import { BaseDomainEntity } from '../entities/BaseDomainEntity.js';\n`;
    headerOutput += `import { BaseSystemEntity } from '../entities/BaseSystemEntity.js';\n`;
    // REMOVE static/hardcoded enum imports here
    // headerOutput += `import { TaskStatus, TaskPriority } from '../entities/Task.js';\n`;
    // headerOutput += `import { ProjectStatus } from '../entities/Project.js';\n`;
    // headerOutput += `import { UserRole } from '../entities/User.js';\n`;
    // headerOutput += `import { MigrationStatus } from '../entities/ClientMigrationStatus.js';\n`;
    // headerOutput += `import { MigrationType, MigrationState } from '../entities/ClientMigration.js';\n`;

    const storage = getMetadataArgsStorage();
    const includedEntityNames: string[] = [];
    const enumsToImport = new Map<string, Set<string>>(); // Key: path, Value: Set<EnumName>

    // Filter entities using the correct helper functions from context.ts
    const validEntities = entities.filter(entity => {
         return context === 'server' ? shouldIncludeInServer(entity) : shouldIncludeInClient(entity);
    });

    // Generate Class Definitions AND EntitySchema definitions
    validEntities.forEach(entity => {
        // Get filtered metadata ONCE for this entity and context
        const { columns, relations } = filter.filterEntityMetadata(entity, context); 
        
        const entityName = entity.name;
        includedEntityNames.push(entityName); // Keep track for final export array (using Schemas)

        // --- Inheritance Handling (Declare ONCE for both Class and Schema) ---
        const parent = Object.getPrototypeOf(entity);
        const inheritsBaseDomain = parent?.name === 'BaseDomainEntity';
        const inheritsBaseSystem = parent?.name === 'BaseSystemEntity';

        // Determine extends clause for Class generation
        let classExtendsClause = '';
        if (inheritsBaseDomain) classExtendsClause = ` extends BaseDomainEntity`; // Assume Base classes are imported
        else if (inheritsBaseSystem) classExtendsClause = ` extends BaseSystemEntity`;

        // --- Generate Class Definition --- 
        // NO @Entity decorator here
        classOutput += `export class ${entityName}${classExtendsClause} {\n`;

        // Add properties to the class based on filtered columns
        columns.forEach(col => {
            const propertyName = col.propertyName;
            // Skip manually added base columns
            if (['id', 'createdAt'/*, 'clientId'*/].includes(propertyName) && (inheritsBaseDomain || inheritsBaseSystem)) {
                 return;
            }

            // Determine TypeScript type for the class property
            const originalColumnMeta = storage.columns.find(c => c.target === entity && c.propertyName === propertyName);
            let tsType = 'any'; // Default
            if (originalColumnMeta) {
                const minimalColMeta: MinimalColumnMetadataArgs = { target: originalColumnMeta.target, propertyName: originalColumnMeta.propertyName, mode: originalColumnMeta.mode, options: originalColumnMeta.options };
                const dbType = resolveColumnType(minimalColMeta);
                // Basic mapping from DB type to TS type (can be enhanced)
                if ([ 'text', 'varchar', 'char', 'character varying', 'character', 'citext', 'string', 'uuid', 'simple-enum' ].includes(dbType)) {
                    tsType = 'string';
                } else if ([ 'int', 'int2', 'int4', 'int8', 'smallint', 'integer', 'bigint', 'decimal', 'numeric', 'real', 'float', 'float4', 'float8', 'double precision', 'money', 'number', 'int64', 'unsigned big int' ].includes(dbType)) {
                    tsType = 'number';
                } else if ([ 'boolean', 'bool' ].includes(dbType)) {
                    tsType = 'boolean';
                } else if ([ 'date', 'time', 'timetz', 'timestamp', 'timestamptz', 'timestamp without time zone', 'timestamp with time zone', 'datetime' ].includes(dbType)) {
                    tsType = 'Date';
                } else if (dbType === 'enum') {
                     // Use the name determined via decorator metadata for the type
                     let explicitEnumName: string | undefined;
                     // Ensure target is a function before accessing prototype for reflection
                     if(typeof originalColumnMeta.target === 'function') {
                         explicitEnumName = Reflect.getMetadata(ENUM_TYPE_NAME_METADATA_KEY, originalColumnMeta.target.prototype, propertyName);
                     } else {
                         console.warn(`WARN: Cannot get decorator metadata for ${entityName}.${propertyName} because target is not a function.`);
                     }

                     if (explicitEnumName && typeof explicitEnumName === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(explicitEnumName)) {
                         tsType = explicitEnumName; // Use the valid name from decorator
                     } else {
                         console.warn(`WARN: Could not get valid enum type name from @EnumTypeName decorator for ${entityName}.${propertyName} class property. Defaulting to 'any'. Ensure @EnumTypeName is used correctly.`);
                         tsType = 'any'; // Fallback if decorator fails
                     }
                } else if (dbType === 'json' || dbType === 'jsonb' || dbType === 'simple-json') {
                     tsType = 'any'; // Or define a specific JSON type/interface
                } else if (dbType === 'bytea') {
                    tsType = 'Buffer';
                } 
                // Handle array types
                if (originalColumnMeta.options?.array) {
                    tsType += '[]';
                }
            } else {
                 console.warn(`WARN: Could not find original metadata for column ${entityName}.${propertyName} when generating class property.`);
            }
            
            const nullable = originalColumnMeta?.options?.nullable ? '?' : '!';
            // NO @Column or other decorators here
            classOutput += `  ${propertyName}${nullable}: ${tsType};\n\n`;
        });

        // Add properties for relations
        relations.forEach(rel => {
            const propertyName = rel.propertyName;
            const originalRelationMeta = storage.relations.find(r => r.target === entity && r.propertyName === propertyName);
            if (!originalRelationMeta) return;

            // Determine target type name (use generated class name)
            const targetEntityGetter = originalRelationMeta.type as () => Function;
            let targetEntityClass: Function | undefined;
            try { targetEntityClass = targetEntityGetter(); } catch { /* ignore */ }
            if (!targetEntityClass || !validEntities.some(validEntity => validEntity.name === targetEntityClass?.name)) {
                 console.log(`INFO: Relation ${entityName}.${propertyName} target ${targetEntityClass?.name} is excluded or invalid. Skipping class property.`);
                 return; // Skip if target is excluded or invalid
            }
            const targetTypeName = targetEntityClass.name; // Use the class name directly
            
            let relationTsType = targetTypeName;
            if ([ 'one-to-many', 'many-to-many' ].includes(originalRelationMeta.relationType)) {
                relationTsType += '[]';
            }
            const nullable = originalRelationMeta.options?.nullable ? '?' : '!';
            // NO relation decorators here
            classOutput += `  ${propertyName}${nullable}: ${relationTsType};\n\n`;
        });

        classOutput += `}\n\n`; // End class definition


        // --- Generate Entity Schema Definition (existing logic) --- 
        const tableName = filter.getTableName(entity);
        const schemaVariableName = `${entityName}Schema`;

        bodyOutput += `// Schema for ${entityName}\n`;
        bodyOutput += `export const ${schemaVariableName} = new EntitySchema<${entityName}>({
`;
        bodyOutput += `    target: ${entityName}, // Link to generated class
`;
        bodyOutput += `    name: '${entityName}', 
`;
        bodyOutput += `    tableName: '${tableName}',\n`;

        // --- Define Columns ---
        bodyOutput += `    columns: {\n`;

        // Manually add Base Columns if inheriting (use camelCase for keys)
        if (inheritsBaseDomain) {
             bodyOutput += `        id: { name: \'id\', type: \'uuid\', primary: true, generated: \'uuid\' },\n`;
             bodyOutput += `        createdAt: { name: \'created_at\', type: \'timestamptz\', createDate: true },\n`; // Use createdAt key
             bodyOutput += `        updatedAt: { name: \'updated_at\', type: \'timestamptz\', updateDate: true },\n`; // Use updatedAt key
             bodyOutput += `        clientId: { name: \'client_id\', type: \'uuid\', nullable: true },\n`; // Use clientId key
        } else if (inheritsBaseSystem) {
             bodyOutput += `        id: { name: \'id\', type: \'uuid\', primary: true, generated: \'uuid\' },\n`;
             bodyOutput += `        createdAt: { name: \'created_at\', type: \'timestamptz\', createDate: true },\n`; 
        }

        // Add columns specific to this entity (using filtered list 'columns')
        columns.forEach(col => { // 'columns' is from the filtered list
            const propertyName = col.propertyName;

            // Skip manually added base columns
            if (['id', 'createdAt'/*, 'clientId'*/].includes(propertyName) && (inheritsBaseDomain || inheritsBaseSystem)) {
                 return;
            }

            const originalColumnMeta = storage.columns.find(c => c.target === entity && c.propertyName === propertyName);
            if (!originalColumnMeta) {
                 console.warn(`WARN: Could not find original metadata for column ${entityName}.${propertyName}. Skipping column generation for schema.`);
                 return;
            }

            // *** Get CORRECT DB Column Name ***
            // Instantiate naming strategy directly
            const namingStrategy = new DefaultNamingStrategy(); 
            const dbColumnName = originalColumnMeta.options?.name || namingStrategy.columnName(propertyName, originalColumnMeta.options?.name || '', []); // Pass empty array for prefixes

            bodyOutput += `        '${propertyName}': {\n`; // Quote property name
            // Use the MinimalColumnMetadataArgs interface here for type safety
            const minimalColMeta: MinimalColumnMetadataArgs = {
                target: originalColumnMeta.target,
                propertyName: originalColumnMeta.propertyName,
                mode: originalColumnMeta.mode,
                options: originalColumnMeta.options
            };
            bodyOutput += `            name: '${dbColumnName}', // Explicit DB Name\n`;
            bodyOutput += `            type: '${resolveColumnType(minimalColMeta)}', // Use helper\n`;

            // Add primary ONLY if not inherited
            if (originalColumnMeta.options?.primary && !inheritsBaseDomain && !inheritsBaseSystem) bodyOutput += `            primary: true,\n`;
            // Add generated ONLY if not inherited
            if (originalColumnMeta.options?.generated && !inheritsBaseDomain && !inheritsBaseSystem) {
                 const genStrategy = originalColumnMeta.options.generated === true ? 'increment' : originalColumnMeta.options.generated;
                 bodyOutput += `            generated: '${genStrategy}',\n`;
            }

            // Add modes only if not handled by base class columns
            if (originalColumnMeta.mode === 'createDate' && !inheritsBaseDomain) bodyOutput += `            createDate: true,\n`;
            if (originalColumnMeta.mode === 'updateDate' || propertyName === 'updatedAt') bodyOutput += `            updateDate: true,\n`;
            if (originalColumnMeta.mode === 'version') bodyOutput += `            version: true,\n`;
            if (originalColumnMeta.mode === 'deleteDate') bodyOutput += `            deleteDate: true,\n`;


            // Common options
            if (originalColumnMeta.options?.nullable) bodyOutput += `            nullable: true,\n`;
            if (originalColumnMeta.options?.length) bodyOutput += `            length: ${originalColumnMeta.options.length},\n`;
            if (originalColumnMeta.options?.width) bodyOutput += `            width: ${originalColumnMeta.options.width},\n`;
            if (originalColumnMeta.options?.precision) bodyOutput += `            precision: ${originalColumnMeta.options.precision},\n`;
            if (originalColumnMeta.options?.scale) bodyOutput += `            scale: ${originalColumnMeta.options.scale},\n`;
            if (originalColumnMeta.options?.unique) bodyOutput += `            unique: true,\n`;
            if (originalColumnMeta.options?.comment) bodyOutput += `            comment: '${originalColumnMeta.options.comment.replace(/'/g, "\'")}',\n`;
            if (originalColumnMeta.options?.default !== undefined) bodyOutput += `            default: ${JSON.stringify(originalColumnMeta.options.default)},\n`; // JSON stringify default
            if (originalColumnMeta.options?.enum) {
                 // Use EnumTypeName decorator metadata to get the enum name string
                 let enumIdentifier = 'UNKNOWN_ENUM';
                 let explicitEnumName: string | undefined = undefined;

                 // Check if target is a function to use reflection for decorator
                 if (typeof originalColumnMeta.target === 'function') {
                    try {
                        // Get the name string directly from the decorator metadata
                        explicitEnumName = Reflect.getMetadata(ENUM_TYPE_NAME_METADATA_KEY, originalColumnMeta.target.prototype, propertyName);
                        const enumSourcePath = Reflect.getMetadata(ENUM_SOURCE_PATH_METADATA_KEY, originalColumnMeta.target.prototype, propertyName);

                        if (explicitEnumName && typeof explicitEnumName === 'string') {
                            enumIdentifier = explicitEnumName;
                            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(enumIdentifier)) {
                                const errorMessage = `ERROR: Invalid enum identifier '${enumIdentifier}' retrieved from @EnumTypeName for ${entityName}.${propertyName}. Must be a valid JavaScript identifier.`;
                                console.error(errorMessage);
                                throw new Error(errorMessage);
                            }

                            let resolvedImportPath: string;
                            const generatedFilePath = path.join(PACKAGE_ROOT, 'src/generated', context === 'server' ? 'server-entities.ts' : 'client-entities.ts');
                            const originalEntityFilePath = path.join(PACKAGE_ROOT, 'src/entities', entityName + '.ts'); // Assume .ts for original

                            if (enumSourcePath && typeof enumSourcePath === 'string') {
                                const absoluteEnumPath = path.resolve(path.dirname(originalEntityFilePath), enumSourcePath);
                                resolvedImportPath = path.relative(path.dirname(generatedFilePath), absoluteEnumPath).replace(/\\/g, '/');
                                if (!resolvedImportPath.startsWith('.')) {
                                    resolvedImportPath = './' + resolvedImportPath;
                                }
                                // Ensure .js extension for relative paths
                                if (resolvedImportPath.startsWith('.')) {
                                  if (resolvedImportPath.endsWith('.ts')) {
                                    resolvedImportPath = resolvedImportPath.slice(0, -3) + '.js';
                                  } else if (!resolvedImportPath.endsWith('.js')) {
                                    resolvedImportPath += '.js';
                                  }
                                }
                            } else {
                                console.warn(`WARN: Enum '${explicitEnumName}' for ${entityName}.${propertyName} does not have an explicit sourcePath in @EnumTypeName. Assuming co-location in '../entities/${entityName}.js'. Consider providing sourcePath for robustness.`);
                                resolvedImportPath = `../entities/${entityName}.js`; // This already has .js
                            }

                            if (!enumsToImport.has(resolvedImportPath)) {
                                enumsToImport.set(resolvedImportPath, new Set<string>());
                            }
                            enumsToImport.get(resolvedImportPath)!.add(enumIdentifier);

                        } else {
                            const errorMessage = `ERROR: Could not determine enum name via @EnumTypeName decorator for enum column ${entityName}.${propertyName}. This decorator is required for 'enum' type columns.`;
                            console.error(errorMessage);
                            throw new Error(errorMessage);
                        }
                    } catch (e) {
                         console.warn(`WARN: Error getting decorator metadata for enum ${entityName}.${propertyName}. Error: ${e}`);
                         const errorMessage = `ERROR: Could not determine enum name via @EnumTypeName decorator for enum column ${entityName}.${propertyName}. This decorator is required for 'enum' type columns.`;
                         console.error(errorMessage);
                         throw new Error(errorMessage);
                    }
                 } else {
                     console.warn(`WARN: Cannot check @EnumTypeName decorator for enum ${entityName}.${propertyName} because target is not a function.`);
                     const errorMessage = `ERROR: Could not determine enum name via @EnumTypeName decorator for enum column ${entityName}.${propertyName}. This decorator is required for 'enum' type columns.`;
                     console.error(errorMessage);
                     throw new Error(errorMessage);
                 }
                 bodyOutput += `            enum: ${enumIdentifier}, // Use name from decorator\n`;
            }
            if (originalColumnMeta.options?.array) bodyOutput += `            array: true,\n`;
            if (originalColumnMeta.options?.select === false) bodyOutput += `            select: false,\n`;
            if (originalColumnMeta.options?.insert === false) bodyOutput += `            insert: false,\n`;
            if (originalColumnMeta.options?.update === false) bodyOutput += `            update: false,\n`;


            // Remove trailing comma from the last property
            bodyOutput = bodyOutput.trimEnd().endsWith(',') ? bodyOutput.trimEnd().slice(0, -1) : bodyOutput.trimEnd();
            bodyOutput += `\n        },\n`;
        });
        // Remove trailing comma from the last column entry
        bodyOutput = bodyOutput.trimEnd().endsWith(',') ? bodyOutput.trimEnd().slice(0, -1) : bodyOutput.trimEnd();
        bodyOutput += `\n    },\n`; // End columns definition

        // --- Define Relations ---
        bodyOutput += `    relations: {\n`;
        relations.forEach(rel => { // 'relations' is the filtered list
            const propertyName = rel.propertyName;
            const originalRelationMeta = storage.relations.find(r => r.target === entity && r.propertyName === propertyName);
            if (!originalRelationMeta) {
                console.warn(`WARN: Could not find original metadata for relation ${entityName}.${propertyName}. Skipping relation generation for schema.`);
                 return;
            }

            // Ensure target entity is valid and WILL BE included in this context
            const targetEntityGetter = originalRelationMeta.type as () => Function;
            let targetEntityClass: Function | undefined;
            try {
                 targetEntityClass = targetEntityGetter();
            } catch (e) {
                 console.warn(`WARN: Could not resolve target entity function for relation ${entityName}.${propertyName}. Error: ${e}`);
                 return;
            }
            if (!targetEntityClass) {
                 console.warn(`WARN: Target entity class resolved to undefined for relation ${entityName}.${propertyName}. Skipping.`);
                 return;
            }
            
            const targetEntityName = targetEntityClass.name;
            
            // Check if the target entity *will be* included in the current context's final list
            // We check against `validEntities` which contains entities filtered for the current context
            const targetEntityWillBeIncluded = validEntities.some(validEntity => validEntity.name === targetEntityName);

            if (!targetEntityWillBeIncluded) {
                console.log(`INFO: Relation ${entityName}.${propertyName} target ${targetEntityName} is excluded from context '${context}'. Skipping relation definition.`);
                return; // Skip relation if target is definitely excluded
            }

            bodyOutput += `        '${propertyName}': {\n`;
            bodyOutput += `            target: '${targetEntityName}', // Target Entity Name (String)\n`;
            bodyOutput += `            type: '${originalRelationMeta.relationType}',\n`;

            // Inverse Side (handle string or function)
            let inverseSide = 'undefined';
            let inverseSideString: string | undefined = undefined;

            if (typeof originalRelationMeta.inverseSideProperty === 'string') {
                inverseSideString = originalRelationMeta.inverseSideProperty;
            } else if (typeof originalRelationMeta.inverseSideProperty === 'function') {
                // console.warn(`WARN: Function provided for inverseSideProperty of ${entityName}.${propertyName}. Attempting to extract property name.`);
                try {
                    const funcStr = originalRelationMeta.inverseSideProperty.toString();
                    let propertyNameFromFunc: string | undefined = undefined;

                    // Try to match different function styles:
                    // 1. Arrow function with implicit return: (param) => param.property or param => param.property
                    let match = funcStr.match(/^\s*\(?\s*([a-zA-Z_]\w*)\s*\)?\s*=>\s*\1\.([a-zA-Z_]\w*)\s*;?\s*$/);
                    if (match && match[2]) {
                        propertyNameFromFunc = match[2];
                    }

                    // 2. Arrow function with explicit return: (param) => { return param.property; } or param => { return param.property; }
                    if (!propertyNameFromFunc) {
                        match = funcStr.match(/^\s*\(?\s*([a-zA-Z_]\w*)\s*\)?\s*=>\s*{\s*return\s+\1\.([a-zA-Z_]\w*)\s*;?\s*}\s*;?\s*$/);
                        if (match && match[2]) {
                            propertyNameFromFunc = match[2];
                        }
                    }

                    // 3. Traditional function: function(param) { return param.property; } or function (param) { return param.property; }
                    if (!propertyNameFromFunc) {
                        match = funcStr.match(/^function\s*\(?\s*([a-zA-Z_]\w*)\s*\)?\s*{\s*return\s+\1\.([a-zA-Z_]\w*)\s*;?\s*}\s*;?\s*$/);
                        if (match && match[2]) {
                            propertyNameFromFunc = match[2];
                        }
                    }
                    
                    // 4. Minified or slightly different arrow function: e=>e.property
                    if (!propertyNameFromFunc) {
                        match = funcStr.match(/^[a-zA-Z_]\w*\s*=>\s*[a-zA-Z_]\w*\.([a-zA-Z_]\w*)$/);
                         if (match && match[1]) {
                            propertyNameFromFunc = match[1];
                        }
                    }

                    if (propertyNameFromFunc) {
                        inverseSideString = propertyNameFromFunc.trim();
                        // console.log(`INFO: Successfully extracted inverseSide property name "${inverseSideString}" for ${entityName}.${propertyName}.`);
                    } else {
                        console.error(`ERROR: Failed to extract inverseSide property name from function string for ${entityName}.${propertyName}. Function string: ${funcStr}`);
                    }
                } catch (e) {
                    console.error(`ERROR: Could not process inverseSideProperty function for ${entityName}.${propertyName}. Error: ${e}`);
                }
            }

            if (inverseSideString) {
                // Important: Use targetEntityName in the lambda parameter type
                // inverseSide = `(entity: ${targetEntityName}) => entity.${inverseSideString}`; // OLD: This creates a string representation of a function
                inverseSide = `'${inverseSideString}'`; // NEW: This creates a string literal of the property name
            }
            
            if (inverseSide !== 'undefined') bodyOutput += `            inverseSide: ${inverseSide},\n`; // This will now output 'propertyName'

             // Instantiate naming strategy (needed for both joinColumn and joinTable)
             const namingStrategy = new DefaultNamingStrategy();

             // *** ADDED CHECK for createForeignKeyConstraints option ***
             if (originalRelationMeta.options?.createForeignKeyConstraints !== false) {
                 // Join Column (use explicit names from metadata)
                 const joinColumnMetas = storage.joinColumns.filter(j => j.target === entity && j.propertyName === propertyName);
                 if (joinColumnMetas.length > 0) {
                     if (joinColumnMetas.length > 1) {
                         console.warn(`WARN: Multiple join columns found for ${entityName}.${propertyName}. Only using the first one for EntitySchema generation.`);
                     }
                     const joinColMeta = joinColumnMetas[0];
                     const joinColName = joinColMeta.name || namingStrategy.joinColumnName(propertyName, targetEntityName);
                     // Referenced column name defaults to the primary column of the target entity if not specified.
                     // We only include it in the schema if it WAS explicitly defined in the decorator.
                     let joinColumnDef = `{ name: '${joinColName}'`;
                     if (joinColMeta.referencedColumnName) {
                         joinColumnDef += `, referencedColumnName: '${joinColMeta.referencedColumnName}'`;
                     }
                     // *** ADDED CHECK FOR foreignKeyConstraintName ***
                     if (joinColMeta.foreignKeyConstraintName) {
                         joinColumnDef += `, foreignKeyConstraintName: '${joinColMeta.foreignKeyConstraintName}'`;
                     }
                     // ***********************************************
                     joinColumnDef += ` }`;
                     bodyOutput += `            joinColumn: ${joinColumnDef},\n`;
                 }
             } // *** END CHECK for createForeignKeyConstraints option ***
             else {
                // Optionally log that the joinColumn is being skipped due to the option
                console.log(`INFO: Skipping joinColumn generation for ${entityName}.${propertyName} because createForeignKeyConstraints is false.`);
             }

            // Join Table (use explicit names from metadata)
            const joinTableMeta = storage.joinTables.find(j => j.target === entity && j.propertyName === propertyName);
            if (joinTableMeta) {
                 const targetTableName = filter.getTableName(targetEntityClass); // Get target table name
                 
                 // Ensure BOTH table names are strings right before the call
                 if (typeof tableName === 'string' && typeof targetTableName === 'string') {
                    // Determine the second property name for the join table naming strategy
                    let secondPropertyName = 'undefined';
                    if (inverseSideString) { // Check the extracted string from lines 545-565
                        secondPropertyName = inverseSideString;
                    } else {
                        // Fallback if inverseSideString could not be extracted
                        secondPropertyName = targetEntityName.charAt(0).toLowerCase() + targetEntityName.slice(1);
                        console.warn(`WARN: Using target entity name '${secondPropertyName}' as fallback for join table naming for relation ${entityName}.${propertyName}, as inverse property string could not be determined.`);
                    }

                    const joinTableName = joinTableMeta.name || namingStrategy.joinTableName(tableName, targetTableName, propertyName, secondPropertyName);
                    let joinColumnsString = 'undefined';
                    if (joinTableMeta.joinColumns) {
                        joinColumnsString = `[${joinTableMeta.joinColumns.map(jc => {
                            const refColName = jc.referencedColumnName || 'id'; // Default ref col
                            return `{ name: '${jc.name}', referencedColumnName: '${refColName}' }`;
                        }).join(', ')}]`;
                    }
                    let inverseJoinColumnsString = 'undefined';
                    if (joinTableMeta.inverseJoinColumns) {
                        inverseJoinColumnsString = `[${joinTableMeta.inverseJoinColumns.map(ijc => {
                            const refColName = ijc.referencedColumnName || 'id'; // Default ref col
                            return `{ name: '${ijc.name}', referencedColumnName: '${refColName}' }`;
                        }).join(', ')}]`;
                    }

                    bodyOutput += `            joinTable: {\n`;
                    bodyOutput += `                name: '${joinTableName}',\n`;
                    bodyOutput += `                joinColumns: ${joinColumnsString},\n`;
                    bodyOutput += `                inverseJoinColumns: ${inverseJoinColumnsString},\n`;
                    bodyOutput += `            },\n`;
                 } else {
                    // Log warnings if either name is missing
                    if (typeof tableName !== 'string') console.warn(`WARN: Could not determine source table name for entity ${entityName}. Skipping JoinTable generation for relation ${propertyName}.`);
                    if (typeof targetTableName !== 'string') console.warn(`WARN: Could not determine target table name for relation ${entityName}.${propertyName} (target: ${targetEntityName}). Skipping JoinTable generation.`);
                 }
             }


            // Other relation options
            if (originalRelationMeta.options?.nullable) bodyOutput += `            nullable: true,\n`;
            if (originalRelationMeta.options?.eager) bodyOutput += `            eager: true,\n`;
            if (originalRelationMeta.options?.cascade) bodyOutput += `            cascade: ${JSON.stringify(originalRelationMeta.options.cascade)},\n`;
            if (originalRelationMeta.options?.onDelete) bodyOutput += `            onDelete: '${originalRelationMeta.options.onDelete}',\n`;
            if (originalRelationMeta.options?.persistence === false) bodyOutput += `            persistence: false,\n`;
            if (originalRelationMeta.options?.orphanedRowAction) bodyOutput += `            orphanedRowAction: '${originalRelationMeta.options.orphanedRowAction}',\n`;


            // Remove trailing comma from the last property
            bodyOutput = bodyOutput.trimEnd().endsWith(',') ? bodyOutput.trimEnd().slice(0, -1) : bodyOutput.trimEnd();
            bodyOutput += `\n        },\n`;
        });
         // Remove trailing comma from the last relation entry
        bodyOutput = bodyOutput.trimEnd().endsWith(',') ? bodyOutput.trimEnd().slice(0, -1) : bodyOutput.trimEnd();
        bodyOutput += `\n    },\n`; // End relations definition

        bodyOutput += `});\n\n`; // End EntitySchema definition
    });

    // Generate Enum Import Block AND Re-Export Block
    for (const [resolvedImportPath, enumNames] of enumsToImport.entries()) {
        if (enumNames.size > 0) {
            const importList = Array.from(enumNames).sort().join(', ');
            enumImportOutput += `import { ${importList} } from '${resolvedImportPath}';\n`;
            // Add re-export statement
            enumExportOutput += `export { ${importList} } from '${resolvedImportPath}';\n`;
        }
    }
    enumImportOutput += '\n'; // Add newline after imports
    enumExportOutput += '\n'; // Add newline after exports

    // Generate Footer Content (Exports etc.)
    footerOutput += `// Export entity class array for TypeORM\n`;
    footerOutput += `export const ${context}Entities = [\n`;
    includedEntityNames.forEach(name => {
        footerOutput += `  ${name}Schema,\n`; // Changed from ${name} to ${name}Schema
    });
    footerOutput += `];\n\n`;

    // ✨ NEW: Extract junction table information
    const { junctionTables, junctionMapping } = extractJunctionTableInfo(validEntities, filter);
    
    // Generate categorized table lists (using includedEntityNames and validEntities)
    const entityMap = new Map(validEntities.map(e => [e.name, e])); // Use validEntities for the map
    const categorizedEntities = new Map<TableCategory, Function[]>();
    categorizedEntities.set('domain', []);
    categorizedEntities.set('system', []);
    categorizedEntities.set('utility', []);

    includedEntityNames.forEach(name => {
        const entity = entityMap.get(name);
        if (entity) {
            const category = getTableCategory(entity) || 'system'; // Default to system if undefined
            // Ensure the category exists in the map before pushing
            if (categorizedEntities.has(category)) {
                categorizedEntities.get(category)?.push(entity);
            } else {
                console.warn(`WARN: Entity ${name} has unknown category: ${category}. Assigning to 'system'.`);
                categorizedEntities.get('system')?.push(entity);
            }
        }
    });

    for (const [category, categoryEntities] of categorizedEntities.entries()) {
        const categoryUpper = category.toUpperCase();
        const contextUpper = context.toUpperCase();
        
        // Always generate the constant, even if empty
        footerOutput += `// ${category} tables for ${context} context\n`;
        footerOutput += `export const ${contextUpper}_${categoryUpper}_TABLES = [\n`;
        if (categoryEntities.length > 0) {
            categoryEntities.forEach(entity => {
                const tableName = filter.getTableName(entity);
                if (tableName) {
                    footerOutput += `  '"${tableName}"',\n`;
                }
            });
        }
        footerOutput += `];\n\n`;

        // Generate hierarchy only for domain tables (moved check inside)
        if (category === 'domain' && categoryEntities.length > 0) {
            const hierarchy = getTableHierarchy(categoryEntities, filter);
            footerOutput += `\n/**\n * Provides entity dependency levels for '${contextUpper}_DOMAIN' tables, useful for ordered operations like seeding or data processing.\n * Key: Entity Class Name, Value: Level (0 = no dependencies/root, 1+ = depends on other tables).\n * Calculated based on many-to-one relationships.\n */\n`;
            footerOutput += `export const ${contextUpper}_DOMAIN_TABLE_HIERARCHY = {\n`; // Changed constant name
            // Iterate hierarchy (Key: Entity Name, Value: Level)
            for (const [entityName, level] of hierarchy.entries()) {
                 // Get the actual entity object using the name
                 const entityClass = entityMap.get(entityName);
                 if (entityClass) {
                     // Get the table name for this entity
                     const tableName = filter.getTableName(entityClass);
                     if (tableName) {
                        footerOutput += `  '"${tableName}"': ${level},\n`;
                     } else {
                         console.warn(`WARN: Could not find table name for entity ${entityName} in hierarchy generation for ${contextUpper}_DOMAIN_TABLE_HIERARCHY.`);
                     }
                 } else {
                     console.warn(`WARN: Entity ${entityName} not found in entityMap during hierarchy generation for ${contextUpper}_DOMAIN_TABLE_HIERARCHY.`);
                 }
            }
             footerOutput += `} as const;\n\n`;
        }
    }
    
    // ✨ NEW: Generate junction table constants
    const contextUpper = context.toUpperCase();
    footerOutput += `// Junction tables for ${context} context\n`;
    footerOutput += `export const ${contextUpper}_JUNCTION_TABLES = [\n`;
    if (junctionTables.length > 0) {
        junctionTables.forEach(tableName => {
            footerOutput += `  '"${tableName.replace(/"/g, '')}"',\n`;
        });
    }
    footerOutput += `];\n\n`;
    
    // Generate combined tracked tables
    footerOutput += `// Combined entity and junction tables for replication tracking\n`;
    footerOutput += `export const ${contextUpper}_TRACKED_TABLES = [\n`;
    
    // Add all domain tables
    const domainEntities = categorizedEntities.get('domain') || [];
    domainEntities.forEach(entity => {
        const tableName = filter.getTableName(entity);
        if (tableName) {
            footerOutput += `  '"${tableName}"',\n`;
        }
    });
    
    // Add all junction tables
    junctionTables.forEach(tableName => {
        footerOutput += `  '"${tableName.replace(/"/g, '')}"',\n`;
    });
    
    footerOutput += `];\n\n`;
    
    // Generate junction table mapping
    footerOutput += `// Junction table mapping for relationship transformation\n`;
    footerOutput += `export const ${contextUpper}_JUNCTION_TABLE_MAPPING = {\n`;
    for (const [tableName, mapping] of Object.entries(junctionMapping)) {
        footerOutput += `  ${tableName}: {\n`;
        footerOutput += `    sourceEntity: '${mapping.sourceEntity}',\n`;
        footerOutput += `    sourceTable: ${mapping.sourceTable},\n`;
        footerOutput += `    sourceColumn: '${mapping.sourceColumn}',\n`;
        footerOutput += `    targetEntity: '${mapping.targetEntity}',\n`;
        footerOutput += `    targetColumn: '${mapping.targetColumn}',\n`;
        footerOutput += `    relationName: '${mapping.relationName}'\n`;
        footerOutput += `  },\n`;
    }
    footerOutput += `} as const;\n\n`;

    // ✨ NEW: Generate relationship configurations
    const relationshipConfigOutput = generateRelationshipConfigs(validEntities, filter, context);
    footerOutput += relationshipConfigOutput;

    // Combine all parts (include enumExportOutput)
    return headerOutput + enumImportOutput + enumExportOutput + classOutput + bodyOutput + footerOutput;
}

/**
 * Extract junction table information from entity metadata
 */
function extractJunctionTableInfo(entities: Function[], filter: MetadataFilter): {
    junctionTables: string[],
    junctionMapping: Record<string, any>
} {
    const storage = getMetadataArgsStorage();
    const junctionTables = new Set<string>();
    const junctionMapping: Record<string, any> = {};
    
    entities.forEach(entity => {
        const entityName = entity.name;
        const tableName = filter.getTableName(entity);
        const { relations } = filter.filterEntityMetadata(entity, 'server');
        
        relations.forEach(relation => {
            // Only process many-to-many relations with joinTable
            if (relation.relationType !== 'many-to-many') return;
            
            const joinTableMeta = storage.joinTables.find(j => 
                j.target === entity && j.propertyName === relation.propertyName
            );
            
            if (joinTableMeta) {
                const relationTypeFn = relation.type as () => Function;
                const targetEntityClass = relationTypeFn();
                const targetEntityName = targetEntityClass?.name;
                const targetTableName = filter.getTableName(targetEntityClass);
                
                if (!targetEntityName || !targetTableName) return;
                
                // Determine junction table name
                const namingStrategy = new DefaultNamingStrategy();
                let junctionTableName = joinTableMeta.name;
                
                if (!junctionTableName) {
                    // Need to determine the inverse property name for naming
                    let inverseSideString = 'undefined';
                    if (relation.inverseSideProperty) {
                        if (typeof relation.inverseSideProperty === 'string') {
                            inverseSideString = relation.inverseSideProperty;
                        } else if (typeof relation.inverseSideProperty === 'function') {
                            const targetRelations = filter.filterEntityMetadata(targetEntityClass, 'server').relations;
                            const targetRelation = targetRelations.find(r => r.type === entity);
                            inverseSideString = targetRelation?.propertyName || targetEntityName.charAt(0).toLowerCase() + targetEntityName.slice(1);
                        }
                    } else {
                        inverseSideString = targetEntityName.charAt(0).toLowerCase() + targetEntityName.slice(1);
                    }
                    
                    junctionTableName = namingStrategy.joinTableName(
                        tableName as string, 
                        targetTableName as string, 
                        relation.propertyName, 
                        inverseSideString
                    );
                }
                
                // Add to junction tables set
                junctionTables.add(`"${junctionTableName}"`);
                
                // Extract column information
                let sourceColumn = 'id';
                let targetColumn = 'id';
                
                if (joinTableMeta.joinColumns && joinTableMeta.joinColumns.length > 0) {
                    sourceColumn = joinTableMeta.joinColumns[0].name || `${entityName.toLowerCase()}_id`;
                }
                
                if (joinTableMeta.inverseJoinColumns && joinTableMeta.inverseJoinColumns.length > 0) {
                    targetColumn = joinTableMeta.inverseJoinColumns[0].name || `${targetEntityName.toLowerCase()}_id`;
                }
                
                // Add to mapping (only if not already added to avoid duplicates)
                if (!junctionMapping[`"${junctionTableName}"`]) {
                    junctionMapping[`"${junctionTableName}"`] = {
                        sourceEntity: entityName,
                        sourceTable: `'"${tableName}"'`,
                        sourceColumn,
                        targetEntity: targetEntityName,
                        targetColumn,
                        relationName: relation.propertyName
                    };
                }
            }
        });
    });
    
    return {
        junctionTables: Array.from(junctionTables).sort(),
        junctionMapping
    };
}

/**
 * Generate relationship configurations from entity metadata
 * This creates auto-extensible relationship configs for both client and server
 */
function generateRelationshipConfigs(entities: Function[], filter: MetadataFilter, context: 'server' | 'client'): string {
    const storage = getMetadataArgsStorage();
    const { junctionMapping } = extractJunctionTableInfo(entities, filter);
    
    let output = `// Auto-generated relationship configurations\n`;
    output += `// This provides configuration-driven relationship handling for entities\n`;
    output += `export interface RelationshipConfig {\n`;
    output += `  requiredReferences?: Array<{\n`;
    output += `    field: string;\n`;
    output += `    targetEntity: string;\n`;
    output += `    nullable?: boolean;\n`;
    output += `  }>;\n`;
    output += `  selfReferences?: Array<{\n`;
    output += `    field: string;\n`;
    output += `    allowCycles?: boolean;\n`;
    output += `    maxDepth?: number;\n`;
    output += `  }>;\n`;
    output += `  junctionRelationships?: Array<{\n`;
    output += `    junctionTable: string;\n`;
    output += `    relationName: string;\n`;
    output += `    sourceColumn: string;\n`;
    output += `    targetColumn: string;\n`;
    output += `    targetEntity: string;\n`;
    output += `  }>;\n`;
    output += `  customValidators?: Array<{\n`;
    output += `    name: string;\n`;
    output += `    validator: (data: Record<string, any>, operation: string) => void | Promise<void>;\n`;
    output += `  }>;\n`;
    output += `}\n\n`;
    
    output += `export const ${context.toUpperCase()}_RELATIONSHIP_CONFIGS: Record<string, RelationshipConfig> = {\n`;
    
    // Extract foreign key relationships from @ManyToOne relations
    const foreignKeyConfigs = extractForeignKeyRelationships(entities, filter);
    
    // Extract self-referential relationships
    const selfReferenceConfigs = extractSelfReferences(entities, filter);
    
    // Group junction relationships by source entity
    const junctionConfigs: Record<string, any[]> = {};
    for (const [junctionTable, mapping] of Object.entries(junctionMapping)) {
        const sourceEntity = mapping.sourceEntity.toLowerCase() + 's'; // e.g., 'projects'
        
        if (!junctionConfigs[sourceEntity]) {
            junctionConfigs[sourceEntity] = [];
        }
        
        junctionConfigs[sourceEntity].push({
            junctionTable: junctionTable.replace(/"/g, ''),
            relationName: mapping.relationName,
            sourceColumn: mapping.sourceColumn,
            targetColumn: mapping.targetColumn,
            targetEntity: mapping.targetEntity.toLowerCase() + 's'
        });
    }
    
    // Get all unique entity names from various sources
    const allEntityNames = new Set<string>();
    
    // Add entities that have foreign key relationships
    Object.keys(foreignKeyConfigs).forEach(name => allEntityNames.add(name));
    
    // Add entities that have self references
    Object.keys(selfReferenceConfigs).forEach(name => allEntityNames.add(name));
    
    // Add entities that have junction relationships
    Object.keys(junctionConfigs).forEach(name => allEntityNames.add(name));
    
    // Add all domain entities (even those without explicit relationships)
    entities.forEach(entity => {
        const category = getTableCategory(entity);
        if (category === 'domain') {
            const entityName = entity.name.toLowerCase() + 's';
            allEntityNames.add(entityName);
        }
    });
    
    // Generate config for each entity
    Array.from(allEntityNames).sort().forEach(entityName => {
        output += `  '${entityName}': {\n`;
        
        // Add foreign key relationships
        if (foreignKeyConfigs[entityName]?.length > 0) {
            output += `    requiredReferences: [\n`;
            foreignKeyConfigs[entityName].forEach((ref: any) => {
                output += `      {\n`;
                output += `        field: '${ref.field}',\n`;
                output += `        targetEntity: '${ref.targetEntity}',\n`;
                if (ref.nullable) {
                    output += `        nullable: ${ref.nullable},\n`;
                }
                output += `      },\n`;
            });
            output += `    ],\n`;
        }
        
        // Add self-referential relationships
        if (selfReferenceConfigs[entityName]?.length > 0) {
            output += `    selfReferences: [\n`;
            selfReferenceConfigs[entityName].forEach((selfRef: any) => {
                output += `      {\n`;
                output += `        field: '${selfRef.field}',\n`;
                output += `        allowCycles: ${selfRef.allowCycles},\n`;
                output += `        maxDepth: ${selfRef.maxDepth},\n`;
                output += `      },\n`;
            });
            output += `    ],\n`;
        }
        
        // Add junction relationships
        if (junctionConfigs[entityName]?.length > 0) {
            output += `    junctionRelationships: [\n`;
            junctionConfigs[entityName].forEach((junction: any) => {
                output += `      {\n`;
                output += `        junctionTable: '${junction.junctionTable}',\n`;
                output += `        relationName: '${junction.relationName}',\n`;
                output += `        sourceColumn: '${junction.sourceColumn}',\n`;
                output += `        targetColumn: '${junction.targetColumn}',\n`;
                output += `        targetEntity: '${junction.targetEntity}',\n`;
                output += `      },\n`;
            });
            output += `    ],\n`;
        }
        
        // Add common validation patterns (can be extended later)
        output += `    customValidators: [],\n`;
        
        output += `  },\n`;
    });
    
    output += `} as const;\n\n`;
    
    // Generate helper functions
    output += `// Helper functions for relationship processing\n`;
    output += `export function getEntityRelationships(entityName: string): RelationshipConfig | undefined {\n`;
    output += `  return ${context.toUpperCase()}_RELATIONSHIP_CONFIGS[entityName];\n`;
    output += `}\n\n`;
    
    output += `export function hasRelationshipConfig(entityName: string): boolean {\n`;
    output += `  return entityName in ${context.toUpperCase()}_RELATIONSHIP_CONFIGS;\n`;
    output += `}\n\n`;
    
    output += `export function getJunctionRelationships(entityName: string): Array<{\n`;
    output += `  junctionTable: string;\n`;
    output += `  relationName: string;\n`;
    output += `  sourceColumn: string;\n`;
    output += `  targetColumn: string;\n`;
    output += `  targetEntity: string;\n`;
    output += `}> {\n`;
    output += `  const config = ${context.toUpperCase()}_RELATIONSHIP_CONFIGS[entityName];\n`;
    output += `  return config?.junctionRelationships || [];\n`;
    output += `}\n\n`;
    
    return output;
}

/**
 * Extract foreign key relationships from @ManyToOne relations
 */
function extractForeignKeyRelationships(entities: Function[], filter: MetadataFilter): Record<string, any[]> {
    const configs: Record<string, any[]> = {};
    
    entities.forEach(entity => {
        const { relations } = filter.filterEntityMetadata(entity, 'server');
        const entityName = entity.name.toLowerCase() + 's';
        
        relations.forEach(relation => {
            if (relation.relationType === 'many-to-one') {
                const targetEntity = (relation.type as () => Function)();
                if (!targetEntity) return;
                
                const targetEntityName = targetEntity.name.toLowerCase() + 's';
                
                // Skip self-references (handled separately)
                if (targetEntityName === entityName) return;
                
                if (!configs[entityName]) {
                    configs[entityName] = [];
                }
                
                // Determine field name (usually propertyName + 'Id')
                let fieldName = relation.propertyName;
                if (!fieldName.endsWith('Id')) {
                    fieldName += 'Id';
                }
                
                configs[entityName].push({
                    field: fieldName,
                    targetEntity: targetEntityName,
                    nullable: relation.options?.nullable || false
                });
            }
        });
    });
    
    return configs;
}

/**
 * Extract self-referential relationships (like comment.parentId)
 */
function extractSelfReferences(entities: Function[], filter: MetadataFilter): Record<string, any[]> {
    const configs: Record<string, any[]> = {};
    
    entities.forEach(entity => {
        const { relations } = filter.filterEntityMetadata(entity, 'server');
        const entityName = entity.name.toLowerCase() + 's';
        
        relations.forEach(relation => {
            if (relation.relationType === 'many-to-one') {
                const targetEntity = (relation.type as () => Function)();
                if (!targetEntity) return;
                
                // Self-referential if target is same as source
                if (targetEntity.name === entity.name) {
                    if (!configs[entityName]) {
                        configs[entityName] = [];
                    }
                    
                    // Determine field name
                    let fieldName = relation.propertyName;
                    if (!fieldName.endsWith('Id')) {
                        fieldName += 'Id';
                    }
                    
                    configs[entityName].push({
                        field: fieldName,
                        allowCycles: false, // Safe default
                        maxDepth: 5 // Reasonable default depth
                    });
                }
            }
        });
    });
    
    return configs;
}

// Run the generator
generateContextEntities().catch(error => {
    console.error('Error generating context entities:', error);
    process.exitCode = 1; // Set exit code for build failures
});