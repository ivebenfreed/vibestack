import { ObjectLiteral } from 'typeorm';

// Cache for string transformations to avoid repeated work
const transformCache = new Map<string, string>();

// Pre-compile regex for better performance
const UNDERSCORE_REGEX = /_([a-z])/g;

/**
 * Transform database results from snake_case to camelCase entity format
 * Optimized for performance with caching
 * 
 * @param row Raw database row with potentially aliased column names
 * @param entityName Entity name (e.g., 'project', 'task', 'user') for handling prefixed columns
 * @returns Transformed entity object with camelCase properties
 */
export function transformDatabaseResultToEntity<T extends ObjectLiteral>(
  row: Record<string, any>,
  entityName: string
): T {
  const result: Record<string, any> = {};
  const entityPrefix = entityName.toLowerCase() + '_';
  const entityPrefixLength = entityPrefix.length;
  
  // Get all keys once to avoid repeated Object.keys() calls
  const keys = Object.keys(row);
  
  // Process each field in the row with optimized operations
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = row[key];
    
    // Handle prefixed fields (e.g., task_id -> id) - optimized string operations
    if (key.startsWith(entityPrefix)) {
      // Convert snake_case to camelCase and remove prefix - avoid substring allocation
      const unprefixedKey = key.slice(entityPrefixLength);
      let camelCaseKey = transformCache.get(unprefixedKey);
      if (!camelCaseKey) {
        camelCaseKey = unprefixedKey.replace(UNDERSCORE_REGEX, (_, letter) => letter.toUpperCase());
        transformCache.set(unprefixedKey, camelCaseKey);
      }
      result[camelCaseKey] = value;
    } else {
      // Handle non-prefixed fields (direct snake_case to camelCase) - use cached transformation
      let camelCaseKey = transformCache.get(key);
      if (!camelCaseKey) {
        camelCaseKey = key.replace(UNDERSCORE_REGEX, (_, letter) => letter.toUpperCase());
        transformCache.set(key, camelCaseKey);
      }
      result[camelCaseKey] = value;
    }
  }
  
  return result as T;
}

/**
 * Transform an array of database results to entity format
 * 
 * @param rows Array of raw database rows
 * @param entityName Entity name for handling prefixed columns
 * @returns Array of transformed entity objects
 */
export function transformDatabaseResultsToEntities<T extends ObjectLiteral>(
  rows: Record<string, any>[],
  entityName: string
): T[] {
  return rows.map(row => transformDatabaseResultToEntity<T>(row, entityName));
}

/**
 * Create a standardized live query callback that handles transformation and cache updates
 * 
 * @param entityName Entity name for transformation
 * @param queryKey TanStack Query cache key
 * @param queryClient TanStack Query client instance
 * @param isArray Whether the result should be an array (true) or single entity (false)
 * @returns Callback function for live query subscriptions
 */
export function createLiveQueryCallback<T extends ObjectLiteral>(
  entityName: string,
  queryKey: (string | number)[],
  queryClient: any,
  isArray: boolean = true
) {
  return (results: any[]) => {
    if (isArray) {
      // Transform array of results
      const transformedResults = transformDatabaseResultsToEntities<T>(results, entityName);
      queryClient.setQueryData(queryKey, transformedResults);
    } else {
      // Transform single result
      const rawResult = results[0] || null;
      const transformedResult = rawResult 
        ? transformDatabaseResultToEntity<T>(rawResult, entityName)
        : null;
      queryClient.setQueryData(queryKey, transformedResult);
    }
  };
}

/**
 * Standard field mapping for common entity transformations
 * This can be extended for entities with special field mappings
 */
export const STANDARD_ENTITY_FIELD_MAPPINGS = {
  // Common fields that might have different naming patterns
  id: ['id', 'uuid'],
  createdAt: ['created_at', 'createdAt'],
  updatedAt: ['updated_at', 'updatedAt'],
  clientId: ['client_id', 'clientId'],
} as const;

/**
 * Get the entity name from a class constructor or string
 * Useful for automatically determining entity names for transformation
 */
export function getEntityName(entity: any): string {
  if (typeof entity === 'string') {
    return entity.toLowerCase();
  }
  
  if (entity.name) {
    return entity.name.toLowerCase();
  }
  
  // Fallback for anonymous functions or objects
  return 'entity';
}

/**
 * Validation helper to ensure transformed entities have required fields
 */
export function validateTransformedEntity<T extends ObjectLiteral>(
  entity: T,
  requiredFields: (keyof T)[] = ['id']
): boolean {
  return requiredFields.every(field => entity[field] !== undefined && entity[field] !== null);
}

/**
 * Debug helper to log transformation details
 */
export function logTransformationDebug(
  entityName: string,
  originalRow: Record<string, any>,
  transformedEntity: ObjectLiteral,
  context: string = ''
): void {
  console.log(`[Transformation${context ? ` ${context}` : ''}] ${entityName}:`, {
    originalKeys: Object.keys(originalRow),
    transformedKeys: Object.keys(transformedEntity),
    hasValidId: !!transformedEntity.id,
    originalRow: originalRow,
    transformedEntity: transformedEntity
  });
} 