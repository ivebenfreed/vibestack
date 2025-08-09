/**
 * Worker-compatible metadata filter using shims
 * Uses existing TypeORM metadata without file system operations
 */

import { getMetadataArgsStorage } from 'typeorm';
import { isServerOnly, isClientOnly, METADATA_KEYS } from './context.js';

/**
 * Worker-compatible metadata filter that works with imported entities
 * No file system access - relies on TypeORM metadata storage populated by decorators
 */
export class WorkerMetadataFilterShimmed {
    private metadataStorage = getMetadataArgsStorage();

    /**
     * Get all entities from TypeORM metadata storage
     * In worker, entities must be imported before this is called
     */
    getAllEntities() {
        return this.metadataStorage.tables.filter(table => {
            const target = table.target;
            return target && typeof target === 'function';
        });
    }

    /**
     * Get columns for a specific entity
     */
    getColumnsForEntity(entityClass: Function) {
        return this.metadataStorage.columns.filter(column => column.target === entityClass);
    }

    /**
     * Get relations for a specific entity
     */
    getRelationsForEntity(entityClass: Function) {
        return this.metadataStorage.relations.filter(relation => relation.target === entityClass);
    }

    /**
     * Get indices for a specific entity
     */
    getIndicesForEntity(entityClass: Function) {
        return this.metadataStorage.indices.filter(index => index.target === entityClass);
    }

    /**
     * Get join tables (many-to-many relationships)
     */
    getJunctionTables() {
        return this.metadataStorage.joinTables;
    }

    /**
     * Get join columns (foreign key relationships)
     */
    getJoinColumns() {
        return this.metadataStorage.joinColumns;
    }

    /**
     * Check if entity is server-only
     */
    isServerOnly(entityClass: Function): boolean {
        return isServerOnly(entityClass);
    }

    /**
     * Check if entity is client-only
     */
    isClientOnly(entityClass: Function): boolean {
        return isClientOnly(entityClass);
    }

    /**
     * Check if entity is a domain table
     */
    isDomainTable(entityClass: Function): boolean {
        const metadata = Reflect.getMetadata(METADATA_KEYS.TABLE_CATEGORY, entityClass);
        return metadata === 'domain';
    }

    /**
     * Check if entity is a system table
     */
    isSystemTable(entityClass: Function): boolean {
        const metadata = Reflect.getMetadata(METADATA_KEYS.TABLE_CATEGORY, entityClass);
        return metadata === 'system' || metadata === 'utility';
    }

    /**
     * Get entity category
     */
    getEntityCategory(entityClass: Function): 'domain' | 'system' | 'utility' | undefined {
        return Reflect.getMetadata(METADATA_KEYS.TABLE_CATEGORY, entityClass);
    }

    /**
     * Get all enum types used in entities
     */
    getEntityEnums() {
        const enums = new Set<any>();
        
        this.metadataStorage.columns.forEach(column => {
            if (column.options.enum) {
                enums.add(column.options.enum);
            }
        });

        return Array.from(enums);
    }

    /**
     * Get enum type name from decorator
     */
    getEnumTypeName(enumObject: any): string | undefined {
        return Reflect.getMetadata(METADATA_KEYS.ENUM_TYPE_NAME, enumObject);
    }

    /**
     * Check if entity has specific decorator
     */
    hasDecorator(entityClass: Function, decoratorKey: string): boolean {
        return Reflect.hasMetadata(decoratorKey, entityClass);
    }

    /**
     * Get decorator metadata
     */
    getDecoratorMetadata(entityClass: Function, decoratorKey: string): any {
        return Reflect.getMetadata(decoratorKey, entityClass);
    }

    /**
     * Get all unique foreign key relationships
     */
    getForeignKeyRelationships() {
        const relationships = new Map<string, any>();

        this.metadataStorage.relations.forEach(relation => {
            const key = `${relation.target.name}-${relation.propertyName}`;
            if (!relationships.has(key)) {
                relationships.set(key, relation);
            }
        });

        return Array.from(relationships.values());
    }

    /**
     * Filter entities by category
     */
    getEntitiesByCategory(category: 'domain' | 'system' | 'utility') {
        return this.getAllEntities().filter(entity => 
            this.getEntityCategory(entity.target) === category
        );
    }

    /**
     * Get client entities (not server-only)
     */
    getClientEntities() {
        return this.getAllEntities().filter(entity => !this.isServerOnly(entity.target));
    }

    /**
     * Get server entities (not client-only)
     */
    getServerEntities() {
        return this.getAllEntities().filter(entity => !this.isClientOnly(entity.target));
    }

    /**
     * Get domain entities for client
     */
    getClientDomainEntities() {
        return this.getClientEntities().filter(entity => this.isDomainTable(entity.target));
    }

    /**
     * Get system entities for client
     */
    getClientSystemEntities() {
        return this.getClientEntities().filter(entity => !this.isDomainTable(entity.target));
    }
}