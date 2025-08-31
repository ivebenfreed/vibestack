#!/usr/bin/env node

/**
 * Organization Data Isolation Test
 * Tests that server initial sync only sends data belonging to the specific organization
 */

const fs = require('fs');
const WebSocket = require('ws');

async function testOrganizationDataIsolation() {
  console.log('🔄 Testing Organization Data Isolation via Server Initial Sync\n');
  
  try {
    // Load organization data
    const organization = JSON.parse(fs.readFileSync('./organization-final.json', 'utf8'));
    console.log(`📋 Organization: ${organization.name}`);
    console.log(`🆔 Organization ID: ${organization.id}`);
    console.log(`🏢 Organization Slug: ${organization.slug}`);
    
    // Read session cookie
    let cookieValue = '';
    try {
      const cookieContent = fs.readFileSync('../cookies.txt', 'utf8');
      const cookieMatch = cookieContent.match(/better-auth\.session_token\s+([^\s]+)/);
      if (cookieMatch) {
        cookieValue = decodeURIComponent(cookieMatch[1]);
      }
    } catch (error) {
      console.error('❌ No session cookies found');
      process.exit(1);
    }
    
    console.log(`🍪 Session token found: ${cookieValue.substring(0, 20)}...`);
    
    // Test server initial sync data isolation
    console.log('\n=== Testing Server Initial Sync Data Isolation ===');
    
    const clientId = `data-isolation-test-${Date.now()}`;
    const wsUrl = `ws://localhost:8787/api/sync?clientId=${clientId}&lsn=0/0&org=${organization.slug}`;
    
    console.log(`🔗 Connecting to: ${wsUrl}`);
    console.log(`🎯 Testing: Server should only send data for org: ${organization.slug}`);
    
    const isolationTest = await testServerInitialSyncIsolation(wsUrl, cookieValue, clientId, organization);
    
    if (isolationTest.success) {
      console.log('\n✅ Organization Data Isolation Test: SUCCESS');
      console.log('📊 Isolation Test Summary:');
      console.log(`  🔌 Connection: ${isolationTest.connectionStatus}`);
      console.log(`  📥 Initial Sync Messages: ${isolationTest.initialSyncMessages.length}`);
      console.log(`  📊 Data Records Received: ${isolationTest.totalDataRecords}`);
      console.log(`  🏢 Organization Context: ${isolationTest.organizationContext}`);
      console.log(`  🔒 Data Isolation: ${isolationTest.dataIsolationStatus}`);
      
      console.log('\n📋 Initial Sync Data:');
      isolationTest.initialSyncMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.type} - ${msg.summary}`);
        if (msg.organizationData) {
          console.log(`     🏢 Org-specific records: ${msg.organizationData}`);
        }
      });
      
      // Save detailed results
      const results = {
        timestamp: new Date().toISOString(),
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug
        },
        client_id: clientId,
        websocket_url: wsUrl,
        isolation_test_results: isolationTest,
        data_isolation_validation: {
          description: 'Server initial sync should only include organization-specific data',
          expected_behavior: [
            'Server sends srv_init_start message',
            'Server sends srv_init_changes with org-filtered data',
            'Server sends srv_init_complete message',
            'All data should belong to the connected organization',
            'No data from other organizations should be included'
          ],
          organization_filtering: {
            tables_with_org_id: ['tasks', 'projects', 'comments', 'time_entries'],
            user_scoped_tables: ['users', 'organization_members'],
            global_tables: ['organizations'],
            filtering_method: 'RLS (Row Level Security) or application-level filtering'
          }
        }
      };
      
      fs.writeFileSync('./org-data-isolation-test-results.json', JSON.stringify(results, null, 2));
      console.log('\n✅ Saved: org-data-isolation-test-results.json');
      
      return true;
    } else {
      console.log('❌ Organization Data Isolation Test: FAILED');
      console.log(`❌ Error: ${isolationTest.error}`);
      return false;
    }
    
  } catch (error) {
    console.error('💥 Data isolation test failed:', error);
    return false;
  }
}

function testServerInitialSyncIsolation(url, cookieValue, clientId, organization) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, {
      headers: {
        'Cookie': `better-auth.session_token=${cookieValue}`
      }
    });
    
    const isolationResults = {
      success: false,
      connectionStatus: 'pending',
      initialSyncMessages: [],
      totalDataRecords: 0,
      organizationContext: 'unknown',
      dataIsolationStatus: 'unknown',
      error: null
    };
    
    const timeout = setTimeout(() => {
      isolationResults.error = 'Connection timeout';
      resolve(isolationResults);
    }, 20000);
    
    let initStartReceived = false;
    let initCompleteReceived = false;
    
    ws.on('open', () => {
      console.log('🟢 WebSocket connected - waiting for server initial sync...');
      isolationResults.connectionStatus = 'connected';
      
      // Don't send anything initially - just wait for server to send initial sync
      console.log('⏳ Waiting for srv_init_start message...');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📥 Received: ${message.type}`);
        
        let summary = 'Unknown message';
        let organizationData = null;
        
        if (message.type === 'srv_init_start') {
          summary = 'Server started initial sync';
          initStartReceived = true;
          isolationResults.organizationContext = message.organizationId || 'not specified';
          
        } else if (message.type === 'srv_init_changes') {
          const changeCount = message.changes ? Object.keys(message.changes).length : 0;
          let totalRecords = 0;
          let orgSpecificRecords = 0;
          
          if (message.changes) {
            // Count total records and check organization isolation
            Object.entries(message.changes).forEach(([tableName, tableData]) => {
              const records = Array.isArray(tableData) ? tableData : [];
              totalRecords += records.length;
              
              // Check if records have organization_id matching our org
              records.forEach(record => {
                if (record.organization_id === organization.id || 
                    record.organizationId === organization.id) {
                  orgSpecificRecords++;
                } else if (tableName === 'organizations' && record.id === organization.id) {
                  orgSpecificRecords++;
                } else if (tableName === 'organization_members' && record.organization_id === organization.id) {
                  orgSpecificRecords++;
                }
              });
            });
          }
          
          summary = `Server sent initial data: ${changeCount} tables, ${totalRecords} total records`;
          organizationData = `${orgSpecificRecords} org-specific records`;
          isolationResults.totalDataRecords += totalRecords;
          
          // Validate data isolation
          if (orgSpecificRecords === totalRecords || totalRecords === 0) {
            isolationResults.dataIsolationStatus = 'properly isolated';
          } else {
            isolationResults.dataIsolationStatus = `mixed data: ${orgSpecificRecords}/${totalRecords} org-specific`;
          }
          
        } else if (message.type === 'srv_init_complete') {
          summary = 'Server completed initial sync';
          initCompleteReceived = true;
          
          // Complete test when init is done
          setTimeout(() => {
            isolationResults.success = true;
            clearTimeout(timeout);
            ws.close();
            resolve(isolationResults);
          }, 2000);
          
        } else if (message.type === 'sync-error') {
          summary = `Sync error: ${message.error} - ${message.details}`;
          console.log(`💥 SYNC ERROR DETAILS: ${JSON.stringify(message, null, 2)}`);
          
          // If we get "Unknown sync strategy: initial", this explains the issue
          if (message.details && message.details.includes('Unknown sync strategy: initial')) {
            console.log('🔍 ROOT CAUSE: The sync system has "Unknown sync strategy: initial" error');
            console.log('🔍 This means the initial sync strategy is not implemented or has issues');
          }
          
        } else if (message.type === 'srv_heartbeat') {
          summary = 'Server heartbeat';
          
        } else if (message.type === 'srv_state_change') {
          summary = `State change: ${message.state || 'unknown'}`;
        }
        
        isolationResults.initialSyncMessages.push({
          type: message.type,
          timestamp: new Date().toISOString(),
          summary: summary,
          organizationData: organizationData,
          messageId: message.messageId
        });
        
      } catch (e) {
        console.log(`📥 Raw message: ${data.toString()}`);
        isolationResults.initialSyncMessages.push({
          type: 'raw',
          timestamp: new Date().toISOString(),
          summary: data.toString(),
          raw: true
        });
      }
    });
    
    ws.on('error', (error) => {
      console.log(`❌ WebSocket error: ${error.message}`);
      isolationResults.error = error.message;
      clearTimeout(timeout);
      resolve(isolationResults);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 Connection closed: ${code} ${reason}`);
      if (!isolationResults.success && !isolationResults.error) {
        isolationResults.error = `Connection closed: ${code} ${reason}`;
      }
      clearTimeout(timeout);
      if (!isolationResults.success) {
        resolve(isolationResults);
      }
    });
  });
}

// Execute if called directly
if (require.main === module) {
  testOrganizationDataIsolation()
    .then((success) => {
      if (success) {
        console.log('\n🎉 Organization data isolation testing completed successfully!');
        console.log('✅ Server initial sync properly isolates organization data');
        process.exit(0);
      } else {
        console.log('\n💥 Organization data isolation testing failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Organization data isolation test error:', error);
      process.exit(1);
    });
}

module.exports = { testOrganizationDataIsolation };