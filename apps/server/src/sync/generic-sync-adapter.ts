/**
 * Generic Sync Adapter
 * 
 * Adapts the GenericSyncEngine to work with the existing sync infrastructure
 * Replaces TypeORM-based EntityOperations with generic Drizzle-based operations
 */

import { GenericSyncEngine, type LocalChange } from './generic-sync-engine.js';
import { 
  schema,
  syncMetadata, 
  junctionTables,
  TRACKED_TABLES 
} from '@repo/dataforge-next';

import { 
  TableChange, 
  ServerReceivedMessage,
  ServerAppliedMessage,
  ClientChangesMessage,
  ExecutionResult
} from '@repo/sync-types';
import { syncLogger } from '../middleware/logger.js';
import type { WebSocketHandler } from './types.js';

const MODULE_NAME = 'generic-sync-adapter';

/**
 * Converts sync-types TableChange to GenericSyncEngine LocalChange format
 */
function convertToLocalChange(tableChange: TableChange): LocalChange {
  return {
    id: crypto.randomUUID(), // Generate a unique ID for the change
    tableName: tableChange.table,
    recordId: tableChange.data.id || tableChange.data.clientId || crypto.randomUUID(),
    operationType: tableChange.operation.toUpperCase() as ('INSERT' | 'UPDATE' | 'DELETE'),
    data: tableChange.data,
    clientSequence: tableChange.sequenceNumber || 0,
    loopProtection: 0
  };
}

/**
 * Adapter class that integrates GenericSyncEngine with existing sync infrastructure
 */
export class GenericSyncAdapter {
  private syncEngine: GenericSyncEngine;
  
  constructor(
    databaseUrl: string,
    private messageHandler: WebSocketHandler,
    private env: { DATABASE_URL: string; NODE_ENV?: string }
  ) {
    this.syncEngine = new GenericSyncEngine(
      databaseUrl,
      schema,
      syncMetadata,
      junctionTables
    );
  }

  /**
   * Process incoming client changes using the generic sync engine
   */
  async processIncomingChanges(message: ClientChangesMessage): Promise<void> {
    const { clientId, changes } = message;
    
    syncLogger.info(`${MODULE_NAME}: Processing ${changes.length} changes from client ${clientId}`);
    
    try {
      // Convert TableChange[] to LocalChange[]
      const localChanges: LocalChange[] = changes.map(convertToLocalChange);
      
      // Send received confirmation
      await this.sendReceivedMessage(clientId, changes);
      
      // Process changes through generic sync engine
      await this.syncEngine.processLocalChanges(localChanges);
      
      // Send applied confirmation
      await this.sendAppliedMessage(clientId, changes);
      
      syncLogger.info(`${MODULE_NAME}: Successfully processed ${changes.length} changes from client ${clientId}`);
      
    } catch (error) {
      syncLogger.error(`${MODULE_NAME}: Error processing changes from client ${clientId}:`, error);
      
      // Send error message to client
      await this.sendErrorMessage(clientId, error instanceof Error ? error.message : 'Unknown error');
      
      // Don't throw - we've already sent the error to the client
      // Throwing would prevent the error message from being delivered
    }
  }

  /**
   * Get server changes for a client using the generic sync engine
   */
  async getServerChanges(clientId: string, lastSyncTimestamp?: Date): Promise<Record<string, any[]>> {
    syncLogger.info(`${MODULE_NAME}: Getting server changes for client ${clientId} since ${lastSyncTimestamp?.toISOString()}`);
    
    const timestamp = lastSyncTimestamp || new Date(0);
    const changes = await this.syncEngine.getChangesForClient(timestamp, TRACKED_TABLES as unknown as string[]);
    
    syncLogger.info(`${MODULE_NAME}: Found changes in ${Object.keys(changes).length} tables for client ${clientId}`);
    
    return changes;
  }

  /**
   * Update sync metadata after successful sync
   */
  async updateSyncMetadata(clientId: string, syncVersion: string): Promise<void> {
    await this.syncEngine.updateSyncMetadata(clientId, syncVersion);
  }

  /**
   * Send received confirmation message to client
   */
  private async sendReceivedMessage(clientId: string, changes: TableChange[]): Promise<void> {
    const message = {
      type: 'srv_changes_received' as const,
      clientId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      messageId: `srv_${Date.now()}_received`,
      acknowledgedChanges: changes.map(change => ({
        table: change.table,
        operation: change.operation,
        recordId: change.data.id || change.data.clientId,
        sequenceNumber: change.sequenceNumber || 0
      }))
    };

    await this.messageHandler.send(message);
  }

  /**
   * Send applied confirmation message to client
   */
  private async sendAppliedMessage(clientId: string, changes: TableChange[]): Promise<void> {
    const message = {
      type: 'srv_changes_applied' as const,
      clientId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      messageId: `srv_${Date.now()}_applied`,
      appliedChanges: changes.map(change => ({
        table: change.table,
        operation: change.operation,
        recordId: change.data.id || change.data.clientId,
        sequenceNumber: change.sequenceNumber || 0
      })),
      results: changes.map(() => ({ success: true })) // Assume success if we got here
    };

    await this.messageHandler.send(message);
  }

  /**
   * Send error message to client
   */
  private async sendErrorMessage(clientId: string, error: string): Promise<void> {
    const message = {
      type: 'srv_error' as const,
      clientId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      error,
      messageId: `srv_${Date.now()}_error`
    };

    await this.messageHandler.send(message);
  }
}