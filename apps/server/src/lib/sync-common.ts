import type { TableChange } from '@repo/sync-types';
import { SERVER_DOMAIN_TABLE_HIERARCHY } from '@repo/dataforge/server-entities';
import { getDBClient, sql } from './db'; // Import necessary DB helpers
import type { MinimalContext } from '../types/hono'; // Import context type
import { syncLogger } from '../middleware/logger'; // Import logger
import type { QueryResult } from '@neondatabase/serverless'; // Import QueryResult type
import { NeonService } from './neon-orm/neon-service';
import { RepositoryContainer } from '../domains/RepositoryContainer';

const MODULE_NAME = 'sync-common';

/**
 * Create a ChangeHistoryRepository instance from context
 * Helper function to initialize repository for sync-common operations
 */
function createChangeHistoryRepository(context: MinimalContext): RepositoryContainer {
  // Create a mock Hono context from MinimalContext (similar to EntityOperations pattern)
  const stableRequestId = `sync-${context.env.DATABASE_URL?.slice(-10) || 'default'}`;
  
  const honoContext = {
    req: { 
      header: (name: string) => {
        if (name === 'cf-request-id') {
          return stableRequestId;
        }
        return undefined;
      }
    },
    env: context.env,
    finalized: false,
    error: null,
    get executionCtx() { return null; },
    get event() { return null; },
    var: {},
    get: (key: string) => undefined,
    set: (key: string, value: any) => {},
    json: (data: any) => Promise.resolve(new Response(JSON.stringify(data))),
    text: (text: string) => Promise.resolve(new Response(text))
  } as unknown as any;
  
  const neonService = new NeonService(honoContext);
  return new RepositoryContainer(neonService);
}

/**
 * Compare two LSNs
 * @returns -1 if lsn1 < lsn2, 0 if equal, 1 if lsn1 > lsn2
 */
export function compareLSN(lsn1: string, lsn2: string): number {
  if (lsn1 === lsn2) return 0;
  
  // Parse the LSNs into parts
  const [major1Str, minor1Str] = lsn1.split('/');
  const [major2Str, minor2Str] = lsn2.split('/');
  
  // Convert to numbers correctly (both parts are hex)
  const major1 = parseInt(major1Str || '0', 16); // Fix: Use base 16 for major
  const minor1 = parseInt(minor1Str || '0', 16); // Hex value
  const major2 = parseInt(major2Str || '0', 16); // Fix: Use base 16 for major
  const minor2 = parseInt(minor2Str || '0', 16); // Hex value
  
  // Compare parts
  if (major1 < major2) return -1;
  if (major1 > major2) return 1;
  if (minor1 < minor2) return -1;
  if (minor1 > minor2) return 1;
  return 0;
}

/**
 * Helper to determine if an update operation changes unique fields
 * compared to existing updates
 */
function hasUniqueFieldChanges(update: TableChange, existingUpdates: TableChange[]): {
  hasChanges: boolean;
  fields: string[];
} {
  // Extract the fields being changed in this update (excluding metadata fields)
  const changedFields = Object.keys(update.data).filter(k => 
    k !== 'id' && k !== 'updated_at' && k !== 'client_id'
  );
  
  const uniqueFields: string[] = [];
  
  // Check if any field in this update hasn't been changed in previous updates
  for (const field of changedFields) {
    const fieldAlreadyChanged = existingUpdates.some(existing => 
      Object.keys(existing.data).includes(field)
    );
    
    if (!fieldAlreadyChanged) {
      uniqueFields.push(field);
    }
  }
  
  return {
    hasChanges: uniqueFields.length > 0,
    fields: uniqueFields
  };
}

/**
 * Parse timestamp string to number for comparison
 */
function parseTimestamp(ts: string): number {
  return new Date(ts).getTime();
}

/**
 * Deduplicate changes while preserving important update operations
 * @param changes Array of changes to deduplicate
 * @param clientId Optional client ID to filter out own changes
 * @returns Object containing deduplicated changes and info about skipped changes
 */
export function deduplicateChanges(changes: TableChange[], clientId?: string): {
  changes: TableChange[];
  skipped: {
    missingId: TableChange[];
    outdated: TableChange[];
  };
  transformations: {
    count: number;
    details: Array<{
      from: string;
      to: string;
      entityId: string;
      table: string;
      reason: string;
      timestamp?: string;
      lsn?: string;
      originalTs?: string;
      newTs?: string;
    }>;
  };
  changesByEntity: Record<string, string[]>;
} {
  const result: TableChange[] = [];
  const skipped = {
    missingId: [] as TableChange[],
    outdated: [] as TableChange[],
  };
  const transformations = {
    count: 0,
    details: [] as Array<{
      from: string;
      to: string;
      entityId: string;
      table: string;
      reason: string;
      timestamp?: string;
      lsn?: string;
      originalTs?: string;
      newTs?: string;
    }>,
  };
  const changesByEntity: Record<string, string[]> = {};

  // Group changes by entity
  const changesByEntityId = new Map<string, TableChange[]>();
  for (const change of changes) {
    const entityId = change.data?.id as string | undefined;
    if (!entityId) {
      skipped.missingId.push(change);
      continue;
    }

    const entityChanges = changesByEntityId.get(entityId) || [];
    entityChanges.push(change);
    changesByEntityId.set(entityId, entityChanges);
  }

  // Process each entity's changes
  for (const [entityId, entityChanges] of changesByEntityId.entries()) {
    // Sort changes by timestamp (newest first)
    entityChanges.sort((a, b) => {
      const aTs = parseTimestamp((a.data?.updated_at || a.data?.created_at || '') as string);
      const bTs = parseTimestamp((b.data?.updated_at || b.data?.created_at || '') as string);
      return bTs - aTs;
    });

    // Track changes for this entity
    changesByEntity[entityId] = entityChanges.map(c => (c.data?.id || '') as string);

    // First check if there's a delete operation
    const hasDelete = entityChanges.some(change => change.operation === 'delete');
    const deleteTimestamp = hasDelete 
      ? entityChanges.find(change => change.operation === 'delete')?.data?.updated_at 
      : null;

    let latestChange: TableChange | undefined;
    let latestTimestamp: number;

    // If there's a delete, only keep it and ignore all other operations
    if (hasDelete && deleteTimestamp) {
      latestChange = entityChanges.find(change => 
        change.operation === 'delete' && 
        change.data?.updated_at === deleteTimestamp
      )!;
      
      // Add all other changes to skipped
      entityChanges.forEach(change => {
        if (change.operation !== 'delete' || change.data?.updated_at !== deleteTimestamp) {
          skipped.outdated.push(change);
        }
      });
    } else {
      // Original merging logic for non-delete cases
      latestChange = entityChanges[0]!;
      latestTimestamp = parseTimestamp((latestChange.data?.updated_at || latestChange.data?.created_at || '') as string);

      for (let i = 1; i < entityChanges.length; i++) {
        const currentChange = entityChanges[i]!;
        const currentTimestamp = parseTimestamp((currentChange.data?.updated_at || currentChange.data?.created_at || '') as string);

        // Skip outdated changes
        if (currentTimestamp < latestTimestamp) {
          skipped.outdated.push(currentChange);
          continue;
        }

        // Handle insert + update merge
        if (latestChange && latestChange.operation === 'insert' && currentChange.operation === 'update') {
          latestChange = {
            ...latestChange,
            data: {
              ...latestChange.data,
              ...currentChange.data,
            },
          };
          transformations.count++;
          transformations.details.push({
            from: 'update',
            to: 'insert',
            entityId,
            table: latestChange.table,
            reason: 'merged_update_into_insert',
            timestamp: currentChange.data?.updated_at as string | undefined,
            originalTs: currentChange.data?.updated_at as string | undefined,
            newTs: latestChange.data?.updated_at as string | undefined,
          });
        }
        // Handle update + update merge
        else if (latestChange && latestChange.operation === 'update' && currentChange.operation === 'update') {
          latestChange = {
            ...latestChange,
            data: {
              ...currentChange.data,
              ...latestChange.data,
            },
          };
          transformations.count++;
          transformations.details.push({
            from: 'update',
            to: 'update',
            entityId,
            table: latestChange.table,
            reason: 'merged_update',
            timestamp: currentChange.data?.updated_at as string | undefined,
            originalTs: currentChange.data?.updated_at as string | undefined,
            newTs: latestChange.data?.updated_at as string | undefined,
          });
        }
        // For any other combination, keep the latest change
        else {
          latestChange = currentChange;
          latestTimestamp = currentTimestamp;
        }
      }
    }

    // Add the final change to results
    if (latestChange) {
      result.push(latestChange);
    }
  }

  // Apply client ID filtering - filters out changes from the same client
  const filteredChanges = clientId
    ? result.filter(change => change.data?.clientId !== clientId)
    : result;

  return {
    changes: filteredChanges,
    skipped,
    transformations,
    changesByEntity,
  };
}

type TableName = keyof typeof SERVER_DOMAIN_TABLE_HIERARCHY;

/**
 * Order changes based on table hierarchy and operation type
 * - Creates/Updates: Process parents before children
 * - Deletes: Process children before parents
 */
export function orderChangesByDomain(changes: TableChange[]): TableChange[] {
  // Log tables before sorting
  const beforeTablesCount = changes.reduce((acc, change) => {
    if (change.table) acc.push(change.table);
    return acc;
  }, [] as string[]).length;
  
  // Create a new copy to sort to avoid modifying the original array
  const ordered = [...changes].sort((a, b) => {
    // Add quotes to match SERVER_TABLE_HIERARCHY keys
    const aLevel = SERVER_DOMAIN_TABLE_HIERARCHY[`"${a.table}"` as TableName] ?? 0;
    const bLevel = SERVER_DOMAIN_TABLE_HIERARCHY[`"${b.table}"` as TableName] ?? 0;

    // For deletes, reverse the hierarchy
    if (a.operation === 'delete' && b.operation === 'delete') {
      return bLevel - aLevel;
    }

    // For mixed operations, deletes come last
    if (a.operation === 'delete') return 1;
    if (b.operation === 'delete') return -1;

    // For creates/updates, follow hierarchy
    return aLevel - bLevel;
  });

  // Log tables after sorting
  const afterTablesCount = ordered.reduce((acc, change) => {
    if (change.table) acc.push(change.table);
    return acc;
  }, [] as string[]).length;
  
  // Log if there's a difference
  if (beforeTablesCount !== afterTablesCount) {
    console.error(`TABLE PROPERTY LOST during sort: before=${beforeTablesCount}, after=${afterTablesCount}`);
    
    // Examine properties
    if (changes.length > 0 && ordered.length > 0) {
      console.log('First change before:', Object.keys(changes[0]!));
      console.log('First change after:', Object.keys(ordered[0]!));
    }
  }

  return ordered;
}

/**
 * Get the latest LSN recorded in the change_history table.
 * Returns '0/0' if the table is empty or an error occurs.
 */
export async function getLatestChangeHistoryLSN(context: MinimalContext): Promise<string> {
  try {
    // Try using repository first
    const repositories = createChangeHistoryRepository(context);
    const latestLSN = await repositories.changeHistory.getLatestLSN();
    
    if (latestLSN && latestLSN !== '0/0') {
      return latestLSN;
    }
    
    // Fallback to direct query if repository returns default value
    const result = await sql<{ latest_lsn: string | null }>(context,
      'SELECT MAX(lsn::pg_lsn)::text as latest_lsn FROM change_history;'
    );
    
    const fallbackLSN = result[0]?.latest_lsn;
    
    if (fallbackLSN) {
      return fallbackLSN;
    }
    
    return '0/0'; // Return default if table is empty
  } catch (error) {
    console.error('Error getting latest change history LSN:', error);
    
    // Last resort fallback to direct query
    try {
      const result = await sql<{ latest_lsn: string | null }>(context,
        'SELECT MAX(lsn::pg_lsn)::text as latest_lsn FROM change_history;'
      );
      
      const fallbackLSN = result[0]?.latest_lsn;
      return fallbackLSN || '0/0';
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return '0/0'; // Return default on error
    }
  }
}

/**
 * Field transformer system for PostgreSQL-specific data types
 * Handles conversion of PostgreSQL objects to client-friendly formats
 */

interface FieldTransformer {
  /** Check if this transformer should handle the field */
  canTransform: (fieldName: string, value: any, tableName: string) => boolean;
  /** Transform the field value */
  transform: (fieldName: string, value: any, tableName: string) => any;
  /** Description for debugging */
  description: string;
}

/**
 * Transformer for PostgreSQL tsrange objects to string representation
 */
const tsrangeTransformer: FieldTransformer = {
  canTransform: (fieldName: string, value: any, tableName: string) => {
    const isTsrangeField = fieldName === 'time_range' || fieldName === 'timeRange' || 
                          fieldName.includes('range') || fieldName.includes('Range');
    return isTsrangeField && typeof value === 'object' && value !== null && 
           (value.from || value.to || value.start || value.end);
  },
  
  transform: (fieldName: string, value: any, tableName: string) => {
    const range = value;
    let start: string, end: string;
    
    // Handle different tsrange object formats
    if (range.from && range.to) {
      start = range.from instanceof Date ? range.from.toISOString() : String(range.from);
      end = range.to instanceof Date ? range.to.toISOString() : String(range.to);
    } else if (range.start && range.end) {
      start = range.start instanceof Date ? range.start.toISOString() : String(range.start);
      end = range.end instanceof Date ? range.end.toISOString() : String(range.end);
    } else {
      syncLogger.warn('Unknown tsrange object format', {
        tableName,
        fieldName,
        value: range
      }, MODULE_NAME);
      return null;
    }
    
    // Format as PostgreSQL tsrange: '[start, end)'
    const result = `[${start}, ${end})`;
    
    syncLogger.debug('Transformed tsrange field', {
      tableName,
      fieldName,
      original: range,
      transformed: result
    }, MODULE_NAME);
    
    return result;
  },
  
  description: 'PostgreSQL tsrange object to string'
};

/**
 * Transformer for PostgreSQL interval objects to string representation
 */
const intervalTransformer: FieldTransformer = {
  canTransform: (fieldName: string, value: any, tableName: string) => {
    // Check for field names that typically contain intervals
    const isIntervalField = fieldName.includes('duration') || fieldName.includes('interval') ||
                           fieldName === 'estimated_duration' || fieldName === 'estimatedDuration';
    
    // Check if value is an interval object like {"days": 3} or {"hours": 2, "minutes": 30}
    return isIntervalField && typeof value === 'object' && value !== null &&
           (value.days !== undefined || value.hours !== undefined || value.minutes !== undefined ||
            value.seconds !== undefined || value.months !== undefined || value.years !== undefined);
  },
  
  transform: (fieldName: string, value: any, tableName: string) => {
    const interval = value;
    const parts: string[] = [];
    
    // Build PostgreSQL interval string
    if (interval.years) parts.push(`${interval.years} years`);
    if (interval.months) parts.push(`${interval.months} months`);
    if (interval.days) parts.push(`${interval.days} days`);
    if (interval.hours) parts.push(`${interval.hours} hours`);
    if (interval.minutes) parts.push(`${interval.minutes} minutes`);
    if (interval.seconds) parts.push(`${interval.seconds} seconds`);
    
    const result = parts.join(' ') || '0 seconds';
    
    syncLogger.debug('Transformed interval field', {
      tableName,
      fieldName,
      original: interval,
      transformed: result
    }, MODULE_NAME);
    
    return result;
  },
  
  description: 'PostgreSQL interval object to string'
};

/**
 * Transformer for PostgreSQL array objects to proper array format
 */
const arrayTransformer: FieldTransformer = {
  canTransform: (fieldName: string, value: any, tableName: string) => {
    // Check if it's a PostgreSQL array object that needs transformation
    return typeof value === 'object' && value !== null && 
           Array.isArray(value) && 
           (fieldName.includes('array') || fieldName.includes('list') || fieldName.endsWith('s'));
  },
  
  transform: (fieldName: string, value: any, tableName: string) => {
    // Ensure all array elements are properly formatted
    const result = value.map((item: any) => {
      if (typeof item === 'string' && item.startsWith('"') && item.endsWith('"')) {
        // Remove PostgreSQL string quotes
        return item.slice(1, -1);
      }
      return item;
    });
    
    syncLogger.debug('Transformed array field', {
      tableName,
      fieldName,
      original: value,
      transformed: result
    }, MODULE_NAME);
    
    return result;
  },
  
  description: 'PostgreSQL array formatting'
};

/**
 * Transformer for PostgreSQL JSON strings to parsed objects
 */
const jsonTransformer: FieldTransformer = {
  canTransform: (fieldName: string, value: any, tableName: string) => {
    // Check for JSON-type fields that are still strings
    const isJsonField = fieldName.includes('json') || fieldName.includes('data') ||
                       fieldName === 'metadata' || fieldName === 'settings' ||
                       fieldName === 'config' || fieldName === 'options';
    
    return isJsonField && typeof value === 'string' && 
           (value.startsWith('{') || value.startsWith('['));
  },
  
  transform: (fieldName: string, value: any, tableName: string) => {
    try {
      const result = JSON.parse(value);
      
      syncLogger.debug('Transformed JSON field', {
        tableName,
        fieldName,
        original: value,
        transformed: typeof result
      }, MODULE_NAME);
      
      return result;
    } catch (error) {
      syncLogger.warn('Failed to parse JSON field', {
        tableName,
        fieldName,
        value,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, MODULE_NAME);
      
      return value; // Return original if parsing fails
    }
  },
  
  description: 'PostgreSQL JSON string to object'
};

/**
 * Transformer for PostgreSQL boolean strings to actual booleans
 */
const booleanTransformer: FieldTransformer = {
  canTransform: (fieldName: string, value: any, tableName: string) => {
    // Check for boolean-type fields that are strings
    const isBooleanField = fieldName.includes('is_') || fieldName.includes('has_') ||
                          fieldName.includes('can_') || fieldName.includes('enabled') ||
                          fieldName.includes('active') || fieldName.includes('visible');
    
    return isBooleanField && typeof value === 'string' && 
           (value === 'true' || value === 'false' || value === 't' || value === 'f');
  },
  
  transform: (fieldName: string, value: any, tableName: string) => {
    const result = value === 'true' || value === 't';
    
    syncLogger.debug('Transformed boolean field', {
      tableName,
      fieldName,
      original: value,
      transformed: result
    }, MODULE_NAME);
    
    return result;
  },
  
  description: 'PostgreSQL boolean string to boolean'
};

/**
 * Transformer for PostgreSQL money values to numbers
 */
const moneyTransformer: FieldTransformer = {
  canTransform: (fieldName: string, value: any, tableName: string) => {
    // Check for money-type fields
    const isMoneyField = fieldName.includes('price') || fieldName.includes('cost') ||
                        fieldName.includes('amount') || fieldName.includes('fee') ||
                        fieldName.includes('balance') || fieldName.includes('salary');
    
    return isMoneyField && typeof value === 'string' && 
           (value.startsWith('$') || value.includes('$'));
  },
  
  transform: (fieldName: string, value: any, tableName: string) => {
    // Remove currency symbols and convert to number
    const cleanValue = value.replace(/[$,]/g, '');
    const result = parseFloat(cleanValue);
    
    syncLogger.debug('Transformed money field', {
      tableName,
      fieldName,
      original: value,
      transformed: result
    }, MODULE_NAME);
    
    return isNaN(result) ? 0 : result;
  },
  
  description: 'PostgreSQL money string to number'
};

/**
 * Transformer for PostgreSQL point objects
 */
const pointTransformer: FieldTransformer = {
  canTransform: (fieldName: string, value: any, tableName: string) => {
    // Check for point-type fields
    const isPointField = fieldName.includes('point') || fieldName.includes('location') ||
                        fieldName.includes('position') || fieldName.includes('coordinates');
    
    return isPointField && typeof value === 'string' && 
           value.startsWith('(') && value.endsWith(')');
  },
  
  transform: (fieldName: string, value: any, tableName: string) => {
    // Parse PostgreSQL point format "(x,y)" to {x: number, y: number}
    const coords = value.slice(1, -1).split(',');
    const result = {
      x: parseFloat(coords[0]),
      y: parseFloat(coords[1])
    };
    
    syncLogger.debug('Transformed point field', {
      tableName,
      fieldName,
      original: value,
      transformed: result
    }, MODULE_NAME);
    
    return result;
  },
  
  description: 'PostgreSQL point string to coordinates object'
};

/**
 * Registry of all field transformers
 * Order matters - more specific transformers should come first
 */
const fieldTransformers: FieldTransformer[] = [
  intervalTransformer,     // Must be first to fix immediate error
  jsonTransformer,         // JSON parsing
  booleanTransformer,      // Boolean conversion
  moneyTransformer,        // Money values
  pointTransformer,        // Geographic points
  arrayTransformer,        // Array formatting
  tsrangeTransformer       // Time ranges (existing)
  // Add more transformers here as needed
];

/**
 * Transform a record's fields using registered transformers
 * This ensures PostgreSQL objects are converted to client-friendly formats
 */
export function transformPostgreSQLFields(record: Record<string, any>, tableName: string = 'unknown'): Record<string, any> {
  const transformed = { ...record };
  let transformationCount = 0;
  
  for (const [fieldName, value] of Object.entries(transformed)) {
    if (value === null || value === undefined) continue;
    
    // Try each transformer
    for (const transformer of fieldTransformers) {
      if (transformer.canTransform(fieldName, value, tableName)) {
        const originalValue = value;
        transformed[fieldName] = transformer.transform(fieldName, value, tableName);
        transformationCount++;
        
        syncLogger.debug('Applied field transformation', {
          tableName,
          fieldName,
          transformer: transformer.description,
          original: typeof originalValue === 'object' ? JSON.stringify(originalValue) : originalValue,
          transformed: transformed[fieldName]
        }, MODULE_NAME);
        
        break; // Only apply the first matching transformer
      }
    }
  }
  
  if (transformationCount > 0) {
    syncLogger.debug('Completed field transformations', {
      tableName,
      transformationCount,
      totalFields: Object.keys(record).length
    }, MODULE_NAME);
  }
  
  return transformed;
}

/**
 * Transform an array of TableChange objects to ensure PostgreSQL fields are client-ready
 * This should be called before sending changes to clients
 */
export function transformTableChanges(changes: TableChange[]): TableChange[] {
  return changes.map(change => ({
    ...change,
    data: transformPostgreSQLFields(change.data, change.table)
  }));
}

/**
 * Register a new field transformer
 * Allows extending the transformation system for new PostgreSQL types
 */
export function registerFieldTransformer(transformer: FieldTransformer): void {
  fieldTransformers.push(transformer);
  syncLogger.info('Registered new field transformer', {
    description: transformer.description,
    totalTransformers: fieldTransformers.length
  }, MODULE_NAME);
}

/**
 * Get information about registered transformers (for debugging)
 */
export function getTransformerInfo(): Array<{ description: string; index: number }> {
  return fieldTransformers.map((transformer, index) => ({
    description: transformer.description,
    index
  }));
} 