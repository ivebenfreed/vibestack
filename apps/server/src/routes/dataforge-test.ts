/**
 * DataForge Test API Routes
 * 
 * Test endpoints for server-only DataForge functionality.
 * Allows testing entity creation, validation, and data operations via HTTP.
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';
// Lazy imports to avoid startup hanging
// import { JsonRulesEngine } from '../dataforge/rules/json-rules-engine';
// import { OrgSchemaManager } from '../dataforge/json-schema/org-entity-schema';
// import { RuntimeSchemaGenerator } from '../dataforge/kysely-generator/runtime-schema-generator';
// import { EntityManager } from '../dataforge/entity-operations/entity-manager';
// import { db } from '../lib/kysely';

export const dataforgeTestRouter = new Hono<AppContext>();

// Initialize DataForge components on first use to avoid startup hanging

// Test endpoint: Health check for DataForge
dataforgeTestRouter.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dataforge: 'server-only implementation ready'
  });
});

// Test endpoint: Create a test organization entity
dataforgeTestRouter.post('/orgs/:orgId/entities', async (c) => {
  try {
    // Lazy load DataForge components
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    const { EntityManager } = await import('../dataforge/entity-operations/entity-manager');
    const { DebouncedMigrationService } = await import('../dataforge/migration/debounced-migration-service');
    const { getKysely } = await import('../lib/kysely');

    const orgId = c.req.param('orgId');
    const body = await c.req.json();
    
    const { entityName, definition, useDebounced = false } = body;
    
    if (!entityName || !definition) {
      return c.json({ error: 'entityName and definition required' }, 400);
    }

    // Initialize components
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();
    const kysely = getKysely(c.env);

    // Optionally create migration service for debounced migrations
    let migrationService;
    if (useDebounced) {
      migrationService = new DebouncedMigrationService(kysely, schemaGenerator);
    }

    // Create entity manager instance
    const entityManager = new EntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      migrationService, // Will be undefined if not using debounced
      env: c.env
    });

    // Create the entity
    const result = await entityManager.createOrgEntity(orgId, entityName, definition);
    
    if (!result.success) {
      return c.json({ error: 'Failed to create entity', details: result.errors }, 400);
    }

    // Generate TypeScript interface for response
    const tsInterface = schemaGenerator.generateTableInterface(orgId, entityName, definition);

    return c.json({
      success: true,
      entity: {
        orgId,
        entityName,
        tableName: definition.tableName,
        definition
      },
      migration: {
        migrationId: result.migrationId,
        immediate: result.immediate,
        estimatedCompletion: result.migrationId ? new Date(Date.now() + 30000).toISOString() : null
      },
      generatedInterface: tsInterface
    });
  } catch (error) {
    console.error('Entity creation error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Test endpoint: Save entity data
dataforgeTestRouter.post('/orgs/:orgId/data/:entityName', async (c) => {
  try {
    // Lazy load DataForge components
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    const { EntityManager } = await import('../dataforge/entity-operations/entity-manager');
    const { getKysely } = await import('../lib/kysely');
    
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const data = await c.req.json();

    // Initialize components
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    // Create entity manager instance
    const kysely = getKysely(c.env);
    const entityManager = new EntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    // Save the data
    const result = await entityManager.saveEntityData(orgId, entityName, data);
    
    if (!result.success) {
      return c.json({ error: 'Validation failed', details: result.errors }, 400);
    }

    return c.json({
      success: true,
      saved: result.data,
      syncable: result.syncData
    });
  } catch (error) {
    console.error('Save data error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Test endpoint: Query entity data
dataforgeTestRouter.get('/orgs/:orgId/data/:entityName', async (c) => {
  try {
    // Lazy load DataForge components
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    const { EntityManager } = await import('../dataforge/entity-operations/entity-manager');
    const { getKysely } = await import('../lib/kysely');
    
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const syncOnly = c.req.query('syncOnly') === 'true';

    // Initialize components
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    // Create entity manager instance
    const kysely = getKysely(c.env);
    const entityManager = new EntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    // Query the data
    const result = await entityManager.queryEntityData(orgId, entityName, {}, syncOnly);
    
    if (!result.success) {
      return c.json({ error: 'Query failed', details: result.errors }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      syncOnly: syncOnly
    });
  } catch (error) {
    console.error('Query data error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Test endpoint: Get org schema (syncable only)
dataforgeTestRouter.get('/orgs/:orgId/schema', async (c) => {
  try {
    // Lazy load DataForge components
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    const { EntityManager } = await import('../dataforge/entity-operations/entity-manager');
    const { getKysely } = await import('../lib/kysely');
    
    const orgId = c.req.param('orgId');

    // Initialize components
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    // Create entity manager instance
    const kysely = getKysely(c.env);
    const entityManager = new EntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    // Get syncable schema
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

// Test endpoint: Validate data without saving
dataforgeTestRouter.post('/orgs/:orgId/validate/:entityName', async (c) => {
  try {
    // Lazy load components
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    const { EntityManager } = await import('../dataforge/entity-operations/entity-manager');
    const { getKysely } = await import('../lib/kysely');
    
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const data = await c.req.json();

    // Initialize components
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    // Create entity manager instance  
    const kysely = getKysely(c.env);
    const entityManager = new EntityManager({
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

// Test endpoint: Generate SQL DDL for entity
dataforgeTestRouter.post('/orgs/:orgId/entities/:entityName/ddl', async (c) => {
  try {
    // Lazy load components
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const definition = await c.req.json();

    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    // Generate table name
    definition.tableName = schemaManager.generateTableName(orgId, entityName);

    // Generate SQL DDL
    const ddl = schemaGenerator.generateCreateTableSQL(definition);

    return c.json({
      success: true,
      tableName: definition.tableName,
      ddl: ddl
    });
  } catch (error) {
    console.error('DDL generation error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Test endpoint: Test debounced migration system
dataforgeTestRouter.post('/orgs/:orgId/entities/:entityName/debounced', async (c) => {
  try {
    // Lazy load components
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    const { DebouncedMigrationService } = await import('../dataforge/migration/debounced-migration-service');
    const { getKysely } = await import('../lib/kysely');
    
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const { definition, operation = 'create' } = await c.req.json();

    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();
    const kysely = getKysely(c.env);
    const migrationService = new DebouncedMigrationService(kysely, schemaGenerator);

    // Generate table name
    definition.tableName = schemaManager.generateTableName(orgId, entityName);

    // Schedule the migration
    const migrationId = await migrationService.scheduleSchemaChange(
      orgId,
      entityName,
      operation,
      definition
    );

    return c.json({
      success: true,
      migrationId: migrationId,
      operation: operation,
      scheduledFor: new Date(Date.now() + 30000).toISOString(),
      pendingMigrations: migrationService.getPendingMigrations().map(m => ({
        id: m.id,
        organizationId: m.organizationId,
        entityName: m.entityName,
        operation: m.operation,
        status: m.status,
        scheduledFor: m.scheduledFor
      }))
    });
  } catch (error) {
    console.error('Debounced migration error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Test endpoint: Get pending migrations status
dataforgeTestRouter.get('/migrations/pending', async (c) => {
  try {
    const { DebouncedMigrationService } = await import('../dataforge/migration/debounced-migration-service');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    const { getKysely } = await import('../lib/kysely');
    
    const kysely = getKysely(c.env);
    const schemaGenerator = new RuntimeSchemaGenerator();
    const migrationService = new DebouncedMigrationService(kysely, schemaGenerator);

    const pendingMigrations = migrationService.getPendingMigrations();

    return c.json({
      success: true,
      count: pendingMigrations.length,
      migrations: pendingMigrations.map(m => ({
        id: m.id,
        organizationId: m.organizationId,
        entityName: m.entityName,
        operation: m.operation,
        status: m.status,
        scheduledFor: m.scheduledFor,
        createdAt: m.createdAt
      }))
    });
  } catch (error) {
    console.error('Migration status error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Test endpoint: Force flush all pending migrations (for testing)
dataforgeTestRouter.post('/migrations/flush', async (c) => {
  try {
    const { DebouncedMigrationService } = await import('../dataforge/migration/debounced-migration-service');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    const { getKysely } = await import('../lib/kysely');
    
    const kysely = getKysely(c.env);
    const schemaGenerator = new RuntimeSchemaGenerator();
    const migrationService = new DebouncedMigrationService(kysely, schemaGenerator);

    await migrationService.flushAllPendingMigrations();

    return c.json({
      success: true,
      message: 'All pending migrations have been processed immediately'
    });
  } catch (error) {
    console.error('Migration flush error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});