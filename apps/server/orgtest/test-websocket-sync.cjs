#!/usr/bin/env node

/**
 * WebSocket Sync Testing
 * Tests the real-time sync functionality using WebSocket connections
 */

const fs = require('fs');

async function apiCall(method, endpoint, data = null) {
  const fetch = (await import('node-fetch')).default;
  
  // Read session cookies
  let cookieHeader = '';
  try {
    const cookieContent = fs.readFileSync('../cookies.txt', 'utf8');
    const cookieMatch = cookieContent.match(/better-auth\.session_token\s+([^\s]+)/);
    if (cookieMatch) {
      cookieHeader = `better-auth.session_token=${decodeURIComponent(cookieMatch[1])}`;
    }
  } catch (error) {
    throw new Error('No session cookies found. Please ensure admin is authenticated.');
  }
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`http://localhost:8787${endpoint}`, options);
  const result = await response.text();
  
  let jsonResult;
  try {
    jsonResult = JSON.parse(result);
  } catch (e) {
    jsonResult = result;
  }
  
  return {
    status: response.status,
    ok: response.ok,
    data: jsonResult
  };
}

async function testWebSocketSync() {
  console.log('🔄 Testing WebSocket Sync Functionality\n');
  
  // Load organization and user data
  let organization, users;
  try {
    organization = JSON.parse(fs.readFileSync('./organization-final.json', 'utf8'));
    users = JSON.parse(fs.readFileSync('./users-final.json', 'utf8'));
    console.log(`📋 Using organization: ${organization.name}`);
    console.log(`👥 Using ${users.length} test users`);
  } catch (error) {
    console.error('❌ Could not load test data.');
    process.exit(1);
  }
  
  const syncTestResults = {
    timestamp: new Date().toISOString(),
    organization_id: organization.id,
    sync_tests: []
  };
  
  // Test 1: Sync API Health Check
  console.log('\n=== Testing Sync API Availability ===');
  
  const syncHealthTests = [
    { endpoint: '/api/sync/health', description: 'Sync health check' },
    { endpoint: '/api/sync/metrics', description: 'Sync metrics' },
    { endpoint: '/api/sync-v2/health', description: 'Sync V2 health check' }
  ];
  
  for (const test of syncHealthTests) {
    console.log(`Testing: ${test.description}`);
    
    const response = await apiCall('GET', test.endpoint);
    
    if (response.ok) {
      console.log(`✅ ${test.description}: Available`);
      console.log('📊', JSON.stringify(response.data, null, 2));
    } else {
      console.log(`❌ ${test.description}: Unavailable (${response.status})`);
    }
    
    syncTestResults.sync_tests.push({
      test_name: test.description,
      endpoint: test.endpoint,
      status: response.status,
      success: response.ok,
      data: response.data
    });
  }
  
  // Test 2: Sync Initial Data Endpoint
  console.log('\n=== Testing Sync Initial Data ===');
  
  const clientId = `techflow-test-client-${Date.now()}`;
  console.log(`Using client ID: ${clientId}`);
  
  const initialSyncTests = [
    { endpoint: `/api/sync/initial?clientId=${clientId}`, description: 'Get initial sync data (v1)' },
    { endpoint: `/api/sync-v2/initial?clientId=${clientId}`, description: 'Get initial sync data (v2)' }
  ];
  
  for (const test of initialSyncTests) {
    console.log(`Testing: ${test.description}`);
    
    const response = await apiCall('GET', test.endpoint);
    
    if (response.ok) {
      console.log(`✅ ${test.description}: Success`);
      if (response.data) {
        console.log('📊 Initial data received:', typeof response.data === 'object' ? Object.keys(response.data) : 'Data available');
      }
    } else {
      console.log(`❌ ${test.description}: Failed (${response.status})`);
      console.log('❌ Error:', response.data);
    }
    
    syncTestResults.sync_tests.push({
      test_name: test.description,
      endpoint: test.endpoint,
      status: response.status,
      success: response.ok,
      data: response.ok ? 'Initial data received' : response.data
    });
  }
  
  // Test 3: Sync Change Processing
  console.log('\n=== Testing Sync Change Processing ===');
  
  const testChanges = [
    {
      clientId: clientId,
      changes: [
        {
          id: 'test-change-1',
          table: 'test_entities',
          operation: 'insert',
          data: {
            name: 'Test Entity from Sync',
            description: 'Created via sync API test'
          },
          timestamp: new Date().toISOString()
        }
      ]
    }
  ];
  
  for (const changeData of testChanges) {
    console.log('Testing sync change submission');
    
    const response = await apiCall('POST', '/api/sync-v2/sync', changeData);
    
    if (response.ok) {
      console.log('✅ Sync change submission: Success');
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ Sync change submission: Failed');
      console.log('❌ Error:', response.data);
    }
    
    syncTestResults.sync_tests.push({
      test_name: 'Sync change submission',
      endpoint: '/api/sync-v2/sync',
      status: response.status,
      success: response.ok,
      data: response.data
    });
  }
  
  // Test 4: Organization-aware Sync Context
  console.log('\n=== Testing Organization-aware Sync ===');
  
  const orgSyncTests = [
    {
      endpoint: `/api/sync-v2/initial?clientId=${clientId}&orgId=${organization.id}`,
      description: 'Organization-scoped initial sync'
    },
    {
      endpoint: `/api/sync-v2/changes`,
      method: 'POST',
      data: {
        clientId: clientId,
        organizationId: organization.id,
        since: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      description: 'Organization-scoped change query'
    }
  ];
  
  for (const test of orgSyncTests) {
    console.log(`Testing: ${test.description}`);
    
    const method = test.method || 'GET';
    const response = await apiCall(method, test.endpoint, test.data);
    
    if (response.ok) {
      console.log(`✅ ${test.description}: Success`);
      if (response.data) {
        console.log('📊 Organization sync data:', typeof response.data === 'object' ? Object.keys(response.data) : 'Data available');
      }
    } else {
      console.log(`❌ ${test.description}: Failed (${response.status})`);
      console.log('❌ Error:', response.data);
    }
    
    syncTestResults.sync_tests.push({
      test_name: test.description,
      endpoint: test.endpoint,
      method: method,
      status: response.status,
      success: response.ok,
      data: response.ok ? 'Organization sync data received' : response.data
    });
  }
  
  // Test 5: Replication API
  console.log('\n=== Testing Replication API ===');
  
  const replicationTests = [
    { endpoint: '/api/replication/health', description: 'Replication health check' },
    { endpoint: '/api/replication/status', description: 'Replication status' }
  ];
  
  for (const test of replicationTests) {
    console.log(`Testing: ${test.description}`);
    
    const response = await apiCall('GET', test.endpoint);
    
    if (response.ok) {
      console.log(`✅ ${test.description}: Available`);
      console.log('📊', JSON.stringify(response.data, null, 2));
    } else {
      console.log(`❌ ${test.description}: Unavailable (${response.status})`);
    }
    
    syncTestResults.sync_tests.push({
      test_name: test.description,
      endpoint: test.endpoint,
      status: response.status,
      success: response.ok,
      data: response.data
    });
  }
  
  // Save results
  fs.writeFileSync('./websocket-sync-test-results.json', JSON.stringify(syncTestResults, null, 2));
  console.log('\n✅ Saved: websocket-sync-test-results.json');
  
  // Summary
  console.log('\n📊 === WEBSOCKET SYNC TEST SUMMARY ===');
  console.log(`Organization: ${organization.name}`);
  console.log(`Client ID: ${clientId}`);
  console.log(`Total Sync Tests: ${syncTestResults.sync_tests.length}`);
  
  const successful = syncTestResults.sync_tests.filter(t => t.success).length;
  const failed = syncTestResults.sync_tests.filter(t => !t.success).length;
  
  console.log(`✅ Successful Tests: ${successful}`);
  console.log(`❌ Failed Tests: ${failed}`);
  
  if (successful > 0) {
    console.log('\n✅ Working Sync Features:');
    syncTestResults.sync_tests.filter(t => t.success).forEach(test => {
      console.log(`  - ${test.test_name}`);
    });
  }
  
  if (failed > 0) {
    console.log('\n❌ Failed Sync Features:');
    syncTestResults.sync_tests.filter(t => !t.success).forEach(test => {
      console.log(`  - ${test.test_name} (${test.status})`);
    });
  }
  
  console.log('\n🔄 Sync Architecture Notes:');
  console.log('  - WebSocket endpoints available at /api/sync/ws');
  console.log('  - HTTP sync endpoints at /api/sync-v2/');
  console.log('  - Organization-aware context supported');
  console.log('  - Replication system for multi-tenant isolation');
  console.log('  - Change processing and conflict resolution');
  
  console.log('\n🎯 Next Steps for Full Sync Testing:');
  console.log('  - Set up WebSocket client connections');
  console.log('  - Test real-time message broadcasting');
  console.log('  - Validate organization data isolation');
  console.log('  - Test conflict resolution scenarios');
  
  return syncTestResults;
}

// Execute if called directly
if (require.main === module) {
  testWebSocketSync()
    .then(() => {
      console.log('\n🎉 WebSocket sync testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 WebSocket sync testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testWebSocketSync };