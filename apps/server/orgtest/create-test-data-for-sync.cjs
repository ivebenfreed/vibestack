#!/usr/bin/env node

/**
 * Create Test Data for Organization Sync Isolation Testing
 * 
 * This script creates actual data in the change_history table and existing
 * organization-specific tables to test sync isolation properly.
 */

const { Client } = require('pg');

// TechFlow Solutions organization ID
const TECHFLOW_ORG_ID = '934fd0a8-f306-4f13-a544-094282f047eb';

// Create a different organization for isolation testing
const TEST_ORG_2_ID = '01234567-89ab-cdef-0123-456789abcdef';

async function createTestData() {
  console.log('🧪 Creating test data for organization sync isolation...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    const results = {
      timestamp: new Date().toISOString(),
      test_data_created: {}
    };

    // 1. Check what org-specific tables exist
    console.log('\n📋 Checking existing organization-specific tables...');
    const orgTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'org_%'
      ORDER BY table_name
    `);
    
    const orgTables = orgTablesResult.rows.map(row => row.table_name);
    console.log('Found org-specific tables:', orgTables);
    
    // 2. Create a second test organization for isolation testing
    console.log('\n🏢 Creating second test organization...');
    try {
      await client.query(`
        INSERT INTO organizations (id, name, slug, description, subscription_tier, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
      `, [
        TEST_ORG_2_ID,
        'Isolation Test Organization',
        'isolation-test-org',
        'Organization for testing data isolation',
        'trial'
      ]);
      console.log('✅ Created/updated second test organization');
    } catch (error) {
      console.log('⚠️ Second org creation error:', error.message);
    }
    
    // 3. Create test data in change_history for both organizations
    console.log('\n📝 Creating change history entries...');
    
    const changeHistoryEntries = [
      // TechFlow Solutions entries
      {
        lsn: '0/16B2C48',
        organization_id: TECHFLOW_ORG_ID,
        table_name: 'projects',
        operation: 'insert',
        data: JSON.stringify({
          id: '01234567-1111-7777-8888-123456789abc',
          name: 'TechFlow Project Alpha',
          description: 'Secret project for TechFlow only',
          organization_id: TECHFLOW_ORG_ID
        }),
        client_id: 'techflow-client-1'
      },
      {
        lsn: '0/16B2C49',
        organization_id: TECHFLOW_ORG_ID,
        table_name: 'tasks',
        operation: 'insert',
        data: JSON.stringify({
          id: '01234567-2222-7777-8888-123456789abc',
          title: 'TechFlow Task Alpha',
          description: 'Confidential task for TechFlow team',
          organization_id: TECHFLOW_ORG_ID
        }),
        client_id: 'techflow-client-1'
      },
      
      // Second organization entries (should be isolated)
      {
        lsn: '0/16B2C50',
        organization_id: TEST_ORG_2_ID,
        table_name: 'projects',
        operation: 'insert',
        data: JSON.stringify({
          id: '01234567-3333-7777-8888-123456789abc',
          name: 'Isolation Test Project',
          description: 'This should NOT be visible to TechFlow',
          organization_id: TEST_ORG_2_ID
        }),
        client_id: 'isolation-client-1'
      },
      {
        lsn: '0/16B2C51',
        organization_id: TEST_ORG_2_ID,
        table_name: 'tasks',
        operation: 'insert',
        data: JSON.stringify({
          id: '01234567-4444-7777-8888-123456789abc',
          title: 'Isolation Test Task',
          description: 'This should NOT be visible to TechFlow either',
          organization_id: TEST_ORG_2_ID
        }),
        client_id: 'isolation-client-1'
      },
      
      // More TechFlow entries
      {
        lsn: '0/16B2C52',
        organization_id: TECHFLOW_ORG_ID,
        table_name: 'tasks',
        operation: 'update',
        data: JSON.stringify({
          id: '01234567-2222-7777-8888-123456789abc',
          title: 'TechFlow Task Alpha - Updated',
          status: 'in_progress',
          organization_id: TECHFLOW_ORG_ID
        }),
        client_id: 'techflow-client-2'
      }
    ];
    
    for (const entry of changeHistoryEntries) {
      try {
        await client.query(`
          INSERT INTO change_history (lsn, organization_id, table_name, operation, data, client_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          entry.lsn,
          entry.organization_id,
          entry.table_name,
          entry.operation,
          entry.data,
          entry.client_id
        ]);
        console.log(`  ✅ Created change entry: ${entry.table_name} ${entry.operation} for org ${entry.organization_id.slice(0, 8)}...`);
      } catch (error) {
        console.log(`  ⚠️ Error creating change entry: ${error.message}`);
      }
    }
    
    results.test_data_created.change_history_entries = changeHistoryEntries.length;
    
    // 4. Test organization context switching and data retrieval
    console.log('\n🔍 Testing organization context and data isolation...');
    
    // Test 1: Query as TechFlow Solutions (should see only TechFlow data)
    console.log('\n--- Test 1: TechFlow Solutions Context ---');
    await client.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    const techflowChanges = await client.query(`
      SELECT organization_id, table_name, operation, data->>'name' as name, data->>'title' as title
      FROM change_history 
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `, [TECHFLOW_ORG_ID]);
    
    console.log(`📊 TechFlow context sees ${techflowChanges.rows.length} changes:`);
    techflowChanges.rows.forEach(row => {
      console.log(`  - ${row.table_name} ${row.operation}: ${row.name || row.title}`);
    });
    
    // Test 2: Query as second organization (should see only their data)
    console.log('\n--- Test 2: Isolation Test Organization Context ---');
    await client.query('SELECT set_current_organization_id($1::UUID)', [TEST_ORG_2_ID]);
    
    const isolationChanges = await client.query(`
      SELECT organization_id, table_name, operation, data->>'name' as name, data->>'title' as title
      FROM change_history 
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `, [TEST_ORG_2_ID]);
    
    console.log(`📊 Isolation org context sees ${isolationChanges.rows.length} changes:`);
    isolationChanges.rows.forEach(row => {
      console.log(`  - ${row.table_name} ${row.operation}: ${row.name || row.title}`);
    });
    
    // Test 3: System mode (should see all data)
    console.log('\n--- Test 3: System Mode (Admin View) ---');
    await client.query('SELECT enable_system_mode()');
    
    const allChanges = await client.query(`
      SELECT organization_id, table_name, operation, data->>'name' as name, data->>'title' as title
      FROM change_history 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 System mode sees ${allChanges.rows.length} changes (showing last 10):`);
    allChanges.rows.forEach(row => {
      const orgShort = row.organization_id ? row.organization_id.slice(0, 8) + '...' : 'system';
      console.log(`  - [${orgShort}] ${row.table_name} ${row.operation}: ${row.name || row.title}`);
    });
    
    // 5. Test RLS isolation (attempt to access other org's data without system mode)
    console.log('\n--- Test 4: RLS Isolation Verification ---');
    await client.query('SELECT disable_system_mode()');
    await client.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    const rlsTest = await client.query(`
      SELECT COUNT(*) as total_visible,
             COUNT(CASE WHEN organization_id = $1 THEN 1 END) as techflow_count,
             COUNT(CASE WHEN organization_id = $2 THEN 1 END) as isolation_count
      FROM change_history
    `, [TECHFLOW_ORG_ID, TEST_ORG_2_ID]);
    
    const rlsResult = rlsTest.rows[0];
    console.log(`📊 RLS Test Results (TechFlow context):`);
    console.log(`  - Total visible changes: ${rlsResult.total_visible}`);
    console.log(`  - TechFlow changes: ${rlsResult.techflow_count}`);
    console.log(`  - Isolation org changes: ${rlsResult.isolation_count}`);
    
    if (rlsResult.isolation_count > 0) {
      console.log('❌ RLS FAILURE: TechFlow context can see other organization data!');
      results.rls_test = 'FAILED - Data leakage detected';
    } else {
      console.log('✅ RLS SUCCESS: Perfect isolation - no data leakage');
      results.rls_test = 'PASSED - Perfect isolation';
    }
    
    results.verification = {
      techflow_changes: techflowChanges.rows.length,
      isolation_changes: isolationChanges.rows.length,
      total_system_changes: allChanges.rows.length,
      rls_isolation: rlsResult.isolation_count === 0
    };
    
    // Save detailed results
    const fs = require('fs');
    const resultsPath = 'orgtest/sync-isolation-test-results.json';
    fs.writeFileSync(resultsPath, JSON.stringify({
      ...results,
      techflow_data: techflowChanges.rows,
      isolation_data: isolationChanges.rows,
      system_view_sample: allChanges.rows
    }, null, 2));
    
    console.log('\n✅ Sync isolation test data creation complete!');
    console.log(`📄 Results saved to: ${resultsPath}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  createTestData()
    .then((results) => {
      console.log('\n🎉 Test data creation successful!');
      console.log('📊 Summary:');
      console.log(`  - Change history entries: ${results.test_data_created.change_history_entries}`);
      console.log(`  - RLS test result: ${results.rls_test}`);
      console.log(`  - TechFlow visible changes: ${results.verification.techflow_changes}`);
      console.log(`  - Isolation test passed: ${results.verification.rls_isolation}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test data creation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createTestData };