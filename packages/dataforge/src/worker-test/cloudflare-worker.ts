/**
 * Cloudflare Worker test for DataForge
 * Tests that TypeORM decorators and generation work in CF Workers environment
 */

// Cloudflare Workers environment
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { WorkerMetadataFilter } from '../utils/worker-metadata-filter.js';

// Import entities to test metadata loading
import '../entities/index.js';

interface WorkerRequest {
  type: 'health' | 'metadata' | 'generate-entities' | 'generate-drizzle' | 'generate-dexie';
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
          
        case 'generate-entities':
          result = await testEntityGeneration();
          break;
          
        case 'generate-drizzle':
          result = await testDrizzleGeneration();
          break;
          
        case 'generate-dexie':
          result = await testDexieGeneration();
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
      environment: 'cloudflare-worker',
      hasReflectMetadata: typeof Reflect.getMetadata === 'function',
      hasTypeORM: typeof getMetadataArgsStorage === 'function'
    },
    timestamp: Date.now()
  };
}

async function testMetadata(): Promise<WorkerResponse> {
  try {
    // Test TypeORM metadata storage in CF Workers
    const metadataStorage = getMetadataArgsStorage();
    const filter = new WorkerMetadataFilter();
    
    // Get entities
    const entities = filter.getAllEntities();
    
    if (entities.length === 0) {
      throw new Error('No entities found - imports may have failed');
    }
    
    // Test metadata extraction
    const sampleEntity = entities[0];
    const columns = filter.getColumnsForEntity(sampleEntity.target);
    const relations = filter.getRelationsForEntity(sampleEntity.target);
    const indices = filter.getIndicesForEntity(sampleEntity.target);
    
    return {
      success: true,
      data: {
        totalEntities: entities.length,
        entityNames: entities.map(e => e.target.name),
        sampleEntity: {
          name: sampleEntity.target.name,
          tableName: sampleEntity.name,
          columnCount: columns.length,
          relationCount: relations.length,
          indexCount: indices.length
        },
        metadataStats: {
          tables: metadataStorage.tables.length,
          columns: metadataStorage.columns.length,
          relations: metadataStorage.relations.length,
          indices: metadataStorage.indices.length,
          joinTables: metadataStorage.joinTables.length,
          joinColumns: metadataStorage.joinColumns.length
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

async function testEntityGeneration(): Promise<WorkerResponse> {
  try {
    const filter = new WorkerMetadataFilter();
    const entities = filter.getAllEntities();
    
    // Separate client and server entities
    const clientEntities = entities.filter(e => !filter.isServerOnly(e.target));
    const serverEntities = entities.filter(e => !filter.isClientOnly(e.target));
    
    // Test domain vs system classification
    const domainEntities = entities.filter(e => filter.isDomainTable(e.target));
    const systemEntities = entities.filter(e => filter.isSystemTable(e.target));
    
    return {
      success: true,
      data: {
        type: 'entity-generation',
        total: entities.length,
        client: clientEntities.length,
        server: serverEntities.length,
        domain: domainEntities.length,
        system: systemEntities.length,
        breakdown: {
          clientEntities: clientEntities.map(e => e.target.name),
          serverEntities: serverEntities.map(e => e.target.name),
          domainEntities: domainEntities.map(e => e.target.name),
          systemEntities: systemEntities.map(e => e.target.name)
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      error: `Entity generation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now()
    };
  }
}

async function testDrizzleGeneration(): Promise<WorkerResponse> {
  try {
    const filter = new WorkerMetadataFilter();
    const entities = filter.getAllEntities();
    
    // Test processing entities for Drizzle schema
    const processedEntities = entities.map(entity => {
      const columns = filter.getColumnsForEntity(entity.target);
      const relations = filter.getRelationsForEntity(entity.target);
      const indices = filter.getIndicesForEntity(entity.target);
      
      // Test column type mapping (simplified)
      const columnTypes = columns.map(col => ({
        name: col.propertyName,
        type: col.options.type || 'text',
        nullable: col.options.nullable !== false,
        primary: col.options.primary === true,
        unique: col.options.unique === true
      }));
      
      return {
        name: entity.target.name,
        tableName: entity.name,
        columns: columnTypes,
        relationCount: relations.length,
        indexCount: indices.length
      };
    });
    
    // Test junction table detection
    const junctionTables = filter.getJunctionTables();
    
    return {
      success: true,
      data: {
        type: 'drizzle-generation',
        entitiesProcessed: processedEntities.length,
        junctionTables: junctionTables.length,
        sampleEntity: processedEntities[0],
        junctionTableNames: junctionTables.map(jt => jt.name)
      },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      error: `Drizzle generation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now()
    };
  }
}

async function testDexieGeneration(): Promise<WorkerResponse> {
  try {
    const filter = new WorkerMetadataFilter();
    const entities = filter.getAllEntities();
    
    // Filter client entities only
    const clientEntities = entities.filter(e => !filter.isServerOnly(e.target));
    
    // Test Dexie schema processing
    const dexieProcessed = clientEntities.map(entity => {
      const columns = filter.getColumnsForEntity(entity.target);
      const relations = filter.getRelationsForEntity(entity.target);
      
      // Test index detection for Dexie
      const primaryKey = columns.find(col => col.options.primary);
      const uniqueFields = columns.filter(col => col.options.unique);
      const foreignKeys = relations.map(rel => rel.propertyName);
      
      // Mock index generation logic
      const indexes = [
        primaryKey?.propertyName,
        ...uniqueFields.map(f => f.propertyName),
        ...foreignKeys,
        'updatedAt', // Common field
        'clientId'   // Common field
      ].filter((index, i, arr) => index && arr.indexOf(index) === i);
      
      return {
        name: entity.target.name,
        tableName: entity.name,
        columnCount: columns.length,
        relationCount: relations.length,
        indexes: indexes,
        indexString: indexes.join(', ')
      };
    });
    
    return {
      success: true,
      data: {
        type: 'dexie-generation',
        clientEntities: dexieProcessed.length,
        totalEntities: entities.length,
        sampleDexieEntity: dexieProcessed[0],
        allDexieTables: dexieProcessed.map(e => ({
          name: e.name,
          indexCount: e.indexes.length
        }))
      },
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      error: `Dexie generation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now()
    };
  }
}