import 'reflect-metadata';
/**
 * Keys used for metadata storage
 */
export declare const METADATA_KEYS: {
    SERVER_ONLY: string;
    CLIENT_ONLY: string;
    SERVER_ENTITY: string;
    CLIENT_ENTITY: string;
    TABLE_CATEGORY: string;
    DEXIE_INDEX: string;
};
/**
 * Table categories for classification
 */
export type TableCategory = 'domain' | 'system' | 'utility';
/**
 * Marks a property or entire entity as server-only.
 * Server-only properties/entities will only be included in server entity definitions.
 */
export declare function ServerOnly(): PropertyDecorator & ClassDecorator;
/**
 * Marks a property or entire entity as client-only.
 * Client-only properties/entities will only be included in client entity definitions.
 */
export declare function ClientOnly(): PropertyDecorator & ClassDecorator;
/**
 * Checks if a property is marked as server-only
 */
export declare function isServerOnly(target: Object, propertyKey: string | symbol): boolean;
/**
 * Checks if a property is marked as client-only
 */
export declare function isClientOnly(target: Object, propertyKey: string | symbol): boolean;
/**
 * Checks if a class is marked as server-only entity
 */
export declare function isServerEntity(target: Function): boolean;
/**
 * Checks if a class is marked as client-only entity
 */
export declare function isClientEntity(target: Function): boolean;
/**
 * Marks an entity with a specific table category for classification
 * Categories include:
 * - domain: Business data tables that should be replicated
 * - system: System tables for internal state management
 * - utility: Utility tables for logs, analytics, etc.
 */
export declare function TableCategory(category: TableCategory): ClassDecorator;
/**
 * Gets the table category for an entity class
 * Returns undefined if no category is set
 */
export declare function getTableCategory(target: Function): TableCategory | undefined;
/**
 * Checks if an entity belongs to a specific category
 */
export declare function isTableCategory(target: Function, category: TableCategory): boolean;
/**
 * Helper function to get all property keys of a class (including inherited ones)
 */
export declare function getAllPropertyKeys(target: any): string[];
/**
 * Helper function to determine if an entity should be included in the server context
 */
export declare function shouldIncludeInServer(entityClass: Function): boolean;
/**
 * Helper function to determine if an entity should be included in the client context
 */
export declare function shouldIncludeInClient(entityClass: Function): boolean;
/**
 * Marks a property as requiring a Dexie index for efficient querying
 */
export declare function DexieIndex(): PropertyDecorator;
/**
 * Checks if a property is marked for Dexie indexing
 */
export declare function hasDexieIndex(target: Object, propertyKey: string | symbol): boolean;
/**
 * Gets all properties marked for Dexie indexing on an entity
 */
export declare function getDexieIndexedProperties(entityClass: Function): string[];
//# sourceMappingURL=context.d.ts.map