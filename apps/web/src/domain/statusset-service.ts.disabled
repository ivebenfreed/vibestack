/**
 * StatusSet Domain Service
 * 
 * Manages status sets with entity type filtering for domain-specific statuses.
 * StatusSets define which statuses are available for different entity types.
 */

import { StatusSet } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { statusSetDexieService } from '@repo/dataforge/dexie-domain';
import type { CreateStatusSetInput, UpdateStatusSetInput } from '@repo/dataforge/statusset-operations';
import { nanoid } from 'nanoid';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// Re-export types from DataForge
export type { CreateStatusSetInput, UpdateStatusSetInput } from '@repo/dataforge/statusset-operations';

// ============================================================================
// StatusSet Domain Service Implementation
// ============================================================================

export class StatusSetDomainService extends BaseDomainService<StatusSet, CreateStatusSetInput, UpdateStatusSetInput> {
  tableName = 'status_sets';
  entityName = 'StatusSet';
  
  protected getTable() {
    return db.statusSets;
  }
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateStatusSetInput): Promise<StatusSet> {
    const now = new Date().toISOString();
    const statusSet: StatusSet = {
      id: nanoid(),
      name: input.name,
      entityType: input.entityType,
      description: input.description || '',
      isSystem: input.isSystem ?? false,
      isActive: input.isActive ?? true,
      defaultColor: input.defaultColor || '#6b7280',
      displayOrder: input.displayOrder ?? 0,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
      clientId: nanoid(),
      statuses: [],
      projects: []
    } as StatusSet;
    
    await db.statusSets.add(statusSet);
    await trackOutgoingChange('status_sets', 'insert', statusSet);
    
    console.log('[StatusSetService] Created status set', {
      id: statusSet.id,
      name: statusSet.name,
      entityType: statusSet.entityType
    });
    
    return statusSet;
  }
  
  async updateUI(id: string, updates: UpdateStatusSetInput): Promise<StatusSet> {
    return this.performUpdate(id, updates);
  }
  
  async deleteUI(id: string): Promise<boolean> {
    // Clean up related status definitions first
    const statusDefinitions = await db.statusDefinitions
      .where('statusSetId')
      .equals(id)
      .toArray();
    
    if (statusDefinitions.length > 0) {
      throw new Error(`Cannot delete StatusSet ${id} - it has ${statusDefinitions.length} status definitions`);
    }
    
    return this.performDelete(id);
  }
  
  // ============================================================================
  // Incoming Operations (no sync tracking)
  // ============================================================================
  
  async createIncoming(statusSet: StatusSet): Promise<StatusSet> {
    await db.statusSets.put(statusSet);
    console.log('[StatusSetService] Created status set from incoming sync', {
      id: statusSet.id,
      name: statusSet.name
    });
    return statusSet;
  }
  
  async updateIncoming(id: string, updates: Partial<StatusSet>): Promise<StatusSet> {
    const existing = await db.statusSets.get(id);
    if (!existing) {
      throw new Error(`StatusSet ${id} not found`);
    }
    
    const updated: StatusSet = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    
    await db.statusSets.put(updated);
    console.log('[StatusSetService] Updated status set from incoming sync', {
      id: updated.id,
      updates
    });
    
    return updated;
  }
  
  async deleteIncoming(id: string): Promise<boolean> {
    const existing = await db.statusSets.get(id);
    if (!existing) {
      return false;
    }
    
    await db.statusSets.delete(id);
    console.log('[StatusSetService] Deleted status set from incoming sync', { id });
    
    return true;
  }
  
  // ============================================================================
  // StatusSet-Specific Methods
  // ============================================================================
  
  /**
   * Get status sets by entity type
   */
  async getByEntityType(entityType: string): Promise<StatusSet[]> {
    return db.statusSets
      .where('entityType')
      .equals(entityType)
      .and(statusSet => statusSet.isActive)
      .toArray();
  }
  
  /**
   * Get default status set for entity type
   */
  async getDefaultForEntityType(entityType: string): Promise<StatusSet | null> {
    const statusSets = await this.getByEntityType(entityType);
    
    // Find system default
    const systemDefault = statusSets.find(ss => ss.isSystem);
    if (systemDefault) return systemDefault;
    
    // Return first active one
    return statusSets[0] || null;
  }
}