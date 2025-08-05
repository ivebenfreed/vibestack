/**
 * Base Domain Service for Dexie-based entities
 * 
 * Provides common CRUD operations with sync tracking for all entity types.
 * Subclasses must implement entity-specific logic while inheriting common patterns.
 */

import { trackOutgoingChange } from '@/db/dexie-change-tracking';

/**
 * Base class for all domain services
 * @template TEntity - The entity type from @repo/dataforge/client-entities
 * @template TCreateInput - Input type for creating entities
 * @template TUpdateInput - Input type for updating entities
 */
export abstract class BaseDomainService<
  TEntity extends { id: string; createdAt: string; updatedAt: string },
  TCreateInput,
  TUpdateInput
> {
  /**
   * The Dexie table name (e.g., 'tasks', 'projects')
   */
  abstract tableName: string;
  
  /**
   * The entity display name for error messages (e.g., 'Task', 'Project')
   */
  abstract entityName: string;
  
  /**
   * Get the Dexie table instance
   * Must be implemented by each service to return the appropriate db.tableName
   */
  protected abstract getTable(): any;
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  /**
   * Create entity from UI - includes sync tracking
   */
  abstract createUI(input: TCreateInput): Promise<TEntity>;
  
  /**
   * Update entity from UI - includes sync tracking
   */
  abstract updateUI(id: string, updates: TUpdateInput): Promise<TEntity>;
  
  /**
   * Delete entity from UI - includes sync tracking
   */
  abstract deleteUI(id: string): Promise<boolean>;
  
  // ============================================================================
  // Batch Operations (with sync tracking)
  // ============================================================================
  
  /**
   * Update multiple entities in a single transaction
   * Each update can have different fields
   */
  async batchUpdateUI(updates: Array<{ id: string; updates: TUpdateInput }>): Promise<TEntity[]> {
    const table = this.getTable();
    const results: TEntity[] = [];
    const timestamp = new Date().toISOString();
    
    // Validate all updates first
    const existingEntities = await table.bulkGet(updates.map(u => u.id));
    const validUpdates: Array<{ entity: TEntity; updates: TUpdateInput }> = [];
    
    for (let i = 0; i < updates.length; i++) {
      const existing = existingEntities[i];
      if (!existing) {
        console.warn(`[${this.entityName}Service] Skipping update for non-existent ${this.entityName} ${updates[i].id}`);
        continue;
      }
      validUpdates.push({ entity: existing, updates: updates[i].updates });
    }
    
    if (validUpdates.length === 0) {
      return [];
    }
    
    // Perform updates in a single transaction
    await table.db.transaction('rw', table, async () => {
      for (const { entity, updates: updateData } of validUpdates) {
        const updated: TEntity = {
          ...entity,
          ...updateData,
          updatedAt: timestamp
        } as TEntity;
        
        await table.put(updated);
        results.push(updated);
        
        // Track each change for sync
        await trackOutgoingChange(this.tableName, 'update', updated);
      }
    });
    
    console.log(`[${this.entityName}Service] Batch updated ${results.length} entities`, {
      totalRequested: updates.length,
      totalUpdated: results.length
    });
    
    return results;
  }
  
  /**
   * Delete multiple entities in a single transaction
   */
  async batchDeleteUI(ids: string[]): Promise<{ deleted: string[]; notFound: string[] }> {
    const table = this.getTable();
    const deleted: string[] = [];
    const notFound: string[] = [];
    
    // Get all entities first to check which exist
    const existingEntities = await table.bulkGet(ids);
    const toDelete: TEntity[] = [];
    
    for (let i = 0; i < ids.length; i++) {
      if (existingEntities[i]) {
        toDelete.push(existingEntities[i]);
      } else {
        notFound.push(ids[i]);
      }
    }
    
    if (toDelete.length > 0) {
      // Perform deletes in a single transaction
      await table.db.transaction('rw', table, async () => {
        for (const entity of toDelete) {
          await table.delete(entity.id);
          deleted.push(entity.id);
          
          // Track each deletion for sync
          await trackOutgoingChange(this.tableName, 'delete', entity);
        }
      });
    }
    
    console.log(`[${this.entityName}Service] Batch deleted`, {
      totalRequested: ids.length,
      deleted: deleted.length,
      notFound: notFound.length
    });
    
    return { deleted, notFound };
  }
  
  /**
   * Create multiple entities in a single transaction
   */
  async batchCreateUI(inputs: TCreateInput[]): Promise<TEntity[]> {
    if (inputs.length === 0) {
      return [];
    }
    
    const table = this.getTable();
    const results: TEntity[] = [];
    const timestamp = new Date().toISOString();
    
    // Perform creates in a single transaction
    await table.db.transaction('rw', table, async () => {
      for (const input of inputs) {
        // Let subclass handle entity creation logic
        const entity = await this.createUI(input);
        results.push(entity);
      }
    });
    
    console.log(`[${this.entityName}Service] Batch created ${results.length} entities`);
    
    return results;
  }
  
  // ============================================================================
  // Incoming Operations (no sync tracking)
  // ============================================================================
  
  /**
   * Create entity from incoming sync - no tracking
   */
  abstract createIncoming(entity: TEntity): Promise<TEntity>;
  
  /**
   * Update entity from incoming sync - no tracking
   */
  abstract updateIncoming(id: string, updates: Partial<TEntity>): Promise<TEntity>;
  
  /**
   * Delete entity from incoming sync - no tracking
   */
  abstract deleteIncoming(id: string): Promise<boolean>;
  
  // ============================================================================
  // Batch Incoming Operations (no sync tracking)
  // ============================================================================
  
  /**
   * Update multiple entities from incoming sync - no tracking
   * More efficient than individual updates for bulk sync operations
   */
  async batchUpdateIncoming(updates: Array<{ id: string; updates: Partial<TEntity> }>): Promise<TEntity[]> {
    const table = this.getTable();
    const results: TEntity[] = [];
    
    // Get all existing entities in one query
    const existingEntities = await table.bulkGet(updates.map(u => u.id));
    const validUpdates: Array<{ existing: TEntity; updates: Partial<TEntity> }> = [];
    
    for (let i = 0; i < updates.length; i++) {
      const existing = existingEntities[i];
      if (!existing) {
        console.warn(`[${this.entityName}Service] Skipping incoming update for non-existent ${this.entityName} ${updates[i].id}`);
        continue;
      }
      validUpdates.push({ existing, updates: updates[i].updates });
    }
    
    if (validUpdates.length === 0) {
      return [];
    }
    
    // Perform all updates in a single transaction (no sync tracking)
    await table.db.transaction('rw', table, async () => {
      for (const { existing, updates: updateData } of validUpdates) {
        const updated: TEntity = {
          ...existing,
          ...updateData
        };
        
        await table.put(updated);
        results.push(updated);
      }
    });
    
    console.log(`[${this.entityName}Service] Batch updated ${results.length} entities from incoming sync`);
    
    return results;
  }
  
  /**
   * Create multiple entities from incoming sync - no tracking
   */
  async batchCreateIncoming(entities: TEntity[]): Promise<TEntity[]> {
    if (entities.length === 0) {
      return [];
    }
    
    const table = this.getTable();
    
    // Perform all creates in a single transaction
    await table.db.transaction('rw', table, async () => {
      await table.bulkPut(entities);
    });
    
    console.log(`[${this.entityName}Service] Batch created ${entities.length} entities from incoming sync`);
    
    return entities;
  }
  
  /**
   * Delete multiple entities from incoming sync - no tracking
   */
  async batchDeleteIncoming(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    
    const table = this.getTable();
    
    // Perform all deletes in a single transaction
    await table.db.transaction('rw', table, async () => {
      await table.bulkDelete(ids);
    });
    
    console.log(`[${this.entityName}Service] Batch deleted ${ids.length} entities from incoming sync`);
    
    return ids.length;
  }
  
  // ============================================================================
  // Protected Helper Methods
  // ============================================================================
  
  /**
   * Common update logic with sync tracking
   * Can be used by subclasses for standard update operations
   */
  protected async performUpdate(id: string, updates: Partial<TEntity>): Promise<TEntity> {
    const table = this.getTable();
    const existing = await table.get(id);
    
    if (!existing) {
      throw new Error(`${this.entityName} ${id} not found`);
    }
    
    const updated: TEntity = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Update in Dexie
    await table.put(updated);
    
    // Track for outgoing sync
    await trackOutgoingChange(this.tableName, 'update', updated);
    
    console.log(`[${this.entityName}Service] Updated ${id}`, {
      updates,
      trackingSync: true
    });
    
    return updated;
  }
  
  /**
   * Common delete logic with sync tracking
   * Can be used by subclasses for standard delete operations
   */
  protected async performDelete(id: string): Promise<boolean> {
    const table = this.getTable();
    const existing = await table.get(id);
    
    if (!existing) {
      return false;
    }
    
    // Delete from Dexie
    await table.delete(id);
    
    // Track for outgoing sync
    await trackOutgoingChange(this.tableName, 'delete', existing);
    
    console.log(`[${this.entityName}Service] Deleted ${id}`, {
      trackingSync: true
    });
    
    return true;
  }
  
  // ============================================================================
  // Optional Hooks (can be overridden by subclasses)
  // ============================================================================
  
  /**
   * Validate input before creating entity
   * @throws Error if validation fails
   */
  protected validateCreate?(input: TCreateInput): void;
  
  /**
   * Validate input before updating entity
   * @throws Error if validation fails
   */
  protected validateUpdate?(id: string, updates: TUpdateInput): void;
  
  /**
   * Transform input before creating entity
   * Useful for applying defaults or business logic
   */
  protected beforeCreate?(input: TCreateInput): TCreateInput;
  
  /**
   * Hook called after entity is created
   * Useful for side effects like creating related entities
   */
  protected afterCreate?(entity: TEntity): void | Promise<void>;
  
  /**
   * Transform updates before applying
   * Useful for business logic like setting completedAt when status changes
   */
  protected beforeUpdate?(id: string, updates: TUpdateInput, existing: TEntity): TUpdateInput;
  
  /**
   * Hook called after entity is updated
   * Useful for side effects like updating related entities
   */
  protected afterUpdate?(entity: TEntity, previousEntity: TEntity): void | Promise<void>;
}