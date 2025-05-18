import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PGliteDriver } from 'typeorm-pglite';
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { clientEntities } from "../generated/client-entities.js";

/**
 * Test specifically focusing on migration-related operations
 */
async function testMigrationOperations() {
  console.log('Starting migration operations test...');
  
  try {
    // Create a datasource with all the same settings as the client datasource
    const datasource = new DataSource({
      type: "postgres",
      database: "migration_test",
      entities: clientEntities,
      migrations: ["src/migrations/client/*.ts"],
      synchronize: false,
      logging: true,
      driver: new PGliteDriver({
        extensions: { uuid_ossp },
        dataDir: './pgdata/migration-test'
      }).driver
    });
    
    console.log('Initializing datasource...');
    await datasource.initialize();
    console.log('Datasource initialized successfully');
    
    // Step 1: Create a table to ensure we have something in the database
    console.log('\nCreating a test table...');
    await datasource.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Test table created successfully');
    
    // Step 2: Try to get schema information (similar to what migration:generate would do)
    console.log('\nGetting schema information...');
    
    // This is what migration:generate would do - get table info
    console.log('Querying table information...');
    const tableInfo = await datasource.query(`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Table information:', tableInfo);
    
    // Get column information
    console.log('Querying column information...');
    const columnInfo = await datasource.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position
    `);
    console.log('Column information:', columnInfo);
    
    // Try to query PostgreSQL-specific catalog tables that migration generator might use
    console.log('\nQuerying pg_catalog tables that migration generator might use...');
    try {
      console.log('Querying pg_indexes...');
      const indexInfo = await datasource.query(`SELECT * FROM pg_indexes WHERE schemaname = 'public'`);
      console.log('Index information retrieved successfully');
    } catch (err: any) {
      console.log('Error querying indexes:', err?.message || String(err));
    }
    
    try {
      console.log('Querying pg_constraint...');
      const constraintInfo = await datasource.query(`
        SELECT conname, contype, conrelid::regclass::text as table_name
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
      `);
      console.log('Constraint information retrieved successfully');
    } catch (err: any) {
      console.log('Error querying constraints:', err?.message || String(err));
    }
    
    // Close connection
    await datasource.destroy();
    console.log('\nMigration operations test completed successfully');
  } catch (error) {
    console.error('Error during migration operations test:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Run the test function
testMigrationOperations().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});