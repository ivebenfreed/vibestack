/**
 * BulkOperationsManager - Handles bulk operations
 * 
 * Manages bulk create, update, and delete operations for records.
 * Delegates to BulkOperationsService for actual implementation.
 */

import type { FieldDefinition } from '../json-rules-engine';
import type { OrgEntityDefinition } from '../org-entity-schema';
import { BulkOperationsService, type BulkCreateOptions, type BulkCreateResult, type BulkUpdateResult, type BulkDeleteResult } from '../BulkOperationsService';

export interface DataForgeEntityManagerConfig {
  kysely: any; // Kysely instance
  rulesEngine?: any; // JsonRulesEngine instance  
  env?: any; // Cloudflare environment
}

export class BulkOperationsManager {
  private config: DataForgeEntityManagerConfig;
  private configCache: Map<string, OrgEntityDefinition>;
  private bulkOperationsService: BulkOperationsService;
  private entityManager: any;

  constructor(config: DataForgeEntityManagerConfig, configCache: Map<string, OrgEntityDefinition>, entityManager: any) {
    this.config = config;
    this.configCache = configCache;
    this.entityManager = entityManager;
    
    // Initialize bulk operations service
    this.bulkOperationsService = new BulkOperationsService({
      kysely: config.kysely,
      rulesEngine: config.rulesEngine,
      getEntityConfig: this.getEntityConfig.bind(this),
      saveEntityData: this.saveEntityData.bind(this)
    });
  }

  /**
   * Get entity configuration (needed by BulkOperationsService)
   */
  async getEntityConfig(orgId: string, entityName: string): Promise<any> {
    try {
      // Import EntityNameUtils for consistent name normalization
      const { EntityNameUtils } = await import('@/lib/entity-name-utils');
      
      // Normalize entity name to PascalCase for database lookup
      const normalizedEntityName = EntityNameUtils.toPascalCase(entityName);
      
      // Check cache first
      const cacheKey = `${orgId}:${normalizedEntityName}`;
      if (this.configCache.has(cacheKey)) {
        const cached = this.configCache.get(cacheKey);
        return {
          tableName: cached?.table_name,
          entityName: cached?.entity_name,
          archetype: cached?.archetype,
          orgId: orgId
        };
      }
      
      console.log(`[BulkOperationsManager] Getting entity config: ${normalizedEntityName} (original: ${entityName}) for org: ${orgId}`);
      
      // Get entity from entity_schemas table
      const entity = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
          .selectFrom('entity_schemas')
          .select(['entity_name', 'table_name', 'archetype', 'business_metadata'])
          .where('org_id', '=', orgId)
          .where('entity_name', '=', normalizedEntityName)
          .where('deleted', '!=', true)
          .executeTakeFirst();
      });

      if (!entity) {
        console.log(`[BulkOperationsManager] Entity ${normalizedEntityName} not found for org ${orgId}`);
        return null;
      }

      // Cache the result
      this.configCache.set(cacheKey, {
        entity_name: entity.entity_name,
        table_name: entity.table_name,
        archetype: entity.archetype,
        business_metadata: entity.business_metadata
      });

      // Return configuration object for bulk operations
      return {
        tableName: entity.table_name,
        entityName: entity.entity_name,
        archetype: entity.archetype,
        orgId: orgId
      };
    } catch (error) {
      console.error(`[BulkOperationsManager] Error getting entity config:`, error);
      return null;
    }
  }

  /**
   * Save entity data (needed by BulkOperationsService)
   */
  async saveEntityData(orgId: string, entityName: string, data: Record<string, any>): Promise<any> {
    // This is a legacy method that should delegate to createRecord
    // For bulk operations, this might be called per record, but the BulkOperationsService
    // should handle the actual bulk logic
    console.warn('[BulkOperationsManager] saveEntityData called - this should be handled by BulkOperationsService directly');
    return { success: false, error: 'Use bulk-specific methods instead' };
  }

  /**
   * Bulk create multiple records for an entity
   */
  async bulkCreateRecords(
    orgId: string,
    entityName: string,
    records: any[],
    options: BulkCreateOptions = {}
  ): Promise<BulkCreateResult> {
    try {
      console.log(`[BulkOperationsManager] Bulk creating ${records.length} records for entity: ${entityName}`);
      return await this.bulkOperationsService.bulkCreateRecords(orgId, entityName, records, options);
    } catch (error) {
      console.error(`[BulkOperationsManager] Error in bulk create:`, error);
      return {
        success: false,
        errors: [`Failed to bulk create records: ${error instanceof Error ? error.message : 'Unknown error'}`],
        results: [],
        successCount: 0,
        errorCount: records.length
      };
    }
  }

  /**
   * Bulk update records matching a filter
   */
  async bulkUpdateRecords(
    orgId: string,
    entityName: string,
    updates: any[],
    options: any = {}
  ): Promise<BulkUpdateResult> {
    try {
      console.log(`[BulkOperationsManager] Bulk updating records for entity: ${entityName}`);
      
      // Convert to the format expected by BulkOperationsService
      // If updates is an array of {id, data} objects, handle appropriately
      if (Array.isArray(updates) && updates.length > 0) {
        // For array of updates, we need to call the service method that can handle individual updates
        const results: any[] = [];
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const update of updates) {
          try {
            if (update.id && update.data) {
              // This would need to be implemented in BulkOperationsService
              // For now, we'll use a placeholder approach
              const result = await this.bulkOperationsService.bulkUpdateRecords(
                orgId, 
                entityName, 
                { id: update.id }, 
                update.data
              );
              results.push(result);
              if (result.success) {
                successCount += result.affectedCount || 0;
              } else {
                errorCount++;
                errors.push(...(result.errors || []));
              }
            }
          } catch (error) {
            errorCount++;
            errors.push(`Failed to update record ${update.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return {
          success: errorCount === 0,
          affectedCount: successCount,
          errors,
          successCount,
          errorCount
        };
      } else {
        // Fallback to treating as filter/updates pattern
        const filter = options.filter || {};
        const updateData = updates;
        return await this.bulkOperationsService.bulkUpdateRecords(orgId, entityName, filter, updateData);
      }
    } catch (error) {
      console.error(`[BulkOperationsManager] Error in bulk update:`, error);
      return {
        success: false,
        errors: [`Failed to bulk update records: ${error instanceof Error ? error.message : 'Unknown error'}`],
        affectedCount: 0,
        successCount: 0,
        errorCount: Array.isArray(updates) ? updates.length : 1
      };
    }
  }

  /**
   * Bulk delete records
   */
  async bulkDeleteRecords(
    orgId: string,
    entityName: string,
    recordIds: string[],
    options: any = {}
  ): Promise<BulkDeleteResult> {
    try {
      console.log(`[BulkOperationsManager] Bulk deleting ${recordIds.length} records for entity: ${entityName}`);
      
      const permanent = options.permanent || false;
      const filter = { id: { in: recordIds } };
      
      return await this.bulkOperationsService.bulkDeleteRecords(orgId, entityName, filter, permanent);
    } catch (error) {
      console.error(`[BulkOperationsManager] Error in bulk delete:`, error);
      return {
        success: false,
        errors: [`Failed to bulk delete records: ${error instanceof Error ? error.message : 'Unknown error'}`],
        affectedCount: 0,
        successCount: 0,
        errorCount: recordIds.length
      };
    }
  }
}