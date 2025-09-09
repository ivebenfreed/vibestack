/**
 * Rollup Engine Service
 * 
 * Manages automatic calculation and updates of rollup fields based on relationship changes.
 * Integrates with the relationship system to provide aggregated values.
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { getFieldHandler } from '../fields';
import type { FieldDefinition } from '../types';
import { EntityManager } from '../entity-operations/EntityManager';

export interface RollupFieldConfig {
  entityName: string;
  fieldName: string;
  type: 'count' | 'sum' | 'average' | 'concat';
  relationshipType: string;
  targetEntityType: string;
  targetField?: string; // For sum, average, concat
  separator?: string; // For concat
  conditions?: Record<string, any>; // Additional filters
}

export class RollupEngine {
  private entityManager: EntityManager;
  
  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  /**
   * Register rollup fields for an entity based on its field definitions
   */
  async registerRollupFields(
    orgId: string, 
    entityName: string, 
    fieldDefinitions: Map<string, FieldDefinition>
  ): Promise<RollupFieldConfig[]> {
    const rollupConfigs: RollupFieldConfig[] = [];

    for (const [fieldName, fieldDef] of fieldDefinitions) {
      const handler = getFieldHandler(fieldDef.type);
      if (handler && 'isRollupField' in handler && handler.isRollupField()) {
        const rollupConfig = handler.getRollupConfig(fieldDef);
        
        const config: RollupFieldConfig = {
          entityName,
          fieldName,
          type: rollupConfig.type,
          relationshipType: rollupConfig.relationshipType,
          targetEntityType: rollupConfig.targetEntityType,
          targetField: rollupConfig.targetField,
          separator: rollupConfig.separator,
          conditions: rollupConfig.conditions
        };

        rollupConfigs.push(config);
        
        // Store rollup configuration in database for persistence
        await this.storeRollupConfig(orgId, config);
      }
    }

    return rollupConfigs;
  }

  /**
   * Calculate rollup value for a specific field
   */
  async calculateRollup(
    kysely: Kysely<any>,
    orgId: string,
    config: RollupFieldConfig,
    sourceEntityId: string
  ): Promise<any> {
    const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;
    const targetTable = `org_${orgId.replace(/-/g, '_')}_${config.targetEntityType.toLowerCase()}`;

    try {
      switch (config.type) {
        case 'count':
          return await this.calculateCount(kysely, relationshipTable, config, sourceEntityId);
        
        case 'sum':
          return await this.calculateSum(kysely, relationshipTable, targetTable, config, sourceEntityId);
        
        case 'average':
          return await this.calculateAverage(kysely, relationshipTable, targetTable, config, sourceEntityId);
        
        case 'concat':
          return await this.calculateConcat(kysely, relationshipTable, targetTable, config, sourceEntityId);
        
        default:
          console.warn(`Unknown rollup type: ${config.type}`);
          return null;
      }
    } catch (error) {
      console.error(`Error calculating rollup for ${config.fieldName}:`, error);
      return null;
    }
  }

  /**
   * Update rollup field value in the database
   */
  async updateRollupField(
    kysely: Kysely<any>,
    orgId: string,
    entityName: string,
    entityId: string,
    fieldName: string,
    value: any
  ): Promise<void> {
    const tableName = `org_${orgId.replace(/-/g, '_')}_${entityName.toLowerCase()}`;
    
    await kysely
      .updateTable(tableName)
      .set({ [fieldName]: value, updated_at: new Date() })
      .where('id', '=', entityId)
      .execute();
  }

  /**
   * Refresh all rollup fields for an entity record
   */
  async refreshEntityRollups(
    kysely: Kysely<any>,
    orgId: string,
    entityName: string,
    entityId: string
  ): Promise<void> {
    const rollupConfigs = await this.getRollupConfigs(kysely, orgId, entityName);
    
    for (const config of rollupConfigs) {
      const newValue = await this.calculateRollup(kysely, orgId, config, entityId);
      if (newValue !== null) {
        await this.updateRollupField(kysely, orgId, entityName, entityId, config.fieldName, newValue);
      }
    }
  }

  /**
   * Handle relationship changes that affect rollup fields
   */
  async onRelationshipChange(
    kysely: Kysely<any>,
    orgId: string,
    sourceEntityType: string,
    sourceEntityId: string,
    targetEntityType: string,
    targetEntityId: string,
    relationshipType: string,
    action: 'created' | 'updated' | 'deleted'
  ): Promise<void> {
    // Find rollup fields that depend on this relationship type
    const sourceRollups = await this.getRollupConfigsByRelationship(
      kysely, orgId, sourceEntityType, relationshipType, targetEntityType
    );
    
    const targetRollups = await this.getRollupConfigsByRelationship(
      kysely, orgId, targetEntityType, relationshipType, sourceEntityType
    );

    // Update source entity rollups
    for (const config of sourceRollups) {
      await this.refreshEntityRollups(kysely, orgId, sourceEntityType, sourceEntityId);
    }

    // Update target entity rollups if they exist
    for (const config of targetRollups) {
      await this.refreshEntityRollups(kysely, orgId, targetEntityType, targetEntityId);
    }
  }

  /**
   * Handle target field value changes that affect rollup fields
   */
  async onTargetFieldChange(
    kysely: Kysely<any>,
    orgId: string,
    entityType: string,
    entityId: string,
    changedField: string
  ): Promise<void> {
    // Find all rollup fields that aggregate this target field
    const affectedRollups = await this.getRollupConfigsByTargetField(
      kysely, orgId, entityType, changedField
    );

    // Update all entities that have rollup fields depending on this target field
    for (const config of affectedRollups) {
      // Get all entities that have relationships to this changed entity
      const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;
      
      const relatedEntities = await kysely
        .selectFrom(relationshipTable)
        .select(['source_entity_type', 'source_entity_id'])
        .where('target_entity_type', '=', entityType)
        .where('target_entity_id', '=', entityId)
        .where('relationship_type', '=', config.relationshipType)
        .where('valid_until', 'is', null)
        .execute();

      // Refresh rollups for each related entity
      for (const relation of relatedEntities) {
        await this.refreshEntityRollups(
          kysely, 
          orgId, 
          relation.source_entity_type, 
          relation.source_entity_id
        );
      }
    }
  }

  // Private calculation methods

  private async calculateCount(
    kysely: Kysely<any>,
    relationshipTable: string,
    config: RollupFieldConfig,
    sourceEntityId: string
  ): Promise<number> {
    let query = kysely
      .selectFrom(relationshipTable)
      .select(sql`COUNT(*)`.as('count'))
      .where('source_entity_type', '=', config.entityName)
      .where('source_entity_id', '=', sourceEntityId)
      .where('relationship_type', '=', config.relationshipType)
      .where('target_entity_type', '=', config.targetEntityType)
      .where('valid_until', 'is', null);

    // Apply additional conditions if specified
    if (config.conditions) {
      for (const [key, value] of Object.entries(config.conditions)) {
        query = query.where(sql`properties->>${key}`, '=', value);
      }
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }

  private async calculateSum(
    kysely: Kysely<any>,
    relationshipTable: string,
    targetTable: string,
    config: RollupFieldConfig,
    sourceEntityId: string
  ): Promise<number> {
    if (!config.targetField) return 0;

    let query = kysely
      .selectFrom(relationshipTable)
      .innerJoin(targetTable, `${targetTable}.id`, `${relationshipTable}.target_entity_id`)
      .select(sql`SUM(${sql.ref(targetTable + '.' + config.targetField)})`.as('sum'))
      .where(`${relationshipTable}.source_entity_type`, '=', config.entityName)
      .where(`${relationshipTable}.source_entity_id`, '=', sourceEntityId)
      .where(`${relationshipTable}.relationship_type`, '=', config.relationshipType)
      .where(`${relationshipTable}.target_entity_type`, '=', config.targetEntityType)
      .where(`${relationshipTable}.valid_until`, 'is', null);

    const result = await query.executeTakeFirst();
    return Number(result?.sum || 0);
  }

  private async calculateAverage(
    kysely: Kysely<any>,
    relationshipTable: string,
    targetTable: string,
    config: RollupFieldConfig,
    sourceEntityId: string
  ): Promise<number> {
    if (!config.targetField) return 0;

    let query = kysely
      .selectFrom(relationshipTable)
      .innerJoin(targetTable, `${targetTable}.id`, `${relationshipTable}.target_entity_id`)
      .select(sql`AVG(${sql.ref(targetTable + '.' + config.targetField)})`.as('average'))
      .where(`${relationshipTable}.source_entity_type`, '=', config.entityName)
      .where(`${relationshipTable}.source_entity_id`, '=', sourceEntityId)
      .where(`${relationshipTable}.relationship_type`, '=', config.relationshipType)
      .where(`${relationshipTable}.target_entity_type`, '=', config.targetEntityType)
      .where(`${relationshipTable}.valid_until`, 'is', null);

    const result = await query.executeTakeFirst();
    return Number(result?.average || 0);
  }

  private async calculateConcat(
    kysely: Kysely<any>,
    relationshipTable: string,
    targetTable: string,
    config: RollupFieldConfig,
    sourceEntityId: string
  ): Promise<string> {
    if (!config.targetField) return '';

    const separator = config.separator || ', ';
    
    let query = kysely
      .selectFrom(relationshipTable)
      .innerJoin(targetTable, `${targetTable}.id`, `${relationshipTable}.target_entity_id`)
      .select(sql`STRING_AGG(${sql.ref(targetTable + '.' + config.targetField)}, ${separator})`.as('concatenated'))
      .where(`${relationshipTable}.source_entity_type`, '=', config.entityName)
      .where(`${relationshipTable}.source_entity_id`, '=', sourceEntityId)
      .where(`${relationshipTable}.relationship_type`, '=', config.relationshipType)
      .where(`${relationshipTable}.target_entity_type`, '=', config.targetEntityType)
      .where(`${relationshipTable}.valid_until`, 'is', null);

    const result = await query.executeTakeFirst();
    return String(result?.concatenated || '');
  }

  // Private helper methods

  private async storeRollupConfig(orgId: string, config: RollupFieldConfig): Promise<void> {
    // Store in a dedicated rollup configurations table
    // This would be implemented based on your schema needs
    console.log(`Storing rollup config for ${config.entityName}.${config.fieldName}`);
  }

  private async getRollupConfigs(
    kysely: Kysely<any>, 
    orgId: string, 
    entityName: string
  ): Promise<RollupFieldConfig[]> {
    // Retrieve rollup configurations from database
    // This would query your rollup configs table
    return [];
  }

  private async getRollupConfigsByRelationship(
    kysely: Kysely<any>,
    orgId: string,
    entityType: string,
    relationshipType: string,
    targetEntityType: string
  ): Promise<RollupFieldConfig[]> {
    // Find rollup configs that depend on this specific relationship
    return [];
  }

  private async getRollupConfigsByTargetField(
    kysely: Kysely<any>,
    orgId: string,
    targetEntityType: string,
    targetField: string
  ): Promise<RollupFieldConfig[]> {
    // Find rollup configs that aggregate this target field
    return [];
  }
}