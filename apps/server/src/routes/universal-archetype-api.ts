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
    
    // Query all data using direct client
    await client.connect();
    try {
      const querySQL = `
        SELECT * FROM ${entityDef.tableName}
        WHERE organization_id = $1
      `;
      
      const result = await client.query(querySQL, [orgId]);
      var results = result.rows;
    } finally {
      await client.end();
    }
    
    return c.json({
      success: true,
      data: results,
      archetype: entityDef.definition.archetype,
      count: results.length,
      queriedBy: {
        userId: user?.id,
        userEmail: user?.email
      }
    });
    
  } catch (error) {
    console.error('Universal archetype data query error:', error);
    return c.json({ 
      error: 'Failed to query data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

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
  return `${cleanOrgId}_${cleanEntityName}s`;
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

    // Create registry table using Kysely
    await sql`CREATE TABLE IF NOT EXISTS universal_entity_registry (
      org_id TEXT,
      entity_name TEXT,
      table_name TEXT,
      definition JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (org_id, entity_name)
    )`.execute(kysely);

    // Insert entity definition
    await sql`INSERT INTO universal_entity_registry (org_id, entity_name, table_name, definition)
      VALUES (${orgId}, ${entityName}, ${tableName}, ${JSON.stringify(definition)})
      ON CONFLICT (org_id, entity_name) DO UPDATE SET
        table_name = EXCLUDED.table_name,
        definition = EXCLUDED.definition`.execute(kysely);

    console.log(`Stored entity definition for ${orgId}/${entityName} -> ${tableName}`);
  } catch (error) {
    console.error('Error storing entity definition:', error);
    throw error;
  }
}

async function getEntityDefinition(c: any, orgId: string, entityName: string) {
  try {
    const { getKysely } = await import('../lib/kysely');
    const { sql } = await import('kysely');
    const kysely = getKysely(c.env);
    
    const result = await sql`SELECT table_name, definition FROM universal_entity_registry 
      WHERE org_id = ${orgId} AND entity_name = ${entityName}`.execute(kysely);
      
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as any;
      return {
        tableName: row.table_name,
        definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting entity definition:', error);
    return null;
  }
}