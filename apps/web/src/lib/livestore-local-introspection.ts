/**
 * LiveStore Local Introspection
 * 
 * Discovers existing local schema and data from persisted LiveStore instances.
 * Enables immediate dashboard loading with cached data before API sync.
 */

import { getLiveStoreForOrg, initializeLiveStoreForOrg } from './livestore-correct-client';

export interface LocalSchemaInfo {
  exists: boolean;
  tables: LocalTableInfo[];
  entityCount: number;
  lastModified: number | null;
  storeVersion: number | null;
}

export interface LocalTableInfo {
  name: string;
  sql: string;
  rowCount: number;
  columns: LocalColumnInfo[];
}

export interface LocalColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
}

export interface LocalDataSummary {
  organizationId: string;
  hasLocalData: boolean;
  schema: LocalSchemaInfo;
  dataStats: Record<string, number>;
  cacheTimestamp: number;
}

/**
 * Check if local LiveStore data exists for organization
 */
export async function checkLocalLiveStoreData(organizationId: string): Promise<LocalDataSummary> {
  console.log(`[LocalIntrospection] 🔍 Checking local data for org: ${organizationId}`);
  
  try {
    // First, try to get existing instance
    let store = getLiveStoreForOrg(organizationId);
    
    // If no instance exists, try to initialize one (this will connect to existing persisted data)
    if (!store) {
      console.log(`[LocalIntrospection] 📦 No active store found, initializing to check persistence...`);
      try {
        store = await initializeLiveStoreForOrg(organizationId);
      } catch (error) {
        console.log(`[LocalIntrospection] ⚠️ Error initializing LiveStore for org ${organizationId}:`, error);
        return {
          organizationId,
          hasLocalData: false,
          schema: { exists: false, tables: [], entityCount: 0, lastModified: null, storeVersion: null },
          dataStats: {},
          cacheTimestamp: Date.now()
        };
      }
    }
    
    // Give the store a moment to be ready if it's initializing
    if (store.ready) {
      try {
        await Promise.race([
          store.ready(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Store ready timeout')), 2000))
        ]);
      } catch (error) {
        console.log(`[LocalIntrospection] ⚠️ Store ready timeout or error:`, error);
        // Continue with introspection anyway, might still work
      }
    }

    console.log(`[LocalIntrospection] 📊 Introspecting local schema...`);

    // Get table information from sqlite_master - handle case where query might fail
    let tables = [];
    try {
      tables = await store.query(
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__livestore_%'"
      );
      console.log(`[LocalIntrospection] ✅ Found ${tables.length} user tables`);
    } catch (error) {
      console.log(`[LocalIntrospection] ⚠️ Failed to query sqlite_master, store may not be ready:`, error);
      // For new stores, this is expected - return no local data
      return {
        organizationId,
        hasLocalData: false,
        schema: { exists: false, tables: [], entityCount: 0, lastModified: null, storeVersion: null },
        dataStats: {},
        cacheTimestamp: Date.now()
      };
    }

    const tableInfo: LocalTableInfo[] = [];
    const dataStats: Record<string, number> = {};
    let totalRows = 0;

    // Get detailed info for each table
    for (const table of tables) {
      try {
        // Get row count
        const countResult = await store.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
        const rowCount = countResult[0]?.count || 0;
        
        // Get column info
        const columns = await store.query(`PRAGMA table_info("${table.name}")`);
        const columnInfo: LocalColumnInfo[] = columns.map((col: any) => ({
          name: col.name,
          type: col.type,
          notNull: col.notnull === 1,
          primaryKey: col.pk === 1
        }));

        tableInfo.push({
          name: table.name,
          sql: table.sql || '',
          rowCount,
          columns: columnInfo
        });

        dataStats[table.name] = rowCount;
        totalRows += rowCount;

        console.log(`[LocalIntrospection]   📋 ${table.name}: ${rowCount} rows, ${columnInfo.length} columns`);
      } catch (error) {
        console.warn(`[LocalIntrospection] ⚠️ Failed to introspect table ${table.name}:`, error);
      }
    }

    // Try to get store metadata
    let storeVersion: number | null = null;
    let lastModified: number | null = null;
    
    try {
      // Check if there's a metadata table or similar
      const versionResult = await store.query(
        "SELECT sql FROM sqlite_master WHERE name LIKE '%version%' OR name LIKE '%meta%'"
      );
      console.log(`[LocalIntrospection] 📝 Metadata tables found:`, versionResult.length);
      
      // Use current timestamp as approximation
      lastModified = Date.now();
    } catch (error) {
      console.log(`[LocalIntrospection] ℹ️ No metadata found, using defaults`);
    }

    const hasLocalData = totalRows > 0 || tables.length > 0;
    
    console.log(`[LocalIntrospection] 🎯 Summary: ${hasLocalData ? 'Local data available' : 'No local data'} (${totalRows} total rows across ${tables.length} tables)`);

    return {
      organizationId,
      hasLocalData,
      schema: {
        exists: tables.length > 0,
        tables: tableInfo,
        entityCount: tables.length,
        lastModified,
        storeVersion
      },
      dataStats,
      cacheTimestamp: Date.now()
    };

  } catch (error) {
    console.error(`[LocalIntrospection] ❌ Failed to check local data for org ${organizationId}:`, error);
    
    return {
      organizationId,
      hasLocalData: false,
      schema: { exists: false, tables: [], entityCount: 0, lastModified: null, storeVersion: null },
      dataStats: {},
      cacheTimestamp: Date.now()
    };
  }
}

/**
 * Extract a simple schema object from local introspection
 * This can be used immediately by components while waiting for API schema
 */
export function createLocalSchemaObject(localData: LocalDataSummary): any {
  if (!localData.hasLocalData) {
    return null;
  }

  const entities: Record<string, any> = {};

  // Convert table info to basic entity definitions
  for (const table of localData.schema.tables) {
    const fields: Record<string, any> = {};
    
    for (const column of table.columns) {
      fields[column.name] = {
        type: mapSQLiteTypeToSchemaType(column.type),
        required: column.notNull,
        syncable: !column.name.startsWith('_') // Assume non-private fields are syncable
      };
    }

    entities[table.name] = {
      extends: 'BaseEntity', // Default base
      tableName: table.name,
      syncableFields: fields
    };
  }

  return {
    orgId: localData.organizationId,
    entities,
    version: 'local-cache',
    cached: true,
    source: 'local-introspection'
  };
}

/**
 * Map SQLite types to schema types
 */
function mapSQLiteTypeToSchemaType(sqliteType: string): string {
  const type = sqliteType.toUpperCase();
  
  if (type.includes('INT')) return 'number';
  if (type.includes('TEXT') || type.includes('VARCHAR') || type.includes('CHAR')) return 'string';
  if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return 'number';
  if (type.includes('BOOL')) return 'boolean';
  if (type.includes('DATE') || type.includes('TIME')) return 'string';
  if (type.includes('JSON') || type.includes('BLOB')) return 'object';
  
  // Default to string for unknown types
  return 'string';
}

/**
 * Check if we should use local data vs wait for API
 */
export function shouldUseLocalDataImmediately(localData: LocalDataSummary): boolean {
  // Use local data if:
  // 1. We have tables with data
  // 2. Data is not too old (within last 24 hours as fallback)
  const hasRecentData = localData.hasLocalData && 
    (localData.schema.lastModified === null || 
     (Date.now() - localData.schema.lastModified < 24 * 60 * 60 * 1000));
  
  const hasUsefulSchema = localData.schema.entityCount > 0;
  
  return hasUsefulSchema && hasRecentData;
}

/**
 * Get local data for specific entity/table
 */
export async function getLocalEntityData(
  organizationId: string, 
  entityName: string, 
  limit: number = 100
): Promise<any[]> {
  try {
    const store = getLiveStoreForOrg(organizationId);
    if (!store) {
      console.warn(`[LocalIntrospection] No store found for org ${organizationId}`);
      return [];
    }

    const results = await store.query(
      `SELECT * FROM "${entityName}" ORDER BY created_at DESC LIMIT ${limit}`
    );

    console.log(`[LocalIntrospection] 📊 Retrieved ${results.length} local records from ${entityName}`);
    return results;
    
  } catch (error) {
    console.warn(`[LocalIntrospection] Failed to get local data for ${entityName}:`, error);
    return [];
  }
}