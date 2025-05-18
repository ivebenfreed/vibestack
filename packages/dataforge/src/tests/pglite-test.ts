import 'reflect-metadata';
import clientDataSource from '../datasources/client.js';
import { User, UserRole } from '../entities/User.js';

/**
 * Test script to debug PGlite client datasource issues
 * This will help isolate whether the issue is with:
 * 1. The client datasource configuration
 * 2. The PGlite initialization
 * 3. The interaction between TypeORM migrations and PGlite
 */
async function testPGliteConnection() {
  console.log('Starting PGlite connection test...');
  
  try {
    // Step 1: Initialize the datasource
    console.log('Initializing client datasource...');
    await clientDataSource.initialize();
    console.log('Client datasource initialized successfully');
    
    // Step 2: Get the driver information
    const driver = clientDataSource.driver as any;
    console.log('Driver type:', driver.constructor.name);
    
    if (driver && driver.pglite) {
      console.log('PGlite instance available');
    } else {
      console.log('PGlite instance not directly accessible through driver');
    }
    
    // Step 3: Try a simple query
    console.log('Executing simple query...');
    const result = await clientDataSource.query('SELECT version()');
    console.log('Query result:', result);
    
    // Step 4: Try a schema-related query
    console.log('Querying schema information...');
    const tables = await clientDataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables in database:', tables);
    
    // Step 5: Try to access User entity repository
    console.log('Accessing User repository...');
    const userRepository = clientDataSource.getRepository(User);
    console.log('User repository initialized');
    
    // Step 6: Try to get enum values
    console.log('User role enum values:', Object.values(UserRole));
    
    console.log('PGlite test completed successfully');
  } catch (error) {
    console.error('Error during PGlite test:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
  } finally {
    // Close the connection if initialized
    if (clientDataSource.isInitialized) {
      console.log('Closing connection...');
      await clientDataSource.destroy();
      console.log('Connection closed');
    }
  }
}

// Run the test function
testPGliteConnection().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});