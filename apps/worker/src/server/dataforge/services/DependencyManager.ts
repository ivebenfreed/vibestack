/**
 * Dependency Manager
 * 
 * Handles project management dependencies between tasks/projects for Gantt chart functionality.
 * Supports the 4 classic dependency types: Finish-to-Start, Start-to-Start, 
 * Finish-to-Finish, and Start-to-Finish.
 * 
 * Dependencies are stored as special relationships in the org relationships table
 * with rich metadata including dependency type, lead/lag time, and constraint type.
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';

export interface DependencyDefinition {
  sourceEntityId: string;     // Task B (the dependent task)
  targetEntityId: string;     // Task A (the predecessor task)
  sourceEntityType: string;   // Usually 'Task' but could be 'Project'
  targetEntityType: string;   // Usually 'Task' but could be 'Project'
  dependencyType: DependencyType;
  leadLagDays?: number;       // Optional lead/lag time (negative = lag, positive = lead)
  isHardConstraint?: boolean; // Hard constraint vs soft constraint
  description?: string;       // Human-readable dependency description
}

export interface DependencyMetadata {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceEntityType: string;
  targetEntityType: string;
  dependencyType: DependencyType;
  leadLagDays: number;
  isHardConstraint: boolean;
  description?: string;
  createdAt: Date;
  createdBy?: string;
}

export class DependencyManager {
  private static readonly VALID_ENTITY_TYPES = ['Project', 'Task', 'Activity'] as const;

  /**
   * Create a dependency relationship between two entities
   * Only Project, Task, and Activity entities support dependencies (temporal entities)
   */
  static async createDependency(
    kysely: Kysely<any>,
    orgId: string,
    dependency: DependencyDefinition,
    createdBy?: string
  ): Promise<void> {
    // Validate entity types support dependencies
    this.validateEntityTypes(dependency.sourceEntityType, dependency.targetEntityType);
    
    const tableName = this.getRelationshipTableName(orgId);

    // Check for circular dependencies before creating
    await this.validateNoCycles(kysely, orgId, dependency);

    // Create the dependency relationship
    await kysely
      .insertInto(tableName)
      .values({
        source_entity_type: dependency.sourceEntityType,
        source_entity_id: dependency.sourceEntityId,
        target_entity_type: dependency.targetEntityType,
        target_entity_id: dependency.targetEntityId,
        relationship_type: 'depends_on',
        field_name: 'dependency', // Virtual field name for dependencies
        properties: {
          dependency_type: dependency.dependencyType,
          lead_lag_days: dependency.leadLagDays || 0,
          is_hard_constraint: dependency.isHardConstraint ?? true,
          description: dependency.description
        },
        valid_from: new Date(),
        valid_until: null, // Active dependency
        created_at: new Date(),
        created_by: createdBy
      })
      .execute();
  }

  /**
   * Get all dependencies for a specific entity
   */
  static async getDependencies(
    kysely: Kysely<any>,
    orgId: string,
    entityId: string,
    entityType: string = 'Task'
  ): Promise<DependencyMetadata[]> {
    const tableName = this.getRelationshipTableName(orgId);

    const results = await kysely
      .selectFrom(tableName)
      .selectAll()
      .where('relationship_type', '=', 'depends_on')
      .where('valid_until', 'is', null) // Only active dependencies
      .where((eb) =>
        eb.or([
          eb.and([
            eb('source_entity_type', '=', entityType),
            eb('source_entity_id', '=', entityId)
          ]),
          eb.and([
            eb('target_entity_type', '=', entityType),
            eb('target_entity_id', '=', entityId)
          ])
        ])
      )
      .execute();

    return results.map(result => ({
      id: result.id,
      sourceEntityId: result.source_entity_id,
      targetEntityId: result.target_entity_id,
      sourceEntityType: result.source_entity_type,
      targetEntityType: result.target_entity_type,
      dependencyType: result.properties?.dependency_type || 'finish_to_start',
      leadLagDays: result.properties?.lead_lag_days || 0,
      isHardConstraint: result.properties?.is_hard_constraint ?? true,
      description: result.properties?.description,
      createdAt: result.created_at,
      createdBy: result.created_by
    }));
  }

  /**
   * Get all predecessors (tasks this task depends on)
   */
  static async getPredecessors(
    kysely: Kysely<any>,
    orgId: string,
    taskId: string,
    taskType: string = 'Task'
  ): Promise<DependencyMetadata[]> {
    const tableName = this.getRelationshipTableName(orgId);

    const results = await kysely
      .selectFrom(tableName)
      .selectAll()
      .where('relationship_type', '=', 'depends_on')
      .where('source_entity_type', '=', taskType)
      .where('source_entity_id', '=', taskId)
      .where('valid_until', 'is', null)
      .execute();

    return results.map(result => ({
      id: result.id,
      sourceEntityId: result.source_entity_id,
      targetEntityId: result.target_entity_id,
      sourceEntityType: result.source_entity_type,
      targetEntityType: result.target_entity_type,
      dependencyType: result.properties?.dependency_type || 'finish_to_start',
      leadLagDays: result.properties?.lead_lag_days || 0,
      isHardConstraint: result.properties?.is_hard_constraint ?? true,
      description: result.properties?.description,
      createdAt: result.created_at,
      createdBy: result.created_by
    }));
  }

  /**
   * Get all successors (tasks that depend on this task)
   */
  static async getSuccessors(
    kysely: Kysely<any>,
    orgId: string,
    taskId: string,
    taskType: string = 'Task'
  ): Promise<DependencyMetadata[]> {
    const tableName = this.getRelationshipTableName(orgId);

    const results = await kysely
      .selectFrom(tableName)
      .selectAll()
      .where('relationship_type', '=', 'depends_on')
      .where('target_entity_type', '=', taskType)
      .where('target_entity_id', '=', taskId)
      .where('valid_until', 'is', null)
      .execute();

    return results.map(result => ({
      id: result.id,
      sourceEntityId: result.source_entity_id,
      targetEntityId: result.target_entity_id,
      sourceEntityType: result.source_entity_type,
      targetEntityType: result.target_entity_type,
      dependencyType: result.properties?.dependency_type || 'finish_to_start',
      leadLagDays: result.properties?.lead_lag_days || 0,
      isHardConstraint: result.properties?.is_hard_constraint ?? true,
      description: result.properties?.description,
      createdAt: result.created_at,
      createdBy: result.created_by
    }));
  }

  /**
   * Remove a dependency
   */
  static async removeDependency(
    kysely: Kysely<any>,
    orgId: string,
    dependencyId: string
  ): Promise<void> {
    const tableName = this.getRelationshipTableName(orgId);

    // Soft delete - set valid_until timestamp
    await kysely
      .updateTable(tableName)
      .set({ valid_until: new Date() })
      .where('id', '=', dependencyId)
      .where('relationship_type', '=', 'depends_on')
      .execute();
  }

  /**
   * Update dependency metadata
   */
  static async updateDependency(
    kysely: Kysely<any>,
    orgId: string,
    dependencyId: string,
    updates: Partial<Pick<DependencyDefinition, 'dependencyType' | 'leadLagDays' | 'isHardConstraint' | 'description'>>
  ): Promise<void> {
    const tableName = this.getRelationshipTableName(orgId);

    // Get current properties
    const current = await kysely
      .selectFrom(tableName)
      .select('properties')
      .where('id', '=', dependencyId)
      .where('relationship_type', '=', 'depends_on')
      .executeTakeFirst();

    if (!current) {
      throw new Error('Dependency not found');
    }

    // Merge updated properties
    const updatedProperties = {
      ...current.properties,
      ...(updates.dependencyType && { dependency_type: updates.dependencyType }),
      ...(updates.leadLagDays !== undefined && { lead_lag_days: updates.leadLagDays }),
      ...(updates.isHardConstraint !== undefined && { is_hard_constraint: updates.isHardConstraint }),
      ...(updates.description !== undefined && { description: updates.description })
    };

    await kysely
      .updateTable(tableName)
      .set({ properties: updatedProperties })
      .where('id', '=', dependencyId)
      .where('relationship_type', '=', 'depends_on')
      .execute();
  }

  /**
   * Validate that creating a dependency won't create a circular reference
   */
  private static async validateNoCycles(
    kysely: Kysely<any>,
    orgId: string,
    dependency: DependencyDefinition
  ): Promise<void> {
    // Check if creating this dependency would create a cycle
    // This is a simplified check - for production, you'd want a more sophisticated cycle detection
    if (dependency.sourceEntityId === dependency.targetEntityId) {
      throw new Error('Cannot create dependency: Task cannot depend on itself');
    }

    // Check if the reverse dependency already exists
    const reverse = await kysely
      .selectFrom(this.getRelationshipTableName(orgId))
      .select('id')
      .where('relationship_type', '=', 'depends_on')
      .where('source_entity_id', '=', dependency.targetEntityId)
      .where('target_entity_id', '=', dependency.sourceEntityId)
      .where('valid_until', 'is', null)
      .executeTakeFirst();

    if (reverse) {
      throw new Error('Cannot create dependency: Would create a circular dependency');
    }
  }

  /**
   * Get dependency critical path for Gantt chart scheduling
   */
  static async getCriticalPath(
    kysely: Kysely<any>,
    orgId: string,
    projectId?: string
  ): Promise<string[]> {
    // This would implement critical path method (CPM) algorithm
    // For now, return empty array - this is a complex algorithm
    // that would need task duration data and forward/backward pass calculations
    return [];
  }

  /**
   * Get the relationship table name for an organization
   */
  private static getRelationshipTableName(orgId: string): string {
    return `org_${orgId.replace(/-/g, '_')}_relationships`;
  }

  /**
   * Get human-readable dependency type descriptions
   */
  static getDependencyTypeDescription(type: DependencyType): string {
    const descriptions = {
      'finish_to_start': 'Finish to Start (FS) - Predecessor must finish before successor can start',
      'start_to_start': 'Start to Start (SS) - Predecessor must start before successor can start',
      'finish_to_finish': 'Finish to Finish (FF) - Predecessor must finish before successor can finish',
      'start_to_finish': 'Start to Finish (SF) - Predecessor must start before successor can finish'
    };
    return descriptions[type];
  }

  /**
   * Validate dependency type
   */
  static isValidDependencyType(type: string): type is DependencyType {
    return ['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'].includes(type);
  }

  /**
   * Validate that entity types support dependencies
   * Only Project, Task, and Activity entities have temporal aspects that make dependencies meaningful
   */
  private static validateEntityTypes(sourceType: string, targetType: string): void {
    if (!this.VALID_ENTITY_TYPES.includes(sourceType as any)) {
      throw new Error(`Source entity type '${sourceType}' does not support dependencies. Only Project, Task, and Activity entities support dependencies.`);
    }
    if (!this.VALID_ENTITY_TYPES.includes(targetType as any)) {
      throw new Error(`Target entity type '${targetType}' does not support dependencies. Only Project, Task, and Activity entities support dependencies.`);
    }
  }

  /**
   * Check if an entity type supports dependencies
   */
  static supportsDepenencies(entityType: string): boolean {
    return this.VALID_ENTITY_TYPES.includes(entityType as any);
  }
}