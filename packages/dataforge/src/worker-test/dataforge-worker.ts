/**
 * Test worker for DataForge generation
 * Tests that TypeORM decorators and metadata work in worker environment
 */

// Worker environment check
if (typeof self === 'undefined') {
  throw new Error('This script must run in a Worker environment');
}

// Import TypeORM decorators and metadata utilities
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { MetadataFilter } from '../utils/metadata-filter.js';

// Test imports of our entities
import '../entities/index.js';

interface WorkerRequest {
  type: 'generate' | 'test-metadata' | 'health-check';
  payload?: any;
}

interface WorkerResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Worker message handler
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data;
  
  try {
    let response: WorkerResponse;
    
    switch (type) {
      case 'health-check':
        response = {
          success: true,
          data: { status: 'healthy', timestamp: Date.now() }
        };
        break;
        
      case 'test-metadata':
        response = await testMetadataExtraction();
        break;
        
      case 'generate':
        response = await runGeneration(payload);
        break;
        
      default:
        response = {
          success: false,
          error: `Unknown request type: ${type}`
        };
    }
    
    self.postMessage(response);
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

async function testMetadataExtraction(): Promise<WorkerResponse> {
  try {
    // Test TypeORM metadata extraction
    const metadataStorage = getMetadataArgsStorage();
    const filter = new MetadataFilter();
    
    // Get all entities
    const entities = filter.getAllEntities();
    const entityNames = entities.map(e => e.target.name);
    
    // Get sample entity metadata
    const sampleEntity = entities[0];
    if (!sampleEntity) {
      throw new Error('No entities found');
    }
    
    const columns = filter.getColumnsForEntity(sampleEntity.target);
    const relations = filter.getRelationsForEntity(sampleEntity.target);
    
    return {
      success: true,
      data: {
        totalEntities: entities.length,
        entityNames,
        sampleEntity: {
          name: sampleEntity.target.name,
          tableName: sampleEntity.name,
          columnCount: columns.length,
          relationCount: relations.length
        },
        metadataStats: {
          tables: metadataStorage.tables.length,
          columns: metadataStorage.columns.length,
          relations: metadataStorage.relations.length,
          indices: metadataStorage.indices.length
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Metadata extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function runGeneration(options?: { type?: 'entities' | 'drizzle' | 'dexie' }): Promise<WorkerResponse> {
  try {
    const generationType = options?.type || 'entities';
    
    // Import generation scripts dynamically to test they work in worker
    switch (generationType) {
      case 'entities': {
        // Test entity generation logic (without file I/O)
        const filter = new MetadataFilter();
        const entities = filter.getAllEntities();
        
        const clientEntities = entities.filter(e => !filter.isServerOnly(e.target));
        const serverEntities = entities.filter(e => !filter.isClientOnly(e.target));
        
        return {
          success: true,
          data: {
            type: 'entities',
            clientEntities: clientEntities.length,
            serverEntities: serverEntities.length,
            totalEntities: entities.length
          }
        };
      }
      
      case 'drizzle': {
        // Test Drizzle schema generation logic
        const filter = new MetadataFilter();
        const entities = filter.getAllEntities();
        
        // Test that we can process entity metadata for Drizzle
        const processedEntities = entities.map(entity => {
          const columns = filter.getColumnsForEntity(entity.target);
          const relations = filter.getRelationsForEntity(entity.target);
          
          return {
            name: entity.target.name,
            tableName: entity.name,
            columnCount: columns.length,
            relationCount: relations.length
          };
        });
        
        return {
          success: true,
          data: {
            type: 'drizzle',
            processedEntities,
            totalProcessed: processedEntities.length
          }
        };
      }
      
      case 'dexie': {
        // Test Dexie schema generation logic
        const filter = new MetadataFilter();
        const clientEntities = filter.getAllEntities().filter(e => !filter.isServerOnly(e.target));
        
        const dexieProcessed = clientEntities.map(entity => {
          const columns = filter.getColumnsForEntity(entity.target);
          const relations = filter.getRelationsForEntity(entity.target);
          
          // Test index detection logic
          const indexes = columns.filter(col => {
            return col.options?.primary || 
                   col.options?.unique || 
                   relations.some(rel => rel.propertyName === col.propertyName);
          });
          
          return {
            name: entity.target.name,
            columnCount: columns.length,
            indexCount: indexes.length,
            relationCount: relations.length
          };
        });
        
        return {
          success: true,
          data: {
            type: 'dexie',
            clientEntities: dexieProcessed,
            totalProcessed: dexieProcessed.length
          }
        };
      }
      
      default:
        return {
          success: false,
          error: `Unknown generation type: ${generationType}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Signal that worker is ready
self.postMessage({ 
  success: true, 
  data: { 
    status: 'ready',
    timestamp: Date.now(),
    environment: 'worker'
  } 
});