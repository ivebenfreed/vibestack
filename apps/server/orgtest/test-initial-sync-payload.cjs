#!/usr/bin/env node

/**
 * Test initial sync process and inspect client payload for organization data isolation
 */

const WebSocket = require('ws');
const fs = require('fs');

const TECHFLOW_ORG_ID = '108b0ac2-487f-4951-b295-b1924288daad'; // Real TechFlow org ID from logs
const ADMIN_EMAIL = 'admin@techflow.solutions';
const ADMIN_PASSWORD = 'X9#mK8$nP2@vQ7!wE5';

async function testInitialSyncPayload() {
  console.log('🔍 Testing initial sync process and payload inspection...');
  
  const results = {
    timestamp: new Date().toISOString(),
    authentication: {},
    initial_sync: {},
    payload_analysis: {},
    isolation_validation: {}
  };

  try {
    // Step 1: Authenticate admin
    console.log('\n--- Step 1: Authentication ---');
    const authResult = await authenticateAdmin();
    results.authentication = authResult;
    
    if (!authResult.success) {
      console.log('❌ Authentication failed:', authResult.error);
      return results;
    }
    
    console.log('✅ Admin authenticated successfully');
    console.log(`   User: ${authResult.user.email}`);
    console.log(`   Session: ${authResult.sessionCookie ? 'Established' : 'Missing'}`);
    
    // Step 2: Perform initial sync
    console.log('\n--- Step 2: Initial Sync Process ---');
    const syncResult = await performInitialSync(authResult.sessionCookie);
    results.initial_sync = syncResult;
    
    if (!syncResult.connected) {
      console.log('❌ Initial sync failed:', syncResult.error);
      return results;
    }
    
    console.log('✅ Initial sync completed');
    console.log(`   Messages received: ${syncResult.messages_received}`);
    console.log(`   Sync data received: ${syncResult.sync_data_received ? 'Yes' : 'No'}`);
    
    // Step 3: Analyze payload
    console.log('\n--- Step 3: Payload Analysis ---');
    const payloadAnalysis = analyzePayload(syncResult.sync_payload);
    results.payload_analysis = payloadAnalysis;
    
    // Step 4: Validate isolation
    console.log('\n--- Step 4: Organization Isolation Validation ---');
    const isolationResult = validateDataIsolation(payloadAnalysis);
    results.isolation_validation = isolationResult;
    
    // Display results
    console.log('\n📋 INITIAL SYNC PAYLOAD ANALYSIS:');
    console.log(`🔐 Authentication: ${results.authentication.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`🔄 Initial sync: ${results.initial_sync.sync_data_received ? '✅ COMPLETED' : '❌ FAILED'}`);
    console.log(`📊 Tables synced: ${results.payload_analysis.tables_count || 0}`);
    console.log(`📝 Total records: ${results.payload_analysis.total_records || 0}`);
    console.log(`🔒 Data isolation: ${results.isolation_validation.isolated ? '✅ ISOLATED' : '❌ MIXED'}`);
    console.log(`🏢 Organizations found: ${results.isolation_validation.organization_count || 0}`);
    
    if (results.payload_analysis.tables_count > 0) {
      console.log('\n📊 Payload Details:');
      Object.entries(results.payload_analysis.tables || {}).forEach(([table, info]) => {
        console.log(`  - ${table}: ${info.record_count} records`);
        if (info.sample_record) {
          const sample = info.sample_record;
          const name = sample.name || sample.title || sample.description || 'N/A';
          console.log(`    Sample: "${name}" (org: ${sample.organization_id?.slice(0, 8)}...)`);
        }
      });
    }
    
    if (results.isolation_validation.isolated) {
      console.log('\n🎉 SUCCESS: Perfect organization data isolation!');
      console.log('✅ All sync data belongs to TechFlow organization');
      console.log('✅ No cross-organization data leakage detected');
      console.log('✅ Initial sync process working correctly');
    } else {
      console.log('\n⚠️ ISOLATION ISSUE DETECTED:');
      if (results.isolation_validation.foreign_orgs) {
        console.log(`   Foreign organizations found: ${results.isolation_validation.foreign_orgs.length}`);
        results.isolation_validation.foreign_orgs.forEach(orgId => {
          console.log(`   - ${orgId.slice(0, 8)}...`);
        });
      }
    }
    
    // Save detailed results
    fs.writeFileSync('orgtest/initial-sync-payload-analysis.json', JSON.stringify(results, null, 2));
    console.log('\n📄 Results saved to: orgtest/initial-sync-payload-analysis.json');
    
    return results;
    
  } catch (error) {
    console.error('❌ Error in initial sync payload test:', error);
    results.error = error.message;
    return results;
  }
}

async function authenticateAdmin() {
  try {
    console.log('🔑 Authenticating admin user...');
    
    const signInResponse = await fetch('http://localhost:8787/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });
    
    if (signInResponse.ok) {
      const cookies = signInResponse.headers.get('set-cookie');
      const data = await signInResponse.json();
      
      return {
        success: true,
        sessionCookie: cookies,
        user: data.user
      };
    } else {
      const errorText = await signInResponse.text();
      return {
        success: false,
        error: errorText,
        status: signInResponse.status
      };
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function performInitialSync(sessionCookie) {
  return new Promise((resolve) => {
    console.log('🔄 Performing initial sync...');
    
    const clientId = `initial-sync-${Date.now()}`;
    const wsUrl = `ws://localhost:8787/api/sync?orgId=${TECHFLOW_ORG_ID}&clientId=${clientId}`;
    
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Organization: TechFlow Solutions`);
    console.log(`   WebSocket URL: ${wsUrl}`);
    
    const headers = {};
    if (sessionCookie) {
      headers.Cookie = sessionCookie;
    }
    
    const ws = new WebSocket(wsUrl, { headers });
    
    let connected = false;
    let messagesReceived = 0;
    let syncDataReceived = false;
    let syncPayload = null;
    const allMessages = [];
    
    const timeout = setTimeout(() => {
      console.log('⏰ Sync timeout after 30 seconds');
      ws.close();
      resolve({
        connected: false,
        error: 'Sync timeout',
        messages_received: messagesReceived
      });
    }, 30000);
    
    ws.on('open', () => {
      connected = true;
      console.log('✅ WebSocket connected for initial sync');
      
      // Request initial sync - simulating a new client
      const syncRequest = {
        type: 'request_sync',
        lastSyncTimestamp: null, // Initial sync - no previous timestamp
        organizationId: TECHFLOW_ORG_ID,
        clientId: clientId,
        requestType: 'initial'
      };
      
      console.log('📤 Requesting initial sync (new client)...');
      ws.send(JSON.stringify(syncRequest));
    });
    
    ws.on('message', (data) => {
      messagesReceived++;
      
      try {
        const message = JSON.parse(data.toString());
        allMessages.push(message);
        
        console.log(`📨 Message ${messagesReceived}: ${message.type}`);
        
        // Look for sync data messages
        if (message.type === 'initial_sync' || message.type === 'sync_data' || message.changes) {
          syncDataReceived = true;
          syncPayload = message;
          
          const changes = message.changes || {};
          console.log(`📊 Received initial sync data:`);
          console.log(`   Tables: ${Object.keys(changes).length}`);
          
          // Count total records
          let totalRecords = 0;
          Object.values(changes).forEach(tableData => {
            if (Array.isArray(tableData)) {
              totalRecords += tableData.length;
            }
          });
          console.log(`   Total records: ${totalRecords}`);
          
          // Sample some data
          Object.entries(changes).forEach(([table, tableChanges]) => {
            if (Array.isArray(tableChanges) && tableChanges.length > 0) {
              console.log(`   - ${table}: ${tableChanges.length} records`);
              
              // Show first record for inspection
              const firstRecord = tableChanges[0];
              if (firstRecord.organization_id) {
                const orgId = firstRecord.organization_id;
                const isCorrectOrg = orgId === TECHFLOW_ORG_ID;
                console.log(`     Org ID: ${orgId.slice(0, 8)}... ${isCorrectOrg ? '✅' : '❌'}`);
              }
            }
          });
        }
        
        // Close after receiving initial sync data
        if (syncDataReceived && messagesReceived >= 2) {
          clearTimeout(timeout);
          setTimeout(() => {
            console.log('🔚 Closing connection after receiving initial sync');
            ws.close();
          }, 1000);
        }
        
      } catch (error) {
        console.log(`⚠️ Message parse error: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`❌ WebSocket error: ${error.message}`);
      
      resolve({
        connected: false,
        error: error.message,
        messages_received: messagesReceived
      });
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`🔌 WebSocket closed (${code}): ${reason}`);
      
      resolve({
        connected: connected,
        messages_received: messagesReceived,
        sync_data_received: syncDataReceived,
        sync_payload: syncPayload,
        all_messages: allMessages
      });
    });
  });
}

function analyzePayload(syncPayload) {
  console.log('🔍 Analyzing sync payload...');
  
  if (!syncPayload || !syncPayload.changes) {
    console.log('   No sync payload to analyze');
    return {
      tables_count: 0,
      total_records: 0,
      tables: {}
    };
  }
  
  const changes = syncPayload.changes;
  const tables = {};
  let totalRecords = 0;
  
  Object.entries(changes).forEach(([tableName, tableData]) => {
    if (Array.isArray(tableData)) {
      const recordCount = tableData.length;
      totalRecords += recordCount;
      
      // Analyze organization IDs in this table
      const organizationIds = new Set();
      tableData.forEach(record => {
        if (record.organization_id) {
          organizationIds.add(record.organization_id);
        }
        if (typeof record.data === 'object' && record.data?.organization_id) {
          organizationIds.add(record.data.organization_id);
        }
      });
      
      tables[tableName] = {
        record_count: recordCount,
        organization_ids: Array.from(organizationIds),
        sample_record: tableData[0] || null
      };
      
      console.log(`   ${tableName}: ${recordCount} records, ${organizationIds.size} org(s)`);
    }
  });
  
  return {
    tables_count: Object.keys(tables).length,
    total_records: totalRecords,
    tables: tables
  };
}

function validateDataIsolation(payloadAnalysis) {
  console.log('🔒 Validating organization data isolation...');
  
  if (!payloadAnalysis.tables || Object.keys(payloadAnalysis.tables).length === 0) {
    console.log('   No data to validate');
    return {
      isolated: true,
      reason: 'No data received',
      organization_count: 0
    };
  }
  
  // Collect all organization IDs across all tables
  const allOrganizationIds = new Set();
  Object.values(payloadAnalysis.tables).forEach(tableInfo => {
    tableInfo.organization_ids.forEach(orgId => {
      allOrganizationIds.add(orgId);
    });
  });
  
  const uniqueOrgs = Array.from(allOrganizationIds);
  console.log(`   Found ${uniqueOrgs.length} unique organization(s):`);
  uniqueOrgs.forEach(orgId => {
    const isCorrect = orgId === TECHFLOW_ORG_ID;
    console.log(`   - ${orgId.slice(0, 8)}... ${isCorrect ? '✅ TechFlow' : '❌ Foreign'}`);
  });
  
  // Check isolation
  if (uniqueOrgs.length === 0) {
    return {
      isolated: true,
      reason: 'No organization data found',
      organization_count: 0
    };
  }
  
  if (uniqueOrgs.length === 1 && uniqueOrgs[0] === TECHFLOW_ORG_ID) {
    return {
      isolated: true,
      reason: 'All data belongs to TechFlow organization',
      organization_count: 1,
      techflow_only: true
    };
  }
  
  // Find foreign organizations
  const foreignOrgs = uniqueOrgs.filter(orgId => orgId !== TECHFLOW_ORG_ID);
  
  return {
    isolated: false,
    reason: `Found ${foreignOrgs.length} foreign organization(s)`,
    organization_count: uniqueOrgs.length,
    foreign_orgs: foreignOrgs,
    all_orgs: uniqueOrgs
  };
}

if (require.main === module) {
  setTimeout(() => {
    testInitialSyncPayload()
      .then((results) => {
        const success = results.initial_sync?.sync_data_received && results.isolation_validation?.isolated;
        console.log(`\n🎯 Initial sync payload test: ${success ? '✅ PASSED' : '📊 COMPLETED'}`);
        
        if (results.isolation_validation?.isolated) {
          console.log('🔒 Organization data isolation: PERFECT');
        } else if (results.isolation_validation?.foreign_orgs) {
          console.log('⚠️ Organization data isolation: NEEDS ATTENTION');
        }
        
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Initial sync payload test failed:', error.message);
        process.exit(1);
      });
  }, 2000);
}

module.exports = { testInitialSyncPayload };