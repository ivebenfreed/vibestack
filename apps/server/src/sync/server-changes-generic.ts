/**
 * Server Changes - Generic Version
 * 
 * Uses GenericSyncAdapter to get server changes instead of TypeORM-based repositories
 */

import type { 
  TableChange,
  ServerMessage,
  ServerChangesMessage,
  ServerStateChangeMessage,
  ServerLSNUpdateMessage,
  ServerSyncCompletedMessage,
  ServerLiveStartMessage,
  ServerCatchupCompletedMessage,
  ServerSyncStatsMessage
} from '@repo/sync-types';
import type { MinimalContext } from '../types/hono';
import { syncLogger } from '../middleware/logger';
import type { WebSocketHandler } from './types';
import type { SyncStateManager } from './state-manager';
import { GenericSyncAdapter } from './generic-sync-adapter';

const MODULE_NAME = 'server-changes-generic';
const DEFAULT_CHUNK_SIZE = 500;

/**
 * Send live changes to clients using the generic sync adapter
 * This replaces the TypeORM-based implementation with Drizzle-based queries
 */
export async function sendLiveChanges(
  stateManager: SyncStateManager,
  messageHandler: WebSocketHandler,
  context: MinimalContext,
  clientId: string,
  currentLSN?: string,
  targetLSN?: string
): Promise<void> {
  try {
    syncLogger.info(`Starting live changes for client ${clientId}`, {
      clientId,
      currentLSN: currentLSN?.slice(-8),
      targetLSN: targetLSN?.slice(-8)
    }, MODULE_NAME);

    // Create generic sync adapter
    const syncAdapter = new GenericSyncAdapter(
      context.env.DATABASE_URL,
      messageHandler,
      context.env
    );

    // Get server changes since the client's last sync
    const lastSyncTimestamp = await getClientLastSyncTimestamp(clientId, stateManager);
    const serverChanges = await syncAdapter.getServerChanges(clientId, lastSyncTimestamp);

    // Convert server changes to TableChange format
    const tableChanges: TableChange[] = [];
    for (const [tableName, records] of Object.entries(serverChanges)) {
      for (const record of records) {
        tableChanges.push({
          table: tableName,
          operation: 'UPDATE', // Server changes are typically updates
          data: record,
          sequenceNumber: 0, // Server-generated changes don't need sequence numbers
          timestamp: record.updated_at || new Date().toISOString()
        });
      }
    }

    if (tableChanges.length === 0) {
      syncLogger.info(`No server changes for client ${clientId}`, { clientId }, MODULE_NAME);
      
      // Send sync completed message
      const completedMessage: ServerSyncCompletedMessage = {
        type: 'srv_sync_completed',
        clientId,
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        lsn: targetLSN || currentLSN || '0/0',
        changeCount: 0
      };
      
      await messageHandler.sendMessage(clientId, completedMessage);
      return;
    }

    // Send changes in chunks
    const chunks = chunkArray(tableChanges, DEFAULT_CHUNK_SIZE);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;
      
      const changesMessage: ServerChangesMessage = {
        type: 'srv_changes',
        clientId,
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        changes: chunk,
        isLastChunk,
        chunkIndex: i,
        totalChunks: chunks.length,
        lsn: targetLSN || currentLSN || '0/0'
      };
      
      await messageHandler.sendMessage(clientId, changesMessage);
      
      syncLogger.debug(`Sent chunk ${i + 1}/${chunks.length} with ${chunk.length} changes to client ${clientId}`, {
        clientId,
        chunkIndex: i,
        chunkSize: chunk.length,
        isLastChunk
      }, MODULE_NAME);
    }

    // Send sync completed message
    const completedMessage: ServerSyncCompletedMessage = {
      type: 'srv_sync_completed',
      clientId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      lsn: targetLSN || currentLSN || '0/0',
      changeCount: tableChanges.length
    };
    
    await messageHandler.sendMessage(clientId, completedMessage);

    // Update sync metadata
    const syncVersion = new Date().toISOString();
    await syncAdapter.updateSyncMetadata(clientId, syncVersion);

    syncLogger.info(`Completed live changes for client ${clientId}`, {
      clientId,
      changeCount: tableChanges.length,
      chunkCount: chunks.length
    }, MODULE_NAME);

  } catch (error) {
    syncLogger.error(`Failed to send live changes to client ${clientId}`, {
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
 * Get the client's last sync timestamp from state manager
 */
async function getClientLastSyncTimestamp(
  clientId: string, 
  stateManager: SyncStateManager
): Promise<Date | undefined> {
  try {
    // Try to get the last sync timestamp from state
    const clientState = await stateManager.getClientState(clientId);
    if (clientState?.lastSyncTimestamp) {
      return new Date(clientState.lastSyncTimestamp);
    }
  } catch (error) {
    syncLogger.warn(`Failed to get last sync timestamp for client ${clientId}`, {
      clientId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
  }
  
  // Default to 1 hour ago if we can't get the state
  return new Date(Date.now() - 60 * 60 * 1000);
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