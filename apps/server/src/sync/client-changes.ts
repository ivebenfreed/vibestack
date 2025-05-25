import { Client } from '@neondatabase/serverless';
import { 
  TableChange, 
  ServerReceivedMessage,
  ServerAppliedMessage,
  ClientChangesMessage,
  ServerMessage,
  RecordData,
  ExecutionResult
} from '@repo/sync-types';
import { syncLogger } from '../middleware/logger';
import { getDBClient } from '../lib/db';
import type { MinimalContext } from '../types/hono';
import type { WebSocketHandler } from './types';
import { deduplicateChanges } from '../lib/sync-common';
import { SyncConfig, DEFAULT_SYNC_CONFIG } from '../types/sync';
import { ProjectRepository } from '../domains/projects';
import { TaskRepository } from '../domains/tasks';
import { NeonService } from '../lib/neon-orm/neon-service';

const MODULE_NAME = 'client-changes';

/**
 * Specialized error types for better handling
 */
class DatabaseError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class CRDTConflictError extends Error {
  constructor(message: string, public readonly details: any) {
    super(message);
    this.name = 'CRDTConflictError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Main change processor that handles all operations
 */
export class ChangeProcessor {
  private neonService: NeonService;
  private projectRepository: ProjectRepository;
  private taskRepository: TaskRepository;
  
  constructor(
    private client: Client,
    private messageHandler: WebSocketHandler,
    private env: { DATABASE_URL: string; NODE_ENV?: string },
    private config: SyncConfig = DEFAULT_SYNC_CONFIG
  ) {
    // Create NeonService instance using the real DATABASE_URL from the environment
    this.neonService = this.createNeonServiceFromEnvironment();
    
    // Initialize repositories
    this.projectRepository = new ProjectRepository(this.neonService);
    this.taskRepository = new TaskRepository(this.neonService);
  }

  /**
   * Create NeonService instance using the real DATABASE_URL from environment
   * This allows TypeORM to create proper Neon connections as intended
   */
  private createNeonServiceFromEnvironment(): NeonService {
    // Create a STABLE mock Hono context with the REAL DATABASE_URL from the Cloudflare Worker context
    // IMPORTANT: Use stable values to avoid triggering DataSource re-initialization
    const stableRequestId = `sync-${this.env.DATABASE_URL?.slice(-10) || 'default'}`;
    
    const context = {
      req: { 
        header: (name: string) => {
          // Mock header method - return STABLE values for expected headers
          if (name === 'cf-request-id') {
            return stableRequestId; // Use stable ID instead of random
          }
          return undefined;
        }
      },
      env: { 
        DATABASE_URL: this.env.DATABASE_URL,
        NODE_ENV: this.env.NODE_ENV || "development"
      },
      finalized: false,
      error: null,
      get executionCtx() { return null; },
      get event() { return null; },
      var: {}, // Mock variables object
      // Add common Hono context methods that might be called
      get: (key: string) => undefined,
      set: (key: string, value: any) => {},
      json: (data: any) => Promise.resolve(new Response(JSON.stringify(data))),
      text: (text: string) => Promise.resolve(new Response(text))
    } as unknown as any;
    
    return new NeonService(context);
  }

  /**
   * Process client changes - main entry point
   */
  async processChanges(message: ClientChangesMessage): Promise<void> {
    const { clientId, changes } = message;
    
    // ✨ NEW: Add detailed logging of received TableChange objects
    syncLogger.info(`🔍 [SERVER] Received ${changes.length} TableChange objects from client ${clientId}`, {
      clientId,
      messageId: message.messageId,
      changesCount: changes.length
    }, MODULE_NAME);
    
    // Log each TableChange object in detail
    changes.forEach((change, index) => {
      const data = change.data as RecordData;
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
    
    try {
      // Set statement timeout
      await this.setStatementTimeout();
      
      // Extract change IDs for acknowledgment
      const changeIds = changes.map(change => (change.data as RecordData).id);
      
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
      
      // Process changes - use the .changes property from the deduplication result
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
      
      // Single log at completion with summary - use .changes.length
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
   * Process all changes, grouped by table and operation
   */
  private async processAllChanges(changes: TableChange[]): Promise<ExecutionResult[]> {
    // Group changes by table and operation
    const groups = this.groupChangesByTableAndOperation(changes);
    const results: ExecutionResult[] = [];
    const processingMap = new Map<string, boolean>(); // Track which changes were processed
    
    // Track all changes by ID for conflict detection
    for (const change of changes) {
      const data = change.data as RecordData;
      processingMap.set(data.id, false); // Initially mark all as unprocessed
    }
    
    // Process each group
    for (const group of groups) {
      try {
        let batchResults: any[] = [];
        
        // ✨ NEW: Check if any changes in this group have relationship updates
        const hasRelationshipUpdates = group.changes.some(change => 
          change.relationshipUpdates && change.relationshipUpdates.length > 0
        );
        
        if (hasRelationshipUpdates) {
          // Process relationship changes individually
          batchResults = await this.processRelationshipChanges(group.table, group.changes);
        } else {
          // Process regular entity changes as before
          switch (group.operation) {
            case 'insert':
              // Use true batch insert for better performance
              if (group.changes.length > 1) {
                batchResults = await this.executeBatchInsert(group.table, group.changes);
              } else {
                batchResults = await this.executeBatch(group.table, group.changes, this.executeInsert.bind(this));
              }
              break;
            case 'update':
              // We can use batch for updates too since we're already grouping by table
              batchResults = await this.executeBatch(group.table, group.changes, this.executeUpdate.bind(this));
              break;
            case 'delete':
              batchResults = await this.executeBatch(
                group.table, 
                group.changes, 
                (table, data) => this.executeDelete(table, data.id, data.updated_at)
              );
              break;
          }
        }
        
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
          const data = change.data as RecordData;
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
   * Execute a batch operation with a common executor function
   */
  private async executeBatch(
    table: string, 
    changes: TableChange[],
    executor: (table: string, data: RecordData) => Promise<any>
  ): Promise<any[]> {
    if (changes.length === 0) return [];
    if (changes.length === 1) {
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Single operation timed out after 10000ms`));
        }, 10000);
      });
      
      try {
        const result = await Promise.race([
          executor(table, changes[0].data as RecordData),
          timeoutPromise
        ]);
        return result ? [result] : [];
      } catch (error) {
        syncLogger.error(`Single operation timed out or failed: ${error instanceof Error ? error.message : String(error)}`, {
          table,
          operation: changes[0].operation,
          id: (changes[0].data as RecordData).id,
          timestamp: new Date().toISOString()
        }, MODULE_NAME);
        return [];
      }
    }
    
    const results: any[] = [];
    
    // Process each change with a timeout
    for (const change of changes) {
      try {
        const data = change.data as RecordData;
        
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation timed out after 10000ms`));
          }, 10000);
        });
        
        syncLogger.debug(`Executing operation on ${table} for id ${data.id}`, {
          table,
          operation: change.operation,
          id: data.id,
          timestamp: new Date().toISOString()
        }, MODULE_NAME);
        
        const result = await Promise.race([
          executor(table, data),
          timeoutPromise
        ]);
        
        // Only add successful results (null results are CRDT conflicts)
        if (result) {
          syncLogger.debug(`Operation succeeded on ${table} for id ${data.id}`, {
            table,
            operation: change.operation,
            id: data.id,
            timestamp: new Date().toISOString()
          }, MODULE_NAME);
          results.push(result);
        } else {
          syncLogger.debug(`Operation skipped on ${table} for id ${data.id} (CRDT conflict)`, {
            table,
            operation: change.operation,
            id: data.id,
            timestamp: new Date().toISOString()
          }, MODULE_NAME);
        }
      } catch (error) {
        // Log the error but continue processing other changes
        syncLogger.warn(`Error processing change ${table}:${change.operation} ${(change.data as RecordData).id}: ${
          error instanceof Error ? error.message : String(error)
        }`, {
          error: error instanceof Error ? error.stack : String(error),
          timestamp: new Date().toISOString()
        }, MODULE_NAME);
      }
    }
    
    return results;
  }
  
  /**
   * Process changes individually
   */
  private async processIndividually(
    table: string, 
    changes: TableChange[], 
    operation: string
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (const change of changes) {
      try {
        const data = change.data as RecordData;
        let result: any;
        
        switch (operation) {
          case 'insert':
            result = await this.executeInsert(table, data);
            break;
          case 'update':
            result = await this.executeUpdate(table, data);
            break;
          case 'delete':
            result = await this.executeDelete(table, data.id, data.updated_at);
            break;
        }
        
        // Only add successful results (null results are CRDT conflicts)
        if (result) results.push(result);
      } catch (error) {
        // Log the error but continue processing other changes
        syncLogger.warn(`Error processing individual change ${table}:${change.operation} ${(change.data as RecordData).id}: ${
          error instanceof Error ? error.message : String(error)
        }`);
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
 * Execute an insert operation
 */
private async executeInsert(table: string, data: RecordData): Promise<any> {
  // Handle junction tables specially
  if (this.isJunctionTable(table)) {
    return this.executeJunctionInsert(table, data);
  }
  
  // Validate data
  if (!data.id) {
    throw new ValidationError('Missing id in insert operation');
  }
  
  const { metadata, ...insertData } = data as any;
  
  // Ensure client_id is included
  insertData.client_id = data.client_id;
  
  const fields = Object.keys(insertData);
  const values = Object.values(insertData);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  
  // Build upsert query - CRDT timestamp check is handled by trigger
  const query = `
    INSERT INTO "${table}" (${fields.map(f => `"${f}"`).join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE 
    SET ${fields
      .filter(f => f !== 'id')
      .map(f => `"${f}" = EXCLUDED."${f}"`)
      .join(', ')}
    RETURNING *
  `;

  try {
    const result = await this.client.query(query, values);
    
    // If no rows returned, it was likely rejected by the CRDT trigger
    if (result.rowCount === 0) {
      // Just report as a conflict without extra fetch
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    throw new DatabaseError(
      error instanceof Error ? error.message : String(error),
      { table, operation: 'insert', id: data.id }
    );
  }
}
  
  /**
 * Execute an update operation
 */
private async executeUpdate(table: string, data: RecordData): Promise<any> {
  // Junction tables don't support update operations
  if (this.isJunctionTable(table)) {
    throw new ValidationError(`Update operations not supported on junction table: ${table}`);
  }
  
  // Validate data
  if (!data.id) {
    throw new ValidationError('Missing id in update operation');
  }
  
  const { 
    metadata, 
    id, 
    entityRelations, 
    relationshipUpdates, 
    entity_relations,     // ✨ NEW: Handle snake_case version
    relationship_updates, // ✨ NEW: Handle snake_case version
    ...updateData 
  } = data as any;
  
  // Ensure client_id is included
  updateData.client_id = data.client_id;
  
  const fields = Object.keys(updateData);
  const values = Object.values(updateData);
  const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
  
  // Build update query - CRDT timestamp check is handled by trigger
  const query = `
    UPDATE "${table}"
    SET ${setClause}
    WHERE id = $${values.length + 1}
    RETURNING *
  `;

  try {
    const result = await this.client.query(query, [...values, id]);
    
    // If no rows affected, the record doesn't exist or CRDT trigger rejected it
    if (result.rowCount === 0) {
      // Just return null, let caller handle it
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    throw new DatabaseError(
      error instanceof Error ? error.message : String(error),
      { table, operation: 'update', id: data.id }
    );
  }
}
  
  /**
 * Execute a delete operation
 */
private async executeDelete(table: string, id: string, timestamp: string): Promise<any> {
  // Handle junction tables specially
  if (this.isJunctionTable(table)) {
    return this.executeJunctionDelete(table, id);
  }
  
  // For deletes, we still need the timestamp check in WHERE clause
  // since triggers don't prevent DELETE operations the same way
  const query = `
    DELETE FROM "${table}"
    WHERE id = $1
    AND updated_at <= $2
    RETURNING *
  `;

  try {
    const result = await this.client.query(query, [id, timestamp]);
    return result.rows[0] || null;
  } catch (error) {
    throw new DatabaseError(
      error instanceof Error ? error.message : String(error),
      { table, operation: 'delete', id }
    );
  }
}

/**
 * Check if a table is a junction table (many-to-many relationship table)
 */
private isJunctionTable(table: string): boolean {
  // Define known junction tables
  const junctionTables = ['project_members', 'task_dependencies'];
  return junctionTables.includes(table);
}

/**
 * Execute an insert operation on a junction table
 */
private async executeJunctionInsert(table: string, data: RecordData): Promise<any> {
  if (table === 'project_members') {
    return this.executeProjectMemberInsert(data);
  }
  if (table === 'task_dependencies') {
    return this.executeTaskDependencyInsert(data);
  }
  
  throw new ValidationError(`Unsupported junction table: ${table}`);
}

/**
 * Execute a delete operation on a junction table
 */
private async executeJunctionDelete(table: string, syntheticId: string): Promise<any> {
  if (table === 'project_members') {
    return this.executeProjectMemberDelete(syntheticId);
  }
  if (table === 'task_dependencies') {
    return this.executeTaskDependencyDelete(syntheticId);
  }
  
  throw new ValidationError(`Unsupported junction table: ${table}`);
}

/**
 * Execute project member insert
 */
private async executeProjectMemberInsert(data: RecordData): Promise<any> {
  const projectId = (data as any).project_id;
  const userId = (data as any).user_id;
  
  if (!projectId || !userId) {
    throw new ValidationError('Missing project_id or user_id in project_members insert');
  }
  
  const query = `
    INSERT INTO "project_members" (project_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (project_id, user_id) DO NOTHING
    RETURNING project_id, user_id
  `;
  
  try {
    const result = await this.client.query(query, [projectId, userId]);
    
    // Return synthetic record for consistency
    if (result.rowCount && result.rowCount > 0) {
      return {
        id: `${projectId}_${userId}`,
        project_id: projectId,
        user_id: userId
      };
    }
    
    return null; // Conflict or already exists
  } catch (error) {
    throw new DatabaseError(
      error instanceof Error ? error.message : String(error),
      { table: 'project_members', operation: 'insert', project_id: projectId, user_id: userId }
    );
  }
}

/**
 * Execute project member delete
 */
private async executeProjectMemberDelete(syntheticId: string): Promise<any> {
  // Parse synthetic ID: "projectId_userId"
  const parts = syntheticId.split('_');
  if (parts.length !== 2) {
    throw new ValidationError(`Invalid synthetic ID format for project_members: ${syntheticId}`);
  }
  
  const [projectId, userId] = parts;
  
  const query = `
    DELETE FROM "project_members"
    WHERE project_id = $1 AND user_id = $2
    RETURNING project_id, user_id
  `;
  
  try {
    const result = await this.client.query(query, [projectId, userId]);
    
    // Return synthetic record for consistency
    if (result.rowCount && result.rowCount > 0) {
      return {
        id: syntheticId,
        project_id: projectId,
        user_id: userId
      };
    }
    
    return null; // Nothing to delete
  } catch (error) {
    throw new DatabaseError(
      error instanceof Error ? error.message : String(error),
      { table: 'project_members', operation: 'delete', synthetic_id: syntheticId }
    );
  }
}

/**
 * Execute task dependency insert
 */
private async executeTaskDependencyInsert(data: RecordData): Promise<any> {
  const dependentTaskId = (data as any).dependent_task_id;
  const dependencyTaskId = (data as any).dependency_task_id;
  
  if (!dependentTaskId || !dependencyTaskId) {
    throw new ValidationError('Missing dependent_task_id or dependency_task_id in task_dependencies insert');
  }
  
  const query = `
    INSERT INTO "task_dependencies" (dependent_task_id, dependency_task_id)
    VALUES ($1, $2)
    ON CONFLICT (dependent_task_id, dependency_task_id) DO NOTHING
    RETURNING dependent_task_id, dependency_task_id
  `;
  
  try {
    const result = await this.client.query(query, [dependentTaskId, dependencyTaskId]);
    
    // Return synthetic record for consistency
    if (result.rowCount && result.rowCount > 0) {
      return {
        id: `${dependentTaskId}_${dependencyTaskId}`,
        dependent_task_id: dependentTaskId,
        dependency_task_id: dependencyTaskId
      };
    }
    
    return null; // Conflict or already exists
  } catch (error) {
    throw new DatabaseError(
      error instanceof Error ? error.message : String(error),
      { table: 'task_dependencies', operation: 'insert', dependent_task_id: dependentTaskId, dependency_task_id: dependencyTaskId }
    );
  }
}

/**
 * Execute task dependency delete
 */
private async executeTaskDependencyDelete(syntheticId: string): Promise<any> {
  // Parse synthetic ID: "dependentTaskId_dependencyTaskId"
  const parts = syntheticId.split('_');
  if (parts.length !== 2) {
    throw new ValidationError(`Invalid synthetic ID format for task_dependencies: ${syntheticId}`);
  }
  
  const [dependentTaskId, dependencyTaskId] = parts;
  
  const query = `
    DELETE FROM "task_dependencies"
    WHERE dependent_task_id = $1 AND dependency_task_id = $2
    RETURNING dependent_task_id, dependency_task_id
  `;
  
  try {
    const result = await this.client.query(query, [dependentTaskId, dependencyTaskId]);
    
    // Return synthetic record for consistency
    if (result.rowCount && result.rowCount > 0) {
      return {
        id: syntheticId,
        dependent_task_id: dependentTaskId,
        dependency_task_id: dependencyTaskId
      };
    }
    
    return null; // Nothing to delete
  } catch (error) {
    throw new DatabaseError(
      error instanceof Error ? error.message : String(error),
      { table: 'task_dependencies', operation: 'delete', synthetic_id: syntheticId }
    );
  }
}
  
  /**
   * Fetch a record from the database - only used when absolutely necessary
   */
  private async fetchCurrentRecord(table: string, id: string): Promise<any> {
    try {
      const query = `
        SELECT * 
        FROM "${table}" 
        WHERE id = $1 
        LIMIT 1
      `;
      
      const result = await this.client.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError(
        error instanceof Error ? error.message : String(error),
        { table, operation: 'fetch', id }
      );
    }
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
      // SyncDO.ts will handle detailed logging of this message
      await this.messageHandler.send(message);
    } catch (error) {
      syncLogger.error(`Failed to send 'received' acknowledgment to client ${clientId}`, {
        clientId,
        messageType: message.type,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error; // Re-throw to handle in the calling method
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
      appliedChanges: changeIds, // Correct field according to type definition
      success,
      error: error?.message
    };

    try {
      // SyncDO.ts will handle detailed logging of this message
      await this.messageHandler.send(message);
    } catch (error) {
      syncLogger.error(`Failed to send 'applied' acknowledgment to client ${clientId}`, {
        clientId,
        messageType: message.type,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error; // Re-throw to handle in the calling method
    }
  }

  /**
   * Send error message to client
   */
  private async sendError(clientId: string, error?: Error): Promise<void> {
    // Create a simple message with just the required fields for ServerMessage
    const errorResponse = {
      type: 'srv_error' as const,
      messageId: `srv_${Date.now()}_error`,
      timestamp: Date.now(),
      clientId,
      // We don't add any additional fields that aren't in the type
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
      // We don't re-throw here since this is already handling an error condition
    }
  }
  
  /**
   * Set statement timeout
   */
  private async setStatementTimeout(): Promise<void> {
    // Only log errors, no need for info logs about setting timeout
    try {
      // Add a local timeout to prevent hanging indefinitely
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Statement timeout setting timed out after 5000ms`));
        }, 5000);
      });
      
      // Race the query against a timeout
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

  /**
   * Perform a true batch insert with a multi-row VALUES clause for better performance
   */
  private async executeBatchInsert(table: string, changes: TableChange[]): Promise<any[]> {
    if (changes.length === 0) return [];
    if (changes.length === 1) return [await this.executeInsert(table, changes[0].data as RecordData)].filter(Boolean);
    
    // First determine the complete set of fields from all records
    const allFields = new Set<string>();
    for (const change of changes) {
      const data = change.data as RecordData;
      Object.keys(data).forEach(key => {
        // ✨ NEW: Filter out all metadata fields (both camelCase and snake_case)
        if (key !== 'metadata' && 
            key !== 'entityRelations' && 
            key !== 'relationshipUpdates' &&
            key !== 'entity_relations' &&      // ✨ NEW: Handle snake_case
            key !== 'relationship_updates') {  // ✨ NEW: Handle snake_case
          allFields.add(key);
        }
      });
    }
    
    const fields = Array.from(allFields);
    const placeholders: string[] = [];
    const allValues: any[] = [];
    let paramIndex = 1;
    
    // Build values for each row
    for (const change of changes) {
      const data = change.data as RecordData;
      const rowPlaceholders: string[] = [];
      
      // For each field in our complete field list
      for (const field of fields) {
        if (field === 'metadata') continue; // Skip metadata
        
        // Use the value if present or NULL
        const value = data[field as keyof RecordData];
        allValues.push(value !== undefined ? value : null);
        rowPlaceholders.push(`$${paramIndex++}`);
      }
      
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }
    
    // Build the ON CONFLICT update clause
    const updateClause = fields
      .filter(f => f !== 'id') // Don't update the id
      .map(f => `"${f}" = EXCLUDED."${f}"`)
      .join(', ');
    
    // Build the full query
    const query = `
      INSERT INTO "${table}" (${fields.map(f => `"${f}"`).join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO UPDATE 
      SET ${updateClause}
      RETURNING *
    `;
    
    try {
      // Add a timeout to the batch insert
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Batch insert timed out after 20000ms`));
        }, 20000);
      });
      
      syncLogger.info(`Executing batch insert for ${table} with ${changes.length} records`, {
        table,
        recordCount: changes.length,
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
      
      const result = await Promise.race([
        this.client.query(query, allValues),
        timeoutPromise
      ]);
      
      if (!result) {
        throw new Error('Query result is null');
      }
      
      syncLogger.info(`Batch insert completed for ${table}: ${result.rowCount} rows affected`, {
        table,
        rowCount: result.rowCount,
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
      
      return result.rows;
    } catch (error) {
      syncLogger.error(`Batch insert failed for ${table} (${changes.length} records): ${
        error instanceof Error ? error.message : String(error)
      }`, {
        table,
        recordCount: changes.length,
        error: error instanceof Error ? error.stack : String(error),
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
      
      // Fall back to individual inserts
      syncLogger.info(`Falling back to individual inserts for ${table}`, {
        table,
        recordCount: changes.length,
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
      
      return this.executeBatch(table, changes, this.executeInsert.bind(this));
    }
  }

  /**
   * ✨ NEW: Process changes that include relationship updates
   */
  private async processRelationshipChanges(table: string, changes: TableChange[]): Promise<any[]> {
    const results: any[] = [];
    
    for (const change of changes) {
      try {
        const data = change.data as RecordData;
        
        // First, handle any regular entity data updates (if there are fields other than just 'id')
        const entityFields = Object.keys(data).filter(key => key !== 'id');
        if (entityFields.length > 0) {
          const entityResult = await this.executeUpdate(table, data);
          if (entityResult) {
            results.push(entityResult);
          }
        }
        
        // Then, handle relationship updates
        if (change.relationshipUpdates && change.relationshipUpdates.length > 0) {
          await this.processEntityRelationshipUpdates(table, data.id, change.relationshipUpdates);
          
          // For relationship updates, we still need to return a result to mark as processed
          // Use the existing entity data or fetch it if we didn't update entity fields
          const relationshipResult = entityFields.length > 0 ? 
            results[results.length - 1] : 
            await this.fetchCurrentRecord(table, data.id);
            
          if (relationshipResult && !entityFields.length) {
            results.push(relationshipResult);
          }
        }
        
        syncLogger.debug(`Processed relationship change for ${table}:${data.id}`, {
          table,
          entityId: data.id,
          relationshipCount: change.relationshipUpdates?.length || 0
        }, MODULE_NAME);
        
      } catch (error) {
        syncLogger.error(`Error processing relationship change for ${table}: ${
          error instanceof Error ? error.message : String(error)
        }`, {
          table,
          entityId: (change.data as RecordData).id
        }, MODULE_NAME);
        
        // Don't throw - continue processing other changes
      }
    }
    
    return results;
  }

  /**
   * ✨ NEW: Process relationship updates for a specific entity
   */
  private async processEntityRelationshipUpdates(
    table: string, 
    entityId: string, 
    relationshipUpdates: Array<{
      relationName: string;
      operation: 'set' | 'add' | 'remove';
      targetIds: string[];
    }>
  ): Promise<void> {
    for (const relUpdate of relationshipUpdates) {
      switch (table) {
        case 'projects':
          await this.processProjectRelationshipUpdate(entityId, relUpdate);
          break;
        case 'tasks':
          await this.processTaskRelationshipUpdate(entityId, relUpdate);
          break;
        default:
          syncLogger.warn(`Unknown entity table for relationship updates: ${table}`, {
            table,
            entityId,
            relationName: relUpdate.relationName
          }, MODULE_NAME);
      }
    }
  }

  /**
   * ✨ NEW: Process project relationship updates
   */
  private async processProjectRelationshipUpdate(
    projectId: string, 
    relUpdate: {
      relationName: string;
      operation: 'set' | 'add' | 'remove';
      targetIds: string[];
    }
  ): Promise<void> {
    switch (relUpdate.relationName) {
      case 'members':
        await this.updateProjectMembers(projectId, relUpdate);
        break;
      default:
        syncLogger.warn(`Unknown project relationship: ${relUpdate.relationName}`, {
          projectId,
          relationName: relUpdate.relationName
        }, MODULE_NAME);
    }
  }

  /**
   * ✨ NEW: Process task relationship updates
   */
  private async processTaskRelationshipUpdate(
    taskId: string, 
    relUpdate: {
      relationName: string;
      operation: 'set' | 'add' | 'remove';
      targetIds: string[];
    }
  ): Promise<void> {
    switch (relUpdate.relationName) {
      case 'dependencies':
        await this.updateTaskDependencies(taskId, relUpdate);
        break;
      case 'assignees':
        // TODO: TaskRepository doesn't have assignee management methods yet
        syncLogger.warn(`Task assignee relationship updates not yet implemented`, {
          taskId,
          relationName: relUpdate.relationName,
          operation: relUpdate.operation,
          targetCount: relUpdate.targetIds.length
        }, MODULE_NAME);
        break;
      default:
        syncLogger.warn(`Unknown task relationship: ${relUpdate.relationName}`, {
          taskId,
          relationName: relUpdate.relationName
        }, MODULE_NAME);
    }
  }

  /**
   * ✨ NEW: Update project members based on relationship operation using repositories
   * (now with proper DATABASE_URL so TypeORM can create proper connections)
   */
  private async updateProjectMembers(
    projectId: string,
    relUpdate: {
      operation: 'set' | 'add' | 'remove';
      targetIds: string[];
    }
  ): Promise<void> {
    try {
      switch (relUpdate.operation) {
        case 'set':
          // Replace entire member list using repository method
          await this.projectRepository.updateMembers(projectId, relUpdate.targetIds);
          break;
          
        case 'add':
          // Add specific members using repository method
          for (const userId of relUpdate.targetIds) {
            await this.projectRepository.addMember(projectId, userId);
          }
          break;
          
        case 'remove':
          // Remove specific members using repository method
          for (const userId of relUpdate.targetIds) {
            await this.projectRepository.removeMember(projectId, userId);
          }
          break;
      }
      
      syncLogger.debug(`Updated project members via repository`, {
        projectId,
        operation: relUpdate.operation,
        memberCount: relUpdate.targetIds.length
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error(`Failed to update project members via repository`, {
        projectId,
        operation: relUpdate.operation,
        memberCount: relUpdate.targetIds.length,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * ✨ NEW: Update task dependencies based on relationship operation using repositories where possible
   * (now with proper DATABASE_URL so TypeORM can create proper connections)
   */
  private async updateTaskDependencies(
    taskId: string,
    relUpdate: {
      operation: 'set' | 'add' | 'remove';
      targetIds: string[];
    }
  ): Promise<void> {
    try {
      switch (relUpdate.operation) {
        case 'set':
          // Replace entire dependency list - use direct SQL for now since TaskRepository might not have this method
          await this.client.query('BEGIN');
          try {
            await this.client.query(
              'DELETE FROM task_dependencies WHERE dependent_task_id = $1',
              [taskId]
            );
            
            // Add new dependencies
            if (relUpdate.targetIds.length > 0) {
              for (const depTaskId of relUpdate.targetIds) {
                await this.client.query(
                  'INSERT INTO task_dependencies (dependent_task_id, dependency_task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                  [taskId, depTaskId]
                );
              }
            }
            
            await this.client.query('COMMIT');
          } catch (error) {
            await this.client.query('ROLLBACK');
            throw error;
          }
          break;
          
        case 'add':
          // Add specific dependencies - try to use repository method if available
          for (const depTaskId of relUpdate.targetIds) {
            try {
              // Check if the repository has an addDependency method
              if (typeof this.taskRepository.addDependency === 'function') {
                await this.taskRepository.addDependency(taskId, depTaskId);
              } else {
                // Fallback to direct SQL
                await this.client.query(
                  'INSERT INTO task_dependencies (dependent_task_id, dependency_task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                  [taskId, depTaskId]
                );
              }
            } catch (error) {
              // Fallback to direct SQL if repository method fails
              await this.client.query(
                'INSERT INTO task_dependencies (dependent_task_id, dependency_task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [taskId, depTaskId]
              );
            }
          }
          break;
          
        case 'remove':
          // Remove specific dependencies - try to use repository method if available
          for (const depTaskId of relUpdate.targetIds) {
            try {
              // Check if the repository has a removeDependency method
              if (typeof this.taskRepository.removeDependency === 'function') {
                await this.taskRepository.removeDependency(taskId, depTaskId);
              } else {
                // Fallback to direct SQL
                await this.client.query(
                  'DELETE FROM task_dependencies WHERE dependent_task_id = $1 AND dependency_task_id = $2',
                  [taskId, depTaskId]
                );
              }
            } catch (error) {
              // Fallback to direct SQL if repository method fails
              await this.client.query(
                'DELETE FROM task_dependencies WHERE dependent_task_id = $1 AND dependency_task_id = $2',
                [taskId, depTaskId]
              );
            }
          }
          break;
      }
      
      syncLogger.debug(`Updated task dependencies via repository/SQL hybrid`, {
        taskId,
        operation: relUpdate.operation,
        dependencyCount: relUpdate.targetIds.length
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error(`Failed to update task dependencies via repository/SQL hybrid`, {
        taskId,
        operation: relUpdate.operation,
        dependencyCount: relUpdate.targetIds.length,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }
}

/**
 * Process client changes - main entry point
 */
export async function processClientChanges(
  message: ClientChangesMessage,
  context: MinimalContext,
  messageHandler: WebSocketHandler,
  config: SyncConfig = DEFAULT_SYNC_CONFIG
): Promise<void> {
  const dbClient = getDBClient(context);
  
  try {
    // Connect to the database before processing
    await dbClient.connect();
    
    const processor = new ChangeProcessor(dbClient, messageHandler, context.env, config);
    
    await processor.processChanges(message);
    
    // Small delay to ensure acknowledgments are fully processed by client
    // before we start sending any live updates
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if WebSocketHandler is a SyncDO with lock handling 
    if ('notifyClientChangesComplete' in messageHandler) {
      // Notify that processing is complete (only after all acknowledgments are sent)
      syncLogger.info('Notifying client changes complete', {
        clientId: message.clientId,
        messageId: message.messageId
      }, MODULE_NAME);
      await (messageHandler as any).notifyClientChangesComplete(message.messageId);
    }
  } catch (error) {
    // Check if this is a WebSocket unavailability error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isWebSocketUnavailable = errorMessage.includes('WebSocketUnavailable') || 
                                 errorMessage.includes('No active WebSocket connections');
    
    if (isWebSocketUnavailable) {
      // Log with more specific error about client disconnection
      syncLogger.warn(`Client appears to be disconnected, cannot acknowledge changes: ${errorMessage}`, {
        clientId: message.clientId,
        messageId: message.messageId
      }, MODULE_NAME);
      
      // Re-throw with consistent error format to ensure proper cleanup
      throw new Error(`WebSocketUnavailable: Client ${message.clientId} appears to be disconnected`);
    } else {
      // Log regular processing errors
      syncLogger.error(`Failed to process client changes: ${errorMessage}`, {
        clientId: message.clientId,
        messageId: message.messageId
      }, MODULE_NAME);
      
      // Make sure we still release the lock in case of error
      if ('notifyClientChangesComplete' in messageHandler) {
        try {
          await (messageHandler as any).notifyClientChangesComplete(message.messageId);
        } catch (notifyError) {
          // Just log, don't throw
          syncLogger.error(`Failed to notify client changes completion: ${
            notifyError instanceof Error ? notifyError.message : String(notifyError)
          }`, {
            clientId: message.clientId,
            messageId: message.messageId
          }, MODULE_NAME);
        }
      }
      
      throw error;
    }
  } finally {
    // Ensure we always close the connection
    try {
      await dbClient.end();
    } catch (err) {
      // Just silently close the connection - no need to log errors here
    }
  }
} 