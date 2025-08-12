import type { TableChange, RelationshipUpdate } from '@repo/sync-types';
import { replicationLogger } from '../middleware/logger';
import type { MinimalContext } from '../types/hono';
import type { WALData, PostgresWALMessage } from '../types/wal';
import { parsePostgreSQLValue } from '../lib/postgresql-type-parser';
import type { WebSocketHandler } from '../sync/types';

// Helper type for WAL change records
type WALChangeRecord = NonNullable<PostgresWALMessage['change']>[number];
import { sql, getDBClient } from '../lib/db';
import { StateManager } from './state-manager';
import { 
  SERVER_DOMAIN_TABLES, 
  SERVER_DOMAIN_TABLE_HIERARCHY,
  SERVER_TRACKED_TABLES,
  SERVER_JUNCTION_TABLE_MAPPING
} from '@repo/dataforge/server-entities';
import type { Env } from '../types/env';
import { Kysely } from 'kysely';
import { NeonHTTPDialectV1 } from '../lib/kysely-neon-v1-adapter';
import { neonConfig } from '@neondatabase/serverless';
import type { Database } from '@repo/dataforge/kysely-types';

// ====== Types and Interfaces ======
const MODULE_NAME = 'process-changes';

type TableName = keyof typeof SERVER_DOMAIN_TABLE_HIERARCHY;

// ====== Constants ======
const DEFAULT_STORE_BATCH_SIZE = 500;

// Create a Set of tracked tables for O(1) lookup performance
// ✨ NEW: Now includes both domain tables and junction tables
const TRACKED_TABLES_SET = new Set(SERVER_TRACKED_TABLES);

// ====== Helper Functions ======

// ✨ NEW: Junction table detection and transformation
function isJunctionTable(tableName: string): boolean {
  return Object.prototype.hasOwnProperty.call(SERVER_JUNCTION_TABLE_MAPPING, tableName);
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
  try {
    // Import the relationship configuration helpers
    const { getJunctionRelationships } = await import('@repo/dataforge/server-entities');
    
    // Convert quoted table name to entity name (remove quotes, capitalize first letter)
    const entityName = sourceTable.replace(/"/g, '').toLowerCase();
    
    replicationLogger.info('getCurrentRelationshipIds using repository methods', {
      sourceTable,
      entityName,
      sourceId,
      relationName
    }, MODULE_NAME);
    
    // Get junction relationships for this entity
    const junctionRelationships = getJunctionRelationships(entityName);
    
    // Find the specific relationship we're looking for
    const relationshipConfig = junctionRelationships.find(rel => rel.relationName === relationName);
    
    if (!relationshipConfig) {
      replicationLogger.warn('No junction relationship config found', {
        entityName,
        relationName,
        availableRelationships: junctionRelationships.map(r => r.relationName)
      }, MODULE_NAME);
      return [];
    }
    
    replicationLogger.info('Found junction relationship config', {
      junctionTable: relationshipConfig.junctionTable,
      sourceColumn: relationshipConfig.sourceColumn,
      targetColumn: relationshipConfig.targetColumn,
      targetEntity: relationshipConfig.targetEntity
    }, MODULE_NAME);
    
    // Use repository methods instead of raw SQL
    const repositoryContainer = createRepositoryContainer(context);
    let targetIds: string[] = [];
    
    // Handle different entity types with their specific repository methods
    switch (entityName) {
      case 'projects':
        if (relationName === 'members') {
          const members = await repositoryContainer.projects.getMembers(sourceId);
          targetIds = members.map(member => member.id);
          replicationLogger.debug('Got project members via repository', {
            projectId: sourceId,
            memberCount: members.length,
            memberIds: targetIds
          }, MODULE_NAME);
        }
        break;
        
      case 'tasks':
        if (relationName === 'dependencies') {
          // For task dependencies, we need to implement a getDependencies method
          // For now, fall back to the raw SQL as a temporary measure
          replicationLogger.debug('Task dependencies not yet implemented via repository, using fallback', {
            taskId: sourceId,
            relationName
          }, MODULE_NAME);
          
          const neonService = (repositoryContainer as any).neonService;
          const query = `
            SELECT ${relationshipConfig.targetColumn} 
            FROM "${relationshipConfig.junctionTable}" 
            WHERE ${relationshipConfig.sourceColumn} = $1
          `;
          
          const result = await neonService.query(query, [sourceId]);
          
          // Handle different result formats from NeonService
          let rows;
          if (Array.isArray(result)) {
            rows = result;
          } else if (result && result.rows && Array.isArray(result.rows)) {
            rows = result.rows;
          } else if (result && Array.isArray(result.result)) {
            rows = result.result;
          } else {
            replicationLogger.warn('Unexpected query result format for task dependencies', {
              resultType: typeof result,
              result: result
            }, MODULE_NAME);
            return [];
          }
          
          targetIds = rows.map((row: any) => row[relationshipConfig.targetColumn]);
        }
        break;
        
      default:
        replicationLogger.warn('Unsupported entity type for relationship query', {
          entityName,
          relationName,
          supportedEntities: ['projects', 'tasks']
        }, MODULE_NAME);
        return [];
    }
    
    replicationLogger.debug('Repository relationship query result', {
      entityName,
      sourceId,
      relationName,
      targetCount: targetIds.length,
      targetIds: targetIds
    }, MODULE_NAME);
    
    return targetIds;
  } catch (error) {
    replicationLogger.error('Failed to get current relationship IDs via repository', {
      error: error instanceof Error ? error.message : String(error),
      sourceTable,
      sourceId,
      relationName
    }, MODULE_NAME);
    return [];
  }
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

export function shouldTrackTable(tableName: string): boolean {
  // Remove special case check for change_history as it's not in TRACKED_TABLES_SET anyway
  
  // Normalize the table name (add quotes if missing)
  const normalizedTableName = tableName.startsWith('"') ? tableName : `"${tableName}"`;
  
  // Check if the normalized table name is in our domain tables list using O(1) Set lookup
  return TRACKED_TABLES_SET.has(normalizedTableName as any);
}

// Static list of tracked tables to be logged once on module initialization
// ✨ NEW: Now includes both domain tables and junction tables
const TRACKED_TABLES = SERVER_TRACKED_TABLES.join(', ');
const junctionTableCount = Object.keys(SERVER_JUNCTION_TABLE_MAPPING).length;
replicationLogger.info('Replication tracking tables', { 
  count: SERVER_TRACKED_TABLES.length,
  tables: TRACKED_TABLES,
  domainTableCount: SERVER_DOMAIN_TABLES.length - junctionTableCount,
  junctionTableCount: junctionTableCount
}, MODULE_NAME);

/**
 * Get list of all client IDs from KV
 * Filters out inactive clients to prevent repeated notification attempts
 */
export async function getAllClientIds(env: Env, timeout = 10 * 60 * 1000): Promise<string[]> {
  try {
    const { keys } = await env.CLIENT_REGISTRY.list({ prefix: 'client:' });
    const clientIds: string[] = [];
    
    for (const key of keys) {
      const value = await env.CLIENT_REGISTRY.get(key.name);
      if (!value) continue;
      
      try {
        const state = JSON.parse(value);
        const clientId = key.name.replace('client:', '');
        
        // Only include active clients to prevent notifying disconnected clients
        if (state.active === true) {
          clientIds.push(clientId);
        } else {
          // Log when we skip inactive clients for debugging
          replicationLogger.debug('Skipping inactive client', {
            clientId,
            active: state.active,
            disconnectedAt: state.disconnectedAt
          }, MODULE_NAME);
        }
      } catch (err) {
        replicationLogger.error('Client parse error', {
          key: key.name
        }, MODULE_NAME);
      }
    }
    
    return clientIds;
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
        
        // Early table tracking check
        if (!shouldTrackTable(change.table)) {
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
  const databaseUrl = context.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  
  // Configure Neon for local development
  const environment = context.env.ENVIRONMENT || context.env.NODE_ENV;
  if (environment === "local" || environment === "development") {
    neonConfig.fetchEndpoint = (host) => {
      if (host === 'db.localtest.me') {
        return 'http://db.localtest.me:4444/sql';
      }
      return `https://${host}/sql`;
    };
  }
  
  return new Kysely<Database>({
    dialect: new NeonHTTPDialectV1({ connectionString: databaseUrl }),
  });
}

export async function storeChangesInHistory(
  context: MinimalContext, 
  changes: TableChange[],
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
    
    // Convert TableChange[] to change_history records
    const changeHistoryEntries = changes.map(change => ({
      lsn: change.lsn || '',
      table_name: change.table,
      operation: change.operation,
      data: JSON.stringify(change.data),
      timestamp: new Date()
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
        
        // Create a multi-row insert with parameterized values
        const valueRows = batch.map((_, idx) => {
          const base = idx * 5;
          return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, $${base + 4}::pg_lsn, $${base + 5}::timestamptz)`;
        }).join(',\n');
        
        const params: any[] = [];
        batch.forEach(change => {
          // Now TableChange uses camelCase format - get timestamp from updatedAt field
          const timestamp = change.updatedAt || new Date().toISOString();
          
          params.push(
            change.table,
            change.operation,
            JSON.stringify(change.data), // This now contains camelCase data
            change.lsn,
            timestamp
          );
        });
        
        // Execute the multi-row insert in a single query
        const query = `
          INSERT INTO change_history 
            (table_name, operation, data, lsn, timestamp) 
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
    // Step 1: Transform WAL changes (includes clientId filtering for dual-path sync)
    replicationLogger.debug(`Processing ${changes.length} WAL entries`, {}, MODULE_NAME);
    const { tableChanges, filteredReasons } = await transformWALChanges(changes, context);
    const filteredCount = Object.values(filteredReasons).reduce((sum, count) => sum + count, 0);
    
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

    // Step 3: Store changes in database
    const storedSuccessfully = await storeChangesInHistory(context, tableChanges, storeBatchSize || DEFAULT_STORE_BATCH_SIZE);
    
    if (!storedSuccessfully) {
      replicationLogger.warn('Failed to store changes in history', {
        lastLSN
      }, MODULE_NAME);
    }

    // Step 4: Update LSN
    await stateManager.setLSN(lastLSN);
    
    return { 
      success: true, 
      storedChanges: storedSuccessfully,
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
