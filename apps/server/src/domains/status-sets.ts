import { StatusSet } from "@repo/dataforge/server-entities";
import { NeonService } from '../lib/neon-orm/neon-service';
import { BaseServerRepository } from './BaseServerRepository';

// Simplified type definitions
type StatusSetInstance = StatusSet;

// Input types for API
export type StatusSetCreateInput = Partial<Omit<StatusSetInstance, 'id' | 'created_at' | 'updated_at'>>;
export type StatusSetUpdateInput = Partial<StatusSetCreateInput>;

/**
 * StatusSetRepository class that extends BaseServerRepository
 */
export class StatusSetRepository extends BaseServerRepository<StatusSet> {
  
  constructor(neonService: NeonService) {
    super(neonService, StatusSet);
  }

  /**
   * Get all status sets for a specific project
   */
  async getByProjectId(projectId: string): Promise<StatusSet[]> {
    // StatusSet doesn't have a direct projectId field, it has a many-to-many relation
    // This method needs to be redesigned to work with the relation
    throw new Error('getByProjectId needs to be implemented with proper relation query');
  }

  /**
   * Create a new status set with validation
   */
  async createStatusSet(input: StatusSetCreateInput): Promise<StatusSet> {
    // Use the base class create method which handles everything
    return await this.create(input);
  }

  /**
   * Update a status set
   */
  async updateStatusSet(id: string, input: StatusSetUpdateInput): Promise<StatusSet | null> {
    const statusSet = await this.findById(id);
    if (!statusSet) return null;

    // Use the base class update method
    return await this.update(id, input);
  }

  /**
   * Delete a status set
   */
  async deleteStatusSet(id: string): Promise<boolean> {
    const result = await this.delete(id);
    return result;
  }
}