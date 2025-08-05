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
    private config: SyncConfig = DEFAULT_SYNC_CONFIG,
    private broadcastConflicts?: (changes: TableChange[], originClientId: string) => Promise<void>
  ) {
    this.conflictResolver = new ConflictResolver(config);
    this.entityOperations = new EntityOperations(client, env, this.conflictResolver);
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
      const changeIds = changes.map(change => (change?.data as any).id);
      
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
      
      // Process changes and detect conflicts
      const { results, conflictedChanges } = await this.processAllChanges(optimizedChangesResult.changes);
      
      // Summarize results and extract error context
      const summary = this.summarizeResults(results);
      const affectedTables = [...new Set(optimizedChangesResult.changes.map(c => c.table))];
      
      // Send applied acknowledgment with error context
      try {
        await this.sendChangesApplied(
          clientId, 
          changeIds,
          summary.allSuccessful,
          summary.lastError,
          summary.lastError ? {
            affectedTables,
            failedChangeCount: optimizedChangesResult.changes.length - summary.appliedCount
          } : undefined
        );
      } catch (appliedError) {
        syncLogger.error(`Failed to send applied acknowledgment for client ${clientId}`, {
          clientId,
          error: appliedError instanceof Error ? appliedError.message : String(appliedError)
        }, MODULE_NAME);
      }
      
      // Trigger rebroadcast for conflicts with isConflictResolution flag
      if (conflictedChanges.length > 0 && this.broadcastConflicts) {
        try {
          await this.broadcastConflicts(conflictedChanges, clientId);
          syncLogger.info(`Rebroadcast triggered for ${conflictedChanges.length} CRDT conflicts`, {
            clientId,
            conflictCount: conflictedChanges.length,
            conflictTables: [...new Set(conflictedChanges.map(c => c.table))]
          }, MODULE_NAME);
        } catch (broadcastError) {
          syncLogger.error(`Failed to rebroadcast CRDT conflicts for client ${clientId}`, {
            clientId,
            conflictCount: conflictedChanges.length,
            error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError)
          }, MODULE_NAME);
        }
      }
      
      // Log completion summary
      syncLogger.info(`Completed processing ${optimizedChangesResult.changes.length} changes for client ${clientId}`, {
        clientId,
        appliedCount: summary.appliedCount,
        skippedCount: summary.skippedCount,
        conflictCount: conflictedChanges.length,
        success: summary.allSuccessful
      }, MODULE_NAME);
    } catch (error) {
      syncLogger.error(`Processing failed for client ${clientId}`, {
        clientId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, MODULE_NAME);
      
      // Extract affected tables from the changes
      const affectedTables = [...new Set(changes.map(c => c.table))];
      
      // Send proper error acknowledgment via srv_changes_applied
      try {
        await this.sendChangesApplied(
          clientId,
          changes.map(change => (change?.data as any).id),
          false, // success = false
          error instanceof Error ? error : new Error(String(error)),
          {
            affectedTables,
            failedChangeCount: changes.length
          }
        );
      } catch (ackError) {
        syncLogger.error(`Failed to send error acknowledgment to client ${clientId}`, {
          clientId,
          originalError: error instanceof Error ? error.message : String(error),
          ackError: ackError instanceof Error ? ackError.message : String(ackError)
        }, MODULE_NAME);
      }
      
      // Also send srv_error for backwards compatibility
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
   * Returns both results and changes that encountered CRDT conflicts
   */
  private async processAllChanges(changes: TableChange[]): Promise<{
    results: ExecutionResult[];
    conflictedChanges: TableChange[];
  }> {
    // Group changes by table and operation
    const groups = this.groupChangesByTableAndOperation(changes);
    const results: ExecutionResult[] = [];
    const conflictedChanges: TableChange[] = [];
    const processingMap = new Map<string, boolean>(); // Track which changes were processed
    
    // Track all changes by ID for conflict detection
    for (const change of changes) {
      const data = change?.data as any;
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
        
        // Mark successful changes and detect conflicts
        for (let i = 0; i < group.changes.length; i++) {
          const change = group.changes[i];
          const result = batchResults[i];
          const changeId = (change?.data as any).id;
          
          if (result && result.id) {
            processingMap.set(changeId, true); // Mark as processed
            results.push({ success: true, data: result });
          } else if (result === null) {
            // null result indicates CRDT conflict
            if (change) conflictedChanges.push(change);
            processingMap.set(changeId, true); // Mark as processed (but conflicted)
            results.push({ success: true, data: null, skipped: true });
            
            syncLogger.info(`CRDT conflict detected during save`, {
              table: change?.table,
              operation: change?.operation,
              entityId: changeId,
              clientId: change?.clientId
            }, MODULE_NAME);
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
          const data = change?.data as any;
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
    
    return { results, conflictedChanges };
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
      const key = `${change?.table}:${change?.operation}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(change);
    }
    
    // Convert to array of groups
    for (const [key, changes] of groupMap.entries()) {
      const [table, operation] = key.split(':');
      groups.push({ table: table || '', operation: operation || '', changes });
    }
    
    return groups;
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
          hasEntityRelations: !!(change?.entityRelations && change?.entityRelations.length > 0),
          updatedAt: change?.updatedAt,
          dataKeys: Object.keys(data)
        };
      })
    }, MODULE_NAME);
  }
  
  /**
   * Create a concise summary of changes for logging
   * Enhanced to distinguish between entity updates and relationship-only updates
   */
  private createChangesSummary(changes: TableChange[]): Record<string, Record<string, number>> {
    const summary: Record<string, Record<string, number>> = {};
    
    for (const change of changes) {
      const tableName = change?.table;
      const operation = change?.operation;
      
      if (!tableName || !operation) continue;
      
      if (!summary[tableName]) {
        summary[tableName] = {};
      }
      
      // Determine the type of change more accurately
      let changeType: string = operation;
      
      // For updates, check if this is a pure relationship update
      if (operation === 'update' && change?.relationshipUpdates && change?.relationshipUpdates.length > 0) {
        const data = change?.data as any;
        
        // Check if there are actual entity fields to update (beyond id, clientId, updatedAt)
        const entityFields = Object.keys(data).filter(key => 
          key !== 'id' && key !== 'clientId' && key !== 'updatedAt'
        );
        
        if (entityFields.length === 0) {
          // This is a pure relationship update - the entity table itself won't be touched
          changeType = 'relationship_update';
        } else {
          // This is a mixed update - both entity fields and relationships
          changeType = 'update_with_relationships';
        }
      }
      
      if (changeType && summary[tableName]) {
        const tableEntry = summary[tableName];
        if (tableEntry) {
          if (!tableEntry[changeType]) {
            tableEntry[changeType] = 0;
          }
          tableEntry[changeType] = (tableEntry[changeType] || 0) + 1;
        }
      }
    }
    
    return summary;
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
    error?: Error,
    errorContext?: {
      affectedTables?: string[];
      failedChangeCount?: number;
      errorType?: 'database' | 'validation' | 'conflict' | 'unknown';
    }
  ): Promise<void> {
    // Create structured error information
    let errorInfo: string | undefined;
    if (error) {
      const errorData = {
        message: error.message,
        type: errorContext?.errorType || this.classifyError(error),
        details: {
          affectedTables: errorContext?.affectedTables || [],
          failedChangeCount: errorContext?.failedChangeCount || changeIds.length,
          stack: this.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
      errorInfo = JSON.stringify(errorData);
    }

    const message: ServerAppliedMessage = {
      type: 'srv_changes_applied',
      messageId: `srv_${Date.now()}`,
      timestamp: Date.now(),
      clientId,
      appliedChanges: changeIds,
      success,
      error: errorInfo
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
   * Classify error type based on error message/type
   */
  private classifyError(error: Error): 'database' | 'validation' | 'conflict' | 'unknown' {
    const message = error.message.toLowerCase();
    
    if (error instanceof DatabaseError || message.includes('database') || message.includes('constraint')) {
      return 'database';
    }
    if (error instanceof ValidationError || message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    if (error instanceof CRDTConflictError || message.includes('conflict') || message.includes('crdt')) {
      return 'conflict';
    }
    
    return 'unknown';
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