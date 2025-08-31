#!/usr/bin/env node

/**
 * Comprehensive Sync Isolation Test
 * 
 * Tests organization-aware sync system with actual business data
 * and validates that WebSocket sync only sends organization-specific data
 */

const { Client } = require('pg');
const WebSocket = require('ws');

// TechFlow Solutions organization ID
const TECHFLOW_ORG_ID = '934fd0a8-f306-4f13-a544-094282f047eb';

async function testSyncIsolation() {
  console.log('🔍 Testing comprehensive sync isolation...');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Database-level RLS isolation
    console.log('\n--- Test 1: Database RLS Isolation ---');
    
    // Set TechFlow context and test query
    await client.query('BEGIN');
    await client.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    const techflowQuery = await client.query(`
      SELECT 
        COUNT(*) as total,
        organization_id,
        array_agg(DISTINCT table_name) as tables,
        array_agg(DISTINCT operation) as operations
      FROM change_history 
      GROUP BY organization_id
      ORDER BY organization_id
    `);
    
    console.log('📊 Change history by organization (TechFlow context):');
    techflowQuery.rows.forEach(row => {
      const orgLabel = row.organization_id === TECHFLOW_ORG_ID ? 'TechFlow Solutions' : 
                       row.organization_id ? `Other Org (${row.organization_id.slice(0, 8)}...)` : 'System';
      console.log(`  - ${orgLabel}: ${row.total} changes in ${row.tables} (${row.operations})`);
    });
    
    await client.query('COMMIT');
    
    results.tests.database_isolation = {
      techflow_context_results: techflowQuery.rows,
      rls_working: techflowQuery.rows.length === 1 && techflowQuery.rows[0].organization_id === TECHFLOW_ORG_ID
    };
    
    // Test 2: Simulate sync engine query 
    console.log('\n--- Test 2: Sync Engine Simulation ---');
    
    await client.query('BEGIN');
    await client.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    // Simulate what the sync engine would query
    const syncChanges = await client.query(`
      SELECT 
        id,
        table_name,
        operation,
        data,
        client_id,
        created_at
      FROM change_history 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    console.log(`📊 Sync engine would see ${syncChanges.rows.length} recent changes:`);
    syncChanges.rows.forEach((row, i) => {
      if (i < 5) { // Show first 5
        const dataPreview = JSON.parse(row.data);
        console.log(`  ${i + 1}. ${row.table_name} ${row.operation}: ${dataPreview.name || dataPreview.title || 'N/A'}`);
      }
    });
    if (syncChanges.rows.length > 5) {
      console.log(`  ... and ${syncChanges.rows.length - 5} more`);
    }
    
    await client.query('COMMIT');
    
    results.tests.sync_engine_simulation = {
      changes_count: syncChanges.rows.length,
      sample_changes: syncChanges.rows.slice(0, 5).map(row => ({
        table_name: row.table_name,
        operation: row.operation,
        data_preview: JSON.parse(row.data),
        client_id: row.client_id
      }))
    };
    
    // Test 3: Cross-organization validation
    console.log('\n--- Test 3: Cross-Organization Data Validation ---');
    
    // Enable system mode to see actual data distribution
    await client.query('BEGIN');
    await client.query('SELECT enable_system_mode()');
    
    const crossOrgAnalysis = await client.query(`
      SELECT 
        organization_id,
        table_name,
        COUNT(*) as change_count,
        MAX(created_at) as latest_change
      FROM change_history 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY organization_id, table_name
      ORDER BY organization_id, table_name
    `);
    
    console.log('📊 Cross-organization change analysis (System view):');
    const orgGroups = {};
    crossOrgAnalysis.rows.forEach(row => {
      const orgId = row.organization_id || 'system';
      if (!orgGroups[orgId]) orgGroups[orgId] = [];
      orgGroups[orgId].push(row);
    });
    
    Object.entries(orgGroups).forEach(([orgId, changes]) => {
      const orgLabel = orgId === TECHFLOW_ORG_ID ? 'TechFlow Solutions' : 
                       orgId === 'system' ? 'System' : `Org ${orgId.slice(0, 8)}...`;
      console.log(`  ${orgLabel}:`);
      changes.forEach(change => {
        console.log(`    - ${change.table_name}: ${change.change_count} changes`);
      });
    });
    
    await client.query('COMMIT');
    
    results.tests.cross_org_analysis = crossOrgAnalysis.rows;
    
    // Test 4: WebSocket simulation (if server is running)
    console.log('\n--- Test 4: WebSocket Sync Simulation ---');
    
    try {
      // Test WebSocket connection to sync endpoint
      const wsUrl = `ws://localhost:8787/api/sync?orgId=${TECHFLOW_ORG_ID}&clientId=test-isolation-client`;
      console.log(`Attempting WebSocket connection to: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      
      const wsTest = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ success: false, error: 'Connection timeout' });
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          console.log('✅ WebSocket connected successfully');
          
          // Send a test message requesting sync
          ws.send(JSON.stringify({
            type: 'request_sync',
            lastSyncTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            organizationId: TECHFLOW_ORG_ID
          }));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`📨 Received message type: ${message.type}`);
            
            if (message.type === 'initial_sync' || message.type === 'sync_data') {
              const changeCount = Object.values(message.changes || {}).reduce((sum, arr) => sum + arr.length, 0);
              console.log(`📊 Sync response contains ${changeCount} total changes`);
              
              // Analyze organization isolation in sync response
              const orgIds = new Set();
              Object.values(message.changes || {}).forEach(changeArray => {
                changeArray.forEach(change => {
                  if (change.organization_id) orgIds.add(change.organization_id);
                });
              });
              
              const isolationTest = {
                total_changes: changeCount,
                unique_org_ids: Array.from(orgIds),
                isolation_success: orgIds.size <= 1 && (orgIds.size === 0 || orgIds.has(TECHFLOW_ORG_ID))
              };
              
              console.log(`🔒 Isolation test: ${isolationTest.isolation_success ? 'PASSED' : 'FAILED'}`);
              console.log(`   - Organization IDs found: ${isolationTest.unique_org_ids.map(id => id.slice(0, 8) + '...').join(', ') || 'none'}`);
              
              ws.close();
              resolve({ success: true, isolation_test: isolationTest, message });
            }
          } catch (error) {
            console.log('⚠️ Error parsing WebSocket message:', error.message);
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          console.log('❌ WebSocket error:', error.message);
          resolve({ success: false, error: error.message });
        });
        
        ws.on('close', () => {
          clearTimeout(timeout);
          console.log('🔌 WebSocket connection closed');
        });
      });
      
      results.tests.websocket_sync = wsTest;
      
    } catch (error) {
      console.log('⚠️ WebSocket test failed (server may not be running):', error.message);
      results.tests.websocket_sync = { success: false, error: error.message };
    }
    
    // Test 5: Manual sync data request
    console.log('\n--- Test 5: Manual Sync Data Request ---');
    
    await client.query('BEGIN');
    await client.query('SELECT set_current_organization_id($1::UUID)', [TECHFLOW_ORG_ID]);
    
    // Simulate what a sync request would return
    const manualSyncData = {};
    const tables = ['projects', 'tasks', 'comments', 'time_entries'];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT * FROM ${table} LIMIT 10`);
        manualSyncData[table] = result.rows;
        console.log(`📋 ${table}: ${result.rows.length} records`);
      } catch (error) {
        console.log(`⚠️ ${table}: Table does not exist`);
        manualSyncData[table] = [];
      }
    }
    
    await client.query('COMMIT');
    
    results.tests.manual_sync_data = {
      tables_checked: tables,
      data_summary: Object.fromEntries(
        Object.entries(manualSyncData).map(([table, data]) => [table, data.length])
      )
    };
    
    // Final summary
    console.log('\n📊 SYNC ISOLATION TEST SUMMARY:');
    console.log(`RLS Database Isolation: ${results.tests.database_isolation.rls_working ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Sync Engine Changes: ${results.tests.sync_engine_simulation.changes_count} changes visible`);
    console.log(`Cross-Org Analysis: ${results.tests.cross_org_analysis.length} org/table combinations`);
    console.log(`WebSocket Test: ${results.tests.websocket_sync.success ? '✅ CONNECTED' : '❌ FAILED'}`);
    if (results.tests.websocket_sync.isolation_test) {
      console.log(`WebSocket Isolation: ${results.tests.websocket_sync.isolation_test.isolation_success ? '✅ PASSED' : '❌ FAILED'}`);
    }
    
    // Save results
    const fs = require('fs');
    const resultsPath = 'orgtest/comprehensive-sync-isolation-results.json';
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log(`\n✅ Comprehensive sync isolation test complete!`);
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
  testSyncIsolation()
    .then((results) => {
      console.log('\n🎉 Comprehensive sync isolation test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testSyncIsolation };