#!/usr/bin/env node

/**
 * Simple Organization Isolation Test
 * Tests that TechFlow Solutions can only see their own data
 */

const { Client } = require('pg');
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const TECHFLOW_ORG_ID = '934fd0a8-f306-4f13-a544-094282f047eb';
const OTHER_ORG_ID = '11111111-2222-3333-4444-555555555555';

async function testIsolation() {
  console.log('🔍 Testing organization data isolation...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    console.log('\n📊 Creating test organizations and data...');
    
    // Create second test organization
    await client.query(`
      INSERT INTO organizations (id, name, slug, description, subscription_tier, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [OTHER_ORG_ID, 'Test Organization 2', 'test-org-isolation-' + Date.now(), 'Second organization for isolation testing', 'trial']);
    console.log('✅ Created/verified second test organization');
    
    const testEntries = [
      {
        id: generateUUID(),
        lsn: '0/16B2C48',
        organization_id: TECHFLOW_ORG_ID,
        table_name: 'projects',
        operation: 'insert',
        data: JSON.stringify({
          id: generateUUID(),
          name: 'TechFlow Project - Should be visible',
          organization_id: TECHFLOW_ORG_ID
        }),
        client_id: 'techflow-test'
      },
      {
        id: generateUUID(),
        lsn: '0/16B2C49', 
        organization_id: OTHER_ORG_ID,
        table_name: 'projects',
        operation: 'insert',
        data: JSON.stringify({
          id: generateUUID(),
          name: 'Other Org Project - Should NOT be visible',
          organization_id: OTHER_ORG_ID
        }),
        client_id: 'other-test'
      }
    ];
    
    // Insert test data
    for (const entry of testEntries) {
      await client.query(`
        INSERT INTO change_history (id, lsn, organization_id, table_name, operation, data, client_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [entry.id, entry.lsn, entry.organization_id, entry.table_name, entry.operation, entry.data, entry.client_id]);
    }
    console.log('✅ Created test data');
    
    console.log('\n🔒 Testing TechFlow organization context...');
    
    // Test isolation
    await client.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    const result = await client.query(`
      SELECT 
        organization_id,
        table_name,
        data->>'name' as project_name,
        client_id
      FROM change_history
      WHERE table_name = 'projects'
      AND lsn IN ('0/16B2C48', '0/16B2C49')
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 TechFlow context sees ${result.rows.length} projects:`);
    
    let isolationPassed = true;
    result.rows.forEach(row => {
      const isOwnOrg = row.organization_id === TECHFLOW_ORG_ID;
      const status = isOwnOrg ? '✅' : '❌';
      console.log(`  ${status} ${row.project_name} (${row.organization_id.slice(0, 8)}...)`);
      
      if (!isOwnOrg) {
        isolationPassed = false;
      }
    });
    
    console.log('\n📋 ISOLATION TEST RESULTS:');
    if (isolationPassed) {
      console.log('✅ SUCCESS: Perfect isolation - TechFlow can only see own data');
    } else {
      console.log('❌ FAILED: Data leakage detected - TechFlow can see other org data');
    }
    
    // Test system mode
    console.log('\n🔧 Testing system mode (should see all data)...');
    await client.query('SELECT enable_system_mode()');
    
    const systemResult = await client.query(`
      SELECT 
        organization_id,
        data->>'name' as project_name
      FROM change_history
      WHERE table_name = 'projects'
      AND lsn IN ('0/16B2C48', '0/16B2C49')
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 System mode sees ${systemResult.rows.length} projects:`);
    systemResult.rows.forEach(row => {
      const orgLabel = row.organization_id === TECHFLOW_ORG_ID ? 'TechFlow' : 'Other';
      console.log(`  - ${row.project_name} (${orgLabel})`);
    });
    
    const results = {
      timestamp: new Date().toISOString(),
      test_passed: isolationPassed,
      techflow_visible_count: result.rows.length,
      system_visible_count: systemResult.rows.length,
      isolation_working: isolationPassed && systemResult.rows.length === 2
    };
    
    // Save results
    const fs = require('fs');
    fs.writeFileSync('orgtest/simple-isolation-test-results.json', JSON.stringify(results, null, 2));
    
    console.log('\n✅ Test completed - results saved');
    
    return results;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  testIsolation()
    .then((results) => {
      console.log(`\n🎉 Test ${results.test_passed ? 'PASSED' : 'FAILED'}!`);
      process.exit(results.test_passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testIsolation };