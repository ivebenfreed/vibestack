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
import { TRACKED_TABLES } from '@repo/dataforge-next';

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
): Promise<void> {
  try {
    syncLogger.info(`Starting initial sync for client ${clientId}`, { clientId }, MODULE_NAME);

    // Send initial sync start message
    const startMessage: ServerInitStartMessage = {
      type: 'srv_init_start',
      clientId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      tableCount: TRACKED_TABLES.length
    };
    
    await messageHandler.sendMessage(clientId, startMessage);

    // Create generic sync adapter
    const syncAdapter = new GenericSyncAdapter(
      context.env.DATABASE_URL,
      messageHandler,
      context.env
    );

    // Get all current data (initial sync gets everything)
    const allData = await syncAdapter.getServerChanges(clientId, new Date(0));

    // Convert to TableChange format for initial sync
    const allChanges: TableChange[] = [];
    for (const [tableName, records] of Object.entries(allData)) {
      for (const record of records) {
        allChanges.push({
          table: tableName,
          operation: 'INSERT', // Initial sync treats everything as inserts
          data: record,
          sequenceNumber: 0,
          timestamp: record.updated_at || record.created_at || new Date().toISOString()
        });
      }
    }

    if (allChanges.length === 0) {
      syncLogger.info(`No data to sync for client ${clientId}`, { clientId }, MODULE_NAME);
      
      // Send completion message even with no data
      const completeMessage: ServerInitCompleteMessage = {
        type: 'srv_init_complete',
        clientId,
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        totalRecords: 0
      };
      
      await messageHandler.sendMessage(clientId, completeMessage);
      return;
    }

    // Send data in chunks
    const chunks = chunkArray(allChanges, DEFAULT_CHUNK_SIZE);
    
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
        totalChunks: chunks.length
      };
      
      await messageHandler.sendMessage(clientId, changesMessage);
      
      syncLogger.debug(`Sent initial sync chunk ${i + 1}/${chunks.length} with ${chunk.length} records to client ${clientId}`, {
        clientId,
        chunkIndex: i,
        chunkSize: chunk.length,
        isLastChunk
      }, MODULE_NAME);
      
      // Small delay between chunks to prevent overwhelming the client
      if (!isLastChunk) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Send completion message
    const completeMessage: ServerInitCompleteMessage = {
      type: 'srv_init_complete',
      clientId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      totalRecords: allChanges.length
    };
    
    await messageHandler.sendMessage(clientId, completeMessage);

    // Update sync metadata
    const syncVersion = new Date().toISOString();
    await syncAdapter.updateSyncMetadata(clientId, syncVersion);

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
      totalRecords: allChanges.length,
      chunkCount: chunks.length
    }, MODULE_NAME);

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
    
    await messageHandler.sendMessage(clientId, errorMessage);
    throw error;
  }
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