/**
 * Computed Field Engine Service
 * 
 * Manages calculation and updates of computed fields based on expressions and dependencies.
 * Integrates with the existing field system and RollupEngine for comprehensive computed field support.
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { getFieldHandler } from '../fields';
import type { FieldDefinition } from '../types';
import type { ComputedFieldConfig } from '../fields/computed_formula';
import type { ComputedExpressionConfig } from '../fields/computed_expression';
import { EntityManager } from '../entity-operations/EntityManager';
import { ExpressionEvaluator } from './ExpressionEvaluator';

export interface ComputedFieldConfiguration {
  entityName: string;
  fieldName: string;
  fieldType: 'computed_formula' | 'computed_expression';
  expression: string;
  dependencies: string[];
  computeLocation: 'backend' | 'frontend' | 'hybrid';
  resultType: 'number' | 'text' | 'boolean' | 'date' | 'json';
  refreshTriggers: string[];
  cacheResults: boolean;
  lastCalculated?: Date;
  calculationError?: string;
}

export class ComputedFieldEngine {
  private entityManager: EntityManager;
  private expressionEvaluator: ExpressionEvaluator;
  
  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
    this.expressionEvaluator = new ExpressionEvaluator();
  }

  /**
   * Get computed field configuration by field name
   */
  async getComputedFieldConfig(
    kysely: Kysely<any>,
    orgId: string,
    entityName: string,
    fieldName: string
  ): Promise<ComputedFieldConfiguration | null> {
    const configs = await this.getComputedFieldConfigs(kysely, orgId, entityName);
    return configs.find(config => config.fieldName === fieldName) || null;
  }

  /**
   * Store calculation history for debugging and monitoring
   */
  async storeCalculationHistory(
    kysely: Kysely<any>,
    orgId: string,
    config: ComputedFieldConfiguration,
    entityId: string,
    value: any,
    error?: string,
    durationMs?: number,
    context?: Record<string, any>
  ): Promise<void> {
    // Get the computed field ID first
    const fieldConfig = await kysely
      .selectFrom('dataforge_computed_fields')
      .select('id')
      .where('org_id', '=', orgId)
      .where('entity_type', '=', config.entityName)
      .where('field_name', '=', config.fieldName)
      .executeTakeFirst();

    if (fieldConfig) {
      await kysely
        .insertInto('dataforge_computed_field_calculations')
        .values({
          computed_field_id: fieldConfig.id,
          entity_id: entityId,
          calculated_value: JSON.stringify(value),
          calculation_error: error || null,
          calculation_duration_ms: durationMs || null,
          context_snapshot: context ? JSON.stringify(context) : null
        })
        .execute();
    }
  }

  /**
   * Register computed fields for an entity based on its field definitions
   */
  async registerComputedFields(
    orgId: string, 
    entityName: string, 
    fieldDefinitions: Map<string, FieldDefinition>
  ): Promise<ComputedFieldConfiguration[]> {
    const computedConfigs: ComputedFieldConfiguration[] = [];

    for (const [fieldName, fieldDef] of fieldDefinitions) {
      const handler = getFieldHandler(fieldDef.type);
      if (handler && 'isComputedField' in handler && handler.isComputedField()) {
        const config = this.createComputedConfig(entityName, fieldName, fieldDef);
        if (config) {
          computedConfigs.push(config);
          
          // Store computed field configuration in database for persistence
          await this.storeComputedFieldConfig(orgId, config);
        }
      }
    }

    return computedConfigs;
  }

  /**
   * Calculate computed field value for a specific field
   */
  async calculateComputedField(
    kysely: Kysely<any>,
    orgId: string,
    config: ComputedFieldConfiguration,
    entityId: string,
    entityData?: Record<string, any>
  ): Promise<{ value: any; error?: string }> {
    try {
      // Get entity data if not provided
      if (!entityData) {
        entityData = await this.getEntityData(kysely, orgId, config.entityName, entityId);
      }

      // Build computation context
      const context = await this.buildComputationContext(kysely, orgId, config, entityId, entityData);
      
      // Evaluate expression based on field type
      let result: any;
      switch (config.fieldType) {
        case 'computed_expression':
          result = await this.evaluateSimpleExpression(config.expression, context);
          break;
        case 'computed_formula':
          result = await this.evaluateComplexFormula(config.expression, context, config);
          break;
        default:
          throw new Error(`Unknown computed field type: ${config.fieldType}`);
      }

      // Type conversion based on result type
      const typedResult = this.convertToResultType(result, config.resultType);
      
      return { value: typedResult };
    } catch (error) {
      console.error(`Error calculating computed field ${config.fieldName}:`, error);
      return { 
        value: null, 
        error: error instanceof Error ? error.message : 'Unknown calculation error' 
      };
    }
  }

  /**
   * Update computed field value in the database
   */
  async updateComputedField(
    kysely: Kysely<any>,
    orgId: string,
    entityName: string,
    entityId: string,
    fieldName: string,
    value: any,
    error?: string
  ): Promise<void> {
    const tableName = `org_${orgId.replace(/-/g, '_')}_${entityName.toLowerCase()}`;
    
    const updateData: any = { 
      [fieldName]: value, 
      updated_at: new Date() 
    };

    await kysely
      .updateTable(tableName)
      .set(updateData)
      .where('id', '=', entityId)
      .execute();

    // Update calculation metadata
    await this.updateCalculationMetadata(kysely, orgId, entityName, fieldName, error);
  }

  /**
   * Refresh all computed fields for an entity record
   */
  async refreshEntityComputedFields(
    kysely: Kysely<any>,
    orgId: string,
    entityName: string,
    entityId: string
  ): Promise<void> {
    const computedConfigs = await this.getComputedFieldConfigs(kysely, orgId, entityName);
    
    // Get entity data once for all calculations
    const entityData = await this.getEntityData(kysely, orgId, entityName, entityId);
    
    for (const config of computedConfigs) {
      const result = await this.calculateComputedField(kysely, orgId, config, entityId, entityData);
      await this.updateComputedField(
        kysely, orgId, entityName, entityId, config.fieldName, result.value, result.error
      );
    }
  }

  /**
   * Handle field changes that affect computed fields
   */
  async onFieldChange(
    kysely: Kysely<any>,
    orgId: string,
    entityType: string,
    entityId: string,
    changedField: string,
    newValue: any
  ): Promise<void> {
    // Find all computed fields that depend on this field
    const affectedConfigs = await this.getComputedFieldsByDependency(
      kysely, orgId, entityType, changedField
    );

    // Update affected computed fields
    for (const config of affectedConfigs) {
      await this.refreshEntityComputedFields(kysely, orgId, config.entityName, entityId);
    }
  }

  // Private helper methods

  private createComputedConfig(
    entityName: string,
    fieldName: string, 
    fieldDef: FieldDefinition
  ): ComputedFieldConfiguration | null {
    const handler = getFieldHandler(fieldDef.type);
    if (!handler || !('getComputedConfig' in handler)) return null;

    const config = handler.getComputedConfig(fieldDef);
    if (!config) return null;

    // Handle different config types
    if (fieldDef.type === 'computed_formula') {
      const formulaConfig = config as ComputedFieldConfig;
      return {
        entityName,
        fieldName,
        fieldType: 'computed_formula',
        expression: formulaConfig.expression,
        dependencies: formulaConfig.dependencies || [],
        computeLocation: formulaConfig.computeLocation,
        resultType: formulaConfig.resultType,
        refreshTriggers: formulaConfig.refreshTriggers,
        cacheResults: formulaConfig.cacheResults
      };
    } else if (fieldDef.type === 'computed_expression') {
      const exprConfig = config as ComputedExpressionConfig;
      return {
        entityName,
        fieldName,
        fieldType: 'computed_expression',
        expression: exprConfig.expression,
        dependencies: exprConfig.dependencies || [],
        computeLocation: 'backend', // Simple expressions default to backend
        resultType: 'number', // Simple expressions default to number
        refreshTriggers: [],
        cacheResults: true
      };
    }

    return null;
  }

  private async buildComputationContext(
    kysely: Kysely<any>,
    orgId: string,
    config: ComputedFieldConfiguration,
    entityId: string,
    entityData: Record<string, any>
  ): Promise<Record<string, any>> {
    const context: Record<string, any> = {
      // Current entity data
      ...entityData,
      
      // System values
      $entityId: entityId,
      $orgId: orgId,
      $now: new Date(),
      $today: new Date().toDateString()
    };

    // Add dependency values
    for (const dependency of config.dependencies) {
      if (dependency.includes('.')) {
        // Handle nested/related field dependencies
        context[dependency] = await this.resolveNestedDependency(
          kysely, orgId, dependency, entityId
        );
      } else {
        // Simple field dependency
        context[dependency] = entityData[dependency];
      }
    }

    return context;
  }

  private async evaluateSimpleExpression(expression: string, context: Record<string, any>): Promise<any> {
    // Use the ExpressionEvaluator for safe expression evaluation
    const result = this.expressionEvaluator.evaluate(expression, context);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result.value;
  }

  private async evaluateComplexFormula(
    expression: string, 
    context: Record<string, any>,
    config: ComputedFieldConfiguration
  ): Promise<any> {
    // This would integrate with a proper formula engine (like the planned UltraTable one)
    // For now, fall back to simple expression evaluation
    return this.evaluateSimpleExpression(expression, context);
  }

  private convertToResultType(value: any, resultType: string): any {
    switch (resultType) {
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'text':
        return String(value);
      case 'date':
        return new Date(value);
      case 'json':
        return typeof value === 'object' ? value : JSON.parse(String(value));
      default:
        return value;
    }
  }

  private async getEntityData(
    kysely: Kysely<any>,
    orgId: string,
    entityName: string,
    entityId: string
  ): Promise<Record<string, any>> {
    const tableName = `org_${orgId.replace(/-/g, '_')}_${entityName.toLowerCase()}`;
    
    const result = await kysely
      .selectFrom(tableName)
      .selectAll()
      .where('id', '=', entityId)
      .executeTakeFirst();
      
    return result || {};
  }

  private async resolveNestedDependency(
    kysely: Kysely<any>,
    orgId: string,
    dependency: string,
    entityId: string
  ): Promise<any> {
    // Handle nested dependencies like "related.project.budget"
    // This would integrate with the relationship system
    // For now, return null as placeholder
    return null;
  }

  // Database storage methods

  private async storeComputedFieldConfig(orgId: string, config: ComputedFieldConfiguration): Promise<void> {
    const kysely = this.entityManager.getKysely();
    
    await kysely
      .insertInto('dataforge_computed_fields')
      .values({
        org_id: orgId,
        entity_type: config.entityName,
        field_name: config.fieldName,
        field_type: config.fieldType,
        expression: config.expression,
        dependencies: JSON.stringify(config.dependencies),
        compute_location: config.computeLocation,
        result_type: config.resultType,
        refresh_triggers: JSON.stringify(config.refreshTriggers),
        cache_results: config.cacheResults,
        is_active: true
      })
      .onConflict((oc) => oc
        .columns(['org_id', 'entity_type', 'field_name'])
        .doUpdateSet({
          expression: (eb) => eb.ref('excluded.expression'),
          dependencies: (eb) => eb.ref('excluded.dependencies'),
          compute_location: (eb) => eb.ref('excluded.compute_location'),
          result_type: (eb) => eb.ref('excluded.result_type'),
          refresh_triggers: (eb) => eb.ref('excluded.refresh_triggers'),
          cache_results: (eb) => eb.ref('excluded.cache_results'),
          updated_at: new Date()
        })
      )
      .execute();
  }

  private async getComputedFieldConfigs(
    kysely: Kysely<any>,
    orgId: string,
    entityName: string
  ): Promise<ComputedFieldConfiguration[]> {
    const rows = await kysely
      .selectFrom('dataforge_computed_fields')
      .selectAll()
      .where('org_id', '=', orgId)
      .where('entity_type', '=', entityName)
      .where('is_active', '=', true)
      .execute();

    return rows.map(row => ({
      entityName: row.entity_type,
      fieldName: row.field_name,
      fieldType: row.field_type as 'computed_formula' | 'computed_expression',
      expression: row.expression,
      dependencies: JSON.parse(row.dependencies as string) || [],
      computeLocation: row.compute_location as 'backend' | 'frontend' | 'hybrid',
      resultType: row.result_type as 'number' | 'text' | 'boolean' | 'date' | 'json',
      refreshTriggers: JSON.parse(row.refresh_triggers as string) || [],
      cacheResults: row.cache_results,
      lastCalculated: row.last_calculated ? new Date(row.last_calculated) : undefined,
      calculationError: row.calculation_error || undefined
    }));
  }

  private async getComputedFieldsByDependency(
    kysely: Kysely<any>,
    orgId: string,
    entityType: string,
    fieldName: string
  ): Promise<ComputedFieldConfiguration[]> {
    // Find computed fields that have this field in their dependencies
    const rows = await kysely
      .selectFrom('dataforge_computed_fields as cf')
      .selectAll()
      .where('cf.org_id', '=', orgId)
      .where('cf.is_active', '=', true)
      .where(
        kysely.fn('json_array_contains', ['cf.dependencies', JSON.stringify(fieldName)]), '=', true
      )
      .execute();

    return rows.map(row => ({
      entityName: row.entity_type,
      fieldName: row.field_name,
      fieldType: row.field_type as 'computed_formula' | 'computed_expression',
      expression: row.expression,
      dependencies: JSON.parse(row.dependencies as string) || [],
      computeLocation: row.compute_location as 'backend' | 'frontend' | 'hybrid',
      resultType: row.result_type as 'number' | 'text' | 'boolean' | 'date' | 'json',
      refreshTriggers: JSON.parse(row.refresh_triggers as string) || [],
      cacheResults: row.cache_results,
      lastCalculated: row.last_calculated ? new Date(row.last_calculated) : undefined,
      calculationError: row.calculation_error || undefined
    }));
  }

  private async updateCalculationMetadata(
    kysely: Kysely<any>,
    orgId: string,
    entityName: string,
    fieldName: string,
    error?: string
  ): Promise<void> {
    await kysely
      .updateTable('dataforge_computed_fields')
      .set({
        last_calculated: new Date(),
        calculation_error: error || null,
        updated_at: new Date()
      })
      .where('org_id', '=', orgId)
      .where('entity_type', '=', entityName)
      .where('field_name', '=', fieldName)
      .execute();
  }
}