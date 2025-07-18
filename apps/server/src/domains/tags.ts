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
    return this.findBy({ tag_set_id: tagSetId });
  }

  /**
   * Get tag by key and tag set
   */
  async getByKeyAndTagSet(key: string, tagSetId: string): Promise<Tag | null> {
    return this.findOneBy({ key, tag_set_id: tagSetId });
  }

  /**
   * Create a new tag with validation
   */
  async createTag(input: TagCreateInput): Promise<Tag> {
    const tag = this.create(input);
    return this.save(tag);
  }

  /**
   * Update a tag
   */
  async updateTag(id: string, input: TagUpdateInput): Promise<Tag | null> {
    const tag = await this.findOneBy({ id });
    if (!tag) return null;

    Object.assign(tag, input);
    return this.save(tag);
  }

  /**
   * Delete a tag
   */
  async deleteTag(id: string): Promise<boolean> {
    const result = await this.delete({ id });
    return result.affected ? result.affected > 0 : false;
  }
}