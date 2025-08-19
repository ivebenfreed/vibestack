/**
 * Universal Archetype API Routes
 * 
 * Clean, simple API that directly supports the 8 universal archetypes
 * without legacy POC complexity. This is the production-ready API.
 * 
 * Integrates with Better Auth via auth middleware applied globally.
 * User context is automatically available via c.get('user') and c.get('session').
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';

export const universalArchetypeRouter = new Hono<AppContext>();

// Universal Archetype Field Definition
interface UniversalFieldDefinition {
  name: string;
  type: 'text' | 'longtext' | 'rich_text' | 'number' | 'decimal' | 'integer' | 
        'boolean' | 'date' | 'datetime' | 'email' | 'url' | 'json' |
        'status_option' | 'priority_option' | 'category_option' | 'discussion_type_option' |
        'user_reference' | 'entity_reference';
  required?: boolean;
  defaultValue?: any;
  syncable?: boolean;
  serverOnly?: boolean;
}

// Universal Archetype Definition
interface UniversalArchetypeDefinition {
  fields: UniversalFieldDefinition[];
  archetype: 'project' | 'task' | 'record' | 'document' | 'file' | 'activity' | 'discussion' | 'collection';
  syncable?: boolean;
}

// Create entity with universal archetype format
universalArchetypeRouter.post('/orgs/:orgId/entities', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const body = await c.req.json();
    
    // Get authenticated user from auth middleware
    const user = c.get('user');
    const session = c.get('session');
    
    // Log user action for audit trail
    console.log(`[Universal Archetype] User ${user?.email || 'anonymous'} creating entity in org ${orgId}`);
    
    const { entityName, definition } = body as {
      entityName: string;
      definition: UniversalArchetypeDefinition;
    };
    
    if (!entityName || !definition || !definition.archetype) {
      return c.json({ error: 'entityName, definition, and archetype are required' }, 400);
    }

    // Check ContainerPermission access control
    const { getKysely } = await import('../lib/kysely');
    const { ArchetypeAccessService } = await import('../services/archetype-access-service');
    
    const kysely = getKysely(c.env);
    const accessService = new ArchetypeAccessService(kysely);
    
    const accessResult = await accessService.canCreateEntity(user?.id || '', orgId);
    if (!accessResult.allowed) {
      console.log(`[Universal Archetype] Access denied for ${user?.email}: ${accessResult.reason}`);
      return c.json({
        error: 'Access denied',
        code: 'FORBIDDEN', 
        message: accessResult.reason,
        requiredRole: accessResult.requiredRole,
        userRole: accessResult.userRole
      }, 403);
    }
    
    console.log(`[Universal Archetype] Access granted - User ${user.email} has ${accessResult.permission?.role} role`);

    // Lazy load additional components
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    
    const schemaGenerator = new RuntimeSchemaGenerator();
    
    // Generate table name
    const tableName = generateTableName(orgId, entityName);
    
    // Convert universal archetype definition to database schema
    console.log('Converting definition:', { entityName, definition, tableName });
    const tableDefinition = convertToTableDefinition(entityName, definition, tableName);
    console.log('Table definition:', tableDefinition);
    
    // Create table immediately for testing
    const createTableSQL = schemaGenerator.generateCreateTableSQL(tableDefinition);
    
    console.log(`Creating table for ${entityName}:`, createTableSQL);
    
    // Execute the table creation using Kysely - split multi-statement DDL
    const { sql } = await import('kysely');
    
    // Split DDL into individual statements and execute each one
    const statements = createTableSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
    for (const statement of statements) {
      if (statement.trim().length > 0) {
        await sql`${sql.raw(statement)}`.execute(kysely);
      }
    }
    
    // Store entity definition for future queries
    await storeEntityDefinition(c, orgId, entityName, definition, tableName);
    
    return c.json({
      success: true,
      entity: {
        orgId,
        entityName,
        archetype: definition.archetype,
        tableName,
        fields: definition.fields,
        createdBy: {
          userId: user?.id,
          userEmail: user?.email
        }
      },
      tableCreated: true,
      sql: createTableSQL
    });
    
  } catch (error) {
    console.error('Universal archetype entity creation error:', error);
    return c.json({ 
      error: 'Failed to create entity', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Save data to universal archetype entity
universalArchetypeRouter.post('/orgs/:orgId/data/:entityName', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const data = await c.req.json();
    
    // Get authenticated user from auth middleware
    const user = c.get('user');
    const session = c.get('session');
    
    // Log user action for audit trail
    console.log(`[Universal Archetype] User ${user?.email || 'anonymous'} saving data to ${entityName} in org ${orgId}`);

    // Check ContainerPermission access control
    const { getKysely } = await import('../lib/kysely');
    const { ArchetypeAccessService } = await import('../services/archetype-access-service');
    
    const kysely = getKysely(c.env);
    const accessService = new ArchetypeAccessService(kysely);
    
    const accessResult = await accessService.canSaveData(user?.id || '', orgId, entityName);
    if (!accessResult.allowed) {
      console.log(`[Universal Archetype] Save access denied for ${user?.email}: ${accessResult.reason}`);
      return c.json({
        error: 'Access denied',
        code: 'FORBIDDEN',
        message: accessResult.reason,
        requiredRole: accessResult.requiredRole,
        userRole: accessResult.userRole
      }, 403);
    }
    
    console.log(`[Universal Archetype] Save access granted - User ${user.email} has ${accessResult.permission?.role} role`);
    
    const { getDBClient } = await import('../lib/db');
    const client = getDBClient(c);
    
    // Get entity definition
    const entityDef = await getEntityDefinition(c, orgId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }
    
    // Validate and prepare data
    const validationResult = validateUniversalArchetypeData(data, entityDef);
    if (!validationResult.valid) {
      return c.json({ error: 'Validation failed', details: validationResult.errors }, 400);
    }
    
    // Add system fields including user context
    const saveData = {
      ...validationResult.data,
      id: crypto.randomUUID(),
      organization_id: orgId,
      created_by_id: user?.id || null,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Save to database using direct client
    await client.connect();
    try {
      const columns = Object.keys(saveData);
      const values = Object.values(saveData);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const insertSQL = `
        INSERT INTO ${entityDef.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      const result = await client.query(insertSQL, values);
      var insertedRow = result.rows[0];
    } finally {
      await client.end();
    }
    
    return c.json({
      success: true,
      saved: insertedRow,
      archetype: entityDef.definition.archetype
    });
    
  } catch (error) {
    console.error('Universal archetype data save error:', error);
    return c.json({ 
      error: 'Failed to save data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Query data from universal archetype entity
universalArchetypeRouter.get('/orgs/:orgId/data/:entityName', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    
    // Get authenticated user from auth middleware
    const user = c.get('user');
    const session = c.get('session');
    
    // Log user action for audit trail
    console.log(`[Universal Archetype] User ${user?.email || 'anonymous'} querying ${entityName} in org ${orgId}`);

    // Check ContainerPermission access control
    const { getKysely } = await import('../lib/kysely');
    const { ArchetypeAccessService } = await import('../services/archetype-access-service');
    
    const kysely = getKysely(c.env);
    const accessService = new ArchetypeAccessService(kysely);
    
    const accessResult = await accessService.canQueryData(user?.id || '', orgId, entityName);
    if (!accessResult.allowed) {
      console.log(`[Universal Archetype] Query access denied for ${user?.email}: ${accessResult.reason}`);
      return c.json({
        error: 'Access denied',
        code: 'FORBIDDEN',
        message: accessResult.reason,
        requiredRole: accessResult.requiredRole,
        userRole: accessResult.userRole
      }, 403);
    }
    
    console.log(`[Universal Archetype] Query access granted - User ${user.email} has ${accessResult.permission?.role} role`);
    
    const { getDBClient } = await import('../lib/db');
    const client = getDBClient(c);
    
    // Get entity definition
    const entityDef = await getEntityDefinition(c, orgId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }
    
    // Check if this is a count-only request
    const countOnly = c.req.query('count') === 'true';
    
    // Query data using direct client
    await client.connect();
    try {
      let querySQL: string;
      let results: any[];
      let count: number;
      
      if (countOnly) {
        // For count-only requests, use COUNT() for better performance
        querySQL = `
          SELECT COUNT(*) as count FROM ${entityDef.tableName}
          WHERE organization_id = $1
        `;
        
        const result = await client.query(querySQL, [orgId]);
        count = parseInt(result.rows[0]?.count || '0');
        results = [];
      } else {
        // For full data requests, get all data
        querySQL = `
          SELECT * FROM ${entityDef.tableName}
          WHERE organization_id = $1
        `;
        
        const result = await client.query(querySQL, [orgId]);
        results = result.rows;
        count = results.length;
      }
      
      return c.json({
        success: true,
        data: results,
        archetype: entityDef.definition.archetype,
        count: count,
        countOnly: countOnly,
        queriedBy: {
          userId: user?.id,
          userEmail: user?.email
        }
      });
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    console.error('Universal archetype data query error:', error);
    return c.json({ 
      error: 'Failed to query data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Delete entity and its table
universalArchetypeRouter.delete('/orgs/:orgId/entities/:entityName', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    
    // Get authenticated user from auth middleware
    const user = c.get('user');
    
    console.log(`[Universal Archetype] User ${user?.email || 'anonymous'} deleting entity ${entityName} in org ${orgId}`);
    
    if (!entityName) {
      return c.json({ error: 'entityName is required' }, 400);
    }

    // Check access control
    const { getKysely } = await import('../lib/kysely');
    const { ArchetypeAccessService } = await import('../services/archetype-access-service');
    
    const kysely = getKysely(c.env);
    const accessService = new ArchetypeAccessService(kysely);
    
    const accessResult = await accessService.canDelete(user?.id || '', orgId, entityName);
    if (!accessResult.allowed) {
      return c.json({
        error: 'Access denied',
        code: 'FORBIDDEN',
        message: accessResult.reason
      }, 403);
    }

    // Use ArchetypeEntityManager for proper deletion
    const { ArchetypeEntityManager } = await import('../dataforge/entity-operations/ArchetypeEntityManager');
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');

    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    const entityManager = new ArchetypeEntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    // First get the entity definition to find the table name
    const entityDef = await getEntityDefinition(c, orgId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }

    // For immediate execution: delete table and remove from entity_schemas
    const { sql } = await import('kysely');
    
    try {
      // 1. Drop the table immediately 
      await sql`DROP TABLE IF EXISTS ${sql.raw(entityDef.tableName)}`.execute(kysely);
      console.log(`Dropped table: ${entityDef.tableName}`);
      
      // 2. Remove from entity_schemas table
      await sql`DELETE FROM entity_schemas 
        WHERE org_id = ${orgId} AND entity_name = ${entityName}`.execute(kysely);
      console.log(`Removed entity from entity_schemas: ${orgId}/${entityName}`);
      
      return c.json({
        success: true,
        entityName,
        tableName: entityDef.tableName,
        message: `Entity ${entityName} deleted successfully (immediate execution)`
      });
      
    } catch (error) {
      console.error('Entity deletion error:', error);
      return c.json({ 
        error: 'Failed to delete entity', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
    
  } catch (error) {
    console.error('Entity deletion error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get organization schema (for debugging)
universalArchetypeRouter.get('/orgs/:orgId/schema', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    const { getKysely } = await import('../lib/kysely');
    const { ArchetypeEntityManager } = await import('../dataforge/entity-operations/ArchetypeEntityManager');
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');

    const kysely = getKysely(c.env);
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    const entityManager = new ArchetypeEntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    const schema = await entityManager.getOrgSyncSchema(orgId);
    
    if (!schema) {
      return c.json({ error: `No schema found for org ${orgId}` }, 404);
    }

    return c.json({
      success: true,
      schema: schema
    });
  } catch (error) {
    console.error('Schema retrieval error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Validate data without saving (for testing)
universalArchetypeRouter.post('/orgs/:orgId/validate/:entityName', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const data = await c.req.json();

    const { getKysely } = await import('../lib/kysely');
    const { ArchetypeEntityManager } = await import('../dataforge/entity-operations/ArchetypeEntityManager');
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');

    const kysely = getKysely(c.env);
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    const entityManager = new ArchetypeEntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    // Get entity config
    const config = await entityManager.getEntityConfig(orgId, entityName);
    if (!config) {
      return c.json({ error: `Entity ${entityName} not found for org ${orgId}` }, 404);
    }

    // Validate only
    const validation = rulesEngine.validate(data, config);

    return c.json({
      valid: validation.valid,
      errors: validation.errors,
      processedData: validation.data,
      syncableData: validation.syncableData
    });
  } catch (error) {
    console.error('Validation error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Migration status endpoints removed - now using immediate execution
// All table creation and schema registration happens immediately in entity creation endpoint
// No debounced migrations needed with immediate execution architecture

// Health check
universalArchetypeRouter.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    system: 'universal-archetype-api',
    archetypes: ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection']
  });
});

// Helper functions

function generateTableName(orgId: string, entityName: string): string {
  const cleanOrgId = orgId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const cleanEntityName = entityName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  // PostgreSQL table names cannot start with numbers, so prefix with 'org_'
  return `org_${cleanOrgId}_${cleanEntityName}s`;
}

function convertToTableDefinition(entityName: string, definition: UniversalArchetypeDefinition, tableName: string) {
  // Convert array format to Record<string, FieldDefinition> format for RuntimeSchemaGenerator
  const customFields: Record<string, any> = {};
  
  definition.fields.forEach(field => {
    customFields[field.name] = {
      type: mapUniversalTypeToFieldType(field.type),
      required: field.required || false,
      default: field.defaultValue,
      syncable: field.syncable !== false,
      serverOnly: field.serverOnly || false
    };
  });

  return {
    name: entityName,
    tableName,
    extends: mapArchetypeToBaseTable(definition.archetype),
    customFields
  };
}

function mapUniversalTypeToFieldType(universalType: string): string {
  // Map to FieldDefinition types expected by RuntimeSchemaGenerator
  const typeMap: Record<string, string> = {
    'text': 'string',
    'longtext': 'text',
    'rich_text': 'text',
    'number': 'number',
    'decimal': 'number',
    'integer': 'number',
    'boolean': 'boolean',
    'date': 'date',
    'datetime': 'date',
    'email': 'email',
    'url': 'url',
    'json': 'json',
    'status_option': 'enum',
    'priority_option': 'enum',
    'category_option': 'enum',
    'discussion_type_option': 'enum',
    'user_reference': 'string',
    'entity_reference': 'string'
  };
  
  return typeMap[universalType] || 'string';
}

function mapArchetypeToBaseTable(archetype: string): string {
  // Map universal archetypes to base table extensions
  const baseTableMap: Record<string, string> = {
    'project': 'base_projects',
    'task': 'base_tasks',
    'record': 'base_entities',
    'document': 'base_entities',
    'file': 'base_entities',
    'activity': 'base_events',
    'discussion': 'base_entities',
    'collection': 'base_entities'
  };
  
  return baseTableMap[archetype] || 'base_entities';
}

function validateUniversalArchetypeData(data: any, entityDef: any) {
  const errors: string[] = [];
  const validatedData: any = { ...data };
  
  for (const field of entityDef.definition.fields) {
    const value = data[field.name];
    
    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.name} is required`);
      continue;
    }
    
    // Skip validation for undefined optional fields
    if (value === undefined || value === null) {
      continue;
    }
    
    // Type validation
    switch (field.type) {
      case 'text':
      case 'longtext':
      case 'rich_text':
      case 'email':
      case 'url':
      case 'status_option':
      case 'priority_option':
      case 'category_option':
      case 'discussion_type_option':
      case 'user_reference':
      case 'entity_reference':
        if (typeof value !== 'string') {
          errors.push(`${field.name} must be a string`);
        }
        break;
      case 'number':
      case 'decimal':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`${field.name} must be a number`);
        }
        break;
      case 'integer':
        if (!Number.isInteger(value)) {
          errors.push(`${field.name} must be an integer`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${field.name} must be a boolean`);
        }
        break;
      case 'date':
      case 'datetime':
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          errors.push(`${field.name} must be a valid date`);
        }
        break;
      case 'json':
        // JSON fields accepted as-is
        break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: validatedData
  };
}

async function storeEntityDefinition(c: any, orgId: string, entityName: string, definition: UniversalArchetypeDefinition, tableName: string) {
  try {
    const { getKysely } = await import('../lib/kysely');
    const { sql } = await import('kysely');
    const kysely = getKysely(c.env);

    // Store in PostgreSQL-native entity_schemas table (replaces universal_entity_registry)
    const businessMetadata = {
      fields: definition.fields.reduce((acc: any, field) => {
        acc[field.name] = {
          type: field.type,
          required: field.required || false,
          syncable: field.syncable !== false,
          serverOnly: field.serverOnly || false,
          defaultValue: field.defaultValue
        };
        return acc;
      }, {}),
      description: `Entity created via Universal Archetype API`,
      syncable: definition.syncable !== false,
      createdAt: new Date().toISOString()
    };

    // Insert into entity_schemas table (immediate execution, no debouncing)
    await sql`INSERT INTO entity_schemas (org_id, entity_name, table_name, archetype, business_metadata)
      VALUES (${orgId}, ${entityName}, ${tableName}, ${definition.archetype}, ${JSON.stringify(businessMetadata)})
      ON CONFLICT (org_id, entity_name) DO UPDATE SET
        table_name = EXCLUDED.table_name,
        archetype = EXCLUDED.archetype,
        business_metadata = EXCLUDED.business_metadata,
        updated_at = CURRENT_TIMESTAMP`.execute(kysely);

    console.log(`Stored entity definition in entity_schemas: ${orgId}/${entityName} -> ${tableName} (archetype: ${definition.archetype})`);
  } catch (error) {
    console.error('Error storing entity definition in entity_schemas:', error);
    throw error;
  }
}

async function getEntityDefinition(c: any, orgId: string, entityName: string) {
  try {
    const { getKysely } = await import('../lib/kysely');
    const { sql } = await import('kysely');
    const kysely = getKysely(c.env);
    
    // Query from PostgreSQL-native entity_schemas table
    const result = await sql`SELECT table_name, archetype, business_metadata FROM entity_schemas 
      WHERE org_id = ${orgId} AND entity_name = ${entityName}`.execute(kysely);
      
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as any;
      const businessMetadata = typeof row.business_metadata === 'string' 
        ? JSON.parse(row.business_metadata) 
        : row.business_metadata;
      
      // Convert back to UniversalArchetypeDefinition format for compatibility
      const definition = {
        archetype: row.archetype,
        fields: Object.entries(businessMetadata.fields || {}).map(([name, config]: [string, any]) => ({
          name,
          type: config.type,
          required: config.required || false,
          syncable: config.syncable !== false,
          serverOnly: config.serverOnly || false,
          defaultValue: config.defaultValue
        })),
        syncable: businessMetadata.syncable !== false
      };
      
      return {
        tableName: row.table_name,
        definition
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting entity definition from entity_schemas:', error);
    return null;
  }
}