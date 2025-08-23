/**
 * Organization Schema Durable Object
 * 
 * Manages persistent storage of organization-specific entity schemas.
 * Each org gets its own DO instance for schema isolation.
 * Uses @cloudflare/actors SDK for enhanced storage and migration support.
 */

import { Actor } from '@cloudflare/actors';
import type { OrgSchema, OrgEntityDefinition } from '../json-schema/org-entity-schema';
import type { EntityConfig } from '../rules/json-rules-engine';
import { FoundationEntityRegistry } from '../entities/foundation/index';
import type { FieldDefinition } from '../rules/json-rules-engine';

export class OrgSchemaDO extends Actor<any> {
  constructor(ctx: any, env: any) {
    super(ctx, env);
    
    // Define storage migrations for entity configs
    this.storage.migrations = [
      {
        tag: 'v1-entity-schemas',
        description: 'Create entity schema storage',
        sql: `
          CREATE TABLE IF NOT EXISTS entity_configs (
            entity_name TEXT PRIMARY KEY,
            config TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS org_schema (
            id INTEGER PRIMARY KEY DEFAULT 1,
            schema_data TEXT NOT NULL,
            version TEXT DEFAULT '1.0.0',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `
      }
    ];
  }

  /**
   * Initialize storage by running migrations
   */
  private async ensureInitialized(): Promise<void> {
    try {
      // Check if tables exist
      await this.storage.sql`SELECT 1 FROM org_schema LIMIT 1`;
    } catch (error) {
      // Tables don't exist, create them
      console.log('Creating DO storage tables');
      
      await this.storage.sql`
        CREATE TABLE IF NOT EXISTS entity_configs (
          entity_name TEXT PRIMARY KEY,
          config TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await this.storage.sql`
        CREATE TABLE IF NOT EXISTS org_schema (
          id INTEGER PRIMARY KEY DEFAULT 1,
          schema_data TEXT NOT NULL,
          version TEXT DEFAULT '1.0.0',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      console.log('DO storage tables created successfully');
    }
  }

  /**
   * Initialize org schema from SQLite storage
   */
  async initializeOrgSchema(orgId: string): Promise<OrgSchema> {
    await this.ensureInitialized();
    
    // Check if org schema exists in SQLite
    const rows = await this.storage.sql`
      SELECT schema_data, version, created_at, updated_at 
      FROM org_schema 
      WHERE id = 1
    `;
    
    if (rows.length > 0) {
      const row = rows[0];
      return JSON.parse(row.schema_data as string);
    } else {
      // Create new schema
      const newSchema: OrgSchema = {
        orgId,
        entities: {},
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await this.storage.sql`
        INSERT INTO org_schema (schema_data, version)
        VALUES (${JSON.stringify(newSchema)}, ${newSchema.version})
      `;
      
      return newSchema;
    }
  }

  /**
   * Store entity definition and config in SQLite
   */
  async storeEntityDefinition(
    entityName: string, 
    definition: OrgEntityDefinition,
    config: EntityConfig
  ): Promise<void> {
    // Get current schema
    const orgSchema = await this.getOrgSchema();
    
    // Update schema with new entity
    orgSchema.entities[entityName] = definition;
    orgSchema.updatedAt = new Date().toISOString();
    
    // Store both schema and config in SQLite
    await Promise.all([
      // Update org schema
      this.storage.sql`
        UPDATE org_schema 
        SET schema_data = ${JSON.stringify(orgSchema)},
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = 1
      `,
      // Store entity config
      this.storage.sql`
        INSERT OR REPLACE INTO entity_configs (entity_name, config, updated_at)
        VALUES (${entityName}, ${JSON.stringify(config)}, CURRENT_TIMESTAMP)
      `
    ]);
  }

  /**
   * Get entity config from SQLite
   */
  async getEntityConfig(entityName: string): Promise<EntityConfig | null> {
    await this.ensureInitialized();
    
    const rows = await this.storage.sql`
      SELECT config FROM entity_configs WHERE entity_name = ${entityName}
    `;
    
    if (rows.length > 0) {
      return JSON.parse(rows[0].config as string);
    }
    
    return null;
  }

  /**
   * Get full org schema from SQLite
   */
  async getOrgSchema(): Promise<OrgSchema> {
    await this.ensureInitialized();
    
    const rows = await this.storage.sql`
      SELECT schema_data FROM org_schema WHERE id = 1
    `;
    
    if (rows.length > 0) {
      return JSON.parse(rows[0].schema_data as string);
    }
    
    // Return empty schema if none exists
    return {
      orgId: '',
      entities: {},
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Get syncable schema (filtered)
   */
  async getSyncableSchema(): Promise<any> {
    const orgSchema = await this.getOrgSchema();
    
    const syncableEntities: any = {};
    
    for (const [entityName, definition] of Object.entries(orgSchema.entities)) {
      const syncableFields: Record<string, any> = {};
      
      // Include only syncable custom fields
      for (const [fieldName, fieldDef] of Object.entries(definition.customFields)) {
        if (fieldDef.syncable !== false && !fieldDef.serverOnly) {
          syncableFields[fieldName] = fieldDef;
        }
      }

      syncableEntities[entityName] = {
        extends: definition.extends,
        tableName: definition.tableName,
        syncableFields: syncableFields
      };
    }

    return {
      orgId: orgSchema.orgId,
      entities: syncableEntities,
      version: orgSchema.version
    };
  }

  /**
   * Create entity from Universal Archetype pattern
   */
  async createArchetypeEntity(
    orgId: string,
    archetype: string,
    tableName: string,
    fieldDefinitions: Record<string, FieldDefinition>
  ): Promise<{ success: boolean; ddl?: string; error?: string }> {
    try {
      // Validate archetype exists
      if (!FoundationEntityRegistry.isValidArchetypePattern(archetype)) {
        return {
          success: false,
          error: `Invalid archetype: ${archetype}. Supported: ${FoundationEntityRegistry.getUniversalArchetypes().join(', ')}`
        };
      }

      // Get archetype pattern class
      const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
      if (!ArchetypeClass) {
        return {
          success: false,
          error: `Archetype pattern class not found for: ${archetype}`
        };
      }

      // Generate DDL using archetype pattern + custom fields
      const ddl = this.generateArchetypeDDL(ArchetypeClass, tableName, fieldDefinitions);

      // Create entity definition for storage
      const entityDefinition: OrgEntityDefinition = {
        tableName,
        extends: archetype, // Store archetype as extends value
        customFields: fieldDefinitions,
        syncable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store entity definition in org schema
      await this.storeEntityDefinition(tableName, entityDefinition, {
        archetype,
        fieldDefinitions,
        createdAt: new Date().toISOString()
      } as EntityConfig);

      return {
        success: true,
        ddl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate DDL for archetype-based entity
   */
  private generateArchetypeDDL(
    ArchetypeClass: any,
    tableName: string,
    customFields: Record<string, FieldDefinition>
  ): string {
    // Get base DDL from archetype
    const baseDDL = this.getArchetypeBaseDDL(ArchetypeClass, tableName);
    
    // Generate custom columns
    const customColumns = this.generateCustomFieldColumns(customFields);
    
    // Combine base DDL with custom fields
    let finalDDL = baseDDL;
    
    if (customColumns.length > 0) {
      // Insert custom columns before the closing parenthesis and constraints
      const insertPoint = finalDDL.lastIndexOf('\n            ');
      if (insertPoint !== -1) {
        finalDDL = finalDDL.slice(0, insertPoint) + 
                   ',\n            ' + customColumns.join(',\n            ') +
                   finalDDL.slice(insertPoint);
      }
    }
    
    return finalDDL.replace(/\{tableName\}/g, tableName);
  }

  /**
   * Get base DDL from archetype class
   */
  private getArchetypeBaseDDL(ArchetypeClass: any, tableName: string): string {
    // Try different DDL method patterns based on archetype
    const className = ArchetypeClass.name;
    
    if (className === 'ProjectArchetype' && ArchetypeClass.getProjectDDL) {
      return ArchetypeClass.getProjectDDL();
    } else if (className === 'TaskArchetype' && ArchetypeClass.getTaskDDL) {
      return ArchetypeClass.getTaskDDL();
    } else if (className === 'RecordArchetype' && ArchetypeClass.getRecordDDL) {
      return ArchetypeClass.getRecordDDL();
    } else if (className === 'DocumentArchetype' && ArchetypeClass.getDocumentDDL) {
      return ArchetypeClass.getDocumentDDL();
    } else if (className === 'FileArchetype' && ArchetypeClass.getFileDDL) {
      return ArchetypeClass.getFileDDL();
    } else if (className === 'ActivityArchetype' && ArchetypeClass.getActivityDDL) {
      return ArchetypeClass.getActivityDDL();
    } else if (className === 'DiscussionArchetype' && ArchetypeClass.getDiscussionDDL) {
      return ArchetypeClass.getDiscussionDDL();
    } else if (className === 'CollectionArchetype' && ArchetypeClass.getCollectionDDL) {
      return ArchetypeClass.getCollectionDDL();
    }
    
    // Fallback to generic DDL
    return this.generateGenericArchetypeDDL(tableName);
  }

  /**
   * Generate fallback DDL for unsupported archetypes
   */
  private generateGenericArchetypeDDL(tableName: string): string {
    return `
      CREATE TABLE IF NOT EXISTS {tableName} (
        id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
        organization_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        
        CONSTRAINT fk_{tableName}_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
      );
    `;
  }

  /**
   * Generate SQL columns for custom fields
   */
  private generateCustomFieldColumns(customFields: Record<string, FieldDefinition>): string[] {
    return Object.entries(customFields).map(([fieldName, fieldDef]) => {
      const sqlType = this.fieldTypeToSQLType(fieldDef.type);
      const nullable = fieldDef.required ? ' NOT NULL' : '';
      const defaultValue = fieldDef.defaultValue ? ` DEFAULT '${fieldDef.defaultValue}'` : '';
      return `${fieldName} ${sqlType}${nullable}${defaultValue}`;
    });
  }

  /**
   * Convert field type to SQL type
   */
  private fieldTypeToSQLType(type: string): string {
    switch (type) {
      case 'text':
        return 'VARCHAR(255)';
      case 'longtext':
        return 'TEXT';
      case 'number':
      case 'integer':
        return 'INTEGER';
      case 'decimal':
        return 'DECIMAL(15,2)';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'DATE';
      case 'datetime':
        return 'TIMESTAMPTZ';
      case 'json':
        return 'JSONB';
      case 'priority_option':
      case 'status_option':
      case 'category_option':
        return 'VARCHAR(50)';
      case 'user_reference':
      case 'entity_reference':
        return 'UUID';
      default:
        return 'TEXT';
    }
  }

  /**
   * Get archetype entity definition
   */
  async getArchetypeEntity(tableName: string): Promise<OrgEntityDefinition | null> {
    const orgSchema = await this.getOrgSchema();
    return orgSchema.entities[tableName] || null;
  }

  /**
   * List all archetype entities for this organization
   */
  async listArchetypeEntities(): Promise<Record<string, OrgEntityDefinition>> {
    const orgSchema = await this.getOrgSchema();
    
    // Filter entities that are based on universal archetypes
    const archetypeEntities: Record<string, OrgEntityDefinition> = {};
    const universalArchetypes = FoundationEntityRegistry.getUniversalArchetypes();
    
    for (const [entityName, definition] of Object.entries(orgSchema.entities)) {
      if (universalArchetypes.includes(definition.extends)) {
        archetypeEntities[entityName] = definition;
      }
    }
    
    return archetypeEntities;
  }

  /**
   * Clear temporary schema data for a specific entity
   * This implements the simplified DO integration - clear temp data after successful migrations
   */
  async clearTempSchemaForEntity(entityName: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    
    try {
      // Remove entity config from temporary storage
      await this.storage.sql`
        DELETE FROM entity_configs WHERE entity_name = ${entityName}
      `;
      
      // Remove entity from org schema if it exists
      const orgSchema = await this.getOrgSchema();
      if (orgSchema.entities[entityName]) {
        delete orgSchema.entities[entityName];
        orgSchema.updatedAt = new Date().toISOString();
        
        // Update org schema without the cleared entity
        await this.storage.sql`
          UPDATE org_schema 
          SET schema_data = ${JSON.stringify(orgSchema)},
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = 1
        `;
      }
      
      console.log(`[OrgSchemaDO] 🧹 Cleared temp schema data for entity: ${entityName}`);
      return { success: true };
    } catch (error) {
      console.error(`[OrgSchemaDO] Failed to clear temp schema for ${entityName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear temp schema'
      };
    }
  }

  /**
   * Handle HTTP requests using SQLite storage
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    
    try {
      if (method === 'POST' && url.pathname === '/init') {
        // Initialize DO and store entity config
        const body = await request.json();
        const { orgId, entityName, config } = body;
        
        // Initialize schema if needed
        await this.initializeOrgSchema(orgId);
        
        // Store entity config
        await this.storage.sql`
          INSERT OR REPLACE INTO entity_configs (entity_name, config, updated_at)
          VALUES (${entityName}, ${JSON.stringify(config)}, CURRENT_TIMESTAMP)
        `;
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (method === 'GET' && url.pathname.startsWith('/config/')) {
        // Get entity config
        const entityName = url.pathname.split('/config/')[1];
        const config = await this.getEntityConfig(entityName);
        
        if (!config) {
          return new Response('Not found', { status: 404 });
        }
        
        return new Response(JSON.stringify(config), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (method === 'POST' && url.pathname === '/store-entity') {
        // Store entity definition
        const body = await request.json();
        const { entityName, definition } = body;
        
        // Get current schema and update it
        const orgSchema = await this.getOrgSchema();
        orgSchema.entities[entityName] = definition;
        orgSchema.updatedAt = new Date().toISOString();
        
        // Update schema in SQLite
        await this.storage.sql`
          UPDATE org_schema 
          SET schema_data = ${JSON.stringify(orgSchema)},
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = 1
        `;
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (method === 'POST' && url.pathname === '/create-archetype') {
        // Create archetype-based entity
        const body = await request.json();
        const { orgId, archetype, tableName, fieldDefinitions } = body;
        
        const result = await this.createArchetypeEntity(orgId, archetype, tableName, fieldDefinitions);
        
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (method === 'GET' && url.pathname === '/archetype-entities') {
        // List archetype entities
        const entities = await this.listArchetypeEntities();
        
        return new Response(JSON.stringify({ success: true, entities }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (method === 'GET' && url.pathname.startsWith('/archetype-entity/')) {
        // Get specific archetype entity
        const tableName = url.pathname.split('/archetype-entity/')[1];
        const entity = await this.getArchetypeEntity(tableName);
        
        if (!entity) {
          return new Response(JSON.stringify({ success: false, error: 'Entity not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ success: true, entity }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (method === 'DELETE' && url.pathname.startsWith('/clear-temp-schema/')) {
        // Clear temporary schema data for entity
        const entityName = url.pathname.split('/clear-temp-schema/')[1];
        const result = await this.clearTempSchemaForEntity(entityName);
        
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      switch (url.pathname) {
        case '/schema':
          const schema = await this.getOrgSchema();
          return new Response(JSON.stringify(schema), {
            headers: { 'Content-Type': 'application/json' }
          });
          
        case '/schema/syncable':
          const syncableSchema = await this.getSyncableSchema();
          return new Response(JSON.stringify(syncableSchema), {
            headers: { 'Content-Type': 'application/json' }
          });
          
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}