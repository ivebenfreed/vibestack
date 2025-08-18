/**
 * Dynamic LiveStore Domain Services
 * 
 * Schema-aware domain services that adapt to organization-specific entity definitions.
 * This replaces static domain services with dynamic ones that work with changing schemas.
 */

import { nanoid } from 'nanoid';
import { orgSchemaClient, type OrgEntitySchema, type EntityDefinition, type FieldDefinition } from '@/lib/schema-client';
import { liveStoreSchemaClient, type LiveStoreInstance } from '@/lib/livestore-schema-client';

// Dynamic entity type (schema-agnostic)
export interface DynamicEntity {
  id: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  deletedAt?: string;
  // Dynamic fields populated based on entity schema
  [key: string]: any;
}

export interface DynamicEntityData {
  // Required fields only - dynamic fields are handled separately
  [key: string]: any;
}

export interface MutationResult<T = DynamicEntity> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: Record<string, string[]>;
}

export interface ValidationContext {
  orgId: string;
  entityName: string;
  schema: EntityDefinition;
  isUpdate?: boolean;
}

/**
 * Dynamic LiveStore Domain Service
 * 
 * Adapts to organization schemas and handles mutations on dynamic entities
 */
export class DynamicLiveStoreDomainService {
  private schemaCache = new Map<string, { schema: OrgEntitySchema; timestamp: number }>();
  private readonly SCHEMA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Create a dynamic entity with schema validation
   */
  async create(
    orgId: string, 
    entityName: string, 
    data: DynamicEntityData
  ): Promise<MutationResult> {
    try {
      // Load current schema
      const schemaContext = await this.getValidationContext(orgId, entityName);
      if (!schemaContext) {
        return {
          success: false,
          error: `Schema not found for entity '${entityName}' in organization '${orgId}'`
        };
      }

      // Validate data against schema
      const validation = await this.validateEntityData(data, schemaContext);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // Get LiveStore instance
      const liveStore = await this.getLiveStoreInstance(orgId);
      if (!liveStore) {
        return {
          success: false,
          error: `LiveStore not initialized for organization: ${orgId}`
        };
      }

      // Build complete entity with metadata
      const entity: DynamicEntity = {
        id: nanoid(),
        organizationId: orgId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: await this.getCurrentUserId(),
        ...validation.processedData
      };

      // Get table name from schema
      const tableName = this.getTableName(orgId, schemaContext.schema);

      // Execute LiveStore insert with schema-aware field mapping
      await this.executeDynamicInsert(liveStore, tableName, entity, schemaContext);

      console.log(`✅ [Dynamic] Created ${entityName}:`, entity.id);
      
      return {
        success: true,
        data: entity
      };

    } catch (error) {
      console.error(`❌ [Dynamic] Create ${entityName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update a dynamic entity with schema validation
   */
  async update(
    orgId: string,
    entityName: string, 
    id: string,
    updates: Partial<DynamicEntityData>
  ): Promise<MutationResult> {
    try {
      // Load current schema
      const schemaContext = await this.getValidationContext(orgId, entityName);
      if (!schemaContext) {
        return {
          success: false,
          error: `Schema not found for entity '${entityName}' in organization '${orgId}'`
        };
      }

      // Validate updates against schema
      const validation = await this.validateEntityData(updates, { 
        ...schemaContext, 
        isUpdate: true 
      });
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // Get LiveStore instance
      const liveStore = await this.getLiveStoreInstance(orgId);
      if (!liveStore) {
        return {
          success: false,
          error: `LiveStore not initialized for organization: ${orgId}`
        };
      }

      // Build update data with metadata
      const updateData = {
        ...validation.processedData,
        updatedAt: new Date().toISOString(),
        updatedBy: await this.getCurrentUserId()
      };

      // Get table name from schema
      const tableName = this.getTableName(orgId, schemaContext.schema);

      // Execute LiveStore update with schema-aware field mapping
      await this.executeDynamicUpdate(liveStore, tableName, id, updateData, schemaContext);

      console.log(`✅ [Dynamic] Updated ${entityName}:`, id);
      
      return {
        success: true,
        data: { id, ...updateData } as DynamicEntity
      };

    } catch (error) {
      console.error(`❌ [Dynamic] Update ${entityName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a dynamic entity
   */
  async delete(orgId: string, entityName: string, id: string): Promise<MutationResult> {
    try {
      // Load current schema
      const schemaContext = await this.getValidationContext(orgId, entityName);
      if (!schemaContext) {
        return {
          success: false,
          error: `Schema not found for entity '${entityName}' in organization '${orgId}'`
        };
      }

      // Get LiveStore instance
      const liveStore = await this.getLiveStoreInstance(orgId);
      if (!liveStore) {
        return {
          success: false,
          error: `LiveStore not initialized for organization: ${orgId}`
        };
      }

      // Get table name from schema
      const tableName = this.getTableName(orgId, schemaContext.schema);

      // Execute soft delete (add deletedAt timestamp)
      const deleteData = {
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: await this.getCurrentUserId()
      };

      await this.executeDynamicUpdate(liveStore, tableName, id, deleteData, schemaContext);

      console.log(`✅ [Dynamic] Deleted ${entityName}:`, id);
      
      return {
        success: true,
        data: { id, deletedAt: deleteData.deletedAt } as DynamicEntity
      };

    } catch (error) {
      console.error(`❌ [Dynamic] Delete ${entityName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find entity by ID with schema-aware field mapping
   */
  async findById(orgId: string, entityName: string, id: string): Promise<MutationResult> {
    try {
      const schemaContext = await this.getValidationContext(orgId, entityName);
      if (!schemaContext) {
        return {
          success: false,
          error: `Schema not found for entity '${entityName}' in organization '${orgId}'`
        };
      }

      const liveStore = await this.getLiveStoreInstance(orgId);
      if (!liveStore) {
        return {
          success: false,
          error: `LiveStore not initialized for organization: ${orgId}`
        };
      }

      const tableName = this.getTableName(orgId, schemaContext.schema);
      
      const results = await liveStore.query(`
        SELECT * FROM ${tableName} 
        WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
      `, [id, orgId]);

      const entity = results[0];
      if (!entity) {
        return {
          success: false,
          error: `${entityName} not found: ${id}`
        };
      }

      // Apply schema-aware field processing
      const processedEntity = await this.processEntityFromDatabase(entity, schemaContext);

      return {
        success: true,
        data: processedEntity
      };

    } catch (error) {
      console.error(`❌ [Dynamic] FindById ${entityName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find entities with dynamic filtering
   */
  async find(
    orgId: string, 
    entityName: string,
    filters?: Record<string, any>,
    orderBy?: string,
    limit?: number
  ): Promise<MutationResult<DynamicEntity[]>> {
    try {
      const schemaContext = await this.getValidationContext(orgId, entityName);
      if (!schemaContext) {
        return {
          success: false,
          error: `Schema not found for entity '${entityName}' in organization '${orgId}'`
        };
      }

      const liveStore = await this.getLiveStoreInstance(orgId);
      if (!liveStore) {
        return {
          success: false,
          error: `LiveStore not initialized for organization: ${orgId}`
        };
      }

      const tableName = this.getTableName(orgId, schemaContext.schema);
      
      // Build dynamic SQL query based on filters and schema
      const { sql, params } = this.buildDynamicQuery(
        tableName, 
        orgId, 
        filters, 
        orderBy, 
        limit,
        schemaContext
      );

      const results = await liveStore.query(sql, params);

      // Process all entities with schema-aware field mapping
      const processedEntities = await Promise.all(
        results.map(entity => this.processEntityFromDatabase(entity, schemaContext))
      );

      return {
        success: true,
        data: processedEntities
      };

    } catch (error) {
      console.error(`❌ [Dynamic] Find ${entityName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods

  /**
   * Get validation context with current schema
   */
  private async getValidationContext(
    orgId: string, 
    entityName: string
  ): Promise<ValidationContext | null> {
    try {
      // Check cache first
      const cacheKey = `${orgId}:${entityName}`;
      const cached = this.schemaCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.SCHEMA_CACHE_TTL) {
        const entity = cached.schema.entities[entityName];
        if (entity) {
          return {
            orgId,
            entityName,
            schema: entity
          };
        }
      }

      // Load fresh schema
      const result = await orgSchemaClient.loadOrgSchema(orgId);
      if (!result.success || !result.schema) {
        return null;
      }

      // Cache the schema
      this.schemaCache.set(cacheKey, {
        schema: result.schema,
        timestamp: Date.now()
      });

      const entity = result.schema.entities[entityName];
      if (!entity) {
        return null;
      }

      return {
        orgId,
        entityName,
        schema: entity
      };

    } catch (error) {
      console.error('Failed to get validation context:', error);
      return null;
    }
  }

  /**
   * Validate entity data against dynamic schema
   */
  private async validateEntityData(
    data: any,
    context: ValidationContext
  ): Promise<{ 
    success: boolean; 
    errors?: Record<string, string[]>; 
    processedData?: any;
  }> {
    const errors: Record<string, string[]> = {};
    const processedData: any = {};

    // Validate each field against schema
    for (const [fieldName, fieldDef] of Object.entries(context.schema.syncableFields)) {
      const value = data[fieldName];

      // Check required fields (skip for updates unless explicitly provided)
      if (fieldDef.required && value === undefined && !context.isUpdate) {
        errors[fieldName] = errors[fieldName] || [];
        errors[fieldName].push(`${fieldName} is required`);
        continue;
      }

      // Skip undefined values in updates
      if (value === undefined && context.isUpdate) {
        continue;
      }

      // Validate and process field value
      const fieldResult = await this.validateField(fieldName, value, fieldDef);
      if (fieldResult.errors.length > 0) {
        errors[fieldName] = fieldResult.errors;
      } else {
        processedData[fieldName] = fieldResult.processedValue;
      }
    }

    return {
      success: Object.keys(errors).length === 0,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      processedData
    };
  }

  /**
   * Validate individual field against schema definition
   */
  private async validateField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition
  ): Promise<{ errors: string[]; processedValue: any }> {
    const errors: string[] = [];
    let processedValue = value;

    // Type validation and conversion
    switch (fieldDef.type) {
      case 'string':
      case 'text':
      case 'email':
      case 'url':
        if (typeof value !== 'string') {
          processedValue = String(value);
        }
        break;

      case 'number':
      case 'integer':
        if (typeof value === 'string') {
          const parsed = fieldDef.type === 'integer' ? parseInt(value, 10) : parseFloat(value);
          if (isNaN(parsed)) {
            errors.push(`${fieldName} must be a valid ${fieldDef.type}`);
          } else {
            processedValue = parsed;
          }
        } else if (typeof value !== 'number') {
          errors.push(`${fieldName} must be a ${fieldDef.type}`);
        }
        break;

      case 'boolean':
        if (typeof value === 'string') {
          processedValue = value === 'true' || value === '1';
        } else if (typeof value !== 'boolean') {
          errors.push(`${fieldName} must be a boolean`);
        }
        break;

      case 'json':
      case 'array':
        if (typeof value === 'string') {
          try {
            processedValue = JSON.parse(value);
          } catch {
            errors.push(`${fieldName} must be valid JSON`);
          }
        } else if (typeof value === 'object') {
          processedValue = value;
        } else {
          errors.push(`${fieldName} must be an object or valid JSON`);
        }
        break;

      case 'date':
        if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push(`${fieldName} must be a valid date`);
          } else {
            processedValue = date.toISOString();
          }
        } else if (value instanceof Date) {
          processedValue = value.toISOString();
        } else {
          errors.push(`${fieldName} must be a valid date`);
        }
        break;

      case 'enum':
        if (fieldDef.enum && !fieldDef.enum.includes(String(value))) {
          errors.push(`${fieldName} must be one of: ${fieldDef.enum.join(', ')}`);
        }
        break;
    }

    // Additional validation rules
    if (fieldDef.validation) {
      if (fieldDef.validation.pattern && typeof processedValue === 'string') {
        const regex = new RegExp(fieldDef.validation.pattern);
        if (!regex.test(processedValue)) {
          errors.push(`${fieldName} format is invalid`);
        }
      }

      if (fieldDef.validation.min !== undefined && typeof processedValue === 'number') {
        if (processedValue < fieldDef.validation.min) {
          errors.push(`${fieldName} must be at least ${fieldDef.validation.min}`);
        }
      }

      if (fieldDef.validation.max !== undefined && typeof processedValue === 'number') {
        if (processedValue > fieldDef.validation.max) {
          errors.push(`${fieldName} must be at most ${fieldDef.validation.max}`);
        }
      }
    }

    return { errors, processedValue };
  }

  /**
   * Execute dynamic insert with schema-aware field mapping
   */
  private async executeDynamicInsert(
    liveStore: LiveStoreInstance,
    tableName: string,
    entity: DynamicEntity,
    context: ValidationContext
  ): Promise<void> {
    // Map entity fields to database columns based on schema
    const dbFields = this.mapEntityToDatabase(entity, context);
    
    const columns = Object.keys(dbFields);
    const values = Object.values(dbFields);
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    await liveStore.query(sql, values);
  }

  /**
   * Execute dynamic update with schema-aware field mapping
   */
  private async executeDynamicUpdate(
    liveStore: LiveStoreInstance,
    tableName: string,
    id: string,
    updateData: any,
    context: ValidationContext
  ): Promise<void> {
    // Map update fields to database columns based on schema
    const dbFields = this.mapEntityToDatabase(updateData, context);
    
    const setClause = Object.keys(dbFields)
      .map(column => `${column} = ?`)
      .join(', ');
    
    const values = [...Object.values(dbFields), id, context.orgId];
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ? AND organization_id = ?`;
    
    await liveStore.query(sql, values);
  }

  /**
   * Map entity fields to database columns based on schema
   */
  private mapEntityToDatabase(entity: any, context: ValidationContext): Record<string, any> {
    const dbFields: Record<string, any> = {};
    
    // Always include system fields
    if (entity.id !== undefined) dbFields.id = entity.id;
    if (entity.organizationId !== undefined) dbFields.organization_id = entity.organizationId;
    if (entity.createdAt !== undefined) dbFields.created_at = entity.createdAt;
    if (entity.updatedAt !== undefined) dbFields.updated_at = entity.updatedAt;
    if (entity.createdBy !== undefined) dbFields.created_by = entity.createdBy;
    if (entity.updatedBy !== undefined) dbFields.updated_by = entity.updatedBy;
    if (entity.deletedAt !== undefined) dbFields.deleted_at = entity.deletedAt;

    // Map syncable fields based on schema
    for (const [fieldName, fieldDef] of Object.entries(context.schema.syncableFields)) {
      if (entity[fieldName] !== undefined) {
        // Convert field name to database column name (snake_case)
        const columnName = this.fieldNameToColumnName(fieldName);
        
        // Convert field value to database format based on type
        dbFields[columnName] = this.convertFieldToDatabase(entity[fieldName], fieldDef);
      }
    }

    return dbFields;
  }

  /**
   * Process entity from database with schema-aware field mapping
   */
  private async processEntityFromDatabase(
    dbEntity: any,
    context: ValidationContext
  ): Promise<DynamicEntity> {
    const entity: DynamicEntity = {
      id: dbEntity.id,
      organizationId: dbEntity.organization_id,
      createdAt: dbEntity.created_at,
      updatedAt: dbEntity.updated_at,
      createdBy: dbEntity.created_by,
      updatedBy: dbEntity.updated_by,
      deletedAt: dbEntity.deleted_at
    };

    // Map database columns back to entity fields based on schema
    for (const [fieldName, fieldDef] of Object.entries(context.schema.syncableFields)) {
      const columnName = this.fieldNameToColumnName(fieldName);
      
      if (dbEntity[columnName] !== undefined) {
        entity[fieldName] = this.convertFieldFromDatabase(dbEntity[columnName], fieldDef);
      }
    }

    return entity;
  }

  /**
   * Convert field name to database column name (camelCase to snake_case)
   */
  private fieldNameToColumnName(fieldName: string): string {
    return fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  /**
   * Convert field value to database format
   */
  private convertFieldToDatabase(value: any, fieldDef: FieldDefinition): any {
    switch (fieldDef.type) {
      case 'json':
      case 'array':
        return typeof value === 'string' ? value : JSON.stringify(value);
      case 'boolean':
        return value ? 1 : 0;
      default:
        return value;
    }
  }

  /**
   * Convert field value from database format
   */
  private convertFieldFromDatabase(value: any, fieldDef: FieldDefinition): any {
    switch (fieldDef.type) {
      case 'json':
      case 'array':
        return typeof value === 'string' ? JSON.parse(value) : value;
      case 'boolean':
        return Boolean(value);
      case 'number':
      case 'integer':
        return typeof value === 'string' ? parseFloat(value) : value;
      default:
        return value;
    }
  }

  /**
   * Build dynamic SQL query with filters
   */
  private buildDynamicQuery(
    tableName: string,
    orgId: string,
    filters?: Record<string, any>,
    orderBy?: string,
    limit?: number,
    context?: ValidationContext
  ): { sql: string; params: any[] } {
    let sql = `SELECT * FROM ${tableName} WHERE organization_id = ? AND deleted_at IS NULL`;
    const params: any[] = [orgId];

    // Add dynamic filters based on schema
    if (filters && context) {
      for (const [fieldName, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          const columnName = this.fieldNameToColumnName(fieldName);
          sql += ` AND ${columnName} = ?`;
          params.push(value);
        }
      }
    }

    // Add ordering
    if (orderBy) {
      const orderColumn = this.fieldNameToColumnName(orderBy);
      sql += ` ORDER BY ${orderColumn}`;
    } else {
      sql += ` ORDER BY created_at DESC`;
    }

    // Add limit
    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }

    return { sql, params };
  }

  /**
   * Get table name from schema
   */
  private getTableName(orgId: string, schema: EntityDefinition): string {
    // Use schema tableName if available, otherwise generate from org + entity
    if (schema.tableName) {
      return schema.tableName;
    }
    
    // Fallback to organization-scoped table name
    return liveStoreSchemaClient.getTableName(orgId, schema.extends.replace('base_', ''));
  }

  /**
   * Get LiveStore instance for organization
   */
  private async getLiveStoreInstance(orgId: string): Promise<LiveStoreInstance | null> {
    const instance = liveStoreSchemaClient.getLiveStoreInstance(orgId);
    
    if (!instance) {
      console.warn(`LiveStore instance not found for org: ${orgId}`);
      return null;
    }
    
    // Ensure instance is ready
    await instance.ready();
    return instance;
  }

  /**
   * Get current user ID (placeholder - integrate with your auth system)
   */
  private async getCurrentUserId(): Promise<string> {
    // TODO: Get from your auth context
    return 'current-user-id';
  }
}

// Create singleton instance
export const dynamicLiveStoreDomainService = new DynamicLiveStoreDomainService();

// Factory function for creating entity-specific services
export function createDynamicEntityService(orgId: string, entityName: string) {
  return {
    async create(data: DynamicEntityData) {
      return dynamicLiveStoreDomainService.create(orgId, entityName, data);
    },
    
    async update(id: string, updates: Partial<DynamicEntityData>) {
      return dynamicLiveStoreDomainService.update(orgId, entityName, id, updates);
    },
    
    async delete(id: string) {
      return dynamicLiveStoreDomainService.delete(orgId, entityName, id);
    },
    
    async findById(id: string) {
      return dynamicLiveStoreDomainService.findById(orgId, entityName, id);
    },
    
    async findAll() {
      return dynamicLiveStoreDomainService.find(orgId, entityName);
    },
    
    async find(filters?: Record<string, any>, orderBy?: string, limit?: number) {
      return dynamicLiveStoreDomainService.find(orgId, entityName, filters, orderBy, limit);
    }
  };
}

// Export types
export type {
  DynamicEntity,
  DynamicEntityData,
  MutationResult,
  ValidationContext
};