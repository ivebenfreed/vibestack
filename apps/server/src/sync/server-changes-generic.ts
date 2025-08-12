/**
 * Server Changes - Generic Version
 * 
 * Uses GenericSyncAdapter with Kysely for database queries instead of TypeORM/Drizzle
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
 * This replaces the TypeORM-based implementation with Kysely queries
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
      
      await messageHandler.send(completedMessage);
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
      
      await messageHandler.send(changesMessage);
      
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
    
    await messageHandler.send(completedMessage);

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
    
    await messageHandler.send(errorMessage);
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

/**
 * Perform catchup sync using the generic sync engine
 */
export async function performCatchupSync(
  context: MinimalContext,
  clientId: string,
  clientLSN: string,
  initialServerLSN: string,
  messageHandler: WebSocketHandler,
  stateManager: SyncStateManager
): Promise<void> {
  const functionStartTime = Date.now();
  syncLogger.info('Starting catchup sync', {
    clientId,
    clientLSN,
    initialServerLSN
  }, MODULE_NAME);

  try {
    // Use Kysely for catchup sync queries
    syncLogger.info('Setting up Kysely client for catchup sync', { clientId });
    const { Kysely } = await import('kysely');
    const { NeonHTTPDialectV1 } = await import('../lib/kysely-neon-v1-adapter');
    const { neonConfig } = await import('@neondatabase/serverless');
    const { Database } = await import('@repo/dataforge/kysely-types');
    
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
    
    const db = new Kysely<Database>({
      dialect: new NeonHTTPDialectV1({ connectionString: context.env.DATABASE_URL }),
    });
    
    syncLogger.info('Querying change_history table', {
      clientId,
      clientLSN,
      serverLSN: initialServerLSN
    });
    
    // Query for changes between client LSN and server LSN using Kysely
    syncLogger.info('Executing catchup query', { clientId });
    const changes = await db
      .selectFrom('change_history')
      .select([
        'table_name as table',
        'operation',
        'data',
        'lsn',
        'created_at as timestamp'
      ])
      .where('lsn', '>', clientLSN)
      .where('lsn', '<=', initialServerLSN)
      .orderBy('lsn', 'asc')
      .limit(5000)
      .execute();
    
    syncLogger.info('Catchup query completed', {
      clientId,
      changeCount: changes.length
    });
    
    // Parse the JSON data field for each change
    // The data field is stored as text/JSON string in the database
    const parsedChanges = changes.map(change => {
      let parsedData = null;
      if (change.data) {
        try {
          // Check if data is already an object (shouldn't happen with text column)
          if (typeof change.data === 'object') {
            parsedData = change.data;
          } else if (typeof change.data === 'string') {
            parsedData = JSON.parse(change.data);
          }
        } catch (e) {
          syncLogger.error('Failed to parse change data', {
            clientId,
            lsn: change.lsn,
            dataType: typeof change.data,
            error: e instanceof Error ? e.message : String(e)
          });
          // Keep original data if parsing fails
          parsedData = change.data;
        }
      }
      return {
        ...change,
        data: parsedData
      };
    });
    
    if (parsedChanges.length === 0) {
      syncLogger.info('No catchup changes needed', {
        clientId,
        clientLSN,
        serverLSN: initialServerLSN
      });
      
      // Send catchup completed message
      const completedMessage: ServerCatchupCompletedMessage = {
        type: 'srv_catchup_completed',
        messageId: `srv_${Date.now()}_catchup_completed`,
        timestamp: Date.now(),
        clientId,
        startLSN: clientLSN,
        endLSN: initialServerLSN,
        changeCount: 0,
        success: true
      };
      
      await messageHandler.send(completedMessage);
      return;
    }
    
    // Send changes in batches
    const BATCH_SIZE = 500;
    const batches = chunkArray(parsedChanges, BATCH_SIZE);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const message = {
        type: 'srv_catchup_changes',
        messageId: `srv_${Date.now()}_catchup_${i}`,
        timestamp: Date.now(),
        clientId,
        changes: batch,
        startLSN: clientLSN,
        endLSN: initialServerLSN,
        batchIndex: i,
        totalBatches: batches.length,
        isLastBatch: i === batches.length - 1
      };
      
      await messageHandler.send(message);
    }
    
    // Send catchup completed
    const completedMessage: ServerCatchupCompletedMessage = {
      type: 'srv_catchup_completed',
      messageId: `srv_${Date.now()}_catchup_completed`,
      timestamp: Date.now(),
      clientId,
      startLSN: clientLSN,
      endLSN: initialServerLSN,
      changeCount: parsedChanges.length,
      success: true
    };
    
    await messageHandler.send(completedMessage);
    
    const duration = Date.now() - functionStartTime;
    syncLogger.info('Catchup sync completed', {
      clientId,
      changeCount: parsedChanges.length,
      batchCount: batches.length,
      durationMs: duration
    });
    
  } catch (error) {
    syncLogger.error('Catchup sync failed', {
      clientId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Create a live sync confirmation message
 */
export function createLiveSyncConfirmation(
  clientId: string,
  lsn: string
): ServerLiveStartMessage {
  return {
    type: 'srv_live_start',
    messageId: `srv_${Date.now()}_live_start`,
    timestamp: Date.now(),
    clientId,
    startLSN: lsn,
    serverLSN: lsn,
    changeCount: 0,
    success: true
  };
}