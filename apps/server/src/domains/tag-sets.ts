import { TagSet } from "@repo/dataforge/server-entities";
import { NeonService } from '../lib/neon-orm/neon-service';
import { BaseServerRepository } from './BaseServerRepository';

// Simplified type definitions
type TagSetInstance = TagSet;

// Input types for API
export type TagSetCreateInput = Partial<Omit<TagSetInstance, 'id' | 'created_at' | 'updated_at'>>;
export type TagSetUpdateInput = Partial<TagSetCreateInput>;

/**
 * TagSetRepository class that extends BaseServerRepository
 */
export class TagSetRepository extends BaseServerRepository<TagSet> {
  
  constructor(neonService: NeonService) {
    super(neonService, TagSet);
  }

  /**
   * Get all tag sets for a specific project
   */
  async getByProjectId(projectId: string): Promise<TagSet[]> {
    return this.findBy({ project_id: projectId });
  }

  /**
   * Create a new tag set with validation
   */
  async createTagSet(input: TagSetCreateInput): Promise<TagSet> {
    const tagSet = this.create(input);
    return this.save(tagSet);
  }

  /**
   * Update a tag set
   */
  async updateTagSet(id: string, input: TagSetUpdateInput): Promise<TagSet | null> {
    const tagSet = await this.findOneBy({ id });
    if (!tagSet) return null;

    Object.assign(tagSet, input);
    return this.save(tagSet);
  }

  /**
   * Delete a tag set
   */
  async deleteTagSet(id: string): Promise<boolean> {
    const result = await this.delete({ id });
    return result.affected ? result.affected > 0 : false;
  }
}