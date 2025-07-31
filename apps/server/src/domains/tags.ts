import { Tag } from "@repo/dataforge/server-entities";
import { NeonService } from '../lib/neon-orm/neon-service';
import { BaseServerRepository } from './BaseServerRepository';

// Simplified type definitions
type TagInstance = Tag;

// Input types for API
export type TagCreateInput = Partial<Omit<TagInstance, 'id' | 'created_at' | 'updated_at'>>;
export type TagUpdateInput = Partial<TagCreateInput>;

/**
 * TagRepository class that extends BaseServerRepository
 */
export class TagRepository extends BaseServerRepository<Tag> {
  
  constructor(neonService: NeonService) {
    super(neonService, Tag);
  }

  /**
   * Get all tags for a specific tag set
   */
  async getByTagSetId(tagSetId: string): Promise<Tag[]> {
    return this.findBy({ tagSetId: tagSetId });
  }

  /**
   * Get tag by key and tag set
   */
  async getByKeyAndTagSet(key: string, tagSetId: string): Promise<Tag | null> {
    const result = await this.findBy({ tagSetId: tagSetId });
    // Filter by name if that's what 'key' was supposed to be
    const filtered = result.filter(tag => tag.name === key);
    return filtered.length > 0 ? filtered[0]! : null;
  }

  /**
   * Create a new tag with validation
   */
  async createTag(input: TagCreateInput): Promise<Tag> {
    // Use the base class create method which handles everything
    return await this.create(input);
  }

  /**
   * Update a tag
   */
  async updateTag(id: string, input: TagUpdateInput): Promise<Tag | null> {
    const tag = await this.findById(id);
    if (!tag) return null;

    // Use the base class update method
    return await this.update(id, input);
  }

  /**
   * Delete a tag
   */
  async deleteTag(id: string): Promise<boolean> {
    const result = await this.delete(id);
    return result;
  }
}