// Standalone server for Function Factory POC testing
// This bypasses npm install issues and runs the POC directly

import { createServer } from 'http';
import { URL } from 'url';

// Mock KV storage
class MockKV {
  constructor() {
    this.storage = new Map();
  }

  async put(key, value) {
    this.storage.set(key, value);
    console.log(`[KV PUT] ${key.slice(0, 50)}...`);
  }

  async get(key) {
    const value = this.storage.get(key);
    console.log(`[KV GET] ${key} = ${value ? 'found' : 'not found'}`);
    return value;
  }

  async list(options = {}) {
    const keys = Array.from(this.storage.keys());
    const filtered = options.prefix 
      ? keys.filter(k => k.startsWith(options.prefix))
      : keys;
    
    console.log(`[KV LIST] Found ${filtered.length} keys`);
    return { keys: filtered.map(name => ({ name })) };
  }
}

// Base primitives
const BASE_PRIMITIVES = {
  Project: {
    name: 'Project',
    coreFields: {
      id: 'string',
      name: 'string',
      description: 'string',
      status: 'enum',
      created_at: 'date',
      updated_at: 'date'
    },
    defaultStatus: 'draft',
    statusTransitions: ['draft', 'active', 'on_hold', 'completed', 'cancelled']
  },
  Task: {
    name: 'Task',
    coreFields: {
      id: 'string',
      title: 'string',
      description: 'string',
      priority: 'enum',
      status: 'enum',
      due_date: 'date',
      assigned_to: 'string',
      created_at: 'date',
      updated_at: 'date'
    },
    defaultStatus: 'todo',
    statusTransitions: ['todo', 'in_progress', 'review', 'done', 'cancelled']
  }
};

// Function Factory implementation
class FunctionFactory {
  constructor(env) {
    this.env = env;
  }

  async deployEntity(entityDef) {
    console.log(`🚀 Deploying: ${entityDef.name} for ${entityDef.orgId}`);
    
    const primitive = BASE_PRIMITIVES[entityDef.basePrimitive];
    if (!primitive) {
      throw new Error(`Unknown primitive: ${entityDef.basePrimitive}`);
    }

    const tableName = `${entityDef.orgId}_${entityDef.name.toLowerCase()}s`;
    const schema = {
      definition: entityDef,
      tableName,
      createdAt: new Date().toISOString(),
      version: 1
    };

    // Generate functions
    const functions = {
      validate: entityDef.businessLogic.validate || this.generateValidationFunction(entityDef, primitive),
      save: this.generateSaveFunction(entityDef, primitive),
      query: this.generateQueryFunction(entityDef, primitive)
    };

    // Store functions in KV
    for (const [fnName, code] of Object.entries(functions)) {
      const key = `fn:${entityDef.orgId}:${entityDef.name}:${fnName}`;
      await this.env.ENTITY_FUNCTIONS.put(key, code);
    }

    // Store schema
    const schemaKey = `schema:${entityDef.orgId}:${entityDef.name}`;
    await this.env.ENTITY_SCHEMAS.put(schemaKey, JSON.stringify(schema));

    const tableKey = `table:${entityDef.orgId}:${entityDef.name}`;
    await this.env.ENTITY_CONFIG.put(tableKey, tableName);

    console.log(`✅ Deployed: ${tableName}`);
    return schema;
  }

  generateValidationFunction(entityDef, primitive) {
    const validations = [];

    Object.entries(primitive.coreFields).forEach(([fieldName, fieldType]) => {
      if (fieldName !== 'id' && fieldName !== 'created_at' && fieldName !== 'updated_at') {
        validations.push(`if (!data.${fieldName}) errors.push('${fieldName} is required');`);
      }
    });

    Object.entries(entityDef.customFields || {}).forEach(([fieldName, fieldDef]) => {
      if (fieldDef.required) {
        validations.push(`if (!data.${fieldName}) errors.push('${fieldName} is required');`);
      }
      if (fieldDef.type === 'email') {
        validations.push(`if (data.${fieldName} && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.${fieldName})) errors.push('${fieldName} must be valid email');`);
      }
      if (fieldDef.type === 'url') {
        validations.push(`if (data.${fieldName}) { try { new URL(data.${fieldName}); } catch { errors.push('${fieldName} must be valid URL'); } }`);
      }
    });

    return `
      function validate(data) {
        const errors = [];
        ${validations.join(' ')}
        return { valid: errors.length === 0, errors: errors };
      }
      return validate(data);
    `;
  }

  generateSaveFunction(entityDef, primitive) {
    return `
      function save(data) {
        if (!data.id) data.id = 'uuid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        if (!data.created_at) data.created_at = now;
        data.updated_at = now;
        if (!data.status && '${primitive.defaultStatus}') data.status = '${primitive.defaultStatus}';
        
        const coreFields = {}, customFields = {};
        ${Object.keys(primitive.coreFields).map(f => `if (data.${f} !== undefined) coreFields.${f} = data.${f};`).join(' ')}
        ${Object.keys(entityDef.customFields || {}).map(f => `if (data.${f} !== undefined) customFields.${f} = data.${f};`).join(' ')}
        
        return { ...coreFields, custom_data: customFields };
      }
      return save(data);
    `;
  }

  generateQueryFunction(entityDef, primitive) {
    return `
      function query(filters = {}) {
        return {
          table: '${entityDef.orgId}_${entityDef.name.toLowerCase()}s',
          filters: filters,
          coreFields: ${JSON.stringify(Object.keys(primitive.coreFields))},
          customFields: ${JSON.stringify(Object.keys(entityDef.customFields || {}))}
        };
      }
      return query(filters);
    `;
  }

  async executeFunction(orgId, entityName, operation, data) {
    try {
      const functionKey = `fn:${orgId}:${entityName}:${operation}`;
      const code = await this.env.ENTITY_FUNCTIONS.get(functionKey);

      if (!code) {
        return { success: false, error: `Function not found: ${functionKey}` };
      }

      const result = this.executeFunctionCode(code, data);
      return { success: true, result: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  executeFunctionCode(code, data) {
    const safeContext = {
      console: console,
      crypto: { randomUUID: () => 'uuid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) },
      data: data,
      filters: data,
      URL: URL
    };

    return Function('console', 'crypto', 'data', 'filters', 'URL', code)(
      safeContext.console,
      safeContext.crypto,
      safeContext.data,
      safeContext.filters,
      safeContext.URL
    );
  }

  async listOrgEntities(orgId) {
    const prefix = `schema:${orgId}:`;
    const list = await this.env.ENTITY_SCHEMAS.list({ prefix });
    return list.keys.map(key => key.name.replace(prefix, ''));
  }
}

// Mock environment
const mockEnv = {
  ENTITY_FUNCTIONS: new MockKV(),
  ENTITY_SCHEMAS: new MockKV(),
  ENTITY_CONFIG: new MockKV()
};

const factory = new FunctionFactory(mockEnv);

// HTTP server with API routes
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Helper to get request body
  const getBody = () => new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body ? JSON.parse(body) : {}));
  });

  try {
    // Health check
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Function Factory POC OK');
      return;
    }

    // List primitives
    if (url.pathname === '/primitives') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ primitives: Object.values(BASE_PRIMITIVES) }));
      return;
    }

    // Deploy entity
    if (url.pathname === '/factory/deploy' && req.method === 'POST') {
      const entityDef = await getBody();
      const schema = await factory.deployEntity(entityDef);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Entity deployed successfully', schema }));
      return;
    }

    // Execute entity function
    const entityMatch = url.pathname.match(/^\/entity\/([^\/]+)\/([^\/]+)\/([^\/]+)$/);
    if (entityMatch && req.method === 'POST') {
      const [, orgId, entityName, operation] = entityMatch;
      const data = await getBody();
      const result = await factory.executeFunction(orgId, entityName, operation, data);
      res.writeHead(result.success ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // Get entity schema
    const schemaMatch = url.pathname.match(/^\/schema\/([^\/]+)\/([^\/]+)$/);
    if (schemaMatch && req.method === 'GET') {
      const [, orgId, entityName] = schemaMatch;
      const schemaKey = `schema:${orgId}:${entityName}`;
      const schemaJson = await mockEnv.ENTITY_SCHEMAS.get(schemaKey);
      if (schemaJson) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ schema: JSON.parse(schemaJson) }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Schema not found' }));
      }
      return;
    }

    // List org entities
    const entitiesMatch = url.pathname.match(/^\/org\/([^\/]+)\/entities$/);
    if (entitiesMatch && req.method === 'GET') {
      const [, orgId] = entitiesMatch;
      const entities = await factory.listOrgEntities(orgId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ entities }));
      return;
    }

    // Debug functions
    if (url.pathname === '/debug/functions') {
      const functionsList = await mockEnv.ENTITY_FUNCTIONS.list();
      const schemasList = await mockEnv.ENTITY_SCHEMAS.list();
      const configList = await mockEnv.ENTITY_CONFIG.list();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        functions: functionsList.keys.map(k => k.name),
        schemas: schemasList.keys.map(k => k.name),
        config: configList.keys.map(k => k.name)
      }));
      return;
    }

    // Debug: Get specific function code
    const debugFunctionMatch = url.pathname.match(/^\/debug\/function\/(.+)$/);
    if (debugFunctionMatch && req.method === 'GET') {
      const functionKey = decodeURIComponent(debugFunctionMatch[1]);
      const code = await mockEnv.ENTITY_FUNCTIONS.get(functionKey);
      
      if (code) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ key: functionKey, code }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Function not found' }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

const PORT = 8788;

server.listen(PORT, () => {
  console.log('🚀 Function Factory POC Server Started');
  console.log('=====================================');
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/primitives`);
  console.log(`  POST http://localhost:${PORT}/factory/deploy`);
  console.log(`  POST http://localhost:${PORT}/entity/:orgId/:entityName/:operation`);
  console.log(`  GET  http://localhost:${PORT}/schema/:orgId/:entityName`);
  console.log(`  GET  http://localhost:${PORT}/org/:orgId/entities`);
  console.log(`  GET  http://localhost:${PORT}/debug/functions`);
  console.log('');
  console.log('✅ Ready for testing!');
});