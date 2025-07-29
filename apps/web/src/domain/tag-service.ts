/**
 * Tag Domain Service
 * 
 * Implements tag CRUD operations with special set-filtered resolvers for project-based filtering.
 * Uses the generated Dexie domain service for database operations.
 */

import { Tag, TagSet } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { tagDexieService, type TagRelationshipContext } from '@repo/dataforge/dexie-domain';
import type { CreateTagInput, UpdateTagInput } from '@repo/dataforge/tag-operations';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// Re-export types from DataForge
export type { CreateTagInput, UpdateTagInput } from '@repo/dataforge/tag-operations';
export type { TagRelationshipContext } from '@repo/dataforge/dexie-domain';

// ============================================================================
// Tag Domain Service Implementation
// ============================================================================

export class TagDomainService extends BaseDomainService<Tag, CreateTagInput, UpdateTagInput> {
  tableName = 'tags';
  entityName = 'Tag';
  
  protected getTable() {
    return db.tags;
  }
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateTagInput): Promise<Tag> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    // Use generated Dexie service for creation
    const tag = await tagDexieService.create(processedInput);
    
    // Track for outgoing sync
    await trackOutgoingChange('tags', 'insert', tag);
    
    console.log('[TagService] Created tag', {
      id: tag.id,
      name: tag.name,
      trackingSync: true
    });
    
    // Call after hook if defined
    if (this.afterCreate) {
      await this.afterCreate(tag);
    }
    
    return tag;
  }
  
  async updateUI(id: string, updates: UpdateTagInput): Promise<Tag> {
    const existing = await tagDexieService.getById(id);
    if (!existing) {
      throw new Error(`Tag ${id} not found`);
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
    const updated = await tagDexieService.update(id, processedUpdates);
    if (!updated) {
      throw new Error(`Failed to update tag ${id}`);
    }
    
    // Track for outgoing sync
    await trackOutgoingChange('tags', 'update', updated);
    
    console.log('[TagService] Updated tag', {
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
    const existing = await tagDexieService.getById(id);
    if (!existing) {
      return false;
    }
    
    // Use generated Dexie service for deletion
    const result = await tagDexieService.delete(id);
    
    if (result) {
      // Track for outgoing sync
      await trackOutgoingChange('tags', 'delete', { id });
      
      console.log('[TagService] Deleted tag', {
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
   * Get available TagSets filtered by project context
   * This is the key method for filtering TagSets based on the current project
   */
  async getAvailableTagSets(context: TagRelationshipContext): Promise<TagSet[]> {
    return tagDexieService.getAvailableTagSets(context);
  }
  
  /**
   * Get available TagSets for a specific project
   */
  async getTagSetsForProject(projectId: string): Promise<TagSet[]> {
    return this.getAvailableTagSets({ projectId });
  }
  
  /**
   * Get all active TagSets (when no project context)
   */
  async getActiveTagSets(): Promise<TagSet[]> {
    return this.getAvailableTagSets({});
  }
  
  /**
   * Get all tags
   */
  async getAllTags(): Promise<Tag[]> {
    return tagDexieService.getAll();
  }
  
  /**
   * Get tags for a specific project
   * This uses the generated convenience method
   */
  async getTagsForProject(projectId: string): Promise<Tag[]> {
    // Use the generated method directly
    return tagDexieService.getTagsForProject(projectId);
  }
  
  /**
   * Get tags by tag set
   */
  async getTagsByTagSet(tagSetId: string): Promise<Tag[]> {
    // Query tags directly by tagSetId
    const tags = await db.tags
      .where('tagSetId')
      .equals(tagSetId)
      .toArray();
    
    return tags;
  }
  
  // ============================================================================
  // Incoming Operations (no sync tracking)
  // ============================================================================
  
  async createIncoming(tag: Tag): Promise<Tag> {
    await db.tags.put(tag);
    console.log('[TagService] Created tag from incoming sync', {
      id: tag.id,
      name: tag.name
    });
    return tag;
  }
  
  async updateIncoming(id: string, updates: Partial<Tag>): Promise<Tag> {
    const existing = await tagDexieService.getById(id);
    if (!existing) {
      throw new Error(`Tag ${id} not found`);
    }
    
    const updated: Tag = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    
    await db.tags.put(updated);
    console.log('[TagService] Updated tag from incoming sync', {
      id: updated.id,
      updates
    });
    
    return updated;
  }
  
  async deleteIncoming(id: string): Promise<boolean> {
    const result = await tagDexieService.delete(id);
    if (result) {
      console.log('[TagService] Deleted tag from incoming sync', { id });
    }
    return result;
  }
  
  // ============================================================================
  // Validation Hooks
  // ============================================================================
  
  protected validateCreate(input: CreateTagInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Tag name is required');
    }
    
    if (!input.tagSetId) {
      throw new Error('Tag set ID is required');
    }
  }
  
  protected validateUpdate(id: string, updates: UpdateTagInput): void {
    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new Error('Tag name cannot be empty');
    }
  }
  
  // ============================================================================
  // Business Logic Hooks
  // ============================================================================
  
  protected beforeCreate(input: CreateTagInput): CreateTagInput {
    return {
      ...input,
      color: input.color || '#6B7280', // Default gray color
      parentId: input.parentId || null,
    };
  }
  
  // ============================================================================
  // Relationship Resolvers
  // ============================================================================
  
  /**
   * Resolve the TagSet for a tag
   */
  async resolveTagSet(tagSetId: string): Promise<TagSet | undefined> {
    return tagDexieService.resolveTag_set_id(tagSetId);
  }
  
  /**
   * Resolve parent tag
   */
  async resolveParentTag(parentId: string): Promise<Tag | undefined> {
    return tagDexieService.resolveParent_id(parentId);
  }
  
  /**
   * Get child tags
   */
  async getChildTags(parentId: string): Promise<Tag[]> {
    const allTags = await tagDexieService.getAll();
    return allTags.filter(tag => tag.parentId === parentId);
  }
}

// Export singleton instance
export const tagDomainService = new TagDomainService();