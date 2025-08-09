/**
 * Pure reflect-metadata DataForge worker
 * Tests generation without any TypeORM imports
 */

import 'reflect-metadata';
import { ReflectMetadataReader } from '../utils/reflect-metadata-reader.js';

// NOTE: NOT importing entities to avoid TypeORM dependencies
// In production, entity metadata would be pre-registered

// Get entity classes from global scope (they're registered by imports)
function getEntityClasses(): Function[] {
  const entities: Function[] = [];
  
  // In a real worker, we'd need to manually register these
  // For now, let's create some test entities to prove the concept
  return entities;
}

// Test entity with pure reflect-metadata (no TypeORM)
class TestUser {
  id!: string;
  name!: string;
  email!: string;
}

// Store metadata using reflect-metadata directly
Reflect.defineMetadata('custom:table', { name: 'users' }, TestUser);
Reflect.defineMetadata('custom:columns', [
  { propertyName: 'id', options: { type: 'uuid', primary: true } },
  { propertyName: 'name', options: { type: 'varchar', length: 100 } },
  { propertyName: 'email', options: { type: 'varchar', length: 255, unique: true } }
], TestUser);
Reflect.defineMetadata('custom:table-category', 'domain', TestUser);

class TestProject {
  id!: string;
  name!: string;
  ownerId!: string;
}

Reflect.defineMetadata('custom:table', { name: 'projects' }, TestProject);
Reflect.defineMetadata('custom:columns', [
  { propertyName: 'id', options: { type: 'uuid', primary: true } },
  { propertyName: 'name', options: { type: 'varchar', length: 100 } },
  { propertyName: 'ownerId', options: { type: 'uuid' } }
], TestProject);
Reflect.defineMetadata('custom:relations', [
  { propertyName: 'owner', relationType: 'many-to-one', type: TestUser }
], TestProject);
Reflect.defineMetadata('custom:table-category', 'domain', TestProject);

interface WorkerRequest {
  type: 'health' | 'metadata' | 'test-generation' | 'stats';
}

interface WorkerResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const requestType = url.searchParams.get('type') as WorkerRequest['type'] || 'health';
      
      let result: WorkerResponse;
      
      switch (requestType) {
        case 'health':
          result = await healthCheck();
          break;
          
        case 'metadata':
          result = await testMetadata();
          break;
          
        case 'test-generation':
          result = await testGeneration();
          break;
          
        case 'stats':
          result = await getStats();
          break;
          
        default:
          result = {
            success: false,
            error: `Unknown request type: ${requestType}`,
            timestamp: Date.now()
          };
      }
      
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: Date.now()
      }, null, 2), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  },
};

async function healthCheck(): Promise<WorkerResponse> {
  return {
    success: true,
    data: {
      status: 'healthy',
      environment: 'cloudflare-worker-pure-reflect',
      hasReflectMetadata: typeof Reflect.getMetadata === 'function',
      approach: 'pure-reflect-metadata'
    },
    timestamp: Date.now()
  };
}

async function testMetadata(): Promise<WorkerResponse> {
  try {
    const reader = new ReflectMetadataReader();
    
    // Register test entities
    reader.registerEntity(TestUser);
    reader.registerEntity(TestProject);
    
    const entities = reader.getAllEntities();
    const sampleEntity = entities[0];
    
    if (!sampleEntity) {
      throw new Error('No entities found');
    }
    
    const columns = reader.getColumnsForEntity(sampleEntity.target);
    const relations = reader.getRelationsForEntity(sampleEntity.target);
    
    return {
      success: true,
      data: {
        totalEntities: entities.length,
        entityNames: entities.map(e => e.name),
        sampleEntity: {
          name: sampleEntity.name,
          tableName: sampleEntity.tableName,
          columnCount: columns.length,
          relationCount: relations.length,
          columns: columns.map(c => ({
            name: c.propertyName,
            type: c.options.type,
            primary: c.options.primary
          }))
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      error: `Metadata test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now()
    };
  }
}

async function testGeneration(): Promise<WorkerResponse> {
  try {
    const reader = new ReflectMetadataReader();
    reader.registerEntity(TestUser);
    reader.registerEntity(TestProject);
    
    const entities = reader.getAllEntities();
    const clientEntities = reader.getClientEntities();
    
    // Test entity generation
    const clientDomainTables = clientEntities
      .filter(e => reader.isDomainTable(e.target))
      .map(e => e.tableName);
    
    // Test Drizzle generation
    const drizzleSchema = entities.map(entity => {
      const columns = reader.getColumnsForEntity(entity.target);
      const columnDefs = columns.map(col => {
        let type = 'text';
        if (col.options.type === 'uuid') type = 'uuid';
        else if (col.options.type === 'varchar') type = `varchar({ length: ${col.options.length || 255} })`;
        
        return `${col.propertyName}: ${type}()${col.options.primary ? '.primaryKey()' : ''}${col.options.unique ? '.unique()' : ''}`;
      }).join(',\n  ');
      
      return `export const ${entity.tableName} = pgTable('${entity.tableName}', {\n  ${columnDefs}\n});`;
    }).join('\n\n');
    
    // Test Dexie generation
    const dexieSchema = clientEntities.map(entity => {
      const columns = reader.getColumnsForEntity(entity.target);
      const indexes = columns
        .filter(col => col.options.primary || col.options.unique)
        .map(col => col.propertyName);
      
      return `${entity.tableName}: '${indexes.join(', ')}'`;
    }).join(',\n  ');
    
    return {
      success: true,
      data: {
        type: 'generation-test',
        entities: entities.length,
        clientDomainTables,
        sampleDrizzleSchema: drizzleSchema,
        sampleDexieSchema: `this.version(1).stores({\n  ${dexieSchema}\n});`
      },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      error: `Generation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now()
    };
  }
}

async function getStats(): Promise<WorkerResponse> {
  try {
    const reader = new ReflectMetadataReader();
    reader.registerEntity(TestUser);
    reader.registerEntity(TestProject);
    
    const allEntities = reader.getAllEntities();
    const clientEntities = reader.getClientEntities();
    const serverEntities = reader.getServerEntities();
    const junctionTables = reader.getJunctionTables();
    
    return {
      success: true,
      data: {
        total: allEntities.length,
        client: clientEntities.length,
        server: serverEntities.length,
        junctions: junctionTables.length,
        entities: allEntities.map(e => ({
          name: e.name,
          tableName: e.tableName,
          isDomain: reader.isDomainTable(e.target),
          isServerOnly: reader.isServerOnly(e.target),
          isClientOnly: reader.isClientOnly(e.target)
        }))
      },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      error: `Stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now()
    };
  }
}