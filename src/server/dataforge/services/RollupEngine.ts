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
import { ExpressionEvaluator } from './ExpressionEvaluator';

export interface RollupFieldConfig {
  entityName: string;
  fieldName: string;
  type: 'count' | 'sum' | 'average' | 'concat' | 'computed_expression';
  relationshipType: string;
  targetEntityType: string;
  targetField?: string; // For sum, average, concat
  separator?: string; // For concat
  conditions?: Record<string, any>; // Additional filters
  expression?: string; // For computed_expression rollups
  computationContext?: Record<string, any>; // Additional context for expressions
}

export class RollupEngine {
  private config: { kysely: any };
  private expressionEvaluator: ExpressionEvaluator;
  
  constructor(manager: { config: { kysely: any } }) {
    this.config = manager.config;
    this.expressionEvaluator = new ExpressionEvaluator();
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
        
        case 'computed_expression':
          return await this.calculateComputedExpression(kysely, relationshipTable, targetTable, config, sourceEntityId);
        
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

  private async calculateComputedExpression(
    kysely: Kysely<any>,
    relationshipTable: string,
    targetTable: string,
    config: RollupFieldConfig,
    sourceEntityId: string
  ): Promise<any> {
    if (!config.expression) {
      console.warn(`No expression provided for computed rollup ${config.fieldName}`);
      return null;
    }

    try {
      // Get all related target entities
      const relatedEntities = await kysely
        .selectFrom(relationshipTable)
        .innerJoin(targetTable, `${targetTable}.id`, `${relationshipTable}.target_entity_id`)
        .selectAll(targetTable)
        .where(`${relationshipTable}.source_entity_type`, '=', config.entityName)
        .where(`${relationshipTable}.source_entity_id`, '=', sourceEntityId)
        .where(`${relationshipTable}.relationship_type`, '=', config.relationshipType)
        .where(`${relationshipTable}.target_entity_type`, '=', config.targetEntityType)
        .where(`${relationshipTable}.valid_until`, 'is', null)
        .execute();

      // Build computation context with aggregated data
      const context: Record<string, any> = {
        // Related entities data
        entities: relatedEntities,
        count: relatedEntities.length,
        
        // Common aggregations for easy access
        sum: (field: string) => relatedEntities.reduce((total, entity) => total + (Number(entity[field]) || 0), 0),
        avg: (field: string) => {
          const sum = relatedEntities.reduce((total, entity) => total + (Number(entity[field]) || 0), 0);
          return relatedEntities.length > 0 ? sum / relatedEntities.length : 0;
        },
        max: (field: string) => Math.max(...relatedEntities.map(entity => Number(entity[field]) || 0)),
        min: (field: string) => Math.min(...relatedEntities.map(entity => Number(entity[field]) || 0)),
        
        // Source entity context
        $sourceEntityId: sourceEntityId,
        $entityCount: relatedEntities.length,
        $now: new Date(),
        $today: new Date().toDateString(),
        
        // Additional computation context if provided
        ...config.computationContext
      };

      // Evaluate the expression
      const result = this.expressionEvaluator.evaluate(config.expression, context);
      
      if (result.error) {
        console.error(`Computed rollup expression error for ${config.fieldName}:`, result.error);
        return null;
      }

      return result.value;
    } catch (error) {
      console.error(`Error in computed rollup calculation for ${config.fieldName}:`, error);
      return null;
    }
  }

  // Private helper methods

  private async storeRollupConfig(orgId: string, config: RollupFieldConfig): Promise<void> {
    try {
      await this.config.kysely
        .insertInto('dataforge_rollup_fields')
        .values({
          org_id: orgId,
          entity_name: config.entityName,
          field_name: config.fieldName,
          rollup_type: config.type,
          relationship_type: config.relationshipType,
          target_entity_type: config.targetEntityType,
          target_field: config.targetField || null,
          separator: config.separator || null,
          conditions: JSON.stringify(config.conditions || {}),
          expression: config.expression || null,
          computation_context: JSON.stringify(config.computationContext || {}),
          created_at: new Date(),
          updated_at: new Date()
        })
        .onConflict((oc) => oc
          .columns(['org_id', 'entity_name', 'field_name'])
          .doUpdateSet({
            rollup_type: config.type,
            relationship_type: config.relationshipType,
            target_entity_type: config.targetEntityType,
            target_field: config.targetField || null,
            separator: config.separator || null,
            conditions: JSON.stringify(config.conditions || {}),
            expression: config.expression || null,
            computation_context: JSON.stringify(config.computationContext || {}),
            updated_at: new Date()
          })
        )
        .execute();
      
      console.log(`✅ Stored rollup config for ${config.entityName}.${config.fieldName}`);
    } catch (error) {
      console.error(`Failed to store rollup config for ${config.entityName}.${config.fieldName}:`, error);
      throw error;
    }
  }

  private async getRollupConfigs(
    kysely: Kysely<any>, 
    orgId: string, 
    entityName: string
  ): Promise<RollupFieldConfig[]> {
    try {
      const configs = await kysely
        .selectFrom('dataforge_rollup_fields')
        .selectAll()
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .execute();

      return configs.map((config: any) => ({
        entityName: config.entity_name,
        fieldName: config.field_name,
        type: config.rollup_type as any,
        relationshipType: config.relationship_type,
        targetEntityType: config.target_entity_type,
        targetField: config.target_field,
        separator: config.separator,
        conditions: config.conditions ? JSON.parse(config.conditions) : {},
        expression: config.expression,
        computationContext: config.computation_context ? JSON.parse(config.computation_context) : {}
      }));
    } catch (error) {
      console.error(`Failed to get rollup configs for ${entityName}:`, error);
      return [];
    }
  }

  private async getRollupConfigsByRelationship(
    kysely: Kysely<any>,
    orgId: string,
    entityType: string,
    relationshipType: string,
    targetEntityType: string
  ): Promise<RollupFieldConfig[]> {
    try {
      const configs = await kysely
        .selectFrom('dataforge_rollup_fields')
        .selectAll()
        .where('org_id', '=', orgId)
        .where('relationship_type', '=', relationshipType)
        .where('target_entity_type', '=', targetEntityType)
        .execute();

      return configs.map((config: any) => ({
        entityName: config.entity_name,
        fieldName: config.field_name,
        type: config.rollup_type as any,
        relationshipType: config.relationship_type,
        targetEntityType: config.target_entity_type,
        targetField: config.target_field,
        separator: config.separator,
        conditions: config.conditions ? JSON.parse(config.conditions) : {},
        expression: config.expression,
        computationContext: config.computation_context ? JSON.parse(config.computation_context) : {}
      }));
    } catch (error) {
      console.error(`Failed to get rollup configs by relationship:`, error);
      return [];
    }
  }

  private async getRollupConfigsByTargetField(
    kysely: Kysely<any>,
    orgId: string,
    targetEntityType: string,
    targetField: string
  ): Promise<RollupFieldConfig[]> {
    try {
      const configs = await kysely
        .selectFrom('dataforge_rollup_fields')
        .selectAll()
        .where('org_id', '=', orgId)
        .where('target_entity_type', '=', targetEntityType)
        .where('target_field', '=', targetField)
        .execute();

      return configs.map((config: any) => ({
        entityName: config.entity_name,
        fieldName: config.field_name,
        type: config.rollup_type as any,
        relationshipType: config.relationship_type,
        targetEntityType: config.target_entity_type,
        targetField: config.target_field,
        separator: config.separator,
        conditions: config.conditions ? JSON.parse(config.conditions) : {},
        expression: config.expression,
        computationContext: config.computation_context ? JSON.parse(config.computation_context) : {}
      }));
    } catch (error) {
      console.error(`Failed to get rollup configs by target field:`, error);
      return [];
    }
  }
}