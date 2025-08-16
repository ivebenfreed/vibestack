#!/usr/bin/env node

/**
 * Fix and Test RLS Isolation
 * 
 * Root cause: RLS policies are bypassed for superusers (postgres)
 * Solution: Create and test with non-superuser roles
 */

const { Client } = require('pg');

const TECHFLOW_ORG_ID = '934fd0a8-f306-4f13-a544-094282f047eb';
const OTHER_ORG_ID = '11111111-2222-3333-4444-555555555555';

async function fixAndTestRLS() {
  console.log('🔧 Fixing and testing RLS isolation...');
  
  const adminClient = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  try {
    await adminClient.connect();
    console.log('✅ Connected as admin (postgres)');
    
    // Step 1: Create non-superuser roles for testing
    console.log('\n👤 Creating non-superuser roles for RLS testing...');
    
    try {
      await adminClient.query(`
        CREATE ROLE vibestack_app_user WITH LOGIN PASSWORD 'test_password';
      `);
      console.log('✅ Created vibestack_app_user role');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ vibestack_app_user role already exists');
      } else {
        throw error;
      }
    }
    
    // Grant necessary permissions
    await adminClient.query(`
      GRANT CONNECT ON DATABASE vibestack_dev TO vibestack_app_user;
      GRANT USAGE ON SCHEMA public TO vibestack_app_user;
      GRANT SELECT, INSERT, UPDATE, DELETE ON change_history TO vibestack_app_user;
      GRANT SELECT ON organizations TO vibestack_app_user;
      GRANT EXECUTE ON FUNCTION set_current_organization_id(UUID) TO vibestack_app_user;
      GRANT EXECUTE ON FUNCTION enable_system_mode() TO vibestack_app_user;
      GRANT EXECUTE ON FUNCTION disable_system_mode() TO vibestack_app_user;
    `);
    console.log('✅ Granted permissions to app user');
    
    await adminClient.end();
    
    // Step 2: Test RLS with non-superuser
    console.log('\n🔒 Testing RLS isolation with non-superuser...');
    
    const appClient = new Client({
      host: 'localhost',
      port: 5432,
      database: 'vibestack_dev',
      user: 'vibestack_app_user',
      password: 'test_password'
    });
    
    await appClient.connect();
    console.log('✅ Connected as non-superuser (vibestack_app_user)');
    
    // Test 1: Without organization context (should see nothing or get error)
    console.log('\n--- Test 1: No organization context set ---');
    
    try {
      const noContextResult = await appClient.query(`
        SELECT COUNT(*) as total, COUNT(DISTINCT organization_id) as unique_orgs
        FROM change_history
      `);
      console.log(`📊 Without org context: ${noContextResult.rows[0].total} total changes, ${noContextResult.rows[0].unique_orgs} orgs`);
    } catch (error) {
      console.log(`⚠️ Without org context: ${error.message}`);
    }
    
    // Test 2: With TechFlow organization context
    console.log('\n--- Test 2: TechFlow organization context ---');
    
    await appClient.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    const techflowResult = await appClient.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT organization_id) as unique_orgs,
        array_agg(DISTINCT organization_id) as org_ids
      FROM change_history
    `);
    
    console.log(`📊 TechFlow context: ${techflowResult.rows[0].total} changes, ${techflowResult.rows[0].unique_orgs} unique orgs`);
    console.log(`🔍 Organization IDs visible: ${techflowResult.rows[0].org_ids.map(id => id ? id.slice(0, 8) + '...' : 'null').join(', ')}`);
    
    // Check if we only see TechFlow data
    const techflowOnlyData = techflowResult.rows[0].org_ids.every(id => 
      id === null || id === TECHFLOW_ORG_ID
    );
    
    if (techflowOnlyData) {
      console.log('✅ RLS WORKING: Only TechFlow data visible');
    } else {
      console.log('❌ RLS FAILED: Other organization data visible');
    }
    
    // Test 3: Try to set different organization context
    console.log('\n--- Test 3: Other organization context ---');
    
    await appClient.query('SELECT set_current_organization_id($1::UUID)', [OTHER_ORG_ID]);
    
    const otherOrgResult = await appClient.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT organization_id) as unique_orgs,
        array_agg(DISTINCT organization_id) as org_ids
      FROM change_history
    `);
    
    console.log(`📊 Other org context: ${otherOrgResult.rows[0].total} changes, ${otherOrgResult.rows[0].unique_orgs} unique orgs`);
    console.log(`🔍 Organization IDs visible: ${otherOrgResult.rows[0].org_ids.map(id => id ? id.slice(0, 8) + '...' : 'null').join(', ')}`);
    
    // Check isolation for other org
    const otherOrgOnlyData = otherOrgResult.rows[0].org_ids.every(id => 
      id === null || id === OTHER_ORG_ID
    );
    
    if (otherOrgOnlyData) {
      console.log('✅ RLS WORKING: Only other org data visible');
    } else {
      console.log('❌ RLS FAILED: Cross-organization data visible');
    }
    
    // Test 4: System mode test (should work for app user too)
    console.log('\n--- Test 4: System mode test ---');
    
    try {
      await appClient.query('SELECT enable_system_mode()');
      
      const systemResult = await appClient.query(`
        SELECT COUNT(*) as total, COUNT(DISTINCT organization_id) as unique_orgs
        FROM change_history
      `);
      
      console.log(`📊 System mode: ${systemResult.rows[0].total} changes, ${systemResult.rows[0].unique_orgs} unique orgs`);
      
      if (systemResult.rows[0].unique_orgs > 1) {
        console.log('✅ System mode working: Can see all organizations');
      } else {
        console.log('⚠️ System mode limited: May need additional permissions');
      }
      
    } catch (error) {
      console.log(`⚠️ System mode test failed: ${error.message}`);
    }
    
    await appClient.end();
    
    // Results summary
    const results = {
      timestamp: new Date().toISOString(),
      rls_fix_applied: true,
      non_superuser_testing: true,
      techflow_isolation_working: techflowOnlyData,
      other_org_isolation_working: otherOrgOnlyData,
      overall_isolation_working: techflowOnlyData && otherOrgOnlyData
    };
    
    console.log('\n📋 RLS FIX TEST RESULTS:');
    console.log(`🔧 Fix applied (non-superuser testing): ${results.rls_fix_applied ? '✅' : '❌'}`);
    console.log(`🔒 TechFlow isolation: ${results.techflow_isolation_working ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`🔒 Other org isolation: ${results.other_org_isolation_working ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`🎯 Overall RLS status: ${results.overall_isolation_working ? '✅ FIXED' : '❌ STILL BROKEN'}`);
    
    if (results.overall_isolation_working) {
      console.log('\n🎉 SUCCESS: RLS isolation is working correctly!');
      console.log('The previous test failure was due to testing with superuser (postgres).');
      console.log('In production, application users will have proper isolation.');
    } else {
      console.log('\n⚠️ WARNING: RLS isolation still has issues.');
      console.log('Further investigation required.');
    }
    
    // Save results
    const fs = require('fs');
    fs.writeFileSync('orgtest/rls-fix-test-results.json', JSON.stringify(results, null, 2));
    
    console.log('\n📄 Results saved to: orgtest/rls-fix-test-results.json');
    
    return results;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

if (require.main === module) {
  fixAndTestRLS()
    .then((results) => {
      const success = results.overall_isolation_working;
      console.log(`\n🎉 RLS fix test ${success ? 'PASSED' : 'FAILED'}!`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 RLS fix test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { fixAndTestRLS };