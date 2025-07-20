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
    return this.findBy({ statusSetId: statusSetId });
  }

  /**
   * Get status definition by key and status set
   */
  async getByKeyAndStatusSet(key: string, statusSetId: string): Promise<StatusDefinition | null> {
    const result = await this.findBy({ statusSetId: statusSetId });
    // Filter by name if that's what 'key' was supposed to be
    const filtered = result.filter(sd => sd.name === key);
    return filtered.length > 0 ? filtered[0] : null;
  }

  /**
   * Create a new status definition with validation
   */
  async createStatusDefinition(input: StatusDefinitionCreateInput): Promise<StatusDefinition> {
    // Use the base class create method which handles everything
    return await this.create(input);
  }

  /**
   * Update a status definition
   */
  async updateStatusDefinition(id: string, input: StatusDefinitionUpdateInput): Promise<StatusDefinition | null> {
    const statusDefinition = await this.findById(id);
    if (!statusDefinition) return null;

    // Use the base class update method
    return await this.update(id, input);
  }

  /**
   * Delete a status definition
   */
  async deleteStatusDefinition(id: string): Promise<boolean> {
    const result = await this.delete(id);
    return result;
  }
}