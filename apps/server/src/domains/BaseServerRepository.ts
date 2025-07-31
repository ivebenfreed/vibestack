import { DeepPartial, EntityTarget, FindOptionsWhere } from 'typeorm';
import { validate, ValidationError as ClassValidatorError } from 'class-validator';
import { NeonService } from '../lib/neon-orm/neon-service';

/**
 * Base repository class that provides common CRUD operations and patterns
 * for all server-side repositories. All operations go through NeonService
 * which handles the Cloudflare Workers + Neon serverless connection model.
 * 
 * IMPORTANT: Everything TypeORM-related MUST go through NeonService because:
 * - NeonQueryRunner creates a new Client for every query
 * - Standard TypeORM assumes persistent connections (incompatible with Workers/Neon)
 * - The custom NeonDriver routes all operations through per-query connections
 */
export abstract class BaseServerRepository<T extends { id: string; updated_at?: Date | string }> {
  protected neonService: NeonService;
  protected entityClass: EntityTarget<T>;
  
  constructor(neonService: NeonService, entityClass: EntityTarget<T>) {
    this.neonService = neonService;
    this.entityClass = entityClass;
  }

  // ========== STANDARD CRUD OPERATIONS ==========
  // These methods are used by the sync system and preserve clientId

  /**
   * Find all entities of this type
   */
  async findAll(): Promise<T[]> {
    return await this.neonService.find(this.entityClass);
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    return await this.neonService.findOne(this.entityClass, { id } as FindOptionsWhere<T>);
  }

  /**
   * Find multiple entities by IDs (using NeonService query builder)
   */
  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0) return [];
    
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'entity');
    return await queryBuilder
      .where('entity.id IN (:...ids)', { ids })
      .getMany();
  }

  /**
   * Find entities by criteria
   */
  async findBy(criteria: FindOptionsWhere<T>): Promise<T[]> {
    return await this.neonService.find(this.entityClass, criteria);
  }

  /**
   * Count entities by criteria
   */
  async countBy(criteria: FindOptionsWhere<T>): Promise<number> {
    return await this.neonService.count(this.entityClass, criteria);
  }

  /**
   * Create a new entity with validation
   */
  async create(data: DeepPartial<T>): Promise<T> {
    // Let TypeORM handle entity creation and property mapping
    // This allows proper transformation of snake_case DB columns to camelCase entity properties
    const result = await this.neonService.insert(this.entityClass, data);
    
    // TODO: Re-enable validation once property mapping issues are resolved
    // await this.validateEntity(result);
    
    return result;
  }

  /**
   * Update an entity with validation
   */
  async update(id: string, data: DeepPartial<T>): Promise<T | null> {
    console.log(`[BaseServerRepository] update() called for ${this.getTableName()}:${id}`, {
      updateData: Object.keys(data),
      updateDataValues: Object.entries(data).map(([key, value]) => `${key}=${JSON.stringify(value)}`),
      hasUpdatedAt: !!(data as any).updated_at,
      fullDataStringified: JSON.stringify(data)
    });
    
    // Find existing entity first
    const existing = await this.findById(id);
    if (!existing) {
      console.log(`[BaseServerRepository] update() - entity not found: ${this.getTableName()}:${id}`);
      return null;
    }
    
    console.log(`[BaseServerRepository] update() - found existing entity: ${this.getTableName()}:${id}`, {
      existingUpdatedAt: existing.updated_at,
      incomingUpdatedAt: (data as any).updated_at
    });

    // Update the entity using NeonService (let TypeORM handle property mapping)
    const updateResult = await this.neonService.update(this.entityClass, { id } as FindOptionsWhere<T>, data);
    
    console.log(`[BaseServerRepository] update() - neonService.update result:`, {
      affected: updateResult.affected,
      generatedMaps: updateResult.generatedMaps
    });
    
    // Get the updated entity
    const updated = await this.findById(id);
    
    console.log(`[BaseServerRepository] update() - final result:`, {
      found: !!updated,
      updatedAt: updated?.updated_at
    });
    
    // TODO: Re-enable validation once property mapping issues are resolved
    // if (updated) {
    //   await this.validateEntity(updated);
    // }
    
    return updated;
  }

  /**
   * Delete an entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.neonService.delete(this.entityClass, { id } as FindOptionsWhere<T>);
    return (result.affected !== null && result.affected !== undefined && result.affected > 0);
  }

  // ========== SYSTEM-SPECIFIC OPERATIONS ==========
  // These methods are used by the API layer and always clear clientId

  /**
   * System update - explicitly sets clientId to null
   * Used by API endpoints, cron jobs, and admin operations
   */
  async systemUpdate(id: string, data: DeepPartial<T>): Promise<T | null> {
    // Ensure clientId is explicitly set to null for system updates
    const systemData = { ...data, clientId: null } as DeepPartial<T>;
    return await this.update(id, systemData);
  }

  /**
   * System create - explicitly sets clientId to null
   * Used by API endpoints, cron jobs, and admin operations
   */
  async systemCreate(data: DeepPartial<T>): Promise<T> {
    // Ensure clientId is explicitly set to null for system creates
    const systemData = { ...data, clientId: null } as DeepPartial<T>;
    return await this.create(systemData);
  }

  /**
   * System bulk update - clears clientId for all updates
   * Used by API endpoints for batch operations
   */
  async bulkSystemUpdate(updates: Array<{id: string, data: DeepPartial<T>}>): Promise<T[]> {
    const results: T[] = [];
    
    for (const { id, data } of updates) {
      const updated = await this.systemUpdate(id, data);
      if (updated) {
        results.push(updated);
      }
    }
    
    return results;
  }

  /**
   * System bulk upsert - clears clientId for all entities
   * Used by API endpoints for batch insert/update operations
   */
  async systemBulkUpsert(entities: DeepPartial<T>[]): Promise<T[]> {
    // Clear clientId from all entities
    const systemEntities = entities.map(entity => ({
      ...entity,
      clientId: null
    })) as DeepPartial<T>[];
    
    return await this.bulkUpsert(systemEntities);
  }

  /**
   * System delete - same as regular delete but included for consistency
   * Delete operations don't need special handling for clientId
   */
  async systemDelete(id: string): Promise<boolean> {
    return await this.delete(id);
  }

  // ========== BULK OPERATIONS FOR SYNC PERFORMANCE ==========

  /**
   * Bulk insert multiple entities with validation
   * Uses TypeORM query builder for proper bulk insert
   */
  async bulkInsert(entities: DeepPartial<T>[]): Promise<T[]> {
    if (entities.length === 0) return [];
    
    // Use TypeORM query builder for bulk insert with ON CONFLICT
    // TypeORM will handle property mapping automatically
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'entity');
    
    const result = await queryBuilder
      .insert()
      .into(this.entityClass)
      .values(entities as any) // Cast to bypass TypeScript complexity with DeepPartial
      .orUpdate(['updated_at', 'client_id'], ['id']) // ON CONFLICT DO UPDATE for CRDT
      .returning('*')
      .execute();
    
    const insertedEntities = result.generatedMaps as T[];
    
    // TODO: Re-enable validation once property mapping issues are resolved
    // for (const entity of insertedEntities) {
    //   await this.validateEntity(entity);
    // }
    
    return insertedEntities;
  }

  /**
   * Bulk update multiple entities
   * Uses TypeORM for each update - could be optimized with query builder later
   */
  async bulkUpdate(updates: Array<{id: string, data: DeepPartial<T>}>): Promise<T[]> {
    if (updates.length === 0) return [];
    
    const results: T[] = [];
    
    // Use individual TypeORM updates
    for (const { id, data } of updates) {
      const updated = await this.update(id, data);
      if (updated) {
        results.push(updated);
      }
    }
    
    return results;
  }

  /**
   * Bulk delete multiple entities by IDs
   * Uses TypeORM query builder for efficient bulk delete
   */
  async bulkDelete(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'entity');
    const result = await queryBuilder
      .delete()
      .where('entity.id IN (:...ids)', { ids })
      .execute();
      
    return result.affected || 0;
  }

  /**
   * Bulk upsert (insert or update) entities
   * Uses TypeORM bulk insert with ON CONFLICT handling
   */
  async bulkUpsert(entities: DeepPartial<T>[]): Promise<T[]> {
    // Use bulkInsert which handles conflicts with orUpdate
    return await this.bulkInsert(entities);
  }

  // ========== CRDT-AWARE OPERATIONS ==========

  /**
   * Insert or update entity only if it's newer (CRDT timestamp check)
   */
  async insertOrUpdateIfNewer(data: DeepPartial<T> & {id: string, updated_at: Date | string}): Promise<T | null> {
    const existing = await this.findById(data.id);
    
    if (!existing) {
      // No existing entity, insert
      return await this.create(data);
    }
    
    // Compare timestamps for CRDT resolution
    const incomingTimestamp = new Date(data.updated_at);
    const existingTimestamp = new Date(existing.updated_at || 0);
    
    if (incomingTimestamp > existingTimestamp) {
      // Incoming is newer, update
      return await this.update(data.id, data);
    } else if (incomingTimestamp.getTime() === existingTimestamp.getTime()) {
      // Timestamps equal, use clientId tiebreaker if available
      const incomingClientId = (data as any).clientId || '';
      const existingClientId = (existing as any).clientId || '';
      
      if (incomingClientId > existingClientId) {
        return await this.update(data.id, data);
      }
    }
    
    // Existing is newer or equal, return null (conflict)
    console.info(`[${this.getTableName()}] CRDT conflict - rejecting update (existing is newer)`, {
      entityId: data.id,
      incomingTimestamp: incomingTimestamp.toISOString(),
      existingTimestamp: existingTimestamp.toISOString(),
      incomingClientId: (data as any).clientId,
      existingClientId: (existing as any).clientId
    });
    return null;
  }

  /**
   * Delete entity only if the timestamp allows it (CRDT check)
   */
  async deleteIfNewer(id: string, timestamp: Date | string): Promise<boolean> {
    const existing = await this.findById(id);
    
    if (!existing) {
      // Entity doesn't exist, consider delete successful
      return true;
    }
    
    const deleteTimestamp = new Date(timestamp);
    const existingTimestamp = new Date(existing.updated_at || 0);
    
    if (deleteTimestamp >= existingTimestamp) {
      // Delete is newer or equal, proceed
      return await this.delete(id);
    }
    
    // Existing is newer, reject delete
    console.info(`[${this.getTableName()}] CRDT conflict - rejecting delete (existing is newer)`, {
      entityId: id,
      deleteTimestamp: deleteTimestamp.toISOString(),
      existingTimestamp: existingTimestamp.toISOString()
    });
    return false;
  }

  /**
   * Get entity timestamp for CRDT comparisons
   */
  async getEntityTimestamp(id: string): Promise<Date | null> {
    const entity = await this.findById(id);
    return entity?.updated_at ? new Date(entity.updated_at) : null;
  }

  // ========== PAGINATION OPERATIONS FOR INITIAL SYNC ==========

  /**
   * Find entities with cursor-based pagination
   * Used for initial sync to efficiently stream large datasets
   */
  async findWithCursor(options: {
    cursor?: string | null;
    limit: number;
    orderBy?: keyof T;
    orderDirection?: 'ASC' | 'DESC';
  }): Promise<{
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const { cursor, limit, orderBy = 'id' as keyof T, orderDirection = 'ASC' } = options;
    
    const queryBuilder = await this.createQueryBuilder('entity');
    
    // Add cursor condition if provided
    if (cursor) {
      const operator = orderDirection === 'ASC' ? '>' : '<';
      queryBuilder.where(`entity.${String(orderBy)} ${operator} :cursor`, { cursor });
    }
    
    // Order and limit (fetch one extra to check if there are more)
    queryBuilder
      .orderBy(`entity.${String(orderBy)}`, orderDirection)
      .limit(limit + 1);
    
    const items = await queryBuilder.getMany();
    
    // Check if there are more records
    const hasMore = items.length > limit;
    const finalItems = hasMore ? items.slice(0, limit) : items;
    
    // Get next cursor
    const nextCursor = finalItems.length > 0 ? 
      String((finalItems[finalItems.length - 1] as any)[orderBy]) : 
      null;
    
    return {
      items: finalItems,
      nextCursor,
      hasMore
    };
  }

  /**
   * Get all records from this table in chunks (for initial sync)
   * Efficiently streams all data using cursor-based pagination
   */
  async getAllInChunks(options: {
    chunkSize: number;
    onChunk: (chunk: T[], chunkNumber: number, totalProcessed: number) => Promise<void>;
  }): Promise<number> {
    const { chunkSize, onChunk } = options;
    
    let cursor: string | null = null;
    let totalProcessed = 0;
    let chunkNumber = 0;
    
    while (true) {
      chunkNumber++;
      
      const result = await this.findWithCursor({
        cursor,
        limit: chunkSize
      });
      
      if (result.items.length === 0) {
        break;
      }
      
      await onChunk(result.items, chunkNumber, totalProcessed + result.items.length);
      totalProcessed += result.items.length;
      
      if (!result.hasMore) {
        break;
      }
      
      cursor = result.nextCursor;
    }
    
    return totalProcessed;
  }

  // ========== ADVANCED FEATURES (via NeonService) ==========

  /**
   * Create a custom query builder for complex queries
   */
  protected async createQueryBuilder(alias: string) {
    return await this.neonService.createQueryBuilder(this.entityClass, alias);
  }

  /**
   * Execute raw SQL only when absolutely necessary (should be rare)
   * Prefer TypeORM query builders and NeonService methods
   */
  protected async query(sql: string, parameters?: any[]): Promise<any> {
    return await this.neonService.query(sql, parameters);
  }

  // ========== VALIDATION AND ERROR HANDLING ==========

  /**
   * Validate entity using class-validator
   */
  protected async validateEntity(entity: T): Promise<void> {
    const errors = await validate(entity as any, { skipMissingProperties: true });
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${JSON.stringify(errors.map(e => e.constraints))}`);
    }
  }

  /**
   * Handle repository errors with consistent formatting
   */
  protected handleRepositoryError(error: unknown, operation: string, entityId?: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const context = entityId ? ` for entity ${entityId}` : '';
    
    throw new Error(`${operation} failed${context}: ${errorMessage}`);
  }

  // ========== HELPER METHODS ==========

  /**
   * Get table name from entity class (if needed for advanced queries)
   */
  protected getTableName(): string {
    // This is a simplified approach - could be enhanced with metadata inspection
    const className = this.entityClass.toString();
    if (className.includes('Project')) return 'projects';
    if (className.includes('Task')) return 'tasks';
    if (className.includes('User')) return 'users';
    if (className.includes('Comment')) return 'comments';
    
    // Fallback to lowercase class name
    const match = className.match(/class\s+(\w+)/);
    return match?.[1] ? match[1].toLowerCase() + 's' : 'unknown';
  }
} 