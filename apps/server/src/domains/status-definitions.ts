import { StatusDefinition } from "@repo/dataforge/server-entities";
import { NeonService } from '../lib/neon-orm/neon-service';
import { BaseServerRepository } from './BaseServerRepository';

// Simplified type definitions
type StatusDefinitionInstance = StatusDefinition;

// Input types for API
export type StatusDefinitionCreateInput = Partial<Omit<StatusDefinitionInstance, 'id' | 'created_at' | 'updated_at'>>;
export type StatusDefinitionUpdateInput = Partial<StatusDefinitionCreateInput>;

/**
 * StatusDefinitionRepository class that extends BaseServerRepository
 */
export class StatusDefinitionRepository extends BaseServerRepository<StatusDefinition> {
  
  constructor(neonService: NeonService) {
    super(neonService, StatusDefinition);
  }

  /**
   * Get all status definitions for a specific status set
   */
  async getByStatusSetId(statusSetId: string): Promise<StatusDefinition[]> {
    return this.findBy({ status_set_id: statusSetId });
  }

  /**
   * Get status definition by key and status set
   */
  async getByKeyAndStatusSet(key: string, statusSetId: string): Promise<StatusDefinition | null> {
    return this.findOneBy({ key, status_set_id: statusSetId });
  }

  /**
   * Create a new status definition with validation
   */
  async createStatusDefinition(input: StatusDefinitionCreateInput): Promise<StatusDefinition> {
    const statusDefinition = this.create(input);
    return this.save(statusDefinition);
  }

  /**
   * Update a status definition
   */
  async updateStatusDefinition(id: string, input: StatusDefinitionUpdateInput): Promise<StatusDefinition | null> {
    const statusDefinition = await this.findOneBy({ id });
    if (!statusDefinition) return null;

    Object.assign(statusDefinition, input);
    return this.save(statusDefinition);
  }

  /**
   * Delete a status definition
   */
  async deleteStatusDefinition(id: string): Promise<boolean> {
    const result = await this.delete({ id });
    return result.affected ? result.affected > 0 : false;
  }
}