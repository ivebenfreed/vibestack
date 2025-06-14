import { Client } from '@neondatabase/serverless';
import { TableChange } from '@repo/sync-types';
import { syncLogger } from '../../middleware/logger';
import { RepositoryContainer } from '../../domains/RepositoryContainer';
import { NeonService } from '../../lib/neon-orm/neon-service';
import { DatabaseError, ValidationError } from './errors';
import { ConflictResolver } from './ConflictResolver';
import { 
  SERVER_RELATIONSHIP_CONFIGS,
  SERVER_JUNCTION_TABLES,
  SERVER_JUNCTION_TABLE_MAPPING,
  getEntityRelationships,
  hasRelationshipConfig,
  getJunctionRelationships,
  type RelationshipConfig
} from '@repo/dataforge/server-entities';

const MODULE_NAME = 'entity-operations';

interface RecordData {
  id: string;
  clientId?: string;
  updatedAt: string;
  [key: string]: any;
}

/**
 * Handles all entity data operations
 * Including CRUD operations, junction tables, and relationship management
 */
export class EntityOperations {
  private neonService: NeonService;
  private repositories: RepositoryContainer;
  private conflictResolver: ConflictResolver;
  
  constructor(
    private client: Client,
    private env: { DATABASE_URL: string; NODE_ENV?: string },
    conflictResolver: ConflictResolver
  ) {
    // Create NeonService instance using the real DATABASE_URL from the environment
    this.neonService = this.createNeonServiceFromEnvironment();
    
    // Initialize repository container for centralized access
    this.repositories = new RepositoryContainer(this.neonService);
    
    // Store conflict resolver for field-level conflict resolution
    this.conflictResolver = conflictResolver;
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
            (table, data) => this.executeDelete(table, data.id, data.updatedAt)
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
          syncLogger.info(`Operation skipped on ${table} for id ${data.id} (CRDT conflict)`, {
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
      
      // Data is already in camelCase from client - just ensure date fields are Date objects
      const transformedData = this.ensureDateObjects(insertData);

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
   * Ensure date fields are converted from strings to Date objects
   * Handles common date fields across all entities and entity-specific ones
   */
  private ensureDateObjects(obj: Record<string, any>): Record<string, any> {
    const transformed = { ...obj };
    
    // Common date fields across all entities
    const commonDateFields = ['createdAt', 'updatedAt'];
    
    // Entity-specific date fields
    const entityDateFields = {
      tasks: ['dueDate', 'startDate', 'completedAt'],
      projects: [],
      users: [],
      comments: []
    };
    
    // Convert common date fields
    for (const field of commonDateFields) {
      if (transformed[field] && typeof transformed[field] === 'string') {
        transformed[field] = new Date(transformed[field]);
      }
    }
    
    // Convert entity-specific date fields for all known entities
    for (const fields of Object.values(entityDateFields)) {
      for (const field of fields) {
        if (transformed[field] && typeof transformed[field] === 'string') {
          transformed[field] = new Date(transformed[field]);
        }
      }
    }
    
    return transformed;
  }

  /**
   * Execute an update operation using repositories
   * Enhanced with upsert fallback and field-level conflict resolution
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
      syncLogger.debug('Repository lookup for update operation', {
        table,
        repositoryFound: !!repository,
        repositoryType: repository?.constructor?.name
      }, MODULE_NAME);
      
      if (!repository) {
        throw new ValidationError(`No repository found for table: ${table}`);
      }

      // Clean the data - remove metadata and relationship fields, and snake_case duplicates
      const { 
        metadata, 
        id, 
        entityRelations, 
        relationshipUpdates, 
        entity_relations,
        relationship_updates,
        __changeMetadata,  // Enhanced: Remove client-side change metadata
        __metadata,        // Remove sync metadata
        ...updateData 
      } = data as any;
      
      // Clean snake_case duplicates first, then ensure date objects
      const cleanedData = this.ensureDateObjects(updateData);

      syncLogger.debug('Data processing for update operation', {
        table,
        id,
        originalDataKeys: Object.keys(updateData),
        cleanedDataKeys: Object.keys(cleanedData),
        hasClientId: !!cleanedData.clientId,
        hasUpdatedAt: !!cleanedData.updatedAt,
        hasChangeMetadata: !!__changeMetadata,
        isRelationshipOnlyUpdate: Object.keys(cleanedData).filter(k => k !== 'id').every(k => ['clientId', 'updatedAt'].includes(k)) && 
          Object.keys(cleanedData).filter(k => k !== 'id').length <= 2
      }, MODULE_NAME);

      // Enhanced: Log change metadata for debugging
      if (__changeMetadata) {
        syncLogger.debug('Change metadata from client', {
          changedFields: __changeMetadata.changedFields,
          originalUpdatedAt: __changeMetadata.originalUpdatedAt,
          changeTimestamp: __changeMetadata.changeTimestamp,
          hasPartialUpdate: __changeMetadata.hasPartialUpdate
        }, MODULE_NAME);
      }

      // Enhanced: Check for field-level conflicts before applying
      const existing = await repository.findById(id);
      
      if (existing) {
        // Use ConflictResolver to determine if we should apply this change
        const tableChange = {
          table,
          operation: 'update' as const,
          data: { ...data }, // Include original data with metadata
          updatedAt: cleanedData.updatedAt || new Date().toISOString(),
          clientId: cleanedData.clientId
        };
        
        const decision = this.conflictResolver.shouldApplyChange(tableChange, existing);
        
        syncLogger.info(`Conflict resolution decision`, {
          table,
          id,
          shouldApply: decision.shouldApply,
          reason: decision.reason,
          requiresMerge: decision.requiresMerge,
          mergeableFields: decision.mergeableFields?.length || 0,
          conflictingFields: decision.conflictingFields?.length || 0
        }, MODULE_NAME);
        
        if (!decision.shouldApply) {
          syncLogger.info(`Update rejected by conflict resolver: ${table}:${id}`, {
            table,
            id,
            operation: 'update',
            reason: decision.reason
          }, MODULE_NAME);
          
          return null; // Conflict - don't apply
        }
        
        // Enhanced: Handle field-level merging
        if (decision.requiresMerge && decision.mergeableFields) {
          const fieldAnalysis = {
            conflictingFields: decision.conflictingFields || [],
            mergeableFields: decision.mergeableFields,
            resolutionStrategy: 'merge' as const
          };
          
          const mergedEntity = this.conflictResolver.generateMergedEntity(tableChange, existing, fieldAnalysis);
          
          if (mergedEntity) {
            syncLogger.debug(`Applying field-level merge`, {
              table,
              id,
              mergedFields: decision.mergeableFields,
              conflictedFields: decision.conflictingFields || []
            }, MODULE_NAME);
            
            // Apply the merged entity
            const result = await repository.update(id, mergedEntity);
            
            if (result) {
              syncLogger.info(`Update applied with field-level merge: ${table}:${id}`, {
                table,
                id,
                operation: 'field_merge_update',
                mergedFields: decision.mergeableFields.length,
                conflictedFields: (decision.conflictingFields || []).length
              }, MODULE_NAME);
              
              return result;
            }
          }
        }
      }

      // Try direct update first (preferred for explicit update operations)
      const result = await repository.update(id, cleanedData);
      
      syncLogger.debug(`Repository.update() result`, {
        table,
        id,
        resultExists: !!result,
        resultType: typeof result
      }, MODULE_NAME);
      
      // Enhanced: If entity doesn't exist, fall back to upsert for better CRDT handling
      if (!result) {
        syncLogger.warn(`Update operation failed - entity not found: ${table}:${id}. Attempting upsert fallback.`, {
          table,
          id,
          operation: 'update',
          fallbackAttempt: true
        }, MODULE_NAME);
        
        // Try upsert fallback using insertOrUpdateIfNewer
        try {
          // Ensure we have the required fields for insertOrUpdateIfNewer
          const upsertData = {
            ...cleanedData,
            id, // Ensure ID is included
            updatedAt: cleanedData.updatedAt || new Date() // Use camelCase property, TypeORM will map to updated_at column
          };
          
          syncLogger.debug(`Attempting upsert fallback`, {
            table,
            id,
            upsertDataKeys: Object.keys(upsertData),
            hasRequiredFields: {
              id: !!upsertData.id,
              updatedAt: !!upsertData.updatedAt,
              clientId: !!(upsertData as any).clientId
            }
          }, MODULE_NAME);
          
          const upsertResult = await repository.insertOrUpdateIfNewer(upsertData);
          
          if (upsertResult) {
            syncLogger.info(`Update operation succeeded via upsert fallback: ${table}:${id}`, {
              table,
              id,
              operation: 'update_via_upsert',
              success: true
            }, MODULE_NAME);
            
            syncLogger.debug(`Upsert fallback succeeded`, {
              table,
              id,
              resultType: typeof upsertResult
            }, MODULE_NAME);
            
            return upsertResult;
          } else {
            // Upsert returned null - this means the incoming data was older (CRDT conflict)
            syncLogger.info(`Update operation via upsert rejected due to CRDT conflict: ${table}:${id}`, {
              table,
              id,
              operation: 'update_via_upsert',
              conflict: true
            }, MODULE_NAME);
            
            return null; // Return null to indicate CRDT conflict
          }
        } catch (upsertError) {
          syncLogger.error(`Update operation upsert fallback failed: ${table}:${id}`, {
            table,
            id,
            operation: 'update_via_upsert',
            error: upsertError instanceof Error ? upsertError.message : String(upsertError)
          }, MODULE_NAME);
          
          // If upsert also fails, return null rather than throwing
          // This allows the sync process to continue with other changes
          return null;
        }
      }
      
      return result; // Return successful direct update result
    } catch (error) {
      syncLogger.error(`Error executing update operation`, {
        table,
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, MODULE_NAME);
      
      throw new DatabaseError(
        error instanceof Error ? error.message : String(error),
        { table, operation: 'update', id: data.id }
      );
    }
  }

  /**
   * Execute a delete operation using repositories
   * Modified: Delete operations are always applied regardless of timestamp conflicts
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
        syncLogger.debug(`Delete operation - entity not found: ${table}:${id}`, {
          table,
          id,
          operation: 'delete'
        }, MODULE_NAME);
        return null; // Entity doesn't exist
      }

      // ✅ FIXED: Always delete regardless of timestamp conflicts
      // Delete operations take precedence over CRDT timestamp resolution
      const deleted = await repository.delete(id);
      
      if (deleted) {
        syncLogger.debug(`Delete operation succeeded: ${table}:${id}`, {
          table,
          id,
          operation: 'delete',
          existingUpdatedAt: existing.updated_at,
          deleteTimestamp: timestamp
        }, MODULE_NAME);
        return existing; // Return the deleted entity
      } else {
        syncLogger.warn(`Delete operation failed (repository.delete returned false): ${table}:${id}`, {
          table,
          id,
          operation: 'delete'
        }, MODULE_NAME);
        return null;
      }
    } catch (error) {
      syncLogger.error(`Delete operation error: ${table}:${id}`, {
        table,
        id,
        operation: 'delete',
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      throw new DatabaseError(
        error instanceof Error ? error.message : String(error),
        { table, operation: 'delete', id }
      );
    }
  }

  /**
   * Check if a table is a junction table (many-to-many relationship table)
   * Now uses auto-generated configuration instead of hardcoded list
   */
  private isJunctionTable(table: string): boolean {
    return SERVER_JUNCTION_TABLES.includes(table as any);
  }

  /**
   * Execute an insert operation on a junction table using auto-generated configurations
   * This replaces the hardcoded switch statement with configuration-driven processing
   */
  private async executeJunctionInsert(table: string, data: RecordData): Promise<any> {
    // Get junction table configuration
    const junctionConfig = SERVER_JUNCTION_TABLE_MAPPING[table as keyof typeof SERVER_JUNCTION_TABLE_MAPPING];
    if (!junctionConfig) {
      throw new ValidationError(`No junction table configuration found for: ${table}`);
    }

    const { sourceColumn, targetColumn, sourceEntity, targetEntity, relationName } = junctionConfig;
    
    // Extract IDs from data using the configured column names
    const sourceId = (data as any)[sourceColumn];
    const targetId = (data as any)[targetColumn];
    
    if (!sourceId || !targetId) {
      throw new ValidationError(`Missing ${sourceColumn} or ${targetColumn} in ${table} insert`);
    }
    
    try {
      // Get the source repository to perform the relationship operation
      const sourceRepo = this.getRepositoryForEntity(sourceEntity.toLowerCase() + 's');
      if (!sourceRepo) {
        throw new ValidationError(`No repository found for source entity: ${sourceEntity}`);
      }

      // Use the universal relationship adder
      await this.addUniversalRelationship(sourceRepo, sourceId, relationName, targetId);
      
      // Return synthetic record for consistency
      return {
        id: `${sourceId}_${targetId}`,
        [sourceColumn]: sourceId,
        [targetColumn]: targetId
      };
    } catch (error) {
      // Check if this is a conflict (relationship already exists)
      if (error instanceof Error && error.message.includes('already exists')) {
        return null; // Conflict - relationship already exists
      }
      
      throw new DatabaseError(
        error instanceof Error ? error.message : String(error),
        { table, operation: 'insert', [sourceColumn]: sourceId, [targetColumn]: targetId }
      );
    }
  }

  /**
   * Execute a delete operation on a junction table using auto-generated configurations
   * This replaces the hardcoded switch statement with configuration-driven processing
   */
  private async executeJunctionDelete(table: string, syntheticId: string): Promise<any> {
    // Get junction table configuration
    const junctionConfig = SERVER_JUNCTION_TABLE_MAPPING[table as keyof typeof SERVER_JUNCTION_TABLE_MAPPING];
    if (!junctionConfig) {
      throw new ValidationError(`No junction table configuration found for: ${table}`);
    }

    const { sourceColumn, targetColumn, sourceEntity, relationName } = junctionConfig;
    
    // Parse synthetic ID: "sourceId_targetId"
    const parts = syntheticId.split('_');
    if (parts.length !== 2) {
      throw new ValidationError(`Invalid synthetic ID format for ${table}: ${syntheticId}`);
    }
    
    const [sourceId, targetId] = parts;
    
    try {
      // Get the source repository to perform the relationship operation
      const sourceRepo = this.getRepositoryForEntity(sourceEntity.toLowerCase() + 's');
      if (!sourceRepo) {
        throw new ValidationError(`No repository found for source entity: ${sourceEntity}`);
      }

      // Use the universal relationship remover
      await this.removeUniversalRelationship(sourceRepo, sourceId, relationName, targetId);
      
      // Return synthetic record for consistency
      return {
        id: syntheticId,
        [sourceColumn]: sourceId,
        [targetColumn]: targetId
      };
    } catch (error) {
      throw new DatabaseError(
        error instanceof Error ? error.message : String(error),
        { table, operation: 'delete', synthetic_id: syntheticId }
      );
    }
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
        
        // Data is already in camelCase from client - just ensure date fields are Date objects
        const transformedData = this.ensureDateObjects(entityData);
        
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
        
        // Check if there are actual entity fields to update (beyond id, clientId, updatedAt)
        const entityFields = Object.keys(data).filter(key => 
          key !== 'id' && key !== 'clientId' && key !== 'updatedAt'
        );
        
        let entityResult = null;
        
        if (entityFields.length > 0) {
          // There are actual entity fields to update
          entityResult = await this.executeUpdate(table, data);
          if (entityResult) {
            results.push(entityResult);
          }
        } else {
          // Pure relationship update - skip entity update, just fetch current record
          entityResult = await this.fetchCurrentRecord(table, data.id);
          syncLogger.debug(`Skipping entity update for pure relationship change: ${table}:${data.id}`);
        }
        
        // Handle relationship updates with validation optimization
        if (change.relationshipUpdates && change.relationshipUpdates.length > 0) {
          await this.processEntityRelationshipUpdates(table, data.id, change.relationshipUpdates, true); // skipValidation = true
          
          // If we didn't update entity fields, add the relationship result
          if (entityFields.length === 0 && entityResult) {
            results.push(entityResult);
          }
        }
        
        syncLogger.debug(`Processed relationship change for ${table}:${data.id}`, {
          table,
          entityId: data.id,
          relationshipCount: change.relationshipUpdates?.length || 0,
          hadEntityFields: entityFields.length > 0,
          entityFields
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
   * Now uses auto-generated configurations instead of hardcoded switch statements
   */
  private async processEntityRelationshipUpdates(
    table: string, 
    entityId: string, 
    relationshipUpdates: Array<{
      relationName: string;
      operation: 'set' | 'add' | 'remove';
      targetIds: string[];
    }>,
    skipValidation = false
  ): Promise<void> {
    // Check if entity has relationship configuration
    if (!hasRelationshipConfig(table)) {
      syncLogger.warn(`No relationship configuration found for entity table: ${table}`, {
        table,
        entityId,
        availableEntities: Object.keys(SERVER_RELATIONSHIP_CONFIGS)
      }, MODULE_NAME);
      return;
    }

    const junctionRelationships = getJunctionRelationships(table);
    const validRelationNames = new Set(junctionRelationships.map(rel => rel.relationName));

    for (const relUpdate of relationshipUpdates) {
      // Validate relationship exists for this entity
      if (!validRelationNames.has(relUpdate.relationName)) {
        syncLogger.warn(`Unknown relationship '${relUpdate.relationName}' for entity '${table}'`, {
          table,
          entityId,
          relationName: relUpdate.relationName,
          availableRelations: Array.from(validRelationNames)
        }, MODULE_NAME);
        continue;
      }

      // Find the relationship configuration
      const relationshipConfig = junctionRelationships.find(rel => rel.relationName === relUpdate.relationName);
      if (!relationshipConfig) {
        syncLogger.error(`Could not find relationship config for '${relUpdate.relationName}' on entity '${table}'`, {
          table,
          entityId,
          relationName: relUpdate.relationName
        }, MODULE_NAME);
        continue;
      }

      try {
        await this.processUniversalRelationshipUpdate(table, entityId, relUpdate, relationshipConfig, skipValidation);
        
        syncLogger.debug(`Successfully processed relationship update using auto-generated config`, {
          table,
          entityId,
          relationName: relUpdate.relationName,
          operation: relUpdate.operation,
          targetCount: relUpdate.targetIds.length,
          junctionTable: relationshipConfig.junctionTable,
          skipValidation
        }, MODULE_NAME);
        
      } catch (error) {
        syncLogger.error(`Failed to process relationship update using auto-generated config`, {
          table,
          entityId,
          relationName: relUpdate.relationName,
          operation: relUpdate.operation,
          targetCount: relUpdate.targetIds.length,
          junctionTable: relationshipConfig.junctionTable,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
        throw error;
      }
    }
  }

  /**
   * Universal relationship update processor using auto-generated configurations
   * This replaces the entity-specific methods (processProjectRelationshipUpdate, processTaskRelationshipUpdate)
   */
  private async processUniversalRelationshipUpdate(
    table: string,
    entityId: string,
    relUpdate: {
      relationName: string;
      operation: 'set' | 'add' | 'remove';
      targetIds: string[];
    },
    relationshipConfig: {
      junctionTable: string;
      relationName: string;
      sourceColumn: string;
      targetColumn: string;
      targetEntity: string;
    },
    skipValidation = false
  ): Promise<void> {
    const { junctionTable, sourceColumn, targetColumn, targetEntity, relationName } = relationshipConfig;
    
    syncLogger.debug(`Processing universal relationship update`, {
      table,
      entityId,
      relationName,
      operation: relUpdate.operation,
      targetCount: relUpdate.targetIds.length,
      junctionTable,
      sourceColumn,
      targetColumn,
      targetEntity,
      skipValidation
    }, MODULE_NAME);

    // Get the appropriate repository based on the target entity
    const targetRepo = this.getRepositoryForEntity(targetEntity);
    const sourceRepo = this.getRepositoryForEntity(table);

    if (!targetRepo || !sourceRepo) {
      throw new Error(`Repository not found for relationship processing: source=${table}, target=${targetEntity}`);
    }

    try {
      switch (relUpdate.operation) {
        case 'set':
          // Replace entire relationship list
          await this.setUniversalRelationship(sourceRepo, entityId, relationName, relUpdate.targetIds, skipValidation);
          break;
          
        case 'add':
          // Add specific relationships
          for (const targetId of relUpdate.targetIds) {
            await this.addUniversalRelationship(sourceRepo, entityId, relationName, targetId);
          }
          break;
          
        case 'remove':
          // Remove specific relationships
          for (const targetId of relUpdate.targetIds) {
            await this.removeUniversalRelationship(sourceRepo, entityId, relationName, targetId);
          }
          break;
      }
      
      syncLogger.debug(`Universal relationship update completed successfully`, {
        table,
        entityId,
        relationName,
        operation: relUpdate.operation,
        targetCount: relUpdate.targetIds.length
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error(`Universal relationship update failed`, {
        table,
        entityId,
        relationName,
        operation: relUpdate.operation,
        targetCount: relUpdate.targetIds.length,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Get repository for an entity table name
   */
  private getRepositoryForEntity(entityTableOrName: string): any {
    // Handle both plural table names and entity names
    const entityMap: Record<string, string> = {
      'users': 'users',
      'projects': 'projects', 
      'tasks': 'tasks',
      'comments': 'comments',
      // Add more mappings as needed
    };

    const repoKey = entityMap[entityTableOrName] || entityTableOrName;
    return this.repositories.getRepository(repoKey);
  }

  /**
   * Universal relationship setter using repository methods
   */
  private async setUniversalRelationship(
    sourceRepo: any,
    entityId: string,
    relationName: string,
    targetIds: string[],
    skipValidation = false
  ): Promise<void> {
    // Try to find a repository method for this relationship
    const setMethodName = `set${relationName.charAt(0).toUpperCase() + relationName.slice(1)}`;
    const updateMethodName = `update${relationName.charAt(0).toUpperCase() + relationName.slice(1)}`;
    
    if (typeof sourceRepo[setMethodName] === 'function') {
      await sourceRepo[setMethodName](entityId, targetIds, skipValidation);
    } else if (typeof sourceRepo[updateMethodName] === 'function') {
      await sourceRepo[updateMethodName](entityId, targetIds, skipValidation);
    } else {
      syncLogger.warn(`No set/update method found for relationship '${relationName}' on repository`, {
        entityId,
        relationName,
        skipValidation,
        availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(sourceRepo)).filter(name => 
          typeof sourceRepo[name] === 'function' && name !== 'constructor'
        )
      }, MODULE_NAME);
      
      // Fallback: log warning but don't fail
      throw new Error(`Repository method not found for setting relationship '${relationName}'`);
    }
  }

  /**
   * Universal relationship adder using repository methods
   */
  private async addUniversalRelationship(
    sourceRepo: any,
    entityId: string,
    relationName: string,
    targetId: string
  ): Promise<void> {
    // Try to find a repository method for this relationship
    const addMethodName = `add${relationName.charAt(0).toUpperCase() + relationName.slice(1).replace(/s$/, '')}`;
    
    if (typeof sourceRepo[addMethodName] === 'function') {
      await sourceRepo[addMethodName](entityId, targetId);
    } else {
      // For some relationships like 'dependencies', we need to handle differently
      if (relationName === 'dependencies' && typeof sourceRepo.addDependency === 'function') {
        await sourceRepo.addDependency(entityId, targetId);
      } else if (relationName === 'members' && typeof sourceRepo.addMember === 'function') {
        await sourceRepo.addMember(entityId, targetId);
      } else {
        syncLogger.warn(`No add method found for relationship '${relationName}' on repository`, {
          entityId,
          targetId,
          relationName,
          availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(sourceRepo)).filter(name => 
            typeof sourceRepo[name] === 'function' && name !== 'constructor'
          )
        }, MODULE_NAME);
        
        throw new Error(`Repository method not found for adding relationship '${relationName}'`);
      }
    }
  }

  /**
   * Universal relationship remover using repository methods
   */
  private async removeUniversalRelationship(
    sourceRepo: any,
    entityId: string,
    relationName: string,
    targetId: string
  ): Promise<void> {
    // Try to find a repository method for this relationship
    const removeMethodName = `remove${relationName.charAt(0).toUpperCase() + relationName.slice(1).replace(/s$/, '')}`;
    
    if (typeof sourceRepo[removeMethodName] === 'function') {
      await sourceRepo[removeMethodName](entityId, targetId);
    } else {
      // For some relationships like 'dependencies', we need to handle differently
      if (relationName === 'dependencies' && typeof sourceRepo.removeDependency === 'function') {
        await sourceRepo.removeDependency(entityId, targetId);
      } else if (relationName === 'members' && typeof sourceRepo.removeMember === 'function') {
        await sourceRepo.removeMember(entityId, targetId);
      } else {
        syncLogger.warn(`No remove method found for relationship '${relationName}' on repository`, {
          entityId,
          targetId,
          relationName,
          availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(sourceRepo)).filter(name => 
            typeof sourceRepo[name] === 'function' && name !== 'constructor'
          )
        }, MODULE_NAME);
        
        throw new Error(`Repository method not found for removing relationship '${relationName}'`);
      }
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