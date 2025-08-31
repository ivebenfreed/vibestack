/**
 * Clean up Wide Corp test data
 */

const { Client } = require('pg');

const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

async function cleanupWideCorp() {
  console.log('🧹 Cleaning up Wide Corp test data...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  await client.connect();
  
  try {
    // Clean up container permissions first
    console.log('🔐 Cleaning up container permissions...');
    await client.query(`
      DELETE FROM container_permission 
      WHERE permission_container_id = $1
    `, [WIDE_CORP_ORG_ID]);
    
    // Clean up organization members
    console.log('👥 Cleaning up organization members...');
    await client.query(`
      DELETE FROM organization_members 
      WHERE organization_id = $1
    `, [WIDE_CORP_ORG_ID]);
    
    // Clean up Wide Corp users
    console.log('👤 Cleaning up Wide Corp users...');
    await client.query(`
      DELETE FROM "user" 
      WHERE email LIKE '%@widecorp.com'
    `);
    
    // Drop Wide Corp tables
    console.log('📦 Dropping Wide Corp tables...');
    const tablePrefix = `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_`;
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '${tablePrefix}%'
    `);
    
    for (const row of tables.rows) {
      console.log(`   Dropping table: ${row.table_name}`);
      await client.query(`DROP TABLE IF EXISTS "${row.table_name}" CASCADE`);
    }
    
    // Clean up organization
    console.log('🏢 Cleaning up organization...');
    await client.query(`
      DELETE FROM organizations 
      WHERE id = $1
    `, [WIDE_CORP_ORG_ID]);
    
    console.log('✅ Wide Corp cleanup completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Error cleaning up Wide Corp:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Run the cleanup
cleanupWideCorp()
  .then(success => {
    if (success) {
      console.log('\n✅ Wide Corp cleanup completed');
      process.exit(0);
    } else {
      console.log('\n❌ Wide Corp cleanup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Cleanup error:', error.message);
    process.exit(1);
  });