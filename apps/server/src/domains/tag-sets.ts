import { TagSet, TagSet as TagSetClass } from "@repo/dataforge/server-entities";
import { NeonService } from '../lib/neon-orm/neon-service';
import { BaseServerRepository } from './BaseServerRepository';

// Simplified type definitions

// Input types for API
export type TagSetCreateInput = Partial<Omit<TagSet, 'id' | 'created_at' | 'updated_at'>>;
export type TagSetUpdateInput = Partial<TagSetCreateInput>;

/**
 * TagSetRepository class that extends BaseServerRepository
 */
export class TagSetRepository extends BaseServerRepository<TagSet> {
  
  constructor(neonService: NeonService) {
    super(neonService, TagSetClass);
  }

  /**
   * Get all tag sets for a specific project
   */
  async getByProjectId(projectId: string): Promise<TagSet[]> {
    // TagSet doesn't have a direct projectId field, it has a many-to-many relation
    // This method needs to be redesigned to work with the relation
    throw new Error('getByProjectId needs to be implemented with proper relation query');
  }

  /**
   * Create a new tag set with validation
   */
  async createTagSet(input: TagSetCreateInput): Promise<TagSet> {
    // Use the base class create method which handles everything
    return await this.create(input);
  }

  /**
   * Update a tag set
   */
  async updateTagSet(id: string, input: TagSetUpdateInput): Promise<TagSet | null> {
    const tagSet = await this.findById(id);
    if (!tagSet) return null;

    // Use the base class update method
    return await this.update(id, input);
  }

  /**
   * Delete a tag set
   */
  async deleteTagSet(id: string): Promise<boolean> {
    const result = await this.delete(id);
    return result;
  }
}