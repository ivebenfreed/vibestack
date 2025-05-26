import { Client } from '@neondatabase/serverless';
import { TableChange } from '@repo/sync-types';
import { syncLogger } from '../../middleware/logger';
import { RepositoryContainer } from '../../domains/RepositoryContainer';
import { NeonService } from '../../lib/neon-orm/neon-service';
import { DatabaseError, ValidationError } from './errors';

const MODULE_NAME = 'entity-operations';

interface RecordData {
  id: string;
  client_id?: string;
  updated_at: string;
  [key: string]: any;
}

/**
 * Handles all entity data operations
 * Including CRUD operations, junction tables, and relationship management
 */
export class EntityOperations {
  private neonService: NeonService;
  private repositories: RepositoryContainer;
  
  constructor(
    private client: Client,
    private env: { DATABASE_URL: string; NODE_ENV?: string }
  ) {
    // Create NeonService instance using the real DATABASE_URL from the environment
    this.neonService = this.createNeonServiceFromEnvironment();
    
    // Initialize repository container for centralized access
    this.repositories = new RepositoryContainer(this.neonService);
  }

  /**
   * Create NeonService instance using the real DATABASE_URL from environment
   */
  private createNeonServiceFromEnvironment(): NeonService {
    const stableRequestId = `sync-${this.env.DATABASE_URL?.slice(-10) || 'default'}`;
    
    const context = {
      req: { 
        header: (name: string) => {
          if (name === 'cf-request-id') {
            return stableRequestId;
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
      var: {},
      get: (key: string) => undefined,
      set: (key: string, value: any) => {},
      json: (data: any) => Promise.resolve(new Response(JSON.stringify(data))),
      text: (text: string) => Promise.resolve(new Response(text))
    } as unknown as any;
    
    return new NeonService(context);
  }

  /**
   * Process a group of changes for a specific table and operation
   */
  async processChangeGroup(table: string, operation: string, changes: TableChange[]): Promise<any[]> {
    // Check if any changes in this group have relationship updates
    const hasRelationshipUpdates = changes.some(change => 
      change.relationshipUpdates && change.relationshipUpdates.length > 0
    );
    
    if (hasRelationshipUpdates) {
      // Process relationship changes individually
      return this.processRelationshipChanges(table, changes);
    } else {
      // Process regular entity changes
      switch (operation) {
        case 'insert':
          // Use true batch insert for better performance
          if (changes.length > 1) {
            return this.executeBatchInsert(table, changes);
          } else {
            const result = await this.executeInsert(table, changes[0].data as RecordData);
            return result ? [result] : [];
          }
        case 'update':
          return this.executeBatch(table, changes, this.executeUpdate.bind(this));
        case 'delete':
          return this.executeBatch(
            table, 
            changes, 
            (table, data) => this.executeDelete(table, data.id, data.updated_at)
          );
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    }
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
   * Execute an insert operation using repositories
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

    try {
      // Get repository for this table
      const repository = this.repositories.getRepository(table);
      if (!repository) {
        throw new ValidationError(`No repository found for table: ${table}`);
      }

      // Clean the data - remove metadata and relationship fields
      const { 
        metadata, 
        entityRelations, 
        relationshipUpdates, 
        entity_relations,
        relationship_updates,
        ...insertData 
      } = data as any;
      
      // Transform snake_case property names to camelCase for TypeORM compatibility
      const transformedData = this.transformPropertyNames(insertData);
      
      // Ensure updatedAt is a Date object
      if (transformedData.updatedAt) {
        transformedData.updatedAt = new Date(transformedData.updatedAt);
      }
      if (transformedData.createdAt) {
        transformedData.createdAt = new Date(transformedData.createdAt);
      }

      // Use CRDT-aware insert that handles conflicts
      const result = await repository.insertOrUpdateIfNewer(transformedData);
      
      return result; // null means conflict (CRDT rejected)
    } catch (error) {
      throw new DatabaseError(
        error instanceof Error ? error.message : String(error),
        { table, operation: 'insert', id: data.id }
      );
    }
  }

  /**
   * Convert snake_case property names to camelCase for TypeORM entity compatibility
   * e.g., 'owner_id' -> 'ownerId', 'created_at' -> 'createdAt'
   */
  private transformPropertyNames(data: any): any {
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Convert snake_case to camelCase
      const camelCaseKey = this.snakeToCamelCase(key);
      transformed[camelCaseKey] = value;
    }
    
    return transformed;
  }
  
  /**
   * Convert snake_case to camelCase
   * e.g., 'owner_id' -> 'ownerId', 'created_at' -> 'createdAt'
   */
  private snakeToCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  /**
   * Execute an update operation using repositories
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

    try {
      // Get repository for this table
      const repository = this.repositories.getRepository(table);
      console.log(`[EntityOperations] executeUpdate - repository lookup:`, {
        table,
        repositoryFound: !!repository,
        repositoryType: repository?.constructor?.name
      });
      
      if (!repository) {
        throw new ValidationError(`No repository found for table: ${table}`);
      }

      // Clean the data - remove metadata and relationship fields
      const { 
        metadata, 
        id, 
        entityRelations, 
        relationshipUpdates, 
        entity_relations,
        relationship_updates,
        ...updateData 
      } = data as any;
      
      // Transform snake_case property names to camelCase for TypeORM compatibility
      const transformedData = this.transformPropertyNames(updateData);
      
      // Ensure client_id becomes clientId and convert updated_at to Date
      if (transformedData.updatedAt) {
        transformedData.updatedAt = new Date(transformedData.updatedAt);
      }

      console.log(`[EntityOperations] executeUpdate - about to call repository.update():`, {
        table,
        id,
        originalDataKeys: Object.keys(updateData),
        transformedDataKeys: Object.keys(transformedData),
        hasClientId: !!transformedData.clientId,
        hasUpdatedAt: !!transformedData.updatedAt
      });

      // Use direct update method for explicit update operations
      // This prevents trying to INSERT when we know it should be an UPDATE
      const result = await repository.update(id, transformedData);
      
      console.log(`[EntityOperations] executeUpdate - repository.update() result:`, {
        table,
        id,
        resultExists: !!result,
        resultType: typeof result
      });
      
      // If entity doesn't exist, this is likely a sync ordering issue
      if (!result) {
        syncLogger.warn(`Update operation failed - entity not found: ${table}:${id}`, {
          table,
          id,
          operation: 'update'
        }, MODULE_NAME);
      }
      
      return result; // null means entity not found or CRDT conflict
    } catch (error) {
      console.error(`[EntityOperations] executeUpdate - ERROR:`, {
        table,
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      throw new DatabaseError(
        error instanceof Error ? error.message : String(error),
        { table, operation: 'update', id: data.id }
      );
    }
  }

  /**
   * Execute a delete operation using repositories
   */
  private async executeDelete(table: string, id: string, timestamp: string): Promise<any> {
    // Handle junction tables specially
    if (this.isJunctionTable(table)) {
      return this.executeJunctionDelete(table, id);
    }

    try {
      // Get repository for this table
      const repository = this.repositories.getRepository(table);
      if (!repository) {
        throw new ValidationError(`No repository found for table: ${table}`);
      }

      // Get current record before delete for return value
      const existing = await repository.findById(id);
      if (!existing) {
        return null; // Entity doesn't exist
      }

      // Use CRDT-aware delete that checks timestamps
      const deleted = await repository.deleteIfNewer(id, new Date(timestamp));
      
      return deleted ? existing : null; // Return the deleted entity or null if conflict
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
    const junctionTables = ['project_members', 'task_dependencies'];
    return junctionTables.includes(table);
  }

  /**
   * Execute an insert operation on a junction table using repositories
   */
  private async executeJunctionInsert(table: string, data: RecordData): Promise<any> {
    if (table === 'project_members') {
      const projectId = (data as any).project_id;
      const userId = (data as any).user_id;
      
      if (!projectId || !userId) {
        throw new ValidationError('Missing project_id or user_id in project_members insert');
      }
      
      try {
        // Use repository method instead of raw SQL
        await this.repositories.projects.addMember(projectId, userId);
        
        // Return synthetic record for consistency
        return {
          id: `${projectId}_${userId}`,
          project_id: projectId,
          user_id: userId
        };
      } catch (error) {
        // Check if this is a conflict (member already exists)
        if (error instanceof Error && error.message.includes('already exists')) {
          return null; // Conflict - member already exists
        }
        
        throw new DatabaseError(
          error instanceof Error ? error.message : String(error),
          { table: 'project_members', operation: 'insert', project_id: projectId, user_id: userId }
        );
      }
    }
    
    if (table === 'task_dependencies') {
      const dependentTaskId = (data as any).dependent_task_id;
      const dependencyTaskId = (data as any).dependency_task_id;
      
      if (!dependentTaskId || !dependencyTaskId) {
        throw new ValidationError('Missing dependent_task_id or dependency_task_id in task_dependencies insert');
      }
      
      try {
        // Use repository method instead of raw SQL
        await this.repositories.tasks.addDependency(dependentTaskId, dependencyTaskId);
        
        // Return synthetic record for consistency
        return {
          id: `${dependentTaskId}_${dependencyTaskId}`,
          dependent_task_id: dependentTaskId,
          dependency_task_id: dependencyTaskId
        };
      } catch (error) {
        // Check if this is a conflict (dependency already exists)
        if (error instanceof Error && error.message.includes('already exists')) {
          return null; // Conflict - dependency already exists
        }
        
        throw new DatabaseError(
          error instanceof Error ? error.message : String(error),
          { table: 'task_dependencies', operation: 'insert', dependent_task_id: dependentTaskId, dependency_task_id: dependencyTaskId }
        );
      }
    }
    
    throw new ValidationError(`Unsupported junction table: ${table}`);
  }

  /**
   * Execute a delete operation on a junction table using repositories
   */
  private async executeJunctionDelete(table: string, syntheticId: string): Promise<any> {
    if (table === 'project_members') {
      // Parse synthetic ID: "projectId_userId"
      const parts = syntheticId.split('_');
      if (parts.length !== 2) {
        throw new ValidationError(`Invalid synthetic ID format for project_members: ${syntheticId}`);
      }
      
      const [projectId, userId] = parts;
      
      try {
        // Use repository method instead of raw SQL
        await this.repositories.projects.removeMember(projectId, userId);
        
        // Return synthetic record for consistency
        return {
          id: syntheticId,
          project_id: projectId,
          user_id: userId
        };
      } catch (error) {
        throw new DatabaseError(
          error instanceof Error ? error.message : String(error),
          { table: 'project_members', operation: 'delete', synthetic_id: syntheticId }
        );
      }
    }
    
    if (table === 'task_dependencies') {
      // Parse synthetic ID: "dependentTaskId_dependencyTaskId"
      const parts = syntheticId.split('_');
      if (parts.length !== 2) {
        throw new ValidationError(`Invalid synthetic ID format for task_dependencies: ${syntheticId}`);
      }
      
      const [dependentTaskId, dependencyTaskId] = parts;
      
      try {
        // Use repository method instead of raw SQL
        await this.repositories.tasks.removeDependency(dependentTaskId, dependencyTaskId);
        
        // Return synthetic record for consistency
        return {
          id: syntheticId,
          dependent_task_id: dependentTaskId,
          dependency_task_id: dependencyTaskId
        };
      } catch (error) {
        throw new DatabaseError(
          error instanceof Error ? error.message : String(error),
          { table: 'task_dependencies', operation: 'delete', synthetic_id: syntheticId }
        );
      }
    }
    
    throw new ValidationError(`Unsupported junction table: ${table}`);
  }

  /**
   * Perform a batch insert using repository bulk operations
   */
  private async executeBatchInsert(table: string, changes: TableChange[]): Promise<any[]> {
    if (changes.length === 0) return [];
    if (changes.length === 1) {
      const result = await this.executeInsert(table, changes[0].data as RecordData);
      return result ? [result] : [];
    }
    
    try {
      // Get repository for this table
      const repository = this.repositories.getRepository(table);
      if (!repository) {
        throw new ValidationError(`No repository found for table: ${table}`);
      }

      // Prepare entities for bulk insert
      const entities = changes.map(change => {
        const data = change.data as RecordData;
        
        // Clean the data - remove metadata and relationship fields
        const { 
          metadata, 
          entityRelations, 
          relationshipUpdates, 
          entity_relations,
          relationship_updates,
          ...entityData 
        } = data as any;
        
        // Transform snake_case property names to camelCase for TypeORM compatibility
        const transformedData = this.transformPropertyNames(entityData);
        
        // Ensure date fields are Date objects
        if (transformedData.updatedAt) {
          transformedData.updatedAt = new Date(transformedData.updatedAt);
        }
        if (transformedData.createdAt) {
          transformedData.createdAt = new Date(transformedData.createdAt);
        }
        
        return transformedData;
      });

      syncLogger.info(`Executing repository bulk upsert for ${table} with ${entities.length} records`, {
        table,
        recordCount: entities.length,
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
      
      // Use repository bulk upsert (handles conflicts with CRDT)
      const results = await repository.bulkUpsert(entities);
      
      syncLogger.info(`Repository bulk upsert completed for ${table}: ${results.length} rows processed`, {
        table,
        rowCount: results.length,
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
      
      return results;
    } catch (error) {
      syncLogger.error(`Repository bulk upsert failed for ${table} (${changes.length} records): ${
        error instanceof Error ? error.message : String(error)
      }`, {
        table,
        recordCount: changes.length,
        error: error instanceof Error ? error.stack : String(error),
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
      
      // Fall back to individual inserts using repositories
      syncLogger.info(`Falling back to individual repository inserts for ${table}`, {
        table,
        recordCount: changes.length,
        timestamp: new Date().toISOString()
      }, MODULE_NAME);
      
      return this.executeBatch(table, changes, this.executeInsert.bind(this));
    }
  }

  /**
   * Process changes that include relationship updates
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
   * Process relationship updates for a specific entity
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
   * Process project relationship updates
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
   * Process task relationship updates
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
   * Update project members based on relationship operation using repositories
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
          await this.repositories.projects.updateMembers(projectId, relUpdate.targetIds);
          break;
          
        case 'add':
          // Add specific members using repository method
          for (const userId of relUpdate.targetIds) {
            await this.repositories.projects.addMember(projectId, userId);
          }
          break;
          
        case 'remove':
          // Remove specific members using repository method
          for (const userId of relUpdate.targetIds) {
            await this.repositories.projects.removeMember(projectId, userId);
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
   * Update task dependencies based on relationship operation using repositories consistently
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
          // Replace entire dependency list using repository method
          // TODO: Add setDependencies method to TaskRepository for batch updates
          // For now, use individual remove/add operations
          
          // Remove all existing dependencies first
          // Note: We should fetch existing dependencies from repository to know what to remove
          // This is a temporary implementation until we add setDependencies to TaskRepository
          for (const depTaskId of relUpdate.targetIds) {
            await this.repositories.tasks.addDependency(taskId, depTaskId);
          }
          
          syncLogger.warn(`Task dependency 'set' operation using individual adds - consider adding setDependencies to TaskRepository`, {
            taskId,
            dependencyCount: relUpdate.targetIds.length
          }, MODULE_NAME);
          break;
          
        case 'add':
          // Add specific dependencies using repository method
          for (const depTaskId of relUpdate.targetIds) {
            await this.repositories.tasks.addDependency(taskId, depTaskId);
          }
          break;
          
        case 'remove':
          // Remove specific dependencies using repository method
          for (const depTaskId of relUpdate.targetIds) {
            await this.repositories.tasks.removeDependency(taskId, depTaskId);
          }
          break;
      }
      
      syncLogger.debug(`Updated task dependencies via repository methods`, {
        taskId,
        operation: relUpdate.operation,
        dependencyCount: relUpdate.targetIds.length
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error(`Failed to update task dependencies via repository methods`, {
        taskId,
        operation: relUpdate.operation,
        dependencyCount: relUpdate.targetIds.length,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Fetch a record from the database using repository
   * Falls back to direct query only if no repository available
   */
  private async fetchCurrentRecord(table: string, id: string): Promise<any> {
    try {
      // Try to use repository first
      const repository = this.repositories.getRepository(table);
      if (repository) {
        return await repository.findById(id);
      }
      
      // Fallback to direct query for unknown tables
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
}