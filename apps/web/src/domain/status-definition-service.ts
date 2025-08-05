/**
 * StatusDefinition Domain Service
 * 
 * Implements status definition CRUD operations with special set-filtered resolvers.
 * Uses the generated Dexie domain service for database operations.
 */

import { StatusDefinition, StatusSet } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { statusdefinitionDexieService, type StatusDefinitionRelationshipContext } from '@repo/dataforge/dexie-domain';
import type { CreateStatusDefinitionInput, UpdateStatusDefinitionInput } from '@repo/dataforge/statusdefinition-operations';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// Re-export types from DataForge
export type { CreateStatusDefinitionInput, UpdateStatusDefinitionInput } from '@repo/dataforge/statusdefinition-operations';
export type { StatusDefinitionRelationshipContext } from '@repo/dataforge/dexie-domain';

// ============================================================================
// StatusDefinition Domain Service Implementation
// ============================================================================

export class StatusDefinitionDomainService extends BaseDomainService<StatusDefinition, CreateStatusDefinitionInput, UpdateStatusDefinitionInput> {
  tableName = 'status_definitions';
  entityName = 'StatusDefinition';
  
  protected getTable() {
    return db.statusDefinitions;
  }
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateStatusDefinitionInput): Promise<StatusDefinition> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    // Use generated Dexie service for creation
    const statusDefinition = await statusdefinitionDexieService.create(processedInput);
    
    // Track for outgoing sync
    await trackOutgoingChange('status_definitions', 'insert', statusDefinition);
    
    console.log('[StatusDefinitionService] Created status definition', {
      id: statusDefinition.id,
      name: statusDefinition.name,
      trackingSync: true
    });
    
    // Call after hook if defined
    if (this.afterCreate) {
      await this.afterCreate(statusDefinition);
    }
    
    return statusDefinition;
  }
  
  async updateUI(id: string, updates: UpdateStatusDefinitionInput): Promise<StatusDefinition> {
    const existing = await statusdefinitionDexieService.getById(id);
    if (!existing) {
      throw new Error(`StatusDefinition ${id} not found`);
    }
    
    // Validate input
    if (this.validateUpdate) {
      this.validateUpdate(id, updates);
    }
    
    // Apply transformations
    const processedUpdates = this.beforeUpdate 
      ? this.beforeUpdate(id, updates, existing) 
      : updates;
    
    // Use generated Dexie service for update
    const updated = await statusdefinitionDexieService.update(id, processedUpdates);
    if (!updated) {
      throw new Error(`Failed to update status definition ${id}`);
    }
    
    // Track for outgoing sync
    await trackOutgoingChange('status_definitions', 'update', updated);
    
    console.log('[StatusDefinitionService] Updated status definition', {
      id: updated.id,
      updates: processedUpdates,
      trackingSync: true
    });
    
    // Call after hook if defined
    if (this.afterUpdate) {
      await this.afterUpdate(updated, existing);
    }
    
    return updated;
  }
  
  async deleteUI(id: string): Promise<boolean> {
    const existing = await statusdefinitionDexieService.getById(id);
    if (!existing) {
      return false;
    }
    
    // Use generated Dexie service for deletion
    const result = await statusdefinitionDexieService.delete(id);
    
    if (result) {
      // Track for outgoing sync
      await trackOutgoingChange('status_definitions', 'delete', { id });
      
      console.log('[StatusDefinitionService] Deleted status definition', {
        id,
        trackingSync: true
      });
    }
    
    return result;
  }
  
  // ============================================================================
  // Special Set-Filtered Resolvers
  // ============================================================================
  
  /**
   * Get available StatusSets filtered by entity type
   * This is the key method for filtering StatusSets based on context
   */
  async getAvailableStatusSets(context: StatusDefinitionRelationshipContext): Promise<StatusSet[]> {
    return statusdefinitionDexieService.getAvailableStatusSets(context);
  }
  
  /**
   * Get available StatusSets for a specific entity type
   */
  async getStatusSetsForEntityType(entityType: string): Promise<StatusSet[]> {
    return this.getAvailableStatusSets({ entityType });
  }
  
  /**
   * Get status definitions for a specific entity type
   * This uses the generated convenience method
   */
  async getStatusDefinitionsForEntityType(entityType: string): Promise<StatusDefinition[]> {
    // Use the generated method directly
    return statusdefinitionDexieService.getStatusDefinitionsForEntityType(entityType);
  }
  
  // ============================================================================
  // Incoming Operations (no sync tracking)
  // ============================================================================
  
  async createIncoming(statusDefinition: StatusDefinition): Promise<StatusDefinition> {
    await db.statusDefinitions.put(statusDefinition);
    console.log('[StatusDefinitionService] Created status definition from incoming sync', {
      id: statusDefinition.id,
      name: statusDefinition.name
    });
    return statusDefinition;
  }
  
  async updateIncoming(id: string, updates: Partial<StatusDefinition>): Promise<StatusDefinition> {
    const existing = await statusdefinitionDexieService.getById(id);
    if (!existing) {
      throw new Error(`StatusDefinition ${id} not found`);
    }
    
    const updated: StatusDefinition = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    
    await db.statusDefinitions.put(updated);
    console.log('[StatusDefinitionService] Updated status definition from incoming sync', {
      id: updated.id,
      updates
    });
    
    return updated;
  }
  
  async deleteIncoming(id: string): Promise<boolean> {
    const result = await statusdefinitionDexieService.delete(id);
    if (result) {
      console.log('[StatusDefinitionService] Deleted status definition from incoming sync', { id });
    }
    return result;
  }
  
  // ============================================================================
  // Validation Hooks
  // ============================================================================
  
  protected validateCreate(input: CreateStatusDefinitionInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Status definition name is required');
    }
    
    if (!input.statusSetId) {
      throw new Error('Status set ID is required');
    }
  }
  
  protected validateUpdate(id: string, updates: UpdateStatusDefinitionInput): void {
    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new Error('Status definition name cannot be empty');
    }
  }
  
  // ============================================================================
  // Business Logic Hooks
  // ============================================================================
  
  protected beforeCreate(input: CreateStatusDefinitionInput): CreateStatusDefinitionInput {
    return {
      ...input,
      isActive: input.isActive !== undefined ? input.isActive : true,
      isDefault: input.isDefault || false,
      sortOrder: input.sortOrder || 0,
    };
  }
  
  // ============================================================================
  // Relationship Resolvers
  // ============================================================================
  
  /**
   * Resolve the StatusSet for a status definition
   */
  async resolveStatusSet(statusSetId: string): Promise<StatusSet | undefined> {
    return statusdefinitionDexieService.resolveStatus_set_id(statusSetId);
  }
}

// Export singleton instance
export const statusDefinitionDomainService = new StatusDefinitionDomainService();