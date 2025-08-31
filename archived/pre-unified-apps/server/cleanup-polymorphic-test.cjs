/**
 * Clean up Polymorphic Test data
 */

const { Client } = require('pg');

const POLY_ORG_ID = '01920000-2000-7000-8000-000000000002';

async function cleanupPolymorphicTest() {
  console.log('🧹 Cleaning up Polymorphic Test data...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  await client.connect();
  
  try {
    // Clean up container permissions first
    console.log('🔐 Cleaning up container permissions...');
    await client.query(`DELETE FROM container_permission WHERE permission_container_id = $1`, [POLY_ORG_ID]);
    await client.query(`DELETE FROM container_permission WHERE permission_container_id IN ('ticket', 'deal')`);
    
    // Clean up permissions granted by polytest users
    await client.query(`DELETE FROM container_permission WHERE granted_by_id IN (SELECT id FROM "user" WHERE email LIKE '%@polytest.com')`);
    
    // Clean up organization members
    console.log('👥 Cleaning up organization members...');
    await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [POLY_ORG_ID]);
    
    // Clean up polytest users
    console.log('👤 Cleaning up polytest users...');
    await client.query(`DELETE FROM "user" WHERE email LIKE '%@polytest.com'`);
    
    // Drop polymorphic tables
    console.log('📦 Dropping polymorphic tables...');
    const tablePrefix = `org_${POLY_ORG_ID.replace(/-/g, '_')}_`;
    
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name LIKE '${tablePrefix}%'
    `);
    
    for (const row of tables.rows) {
      console.log(`   Dropping table: ${row.table_name}`);
      await client.query(`DROP TABLE IF EXISTS "${row.table_name}" CASCADE`);
    }
    
    // Clean up organization
    console.log('🏢 Cleaning up organization...');
    await client.query(`DELETE FROM organizations WHERE id = $1`, [POLY_ORG_ID]);
    
    console.log('✅ Polymorphic Test cleanup completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Error cleaning up Polymorphic Test:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Run the cleanup
cleanupPolymorphicTest()
  .then(success => {
    if (success) {
      console.log('\n✅ Polymorphic Test cleanup completed');
      process.exit(0);
    } else {
      console.log('\n❌ Polymorphic Test cleanup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Cleanup error:', error.message);
    process.exit(1);
  });