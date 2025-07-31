import 'reflect-metadata';
/**
 * Keys used for metadata storage
 */
export const METADATA_KEYS = {
    SERVER_ONLY: 'context:server-only',
    CLIENT_ONLY: 'context:client-only',
    SERVER_ENTITY: 'context:server-entity',
    CLIENT_ENTITY: 'context:client-entity',
    TABLE_CATEGORY: 'context:table-category',
    DEXIE_INDEX: 'context:dexie-index',
};
/**
 * Marks a property or entire entity as server-only.
 * Server-only properties/entities will only be included in server entity definitions.
 */
export function ServerOnly() {
    return function (target, propertyKey) {
        if (propertyKey) {
            // Used as property decorator
            Reflect.defineMetadata(METADATA_KEYS.SERVER_ONLY, true, target, propertyKey);
        }
        else {
            // Used as class decorator
            Reflect.defineMetadata(METADATA_KEYS.SERVER_ENTITY, true, target);
        }
    };
}
/**
 * Marks a property or entire entity as client-only.
 * Client-only properties/entities will only be included in client entity definitions.
 */
export function ClientOnly() {
    return function (target, propertyKey) {
        if (propertyKey) {
            // Used as property decorator
            Reflect.defineMetadata(METADATA_KEYS.CLIENT_ONLY, true, target, propertyKey);
        }
        else {
            // Used as class decorator
            Reflect.defineMetadata(METADATA_KEYS.CLIENT_ENTITY, true, target);
        }
    };
}
/**
 * Checks if a property is marked as server-only
 */
export function isServerOnly(target, propertyKey) {
    return Reflect.getMetadata(METADATA_KEYS.SERVER_ONLY, target, propertyKey) === true;
}
/**
 * Checks if a property is marked as client-only
 */
export function isClientOnly(target, propertyKey) {
    return Reflect.getMetadata(METADATA_KEYS.CLIENT_ONLY, target, propertyKey) === true;
}
/**
 * Checks if a class is marked as server-only entity
 */
export function isServerEntity(target) {
    try {
        return typeof target === 'function' && Reflect.getMetadata(METADATA_KEYS.SERVER_ENTITY, target) === true;
    }
    catch {
        return false;
    }
}
/**
 * Checks if a class is marked as client-only entity
 */
export function isClientEntity(target) {
    try {
        return typeof target === 'function' && Reflect.getMetadata(METADATA_KEYS.CLIENT_ENTITY, target) === true;
    }
    catch {
        return false;
    }
}
/**
 * Marks an entity with a specific table category for classification
 * Categories include:
 * - domain: Business data tables that should be replicated
 * - system: System tables for internal state management
 * - utility: Utility tables for logs, analytics, etc.
 */
export function TableCategory(category) {
    return function (target) {
        Reflect.defineMetadata(METADATA_KEYS.TABLE_CATEGORY, category, target);
    };
}
/**
 * Gets the table category for an entity class
 * Returns undefined if no category is set
 */
export function getTableCategory(target) {
    return Reflect.getMetadata(METADATA_KEYS.TABLE_CATEGORY, target);
}
/**
 * Checks if an entity belongs to a specific category
 */
export function isTableCategory(target, category) {
    return getTableCategory(target) === category;
}
/**
 * Helper function to get all property keys of a class (including inherited ones)
 */
export function getAllPropertyKeys(target) {
    const props = [];
    // Get all properties, including inherited ones
    let currentTarget = target.prototype;
    while (currentTarget && currentTarget !== Object.prototype) {
        // Get own property names (enumerable and non-enumerable)
        const ownProps = Object.getOwnPropertyNames(currentTarget);
        // Filter out methods and special properties
        const propertyKeys = ownProps.filter(key => key !== 'constructor' &&
            typeof currentTarget[key] !== 'function');
        props.push(...propertyKeys);
        // Move up the prototype chain
        currentTarget = Object.getPrototypeOf(currentTarget);
    }
    return [...new Set(props)]; // Remove duplicates
}
/**
 * Helper function to determine if an entity should be included in the server context
 */
export function shouldIncludeInServer(entityClass) {
    // Include if not specifically marked as client-only entity
    return !isClientEntity(entityClass);
}
/**
 * Helper function to determine if an entity should be included in the client context
 */
export function shouldIncludeInClient(entityClass) {
    // Include if not specifically marked as server-only entity
    return !isServerEntity(entityClass);
}
/**
 * Marks a property as requiring a Dexie index for efficient querying
 */
export function DexieIndex() {
    return function (target, propertyKey) {
        Reflect.defineMetadata(METADATA_KEYS.DEXIE_INDEX, true, target, propertyKey);
    };
}
/**
 * Checks if a property is marked for Dexie indexing
 */
export function hasDexieIndex(target, propertyKey) {
    return Reflect.getMetadata(METADATA_KEYS.DEXIE_INDEX, target, propertyKey) === true;
}
/**
 * Gets all properties marked for Dexie indexing on an entity
 */
export function getDexieIndexedProperties(entityClass) {
    const indexedProps = [];
    // Get all properties from the class and its prototype chain
    const propertyKeys = getAllPropertyKeys(entityClass);
    for (const propertyKey of propertyKeys) {
        if (hasDexieIndex(entityClass.prototype, propertyKey)) {
            indexedProps.push(propertyKey);
        }
    }
    return indexedProps;
}
//# sourceMappingURL=context.js.map