import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PGliteDriver } from 'typeorm-pglite';
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

/**
 * Test specifically for TypeORM and PGlite integration
 * This isolates the interaction between TypeORM and PGlite without our custom entities
 */
async function testTypeORMPGlite() {
  console.log('Starting TypeORM-PGlite integration test...');
  
  try {
    // Test 1: Basic TypeORM with PGlite (No Entities)
    console.log('Test 1: Basic TypeORM with PGlite (No Entities)');
    const datasource1 = new DataSource({
      type: "postgres", // Use postgres type for TypeORM compatibility
      database: "test_basic",
      synchronize: false,
      logging: true,
      // No entities defined
      driver: new PGliteDriver().driver
    });
    
    console.log('Initializing basic datasource...');
    await datasource1.initialize();
    console.log('Basic datasource initialized successfully');
    
    // Run a simple query
    const version = await datasource1.query('SELECT version()');
    console.log('Version query result:', version);
    
    await datasource1.destroy();
    console.log('Basic datasource closed');
    
    // Test 2: TypeORM with PGlite with file persistence
    console.log('Test 2: TypeORM with PGlite with file persistence');
    const datasource2 = new DataSource({
      type: "postgres",
      database: "test_file",
      synchronize: false,
      logging: true,
      driver: new PGliteDriver({
        dataDir: './pgdata/typeorm-test'
      }).driver
    });
    
    console.log('Initializing datasource with file persistence...');
    await datasource2.initialize();
    console.log('Datasource with file persistence initialized successfully');
    await datasource2.destroy();
    console.log('Datasource with file persistence closed');
    
    // Test 3: TypeORM with PGlite with uuid_ossp extension
    console.log('Test 3: TypeORM with PGlite with uuid_ossp extension');
    const datasource3 = new DataSource({
      type: "postgres",
      database: "test_uuid",
      synchronize: false,
      logging: true,
      driver: new PGliteDriver({
        extensions: { uuid_ossp }
      }).driver
    });
    
    console.log('Initializing datasource with uuid_ossp extension...');
    await datasource3.initialize();
    console.log('Datasource with uuid_ossp extension initialized successfully');
    await datasource3.destroy();
    console.log('Datasource with uuid_ossp extension closed');
    
    // Test 4: TypeORM with migration-related functionality
    console.log('Test 4: TypeORM with migration-related functionality');
    const datasource4 = new DataSource({
      type: "postgres",
      database: "test_migrations",
      synchronize: false,
      logging: true,
      migrations: [],
      migrationsTableName: "migrations",
      driver: new PGliteDriver({
        extensions: { uuid_ossp },
        dataDir: './pgdata/migration-test'
      }).driver
    });
    
    console.log('Initializing datasource with migration config...');
    await datasource4.initialize();
    console.log('Datasource with migration config initialized successfully');
    
    // Test migration functionality
    console.log('Testing migration functionality...');
    // Using query directly instead of schema builder
    // See if we can query migration related tables
    const migrationsMetadata = await datasource4.query(`SELECT * FROM pg_catalog.pg_tables`);
    console.log('Migration tables metadata:', migrationsMetadata);
    
    await datasource4.destroy();
    console.log('Datasource with migration config closed');
    
    console.log('All TypeORM-PGlite tests passed successfully');
  } catch (error) {
    console.error('Error during TypeORM-PGlite test:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Run the test function
testTypeORMPGlite().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});