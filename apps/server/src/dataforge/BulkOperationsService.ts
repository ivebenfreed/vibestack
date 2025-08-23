/**
 * Bulk Operations Service
 * 
 * Handles bulk create, update, and delete operations for DataForge entities.
 * Provides efficient batch processing with proper validation and error handling.
 */

import type { Kysely } from 'kysely';
import type { HardcodedDatabase } from '../../base/hardcoded-database';
import type { JsonRulesEngine, EntityConfig } from '../../rules/json-rules-engine';

export interface BulkOperationsConfig {
  kysely: Kysely<HardcodedDatabase>;
  rulesEngine: JsonRulesEngine;
  getEntityConfig: (orgId: string, entityName: string) => Promise<EntityConfig | null>;
  saveEntityData: (orgId: string, entityName: string, data: any) => Promise<{ success: boolean; data?: any; errors?: string[] }>;
}

export interface BulkCreateOptions {
  validate?: boolean;
  atomic?: boolean;
}

export interface BulkCreateResult {
  success: boolean;
  created: Array<{ index: number; id: string; data: any }>;
  errors: Array<{ index: number; errors: string[]; record: any }>;
  summary: { total: number; created: number; failed: number };
}

export interface BulkUpdateResult {
  success: boolean;
  updated_count: number;
  updated_records: Array<{ id: string; name?: string; updated_at: string }>;
}

export interface BulkDeleteResult {
  success: boolean;
  deleted_count: number;
  deleted_records: Array<{ id: string; name?: string }>;
}

export class BulkOperationsService {
  constructor(private config: BulkOperationsConfig) {}

  /**
   * Bulk create multiple records for an entity
   */
  async bulkCreateRecords(
    orgId: string,
    entityName: string,
    records: any[],
    options: BulkCreateOptions = {}
  ): Promise<BulkCreateResult> {
    const results: Array<{ index: number; id: string; data: any }> = [];
    const errors: Array<{ index: number; errors: string[]; record: any }> = [];

    // Process each record using existing saveEntityData method
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        const result = await this.config.saveEntityData(orgId, entityName, record);
        
        if (result.success) {
          results.push({ index: i, id: result.data?.id, data: result.data });
        } else {
          errors.push({ index: i, errors: result.errors || ['Unknown error'], record });
          if (options.atomic) {
            // If atomic mode and any record fails, return error immediately
            return {
              success: false,
              created: [],
              errors: errors,
              summary: { total: records.length, created: 0, failed: errors.length }
            };
          }
        }
      } catch (recordError) {
        const errorMessage = recordError instanceof Error ? recordError.message : 'Unknown error';
        errors.push({ index: i, errors: [errorMessage], record });
        if (options.atomic) {
          return {
            success: false,
            created: [],
            errors: errors,
            summary: { total: records.length, created: 0, failed: errors.length }
          };
        }
      }
    }

    return {
      success: errors.length === 0,
      created: results,
      errors: errors,
      summary: {
        total: records.length,
        created: results.length,
        failed: errors.length
      }
    };
  }

  /**
   * Bulk update records matching a filter
   */
  async bulkUpdateRecords(
    orgId: string,
    entityName: string,
    filter: Record<string, any>,
    updates: Record<string, any>
  ): Promise<BulkUpdateResult> {
    // Get entity config to build proper query
    const config = await this.config.getEntityConfig(orgId, entityName);
    if (!config) {
      throw new Error(`Entity ${entityName} not found for org ${orgId}`);
    }

    // Build query using Kysely query builder
    let query = this.config.kysely
      .updateTable(config.tableName as any)
      .set({
        ...updates,
        updated_at: new Date().toISOString()
      } as any)
      .where('organization_id', '=', orgId);

    // Apply filters
    query = this.applyFiltersToQuery(query, filter);

    const result = await query
      .returning(['id', 'name', 'updated_at'])
      .execute();

    return {
      success: true,
      updated_count: result.length,
      updated_records: result.map((row: any) => ({
        id: row.id,
        name: row.name,
        updated_at: row.updated_at
      }))
    };
  }

  /**
   * Bulk delete records matching a filter
   */
  async bulkDeleteRecords(
    orgId: string,
    entityName: string,
    filter: Record<string, any>,
    permanent: boolean = false
  ): Promise<BulkDeleteResult> {
    // Get entity config to build proper query
    const config = await this.config.getEntityConfig(orgId, entityName);
    if (!config) {
      throw new Error(`Entity ${entityName} not found for org ${orgId}`);
    }

    let query: any;

    if (permanent) {
      // Hard delete
      query = this.config.kysely
        .deleteFrom(config.tableName as any)
        .where('organization_id', '=', orgId);
    } else {
      // Soft delete (update status to 'deleted')
      query = this.config.kysely
        .updateTable(config.tableName as any)
        .set({
          status: 'deleted',
          updated_at: new Date().toISOString()
        } as any)
        .where('organization_id', '=', orgId)
        .where('status', '!=', 'deleted');
    }

    // Apply filters
    query = this.applyFiltersToQuery(query, filter);

    const result = await query
      .returning(['id', 'name'])
      .execute();

    return {
      success: true,
      deleted_count: result.length,
      deleted_records: result.map((row: any) => ({
        id: row.id,
        name: row.name
      }))
    };
  }

  /**
   * Apply filter conditions to a Kysely query
   */
  private applyFiltersToQuery(query: any, filter: Record<string, any>): any {
    for (const [field, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null) {
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case 'contains':
              query = query.where(field as any, 'ilike', `%${operatorValue}%`);
              break;
            case 'gt':
              query = query.where(field as any, '>', operatorValue);
              break;
            case 'lt':
              query = query.where(field as any, '<', operatorValue);
              break;
            case 'gte':
              query = query.where(field as any, '>=', operatorValue);
              break;
            case 'lte':
              query = query.where(field as any, '<=', operatorValue);
              break;
            case 'in':
              const inValues = Array.isArray(operatorValue) ? operatorValue : [operatorValue];
              query = query.where(field as any, 'in', inValues);
              break;
            case 'not_in':
              const notInValues = Array.isArray(operatorValue) ? operatorValue : [operatorValue];
              query = query.where(field as any, 'not in', notInValues);
              break;
            case 'starts_with':
              query = query.where(field as any, 'ilike', `${operatorValue}%`);
              break;
            case 'ends_with':
              query = query.where(field as any, 'ilike', `%${operatorValue}`);
              break;
            case 'is_null':
              query = operatorValue ? query.where(field as any, 'is', null) : query.where(field as any, 'is not', null);
              break;
            case 'not':
              query = query.where(field as any, '!=', operatorValue);
              break;
          }
        }
      } else {
        query = query.where(field as any, '=', value);
      }
    }
    return query;
  }
}