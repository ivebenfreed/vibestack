import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, OrganizationConfig } from './types.js';
import { RulesFactory, SAMPLE_CONFIGS } from './rules-factory.js';
import { getAllPrimitives } from './primitives.js';

// Export Durable Object classes for Cloudflare Workers
export { OrganizationDurableObject } from './organization-durable-object.js';
export { EntityDurableObject } from './entity-durable-object.js';
export { SmartRoutingDurableObject } from './smart-routing-durable-object.js';

const app = new Hono<{ Bindings: Env }>();

// CORS for development
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type'],
}));

// Health check
app.get('/health', (c) => c.text('Function Factory POC OK'));

// List all available primitives
app.get('/primitives', (c) => {
  const primitives = getAllPrimitives();
  return c.json({ primitives, approach: 'rules-based' });
});

// Get sample configurations for testing
app.get('/samples', (c) => {
  return c.json({ 
    samples: SAMPLE_CONFIGS,
    approach: 'rules-based',
    note: 'Sample entity configurations using declarative rules'
  });
});

// Deploy a new entity with rules-based configuration
app.post('/rules/deploy', async (c) => {
  try {
    const entityConfig = await c.req.json();
    const factory = new RulesFactory(c.env);
    
    const schema = await factory.deployEntity(entityConfig);
    
    return c.json({ 
      success: true, 
      message: 'Entity configuration deployed successfully',
      schema: schema,
      approach: 'rules-based'
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

// Legacy endpoint for backward compatibility (now redirects to rules-based)
app.post('/factory/deploy', async (c) => {
  try {
    const entityDef = await c.req.json();
    const factory = new RulesFactory(c.env);
    
    // Convert old format to new rules-based format if needed
    const entityConfig = entityDef;
    
    const schema = await factory.deployEntity(entityConfig);
    
    return c.json({ 
      success: true, 
      message: 'Entity deployed successfully (using rules-based approach)',
      schema: schema,
      approach: 'rules-based',
      note: 'Dynamic function execution replaced with secure rule-based validation'
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

// Execute entity operations using rules-based engine
app.post('/entity/:orgId/:entityName/:operation', async (c) => {
  try {
    const { orgId, entityName, operation } = c.req.param();
    const data = await c.req.json();
    
    const factory = new RulesFactory(c.env);
    let result;
    
    switch (operation) {
      case 'validate':
        result = await factory.executeValidation(orgId, entityName, data);
        break;
      case 'save':
        result = await factory.executeSave(orgId, entityName, data);
        break;
      case 'query':
        result = await factory.executeQuery(orgId, entityName, data);
        break;
      default:
        return c.json({ 
          success: false, 
          error: `Unknown operation: ${operation}. Supported: validate, save, query`
        }, 400);
    }
    
    if (!result.valid) {
      return c.json({ 
        success: false, 
        errors: result.errors,
        approach: 'rules-based'
      }, 400);
    }
    
    return c.json({ 
      success: true, 
      result: result.data,
      approach: 'rules-based'
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get entity schema
app.get('/schema/:orgId/:entityName', async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const factory = new RulesFactory(c.env);
    
    const schema = await factory.getEntitySchema(orgId, entityName);
    
    if (!schema) {
      return c.json({ error: 'Schema not found' }, 404);
    }
    
    return c.json({ schema, approach: 'rules-based' });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// List org entities
app.get('/org/:orgId/entities', async (c) => {
  try {
    const { orgId } = c.req.param();
    const factory = new RulesFactory(c.env);
    
    const entities = await factory.listOrgEntities(orgId);
    
    return c.json({ entities, approach: 'rules-based' });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Debug: List all stored configurations (replaces debug/functions)
app.get('/debug/configurations', async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const debug = await factory.debugConfigurations();
    
    return c.json({
      ...debug,
      approach: 'rules-based',
      note: 'Configurations stored instead of executable functions'
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Legacy debug endpoint for backward compatibility
app.get('/debug/functions', async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const debug = await factory.debugConfigurations();
    
    return c.json({
      functions: [], // No longer storing executable functions
      schemas: debug.schemas,
      config: debug.configurations,
      approach: 'rules-based',
      note: 'Function execution replaced with secure rule-based validation'
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Debug: Get specific configuration
app.get('/debug/config/:key', async (c) => {
  try {
    const { key } = c.req.param();
    const factory = new RulesFactory(c.env);
    const config = await factory.getConfiguration(key);
    
    if (!config.config && !config.schema) {
      return c.json({ error: 'Configuration not found' }, 404);
    }
    
    return c.json({ ...config, approach: 'rules-based' });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Reports: Database schema report
app.get('/reports/database', async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const report = await factory.getDatabaseReport();
    
    return c.json({
      ...report,
      approach: 'rules-based',
      reportType: 'database-schema',
      persistenceType: 'd1-sqlite'
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Reports: TypeScript generation report
app.get('/reports/types', async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const report = factory.getTypeGenerationReport();
    
    return c.json({
      ...report,
      approach: 'rules-based',
      reportType: 'typescript-generation'
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Reports: Comprehensive multi-org report
app.get('/reports/multi-org', async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const report = await factory.getMultiOrgReport();
    
    return c.json({
      ...report,
      approach: 'rules-based',
      reportType: 'multi-org-comprehensive',
      persistenceType: 'd1-sqlite'
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Field Management: Add custom field to existing entity
app.post('/entity/:orgId/:entityName/fields', async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const fieldData = await c.req.json();
    
    const factory = new RulesFactory(c.env);
    const result = await factory.addCustomField(
      orgId, 
      entityName, 
      fieldData.fieldName, 
      fieldData.fieldConfig
    );
    
    return c.json({
      success: true,
      message: 'Custom field added successfully',
      migration: result.migration,
      generatedTypes: result.generatedTypes,
      approach: 'rules-based'
    });
  } catch (error) {
    return c.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// D1 Data Operations: Save real data to database
app.post('/data/:orgId/:entityName/save', async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const data = await c.req.json();
    
    const factory = new RulesFactory(c.env);
    
    // Validate first
    const validation = await factory.executeValidation(orgId, entityName, data);
    if (!validation.valid || !validation.data) {
      return c.json({
        success: false,
        errors: validation.errors,
        approach: 'rules-based',
        persistenceType: 'd1-sqlite'
      }, 400);
    }
    
    // Convert camelCase fields to snake_case for SQLite
    const convertedData: Record<string, any> = {};
    Object.entries(validation.data).forEach(([key, value]) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (typeof value === 'boolean') {
        convertedData[snakeKey] = value ? 1 : 0; // SQLite boolean conversion
      } else if (Array.isArray(value)) {
        convertedData[snakeKey] = JSON.stringify(value); // SQLite array conversion
      } else {
        convertedData[snakeKey] = value;
      }
    });

    // Generate ID and timestamps
    const saveData = {
      id: crypto.randomUUID(),
      ...convertedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organization_id: orgId,
      custom_data: JSON.stringify({})
    };
    
    // Insert into D1 database
    const tableName = `${orgId.replace(/-/g, '_')}_${entityName.toLowerCase()}s`;
    const result = await factory['databaseManager'].insertRecord(tableName, saveData);
    
    return c.json({
      success: true,
      data: result,
      approach: 'rules-based',
      persistenceType: 'd1-sqlite'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      persistenceType: 'd1-sqlite'
    }, 500);
  }
});

// D1 Data Operations: Query real data from database
app.get('/data/:orgId/:entityName', async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const limit = parseInt(c.req.query('limit') || '10');
    
    const factory = new RulesFactory(c.env);
    const tableName = `${orgId.replace(/-/g, '_')}_${entityName.toLowerCase()}s`;
    
    const records = await factory['databaseManager'].queryRecords(
      tableName, 
      { organization_id: orgId }, 
      limit
    );
    
    return c.json({
      success: true,
      data: records,
      count: records.length,
      approach: 'rules-based',
      persistenceType: 'd1-sqlite'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      persistenceType: 'd1-sqlite'
    }, 500);
  }
});

// D1 Debug: Get table schema from actual database
app.get('/debug/table/:tableName/schema', async (c) => {
  try {
    const { tableName } = c.req.param();
    const factory = new RulesFactory(c.env);
    
    const tableInfo = await factory['databaseManager'].getTableInfo(tableName);
    
    return c.json({
      tableName,
      schema: tableInfo,
      approach: 'rules-based',
      persistenceType: 'd1-sqlite'
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      persistenceType: 'd1-sqlite'
    }, 500);
  }
});

// D1 Debug: Get stored migrations
app.get('/debug/migrations', async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const migrations = await factory['databaseManager'].getStoredMigrations();
    
    return c.json({
      migrations: migrations.slice(0, 20), // Latest 20
      total: migrations.length,
      approach: 'rules-based',
      persistenceType: 'd1-sqlite'
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      persistenceType: 'd1-sqlite'
    }, 500);
  }
});

// ===== DURABLE OBJECTS MANAGEMENT ENDPOINTS =====

// Initialize organization with Durable Object
app.post('/durable/org/:orgId/init', async (c) => {
  try {
    const { orgId } = c.req.param();
    const config = await c.req.json() as OrganizationConfig;
    
    // Create OrganizationDurableObject
    const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
    const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
    
    const response = await orgStub.fetch('https://dummy-host/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, orgId })
    });
    
    const result = await response.json();
    
    return c.json({
      success: true,
      ...result,
      approach: 'durable-objects'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Deploy entity to Durable Object (with smart routing)
app.post('/durable/deploy', async (c) => {
  try {
    const entityConfig = await c.req.json();
    const orgId = entityConfig.orgId;
    
    // Get smart routing decision
    const routerId = c.env.ROUTER_OBJECTS.idFromName('main-router');
    const routerStub = c.env.ROUTER_OBJECTS.get(routerId);
    
    const routeResponse = await routerStub.fetch('https://dummy-host/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        entityName: entityConfig.name,
        operation: 'deploy',
        data: entityConfig
      })
    });
    
    const routeResult = await routeResponse.json();
    
    // If routed to organization-level, deploy to OrganizationDurableObject
    if (routeResult.decision?.route === 'org-level') {
      const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
      const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
      
      await orgStub.fetch('https://dummy-host/deploy-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entityConfig)
      });
    }
    
    return c.json({
      success: true,
      entityConfig,
      routing: routeResult,
      approach: 'durable-objects'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Execute entity operations via Durable Objects
app.post('/durable/entity/:orgId/:entityName/:operation', async (c) => {
  try {
    const { orgId, entityName, operation } = c.req.param();
    const data = await c.req.json();
    
    // Use smart routing to determine best execution path
    const routerId = c.env.ROUTER_OBJECTS.idFromName('main-router');
    const routerStub = c.env.ROUTER_OBJECTS.get(routerId);
    
    const response = await routerStub.fetch('https://dummy-host/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        entityName,
        operation,
        data
      })
    });
    
    const result = await response.json();
    
    return c.json({
      ...result,
      approach: 'durable-objects',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get organization statistics from Durable Object
app.get('/durable/org/:orgId/stats', async (c) => {
  try {
    const { orgId } = c.req.param();
    
    const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
    const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
    
    const response = await orgStub.fetch('https://dummy-host/stats');
    const result = await response.json();
    
    return c.json({
      ...result,
      approach: 'durable-objects'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get entity statistics from Durable Object
app.get('/durable/entity/:orgId/:entityName/stats', async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    
    const entityObjectId = c.env.ENTITY_OBJECTS.idFromName(`${orgId}:${entityName}`);
    const entityStub = c.env.ENTITY_OBJECTS.get(entityObjectId);
    
    const response = await entityStub.fetch('https://dummy-host/stats');
    const result = await response.json();
    
    return c.json({
      ...result,
      approach: 'durable-objects'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get routing analytics and recommendations
app.get('/durable/routing/analytics', async (c) => {
  try {
    const routerId = c.env.ROUTER_OBJECTS.idFromName('main-router');
    const routerStub = c.env.ROUTER_OBJECTS.get(routerId);
    
    const response = await routerStub.fetch('https://dummy-host/analytics');
    const result = await response.json();
    
    return c.json({
      ...result,
      approach: 'smart-routing'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get routing recommendations
app.get('/durable/routing/recommendations', async (c) => {
  try {
    const routerId = c.env.ROUTER_OBJECTS.idFromName('main-router');
    const routerStub = c.env.ROUTER_OBJECTS.get(routerId);
    
    const response = await routerStub.fetch('https://dummy-host/recommendations');
    const result = await response.json();
    
    return c.json({
      ...result,
      approach: 'smart-routing'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Save data directly to Durable Object with persistence
app.post('/durable/data/:orgId/:entityName/save', async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const data = await c.req.json();
    
    // Try entity-level first, fallback to org-level
    try {
      const entityObjectId = c.env.ENTITY_OBJECTS.idFromName(`${orgId}:${entityName}`);
      const entityStub = c.env.ENTITY_OBJECTS.get(entityObjectId);
      
      const response = await entityStub.fetch('https://dummy-host/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      return c.json({
        ...result,
        isolationLevel: 'entity-level',
        approach: 'durable-objects'
      });
    } catch {
      // Fallback to organization-level
      const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
      const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
      
      const response = await orgStub.fetch(`https://dummy-host/entity/${entityName}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      return c.json({
        ...result,
        isolationLevel: 'org-level',
        approach: 'durable-objects'
      });
    }
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Query data from Durable Objects
app.get('/durable/data/:orgId/:entityName', async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const limit = c.req.query('limit') || '20';
    
    // Try entity-level first, fallback to org-level
    try {
      const entityObjectId = c.env.ENTITY_OBJECTS.idFromName(`${orgId}:${entityName}`);
      const entityStub = c.env.ENTITY_OBJECTS.get(entityObjectId);
      
      const response = await entityStub.fetch(`https://dummy-host/records?limit=${limit}`);
      const result = await response.json();
      
      return c.json({
        ...result,
        isolationLevel: 'entity-level',
        approach: 'durable-objects'
      });
    } catch {
      // Fallback to organization-level
      const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
      const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
      
      const response = await orgStub.fetch(`https://dummy-host/entity/${entityName}/records?limit=${limit}`);
      const result = await response.json();
      
      return c.json({
        ...result,
        isolationLevel: 'org-level',
        approach: 'durable-objects'
      });
    }
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;