/**
 * Database Cleanup Script - Prepare for Multi-Org Test Scenarios
 * 
 * Removes all test-generated organization tables and data while preserving:
 * - Auth tables (user, account, session, verification)
 * - System tables (organization, organization_members)
 * - Admin user account for management
 */

const { Client } = require('pg');

async function cleanupTestDatabase() {
  console.log('🧹 Starting database cleanup for multi-org test scenarios...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  await client.connect();
  
  try {
    // Step 1: Get list of all organization-specific tables
    console.log('\\n📋 Step 1: Discovering organization-specific tables...');
    const orgTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'org_%'
      ORDER BY table_name
    `);
    
    const orgTables = orgTablesResult.rows.map(row => row.table_name);
    console.log(`Found ${orgTables.length} organization tables:`);
    orgTables.forEach(table => console.log(`   - ${table}`));
    
    // Step 2: Drop organization-specific tables
    if (orgTables.length > 0) {
      console.log('\\n🗑️  Step 2: Dropping organization-specific tables...');
      for (const tableName of orgTables) {
        console.log(`   Dropping: ${tableName}`);
        await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      }
      console.log(`✅ Dropped ${orgTables.length} organization tables`);
    } else {
      console.log('\\n✅ Step 2: No organization tables to drop');
    }
    
    // Step 3: Clear container permissions (will recreate for new scenarios)
    console.log('\\n🔐 Step 3: Clearing container permissions...');
    const permissionsResult = await client.query(`
      DELETE FROM container_permission 
      WHERE permission_container_type IN ('organization', 'project', 'workspace')
      RETURNING id
    `);
    console.log(`✅ Removed ${permissionsResult.rows.length} container permissions`);
    
    // Step 4: Clear organization members (except admin)
    console.log('\\n👥 Step 4: Clearing organization members (keeping admin)...');
    
    // Keep the admin user but remove others
    const adminEmail = 'admin@techflow.solutions';
    const adminResult = await client.query(`
      SELECT u.id FROM "user" u WHERE u.email = $1
    `, [adminEmail]);
    
    let adminUserId = null;
    if (adminResult.rows.length > 0) {
      adminUserId = adminResult.rows[0].id;
      console.log(`   Found admin user: ${adminUserId}`);
    }
    
    const membersResult = await client.query(`
      DELETE FROM organization_members 
      WHERE user_id != $1
      RETURNING id
    `, [adminUserId]);
    
    console.log(`✅ Removed ${membersResult.rows.length} organization members (kept admin)`);
    
    // Step 5: Clear test users (except admin)
    console.log('\\n👤 Step 5: Clearing test users (keeping admin and auth tables)...');
    
    // Get list of test users to remove
    const testUsersResult = await client.query(`
      SELECT id, email FROM "user" 
      WHERE email LIKE '%test@%' 
      AND email != $1
    `, [adminEmail]);
    
    console.log(`Found ${testUsersResult.rows.length} test users to remove:`);
    testUsersResult.rows.forEach(user => {
      console.log(`   - ${user.email} (${user.id.substring(0, 8)}...)`);
    });
    
    // Remove test users and their associated records
    for (const user of testUsersResult.rows) {
      console.log(`   Removing user: ${user.email}`);
      
      // Remove user's sessions
      await client.query('DELETE FROM session WHERE user_id = $1', [user.id]);
      
      // Remove user's accounts
      await client.query('DELETE FROM account WHERE user_id = $1', [user.id]);
      
      // Remove user's verifications
      await client.query('DELETE FROM verification WHERE user_id = $1', [user.id]);
      
      // Remove user's container permissions
      await client.query('DELETE FROM container_permission WHERE user_id = $1', [user.id]);
      
      // Finally remove the user
      await client.query('DELETE FROM "user" WHERE id = $1', [user.id]);
    }
    
    console.log(`✅ Removed ${testUsersResult.rows.length} test users and their data`);
    
    // Step 6: Verify preserved tables and data
    console.log('\\n✅ Step 6: Verifying preserved system data...');
    
    // Check auth tables
    const userCount = await client.query('SELECT COUNT(*) FROM "user"');
    const sessionCount = await client.query('SELECT COUNT(*) FROM session');
    const orgCount = await client.query('SELECT COUNT(*) FROM organization');
    const orgMemberCount = await client.query('SELECT COUNT(*) FROM organization_members');
    
    console.log('   Preserved data:');
    console.log(`   - Users: ${userCount.rows[0].count}`);
    console.log(`   - Sessions: ${sessionCount.rows[0].count}`);  
    console.log(`   - Organizations: ${orgCount.rows[0].count}`);
    console.log(`   - Organization members: ${orgMemberCount.rows[0].count}`);
    
    // Check remaining admin user
    const remainingUsers = await client.query(`
      SELECT email, created_at FROM "user" ORDER BY created_at
    `);
    
    console.log('   Remaining users:');
    remainingUsers.rows.forEach(user => {
      console.log(`   - ${user.email} (${user.created_at.toISOString().split('T')[0]})`);
    });
    
    // Step 7: Check for any remaining organization tables
    console.log('\\n🔍 Step 7: Final verification - checking for remaining org tables...');
    const remainingOrgTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'org_%'
    `);
    
    if (remainingOrgTables.rows.length === 0) {
      console.log('✅ No organization tables remaining');
    } else {
      console.log('⚠️  Found remaining organization tables:');
      remainingOrgTables.rows.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }
    
    // Step 8: Cleanup summary
    console.log('\\n📊 Cleanup Summary:');
    console.log('=====================================');
    console.log(`✅ Organization tables dropped: ${orgTables.length}`);
    console.log(`✅ Container permissions cleared: ${permissionsResult.rows.length}`);
    console.log(`✅ Organization members removed: ${membersResult.rows.length}`);
    console.log(`✅ Test users removed: ${testUsersResult.rows.length}`);
    console.log('');
    console.log('🛡️  Preserved Systems:');
    console.log('   ✅ Auth tables (user, account, session, verification)');
    console.log('   ✅ Organization structure (organization, organization_members)');
    console.log('   ✅ Admin user account for management');
    console.log('   ✅ Container permission table structure');
    console.log('');
    console.log('🎯 Ready for new test scenarios!');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  } finally {
    await client.end();
  }
}

// Run the cleanup
cleanupTestDatabase()
  .then(success => {
    if (success) {
      console.log('\\n✅ Database cleanup completed successfully');
      console.log('\\n🚀 Next steps:');
      console.log('   1. Run multi-org test scenario creation scripts');
      console.log('   2. Validate new test organizations');
      console.log('   3. Test container permission scenarios');
      process.exit(0);
    } else {
      console.log('\\n❌ Database cleanup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Cleanup error:', error.message);
    process.exit(1);
  });