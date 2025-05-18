import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

/**
 * Minimal test to isolate PGlite initialization issue
 * This bypasses TypeORM and tries to create a PGlite instance directly
 */
async function testMinimalPGlite() {
  console.log('Starting minimal PGlite test...');
  
  try {
    // First try: Just create a basic PGlite instance
    console.log('Test 1: Creating PGlite with default options...');
    const pglite1 = await PGlite.create();
    console.log('PGlite with default options created successfully');
    await pglite1.close();
    
    // Second try: With directory option
    console.log('Test 2: Creating PGlite with directory option...');
    const pglite2 = await PGlite.create({
      dataDir: './pgdata/test'
    });
    console.log('PGlite with directory option created successfully');
    await pglite2.close();
    
    // Third try: With uuid_ossp extension
    console.log('Test 3: Creating PGlite with uuid_ossp extension...');
    const pglite3 = await PGlite.create({
      extensions: { uuid_ossp }
    });
    console.log('PGlite with uuid_ossp extension created successfully');
    await pglite3.close();
    
    // Fourth try: With both directory and uuid_ossp
    console.log('Test 4: Creating PGlite with both directory and uuid_ossp...');
    const pglite4 = await PGlite.create({
      dataDir: './pgdata/test',
      extensions: { uuid_ossp }
    });
    console.log('PGlite with both options created successfully');
    await pglite4.close();
    
    console.log('All PGlite tests passed successfully');
  } catch (error) {
    console.error('Error during minimal PGlite test:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Run the test function
testMinimalPGlite().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});