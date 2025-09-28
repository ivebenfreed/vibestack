/**
 * ComputedFieldsManager - Handles computed field operations
 * 
 * Manages computed fields and rollup operations for entities.
 * Coordinates between ComputedFieldEngine and RollupEngine.
 */

import type { FieldDefinition } from '../json-rules-engine';
import type { OrgEntityDefinition } from '../org-entity-schema';
import { ComputedFieldEngine } from '../services/ComputedFieldEngine';
import { RollupEngine } from '../services/RollupEngine';

export interface DataForgeEntityManagerConfig {
  kysely: any; // Kysely instance
  rulesEngine?: any; // JsonRulesEngine instance  
  env?: any; // Cloudflare environment
}

export class ComputedFieldsManager {
  private config: DataForgeEntityManagerConfig;
  private configCache: Map<string, OrgEntityDefinition>;
  private computedFieldEngine: ComputedFieldEngine;
  private rollupEngine: RollupEngine;
  private entityManager: any; // EntityManager instance for withKysely access

  constructor(config: DataForgeEntityManagerConfig, configCache: Map<string, OrgEntityDefinition>, entityManager: any) {
    this.config = config;
    this.configCache = configCache;
    this.entityManager = entityManager;
    
    // Initialize computed field engine (needs a reference to parent EntityManager)
    // For now, we'll pass 'this' but this would need the full EntityManager
    this.computedFieldEngine = new ComputedFieldEngine(this as any);
    
    // Initialize rollup engine (also needs EntityManager reference)
    this.rollupEngine = new RollupEngine(this as any);
  }

  /**
   * Refresh computed fields for a specific entity record
   */
  async refreshComputedFields(orgId: string, entityName: string, entityId: string): Promise<void> {
    try {
      console.log(`[ComputedFieldsManager] Refreshing computed fields for ${entityName}:${entityId}`);
      
      // Refresh both computed fields and rollup fields
      await Promise.all([
        await this.entityManager.withKysely(async (kysely) => {
          return await this.computedFieldEngine.refreshEntityComputedFields(kysely, orgId, entityName, entityId);
        }),
        await this.entityManager.withKysely(async (kysely) => {
          return await this.rollupEngine.refreshEntityRollups(kysely, orgId, entityName, entityId);
        })
      ]);
      
      console.log(`[ComputedFieldsManager] Completed computed field refresh for ${entityName}:${entityId}`);
    } catch (error) {
      console.error(`[ComputedFieldsManager] Error refreshing computed fields:`, error);
      throw error; // Let caller handle the error
    }
  }

  /**
   * Handle field changes that may affect computed fields
   */
  async onFieldChange(orgId: string, entityType: string, entityId: string, changedField: string, newValue: any): Promise<void> {
    try {
      console.log(`[ComputedFieldsManager] Handling field change: ${entityType}:${entityId}.${changedField}`);
      
      // Notify both engines of the field change
      await Promise.all([
        await this.entityManager.withKysely(async (kysely) => {
          return await this.computedFieldEngine.onFieldChange(kysely, orgId, entityType, entityId, changedField, newValue);
        }),
        await this.entityManager.withKysely(async (kysely) => {
          return await this.rollupEngine.onTargetFieldChange(kysely, orgId, entityType, entityId, changedField);
        })
      ]);
      
      console.log(`[ComputedFieldsManager] Completed field change processing for ${entityType}:${entityId}.${changedField}`);
    } catch (error) {
      console.error(`[ComputedFieldsManager] Error handling field change:`, error);
      throw error; // Let caller handle the error
    }
  }

  /**
   * Get computed field engine for advanced operations
   */
  getComputedFieldEngine(): ComputedFieldEngine {
    return this.computedFieldEngine;
  }

  /**
   * Get rollup engine for advanced operations
   */
  getRollupEngine(): RollupEngine {
    return this.rollupEngine;
  }

  /**
   * Register computed fields for an entity (called during entity creation)
   */
  async registerComputedFields(orgId: string, entityName: string, fields: Map<string, any>): Promise<any[]> {
    try {
      console.log(`[ComputedFieldsManager] Registering computed fields for entity: ${entityName}`);
      
      const computedConfigs = await this.computedFieldEngine.registerComputedFields(
        orgId, 
        entityName, 
        fields
      );
      
      console.log(`[ComputedFieldsManager] Registered ${computedConfigs.length} computed fields for entity: ${entityName}`);
      return computedConfigs;
    } catch (error) {
      console.error(`[ComputedFieldsManager] Error registering computed fields:`, error);
      return [];
    }
  }

  /**
   * Register rollup fields for an entity (called during entity creation)
   */
  async registerRollupFields(orgId: string, entityName: string, fields: Map<string, any>): Promise<any[]> {
    try {
      console.log(`[ComputedFieldsManager] Registering rollup fields for entity: ${entityName}`);
      
      const rollupConfigs = await this.rollupEngine.registerRollupFields(
        orgId, 
        entityName, 
        fields
      );
      
      console.log(`[ComputedFieldsManager] Registered ${rollupConfigs.length} rollup fields for entity: ${entityName}`);
      return rollupConfigs;
    } catch (error) {
      console.error(`[ComputedFieldsManager] Error registering rollup fields:`, error);
      return [];
    }
  }

  /**
   * Refresh computed fields for all records of an entity type
   */
  async refreshAllComputedFields(orgId: string, entityName: string): Promise<void> {
    try {
      console.log(`[ComputedFieldsManager] Refreshing computed fields for all records of entity: ${entityName}`);
      
      // This would need to query all records and refresh each one
      // For now, we'll log the operation
      console.warn(`[ComputedFieldsManager] Batch computed field refresh not yet implemented for ${entityName}`);
    } catch (error) {
      console.error(`[ComputedFieldsManager] Error refreshing all computed fields:`, error);
      throw error;
    }
  }

  /**
   * Get computed field definitions for an entity
   */
  async getComputedFieldDefinitions(orgId: string, entityName: string): Promise<any[]> {
    try {
      console.log(`[ComputedFieldsManager] Getting computed field definitions for entity: ${entityName}`);
      
      // This would query computed field configurations
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`[ComputedFieldsManager] Error getting computed field definitions:`, error);
      return [];
    }
  }

  /**
   * Get rollup field definitions for an entity
   */
  async getRollupFieldDefinitions(orgId: string, entityName: string): Promise<any[]> {
    try {
      console.log(`[ComputedFieldsManager] Getting rollup field definitions for entity: ${entityName}`);
      
      // This would query rollup field configurations
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`[ComputedFieldsManager] Error getting rollup field definitions:`, error);
      return [];
    }
  }

  /**
   * Validate computed field expressions
   */
  async validateComputedFieldExpression(expression: string, fieldType: string): Promise<{ valid: boolean; errors: string[] }> {
    try {
      console.log(`[ComputedFieldsManager] Validating computed field expression: ${expression}`);
      
      // This would use the ComputedFieldEngine to validate expressions
      // For now, return basic validation
      if (!expression || expression.trim().length === 0) {
        return {
          valid: false,
          errors: ['Expression cannot be empty']
        };
      }
      
      return {
        valid: true,
        errors: []
      };
    } catch (error) {
      console.error(`[ComputedFieldsManager] Error validating computed field expression:`, error);
      return {
        valid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate rollup field configuration
   */
  async validateRollupFieldConfiguration(config: any): Promise<{ valid: boolean; errors: string[] }> {
    try {
      console.log(`[ComputedFieldsManager] Validating rollup field configuration:`, config);
      
      const errors: string[] = [];
      
      if (!config.sourceEntity) {
        errors.push('Source entity is required');
      }
      
      if (!config.sourceField) {
        errors.push('Source field is required');
      }
      
      if (!config.aggregationType) {
        errors.push('Aggregation type is required');
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error(`[ComputedFieldsManager] Error validating rollup field configuration:`, error);
      return {
        valid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Notify of schema changes that may affect computed fields
   */
  private notifySchemaChange(orgId: string, entityName: string, operation: 'create' | 'update' | 'delete'): void {
    console.log(`[ComputedFieldsManager] Schema change notification: ${operation} on ${orgId}.${entityName}`);
    
    // TODO: Integrate with WebSocket system to notify Legend State clients
    // This ensures Legend State invalidates caches and reloads computed field definitions
    // when schema changes occur that affect computed fields
  }
}