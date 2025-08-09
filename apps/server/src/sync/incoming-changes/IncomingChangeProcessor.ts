import { Client } from '@neondatabase/serverless';
import { 
  TableChange, 
  ServerReceivedMessage,
  ServerAppliedMessage,
  ClientChangesMessage,
  ExecutionResult
} from '@repo/sync-types';
import { syncLogger } from '../../middleware/logger';
import type { WebSocketHandler } from '../types';
import { deduplicateChanges } from '../../lib/sync-common';
import { SyncConfig, DEFAULT_SYNC_CONFIG } from '../../types/sync';
import { GenericSyncAdapter } from '../generic-sync-adapter';
import { DatabaseError, CRDTConflictError, ValidationError } from './errors.js';

const MODULE_NAME = 'incoming-change-processor';

/**
 * Main processor for incoming client changes
 * Now uses GenericSyncAdapter instead of TypeORM-based EntityOperations
 */
export class IncomingChangeProcessor {
  private genericSyncAdapter: GenericSyncAdapter;
  
  constructor(
    private client: Client,
    private messageHandler: WebSocketHandler,
    private env: { DATABASE_URL: string; NODE_ENV?: string },
    private config: SyncConfig = DEFAULT_SYNC_CONFIG,
    private broadcastConflicts?: (changes: TableChange[], originClientId: string) => Promise<void>
  ) {
    this.genericSyncAdapter = new GenericSyncAdapter(
      env.DATABASE_URL,
      messageHandler,
      env
    );
  }

  /**
   * Process incoming client changes - main entry point
   */
  async processIncomingChanges(message: ClientChangesMessage): Promise<void> {
    const { clientId, changes } = message;
    
    // Log received changes in detail
    this.logReceivedChanges(clientId, message, changes);
    
    try {
      // Use the generic sync adapter to process changes
      await this.genericSyncAdapter.processIncomingChanges(message);
      
      syncLogger.info(`${MODULE_NAME}: Successfully processed ${changes.length} changes for client ${clientId}`);
      
    } catch (error) {
      syncLogger.error(`${MODULE_NAME}: Failed to process changes for client ${clientId}`, {
        clientId,
        error: error instanceof Error ? error.message : String(error),
        changeCount: changes.length
      }, MODULE_NAME);
      
      throw error;
    }
  }

  /**
   * Log detailed information about received changes
   */
  private logReceivedChanges(clientId: string, message: ClientChangesMessage, changes: TableChange[]): void {
    // Summary logging at info level
    const summary = this.createChangesSummary(changes);
    syncLogger.info(`Received ${changes.length} changes from client`, {
      clientId,
      messageId: message.messageId,
      changesCount: changes.length,
      summary
    }, MODULE_NAME);
    
    // Detailed logging only at debug level
    syncLogger.debug(`Detailed change breakdown for client ${clientId}`, {
      clientId,
      messageId: message.messageId,
      changes: changes.map((change, index) => {
        const data = change?.data as any;
        return {
          index: index + 1,
          table: change?.table,
          operation: change?.operation,
          entityId: data.id,
          hasRelationshipUpdates: !!(change?.relationshipUpdates && change?.relationshipUpdates.length > 0),
          relationshipUpdatesCount: change?.relationshipUpdates?.length || 0,
        };
      })
    }, MODULE_NAME);
  }

  /**
   * Create a summary of changes grouped by table and operation
   */
  private createChangesSummary(changes: TableChange[]): Record<string, any> {
    const summary: Record<string, any> = {};
    
    changes.forEach(change => {
      const table = change.table;
      const operation = change.operation;
      
      if (!summary[table]) {
        summary[table] = { INSERT: 0, UPDATE: 0, DELETE: 0 };
      }
      
      if (summary[table][operation] !== undefined) {
        summary[table][operation]++;
      }
    });
    
    return summary;
  }

  /**
   * Set a reasonable statement timeout for long-running operations
   */
  private async setStatementTimeout(): Promise<void> {
    try {
      await this.client.query('SET statement_timeout = 30000'); // 30 seconds
    } catch (error) {
      syncLogger.warn('Failed to set statement timeout', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
}