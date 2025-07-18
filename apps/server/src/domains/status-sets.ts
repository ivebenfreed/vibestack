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
    return this.findBy({ project_id: projectId });
  }

  /**
   * Create a new status set with validation
   */
  async createStatusSet(input: StatusSetCreateInput): Promise<StatusSet> {
    const statusSet = this.create(input);
    return this.save(statusSet);
  }

  /**
   * Update a status set
   */
  async updateStatusSet(id: string, input: StatusSetUpdateInput): Promise<StatusSet | null> {
    const statusSet = await this.findOneBy({ id });
    if (!statusSet) return null;

    Object.assign(statusSet, input);
    return this.save(statusSet);
  }

  /**
   * Delete a status set
   */
  async deleteStatusSet(id: string): Promise<boolean> {
    const result = await this.delete({ id });
    return result.affected ? result.affected > 0 : false;
  }
}