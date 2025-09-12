/**
 * Live push handler for real-time change notifications
 * Processes pre-filtered changes pushed from ReplicationDO
 * No database queries - pure message forwarding
 */

import type { TableChange, ServerChangesMessage } from '@/types/sync';
import type { WebSocketHandler } from './types';
import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'live-push';
const DEFAULT_CHUNK_SIZE = 100;

/**
 * Filter changes to only include system-originated changes for client notification
 * All changes are processed for change_history, but only system changes notify clients
 */
function filterSystemChanges(changes: TableChange[]): TableChange[] {
  const UNTRACKED_TABLES = ['change_history', 'sync_statistics', 'system_logs'];
  
  const systemChanges = changes.filter(change => {
    // Always include untracked tables (they don't sync to clients anyway)
    if (UNTRACKED_TABLES.includes(change.table)) {
      return true;
    }
    
    // Check both change.clientId and change.data.clientId (ensure string type)
    const clientId = change.clientId || (typeof change.data?.clientId === 'string' ? change.data.clientId : undefined);
    
    // Only include changes without clientId (system-originated)
    return !clientId;
  });
  
  if (systemChanges.length > 0) {
    syncLogger.debug('System changes detected for client notification', {
      totalChanges: changes.length,
      systemChanges: systemChanges.length,
      tables: [...new Set(systemChanges.map(c => c.table))],
      untrackedTables: systemChanges.filter(c => UNTRACKED_TABLES.includes(c.table)).length,
      systemOriginatedTables: systemChanges.filter(c => !UNTRACKED_TABLES.includes(c.table)).length
    }, MODULE_NAME);
  }
  
  return systemChanges;
}

/**
 * Handle live changes that have been pushed directly from ReplicationDO
 * All changes are processed for change_history, but only system changes notify clients
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

  syncLogger.debug('WAL processing all changes for change_history', {
    clientId,
    changeCount: changes.length,
    serverLSN,
    tables: [...new Set(changes.map(c => c.table))].join(', ')
  }, MODULE_NAME);

  // Filter to only system changes for client notification
  const systemChanges = filterSystemChanges(changes);
  
  if (systemChanges.length === 0) {
    syncLogger.debug('No system changes to notify clients - all changes are client-originated', {
      clientId,
      totalChanges: changes.length,
      serverLSN
    }, MODULE_NAME);
    return { success: true, changeCount: 0, finalLSN: serverLSN };
  }

  syncLogger.info('Notifying clients of system changes', {
    clientId,
    totalChanges: changes.length,
    systemChanges: systemChanges.length,
    serverLSN,
    systemTables: [...new Set(systemChanges.map(c => c.table))].join(', ')
  }, MODULE_NAME);

  // Send only system changes to clients
  const success = await sendLivePushChanges(
    systemChanges,
    serverLSN,
    clientId,
    messageHandler,
    false // Not conflict resolution - these are system changes
  );

  if (success) {
    syncLogger.info('Successfully sent system changes', {
      clientId,
      systemChanges: systemChanges.length,
      finalLSN: serverLSN
    }, MODULE_NAME);
  } else {
    syncLogger.error('Failed to send system changes', {
      clientId,
      systemChanges: systemChanges.length,
      serverLSN
    }, MODULE_NAME);
  }

  return {
    success,
    changeCount: systemChanges.length,
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
  messageHandler: WebSocketHandler,
  isConflictResolution: boolean = false
): Promise<boolean> {
  // Calculate chunks
  const chunks = Math.ceil(changes.length / DEFAULT_CHUNK_SIZE);
  let allChunksSuccessful = true;
  
  syncLogger.debug('Preparing to send live changes in chunks', {
    clientId,
    totalChanges: changes.length,
    totalChunks: chunks,
    chunkSize: DEFAULT_CHUNK_SIZE,
    isConflictResolution
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
      messageId: `srv_wal_system_${Date.now()}_${i}`,
      timestamp: Date.now(),
      clientId,
      changes: chunkChanges,
      lastLSN: currentLSN,
      sequence: { chunk: i + 1, total: chunks },
      isConflictResolution
    };

    try {
      syncLogger.debug('Sending live push chunk', {
        clientId,
        chunk: i + 1,
        total: chunks,
        changesInChunk: chunkChanges.length,
        messageId: message.messageId,
        isConflictResolution
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