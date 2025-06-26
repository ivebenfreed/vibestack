import 'reflect-metadata';

console.log('[generate-crud-operations] Starting script...');

import { extractEntityMetadata, isUserEditableField, FieldMetadata, EntityMetadata } from '../utils/metadata-extraction.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('[generate-crud-operations] About to import client entities...');

// Import the generated client entities (like column-configs does)
import * as ClientEntities from '../generated/client-entities.js';

console.log('[generate-crud-operations] Client entities imported successfully');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

/**
 * Main function to generate CRUD operations for all entities
 */
async function generateCrudOperations() {
    
    // Ensure generated directory exists
    const generatedDir = path.join(PACKAGE_ROOT, 'src/generated');
    await fs.mkdir(generatedDir, { recursive: true });
    
    // Extract entity schemas and classes from generated client entities
    const entitySchemas: Array<{ name: string; schema: any }> = [];
    const entityClasses: Array<{ name: string; entityClass: Function }> = [];
    
    for (const [key, value] of Object.entries(ClientEntities)) {
        if (key.endsWith('Schema') && value && typeof value === 'object' && 'options' in value) {
            const entityName = key.replace('Schema', '');
            entitySchemas.push({ name: entityName, schema: value });
        } else if (typeof value === 'function' && value.prototype && !key.endsWith('Schema')) {
            // Skip utility functions and only include entity classes
            const excludedFunctions = ['getEntityRelationships', 'hasRelationshipConfig', 'getJunctionRelationships'];
            if (!excludedFunctions.includes(key) && value.name && value.name[0] === value.name[0].toUpperCase()) {
                entityClasses.push({ name: key, entityClass: value as Function });
            }
        }
    }
    
    console.log('Found entity schemas:', entitySchemas.map(s => s.name));
    console.log('Found entity classes:', entityClasses.map(e => e.name));
    
    // Get domain table names from the constants
    const domainTableNames = ClientEntities.CLIENT_DOMAIN_TABLES.map(table => table.replace(/"/g, '')); // Remove quotes
    console.log('Domain table names:', domainTableNames);
    
    // Filter for domain entities only (exclude system entities)  
    const domainEntities = entitySchemas.filter(({ name, schema }) => {
        // Access the schema options from the EntitySchema object
        const schemaOptions = schema.options || schema._schema || schema;
        const tableName = schemaOptions.tableName;
        const isDomainTable = domainTableNames.includes(tableName);
        
        console.log(`Entity ${name}: tableName=${tableName}, isDomain=${isDomainTable}`);
        return isDomainTable;
    });
    
    console.log('Generating CRUD operations for domain entities:', domainEntities.map(e => e.name));
    
    // Generate individual entity operation files
    for (const { name: entityName, schema } of domainEntities) {
        const entityClass = entityClasses.find(e => e.name === entityName)?.entityClass;
        if (!entityClass) {
            console.warn(`No entity class found for ${entityName}, skipping...`);
            continue;
        }
        
        const schemaOptions = schema.options || schema._schema || schema;
        const entityMetadata = extractEntityMetadata(entityName, schemaOptions, entityClass);
        const entityOutput = generateEntityCrudFile(entityMetadata);
        const entityPath = path.join(generatedDir, `${entityName.toLowerCase()}-operations.ts`);
        await fs.writeFile(entityPath, entityOutput);
        console.log(`Generated ${entityName} operations at:`, entityPath);
    }
    
    // Generate main export file
    const mainOutput = generateMainExportFile(domainEntities.map(e => e.name));
    const mainPath = path.join(generatedDir, 'crud-operations.ts');
    await fs.writeFile(mainPath, mainOutput);
    console.log('Generated main CRUD operations at:', mainPath);
}

/**
 * Generate CRUD operations for a specific entity using enhanced metadata
 */
function generateEntityCrudFile(entityMetadata: EntityMetadata): string {
    const { name: entityName, tableName, fields } = entityMetadata;
    const lowerEntityName = entityName.toLowerCase();
    
    // Extract enum imports needed for this entity
    const enumImports = fields
        .filter(field => field.enumTypeName)
        .map(field => field.enumTypeName!)
        .filter((name, index, arr) => arr.indexOf(name) === index); // Remove duplicates
    
    return `// Generated ${entityName} CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { ${entityName} } from './client-entities.js';${enumImports.length > 0 ? `\nimport { ${enumImports.join(', ')} } from './client-entities.js';` : ''}

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

${generateEnhancedInputTypes(entityMetadata)}

// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

${generateValidationFunctions(entityMetadata)}

// ============================================================================
// Business Logic Functions - Generated from entity business rules
// ============================================================================

${generateBusinessLogicFunctions(entityMetadata)}

// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

${generateEnhancedUIOperations(entityMetadata)}

// ============================================================================
// 2. INCOMING PATH - Server sync data (Database → Live changes trigger atom)
// ============================================================================

${generateEnhancedIncomingOperations(entityMetadata)}

// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

${generateEnhancedLiveChangesOperations(entityMetadata)}
`;
}

/**
 * Generate enhanced input types with validation comments and proper enum types
 */
function generateEnhancedInputTypes(entityMetadata: EntityMetadata): string {
    const { name: entityName, fields } = entityMetadata;
    const userEditableFields = fields.filter(field => isUserEditableField(field.category));
    
    let output = `export interface Create${entityName}Input {\n`;
    
    userEditableFields.forEach(field => {
        const optionalMarker = field.nullable ? '?' : '';
        let fieldType = field.type;
        
        // Add validation comments above each field
        const validationComments = field.validation
            .map(rule => `  // ${rule.message || `Validation: ${rule.type}`}`)
            .join('\n');
        
        if (validationComments) {
            output += validationComments + '\n';
        }
        
        // Add business logic comments
        const businessComments = field.businessLogic
            .map(rule => `  // Business rule: ${rule.type}`)
            .join('\n');
        
        if (businessComments) {
            output += businessComments + '\n';
        }
        
        output += `  ${field.name}${optionalMarker}: ${fieldType};\n`;
        
        if (field.validation.length > 0 || field.businessLogic.length > 0) {
            output += '\n'; // Add spacing after fields with comments
        }
    });
    
    output += `}\n\n`;
    output += `export interface Update${entityName}Input extends Partial<Create${entityName}Input> {}\n\n`;
    
    return output;
}

/**
 * Generate validation functions based on extracted validation rules
 */
function generateValidationFunctions(entityMetadata: EntityMetadata): string {
    const { name: entityName, fields } = entityMetadata;
    // Only generate validation for user-editable fields
    const fieldsWithValidation = fields.filter(field => 
        field.validation.length > 0 && isUserEditableField(field.category)
    );
    
    if (fieldsWithValidation.length === 0) {
        return `// No validation rules found for ${entityName}\n\n`;
    }
    
    let output = `/**\n * Validation functions for ${entityName}\n */\n\n`;
    
    // Generate individual field validators
    fieldsWithValidation.forEach(field => {
        output += `export function validate${entityName}${field.name.charAt(0).toUpperCase() + field.name.slice(1)}(value: any): string[] {\n`;
        output += `  const errors: string[] = [];\n\n`;
        
        field.validation.forEach(rule => {
            switch (rule.type) {
                case 'required':
                    output += `  if (value === undefined || value === null || value === '') {\n`;
                    output += `    errors.push('${rule.message}');\n`;
                    output += `  }\n\n`;
                    break;
                case 'maxLength':
                    output += `  if (typeof value === 'string' && value.length > ${rule.value}) {\n`;
                    output += `    errors.push('${rule.message}');\n`;
                    output += `  }\n\n`;
                    break;
                case 'email':
                    output += `  if (value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {\n`;
                    output += `    errors.push('${rule.message}');\n`;
                    output += `  }\n\n`;
                    break;
                case 'uuid':
                    output += `  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {\n`;
                    output += `    errors.push('${rule.message}');\n`;
                    output += `  }\n\n`;
                    break;
                case 'enum':
                    const enumValues = Object.values(field.enum || {}).map(v => `'${v}'`).join(', ');
                    output += `  if (value && ![${enumValues}].includes(value)) {\n`;
                    output += `    errors.push('${rule.message}');\n`;
                    output += `  }\n\n`;
                    break;
            }
        });
        
        output += `  return errors;\n`;
        output += `}\n\n`;
    });
    
    // Generate complete entity validator
    output += `export function validate${entityName}Input(input: Create${entityName}Input | Update${entityName}Input): { isValid: boolean; errors: Record<string, string[]> } {\n`;
    output += `  const errors: Record<string, string[]> = {};\n\n`;
    
    fieldsWithValidation.forEach(field => {
        const fieldName = field.name;
        const validatorName = `validate${entityName}${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
        output += `  if ('${fieldName}' in input) {\n`;
        output += `    const fieldErrors = ${validatorName}(input.${fieldName});\n`;
        output += `    if (fieldErrors.length > 0) {\n`;
        output += `      errors.${fieldName} = fieldErrors;\n`;
        output += `    }\n`;
        output += `  }\n\n`;
    });
    
    output += `  return {\n`;
    output += `    isValid: Object.keys(errors).length === 0,\n`;
    output += `    errors\n`;
    output += `  };\n`;
    output += `}\n\n`;
    
    return output;
}

/**
 * Generate business logic functions based on extracted business rules
 */
function generateBusinessLogicFunctions(entityMetadata: EntityMetadata): string {
    const { name: entityName, fields } = entityMetadata;
    const fieldsWithBusinessLogic = fields.filter(field => field.businessLogic.length > 0);
    
    let output = `/**\n * Business logic functions for ${entityName}\n */\n\n`;
    
    // Generate default value functions (always generate, even if empty)
    const fieldsWithDefaults = fields.filter(field => field.default !== undefined);
    output += `export function get${entityName}Defaults(): Partial<Create${entityName}Input> {\n`;
    output += `  return {\n`;
    fieldsWithDefaults.forEach(field => {
        let defaultValue;
        if (field.enumTypeName && typeof field.default === 'string') {
            // For enum fields, try to find the enum constant
            if (field.enum) {
                const enumKey = Object.keys(field.enum).find(key => field.enum[key] === field.default);
                if (enumKey) {
                    defaultValue = `${field.enumTypeName}.${enumKey}`;
                } else {
                    defaultValue = `'${field.default}'`;
                }
            } else {
                defaultValue = `'${field.default}'`;
            }
        } else if (typeof field.default === 'string') {
            defaultValue = `'${field.default}'`;
        } else if (Array.isArray(field.default)) {
            defaultValue = JSON.stringify(field.default);
        } else {
            defaultValue = field.default;
        }
        output += `    ${field.name}: ${defaultValue},\n`;
    });
    output += `  };\n`;
    output += `}\n\n`;
    
    // Generate status transition functions
    const statusField = fields.find(field => field.name === 'status');
    if (statusField && statusField.businessLogic.some(rule => rule.type === 'statusTransitions')) {
        output += `export function canTransition${entityName}Status(fromStatus: ${statusField.type}, toStatus: ${statusField.type}): boolean {\n`;
        output += `  const transitions: Record<${statusField.type}, ${statusField.type}[]> = {\n`;
        
        const transitionRule = statusField.businessLogic.find(rule => rule.type === 'statusTransitions');
        if (transitionRule?.config) {
            Object.entries(transitionRule.config).forEach(([from, toArray]) => {
                const toList = (toArray as string[]).map(s => {
                    // Convert string values to enum references
                    if (statusField.enum) {
                        const enumKey = Object.keys(statusField.enum).find(key => statusField.enum[key] === s);
                        return enumKey ? `${statusField.type}.${enumKey}` : `'${s}'`;
                    }
                    return `'${s}'`;
                }).join(', ');
                
                // Use computed property name for enum keys  
                let fromKey = from;
                if (statusField.enum) {
                    const enumKeyFrom = Object.keys(statusField.enum).find(key => statusField.enum[key] === from);
                    fromKey = enumKeyFrom ? `[${statusField.type}.${enumKeyFrom}]` : `'${from}'`;
                } else {
                    fromKey = `'${from}'`;
                }
                
                output += `    ${fromKey}: [${toList}],\n`;
            });
        }
        
        output += `  };\n\n`;
        output += `  return transitions[fromStatus]?.includes(toStatus) || false;\n`;
        output += `}\n\n`;
    }
    
    // Generate permission check functions
    const fieldsWithPermissions = fieldsWithBusinessLogic.filter(field => 
        field.businessLogic.some(rule => rule.type === 'permissions')
    );
    
    if (fieldsWithPermissions.length > 0) {
        output += `export function get${entityName}RequiredPermissions(operation: 'create' | 'update' | 'delete', fieldName?: string): string[] {\n`;
        output += `  const permissions: string[] = [];\n\n`;
        output += `  if (operation === 'create' || operation === 'update') {\n`;
        output += `    switch (fieldName) {\n`;
        
        fieldsWithPermissions.forEach(field => {
            const permissionRule = field.businessLogic.find(rule => rule.type === 'permissions');
            if (permissionRule?.config) {
                output += `      case '${field.name}':\n`;
                output += `        permissions.push(...${JSON.stringify(permissionRule.config)});\n`;
                output += `        break;\n`;
            }
        });
        
        output += `    }\n`;
        output += `  }\n\n`;
        output += `  return permissions;\n`;
        output += `}\n\n`;
    }
    
    return output;
}

/**
 * Generate enhanced UI operations that use validation and business logic
 */
function generateEnhancedUIOperations(entityMetadata: EntityMetadata): string {
    const { name: entityName, tableName } = entityMetadata;
    const lowerEntityName = entityName.toLowerCase();
    
    return `/**
 * Create ${entityName} from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function create${entityName}UI(
  ${lowerEntityName}Data: Create${entityName}Input,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<${entityName}> {
  console.log(\`[${entityName}Functions-UI] Creating new ${lowerEntityName}\`);
  
  // Validate input if validation function exists
  try {
    const validation = validate${entityName}Input(${lowerEntityName}Data);
    if (!validation.isValid) {
      throw new Error(\`Invalid ${lowerEntityName} data: \${JSON.stringify(validation.errors)}\`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let ${lowerEntityName}WithDefaults;
  try {
    ${lowerEntityName}WithDefaults = {
      ...get${entityName}Defaults(),
      ...${lowerEntityName}Data
    };
  } catch (error) {
    // Defaults function might not exist
    ${lowerEntityName}WithDefaults = {
      ...${lowerEntityName}Data
    };
  }
  
  // 1. OPTIMISTIC: Add to atom immediately with optimistic data
  const optimistic${entityName} = {
    ...${lowerEntityName}WithDefaults,
    createdAt: new Date(),
    updatedAt: new Date()
  } as ${entityName};
  dependencies.atomActions.create${entityName}AtomOnly(optimistic${entityName});
  
  try {
    // 2. DATABASE: Create in database in background
    const ${lowerEntityName}Repo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const created${entityName} = await ${lowerEntityName}Repo.save(${lowerEntityName}WithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('${tableName}', 'insert', {
        ...created${entityName},
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return created${entityName};
    
  } catch (error) {
    // Revert optimistic update on failure
    dependencies.atomActions.delete${entityName}AtomOnly(optimistic${entityName}.id);
    throw error;
  }
}

/**
 * Update ${entityName} from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function update${entityName}UI(
  ${lowerEntityName}Id: string,
  updates: Update${entityName}Input,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<${entityName}> {
  console.log(\`[${entityName}Functions-UI] Updating ${lowerEntityName} \${${lowerEntityName}Id.slice(-8)}\`);
  
  // Validate input if validation function exists
  try {
    const validation = validate${entityName}Input(updates);
    if (!validation.isValid) {
      throw new Error(\`Invalid ${lowerEntityName} update data: \${JSON.stringify(validation.errors)}\`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current ${lowerEntityName} for optimistic update
  const current${entityName}s = dependencies.atomActions.${lowerEntityName}sAtom.get();
  const current${entityName} = current${entityName}s[${lowerEntityName}Id];
  
  if (!current${entityName}) {
    throw new Error(\`${entityName} \${${lowerEntityName}Id} not found for UI update\`);
  }
  
  // 1. OPTIMISTIC: Update atom immediately with optimistic data
  const optimistic${entityName} = { 
    ...current${entityName}, 
    ...updates,
    updatedAt: new Date()
  };
  dependencies.atomActions.update${entityName}AtomOnly(${lowerEntityName}Id, optimistic${entityName});
  
  try {
    // 2. DATABASE: Update database in background
    const ${lowerEntityName}Repo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Only update user-editable fields (exclude TypeORM-managed fields)
    const dbUpdateData = { ...updates };
    
    await ${lowerEntityName}Repo.update(${lowerEntityName}Id, dbUpdateData);
    const updated${entityName} = await ${lowerEntityName}Repo.findOne({ where: { id: ${lowerEntityName}Id } });
    
    if (!updated${entityName}) {
      throw new Error(\`${entityName} \${${lowerEntityName}Id} not found after database update\`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('${tableName}', 'update', {
        ...updated${entityName},
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updated${entityName};
    
  } catch (error) {
    // Revert optimistic update on failure
    dependencies.atomActions.update${entityName}AtomOnly(${lowerEntityName}Id, current${entityName});
    throw error;
  }
}

/**
 * Delete ${entityName} from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function delete${entityName}UI(
  ${lowerEntityName}Id: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(\`[${entityName}Functions-UI] Deleting ${lowerEntityName} \${${lowerEntityName}Id.slice(-8)}\`);
  
  // Get current ${lowerEntityName} for potential revert
  const current${entityName}s = dependencies.atomActions.${lowerEntityName}sAtom.get();
  const ${lowerEntityName}ToDelete = current${entityName}s[${lowerEntityName}Id];
  
  if (!${lowerEntityName}ToDelete) {
    throw new Error(\`${entityName} \${${lowerEntityName}Id} not found for UI delete\`);
  }
  
  // 1. OPTIMISTIC: Remove from atom immediately
  dependencies.atomActions.delete${entityName}AtomOnly(${lowerEntityName}Id);
  
  try {
    // 2. DATABASE: Delete from database
    const ${lowerEntityName}Repo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await ${lowerEntityName}Repo.delete(${lowerEntityName}Id);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(\`${entityName} \${${lowerEntityName}Id} could not be deleted from database\`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('${tableName}', 'delete', {
        id: ${lowerEntityName}Id,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return true;
    
  } catch (error) {
    // Restore ${lowerEntityName} on failure
    dependencies.atomActions.create${entityName}AtomOnly(${lowerEntityName}ToDelete);
    throw error;
  }
}

`;
}

/**
 * Generate enhanced incoming operations (database only)
 */
function generateEnhancedIncomingOperations(entityMetadata: EntityMetadata): string {
    const { name: entityName, tableName } = entityMetadata;
    const lowerEntityName = entityName.toLowerCase();
    
    return `/**
 * Create ${entityName} from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function create${entityName}Incoming(
  ${lowerEntityName}Data: ${entityName},
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<${entityName}> {
  console.log(\`[${entityName}Functions-Incoming] Creating ${lowerEntityName} \${${lowerEntityName}Data.id.slice(-8)} from server sync\`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const ${lowerEntityName}Repo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const created${entityName} = await ${lowerEntityName}Repo.save(${lowerEntityName}Data);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return created${entityName};
}

/**
 * Update ${entityName} from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function update${entityName}Incoming(
  ${lowerEntityName}Id: string,
  updates: Partial<${entityName}>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<${entityName}> {
  console.log(\`[${entityName}Functions-Incoming] Updating ${lowerEntityName} \${${lowerEntityName}Id.slice(-8)} from server sync\`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const ${lowerEntityName}Repo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await ${lowerEntityName}Repo.update(${lowerEntityName}Id, updates);
  const updated${entityName} = await ${lowerEntityName}Repo.findOne({ where: { id: ${lowerEntityName}Id } });
  
  if (!updated${entityName}) {
    throw new Error(\`${entityName} \${${lowerEntityName}Id} not found after incoming update\`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updated${entityName};
}

/**
 * Delete ${entityName} from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function delete${entityName}Incoming(
  ${lowerEntityName}Id: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(\`[${entityName}Functions-Incoming] Deleting ${lowerEntityName} \${${lowerEntityName}Id.slice(-8)} from server sync\`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const ${lowerEntityName}Repo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await ${lowerEntityName}Repo.delete(${lowerEntityName}Id);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}

`;
}

/**
 * Generate enhanced live changes operations (atom only)
 */
function generateEnhancedLiveChangesOperations(entityMetadata: EntityMetadata): string {
    const { name: entityName } = entityMetadata;
    const lowerEntityName = entityName.toLowerCase();
    
    return `/**
 * Create ${entityName} from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function create${entityName}LiveChanges(
  ${lowerEntityName}Data: ${entityName},
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(\`[${entityName}Functions-LiveChanges] Reflecting ${lowerEntityName} \${${lowerEntityName}Data.id.slice(-8)} database create in atom\`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.create${entityName}AtomOnly(${lowerEntityName}Data);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update ${entityName} from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function update${entityName}LiveChanges(
  ${lowerEntityName}Id: string,
  updates: Partial<${entityName}>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(\`[${entityName}Functions-LiveChanges] Reflecting ${lowerEntityName} \${${lowerEntityName}Id.slice(-8)} database change in atom\`);
  
  // ATOM ONLY: Update atom to reflect database change
  const current${entityName}s = dependencies.atomActions.${lowerEntityName}sAtom.get();
  const current${entityName} = current${entityName}s[${lowerEntityName}Id];
  
  if (!current${entityName}) {
    console.warn(\`[${entityName}Functions-LiveChanges] ${entityName} \${${lowerEntityName}Id} not found in atom for live update\`);
    return;
  }
  
  const updated${entityName} = { ...current${entityName}, ...updates };
  dependencies.atomActions.update${entityName}AtomOnly(${lowerEntityName}Id, updated${entityName});
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete ${entityName} from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function delete${entityName}LiveChanges(
  ${lowerEntityName}Id: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(\`[${entityName}Functions-LiveChanges] Reflecting ${lowerEntityName} \${${lowerEntityName}Id.slice(-8)} database delete in atom\`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.delete${entityName}AtomOnly(${lowerEntityName}Id);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

`;
}

/**
 * Generate main export file
 */
function generateMainExportFile(entities: string[]): string {
    let output = `// Generated CRUD operations - DO NOT EDIT
// This file exports all entity-specific CRUD operations

`;

    // Generate exports for each entity
    entities.forEach(entityName => {
        const fileName = `${entityName.toLowerCase()}-operations.js`;
        
        output += `// ${entityName} operations\n`;
        output += `export {\n`;
        output += `  type Create${entityName}Input,\n`;
        output += `  type Update${entityName}Input,\n`;
        output += `  validate${entityName}Input,\n`;
        output += `  get${entityName}Defaults,\n`;
        output += `  create${entityName}UI,\n`;
        output += `  update${entityName}UI,\n`;
        output += `  delete${entityName}UI,\n`;
        output += `  create${entityName}Incoming,\n`;
        output += `  update${entityName}Incoming,\n`;
        output += `  delete${entityName}Incoming,\n`;
        output += `  create${entityName}LiveChanges,\n`;
        output += `  update${entityName}LiveChanges,\n`;
        output += `  delete${entityName}LiveChanges,\n`;
        output += `} from './${fileName}';\n\n`;
    });

    return output;
}

// Run the generator
async function main() {
    try {
        console.log('[main] Starting CRUD generation...');
        await generateCrudOperations();
        console.log('✅ CRUD operations generation completed successfully');
    } catch (error) {
        console.error('❌ Error generating CRUD operations:', error);
        console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
        process.exitCode = 1;
    }
}

console.log('[generate-crud-operations] About to call main()...');
main().catch(err => {
    console.error('[generate-crud-operations] Unhandled error in main:', err);
    process.exit(1);
});