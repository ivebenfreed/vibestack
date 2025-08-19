/**
 * Entity Manager - Server-Only DataForge
 * 
 * Manages organization-specific entity creation, validation, and data operations.
 * Uses JSON Rules Engine + Kysely for type-safe database operations.
 */

import type { Kysely } from 'kysely';
import type { HardcodedDatabase } from '../base/hardcoded-database';
import type { OrgSchema, OrgEntityDefinition, OrgSchemaManager } from '../json-schema/org-entity-schema';
import type { JsonRulesEngine, EntityConfig, ValidationResult } from '../rules/json-rules-engine';
import type { RuntimeSchemaGenerator } from '../kysely-generator/runtime-schema-generator';
import type { DebouncedMigrationService } from '../migration/debounced-migration-service';

export interface EntityManagerConfig {
  kysely: Kysely<HardcodedDatabase>;
  rulesEngine: JsonRulesEngine;
  schemaGenerator: RuntimeSchemaGenerator;
  schemaManager: OrgSchemaManager;
  migrationService?: DebouncedMigrationService; // Optional for backward compatibility
  env?: any; // Cloudflare env for DO bindings
}

export class EntityManager {
  constructor(private config: EntityManagerConfig) {}

  /**
   * Create a new entity type for an organization
   */
  async createOrgEntity(
    orgId: string, 
    entityName: string, 
    definition: OrgEntityDefinition
  ): Promise<{ success: boolean; errors?: string[]; migrationId?: string; immediate?: boolean }> {
    try {
      // 1. Validate entity definition
      const validation = this.config.schemaManager.validateEntityDefinition(entityName, definition);
      if (validation.length > 0) {
        return { success: false, errors: validation };
      }

      // 2. Generate table name
      definition.tableName = this.config.schemaManager.generateTableName(orgId, entityName);

      // 3. Create entity config for rules engine
      const entityConfig = this.config.schemaManager.createEntityConfig(orgId, entityName, definition);

      // 4. Store entity config first (so it's available immediately)
      await this.storeEntityConfig(orgId, entityName, entityConfig);

      // 5. Update in-memory cache
      this.updateOrgSchema(orgId, entityName, definition);

      // 6. Handle table creation - use debounced migration if available, otherwise immediate
      if (this.config.migrationService) {
        // Use debounced migration system
        const migrationId = await this.config.migrationService.scheduleSchemaChange(
          orgId,
          entityName,
          'create',
          definition
        );
        
        console.log(`[EntityManager] Scheduled table creation for ${orgId}.${entityName} (migration: ${migrationId})`);
        
        return { 
          success: true, 
          migrationId,
          immediate: false
        };
      } else {
        // Fallback to immediate creation (backward compatibility)
        const createTableSQL = this.config.schemaGenerator.generateCreateTableSQL(definition);
        await this.executeSQL(createTableSQL);
        
        console.log(`[EntityManager] Created table immediately for ${orgId}.${entityName}`);
        
        return { 
          success: true, 
          immediate: true 
        };
      }
    } catch (error) {
      console.error('Failed to create org entity:', error);
      return { 
        success: false, 
        errors: [`Failed to create entity: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Save entity data with validation
   */
  async saveEntityData(
    orgId: string, 
    entityName: string, 
    data: any
  ): Promise<{ success: boolean; data?: any; syncData?: any; errors?: string[] }> {
    try {
      // 1. Get entity config
      const config = await this.getEntityConfig(orgId, entityName);
      if (!config) {
        return { success: false, errors: [`Entity ${entityName} not found for org ${orgId}`] };
      }

      // 2. Validate data using JSON Rules Engine
      const validation = this.config.rulesEngine.validate(data, config);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      // 3. Resolve orgId (slug or UUID) to proper UUID for database
      const organizationId = await this.resolveOrgId(orgId);
      if (!organizationId) {
        return { success: false, errors: [`Organization ${orgId} not found`] };
      }

      // 4. Save to database using Kysely (use raw SQL for dynamic tables)
      const tableName = config.tableName;
      
      // Prepare data with system fields
      const allData = {
        id: crypto.randomUUID(),
        organization_id: organizationId, // Use resolved UUID
        created_at: new Date(),
        updated_at: new Date(),
        status: 'active', // Default status
        ...validation.data
      };
      
      const fields = Object.keys(allData).map(field => this.camelToSnake(field));
      const values = Object.values(allData);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const insertSQL = `
        INSERT INTO ${tableName} (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING id, name, created_at, updated_at
      `;
      
      const saveResult = await this.config.kysely.executeQuery({
        sql: insertSQL,
        parameters: values
      });

      // Convert BigInt values to strings for JSON serialization
      const cleanResult = saveResult.rows[0] ? this.cleanQueryResult(saveResult.rows[0]) : null;

      return {
        success: true,
        data: cleanResult,
        syncData: validation.syncableData
      };
    } catch (error) {
      console.error('Failed to save entity data:', error);
      return { 
        success: false, 
        errors: [`Failed to save data: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Resolve organization ID from slug if needed
   */
  private async resolveOrgId(orgId: string): Promise<string | null> {
    try {
      // If it's already a UUID, return as-is
      if (orgId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return orgId;
      }

      // Query organization table to resolve slug to UUID
      const result = await this.config.kysely
        .selectFrom('organization' as any)
        .select('id')
        .where('slug', '=', orgId)
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error('Failed to resolve organization ID:', error);
      return null;
    }
  }

  /**
   * Query entity data
   */
  async queryEntityData(
    orgId: string, 
    entityName: string, 
    filters: Record<string, any> = {},
    syncableOnly: boolean = false
  ): Promise<{ success: boolean; data?: any[]; errors?: string[] }> {
    try {
      // 1. Get entity config
      const config = await this.getEntityConfig(orgId, entityName);
      if (!config) {
        return { success: false, errors: [`Entity ${entityName} not found for org ${orgId}`] };
      }

      // 2. Build query
      const tableName = config.tableName;
      let query = this.config.kysely.selectFrom(tableName as any);

      // Select fields based on sync requirements
      if (syncableOnly) {
        const syncableFields = this.getSyncableFieldNames(config);
        query = query.select(syncableFields as any);
      } else {
        query = query.selectAll();
      }

      // Apply filters
      for (const [field, value] of Object.entries(filters)) {
        const snakeField = this.camelToSnake(field);
        query = query.where(snakeField as any, '=', value);
      }

      // Execute query
      const results = await query.execute();

      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('Failed to query entity data:', error);
      return { 
        success: false, 
        errors: [`Failed to query data: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Get entity config from Durable Object SQLite storage
   */
  async getEntityConfig(orgId: string, entityName: string): Promise<EntityConfig | null> {
    // Load from OrgSchemaDO if env available
    if (this.config.env?.ORG_SCHEMA) {
      try {
        const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
        const doStub = this.config.env.ORG_SCHEMA.get(doId);
        
        // Get config from DO
        const response = await doStub.fetch(new Request(`http://localhost/config/${entityName}`));
        if (response.ok) {
          const config = await response.json();
          return config;
        }
      } catch (error) {
        console.warn('Failed to load from DO:', error);
      }
    }

    return null;
  }

  /**
   * Get org schema (syncable fields only)
   */
  async getOrgSyncSchema(orgId: string): Promise<any> {
    try {
      // Use PostgreSQL as the single source of truth for entity schemas
      const entities = await this.config.kysely
        .selectFrom('entity_schemas')
        .select([
          'entity_name',
          'table_name', 
          'archetype',
          'business_metadata'
        ])
        .where('org_id', '=', orgId)
        .execute();

      if (entities.length === 0) {
        console.warn(`No entities found in entity_schemas for org ${orgId}`);
        return null;
      }

      // Build the schema response in the expected format
      const syncableEntities: Record<string, any> = {};
      
      for (const entity of entities) {
        const metadata = entity.business_metadata as any || {};
        
        syncableEntities[entity.entity_name] = {
          extends: `base_${entity.archetype}s`, // e.g., "base_projects"
          tableName: entity.table_name,
          archetype: entity.archetype,
          syncableFields: metadata.fields || {},
          description: metadata.description || '',
          syncable: metadata.syncable !== false
        };
      }

      console.log(`[EntityManager] Loaded ${entities.length} entities from PostgreSQL for org ${orgId}:`, Object.keys(syncableEntities));

      return {
        orgId: orgId,
        entities: syncableEntities,
        version: '1.0.0',
        source: 'postgresql'
      };

    } catch (error) {
      console.error('Failed to get syncable schema from PostgreSQL:', error);
      return null;
    }
  }

  /**
   * Store entity config using Durable Object SQLite storage
   */
  private async storeEntityConfig(orgId: string, entityName: string, config: EntityConfig): Promise<void> {
    // Store in OrgSchemaDO if env available
    if (this.config.env?.ORG_SCHEMA) {
      try {
        const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
        const doStub = this.config.env.ORG_SCHEMA.get(doId);
        
        // Initialize the DO and store config
        await doStub.fetch(new Request('http://localhost/init', {
          method: 'POST',
          body: JSON.stringify({ orgId, entityName, config })
        }));
        
        console.log(`Stored entity config in DO SQLite: ${orgId}.${entityName}`);
      } catch (error) {
        console.warn('Failed to store in DO:', error);
        throw error;
      }
    } else {
      console.warn('No ORG_SCHEMA binding available');
      throw new Error('ORG_SCHEMA binding required for persistence');
    }
  }

  /**
   * Update org schema using Durable Object SQLite storage
   */
  private async updateOrgSchema(orgId: string, entityName: string, definition: OrgEntityDefinition): Promise<void> {
    if (this.config.env?.ORG_SCHEMA) {
      try {
        const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
        const doStub = this.config.env.ORG_SCHEMA.get(doId);
        
        // Store entity definition in DO
        await doStub.fetch(new Request('http://localhost/store-entity', {
          method: 'POST',
          body: JSON.stringify({ entityName, definition })
        }));
        
        console.log(`Updated org schema in DO SQLite: ${orgId}.${entityName}`);
      } catch (error) {
        console.warn('Failed to update schema in DO:', error);
      }
    }
  }

  /**
   * Get syncable field names for a config
   */
  private getSyncableFieldNames(config: EntityConfig): string[] {
    const baseFields = ['id', 'organization_id', 'name', 'status', 'created_at', 'updated_at'];
    
    // Add primitive-specific fields
    switch (config.basePrimitive) {
      case 'Project':
        baseFields.push('description', 'priority', 'start_date', 'end_date', 'owner_id');
        break;
      case 'Task':
        baseFields.push('project_id', 'description', 'priority', 'due_date', 'assignee_id');
        break;
    }

    // Add syncable custom fields
    for (const [fieldName, fieldDef] of Object.entries(config.customFields)) {
      if (fieldDef.syncable !== false && !fieldDef.serverOnly) {
        baseFields.push(this.camelToSnake(fieldName));
      }
    }

    return baseFields;
  }

  /**
   * Execute raw SQL (for DDL operations)
   */
  private async executeSQL(sql: string): Promise<void> {
    try {
      // Split multi-command DDL into individual statements
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      // Execute each statement separately
      for (const statement of statements) {
        if (statement) {
          await this.config.kysely.executeQuery({
            sql: statement,
            parameters: []
          });
        }
      }
      
      console.log('Executed SQL successfully');
    } catch (error) {
      console.error('SQL execution failed:', error);
      throw error;
    }
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Clean query results for JSON serialization
   */
  private cleanQueryResult(result: any): any {
    if (result === null || result === undefined) return result;
    
    if (typeof result === 'bigint') {
      return result.toString();
    }
    
    if (Array.isArray(result)) {
      return result.map(item => this.cleanQueryResult(item));
    }
    
    if (typeof result === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(result)) {
        cleaned[key] = this.cleanQueryResult(value);
      }
      return cleaned;
    }
    
    return result;
  }
}