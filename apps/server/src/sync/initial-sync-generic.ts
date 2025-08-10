/**
 * Initial Sync - Generic Version
 * 
 * Uses GenericSyncAdapter to perform initial sync instead of TypeORM-based repositories
 */

import type { 
  ServerMessage, 
  ServerInitStartMessage, 
  ServerInitChangesMessage, 
  ServerInitCompleteMessage,
  CltMessageType,
  TableChange
} from '@repo/sync-types';
import type { MinimalContext } from '../types/hono';
import { syncLogger } from '../middleware/logger';
import type { WebSocket } from '../types/cloudflare';
import type { StateManager } from './state-manager';
import type { InitialSyncState, WebSocketHandler } from './types';
import { GenericSyncAdapter } from './generic-sync-adapter';
import { TRACKED_TABLES, ORDERED_TRACKED_TABLES } from '@repo/dataforge';

const MODULE_NAME = 'initial-sync-generic';
const DEFAULT_CHUNK_SIZE = 500;

/**
 * Perform initial sync for a client using the generic sync adapter
 * This sends all current data to a new client
 */
export async function performInitialSync(
  messageHandler: WebSocketHandler,
  context: MinimalContext,
  clientId: string,
  stateManager?: StateManager
): Promise<{ startLSN: string; endLSN: string }> {
  try {
    syncLogger.info(`Starting initial sync for client ${clientId}`, { clientId }, MODULE_NAME);

    // Get server LSN at start of initial sync
    const startLSN = stateManager ? await stateManager.getServerLSN() : '0/0';

    // Send initial sync start message
    const startMessage: ServerInitStartMessage = {
      type: 'srv_init_start',
      clientId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      tableCount: ORDERED_TRACKED_TABLES.length
    };
    
    await messageHandler.send(startMessage);

    // Create generic sync adapter
    console.log('DEBUG: Creating GenericSyncAdapter...');
    const syncAdapter = new GenericSyncAdapter(
      context.env.DATABASE_URL,
      messageHandler,
      context.env
    );
    console.log('DEBUG: GenericSyncAdapter created successfully');

    // Process each table separately, sending chunks per table
    let totalRecords = 0;
    let processedTables = 0;
    
    // Process each table in dependency order (parent tables before junction tables)
    for (const tableName of ORDERED_TRACKED_TABLES) {
      syncLogger.info(`Processing table ${tableName} for initial sync`, { clientId, table: tableName }, MODULE_NAME);
      
      // Get data for this specific table
      const tableData = await syncAdapter.getTableData(tableName, new Date(0));
      
      if (!tableData || tableData.length === 0) {
        syncLogger.debug(`No data in table ${tableName}`, { clientId, table: tableName }, MODULE_NAME);
        processedTables++;
        continue;
      }
      
      console.log(`DEBUG: Processing table ${tableName} with ${tableData.length} records`);
      
      // Convert to TableChange format for this table
      const tableChanges: TableChange[] = tableData.map(record => ({
        table: tableName,
        operation: 'INSERT' as const,
        data: record,
        sequenceNumber: 0,
        timestamp: record.updated_at || record.created_at || new Date().toISOString()
      }));
      
      // Send this table's data in chunks
      const chunks = chunkArray(tableChanges, DEFAULT_CHUNK_SIZE);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLastChunk = i === chunks.length - 1;
        
        const changesMessage: ServerInitChangesMessage = {
          type: 'srv_init_changes',
          clientId,
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          changes: chunk,
          isLastChunk,
          chunkIndex: i,
          totalChunks: chunks.length,
          table: tableName, // Include table name for tracking
          tableIndex: processedTables,
          totalTables: ORDERED_TRACKED_TABLES.length
        };
        
        console.log(`DEBUG: Sending ${tableName} chunk ${i + 1}/${chunks.length} with ${chunk.length} records`);
        await messageHandler.send(changesMessage);
        
        syncLogger.debug(`Sent ${tableName} chunk ${i + 1}/${chunks.length}`, {
          clientId,
          table: tableName,
          chunkIndex: i,
          chunkSize: chunk.length,
          isLastChunk
        }, MODULE_NAME);
        
        // Small delay between chunks
        if (!isLastChunk) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      totalRecords += tableData.length;
      processedTables++;
      
      syncLogger.info(`Completed table ${tableName}`, {
        clientId,
        table: tableName,
        records: tableData.length,
        progress: `${processedTables}/${ORDERED_TRACKED_TABLES.length} tables`
      }, MODULE_NAME);
    }
    
    console.log(`DEBUG: Total records sent: ${totalRecords} across ${processedTables} tables`);
    
    if (totalRecords === 0) {
      syncLogger.info(`No data to sync for client ${clientId}`, { clientId }, MODULE_NAME);
    }

    // Get server LSN at end of initial sync
    const endLSN = stateManager ? await stateManager.getServerLSN() : startLSN;

    // Send completion message
    const completeMessage: ServerInitCompleteMessage = {
      type: 'srv_init_complete',
      clientId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      totalRecords: totalRecords,
      serverLSN: endLSN
    };
    
    await messageHandler.send(completeMessage);

    // Update sync metadata - DISABLED due to schema mismatch
    // TODO: Fix sync_metadata table structure mismatch
    const syncVersion = new Date().toISOString();
    // await syncAdapter.updateSyncMetadata(clientId, syncVersion);
    console.log('DEBUG: Skipping sync metadata update due to schema mismatch');

    // Update state manager if provided
    if (stateManager) {
      try {
        await stateManager.setClientSyncState(clientId, {
          lastSyncTimestamp: syncVersion,
          isInitialSyncComplete: true
        });
      } catch (stateError) {
        syncLogger.warn(`Failed to update client state after initial sync`, {
          clientId,
          error: stateError instanceof Error ? stateError.message : String(stateError)
        }, MODULE_NAME);
      }
    }

    syncLogger.info(`Completed initial sync for client ${clientId}`, {
      clientId,
      totalRecords: totalRecords,
      tableCount: processedTables,
      startLSN,
      endLSN
    }, MODULE_NAME);

    return { startLSN, endLSN };

  } catch (error) {
    syncLogger.error(`Failed to perform initial sync for client ${clientId}`, {
      clientId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, MODULE_NAME);
    
    // Send error message to client
    const errorMessage = {
      type: 'srv_error',
      clientId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
    
    await messageHandler.send(errorMessage);
    throw error;
  }

  // This should never be reached but TypeScript needs it
  return { startLSN: '0/0', endLSN: '0/0' };
}

/**
 * Utility function to chunk an array into smaller arrays
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}