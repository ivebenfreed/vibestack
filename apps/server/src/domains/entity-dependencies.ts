import { EntityDependency as EntityDependencyClass, DependencyType } from '@repo/dataforge/server-entities';
import type { EntityDependency } from '@repo/dataforge/server-entities';
import { FindOptionsWhere, In } from 'typeorm';
import { NeonService } from '../lib/neon-orm/neon-service';
import { BaseServerRepository } from './BaseServerRepository';
import { serverLogger as log } from '../middleware/logger';

const MODULE_NAME = 'entity-dependencies-repository';

/**
 * EntityDependencyRepository class that extends BaseServerRepository
 * Handles server-side CRUD operations for generic entity dependencies
 * Supports task scheduling dependencies and other entity relationships
 */
export class EntityDependencyRepository extends BaseServerRepository<EntityDependency> {
  constructor(neonService: NeonService) {
    super(neonService, EntityDependencyClass);
  }

  /**
   * Get all dependencies for a specific entity (as predecessor)
   */
  async getDependenciesForEntity(entityType: string, entityId: string): Promise<EntityDependency[]> {
    try {
      const dependencies = await this.neonService.find(EntityDependencyClass, { 
        entityType,
        predecessorId: entityId 
      } as FindOptionsWhere<EntityDependency>);
      
      log.debug(`Found ${dependencies.length} dependencies for entity`, { 
        entityType,
        entityId,
        dependencyCount: dependencies.length 
      }, MODULE_NAME);
      
      return dependencies;
    } catch (error) {
      log.error('Failed to get dependencies for entity', error, { entityType, entityId }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Get all entities that depend on a specific entity (as successor)
   */
  async getDependentsForEntity(entityType: string, entityId: string): Promise<EntityDependency[]> {
    try {
      const dependents = await this.neonService.find(EntityDependencyClass, { 
        entityType,
        successorId: entityId 
      } as FindOptionsWhere<EntityDependency>);
      
      log.debug(`Found ${dependents.length} dependents for entity`, { 
        entityType,
        entityId,
        dependentCount: dependents.length 
      }, MODULE_NAME);
      
      return dependents;
    } catch (error) {
      log.error('Failed to get dependents for entity', error, { entityType, entityId }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Get all task dependencies for a project
   * This is a backward-compatible method for task-specific queries
   */
  async getTaskDependenciesForProject(projectId: string): Promise<EntityDependency[]> {
    try {
      // First, get all task IDs for the project
      const queryBuilder = await this.neonService.createQueryBuilder(EntityDependencyClass, 'ed');
      const dependencies = await queryBuilder
        .where('ed.entity_type = :entityType', { entityType: 'task' })
        .andWhere(qb => {
          const subQuery = qb
            .subQuery()
            .select('t.id')
            .from('tasks', 't')
            .where('t.projectId = :projectId')
            .getQuery();
          return `ed.predecessor_id IN ${subQuery} OR ed.successor_id IN ${subQuery}`;
        })
        .setParameter('projectId', projectId)
        .getMany();
      
      log.debug(`Found ${dependencies.length} task dependencies for project`, { 
        projectId,
        dependencyCount: dependencies.length 
      }, MODULE_NAME);
      
      return dependencies;
    } catch (error) {
      log.error('Failed to get task dependencies for project', error, { projectId }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Check if creating a dependency would create a cycle
   */
  async wouldCreateCycle(
    entityType: string,
    predecessorId: string, 
    successorId: string
  ): Promise<boolean> {
    try {
      // Simple self-reference check
      if (predecessorId === successorId) {
        return true;
      }

      // Check for direct cycle (A -> B, B -> A)
      const reverseExists = await this.neonService.findOne(EntityDependencyClass, {
        entityType,
        predecessorId: successorId,
        successorId: predecessorId
      } as FindOptionsWhere<EntityDependency>);

      if (reverseExists) {
        return true;
      }

      // For a more comprehensive cycle check, we'd need to traverse the dependency graph
      // This is a simplified version that only checks direct cycles
      // TODO: Implement full graph traversal for complete cycle detection

      return false;
    } catch (error) {
      log.error('Failed to check for cycles', error, { entityType, predecessorId, successorId }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Create a dependency with validation
   */
  async createSafely(dependencyData: Partial<EntityDependency>): Promise<EntityDependency> {
    const { entityType, predecessorId, successorId } = dependencyData;

    if (!entityType || !predecessorId || !successorId) {
      throw new Error('Missing required fields: entityType, predecessorId, successorId');
    }

    // Check for self-dependency
    if (predecessorId === successorId) {
      throw new Error('Entity cannot depend on itself');
    }

    // Check if dependency already exists
    const existing = await this.neonService.findOne(EntityDependencyClass, {
      entityType,
      predecessorId,
      successorId
    } as FindOptionsWhere<EntityDependency>);

    if (existing) {
      throw new Error('Dependency already exists');
    }

    // Check for cycles
    const wouldCycle = await this.wouldCreateCycle(entityType, predecessorId, successorId);
    if (wouldCycle) {
      throw new Error('Dependency would create a cycle');
    }

    // Create the dependency
    return await this.create(dependencyData);
  }
}