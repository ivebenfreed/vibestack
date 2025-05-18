import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PGliteDriver } from 'typeorm-pglite';
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { clientEntities } from "../generated/client-entities.js";

/**
 * Test to isolate if the issue is related to entity definitions
 */
async function testEntityDefinitions() {
  console.log('Starting entity definition test...');
  console.log('Client entities count:', clientEntities.length);
  
  // Log some basic info about each entity
  clientEntities.forEach((entity: any, index) => {
    let name = 'Unknown';
    if (typeof entity === 'function') {
      name = entity.name || 'Unnamed Function';
    } else if (entity && typeof entity === 'object') {
      name = (entity.options && entity.options.name) || 'Unnamed Object';
    }
    console.log(`Entity ${index}: ${name}`);
  });
  
  try {
    // Test with incrementally adding entities
    console.log('\nTest 1: Initialize with first entity only');
    const firstEntity = clientEntities[0];
    const datasource1 = new DataSource({
      type: "postgres",
      database: "test_entity_single",
      synchronize: false,
      logging: true,
      entities: [firstEntity],
      driver: new PGliteDriver({
        extensions: { uuid_ossp }
      }).driver
    });
    
    await datasource1.initialize();
    console.log('Datasource with first entity initialized successfully');
    await datasource1.destroy();
    
    // Test with all entities but with synchronize: false
    console.log('\nTest 2: Initialize with all entities, synchronize: false');
    const datasource2 = new DataSource({
      type: "postgres",
      database: "test_entity_all",
      synchronize: false,
      logging: true,
      entities: clientEntities,
      driver: new PGliteDriver({
        extensions: { uuid_ossp }
      }).driver
    });
    
    await datasource2.initialize();
    console.log('Datasource with all entities initialized successfully');
    
    // Try to use the entity-related functionality (migrations needs this)
    console.log('Getting metadata for all entities...');
    const entityMetadatas = datasource2.entityMetadatas;
    console.log(`Retrieved metadata for ${entityMetadatas.length} entities`);
    
    // Get the table names without trying to query them
    const tableNames = entityMetadatas.map(metadata => metadata.tableName);
    console.log('Table names:', tableNames);
    
    await datasource2.destroy();
    
    console.log('\nAll entity tests passed successfully');
  } catch (error) {
    console.error('Error during entity test:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Run the test function
testEntityDefinitions().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});