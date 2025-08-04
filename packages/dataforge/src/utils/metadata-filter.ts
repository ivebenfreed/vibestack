import { getMetadataArgsStorage } from 'typeorm';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { isServerOnly, isClientOnly, isServerEntity, isClientEntity, METADATA_KEYS } from './context.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic package root detection - find the directory containing package.json
function findPackageRoot(startDir: string): string {
    let currentDir = startDir;
    while (currentDir !== path.dirname(currentDir)) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        try {
            const fs = require('fs');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                if (packageJson.name === '@repo/dataforge') {
                    return currentDir;
                }
            }
        } catch (e) {
            // Continue searching
        }
        currentDir = path.dirname(currentDir);
    }
    // Fallback to the original logic if package.json not found
    return path.resolve(__dirname, '../..');
}

const PACKAGE_ROOT = findPackageRoot(__dirname);

export class MetadataFilter {
    private readonly metadataStorage = getMetadataArgsStorage();

    /**
     * Discover all entity files in the entities directory
     */
    async discoverEntities(): Promise<Function[]> {
        console.log('PACKAGE_ROOT determined as:', PACKAGE_ROOT);
        const entitiesDir = path.join(PACKAGE_ROOT, 'src/entities');
        console.log('Searching entities in directory:', entitiesDir);
        
        console.log('About to read directory...');
        const files = await fs.readdir(entitiesDir);
        console.log('Directory read completed!');
        
        // Filter for TypeScript files, excluding test files and type definitions
        const entityFiles = files
            .filter(file => file.endsWith('.ts') && 
                           !file.endsWith('.test.ts') && 
                           !file.endsWith('.spec.ts') && 
                           !file.endsWith('.d.ts') &&
                           file !== 'index.ts')
            .map(file => path.join(entitiesDir, file));

        console.log(`Found ${entityFiles.length} entity files`);
        const entities: Function[] = [];

        for (const file of entityFiles) {
            const module = await import(file);
            // Find class with @Entity decorator
            const entityClass = Object.values(module).find(exp => 
                this.metadataStorage.tables.some(t => t.target === exp)
            );
            
            if (entityClass) {
                console.log('Found entity:', (entityClass as any).name);
                entities.push(entityClass as Function);
            }
        }

        return entities;
    }

    /**
     * Filter entity metadata for a specific context
     */
    filterEntityMetadata(entity: Function, context: 'server' | 'client') {
        const isServer = context === 'server';
        const entityName = (entity as any).name;
        
        // Check if entity is context-specific at class level
        if (isServer && isClientEntity(entity)) {
            console.log(`Excluding ${entityName} from server context - marked as ClientOnly`);
            return { columns: [], relations: [] };
        }
        if (!isServer && isServerEntity(entity)) {
            console.log(`Excluding ${entityName} from client context - marked as ServerOnly`);
            return { columns: [], relations: [] };
        }
        
        // Get columns for this entity
        const columns = this.metadataStorage.columns
            .filter(column => column.target === entity)
            .filter(column => {
                if (isServer && isClientOnly(entity.prototype, column.propertyName)) {
                    console.log(`Excluding column ${entityName}.${column.propertyName} from server context - marked as ClientOnly`);
                    return false;
                }
                if (!isServer && isServerOnly(entity.prototype, column.propertyName)) {
                    console.log(`Excluding column ${entityName}.${column.propertyName} from client context - marked as ServerOnly`);
                    return false;
                }
                return true;
            });

        // Get relations for this entity
        const relations = this.metadataStorage.relations
            .filter(relation => relation.target === entity)
            .filter(relation => {
                if (isServer && isClientOnly(entity.prototype, relation.propertyName)) {
                    console.log(`Excluding relation ${entityName}.${relation.propertyName} from server context - marked as ClientOnly`);
                    return false;
                }
                if (!isServer && isServerOnly(entity.prototype, relation.propertyName)) {
                    console.log(`Excluding relation ${entityName}.${relation.propertyName} from client context - marked as ServerOnly`);
                    return false;
                }
                return true;
            });

        return { columns, relations };
    }
    
    /**
     * Get the table name for an entity class
     * Uses the @Entity decorator's name parameter
     */
    getTableName(entity: Function): string | undefined {
        const tableMetadata = this.metadataStorage.tables.find(t => t.target === entity);
        return tableMetadata?.name;
    }
} 