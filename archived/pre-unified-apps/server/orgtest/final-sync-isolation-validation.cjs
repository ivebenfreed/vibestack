#!/usr/bin/env node

/**
 * Final Sync Isolation Validation
 * 
 * Creates meaningful test data and validates organization isolation
 */

const { Client } = require('pg');

const TECHFLOW_ORG_ID = '934fd0a8-f306-4f13-a544-094282f047eb';

async function validateSyncIsolation() {
  console.log('🔍 Final validation of sync isolation with actual business data...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Create test data that should be isolated
    console.log('\n📊 Creating test business data...');
    
    const testData = {
      techflow_secret: {
        id: '01234567-tech-flow-secret-data-abc123',
        organization_id: TECHFLOW_ORG_ID,
        table_name: 'projects',
        data: {
          id: '01234567-tech-flow-secret-data-abc123',
          name: '🔒 TechFlow SECRET Project',
          description: 'This is confidential TechFlow data - should NOT be visible to other orgs',
          organization_id: TECHFLOW_ORG_ID,
          budget: 100000,
          client_name: 'Confidential Client Alpha'
        }
      },
      competitor_data: {
        id: '01234567-comp-etit-or-data-xyz789',
        organization_id: '11111111-2222-3333-4444-555555555555', // Different org
        table_name: 'projects', 
        data: {
          id: '01234567-comp-etit-or-data-xyz789',
          name: '🚫 Competitor Secret Project',
          description: 'This should NEVER be visible to TechFlow Solutions',
          organization_id: '11111111-2222-3333-4444-555555555555',
          budget: 200000,
          client_name: 'Competitor Client Beta'
        }
      }
    };
    
    // Insert test data into change_history
    for (const [key, data] of Object.entries(testData)) {
      await client.query(`
        INSERT INTO change_history (
          id, lsn, organization_id, table_name, operation, data, client_id, created_at
        ) VALUES ($1, $2, $3, $4, 'insert', $5, $6, NOW())
      `, [
        data.id,
        `0/TEST${Math.floor(Math.random() * 1000000)}`,
        data.organization_id,
        data.table_name,
        JSON.stringify(data.data),
        `test-client-${key}`
      ]);
      console.log(`  ✅ Created ${key} test data`);
    }
    
    // Test 1: RLS isolation test
    console.log('\n🔒 Testing RLS isolation...');
    
    await client.query('BEGIN');
    await client.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    const isolationTest = await client.query(`
      SELECT 
        id,
        organization_id,
        table_name,
        data->>'name' as project_name,
        data->>'client_name' as client_name
      FROM change_history
      WHERE table_name = 'projects'
      AND (data->>'name' ILIKE '%secret%' OR data->>'name' ILIKE '%confidential%')
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 TechFlow context sees ${isolationTest.rows.length} sensitive projects:`);
    isolationTest.rows.forEach(row => {
      const isCorrectOrg = row.organization_id === TECHFLOW_ORG_ID;
      const status = isCorrectOrg ? '✅' : '❌';
      console.log(`  ${status} ${row.project_name} (${row.client_name}) - Org: ${row.organization_id.slice(0, 8)}...`);
    });
    
    const dataLeakage = isolationTest.rows.some(row => row.organization_id !== TECHFLOW_ORG_ID);
    
    await client.query('COMMIT');
    
    // Test 2: System mode verification
    console.log('\n🔧 Testing system mode (admin view)...');
    
    await client.query('BEGIN');
    await client.query('SELECT enable_system_mode()');
    
    const systemView = await client.query(`
      SELECT 
        organization_id,
        data->>'name' as project_name,
        data->>'client_name' as client_name
      FROM change_history
      WHERE table_name = 'projects'
      AND (data->>'name' ILIKE '%secret%' OR data->>'name' ILIKE '%confidential%')
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 System mode sees ${systemView.rows.length} sensitive projects:`);
    systemView.rows.forEach(row => {
      const orgLabel = row.organization_id === TECHFLOW_ORG_ID ? 'TechFlow' : 'Other Org';
      console.log(`  - ${row.project_name} (${row.client_name}) - ${orgLabel}`);
    });
    
    await client.query('COMMIT');
    
    // Test 3: Sync simulation
    console.log('\n⚡ Simulating sync engine behavior...');
    
    await client.query('BEGIN');
    await client.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    const syncSimulation = await client.query(`
      SELECT 
        table_name,
        COUNT(*) as change_count,
        array_agg(DISTINCT organization_id) as org_ids,
        array_agg(data->>'name') as names
      FROM change_history
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY table_name
      ORDER BY table_name
    `);
    
    console.log('📊 Sync engine would send this data to TechFlow clients:');
    syncSimulation.rows.forEach(row => {
      const orgIdsStr = row.org_ids.map(id => id ? id.slice(0, 8) + '...' : 'null').join(', ');
      console.log(`  - ${row.table_name}: ${row.change_count} changes from orgs [${orgIdsStr}]`);
      
      // Show some sample names
      const sampleNames = row.names.filter(name => name).slice(0, 3);
      if (sampleNames.length > 0) {
        console.log(`    Sample: ${sampleNames.join(', ')}`);
      }
    });
    
    await client.query('COMMIT');
    
    // Results summary
    const results = {
      timestamp: new Date().toISOString(),
      isolation_test: {
        data_leakage_detected: dataLeakage,
        techflow_visible_projects: isolationTest.rows.length,
        system_visible_projects: systemView.rows.length,
        rls_working: !dataLeakage
      },
      test_data_created: Object.keys(testData).length,
      sync_simulation: syncSimulation.rows
    };
    
    console.log('\n📋 FINAL VALIDATION RESULTS:');
    console.log(`🔒 RLS Isolation: ${dataLeakage ? '❌ FAILED - Data leakage detected!' : '✅ PASSED'}`);
    console.log(`📊 TechFlow sees: ${isolationTest.rows.length} sensitive projects`);  
    console.log(`🔧 System mode sees: ${systemView.rows.length} sensitive projects`);
    console.log(`⚡ Sync engine table coverage: ${syncSimulation.rows.length} tables`);
    
    if (dataLeakage) {
      console.log('\n⚠️  WARNING: Data isolation FAILED!');
      console.log('TechFlow users can see data from other organizations.');
      console.log('This is a critical security issue that must be fixed.');
    } else {
      console.log('\n✅ SUCCESS: Perfect data isolation confirmed!');
      console.log('TechFlow users can only see their own organization data.');
    }
    
    // Save results
    const fs = require('fs');
    const resultsPath = 'orgtest/final-sync-isolation-validation-results.json';
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log(`\n📄 Results saved to: ${resultsPath}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  validateSyncIsolation()
    .then((results) => {
      const success = results.isolation_test.rls_working;
      console.log(`\n🎉 Final validation ${success ? 'PASSED' : 'FAILED'}!`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { validateSyncIsolation };