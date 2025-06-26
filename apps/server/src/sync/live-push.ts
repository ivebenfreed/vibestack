/**
 * Live push handler for real-time change notifications
 * Processes pre-filtered changes pushed from ReplicationDO
 * No database queries - pure message forwarding
 */

import type { TableChange, ServerChangesMessage } from '@repo/sync-types';
import type { WebSocketHandler } from './types';
import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'live-push';
const DEFAULT_CHUNK_SIZE = 100;

/**
 * Handle live changes that have been pushed directly from ReplicationDO
 * These changes are already filtered for the specific client (anti-echo handled upstream)
 */
export async function handlePushedLiveChanges(
  changes: TableChange[],
  serverLSN: string,
  clientId: string,
  messageHandler: WebSocketHandler
): Promise<{ success: boolean; changeCount: number; finalLSN: string }> {
  if (!changes || changes.length === 0) {
    syncLogger.debug('No changes to push', {
      clientId,
      serverLSN
    }, MODULE_NAME);
    return { success: true, changeCount: 0, finalLSN: serverLSN };
  }

  syncLogger.info('Processing pushed live changes', {
    clientId,
    changeCount: changes.length,
    serverLSN,
    tables: [...new Set(changes.map(c => c.table))].join(', ')
  }, MODULE_NAME);

  // Send changes directly - no filtering needed (already done by ReplicationDO)
  const success = await sendLivePushChanges(
    changes,
    serverLSN,
    clientId,
    messageHandler
  );

  if (success) {
    syncLogger.info('Successfully sent pushed live changes', {
      clientId,
      changeCount: changes.length,
      finalLSN: serverLSN
    }, MODULE_NAME);
  } else {
    syncLogger.error('Failed to send some or all pushed live changes', {
      clientId,
      changeCount: changes.length,
      serverLSN
    }, MODULE_NAME);
  }

  return {
    success,
    changeCount: changes.length,
    finalLSN: serverLSN
  };
}

/**
 * Send live changes to client via WebSocket in chunks
 */
async function sendLivePushChanges(
  changes: TableChange[],
  currentLSN: string,
  clientId: string,
  messageHandler: WebSocketHandler
): Promise<boolean> {
  // Calculate chunks
  const chunks = Math.ceil(changes.length / DEFAULT_CHUNK_SIZE);
  let allChunksSuccessful = true;
  
  syncLogger.debug('Preparing to send live changes in chunks', {
    clientId,
    totalChanges: changes.length,
    totalChunks: chunks,
    chunkSize: DEFAULT_CHUNK_SIZE
  }, MODULE_NAME);

  for (let i = 0; i < chunks; i++) {
    const start = i * DEFAULT_CHUNK_SIZE;
    const end = Math.min(start + DEFAULT_CHUNK_SIZE, changes.length);
    const chunkChanges = changes.slice(start, end);
    
    // Ensure all changes have proper table property set
    for (const change of chunkChanges) {
      if (change.table === undefined || change.table === null) {
        syncLogger.warn('Found change with undefined table property, setting to unknown', { 
          clientId,
          operation: change.operation,
          id: change.data?.id
        }, MODULE_NAME);
        change.table = 'unknown';
      }
    }
    
    const message: ServerChangesMessage = {
      type: 'srv_live_changes',
      messageId: `srv_push_${Date.now()}_${i}`,
      timestamp: Date.now(),
      clientId,
      changes: chunkChanges,
      lastLSN: currentLSN,
      sequence: { chunk: i + 1, total: chunks }
    };

    try {
      syncLogger.debug('Sending live push chunk', {
        clientId,
        chunk: i + 1,
        total: chunks,
        changesInChunk: chunkChanges.length,
        messageId: message.messageId
      }, MODULE_NAME);

      await messageHandler.send(message);
      
      syncLogger.debug('Successfully sent live push chunk', {
        clientId,
        chunk: i + 1,
        total: chunks
      }, MODULE_NAME);
    } catch (error) {
      allChunksSuccessful = false;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isWebSocketError = errorMessage.includes('WebSocketUnavailable') || 
                              errorMessage.includes('No active WebSocket connections');
      
      if (isWebSocketError) {
        syncLogger.warn('WebSocket unavailable while sending live push chunk', {
          clientId,
          chunk: i + 1,
          total: chunks,
          error: errorMessage
        }, MODULE_NAME);
        // Stop trying to send more chunks if WebSocket is unavailable
        throw error;
      } else {
        syncLogger.error('Failed to send live push chunk', {
          clientId,
          chunk: i + 1,
          total: chunks,
          error: errorMessage
        }, MODULE_NAME);
        // Continue trying remaining chunks for other errors
      }
    }
  }

  return allChunksSuccessful;
}