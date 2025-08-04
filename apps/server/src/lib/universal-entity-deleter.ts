import { 
  CLIENT_RELATIONSHIP_CONFIGS, 
  getEntityRelationships, 
  getJunctionRelationships,
  CLIENT_DOMAIN_TABLE_HIERARCHY,
  CLIENT_JUNCTION_TABLE_MAPPING
} from '@repo/dataforge/client-entities';
import { NeonService } from './neon-orm/neon-service';
import type { Context } from 'hono';
import type { AppBindings } from '../types/hono';

// TODO: Import RelationshipConfig when exported from dataforge
type RelationshipConfig = any;

export interface DeletionStrategy {
  /** Strategy for handling foreign key references */
  foreignKeyStrategy: 'SET_NULL' | 'CASCADE' | 'TRANSFER_OWNERSHIP' | 'RESTRICT';
  /** Strategy for handling junction table entries */
  junctionStrategy: 'CASCADE' | 'RESTRICT';
  /** Entity to transfer ownership to (for TRANSFER_OWNERSHIP strategy) */
  transferTarget?: string;
}

export interface DeletionOptions {
  /** Custom strategies per entity */
  entityStrategies?: Record<string, DeletionStrategy>;
  /** Default strategy for entities not specified */
  defaultStrategy?: DeletionStrategy;
  /** Dry run - return what would be deleted without executing */
  dryRun?: boolean;
}

export interface DeletionPlan {
  /** Operations that will be performed, in execution order */
  operations: DeletionOperation[];
  /** Entities that reference the target but couldn't be handled */
  blockers: Array<{
    entity: string;
    field: string;
    reason: string;
  }>;
}

export interface DeletionOperation {
  type: 'UPDATE' | 'DELETE' | 'TRANSFER';
  entity: string;
  table: string;
  condition: string;
  action: string;
  affectedCount?: number;
}

export class UniversalEntityDeleter {
  private defaultStrategy: DeletionStrategy = {
    foreignKeyStrategy: 'SET_NULL',
    junctionStrategy: 'CASCADE'
  };

  constructor(private neonService: NeonService) {}

  /**
   * Deletes an entity and handles all its relationships automatically
   * using DataForge relationship metadata
   */
  async deleteEntity(
    entityName: string, 
    entityId: string, 
    options: DeletionOptions = {}
  ): Promise<DeletionPlan> {
    const plan = await this.createDeletionPlan(entityName, entityId, options);
    
    if (options.dryRun) {
      return plan;
    }

    // Check for blockers first
    if (plan.blockers.length > 0) {
      throw new Error(`Cannot delete ${entityName}. Blockers: ${plan.blockers.map(b => `${b.entity}.${b.field}: ${b.reason}`).join(', ')}`);
    }

    // Execute operations (Neon HTTP doesn't support transactions, so execute sequentially)
    try {
      for (const operation of plan.operations) {
        await this.executeOperation(operation);
      }
    } catch (error) {
      console.error('[UniversalEntityDeleter] Error during deletion operations:', error);
      throw new Error(`Deletion failed during operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return plan;
  }

  /**
   * Creates a deletion plan by analyzing all relationships to the target entity
   */
  private async createDeletionPlan(
    entityName: string, 
    entityId: string, 
    options: DeletionOptions
  ): Promise<DeletionPlan> {
    const operations: DeletionOperation[] = [];
    const blockers: DeletionPlan['blockers'] = [];

    // Find all entities that reference this entity
    const referencingEntities = this.findReferencingEntities(entityName);

    // Sort by dependency hierarchy (delete dependents first)
    const sortedEntities = this.sortEntitiesByHierarchy(referencingEntities);

    for (const referencingEntity of sortedEntities) {
      // Handle special junction table entries
      if (referencingEntity.startsWith('junction:')) {
        const junctionTableName = referencingEntity.replace('junction:', '');
        
        // Create operation to clean up junction table
        const columnName = `${entityName.toLowerCase().slice(0, -1)}_id`; // e.g., "user_id"
        operations.push({
          type: 'DELETE',
          entity: 'junction',
          table: junctionTableName,
          condition: `${columnName} = '${entityId}'`,
          action: `DELETE FROM ${junctionTableName} WHERE ${columnName} = '${entityId}'`
        });
        continue;
      }

      const strategy = this.getStrategyForEntity(referencingEntity, options);
      const relationships = getEntityRelationships(referencingEntity);

      if (!relationships) continue;

      // Handle direct foreign key references
      if (relationships.requiredReferences) {
        for (const ref of relationships.requiredReferences) {
          if (this.getTargetEntityName(ref.targetEntity) === entityName) {
            const result = await this.handleForeignKeyReference(
              referencingEntity, 
              ref, 
              entityId, 
              strategy
            );
            
            if (result.type === 'blocker') {
              blockers.push(result.blocker!);
            } else {
              operations.push(result.operation!);
            }
          }
        }
      }

      // Handle junction table relationships
      if (relationships.junctionRelationships) {
        for (const junction of relationships.junctionRelationships) {
          if (junction.targetEntity === entityName) {
            const operation = this.handleJunctionTableReference(
              junction,
              entityId,
              strategy
            );
            operations.push(operation);
          }
        }
      }
    }

    // Finally, add the operation to delete the entity itself
    const tableName = this.getTableNameForEntity(entityName);
    operations.push({
      type: 'DELETE',
      entity: entityName,
      table: tableName,
      condition: `id = '${entityId}'`,
      action: `DELETE FROM ${tableName} WHERE id = '${entityId}'`
    });

    return { operations, blockers };
  }

  /**
   * Finds all entities that have relationships pointing to the target entity
   * Also finds junction tables where the target entity participates
   */
  private findReferencingEntities(targetEntityName: string): string[] {
    const referencingEntities: string[] = [];
    const junctionTablesToClean: string[] = [];

    for (const [entityName, config] of Object.entries(CLIENT_RELATIONSHIP_CONFIGS)) {
      // Check required references (direct foreign keys)
      if (config.requiredReferences) {
        for (const ref of config.requiredReferences) {
          if (this.getTargetEntityName(ref.targetEntity) === targetEntityName) {
            referencingEntities.push(entityName);
            break;
          }
        }
      }

      // Check junction relationships where target entity is referenced
      if (config.junctionRelationships) {
        for (const junction of config.junctionRelationships) {
          if (junction.targetEntity === targetEntityName) {
            referencingEntities.push(entityName);
            // Also track the junction table for direct cleanup
            junctionTablesToClean.push(junction.junctionTable);
            break;
          }
        }
      }
    }

    // Add special handling for junction tables where target entity is the source
    // This handles the reverse case: when deleting a user, we need to clean up
    // project_members entries where user_id = target_user_id
    for (const [entityName, config] of Object.entries(CLIENT_RELATIONSHIP_CONFIGS)) {
      if (config.junctionRelationships) {
        for (const junction of config.junctionRelationships) {
          // If this junction table connects TO the target entity via sourceColumn,
          // we need to clean it up when deleting the target entity
          if (junction.targetEntity !== targetEntityName) {
            // Check if we need reverse cleanup by looking at junction table naming
            // For project_members: when deleting user, clean where user_id = userId
            if (junction.junctionTable.includes(targetEntityName.toLowerCase().slice(0, -1)) || // e.g., "project_members" contains "user"
                junction.sourceColumn === `${targetEntityName.toLowerCase().slice(0, -1)}_id`) { // e.g., "user_id"
              
              referencingEntities.push(`junction:${junction.junctionTable}`);
            }
          }
        }
      }
    }

    return [...new Set(referencingEntities)]; // Remove duplicates
  }

  /**
   * Sorts entities by their dependency hierarchy to ensure proper deletion order
   */
  private sortEntitiesByHierarchy(entities: string[]): string[] {
    const hierarchy = CLIENT_DOMAIN_TABLE_HIERARCHY;
    
    return entities.sort((a, b) => {
      const keyA = `"${a}"` as keyof typeof hierarchy;
      const keyB = `"${b}"` as keyof typeof hierarchy;
      const levelA = hierarchy[keyA] ?? 999;
      const levelB = hierarchy[keyB] ?? 999;
      
      // Higher level entities (more dependent) should be deleted first
      return levelB - levelA;
    });
  }

  /**
   * Handles a foreign key reference based on the deletion strategy
   */
  private async handleForeignKeyReference(
    referencingEntity: string,
    reference: { field: string; targetEntity: string; nullable?: boolean },
    targetEntityId: string,
    strategy: DeletionStrategy
  ): Promise<{ type: 'operation' | 'blocker'; operation?: DeletionOperation; blocker?: any }> {
    const tableName = this.getTableNameForEntity(referencingEntity);
    const columnName = this.convertToSnakeCase(reference.field);

    switch (strategy.foreignKeyStrategy) {
      case 'SET_NULL':
        if (!reference.nullable) {
          return {
            type: 'blocker',
            blocker: {
              entity: referencingEntity,
              field: reference.field,
              reason: 'Field is not nullable but strategy is SET_NULL'
            }
          };
        }

        return {
          type: 'operation',
          operation: {
            type: 'UPDATE',
            entity: referencingEntity,
            table: tableName,
            condition: `${columnName} = '${targetEntityId}'`,
            action: `UPDATE ${tableName} SET ${columnName} = NULL WHERE ${columnName} = '${targetEntityId}'`
          }
        };

      case 'CASCADE':
        return {
          type: 'operation',
          operation: {
            type: 'DELETE',
            entity: referencingEntity,
            table: tableName,
            condition: `${columnName} = '${targetEntityId}'`,
            action: `DELETE FROM ${tableName} WHERE ${columnName} = '${targetEntityId}'`
          }
        };

      case 'TRANSFER_OWNERSHIP':
        if (!strategy.transferTarget) {
          return {
            type: 'blocker',
            blocker: {
              entity: referencingEntity,
              field: reference.field,
              reason: 'TRANSFER_OWNERSHIP strategy requires transferTarget to be specified'
            }
          };
        }

        return {
          type: 'operation',
          operation: {
            type: 'TRANSFER',
            entity: referencingEntity,
            table: tableName,
            condition: `${columnName} = '${targetEntityId}'`,
            action: `UPDATE ${tableName} SET ${columnName} = '${strategy.transferTarget}' WHERE ${columnName} = '${targetEntityId}'`
          }
        };

      case 'RESTRICT':
        // Check if there are any records that would block deletion
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${columnName} = $1`;
        const countResult = await this.neonService.query(countQuery, [targetEntityId]);
        const count = countResult[0]?.count || 0;

        if (Number(count) > 0) {
          return {
            type: 'blocker',
            blocker: {
              entity: referencingEntity,
              field: reference.field,
              reason: `${count} records exist with this reference (RESTRICT strategy)`
            }
          };
        }

        // No records found, no operation needed
        return { type: 'operation', operation: undefined as any };

      default:
        return {
          type: 'blocker',
          blocker: {
            entity: referencingEntity,
            field: reference.field,
            reason: `Unknown strategy: ${strategy.foreignKeyStrategy}`
          }
        };
    }
  }

  /**
   * Handles junction table relationships
   */
  private handleJunctionTableReference(
    junction: {
      junctionTable: string;
      sourceColumn: string;
      targetColumn: string;
      targetEntity: string;
    },
    targetEntityId: string,
    strategy: DeletionStrategy
  ): DeletionOperation {
    const junctionTableName = junction.junctionTable;
    const targetColumn = junction.targetColumn;

    return {
      type: 'DELETE',
      entity: 'junction',
      table: junctionTableName,
      condition: `${targetColumn} = '${targetEntityId}'`,
      action: `DELETE FROM ${junctionTableName} WHERE ${targetColumn} = '${targetEntityId}'`
    };
  }

  /**
   * Executes a single deletion operation using NeonService
   */
  private async executeOperation(operation: DeletionOperation): Promise<void> {
    if (!operation) return;

    console.log(`[UniversalEntityDeleter] Executing: ${operation.action}`);
    
    // Execute based on operation type using NeonService raw query
    switch (operation.type) {
      case 'UPDATE':
      case 'TRANSFER':
        // Both UPDATE and TRANSFER operations are SQL UPDATE statements
        if (operation.action.includes('SET') && operation.action.includes('WHERE')) {
          const matches = operation.action.match(/UPDATE (\w+) SET (\w+) = (.+) WHERE (\w+) = '(.+)'/);
          if (matches) {
            const [, table, column, value, whereColumn, whereValue] = matches;
            const sql = `UPDATE ${table} SET ${column} = $1 WHERE ${whereColumn} = $2`;
            const paramValue = value === 'NULL' ? null : value?.replace(/'/g, '') || '';
            await this.neonService.query(sql, [paramValue, whereValue]);
          }
        }
        break;
        
      case 'DELETE':
        // Parse DELETE statement and execute with parameterized query
        if (operation.action.includes('WHERE')) {
          const matches = operation.action.match(/DELETE FROM (\w+) WHERE (\w+) = '(.+)'/);
          if (matches) {
            const [, table, whereColumn, whereValue] = matches;
            const sql = `DELETE FROM ${table} WHERE ${whereColumn} = $1`;
            await this.neonService.query(sql, [whereValue]);
          }
        }
        break;
        
      default:
        console.warn(`[UniversalEntityDeleter] Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Gets the deletion strategy for a specific entity
   */
  private getStrategyForEntity(entityName: string, options: DeletionOptions): DeletionStrategy {
    return options.entityStrategies?.[entityName] 
      || options.defaultStrategy 
      || this.defaultStrategy;
  }

  /**
   * Converts camelCase field names to snake_case column names
   */
  private convertToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Gets the table name for an entity
   */
  private getTableNameForEntity(entityName: string): string {
    // Most entities use lowercase plural form
    return entityName.toLowerCase();
  }

  /**
   * Normalizes target entity names from relationship configs
   */
  private getTargetEntityName(targetEntity: string): string {
    // Remove quotes and normalize to match entity names
    return targetEntity.replace(/"/g, '');
  }
}

// Note: deleteUserWithRelationships function has been moved to UserRepository.deleteWithRelationships()
// This maintains better separation of concerns between the universal deleter and domain-specific logic