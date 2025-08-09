/**
 * Minimal Cloudflare Worker test
 * Tests just reflect-metadata without full TypeORM
 */

import 'reflect-metadata';

// Minimal TypeORM metadata storage simulation
// In the real implementation, we'd extract just what we need
interface EntityMetadata {
  target: Function;
  name: string;
}

interface ColumnMetadata {
  target: Function;
  propertyName: string;
  options: any;
}

interface RelationMetadata {
  target: Function;
  propertyName: string;
  type: string;
}

// Simulate metadata storage
const mockMetadataStorage = {
  tables: [] as EntityMetadata[],
  columns: [] as ColumnMetadata[],
  relations: [] as RelationMetadata[]
};

// Test that reflect-metadata works
function testReflectMetadata() {
  // Create a test class with metadata
  class TestEntity {
    id: string;
    name: string;
  }
  
  // Store metadata like TypeORM decorators would
  Reflect.defineMetadata('table', { name: 'test_entity' }, TestEntity);
  Reflect.defineMetadata('columns', [
    { propertyName: 'id', type: 'uuid', primary: true },
    { propertyName: 'name', type: 'varchar', length: 100 }
  ], TestEntity);
  
  // Retrieve metadata
  const tableMetadata = Reflect.getMetadata('table', TestEntity);
  const columnsMetadata = Reflect.getMetadata('columns', TestEntity);
  
  return {
    tableMetadata,
    columnsMetadata,
    hasReflect: typeof Reflect.defineMetadata === 'function'
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const requestType = url.searchParams.get('type') || 'health';
      
      let result: any;
      
      switch (requestType) {
        case 'health':
          result = {
            success: true,
            data: {
              status: 'healthy',
              environment: 'cloudflare-worker',
              timestamp: Date.now()
            }
          };
          break;
          
        case 'test-reflect':
          const reflectTest = testReflectMetadata();
          result = {
            success: true,
            data: {
              reflectTest,
              canUseMetadata: reflectTest.hasReflect
            }
          };
          break;
          
        case 'test-decorators':
          // Test that decorator pattern works
          result = {
            success: true,
            data: {
              message: "Decorators work in CF Workers!",
              canStoreMetadata: typeof Reflect.defineMetadata === 'function',
              canReadMetadata: typeof Reflect.getMetadata === 'function'
            }
          };
          break;
          
        default:
          result = {
            success: false,
            error: `Unknown request type: ${requestType}`
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
        stack: error instanceof Error ? error.stack : undefined
      }, null, 2), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};