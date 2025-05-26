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
import { EntityOperations } from './EntityOperations';
import { ConflictResolver } from './ConflictResolver';
import { DatabaseError, CRDTConflictError, ValidationError } from './errors.js';

const MODULE_NAME = 'incoming-change-processor';

/**
 * Main processor for incoming client changes
 * Handles orchestration, message flow, and coordination
 */
export class IncomingChangeProcessor {
  private entityOperations: EntityOperations;
  private conflictResolver: ConflictResolver;
  
  constructor(
    private client: Client,
    private messageHandler: WebSocketHandler,
    private env: { DATABASE_URL: string; NODE_ENV?: string },
    private config: SyncConfig = DEFAULT_SYNC_CONFIG
  ) {
    this.entityOperations = new EntityOperations(client, env);
    this.conflictResolver = new ConflictResolver(config);
  }

  /**
   * Process incoming client changes - main entry point
   */
  async processIncomingChanges(message: ClientChangesMessage): Promise<void> {
    const { clientId, changes } = message;
    
    // Log received changes in detail
    this.logReceivedChanges(clientId, message, changes);
    
    try {
      // Set statement timeout
      await this.setStatementTimeout();
      
      // Extract change IDs for acknowledgment
      const changeIds = changes.map(change => (change.data as any).id);
      
      // Send received acknowledgment first
      try {
        await this.sendChangesReceived(clientId, changeIds);
      } catch (ackError) {
        syncLogger.error(`Failed to send received acknowledgment for client ${clientId}`, {
          clientId,
          error: ackError instanceof Error ? ackError.message : String(ackError)
        }, MODULE_NAME);
        // Continue processing even if acknowledgment fails
      }
      
      // Deduplicate changes
      const optimizedChangesResult = deduplicateChanges(changes);
      
      // Process changes
      const results = await this.processAllChanges(optimizedChangesResult.changes);
      
      // Summarize results
      const summary = this.summarizeResults(results);
      
      // Send applied acknowledgment
      try {
        await this.sendChangesApplied(
          clientId, 
          changeIds,
          summary.allSuccessful,
          summary.lastError
        );
      } catch (appliedError) {
        syncLogger.error(`Failed to send applied acknowledgment for client ${clientId}`, {
          clientId,
          error: appliedError instanceof Error ? appliedError.message : String(appliedError)
        }, MODULE_NAME);
      }
      
      // Log completion summary
      syncLogger.info(`Completed processing ${optimizedChangesResult.changes.length} changes for client ${clientId}`, {
        clientId,
        appliedCount: summary.appliedCount,
        skippedCount: summary.skippedCount,
        success: summary.allSuccessful
      }, MODULE_NAME);
    } catch (error) {
      syncLogger.error(`Processing failed for client ${clientId}`, {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Send error response
      try {
        await this.sendError(clientId, error instanceof Error ? error : new Error(String(error)));
      } catch (errorSendError) {
        syncLogger.error(`Failed to send error message to client ${clientId}`, {
          clientId,
          error: errorSendError instanceof Error ? errorSendError.message : String(errorSendError)
        }, MODULE_NAME);
      }
      
      throw error; // Re-throw the original error
    }
  }
  
  /**
   * Process all changes using the EntityOperations module
   */
  private async processAllChanges(changes: TableChange[]): Promise<ExecutionResult[]> {
    // Group changes by table and operation
    const groups = this.groupChangesByTableAndOperation(changes);
    const results: ExecutionResult[] = [];
    const processingMap = new Map<string, boolean>(); // Track which changes were processed
    
    // Track all changes by ID for conflict detection
    for (const change of changes) {
      const data = change.data as any;
      processingMap.set(data.id, false); // Initially mark all as unprocessed
    }
    
    // Process each group using EntityOperations
    for (const group of groups) {
      try {
        const batchResults = await this.entityOperations.processChangeGroup(
          group.table, 
          group.operation, 
          group.changes
        );
        
        // Mark successful changes
        for (const result of batchResults) {
          if (result && result.id) {
            processingMap.set(result.id, true); // Mark as processed
            results.push({ success: true, data: result });
          }
        }
      } catch (error) {
        syncLogger.error(`Failed to process ${group.operation} for table ${group.table}: ${
          error instanceof Error ? error.message : String(error)
        }`, {
          table: group.table,
          operation: group.operation,
          changeCount: group.changes.length
        }, MODULE_NAME);
        
        // Mark as failed but continue processing other groups
        for (const change of group.changes) {
          const data = change.data as any;
          if (!processingMap.get(data.id)) {
            results.push({ 
              success: false, 
              error: {
                code: 'PROCESSING_ERROR',
                message: error instanceof Error ? error.message : String(error),
                details: {
                  table: group.table,
                  operation: group.operation,
                  entityId: data.id
                }
              },
              data: data
            });
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * Group changes by table and operation
   */
  private groupChangesByTableAndOperation(changes: TableChange[]): Array<{
    table: string;
    operation: string;
    changes: TableChange[];
  }> {
    const groups: Array<{
      table: string;
      operation: string;
      changes: TableChange[];
    }> = [];
    
    const groupMap = new Map<string, TableChange[]>();
    
    // Group changes by table and operation
    for (const change of changes) {
      const key = `${change.table}:${change.operation}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(change);
    }
    
    // Convert to array of groups
    for (const [key, changes] of groupMap.entries()) {
      const [table, operation] = key.split(':');
      groups.push({ table, operation, changes });
    }
    
    return groups;
  }
  
  /**
   * Log detailed information about received changes
   */
  private logReceivedChanges(clientId: string, message: ClientChangesMessage, changes: TableChange[]): void {
    syncLogger.info(`🔍 [SERVER] Received ${changes.length} TableChange objects from client ${clientId}`, {
      clientId,
      messageId: message.messageId,
      changesCount: changes.length
    }, MODULE_NAME);
    
    // Log each TableChange object in detail
    changes.forEach((change, index) => {
      const data = change.data as any;
      const hasRelationshipUpdates = !!(change.relationshipUpdates && change.relationshipUpdates.length > 0);
      const hasEntityRelations = !!(change.entityRelations && change.entityRelations.length > 0);
      
      syncLogger.info(`🔍 [SERVER] TableChange ${index + 1}/${changes.length} details:`, {
        clientId,
        index,
        table: change.table,
        operation: change.operation,
        entityId: data.id,
        hasClientId: !!data.client_id,
        clientIdValue: data.client_id,
        hasRelationshipUpdates,
        relationshipUpdatesCount: change.relationshipUpdates?.length || 0,
        relationshipUpdates: change.relationshipUpdates,
        hasEntityRelations,
        entityRelations: change.entityRelations,
        updatedAt: change.updated_at,
        topLevelClientId: change.client_id,
        dataKeys: Object.keys(data),
        // Check for snake_case versions in data
        hasSnakeCaseEntityRelations: !!(data as any).entity_relations,
        hasSnakeCaseRelationshipUpdates: !!(data as any).relationship_updates,
        snakeCaseEntityRelations: (data as any).entity_relations,
        snakeCaseRelationshipUpdates: (data as any).relationship_updates
      }, MODULE_NAME);
    });
  }
  
  /**
   * Summarize execution results
   */
  private summarizeResults(results: ExecutionResult[]): {
    allSuccessful: boolean;
    lastError?: Error;
    appliedCount: number;
    skippedCount: number;
  } {
    let allSuccessful = true;
    let lastError: Error | undefined;
    let appliedCount = 0;
    let skippedCount = 0;
    
    for (const result of results) {
      if (!result.success) {
        allSuccessful = false;
        lastError = new Error(result.error?.message || 'Change processing failed');
      } else if (result.skipped) {
        skippedCount++;
      } else {
        appliedCount++;
      }
    }
    
    return { allSuccessful, lastError, appliedCount, skippedCount };
  }
  
  /**
   * Send acknowledgment that we received client changes
   */
  private async sendChangesReceived(
    clientId: string,
    changeIds: string[]
  ): Promise<void> {
    const message: ServerReceivedMessage = {
      type: 'srv_changes_received',
      messageId: `srv_${Date.now()}`,
      timestamp: Date.now(),
      clientId,
      changeIds
    };

    try {
      await this.messageHandler.send(message);
    } catch (error) {
      syncLogger.error(`Failed to send 'received' acknowledgment to client ${clientId}`, {
        clientId,
        messageType: message.type,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Send acknowledgment that we applied client changes
   */
  private async sendChangesApplied(
    clientId: string,
    changeIds: string[],
    success: boolean,
    error?: Error
  ): Promise<void> {
    const message: ServerAppliedMessage = {
      type: 'srv_changes_applied',
      messageId: `srv_${Date.now()}`,
      timestamp: Date.now(),
      clientId,
      appliedChanges: changeIds,
      success,
      error: error?.message
    };

    try {
      await this.messageHandler.send(message);
    } catch (error) {
      syncLogger.error(`Failed to send 'applied' acknowledgment to client ${clientId}`, {
        clientId,
        messageType: message.type,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Send error message to client
   */
  private async sendError(clientId: string, error?: Error): Promise<void> {
    const errorResponse = {
      type: 'srv_error' as const,
      messageId: `srv_${Date.now()}_error`,
      timestamp: Date.now(),
      clientId,
    };

    try {
      await this.messageHandler.send(errorResponse);
    } catch (sendError) {
      syncLogger.error(`Failed to send error message to client ${clientId}`, {
        clientId,
        originalError: error?.message || 'Unknown error',
        sendError: sendError instanceof Error ? sendError.message : String(sendError),
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
    }
  }
  
  /**
   * Set statement timeout
   */
  private async setStatementTimeout(): Promise<void> {
    try {
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Statement timeout setting timed out after 5000ms`));
        }, 5000);
      });
      
      await Promise.race([
        this.client.query(`SET statement_timeout = ${this.config.database.statementTimeoutMs}`),
        timeoutPromise
      ]);
    } catch (error) {
      syncLogger.error(`Failed to set statement timeout: ${error instanceof Error ? error.message : String(error)}`, {
        timeout: this.config.database.statementTimeoutMs,
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
      // Continue execution even if setting the timeout fails
    }
  }
} 