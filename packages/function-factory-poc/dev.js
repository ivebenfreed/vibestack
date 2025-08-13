// Simple Node.js dev server for Function Factory POC
// This runs our Hono app directly in Node.js for testing

import { serve } from '@hono/node-server';
import app from './src/index.js';

// Mock environment for Node.js
const mockEnv = {
  ENTITY_FUNCTIONS: createMockKV(),
  ENTITY_SCHEMAS: createMockKV(),
  ENTITY_CONFIG: createMockKV()
};

// Create mock KV namespace
function createMockKV() {
  const storage = new Map();
  
  return {
    async put(key, value) {
      storage.set(key, value);
      console.log(`[KV PUT] ${key}`);
    },
    
    async get(key) {
      const value = storage.get(key);
      console.log(`[KV GET] ${key} = ${value ? 'found' : 'not found'}`);
      return value;
    },
    
    async list(options = {}) {
      const keys = Array.from(storage.keys());
      const filtered = options.prefix 
        ? keys.filter(k => k.startsWith(options.prefix))
        : keys;
      
      console.log(`[KV LIST] Found ${filtered.length} keys with prefix "${options.prefix || ''}"`);
      return { keys: filtered.map(name => ({ name })) };
    }
  };
}

// Override the Hono context to include our mock environment
const originalApp = app;

const wrappedApp = {
  fetch: async (request, env, ctx) => {
    // Add mock environment
    const mockContext = {
      env: mockEnv,
      req: { 
        param: () => ({}),
        json: () => ({})
      }
    };
    
    return originalApp.fetch(request, mockEnv, ctx);
  }
};

const port = 8788;

console.log('🚀 Starting Function Factory POC Dev Server');
console.log('============================================');
console.log(`Server will run on: http://localhost:${port}`);
console.log('Available endpoints:');
console.log('  GET  /health                              - Health check');
console.log('  GET  /primitives                          - List available primitives');
console.log('  POST /factory/deploy                      - Deploy new entity');
console.log('  POST /entity/:orgId/:entityName/:operation - Execute entity function');
console.log('  GET  /schema/:orgId/:entityName           - Get entity schema');
console.log('  GET  /org/:orgId/entities                 - List org entities');
console.log('  GET  /debug/functions                     - Debug: list stored functions');
console.log('\nStarting server...\n');

serve({
  fetch: app.fetch.bind({ env: mockEnv }),
  port
});

console.log(`✅ Function Factory POC running on http://localhost:${port}`);