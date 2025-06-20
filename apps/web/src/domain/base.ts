import { DeepPartial, EntityTarget, ObjectLiteral, Repository, FindOptionsWhere } from 'typeorm';
import { OutgoingChangeService } from '../sync/OutgoingChangeService';
import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { RelationshipProcessor } from './lib';

export class DatabaseServiceError extends Error {
  constructor(message: string, public operation: string, public originalError?: unknown) {
    super(message);
    this.name = 'DatabaseServiceError';
  }
}

export class EventDispatcher {
  static emit(eventType: string, detail: any): void {
    const event = new CustomEvent(eventType, { detail });
    window.dispatchEvent(event);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Event] ${eventType}`, detail);
    }
  }
}

export interface SyncDataProcessor<T> {
  /**
   * Process incoming sync data for this entity type
   * Handles entity-specific transformations, validations, and mappings
   */
  processSyncData(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): Record<string, any>;
  
  /**
   * Get entity-specific date field names for automatic date processing
   */
  getDateFields(): string[];
  
  /**
   * Handle entity-specific dependency resolution (e.g., parent-child relationships)
   */
  resolveDependencies?(data: Record<string, any>): Promise<Record<string, any>>;
  
  /**
   * Validate sync data before processing
   */
  validateSyncData?(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void;
}

export abstract class BaseRepository<T extends ObjectLiteral> {
  constructor(
    protected repository: Repository<T>,
    protected entityName: string,
    protected dataSource: NewPGliteDataSource // Add datasource reference for race condition prevention
  ) {}

  private log(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${this.entityName.toUpperCase()}_REPOSITORY] ${message}`, data);
    }
  }

  // Add safe query method for race condition prevention
  protected async safeQuery(sql: string, params?: any[]): Promise<any> {
    if (!this.dataSource.isInitialized) {
      throw new Error(`DataSource not ready for ${this.entityName} query`);
    }
    return this.dataSource.query(sql, params);
  }

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as any });
  }

  async findAll(): Promise<T[]> {
    return this.repository.find();
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(id: string, data: DeepPartial<T>): Promise<T> {
    this.log('Updating entity', { id, data });
    
    // ✅ COMPREHENSIVE LOGGING: Track all data being saved
    console.log(`[${this.entityName.toUpperCase()}_REPOSITORY] update() - FULL INPUT DATA:`, {
      entityId: id,
      inputData: data,
      inputDataStringified: JSON.stringify(data),
      inputDataKeys: Object.keys(data),
      inputDataValues: Object.values(data),
      // Specific field tracking
      hasDescription: 'description' in data,
      descriptionValue: (data as any).description,
      descriptionType: typeof (data as any).description,
      descriptionLength: (data as any).description?.length,
      // UpdatedAt tracking
      hasUpdatedAt: 'updatedAt' in data,
      updatedAtValue: (data as any).updatedAt,
      updatedAtType: typeof (data as any).updatedAt,
      updatedAtIsDate: (data as any).updatedAt instanceof Date,
      updatedAtStringified: JSON.stringify((data as any).updatedAt),
      updatedAtConstructor: (data as any).updatedAt?.constructor?.name
    });
    
    try {
      // Optimized: Single query instead of update + findById
      const existingEntity = await this.repository.findOne({ where: { id } as any });
      if (!existingEntity) {
        throw new Error(`${this.entityName} with ID ${id} not found`);
      }
      
      console.log(`[${this.entityName.toUpperCase()}_REPOSITORY] update() - existing entity:`, {
        hasUpdatedAt: 'updatedAt' in existingEntity,
        updatedAtValue: (existingEntity as any).updatedAt,
        updatedAtType: typeof (existingEntity as any).updatedAt,
        updatedAtIsDate: (existingEntity as any).updatedAt instanceof Date,
        updatedAtStringified: JSON.stringify((existingEntity as any).updatedAt),
        updatedAtConstructor: (existingEntity as any).updatedAt?.constructor?.name
      });
      
      const mergedEntity = this.repository.merge(existingEntity, data);
      
      console.log(`[${this.entityName.toUpperCase()}_REPOSITORY] update() - after merge:`, {
        hasUpdatedAt: 'updatedAt' in mergedEntity,
        updatedAtValue: (mergedEntity as any).updatedAt,
        updatedAtType: typeof (mergedEntity as any).updatedAt,
        updatedAtIsDate: (mergedEntity as any).updatedAt instanceof Date,
        updatedAtStringified: JSON.stringify((mergedEntity as any).updatedAt),
        updatedAtConstructor: (mergedEntity as any).updatedAt?.constructor?.name,
        mergedEntityKeys: Object.keys(mergedEntity),
        // Debug description field specifically
        descriptionBefore: (existingEntity as any).description,
        descriptionAfter: (mergedEntity as any).description,
        descriptionInInput: (data as any).description,
        descriptionChanged: (existingEntity as any).description !== (mergedEntity as any).description
      });
      
      // ✅ FIX: Use direct update instead of merge+save for more predictable behavior
      // This ensures all fields in `data` are actually updated in the database
      await this.repository.update({ id } as any, data as any);
      
      // Return the updated entity by refetching it (to get accurate updated data)
      const result = await this.repository.findOne({ where: { id } as any });
      if (!result) {
        throw new Error(`Failed to retrieve updated ${this.entityName} with ID ${id}`);
      }
      
      this.log('Entity updated successfully', result);
      return result;
    } catch (error) {
      this.log('Error updating entity', { id, error });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== 0;
  }

  public getOrmRepository(): Repository<T> {
    return this.repository;
  }
}

export abstract class BaseService<T extends object> implements SyncDataProcessor<T> {
  protected relationshipProcessor: RelationshipProcessor;

  constructor(
    protected repository: any,
    protected tableName: string,
    protected outgoingChangeService: OutgoingChangeService
  ) {
    // Initialize with a basic repositories object - in practice this would be injected
    this.relationshipProcessor = new RelationshipProcessor({
      [tableName]: repository
      // TODO: Inject all repositories for cross-entity validation
    });
  }

  // Optional methods from SyncDataProcessor interface
  public resolveDependencies?: (data: Record<string, any>) => Promise<Record<string, any>>;
  public validateSyncData?: (data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE') => void;

  async getAll(): Promise<T[]> {
    try {
      return await this.repository.findAll();
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to get all ${this.tableName}`,
        'getAll',
        error
      );
    }
  }

  async createFromSync(data: DeepPartial<T>): Promise<T> {
    try {
      // Process sync data through entity-specific logic first
      const processedData = this.processSyncData(data as Record<string, any>, 'INSERT');
      
      return await this.repository.create(processedData);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to create ${this.tableName} from sync`,
        'createFromSync',
        error
      );
    }
  }

  // 🔥 NEW: Bulk create method for initial sync optimization
  async bulkCreateFromSync(dataArray: DeepPartial<T>[]): Promise<T[]> {
    try {
      if (dataArray.length === 0) return [];
      
      console.log(`[${this.tableName}] Bulk creating ${dataArray.length} entities from sync`);
      const startTime = Date.now();
      
      // Process sync data through entity-specific logic for each item
      const processedDataArray = dataArray.map(data => 
        this.processSyncData(data as Record<string, any>, 'INSERT')
      );
      
      // Get the underlying TypeORM repository for bulk operations
      const ormRepository = typeof this.repository.getOrmRepository === 'function' 
        ? this.repository.getOrmRepository() 
        : this.repository;
      
      console.log(`[${this.tableName}] Got ORM repository, checking bulk methods:`, {
        hasInsert: typeof ormRepository.insert === 'function',
        hasCreateQueryBuilder: typeof ormRepository.createQueryBuilder === 'function',
        hasSave: typeof ormRepository.save === 'function',
        hasManager: !!ormRepository.manager,
        repositoryType: ormRepository.constructor.name
      });
      
      // Method 1: Use TypeORM repository.insert() for TRUE bulk operations (single transaction, single query)
      if (typeof ormRepository.insert === 'function') {
        console.log(`[${this.tableName}] Using TypeORM repository.insert() for bulk insert`);
        
        try {
          const result = await ormRepository.insert(processedDataArray);
          
          console.log(`[${this.tableName}] Insert result:`, {
            affected: result.affected,
            identifiersCount: result.identifiers?.length,
            generatedMapsCount: result.generatedMaps?.length,
            hasGeneratedMaps: !!(result.generatedMaps && result.generatedMaps.length > 0),
            firstGeneratedMap: result.generatedMaps?.[0],
            firstIdentifier: result.identifiers?.[0]
          });
          
          // Try to use generatedMaps directly if they contain the full entity data
          let createdEntities: T[] = [];
          
          if (result.generatedMaps && result.generatedMaps.length > 0) {
            console.log(`[${this.tableName}] Using generatedMaps directly (no additional queries needed)`);
            createdEntities = result.generatedMaps as T[];
          } else if (result.identifiers && result.identifiers.length > 0) {
            console.log(`[${this.tableName}] GeneratedMaps not available, fetching entities in bulk using identifiers`);
            
            // Extract IDs and fetch in bulk
            const insertedIds = result.identifiers.map((identifier: any) => identifier.id);
            
            // Use bulk fetch with IN clause instead of individual queries
            try {
              const allEntities = await ormRepository.find({
                where: { id: insertedIds as any }
              });
              createdEntities = allEntities;
              console.log(`[${this.tableName}] Bulk fetched ${allEntities.length} entities with single query`);
            } catch (bulkFetchError) {
              console.warn(`[${this.tableName}] Bulk fetch failed, falling back to individual queries:`, bulkFetchError);
              
              // Fallback to individual queries only if bulk fetch fails
              for (const id of insertedIds) {
                try {
                  const entity = await this.repository.findById(id);
                  if (entity) {
                    createdEntities.push(entity);
                  }
                } catch (findError) {
                  console.warn(`[${this.tableName}] Failed to fetch entity ${id}:`, findError);
                }
              }
            }
          } else {
            console.warn(`[${this.tableName}] No identifiers or generatedMaps in result, using original data`);
            // Last resort: use the processed data as entities (may not have generated fields)
            createdEntities = processedDataArray as T[];
          }
          
          const processingTime = Date.now() - startTime;
          const throughput = dataArray.length / (processingTime / 1000);
          
          console.log(`[${this.tableName}] Successfully bulk inserted ${createdEntities.length} entities using repository.insert() in ${processingTime}ms (${throughput.toFixed(0)} entities/sec)`);
          return createdEntities;
        } catch (error) {
          console.error(`[${this.tableName}] repository.insert() failed:`, error);
          // Fall through to next method
        }
      }
      
      // Method 2: Use TypeORM insert query builder as secondary option
      if (typeof ormRepository.createQueryBuilder === 'function') {
        console.log(`[${this.tableName}] Using TypeORM query builder for bulk insert`);
        
        try {
          const queryBuilder = ormRepository.createQueryBuilder()
            .insert()
            .values(processedDataArray);
          
          // Add conflict resolution for sync operations (upsert behavior)
          if (processedDataArray.length > 0 && processedDataArray[0].id) {
            queryBuilder.orUpdate(['updatedAt'], ['id']);
          }
          
          const result = await queryBuilder.execute();
          
          console.log(`[${this.tableName}] Query builder result:`, {
            affected: result.affected,
            identifiersCount: result.identifiers?.length,
            hasGeneratedMaps: !!(result.generatedMaps && result.generatedMaps.length > 0),
            firstIdentifier: result.identifiers?.[0]
          });
          
          // For bulk inserts, we need to fetch the created entities
          let createdEntities: T[] = [];
          
          if (result.generatedMaps && result.generatedMaps.length > 0) {
            console.log(`[${this.tableName}] Using generatedMaps directly from query builder`);
            createdEntities = result.generatedMaps as T[];
          } else if (result.identifiers && result.identifiers.length > 0) {
            const insertedIds = result.identifiers.map((identifier: any) => identifier.id);
            
            // Use bulk fetch instead of individual queries
            try {
              const allEntities = await ormRepository.find({
                where: { id: insertedIds as any }
              });
              createdEntities = allEntities;
              console.log(`[${this.tableName}] Bulk fetched ${allEntities.length} entities with single query`);
            } catch (bulkFetchError) {
              console.warn(`[${this.tableName}] Bulk fetch failed, falling back to individual queries:`, bulkFetchError);
              
              // Fallback to individual queries
              for (const id of insertedIds) {
                try {
                  const entity = await this.repository.findById(id);
                  if (entity) {
                    createdEntities.push(entity);
                  }
                } catch (findError) {
                  console.warn(`[${this.tableName}] Failed to fetch entity ${id}:`, findError);
                }
              }
            }
          }
          
          const processingTime = Date.now() - startTime;
          const throughput = dataArray.length / (processingTime / 1000);
          
          console.log(`[${this.tableName}] Successfully bulk inserted ${createdEntities.length} entities using query builder in ${processingTime}ms (${throughput.toFixed(0)} entities/sec)`);
          return createdEntities;
        } catch (error) {
          console.error(`[${this.tableName}] Query builder bulk insert failed:`, error);
          // Fall through to next method
        }
      }
      
      // TypeORM repository.save() - WARNING: This does NOT do bulk operations, it processes each entity individually!
      if (typeof this.repository.save === 'function') {
        console.warn(`[${this.tableName}] Using repository.save() - this processes entities individually, not in bulk`);
        const result = await this.repository.save(processedDataArray);
        const processingTime = Date.now() - startTime;
        const throughput = dataArray.length / (processingTime / 1000);
        
        console.log(`[${this.tableName}] Individually saved ${Array.isArray(result) ? result.length : 1} entities in ${processingTime}ms (${throughput.toFixed(0)} entities/sec)`);
        return Array.isArray(result) ? result : [result];
      }
      
      // Final fallback to individual creates
      console.warn(`[${this.tableName}] Repository doesn't support bulk operations, falling back to individual creates`);
      const results: T[] = [];
      for (const processedData of processedDataArray) {
        const entity = await this.repository.create(processedData);
        results.push(entity);
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`[${this.tableName}] Fallback: individually created ${results.length} entities in ${processingTime}ms`);
      return results;
    } catch (error) {
      console.error(`[${this.tableName}] Bulk create from sync failed:`, error);
      throw new DatabaseServiceError(
        `Failed to bulk create ${this.tableName} from sync`,
        'bulkCreateFromSync',
        error
      );
    }
  }

  async updateFromSync(id: string, data: DeepPartial<T>): Promise<T> {
    try {
      // Process sync data through entity-specific logic first
      let processedData = this.processSyncData(data as Record<string, any>, 'UPDATE');
      
      // Additional safety check for required fields that might have become null
      processedData = this.validateRequiredFields(processedData, 'UPDATE');
      
      return await this.repository.update(id, processedData);
    } catch (error) {
      // Enhanced error logging for sync failures
      console.error(`[${this.tableName}] updateFromSync failed for ID ${id}:`, {
        error: error instanceof Error ? error.message : String(error),
        originalData: data,
        processedDataKeys: Object.keys(this.processSyncData(data as Record<string, any>, 'UPDATE')),
        timestamp: new Date().toISOString()
      });
      
      throw new DatabaseServiceError(
        `Failed to update ${this.tableName} from sync`,
        'updateFromSync',
        error
      );
    }
  }

  async deleteFromSync(id: string): Promise<boolean> {
    try {
      // Process sync data through entity-specific logic first (minimal processing for delete)
      const processedData = this.processSyncData({ id } as Record<string, any>, 'DELETE');
      
      return await this.repository.delete(processedData.id);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to delete ${this.tableName} from sync`,
        'deleteFromSync',
        error
      );
    }
  }

  public getRepo(): any {
    return this.repository;
  }

  /**
   * Base implementation of sync data processing
   * Subclasses can override for entity-specific logic
   */
  processSyncData(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): Record<string, any> {
    let processedData = { ...data };
    
    // Process date fields
    if (operation === 'INSERT' || operation === 'UPDATE') {
      processedData = this.ensureDateObjects(processedData);
    }
    
    return processedData;
  }

  /**
   * Base implementation of date field processing
   * Subclasses should override getDateFields() to specify entity-specific date fields
   */
  protected ensureDateObjects(obj: Record<string, any>): Record<string, any> {
    const result = { ...obj };
    const dateFields = this.getDateFields();

    for (const key of dateFields) {
      if (result[key] && typeof result[key] === 'string') {
        try {
          const dateValue = new Date(result[key]);
          if (!isNaN(dateValue.getTime())) {
            result[key] = dateValue;
          } else {
            console.warn(`[${this.constructor.name}] Invalid date string for ${key}: '${result[key]}'`);
          }
        } catch (e) {
          console.warn(`[${this.constructor.name}] Failed to parse date for ${key}: '${result[key]}'`);
        }
      }
    }
    
    return result;
  }

  /**
   * Default date fields - subclasses should override for entity-specific fields
   */
  getDateFields(): string[] {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * Validate required fields and ensure they don't become null during sync processing
   */
  protected validateRequiredFields(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): Record<string, any> {
    const result = { ...data };
    
    if (operation === 'UPDATE') {
      // Add detailed logging for updatedAt field processing
      console.log(`[${this.constructor.name}] validateRequiredFields - before processing:`, {
        hasUpdatedAt: 'updatedAt' in result,
        updatedAtValue: result.updatedAt,
        updatedAtType: typeof result.updatedAt,
        updatedAtIsNull: result.updatedAt === null,
        updatedAtIsUndefined: result.updatedAt === undefined,
        updatedAtStringified: JSON.stringify(result.updatedAt),
        updatedAtConstructor: result.updatedAt?.constructor?.name,
        allKeys: Object.keys(result)
      });
      
      // Ensure updatedAt is set if it's missing or null
      if (!result.updatedAt || result.updatedAt === null) {
        console.warn(`[${this.constructor.name}] updatedAt was null or missing, setting to current date`);
        result.updatedAt = new Date();
      }
      
      // Validate that updatedAt is a valid Date object
      if (result.updatedAt && !(result.updatedAt instanceof Date) && typeof result.updatedAt === 'string') {
        try {
          const dateValue = new Date(result.updatedAt);
          if (isNaN(dateValue.getTime())) {
            console.warn(`[${this.constructor.name}] Invalid updatedAt date string, setting to current date`);
            result.updatedAt = new Date();
          } else {
            result.updatedAt = dateValue;
          }
        } catch (e) {
          console.warn(`[${this.constructor.name}] Failed to parse updatedAt, setting to current date`);
          result.updatedAt = new Date();
        }
      }
      
      // Check for object type that's not a Date (this might be the issue)
      if (result.updatedAt && typeof result.updatedAt === 'object' && !(result.updatedAt instanceof Date)) {
        console.error(`[${this.constructor.name}] updatedAt is an object but not a Date! Converting to current date:`, {
          value: result.updatedAt,
          type: typeof result.updatedAt,
          constructor: result.updatedAt?.constructor?.name,
          stringified: JSON.stringify(result.updatedAt),
          isArray: Array.isArray(result.updatedAt),
          keys: Object.keys(result.updatedAt || {})
        });
        result.updatedAt = new Date();
      }
      
      // Add detailed logging for updatedAt field after processing
      console.log(`[${this.constructor.name}] validateRequiredFields - after processing:`, {
        updatedAtValue: result.updatedAt,
        updatedAtType: typeof result.updatedAt,
        updatedAtIsDate: result.updatedAt instanceof Date,
        updatedAtStringified: JSON.stringify(result.updatedAt),
        updatedAtConstructor: result.updatedAt?.constructor?.name
      });
    }
    
    if (operation === 'INSERT') {
      // Ensure both createdAt and updatedAt are set for new entities
      const now = new Date();
      if (!result.createdAt || result.createdAt === null) {
        result.createdAt = now;
      }
      if (!result.updatedAt || result.updatedAt === null) {
        result.updatedAt = now;
      }
    }
    
    return result;
  }

  /**
   * Enhanced processing for regular operations (with sync tracking and relationship processing)
   * Note: These methods are for user-initiated operations, NOT for incoming sync data
   */
  async createWithProcessing(data: Record<string, any>): Promise<T> {
    console.log(`[${this.tableName}] Creating entity with enhanced processing and sync tracking`);
    
    // Check if outgoingChangeService is available
    if (!this.outgoingChangeService) {
      console.error(`[${this.tableName}] outgoingChangeService is null - cannot track changes for sync. This indicates the service was not properly initialized.`);
      throw new Error(`OutgoingChangeService not available for ${this.tableName}. Service may not be properly initialized.`);
    }
    
    // Process data through the entity's sync data processor
    let processedData = this.processSyncData(data, 'INSERT');
    
    // Apply relationship processing using configuration
    processedData = await this.relationshipProcessor.processRelationships(
      this.tableName, 
      processedData, 
      'INSERT'
    );
    
    // Create the entity
    const entity = await this.repository.create(processedData);
    
    // Record outgoing change for sync (this is for user operations, not incoming sync)
    await this.outgoingChangeService.trackEntityChange(this.tableName, 'insert', entity);
    
    return entity;
  }

  async updateWithProcessing(id: string, data: Record<string, any>): Promise<T> {
    console.log(`[${this.tableName}] Updating entity ${id} with enhanced processing and sync tracking`);
    
    // Check if outgoingChangeService is available
    if (!this.outgoingChangeService) {
      console.error(`[${this.tableName}] outgoingChangeService is null - cannot track changes for sync. This indicates the service was not properly initialized.`);
      throw new Error(`OutgoingChangeService not available for ${this.tableName}. Service may not be properly initialized.`);
    }
    
    // Process data through the entity's sync data processor
    let processedData = this.processSyncData(data, 'UPDATE');
    
    // Apply relationship processing using configuration
    processedData = await this.relationshipProcessor.processRelationships(
      this.tableName, 
      processedData, 
      'UPDATE'
    );
    
    // Update the entity
    const updatedEntity = await this.repository.update(id, processedData);
    
    // Record outgoing change for sync (this is for user operations, not incoming sync)
    console.log(`[${this.tableName}] 🔍 DEBUG: About to call trackEntityChange for UPDATE of ${id}`);
    console.log(`[${this.tableName}] 🔍 DEBUG: outgoingChangeService available:`, !!this.outgoingChangeService);
    console.log(`[${this.tableName}] 🔍 DEBUG: outgoingChangeService type:`, typeof this.outgoingChangeService);
    console.log(`[${this.tableName}] 🔍 DEBUG: calling trackEntityChange now...`);
    
    try {
      await this.outgoingChangeService.trackEntityChange(this.tableName, 'update', updatedEntity);
      console.log(`[${this.tableName}] ✅ DEBUG: trackEntityChange call completed successfully for UPDATE of ${id}`);
    } catch (trackError) {
      console.error(`[${this.tableName}] ❌ ERROR: trackEntityChange failed for UPDATE of ${id}:`, trackError);
      console.error(`[${this.tableName}] ❌ ERROR: trackError details:`, {
        name: (trackError as any)?.name,
        message: (trackError as any)?.message,
        stack: (trackError as any)?.stack
      });
      // Don't throw the error - we don't want to fail the update operation
    }
    
    return updatedEntity;
  }

  async deleteWithProcessing(id: string): Promise<boolean> {
    console.log(`[${this.tableName}] Deleting entity ${id} with enhanced processing and sync tracking`);
    
    // Check if outgoingChangeService is available
    if (!this.outgoingChangeService) {
      console.error(`[${this.tableName}] outgoingChangeService is null - cannot track changes for sync. This indicates the service was not properly initialized.`);
      throw new Error(`OutgoingChangeService not available for ${this.tableName}. Service may not be properly initialized.`);
    }
    
    // Delete the entity
    const success = await this.repository.delete(id);
    
    if (success) {
      // Record outgoing change for sync (this is for user operations, not incoming sync)
      await this.outgoingChangeService.trackEntityChange(this.tableName, 'delete', { id });
    }
    
    return success;
  }

  // Keep the old methods for backward compatibility but mark as deprecated
  /**
   * @deprecated Use createWithProcessing() instead. The name "FromSyncWithProcessing" is misleading.
   */
  async createFromSyncWithProcessing(data: Record<string, any>): Promise<T> {
    console.warn(`[${this.tableName}] DEPRECATED: createFromSyncWithProcessing() called. Use createWithProcessing() instead.`);
    return this.createWithProcessing(data);
  }

  /**
   * @deprecated Use updateWithProcessing() instead. The name "FromSyncWithProcessing" is misleading.
   */
  async updateFromSyncWithProcessing(id: string, data: Record<string, any>): Promise<T> {
    console.warn(`[${this.tableName}] DEPRECATED: updateFromSyncWithProcessing() called. Use updateWithProcessing() instead.`);
    return this.updateWithProcessing(id, data);
  }

  /**
   * @deprecated Use deleteWithProcessing() instead. The name "FromSyncWithProcessing" is misleading.
   */
  async deleteFromSyncWithProcessing(id: string): Promise<boolean> {
    console.warn(`[${this.tableName}] DEPRECATED: deleteFromSyncWithProcessing() called. Use deleteWithProcessing() instead.`);
    return this.deleteWithProcessing(id);
  }
} 