/**
 * Base Domain Service for Dexie-based entities
 * 
 * Provides common CRUD operations with sync tracking for all entity types.
 * Subclasses must implement entity-specific logic while inheriting common patterns.
 */

// trackOutgoingChange no longer needed - automatic hooks handle change tracking

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
  // Unified CRUD Operations (automatic sync tracking via hooks)
  // ============================================================================
  
  /**
   * Create entity - automatic sync tracking via hooks
   */
  abstract create(input: TCreateInput): Promise<TEntity>;
  
  /**
   * Update entity - automatic sync tracking via hooks
   */
  abstract update(id: string, updates: TUpdateInput): Promise<TEntity>;
  
  /**
   * Delete entity - automatic sync tracking via hooks
   */
  abstract delete(id: string): Promise<boolean>;
  
  // ============================================================================
  // Batch Operations (with sync tracking)
  // ============================================================================
  
  /**
   * Update multiple entities in a single transaction
   * Each update can have different fields
   */
  async batchUpdate(updates: Array<{ id: string; updates: TUpdateInput }>): Promise<TEntity[]> {
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
        
        // Note: Change tracking happens automatically via hooks
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
  async batchDelete(ids: string[]): Promise<{ deleted: string[]; notFound: string[] }> {
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
          
          // Note: Change tracking happens automatically via hooks
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
  async batchCreate(inputs: TCreateInput[]): Promise<TEntity[]> {
    if (inputs.length === 0) {
      return [];
    }
    
    const table = this.getTable();
    const results: TEntity[] = [];
    
    // Perform creates in a single transaction
    await table.db.transaction('rw', table, async () => {
      for (const input of inputs) {
        // Let subclass handle entity creation logic
        const entity = await this.create(input);
        results.push(entity);
      }
    });
    
    console.log(`[${this.entityName}Service] Batch created ${results.length} entities`);
    
    return results;
  }
  
  // ============================================================================
  // Sync Operations (executed within sync transactions to avoid tracking)
  // ============================================================================
  
  /**
   * Create entity from sync - uses sync transaction to avoid tracking
   */
  abstract createSync(entity: TEntity): Promise<TEntity>;
  
  /**
   * Update entity from sync - uses sync transaction to avoid tracking
   */
  abstract updateSync(id: string, updates: Partial<TEntity>): Promise<TEntity>;
  
  /**
   * Delete entity from sync - uses sync transaction to avoid tracking
   */
  abstract deleteSync(id: string): Promise<boolean>;
  
  // ============================================================================
  // Batch Sync Operations (executed within sync transactions to avoid tracking)
  // ============================================================================
  
  /**
   * Update multiple entities from sync - uses sync transaction to avoid tracking
   * More efficient than individual updates for bulk sync operations
   */
  async batchUpdateSync(updates: Array<{ id: string; updates: Partial<TEntity> }>): Promise<TEntity[]> {
    const { applySyncChanges } = await import('@/db/dexie-change-tracking');
    const table = this.getTable();
    const results: TEntity[] = [];
    
    await applySyncChanges(async () => {
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
        return;
      }
      
      // Perform all updates in a single transaction (sync transaction marked)
      for (const { existing, updates: updateData } of validUpdates) {
        const updated: TEntity = {
          ...existing,
          ...updateData
        };
        
        await table.put(updated);
        results.push(updated);
      }
    });
    
    console.log(`[${this.entityName}Service] Batch updated ${results.length} entities from sync`);
    
    return results;
  }
  
  /**
   * Create multiple entities from sync - uses sync transaction to avoid tracking
   */
  async batchCreateSync(entities: TEntity[]): Promise<TEntity[]> {
    if (entities.length === 0) {
      return [];
    }
    
    const { applySyncChanges } = await import('@/db/dexie-change-tracking');
    const table = this.getTable();
    
    await applySyncChanges(async () => {
      await table.bulkPut(entities);
    });
    
    console.log(`[${this.entityName}Service] Batch created ${entities.length} entities from sync`);
    
    return entities;
  }
  
  /**
   * Delete multiple entities from sync - uses sync transaction to avoid tracking
   */
  async batchDeleteSync(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    
    const { applySyncChanges } = await import('@/db/dexie-change-tracking');
    const table = this.getTable();
    
    await applySyncChanges(async () => {
      await table.bulkDelete(ids);
    });
    
    console.log(`[${this.entityName}Service] Batch deleted ${ids.length} entities from sync`);
    
    return ids.length;
  }

  // ============================================================================
  // Backward Compatibility Aliases (deprecated)
  // ============================================================================
  
  /** @deprecated Use create() instead - will be removed in next version */
  async createUI(input: TCreateInput): Promise<TEntity> {
    return this.create(input);
  }
  
  /** @deprecated Use update() instead - will be removed in next version */
  async updateUI(id: string, updates: TUpdateInput): Promise<TEntity> {
    return this.update(id, updates);
  }
  
  /** @deprecated Use delete() instead - will be removed in next version */
  async deleteUI(id: string): Promise<boolean> {
    return this.delete(id);
  }
  
  /** @deprecated Use createSync() instead - will be removed in next version */
  async createIncoming(entity: TEntity): Promise<TEntity> {
    return this.createSync(entity);
  }
  
  /** @deprecated Use updateSync() instead - will be removed in next version */
  async updateIncoming(id: string, updates: Partial<TEntity>): Promise<TEntity> {
    return this.updateSync(id, updates);
  }
  
  /** @deprecated Use deleteSync() instead - will be removed in next version */
  async deleteIncoming(id: string): Promise<boolean> {
    return this.deleteSync(id);
  }
  
  /** @deprecated Use batchUpdate() instead - will be removed in next version */
  async batchUpdateUI(updates: Array<{ id: string; updates: TUpdateInput }>): Promise<TEntity[]> {
    return this.batchUpdate(updates);
  }
  
  /** @deprecated Use batchCreate() instead - will be removed in next version */
  async batchCreateUI(inputs: TCreateInput[]): Promise<TEntity[]> {
    return this.batchCreate(inputs);
  }
  
  /** @deprecated Use batchDelete() instead - will be removed in next version */
  async batchDeleteUI(ids: string[]): Promise<{ deleted: string[]; notFound: string[] }> {
    return this.batchDelete(ids);
  }
  
  /** @deprecated Use batchUpdateSync() instead - will be removed in next version */
  async batchUpdateIncoming(updates: Array<{ id: string; updates: Partial<TEntity> }>): Promise<TEntity[]> {
    return this.batchUpdateSync(updates);
  }
  
  /** @deprecated Use batchCreateSync() instead - will be removed in next version */
  async batchCreateIncoming(entities: TEntity[]): Promise<TEntity[]> {
    return this.batchCreateSync(entities);
  }
  
  /** @deprecated Use batchDeleteSync() instead - will be removed in next version */
  async batchDeleteIncoming(ids: string[]): Promise<number> {
    return this.batchDeleteSync(ids);
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
    
    // Note: Change tracking happens automatically via hooks
    
    console.log(`[${this.entityName}Service] Updated ${id}`, {
      updates,
      trackingAutomatic: true
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
    
    // Note: Change tracking happens automatically via hooks
    
    console.log(`[${this.entityName}Service] Deleted ${id}`, {
      trackingAutomatic: true
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