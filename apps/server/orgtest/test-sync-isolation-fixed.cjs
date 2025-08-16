#!/usr/bin/env node

/**
 * Test Sync Isolation with Corrected RLS Methodology
 * 
 * Tests that sync system properly isolates data using non-superuser connections
 * and validates organization-aware sync behavior
 */

const { Client } = require('pg');
const WebSocket = require('ws');

const TECHFLOW_ORG_ID = '934fd0a8-f306-4f13-a544-094282f047eb';
const OTHER_ORG_ID = '11111111-2222-3333-4444-555555555555';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function testSyncIsolation() {
  console.log('🔄 Testing sync isolation with corrected RLS methodology...');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test 1: Database-level sync query isolation
  console.log('\n--- Test 1: Database Sync Query Isolation ---');
  
  const appClient = new Client({
    host: 'localhost',
    port: 5432,
    database: 'vibestack_dev',
    user: 'vibestack_app_user',
    password: 'test_password'
  });
  
  try {
    await appClient.connect();
    console.log('✅ Connected as non-superuser for sync testing');
    
    // Create additional test data for sync isolation
    console.log('\n📊 Creating sync test data...');
    
    const syncTestData = [
      {
        id: generateUUID(),
        lsn: '0/16B2C60',
        organization_id: TECHFLOW_ORG_ID,
        table_name: 'tasks',
        operation: 'insert',
        data: JSON.stringify({
          id: generateUUID(),
          title: 'TechFlow Sync Test Task',
          description: 'This should be visible to TechFlow sync',
          organization_id: TECHFLOW_ORG_ID
        }),
        client_id: 'techflow-sync-test'
      },
      {
        id: generateUUID(),
        lsn: '0/16B2C61',
        organization_id: OTHER_ORG_ID,
        table_name: 'tasks', 
        operation: 'insert',
        data: JSON.stringify({
          id: generateUUID(),
          title: 'Other Org Sync Test Task',
          description: 'This should NOT be visible to TechFlow sync',
          organization_id: OTHER_ORG_ID
        }),
        client_id: 'other-sync-test'
      },
      {
        id: generateUUID(),
        lsn: '0/16B2C62',
        organization_id: TECHFLOW_ORG_ID,
        table_name: 'projects',
        operation: 'update',
        data: JSON.stringify({
          id: generateUUID(),
          name: 'TechFlow Updated Project',
          status: 'in_progress',
          organization_id: TECHFLOW_ORG_ID
        }),
        client_id: 'techflow-sync-test'
      }
    ];
    
    // Insert test data using superuser temporarily (for setup)
    const adminClient = new Client({
      connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
    });
    await adminClient.connect();
    
    for (const entry of syncTestData) {
      await adminClient.query(`
        INSERT INTO change_history (id, lsn, organization_id, table_name, operation, data, client_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [entry.id, entry.lsn, entry.organization_id, entry.table_name, entry.operation, entry.data, entry.client_id]);
    }
    console.log('✅ Created sync test data');
    await adminClient.end();
    
    // Test 2: Simulate sync engine query for TechFlow
    console.log('\n--- Test 2: TechFlow Sync Engine Simulation ---');
    
    await appClient.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    const techflowSync = await appClient.query(`
      SELECT 
        id,
        table_name,
        operation,
        data->>'title' as title,
        data->>'name' as name,
        organization_id,
        client_id
      FROM change_history
      WHERE lsn IN ('0/16B2C60', '0/16B2C61', '0/16B2C62')
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 TechFlow sync engine sees ${techflowSync.rows.length} changes:`);
    techflowSync.rows.forEach(row => {
      const isOwnOrg = row.organization_id === TECHFLOW_ORG_ID;
      const status = isOwnOrg ? '✅' : '❌';
      const title = row.title || row.name || 'N/A';
      console.log(`  ${status} ${row.table_name} ${row.operation}: ${title} (${row.organization_id.slice(0, 8)}...)`);
    });
    
    const techflowIsolated = techflowSync.rows.every(row => row.organization_id === TECHFLOW_ORG_ID);
    
    // Test 3: Simulate sync engine query for other org
    console.log('\n--- Test 3: Other Org Sync Engine Simulation ---');
    
    await appClient.query('SELECT set_current_organization_id($1::UUID)', [OTHER_ORG_ID]);
    
    const otherOrgSync = await appClient.query(`
      SELECT 
        id,
        table_name,
        operation,
        data->>'title' as title,
        data->>'name' as name,
        organization_id,
        client_id
      FROM change_history
      WHERE lsn IN ('0/16B2C60', '0/16B2C61', '0/16B2C62')
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Other org sync engine sees ${otherOrgSync.rows.length} changes:`);
    otherOrgSync.rows.forEach(row => {
      const isOwnOrg = row.organization_id === OTHER_ORG_ID;
      const status = isOwnOrg ? '✅' : '❌';
      const title = row.title || row.name || 'N/A';
      console.log(`  ${status} ${row.table_name} ${row.operation}: ${title} (${row.organization_id.slice(0, 8)}...)`);
    });
    
    const otherOrgIsolated = otherOrgSync.rows.every(row => row.organization_id === OTHER_ORG_ID);
    
    // Test 4: Sync delta query simulation
    console.log('\n--- Test 4: Sync Delta Query (Last 1 Hour) ---');
    
    await appClient.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    const deltaSync = await appClient.query(`
      SELECT 
        table_name,
        operation,
        COUNT(*) as change_count,
        array_agg(DISTINCT organization_id) as org_ids,
        MAX(created_at) as latest_change
      FROM change_history
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY table_name, operation
      ORDER BY latest_change DESC
    `);
    
    console.log(`📊 TechFlow delta sync (last hour):`);
    deltaSync.rows.forEach(row => {
      const orgIdsStr = row.org_ids.map(id => id ? id.slice(0, 8) + '...' : 'null').join(', ');
      console.log(`  - ${row.table_name} ${row.operation}: ${row.change_count} changes from orgs [${orgIdsStr}]`);
    });
    
    // Check if delta sync shows only own org
    const deltaIsolated = deltaSync.rows.every(row => 
      row.org_ids.every(id => id === null || id === TECHFLOW_ORG_ID)
    );
    
    await appClient.end();
    
    // Test 5: WebSocket sync test (if server is running)
    console.log('\n--- Test 5: WebSocket Sync Isolation Test ---');
    
    let websocketResults = { success: false, error: 'Not tested' };
    
    try {
      // Check if server is running
      const testResponse = await fetch('http://localhost:8787/health').catch(() => null);
      
      if (testResponse) {
        console.log('🌐 Server detected, testing WebSocket sync...');
        
        const wsTest = await testWebSocketSync(TECHFLOW_ORG_ID);
        websocketResults = wsTest;
      } else {
        console.log('⚠️ Server not running, skipping WebSocket test');
        websocketResults = { success: false, error: 'Server not running' };
      }
    } catch (error) {
      console.log(`⚠️ WebSocket test failed: ${error.message}`);
      websocketResults = { success: false, error: error.message };
    }
    
    // Results compilation
    results.tests = {
      database_sync_isolation: {
        techflow_isolated: techflowIsolated,
        techflow_changes_count: techflowSync.rows.length,
        other_org_isolated: otherOrgIsolated,
        other_org_changes_count: otherOrgSync.rows.length
      },
      delta_sync_isolation: {
        isolated: deltaIsolated,
        table_operations: deltaSync.rows.length
      },
      websocket_sync: websocketResults
    };
    
    const overallSyncIsolation = techflowIsolated && otherOrgIsolated && deltaIsolated;
    
    console.log('\n📋 SYNC ISOLATION TEST RESULTS:');
    console.log(`🔄 Database sync isolation: ${techflowIsolated && otherOrgIsolated ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`📊 Delta sync isolation: ${deltaIsolated ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`🌐 WebSocket sync: ${websocketResults.success ? '✅ WORKING' : '⚠️ ' + websocketResults.error}`);
    console.log(`🎯 Overall sync isolation: ${overallSyncIsolation ? '✅ PERFECT' : '❌ ISSUES FOUND'}`);
    
    if (overallSyncIsolation) {
      console.log('\n🎉 SUCCESS: Sync system has perfect organization isolation!');
      console.log('✅ Database sync queries respect RLS policies');
      console.log('✅ Delta sync respects organization boundaries');
      console.log('✅ No cross-organization data leakage in sync');
    } else {
      console.log('\n⚠️ WARNING: Sync isolation has issues that need investigation');
    }
    
    // Save results
    const fs = require('fs');
    fs.writeFileSync('orgtest/sync-isolation-test-results-fixed.json', JSON.stringify(results, null, 2));
    
    console.log('\n📄 Results saved to: orgtest/sync-isolation-test-results-fixed.json');
    
    return results;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function testWebSocketSync(orgId) {
  return new Promise((resolve) => {
    const wsUrl = `ws://localhost:8787/api/sync?orgId=${orgId}&clientId=test-sync-isolation`;
    console.log(`🔌 Connecting to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ success: false, error: 'Connection timeout' });
    }, 5000);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Request sync data
      ws.send(JSON.stringify({
        type: 'request_sync',
        lastSyncTimestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Last hour
        organizationId: orgId
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 Received: ${message.type}`);
        
        if (message.type === 'initial_sync' || message.type === 'sync_data') {
          const changes = message.changes || {};
          const totalChanges = Object.values(changes).reduce((sum, arr) => sum + arr.length, 0);
          
          // Check organization isolation in sync response
          const allOrgIds = new Set();
          Object.values(changes).forEach(changeArray => {
            changeArray.forEach(change => {
              if (change.organization_id) allOrgIds.add(change.organization_id);
            });
          });
          
          const isolationValid = allOrgIds.size <= 1 && (allOrgIds.size === 0 || allOrgIds.has(orgId));
          
          console.log(`📊 Sync response: ${totalChanges} changes, ${allOrgIds.size} unique orgs`);
          console.log(`🔒 Isolation status: ${isolationValid ? 'VALID' : 'INVALID'}`);
          
          clearTimeout(timeout);
          ws.close();
          resolve({
            success: true,
            total_changes: totalChanges,
            unique_org_ids: Array.from(allOrgIds),
            isolation_valid: isolationValid
          });
        }
      } catch (error) {
        console.log(`⚠️ Message parse error: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`❌ WebSocket error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
      console.log('🔌 WebSocket closed');
    });
  });
}

if (require.main === module) {
  testSyncIsolation()
    .then((results) => {
      const syncWorking = results.tests.database_sync_isolation.techflow_isolated && 
                         results.tests.database_sync_isolation.other_org_isolated &&
                         results.tests.delta_sync_isolation.isolated;
      
      console.log(`\n🎉 Sync isolation test ${syncWorking ? 'PASSED' : 'FAILED'}!`);
      process.exit(syncWorking ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Sync isolation test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testSyncIsolation };