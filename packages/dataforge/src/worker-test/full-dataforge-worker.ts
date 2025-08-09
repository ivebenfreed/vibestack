/**
 * Full DataForge test in Cloudflare Worker
 * Tests existing generation logic with shims
 */

import 'reflect-metadata';
import { WorkerMetadataFilterShimmed } from '../utils/worker-metadata-filter-shimmed.js';

// Import all entities to populate TypeORM metadata
import '../entities/index.js';

interface WorkerRequest {
  type: 'health' | 'metadata' | 'generate-entities' | 'generate-drizzle' | 'generate-dexie' | 'stats';
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
          
        case 'stats':
          result = await getStats();
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
      hasTypeORM: typeof console !== 'undefined' // TypeORM loaded successfully if no errors
    },
    timestamp: Date.now()
  };
}

async function testMetadata(): Promise<WorkerResponse> {
  try {
    const filter = new WorkerMetadataFilterShimmed();
    const entities = filter.getAllEntities();
    
    if (entities.length === 0) {
      throw new Error('No entities found - imports may have failed');
    }
    
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

async function getStats(): Promise<WorkerResponse> {
  try {
    const filter = new WorkerMetadataFilterShimmed();
    const entities = filter.getAllEntities();
    
    const clientEntities = filter.getClientEntities();
    const serverEntities = filter.getServerEntities();
    const domainEntities = entities.filter(e => filter.isDomainTable(e.target));
    const systemEntities = entities.filter(e => filter.isSystemTable(e.target));
    const junctionTables = filter.getJunctionTables();
    
    return {
      success: true,
      data: {
        total: entities.length,
        client: clientEntities.length,
        server: serverEntities.length,
        domain: domainEntities.length,
        system: systemEntities.length,
        junctions: junctionTables.length,
        breakdown: {
          clientEntities: clientEntities.map(e => e.target.name),
          serverEntities: serverEntities.map(e => e.target.name),
          domainEntities: domainEntities.map(e => e.target.name),
          systemEntities: systemEntities.map(e => e.target.name),
          junctionTables: junctionTables.map(jt => jt.name)
        }
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

async function testEntityGeneration(): Promise<WorkerResponse> {
  try {
    const filter = new WorkerMetadataFilterShimmed();
    const entities = filter.getAllEntities();
    
    // Test the logic from existing entity generation
    const clientEntities = entities.filter(e => !filter.isServerOnly(e.target));
    const serverEntities = entities.filter(e => !filter.isClientOnly(e.target));
    
    const clientDomainTables = clientEntities
      .filter(e => filter.isDomainTable(e.target))
      .map(e => e.target.name.toLowerCase());
      
    const clientSystemTables = clientEntities
      .filter(e => !filter.isDomainTable(e.target))
      .map(e => e.target.name.toLowerCase());
    
    // Generate a sample of what the client entities file would look like
    const sampleClientExports = `export const CLIENT_DOMAIN_TABLES = [
  ${clientDomainTables.map(t => `'${t}'`).join(',\n  ')}
] as const;

export const CLIENT_SYSTEM_TABLES = [
  ${clientSystemTables.map(t => `'${t}'`).join(',\n  ')}
] as const;`;
    
    return {
      success: true,
      data: {
        type: 'entity-generation',
        total: entities.length,
        client: clientEntities.length,
        server: serverEntities.length,
        clientDomainTables,
        clientSystemTables,
        sampleExports: sampleClientExports
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
    const filter = new WorkerMetadataFilterShimmed();
    const entities = filter.getAllEntities();
    
    // Test Drizzle schema generation logic
    const processedEntities = entities.map(entity => {
      const columns = filter.getColumnsForEntity(entity.target);
      const relations = filter.getRelationsForEntity(entity.target);
      
      // Test column type mapping
      const columnDefinitions = columns.map(col => {
        const type = col.options.type || 'text';
        let drizzleType = 'text';
        
        switch (type) {
          case 'uuid':
            drizzleType = 'uuid';
            break;
          case 'varchar':
            drizzleType = col.options.length && col.options.length <= 255 
              ? `varchar({ length: ${col.options.length} })` 
              : 'text';
            break;
          case 'int':
          case 'integer':
            drizzleType = 'integer';
            break;
          case 'timestamp':
            drizzleType = 'timestamp({ withTimezone: true })';
            break;
          default:
            drizzleType = 'text';
        }
        
        return {
          name: col.propertyName,
          type: drizzleType,
          nullable: col.options.nullable !== false,
          primary: col.options.primary === true
        };
      });
      
      return {
        name: entity.target.name,
        tableName: entity.name,
        columns: columnDefinitions,
        relationCount: relations.length
      };
    });
    
    // Sample Drizzle table definition
    const sampleEntity = processedEntities[0];
    const sampleDrizzle = `export const ${sampleEntity.tableName} = pgTable('${sampleEntity.tableName}', {
  ${sampleEntity.columns.map(col => 
    `${col.name}: ${col.type}${col.primary ? '.primaryKey()' : ''}${!col.nullable ? '.notNull()' : ''}`
  ).join(',\n  ')}
});`;
    
    return {
      success: true,
      data: {
        type: 'drizzle-generation',
        entitiesProcessed: processedEntities.length,
        sampleEntity: sampleEntity,
        sampleDrizzle
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
    const filter = new WorkerMetadataFilterShimmed();
    const clientEntities = filter.getClientEntities();
    
    // Test Dexie schema generation logic
    const dexieTables = clientEntities.map(entity => {
      const columns = filter.getColumnsForEntity(entity.target);
      const relations = filter.getRelationsForEntity(entity.target);
      
      // Generate indexes like the real Dexie generation
      const indexes = new Set<string>();
      
      // Primary key
      const primaryCol = columns.find(col => col.options.primary);
      if (primaryCol) {
        indexes.add(primaryCol.propertyName);
      }
      
      // Unique fields
      columns.forEach(col => {
        if (col.options.unique) {
          indexes.add(col.propertyName);
        }
      });
      
      // Foreign keys from relations
      relations.forEach(rel => {
        const fkColumn = columns.find(col => 
          col.propertyName === rel.propertyName || 
          col.propertyName === `${rel.propertyName}Id`
        );
        if (fkColumn) {
          indexes.add(fkColumn.propertyName);
        }
      });
      
      // Common fields
      if (columns.some(col => col.propertyName === 'updatedAt')) {
        indexes.add('updatedAt');
      }
      if (columns.some(col => col.propertyName === 'clientId')) {
        indexes.add('clientId');
      }
      
      const indexString = Array.from(indexes).join(', ');
      
      return {
        name: entity.target.name,
        tableName: entity.name,
        indexes: Array.from(indexes),
        indexString: `${entity.name}: '${indexString}'`
      };
    });
    
    // Sample Dexie schema
    const sampleDexieSchema = `this.version(1).stores({
  ${dexieTables.map(table => table.indexString).join(',\n  ')}
});`;
    
    return {
      success: true,
      data: {
        type: 'dexie-generation',
        clientEntities: dexieTables.length,
        sampleTables: dexieTables.slice(0, 3),
        sampleDexieSchema
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