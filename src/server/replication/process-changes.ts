import type { TableChange, RelationshipUpdate } from '@/types/sync';
import { replicationLogger } from '../middleware/logger';
import type { MinimalContext } from '../types/hono';
import type { WALData, PostgresWALMessage } from '../types/wal';
import { parsePostgreSQLValue } from '../lib/postgresql-type-parser';
import type { WebSocketHandler } from '../sync/types';
import { transformWALChangesWithOrg } from './org-aware-process-changes';

// Helper type for WAL change records
type WALChangeRecord = NonNullable<PostgresWALMessage['change']>[number];
import { sql } from '../lib/db';
import { StateManager } from './state-manager';

import { DynamicTableDiscovery } from './dynamic-table-discovery';
import type { Env } from '../types/env';
import { Kysely } from 'kysely';
import type { Database } from '@repo/dataforge/kysely-types';
import { createDatabaseConnection, getKysely } from '../lib/database-manager';

// ====== Types and Interfaces ======
const MODULE_NAME = 'process-changes';


// ====== Constants ======
const DEFAULT_STORE_BATCH_SIZE = 500;

// Dynamic table discovery instance (initialized per operation)
let tableDiscovery: DynamicTableDiscovery | null = null;

// ====== Helper Functions ======

// Initialize dynamic table discovery
async function getTableDiscovery(env: Env): Promise<DynamicTableDiscovery> {
  if (!tableDiscovery) {
    // Initialize database connection
    createDatabaseConnection(env);
    const kysely = getKysely();
    tableDiscovery = new DynamicTableDiscovery(kysely, env);
  }
  return tableDiscovery;
}

// ✨ UPDATED: Junction table detection (simplified for now)
function isJunctionTable(tableName: string): boolean {
  // TODO: Implement junction table detection via dynamic discovery
  return tableName.includes('_to_') || tableName.endsWith('_junction');
}

function extractColumnValue(change: WALChangeRecord, columnName: string): string | null {
  if (change.columnnames && change.columnvalues) {
    const index = change.columnnames.indexOf(columnName);
    if (index !== -1 && index < change.columnvalues.length) {
      return String(change.columnvalues[index]);
    }
  }
  
  // For delete operations, check oldkeys
  if (change.oldkeys?.keynames && change.oldkeys?.keyvalues) {
    const index = change.oldkeys.keynames.indexOf(columnName);
    if (index !== -1 && index < change.oldkeys.keyvalues.length) {
      return String(change.oldkeys.keyvalues[index]);
    }
  }
  
  return null;
}

async function getCurrentRelationshipIds(
  context: MinimalContext,
  sourceTable: string, 
  sourceId: string, 
  relationName: string
): Promise<string[]> {
  // Junction table processing is deprecated - return empty array
  replicationLogger.debug('Junction table processing disabled (deprecated)', {
    sourceTable,
    sourceId,
    relationName
  }, MODULE_NAME);
  
  return [];
}

async function transformJunctionTableChange(
  context: MinimalContext,
  change: WALChangeRecord, 
  lsn: string
): Promise<TableChange | null> {
  const junctionInfo = (SERVER_JUNCTION_TABLE_MAPPING as any)[change.table];
  if (!junctionInfo) return null;
  
  try {
    // Convert camelCase column names to snake_case for WAL extraction
    const sourceColumnSnake = camelToSnake(junctionInfo.sourceColumn);
    const targetColumnSnake = camelToSnake(junctionInfo.targetColumn);
    
    // Extract entity IDs from junction table operation
    const sourceId = extractColumnValue(change, sourceColumnSnake);
    const targetId = extractColumnValue(change, targetColumnSnake);
    
    if (!sourceId) {
      replicationLogger.warn('Could not extract source ID from junction table change', {
        table: change.table,
        sourceColumn: junctionInfo.sourceColumn,
        sourceColumnSnake: sourceColumnSnake,
        availableColumns: change.columnnames || []
      }, MODULE_NAME);
      return null;
    }
    
    // Query current relationship state
    const currentTargetIds = await getCurrentRelationshipIds(
      context,
      junctionInfo.sourceTable,
      sourceId,
      junctionInfo.relationName
    );
    
    return {
      table: junctionInfo.sourceTable.replace(/"/g, ''), // Remove quotes for consistency
      operation: 'update',
      data: { id: sourceId },
      relationshipUpdates: [{
        relationName: junctionInfo.relationName,
        operation: 'set',
        targetIds: currentTargetIds
      }],
      entityRelations: [junctionInfo.relationName],
      updatedAt: new Date().toISOString(),  // Use camelCase as per TableChange interface
      lsn
    };
  } catch (error) {
    replicationLogger.error('Failed to transform junction table change', {
      error: error instanceof Error ? error.message : String(error),
      table: change.table
    }, MODULE_NAME);
    return null;
  }
}

// Async version for dynamic table discovery
export async function shouldTrackTable(tableName: string, env: Env): Promise<boolean> {
  try {
    const discovery = await getTableDiscovery(env);
    
    // Remove quotes for consistency
    const normalizedTableName = tableName.replace(/"/g, '');
    
    return await discovery.isTrackableTable(normalizedTableName);
  } catch (error) {
    replicationLogger.error('Failed to check if table should be tracked', {
      tableName,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    
    // Fallback: track if it looks like an org table or base table
    const normalizedTableName = tableName.replace(/"/g, '');
    return (
      normalizedTableName.match(/^org_[0-9a-fA-F]{8}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{12}_[a-zA-Z_][a-zA-Z0-9_]*$/) !== null || // Org table with UUIDv7
      ['users', 'organization', 'organization_member', 'session'].includes(normalizedTableName) // Base tables
    );
  }
}

// Synchronous version for compatibility (uses heuristics)
export function shouldTrackTableSync(tableName: string): boolean {
  const normalizedTableName = tableName.replace(/"/g, '');
  
  // System tables - never track
  const systemTables = ['change_history', 'sync_statistics', 'system_logs', 'replication_slot_status'];
  if (systemTables.includes(normalizedTableName) || normalizedTableName.startsWith('pg_')) {
    return false;
  }
  
  // Base tables - always track
  const baseTables = ['users', 'organization', 'organization_member', 'session', 'account', 'verification', 'entity_schemas', 'schema_metadata'];
  if (baseTables.includes(normalizedTableName)) {
    return true;
  }
  
  // Organization-specific tables - track if matches UUIDv7 pattern
  return normalizedTableName.match(/^org_[0-9a-fA-F]{8}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{12}_[a-zA-Z_][a-zA-Z0-9_]*$/) !== null;
}

// Dynamic table discovery replaces static tracking
replicationLogger.info('Dynamic replication tracking initialized', { 
  mode: 'dynamic-discovery',
  note: 'Tables will be discovered dynamically from database and organization configurations'
}, MODULE_NAME);

/**
 * Get list of all active client IDs from org-aware client registry
 * Returns clients from all organizations
 */
export async function getAllClientIds(env: Env, timeout = 10 * 60 * 1000): Promise<string[]> {
  try {
    const { UnifiedClientRegistry } = await import('../sync/unified-client-registry');
    const unifiedRegistry = new UnifiedClientRegistry({ env });
    const stats = await unifiedRegistry.getRegistryStats();
    
    // Get all active clients from all organizations
    const allClientIds: string[] = [];
    for (const [orgId] of Object.entries(stats.organizationClients)) {
      const orgClients = await unifiedRegistry.getOrgActiveClients(orgId);
      allClientIds.push(...orgClients);
      
      replicationLogger.debug('Retrieved clients for organization', {
        organizationId: orgId,
        clientCount: orgClients.length,
        clients: orgClients
      }, MODULE_NAME);
    }
    
    replicationLogger.debug('Retrieved all active client IDs from org-aware registry', {
      totalClients: allClientIds.length,
      organizationCount: Object.keys(stats.organizationClients).length
    }, MODULE_NAME);
    
    return allClientIds;
  } catch (error) {
    replicationLogger.error('Client retrieval failed', {
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
    return [];
  }
}

// ====== Core Processing Functions ======
export async function transformWALChanges(
  changes: WALData[], 
  context: MinimalContext
): Promise<{ 
  tableChanges: TableChange[], 
  filteredReasons: Record<string, number> 
}> {
  const tableChanges: TableChange[] = [];
  const filteredReasons: Record<string, number> = {};
  // ✨ NEW: Track relationship updates by entity for accumulation
  const relationshipUpdates = new Map<string, RelationshipUpdate[]>();
  // Track change count per WAL entry to improve logging
  let totalChangesInWAL = 0;
  // Track changes by table and operation for summary logging
  const changesByTable: Record<string, Record<string, number>> = {};

  // Simple count only
  replicationLogger.debug(`Processing ${changes.length} WAL entries`, {}, MODULE_NAME);

  for (const wal of changes) {
    // Early filtering: Skip entries with no data
    if (!wal.data) {
      addFilterReason(filteredReasons, 'No WAL data');
      continue;
    }

    // Fast pre-check before parsing JSON
    if (!wal.data.includes('"table"')) {
      addFilterReason(filteredReasons, 'No table data in WAL entry');
      continue;
    }
    
    let parsedData: PostgresWALMessage;
    
    // Isolated JSON parsing in its own try/catch
    try {
      parsedData = JSON.parse(wal.data) as PostgresWALMessage;
    } catch (error) {
      addFilterReason(filteredReasons, `JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
      replicationLogger.error('WAL JSON parse error', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      continue;
    }
    
    // Structure validation after parsing
    if (!parsedData?.change || !Array.isArray(parsedData.change)) {
      addFilterReason(filteredReasons, 'Invalid WAL data structure');
      continue;
    }

    // Count total changes for metrics
    totalChangesInWAL += parsedData.change.length;
    
    // Process changes with early table filtering
    for (const change of parsedData.change) {
      try {
        // Quick structural validation
        if (!change?.schema || !change?.table) {
          addFilterReason(filteredReasons, 'Missing schema or table');
          continue;
        }
        
        // Early table tracking check (use sync version for performance)
        if (!shouldTrackTableSync(change.table)) {
          addFilterReason(filteredReasons, `Table ${change.table} not in tracked tables`);
          continue;
        }

        
        // Track for summary stats
        if (!changesByTable[change.table]) {
          changesByTable[change.table] = {};
        }
        if (!changesByTable[change.table]![change.kind]) {
          changesByTable[change.table]![change.kind] = 0;
        }
        changesByTable[change.table]![change.kind]!++;

        // ✨ NEW: Check if this is a junction table operation
        if (isJunctionTable(change.table)) {
          const relationshipChange = await transformJunctionTableChange(context, change, wal.lsn);
          if (relationshipChange) {
            // Accumulate relationship updates by entity
            const entityKey = `${relationshipChange.table}:${relationshipChange.data.id}`;
            if (!relationshipUpdates.has(entityKey)) {
              relationshipUpdates.set(entityKey, []);
            }
            relationshipUpdates.get(entityKey)!.push(...(relationshipChange.relationshipUpdates || []));
          }
          continue; // Don't add junction table as separate change
        }

        // Regular entity processing (existing logic)
        // Extract data efficiently
        const snakeCaseData: Record<string, unknown> = {};
        
        // Column data extraction
        if (change.columnnames && Array.isArray(change.columnnames) && 
            change.columnvalues && Array.isArray(change.columnvalues)) {
          const colCount = Math.min(change.columnnames.length, change.columnvalues.length);
          
          for (let i = 0; i < colCount; i++) {
            const columnName = change.columnnames[i]!;
            let columnValue = change.columnvalues[i];
            
            // Debug logging for client_id before parsing
            if (columnName === 'client_id') {
              replicationLogger.debug('WAL client_id before parsing', {
                table: change.table,
                columnName,
                rawValue: columnValue,
                rawType: typeof columnValue,
                rawStringified: JSON.stringify(columnValue),
                isNull: columnValue === null,
                isUndefined: columnValue === undefined,
                isEmpty: columnValue === ''
              }, MODULE_NAME);
            }
            
            // Parse PostgreSQL-specific data types using comprehensive type detection
            columnValue = parsePostgreSQLValue(columnName, columnValue || '', change.table);
            
            // Debug logging for client_id after parsing
            if (columnName === 'client_id') {
              replicationLogger.debug('WAL client_id after parsing', {
                table: change.table,
                columnName,
                parsedValue: columnValue,
                parsedType: typeof columnValue,
                parsedStringified: JSON.stringify(columnValue),
                isNull: columnValue === null,
                isUndefined: columnValue === undefined,
                isEmpty: columnValue === ''
              }, MODULE_NAME);
            }
            
            snakeCaseData[columnName] = columnValue;
          }
        }
        
        // Oldkeys extraction for deletes
        if (change.kind === 'delete' && change.oldkeys && 
            change.oldkeys.keynames && Array.isArray(change.oldkeys.keynames) && 
            change.oldkeys.keyvalues && Array.isArray(change.oldkeys.keyvalues)) {
          const keyCount = Math.min(change.oldkeys.keynames.length, change.oldkeys.keyvalues.length);
          
          for (let i = 0; i < keyCount; i++) {
            const keyName = change.oldkeys.keynames[i]!;
            let keyValue = change.oldkeys.keyvalues[i];
            
            // Parse PostgreSQL-specific data types for oldkeys as well
            keyValue = parsePostgreSQLValue(keyName, keyValue || '', change.table);
            
            snakeCaseData[keyName] = keyValue;
          }
        }
        
        // Convert snake_case data to camelCase for TableChange format
        const camelCaseData = convertSnakeToCamelCase(snakeCaseData);
        
        // Set timestamp - either from the data or current time (convert to camelCase)
        const timestamp = 
          (snakeCaseData.updated_at as string) || 
          new Date().toISOString();

        // Extract clientId for top-level TableChange field (for anti-echo filtering) 
        // Important: Only set clientId if it has a real value (not null, undefined, or empty string)
        let topLevelClientId: string | undefined = undefined;
        if (camelCaseData.clientId && typeof camelCaseData.clientId === 'string' && camelCaseData.clientId.trim() !== '') {
          topLevelClientId = camelCaseData.clientId as string;
        }
        
        // Debug logging for clientId detection - always log
        replicationLogger.debug('WAL data extraction complete', {
          table: change.table,
          operation: change.kind,
          hasClientIdInCamelCase: !!camelCaseData.clientId,
          clientIdValue: camelCaseData.clientId,
          clientIdType: typeof camelCaseData.clientId,
          hasClientIdInSnakeCase: !!snakeCaseData.client_id,
          snakeClientIdValue: snakeCaseData.client_id,
          snakeClientIdType: typeof snakeCaseData.client_id,
          topLevelClientIdWillBe: topLevelClientId,
          columnNames: change.columnnames || [],
          dataKeys: Object.keys(camelCaseData)
        }, MODULE_NAME);

        // Add to result array with proper TableChange format (camelCase)
        tableChanges.push({
          table: change.table,
          operation: change.kind,
          data: camelCaseData,
          lsn: wal.lsn,
          clientId: topLevelClientId,  // Set top-level clientId for anti-echo filtering
          updatedAt: timestamp  // Use camelCase as per TableChange interface
        });
      } catch (error) {
        // More focused error handling at the change level
        addFilterReason(
          filteredReasons, 
          `Error processing change: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // ✨ NEW: Convert accumulated relationship updates to TableChange objects
  for (const [entityKey, relUpdates] of relationshipUpdates.entries()) {
    const [table, entityId] = entityKey.split(':');
    tableChanges.push({
      table: table!,
      operation: 'update',
      data: { id: entityId },
      relationshipUpdates: relUpdates,
      entityRelations: relUpdates.map(ru => ru.relationName),
      updatedAt: new Date().toISOString(),  // Use camelCase as per TableChange interface
      lsn: changes[changes.length - 1]?.lsn // Use the last LSN from the batch
    });
  }

  // Only log detailed transformation results when there are actual changes or errors
  if (tableChanges.length > 0 || Object.keys(filteredReasons).length > 0) {
    // Extract table names from filtered reasons
    const filteredTables = Object.keys(filteredReasons)
      .filter(reason => reason.includes('Table '))
      .map(reason => {
        const match = reason.match(/Table ([^ ]+) not in tracked/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    
    // Combine kept tables and filtered tables for reporting
    const keptTables = tableChanges.length > 0 ? 
      [...new Set(tableChanges.map(c => c.table))] : [];
    
    // Create a summary of operations by table
    const tableOperationSummary = Object.entries(changesByTable).map(([table, ops]) => {
      const opSummary = Object.entries(ops)
        .map(([op, count]) => `${op}:${count}`)
        .join(',');
      return `${table}(${opSummary})`;
    }).join('; ');
    
    // Improved logging to show both WAL entries and actual entity changes
    replicationLogger.info('WAL transformation results', {
      walEntries: changes.length,
      entityChangesInWAL: totalChangesInWAL,
      keptChanges: tableChanges.length,
      filtered: totalChangesInWAL - tableChanges.length,
      tables: tableOperationSummary,
      reasons: Object.keys(filteredReasons).length > 0 ? filteredReasons : undefined
    }, MODULE_NAME);
  }

  return { tableChanges, filteredReasons };
}

function addFilterReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] || 0) + 1;
}

// Helper function to convert snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Helper function to convert camelCase to snake_case
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Helper function to convert snake_case object keys to camelCase
function convertSnakeToCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    converted[camelKey] = value;
  }
  return converted;
}

/**
 * Create a Kysely database instance from context
 * Helper function to initialize Kysely for replication operations
 */
function createKyselyDb(context: MinimalContext): Kysely<Database> {
  // Use our centralized Kysely configuration which handles
  // postgres.js for local dev and Hyperdrive for production
    createDatabaseConnection(context.env);
    return getKysely();
}

export async function storeChangesInHistory(
  context: MinimalContext, 
  changes: (TableChange & { organizationId?: string })[],
  storeBatchSize: number = DEFAULT_STORE_BATCH_SIZE
): Promise<boolean> {
  if (changes.length === 0) {
    return true;
  }
  
  // Group by table for better logging
  const tableGroups = changes.reduce((acc: Record<string, number>, change) => {
    acc[change.table] = (acc[change.table] || 0) + 1;
    return acc;
  }, {});
  
  // Format for concise logging
  const tablesStr = Object.entries(tableGroups)
    .map(([table, count]) => `${table}:${count}`)
    .join(',');
  
  // Single log at start with essential info
  replicationLogger.info('Storing changes', {
    count: changes.length
  }, MODULE_NAME);
  // Add debug log for table details
  replicationLogger.debug('Storing changes table details', {
    tables: tablesStr
  }, MODULE_NAME);
  
  try {
    // Use Kysely for database operations
    const db = createKyselyDb(context);
    
    // Convert TableChange[] to change_history records with organization context
    const changeHistoryEntries = changes.map(change => ({
      lsn: change.lsn || '',
      organization_id: change.organizationId || null,
      table_name: change.table,
      operation: change.operation,
      data: JSON.stringify(change.data),
      client_id: change.clientId || null,
      created_at: new Date()
    }));
    
    // Insert in batches for better performance
    const totalBatches = Math.ceil(changeHistoryEntries.length / storeBatchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * storeBatchSize;
      const end = Math.min(start + storeBatchSize, changeHistoryEntries.length);
      const batch = changeHistoryEntries.slice(start, end);
      
      await db
        .insertInto('change_history')
        .values(batch)
        .execute();
    }
    
    replicationLogger.info('Successfully stored changes using Kysely', {
      count: changes.length,
      batches: totalBatches
    }, MODULE_NAME);
    
    return true;
  } catch (error) {
    replicationLogger.warn('Kysely storage failed, falling back to raw SQL', { 
      error: error instanceof Error ? error.message : String(error),
      count: changes.length
    }, MODULE_NAME);
    
    // Fallback to raw SQL
    const client = getDBClient(context);
    let connected = false;
    
    try {
      await client.connect();
      connected = true;
      
      // Use a single transaction for all batches
      await client.query('BEGIN');
      
      // Track success count
      let successCount = 0;
      let failureCount = 0;
      const totalBatches = Math.ceil(changes.length / storeBatchSize);
      
      for (let i = 0; i < changes.length; i += storeBatchSize) {
        const batch = changes.slice(i, i + storeBatchSize);
        
        // Create a multi-row insert with parameterized values for organization-aware change_history
        const valueRows = batch.map((_, idx) => {
          const base = idx * 7;
          return `($${base + 1}::pg_lsn, $${base + 2}::uuid, $${base + 3}, $${base + 4}, $${base + 5}::jsonb, $${base + 6}, $${base + 7}::timestamptz)`;
        }).join(',\n');
        
        const params: any[] = [];
        batch.forEach(change => {
          // Now TableChange uses camelCase format - get timestamp from updatedAt field
          const timestamp = change.updatedAt || new Date().toISOString();
          
          params.push(
            change.lsn,
            change.organizationId || null,
            change.table,
            change.operation,
            JSON.stringify(change.data), // This now contains camelCase data
            change.clientId || null,
            timestamp
          );
        });
        
        // Execute the multi-row insert in a single query with organization context
        const query = `
          INSERT INTO change_history 
            (lsn, organization_id, table_name, operation, data, client_id, created_at) 
          VALUES 
            ${valueRows};
        `;
        
        try {
          await client.query(query, params);
          successCount += batch.length;
        } catch (insertError) {
          failureCount += batch.length;
          replicationLogger.error('Batch insert error', {
            batchSize: batch.length,
            error: insertError instanceof Error ? insertError.message : String(insertError),
            batchNumber: Math.floor(i / storeBatchSize) + 1
          }, MODULE_NAME);
          
          // Continue with next batch - we'll commit what succeeded
        }
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      
      // Single log at end with summary results
      replicationLogger.info('Changes stored via fallback SQL', { 
        success: successCount,
        failed: failureCount,
        totalBatches
      }, MODULE_NAME);
      
      return successCount > 0;
    } catch (fallbackError) {
      // If we have an open transaction, roll it back
      if (connected) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback errors
        }
      }
      
      replicationLogger.error('Fallback SQL storage also failed', {
        count: changes.length,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      }, MODULE_NAME);
      
      return false;
    } finally {
      // Always ensure we close the connection
      if (connected) {
        try {
          await client.end();
        } catch (endError) {
          replicationLogger.error('DB connection close error', {}, MODULE_NAME);
        }
      }
    }
  }
}

// ====== Main Process Function ======
export async function processChanges(
  changes: WALData[],
  env: Env,
  context: MinimalContext,
  stateManager: StateManager,
  storeBatchSize?: number
): Promise<{ success: boolean, storedChanges: boolean, changeCount?: number, filteredCount?: number, lastLSN: string }> {
  if (!changes || changes.length === 0) {
    return { success: true, storedChanges: false, lastLSN: '' };
  }

  const lastLSN = changes[changes.length - 1]?.lsn || '';
  const startTime = Date.now();

  try {
    // Step 1: Transform WAL changes with organization awareness (includes clientId filtering for dual-path sync)
    replicationLogger.debug(`Processing ${changes.length} WAL entries with organization context`, {}, MODULE_NAME);
    const { tableChanges, filteredReasons, organizationStats } = await transformWALChangesWithOrg(changes, context);
    const filteredCount = Object.values(filteredReasons).reduce((sum, count) => sum + count, 0);
    
    // Log organization statistics for monitoring
    if (organizationStats && Object.keys(organizationStats).length > 0) {
      replicationLogger.debug('Organization change distribution', {
        organizations: organizationStats,
        totalOrganizations: Object.keys(organizationStats).length
      }, MODULE_NAME);
    }
    
    // Only log filtering info if there are actual changes or non-expected filters
    const hasImportantFilters = Object.keys(filteredReasons).some(r => 
      !r.includes('Intentionally skipping change_history')
    );
    
    if (tableChanges.length === 0) {
      // Only log for non-change_history updates to reduce noise
      if (hasImportantFilters) {
        replicationLogger.info('No valid changes to process, updating LSN', {
          lastLSN
        }, MODULE_NAME);
      }
      
      // If no valid changes after filtering, still update LSN to avoid reprocessing
      await stateManager.setLSN(lastLSN);
      return { 
        success: true, 
        storedChanges: false,
        changeCount: 0,
        filteredCount,
        lastLSN
      };
    }

    // Step 2: Push system changes to clients using handlePushedLiveChanges
    // Since client-originated changes are filtered out, only system changes remain
    try {
      const clientIds = await getAllClientIds(env);
      
      if (clientIds.length === 0) {
        replicationLogger.debug('No clients to notify, skipping notification step', {
          changeCount: tableChanges.length
        }, MODULE_NAME);
      } else if (tableChanges.length > 0) {
        // Filter out client-originated changes - only notify system changes
        const systemChanges = tableChanges.filter(change => {
          // Check both top-level clientId and clientId within data
          const hasClientId = !!(change.clientId || change.data?.clientId);
          
          // Debug logging for filter - always log for debugging
          replicationLogger.debug('System change filter check', {
            table: change.table,
            topLevelClientId: change.clientId,
            topLevelClientIdType: typeof change.clientId,
            dataClientId: change.data?.clientId,
            dataClientIdType: typeof change.data?.clientId,
            hasClientId,
            willBeSystemChange: !hasClientId,
            changeDataKeys: Object.keys(change.data || {})
          }, MODULE_NAME);
          
          return !hasClientId; // Only include changes without clientId (system-originated)
        });
        
        if (systemChanges.length === 0) {
          replicationLogger.debug('All changes are client-originated, skipping notifications (handled by primary path)', {
            totalChanges: tableChanges.length,
            clientChanges: tableChanges.length - systemChanges.length
          }, MODULE_NAME);
        } else {
          const { handlePushedLiveChanges } = await import('../sync/live-push');
          
          replicationLogger.info('Pushing system changes to all clients', {
            totalChanges: tableChanges.length,
            systemChanges: systemChanges.length,
            clientChanges: tableChanges.length - systemChanges.length,
            clientCount: clientIds.length,
            tables: [...new Set(systemChanges.map(c => c.table))]
          }, MODULE_NAME);
        
        // Process all clients in parallel
        const results = await Promise.all(
          clientIds.map(async (clientId) => {
            try {
              const clientDoId = env.SYNC.idFromName(`client:${clientId}`);
              const clientDo = env.SYNC.get(clientDoId);
              
              // Create a simple message handler that sends to SyncDO
              const messageHandler = {
                send: async (message: any) => {
                  const response = await clientDo.fetch(
                    `https://internal/new-changes?clientId=${encodeURIComponent(clientId)}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        lsn: lastLSN,
                        changeCount: systemChanges.length,
                        changes: systemChanges
                      })
                    }
                  );
                  if (response.status !== 200) {
                    throw new Error(`Failed to send: ${response.status}`);
                  }
                },
                // Stub methods to satisfy WebSocketHandler interface
                onMessage: () => {},
                removeHandler: () => {},
                clearHandlers: () => {},
                isConnected: () => true,
                waitForMessage: () => Promise.resolve({} as any)
              } as WebSocketHandler;
              
              // Use handlePushedLiveChanges which will filter and send appropriately
              const result = await handlePushedLiveChanges(
                systemChanges,
                lastLSN,
                clientId,
                messageHandler
              );
              
              return {
                clientId,
                success: result.success,
                changeCount: result.changeCount
              };
            } catch (error) {
              replicationLogger.error('Failed to push system changes to client', {
                clientId,
                error: error instanceof Error ? error.message : String(error)
              }, MODULE_NAME);
              return {
                clientId,
                success: false,
                error: error instanceof Error ? error.message : String(error)
              };
            }
          })
        );
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        
          replicationLogger.info('System change notifications completed', {
            total: clientIds.length,
            successful: successCount,
            failed: failureCount,
            systemChanges: systemChanges.length,
            processingTime: Date.now() - startTime
          }, MODULE_NAME);
        }
      }
    } catch (notificationError) {
      replicationLogger.error('System change notification failed', {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError),
        changeCount: tableChanges.length
      }, MODULE_NAME);
      // Continue to store in database even if notifications fail
    }

    // Step 3: Update LSN (no more storing in change_history)
    await stateManager.setLSN(lastLSN);
    
    return { 
      success: true, 
      storedChanges: false, // No longer storing in change_history
      changeCount: tableChanges.length,
      filteredCount,
      lastLSN
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('replication slot') && errorMsg.includes('is active for PID')) {
      return {
        success: true,
        storedChanges: false,
        changeCount: changes.length,
        filteredCount: 0,
        lastLSN
      };
    }
    
    replicationLogger.error('Changes processing failed', {
      lsn: lastLSN,
      error: errorMsg
    }, MODULE_NAME);
    
    return {
      success: false,
      storedChanges: false,
      changeCount: changes.length,
      filteredCount: 0,
      lastLSN
    };
  }
}
