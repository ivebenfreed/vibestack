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