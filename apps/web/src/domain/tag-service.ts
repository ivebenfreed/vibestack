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
  
  /**
   * Get tags for a specific entity type
   * This intelligently matches tag sets to entity types
   * 
   * @param entityType - The entity type (e.g., 'task', 'project', 'user')
   * @param includeEmpty - If true, returns all tags when no specific tag set has tags
   * @returns Tags that are appropriate for the entity type
   */
  async getTagsForEntityType(entityType: string, includeEmpty: boolean = true): Promise<Tag[]> {
    // Get all tag sets
    const tagSets = await db.tagSets.toArray();
    
    console.log(`TagService: All tag sets in database:`, tagSets.map(ts => ({ 
      id: ts.id, 
      name: ts.name, 
      category: ts.category,
      isActive: ts.isActive
    })));
    
    // Smart matching: look for tag sets that match the entity type
    const matchingTagSets = tagSets.filter(ts => {
      const name = ts.name.toLowerCase();
      const entityLower = entityType.toLowerCase();
      
      // Direct matches: task_tags, project_tags, etc.
      if (name === `${entityLower}_tags` || name === `${entityLower}-tags`) {
        console.log(`TagService: Matched tag set '${ts.name}' by direct match`);
        return true;
      }
      
      // Plural matches: tasks_tags, projects_tags
      if (name === `${entityLower}s_tags` || name === `${entityLower}s-tags`) {
        console.log(`TagService: Matched tag set '${ts.name}' by plural match`);
        return true;
      }
      
      // Category matches: if category matches entity type
      if (ts.category && ts.category.toLowerCase() === entityLower) {
        console.log(`TagService: Matched tag set '${ts.name}' by category match`);
        return true;
      }
      
      // Name contains entity type: e.g., "Task Priority Tags"
      if (name.includes(entityLower)) {
        console.log(`TagService: Matched tag set '${ts.name}' by name contains`);
        return true;
      }
      
      return false;
    });
    
    if (matchingTagSets.length === 0) {
      console.log(`TagService: No tag sets found for entity type '${entityType}', returning all active tags`);
      // Fallback: return all active tags
      const allTags = await db.tags.toArray();
      return allTags.filter(tag => {
        const tagSet = tagSets.find(ts => ts.id === tag.tagSetId);
        return tagSet && tagSet.isActive;
      });
    }
    
    // Get all tags from matching tag sets
    const tagSetIds = matchingTagSets.map(ts => ts.id);
    
    // Debug: Check what we're querying
    console.log(`TagService: Querying tags with tagSetIds:`, tagSetIds);
    
    // Get all tags and filter manually (Dexie anyOf might have issues)
    const allTags = await db.tags.toArray();
    
    // Debug: Show what tagSetIds exist in the tags
    const uniqueTagSetIds = [...new Set(allTags.map(t => t.tagSetId))];
    console.log(`TagService: Unique tagSetIds in all tags:`, uniqueTagSetIds);
    console.log(`TagService: Sample tags with their tagSetIds:`, allTags.slice(0, 5).map(t => ({
      id: t.id,
      name: t.name,
      tagSetId: t.tagSetId
    })));
    
    const tags = allTags.filter(tag => tagSetIds.includes(tag.tagSetId));
    
    console.log(`TagService: Found ${tags.length} tags for entity type '${entityType}'`, {
      matchingTagSets: matchingTagSets.map(ts => ({ id: ts.id, name: ts.name, category: ts.category })),
      tagCount: tags.length,
      allTagsCount: allTags.length,
      sampleTags: tags.slice(0, 3).map(t => ({ id: t.id, name: t.name, tagSetId: t.tagSetId }))
    });
    
    // If no tags found but we have matching tag sets, and includeEmpty is true, return all tags
    if (tags.length === 0 && matchingTagSets.length > 0 && includeEmpty) {
      console.log(`TagService: No tags in matching tag sets for '${entityType}', returning all tags`);
      return allTags;
    }
    
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