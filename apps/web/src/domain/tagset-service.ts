/**
 * TagSet Domain Service
 * 
 * Implements tag set CRUD operations with project association management.
 * Uses the generated Dexie domain service for database operations.
 */

import { TagSet } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { tagSetDexieService } from '@repo/dataforge/dexie-domain';
import type { CreateTagSetInput, UpdateTagSetInput } from '@repo/dataforge/tagset-operations';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// Re-export types from DataForge
export type { CreateTagSetInput, UpdateTagSetInput } from '@repo/dataforge/tagset-operations';

// ============================================================================
// TagSet Domain Service Implementation
// ============================================================================

export class TagSetDomainService extends BaseDomainService<TagSet, CreateTagSetInput, UpdateTagSetInput> {
  tableName = 'tag_sets';
  entityName = 'TagSet';
  
  protected getTable() {
    return db.tagSets;
  }
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateTagSetInput): Promise<TagSet> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    // Use generated Dexie service for creation
    const tagSet = await tagsetDexieService.create(processedInput);
    
    // Track for outgoing sync
    await trackOutgoingChange('tag_sets', 'insert', tagSet);
    
    console.log('[TagSetService] Created tag set', {
      id: tagSet.id,
      name: tagSet.name,
      trackingSync: true
    });
    
    // Call after hook if defined
    if (this.afterCreate) {
      await this.afterCreate(tagSet);
    }
    
    return tagSet;
  }
  
  async updateUI(id: string, updates: UpdateTagSetInput): Promise<TagSet> {
    const existing = await tagsetDexieService.getById(id);
    if (!existing) {
      throw new Error(`TagSet ${id} not found`);
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
    const updated = await tagsetDexieService.update(id, processedUpdates);
    if (!updated) {
      throw new Error(`Failed to update tag set ${id}`);
    }
    
    // Track for outgoing sync
    await trackOutgoingChange('tag_sets', 'update', updated);
    
    console.log('[TagSetService] Updated tag set', {
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
    const existing = await tagsetDexieService.getById(id);
    if (!existing) {
      return false;
    }
    
    // Use generated Dexie service for deletion
    const result = await tagsetDexieService.delete(id);
    
    if (result) {
      // Track for outgoing sync
      await trackOutgoingChange('tag_sets', 'delete', { id });
      
      console.log('[TagSetService] Deleted tag set', {
        id,
        trackingSync: true
      });
    }
    
    return result;
  }
  
  // ============================================================================
  // Project Association Management
  // ============================================================================
  
  /**
   * Associate a tag set with a project
   */
  async associateWithProject(tagSetId: string, projectId: string): Promise<void> {
    const junction = {
      projectId,
      tagSetId
    };
    
    await db.projectTagSets.add(junction);
    await trackOutgoingChange('project_tag_sets', 'insert', junction);
    
    console.log('[TagSetService] Associated tag set with project', {
      tagSetId,
      projectId,
      trackingSync: true
    });
  }
  
  /**
   * Disassociate a tag set from a project
   */
  async disassociateFromProject(tagSetId: string, projectId: string): Promise<void> {
    await db.projectTagSets
      .where('[projectId+tagSetId]')
      .equals([projectId, tagSetId])
      .delete();
    
    await trackOutgoingChange('project_tag_sets', 'delete', {
      projectId,
      tagSetId
    });
    
    console.log('[TagSetService] Disassociated tag set from project', {
      tagSetId,
      projectId,
      trackingSync: true
    });
  }
  
  /**
   * Get all tag sets for a project
   * This uses the generated convenience method
   */
  async getTagSetsForProject(projectId: string): Promise<TagSet[]> {
    // Use the generated method directly
    return tagsetDexieService.getTagSetsForProject(projectId);
  }
  
  /**
   * Get all projects using a tag set
   */
  async getProjectsUsingTagSet(tagSetId: string): Promise<string[]> {
    const junctions = await db.projectTagSets
      .where('tagSetId')
      .equals(tagSetId)
      .toArray();
    
    return junctions.map(j => j.projectId);
  }
  
  /**
   * Get tag set by name
   */
  async getTagSetByName(name: string): Promise<TagSet | null> {
    // Since 'name' is not indexed, we need to use toArray and filter
    const tagSets = await db.tagSets.toArray();
    const tagSet = tagSets.find(ts => ts.name === name);
    
    return tagSet || null;
  }
  
  // ============================================================================
  // Incoming Operations (no sync tracking)
  // ============================================================================
  
  async createIncoming(tagSet: TagSet): Promise<TagSet> {
    await db.tagSets.put(tagSet);
    console.log('[TagSetService] Created tag set from incoming sync', {
      id: tagSet.id,
      name: tagSet.name
    });
    return tagSet;
  }
  
  async updateIncoming(id: string, updates: Partial<TagSet>): Promise<TagSet> {
    const existing = await tagsetDexieService.getById(id);
    if (!existing) {
      throw new Error(`TagSet ${id} not found`);
    }
    
    const updated: TagSet = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    
    await db.tagSets.put(updated);
    console.log('[TagSetService] Updated tag set from incoming sync', {
      id: updated.id,
      updates
    });
    
    return updated;
  }
  
  async deleteIncoming(id: string): Promise<boolean> {
    const result = await tagsetDexieService.delete(id);
    if (result) {
      console.log('[TagSetService] Deleted tag set from incoming sync', { id });
    }
    return result;
  }
  
  // ============================================================================
  // Validation Hooks
  // ============================================================================
  
  protected validateCreate(input: CreateTagSetInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Tag set name is required');
    }
  }
  
  protected validateUpdate(id: string, updates: UpdateTagSetInput): void {
    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new Error('Tag set name cannot be empty');
    }
  }
  
  // ============================================================================
  // Business Logic Hooks
  // ============================================================================
  
  protected beforeCreate(input: CreateTagSetInput): CreateTagSetInput {
    return {
      ...input,
      isActive: input.isActive !== undefined ? input.isActive : true,
    };
  }
  
  // ============================================================================
  // Additional Methods
  // ============================================================================
  
  /**
   * Get all active tag sets
   */
  async getActiveTagSets(): Promise<TagSet[]> {
    const tagSets = await tagsetDexieService.getAll();
    return tagSets.filter(ts => ts.isActive);
  }
}

// Export singleton instance
export const tagSetDomainService = new TagSetDomainService();