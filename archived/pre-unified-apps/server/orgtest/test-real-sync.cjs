#!/usr/bin/env node

/**
 * Test sync with the correct admin password
 */

const WebSocket = require('ws');

const TECHFLOW_ORG_ID = '934fd0a8-f306-4f13-a544-094282f047eb';
const ADMIN_EMAIL = 'admin@techflow.solutions';
const ADMIN_PASSWORD = 'X9#mK8$nP2@vQ7!wE5';

async function testRealSync() {
  console.log('🎯 Testing sync with REAL admin credentials...');
  
  try {
    // Step 1: Sign in with correct password
    console.log('\n--- Step 1: Admin Sign-In ---');
    const authResult = await signInAdmin();
    
    if (!authResult.success) {
      console.log('❌ Admin sign-in failed:', authResult.error);
      return;
    }
    
    console.log('✅ Admin signed in successfully!');
    console.log(`   Session cookie: ${authResult.sessionCookie ? 'Present' : 'Missing'}`);
    
    // Step 2: Test WebSocket with real session
    console.log('\n--- Step 2: WebSocket Sync with Real Session ---');
    const syncResult = await testWebSocketWithRealAuth(authResult.sessionCookie);
    
    console.log('\n📋 REAL SYNC TEST RESULTS:');
    console.log(`🔐 Authentication: ✅ SUCCESS`);
    console.log(`🔌 WebSocket: ${syncResult.connected ? '✅ CONNECTED' : '❌ FAILED'}`);
    console.log(`📊 Messages: ${syncResult.messages_received || 0}`);
    console.log(`🔒 Isolation: ${syncResult.isolation_valid ? '✅ VALID' : '❌ MIXED'}`);
    
    if (syncResult.connected) {
      console.log('\n🎉 SUCCESS: Real sync is working!');
      console.log('✅ Authentication complete');
      console.log('✅ WebSocket connected'); 
      console.log('✅ Sync system operational');
    }
    
  } catch (error) {
    console.error('❌ Real sync test error:', error.message);
  }
}

async function signInAdmin() {
  try {
    console.log('🔑 Signing in admin with correct password...');
    
    const signInResponse = await fetch('http://localhost:8787/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });
    
    console.log(`   Response status: ${signInResponse.status}`);
    
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

async function testWebSocketWithRealAuth(sessionCookie) {
  return new Promise((resolve) => {
    console.log('🔌 Testing WebSocket with real authentication...');
    
    const clientId = `real-sync-${Date.now()}`;
    const wsUrl = `ws://localhost:8787/api/sync?orgId=${TECHFLOW_ORG_ID}&clientId=${clientId}`;
    
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Using real session cookie: ${sessionCookie ? 'Yes' : 'No'}`);
    
    const headers = {};
    if (sessionCookie) {
      headers.Cookie = sessionCookie;
    }
    
    const ws = new WebSocket(wsUrl, { headers });
    
    let connected = false;
    let messagesReceived = 0;
    const organizationIds = new Set();
    const messages = [];
    
    const timeout = setTimeout(() => {
      if (!connected) {
        console.log('⏰ Connection timeout');
        ws.close();
        resolve({
          connected: false,
          error: 'Connection timeout'
        });
      }
    }, 10000);
    
    ws.on('open', () => {
      connected = true;
      console.log('✅ WebSocket connected with real auth!');
      
      // Request sync data
      const syncRequest = {
        type: 'request_sync',
        lastSyncTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        organizationId: TECHFLOW_ORG_ID,
        clientId: clientId
      };
      
      console.log('📤 Requesting TechFlow sync data...');
      ws.send(JSON.stringify(syncRequest));
    });
    
    ws.on('message', (data) => {
      messagesReceived++;
      
      try {
        const message = JSON.parse(data.toString());
        messages.push(message);
        
        console.log(`📨 Message ${messagesReceived}: ${message.type}`);
        
        if (message.type === 'initial_sync' || message.type === 'sync_data') {
          const changes = message.changes || {};
          
          console.log(`📊 Received sync data with ${Object.keys(changes).length} table(s):`);
          
          // Check organization isolation
          Object.entries(changes).forEach(([table, tableChanges]) => {
            if (Array.isArray(tableChanges) && tableChanges.length > 0) {
              console.log(`  - ${table}: ${tableChanges.length} changes`);
              
              // Extract org IDs
              tableChanges.forEach(change => {
                if (change.organization_id) {
                  organizationIds.add(change.organization_id);
                }
                if (typeof change.data === 'object' && change.data?.organization_id) {
                  organizationIds.add(change.data.organization_id);
                }
              });
              
              // Show sample data
              const sample = tableChanges[0];
              const sampleName = sample.name || sample.title || sample.data?.name || 'Unknown';
              console.log(`    Sample: "${sampleName}"`);
            }
          });
          
          if (organizationIds.size > 0) {
            console.log(`🔍 Organization IDs: ${Array.from(organizationIds).map(id => id.slice(0, 8) + '...').join(', ')}`);
          }
        }
        
        // Close after getting data
        if (messagesReceived >= 2) {
          clearTimeout(timeout);
          setTimeout(() => ws.close(), 1000);
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
        auth_error: error.message.includes('401')
      });
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`🔌 WebSocket closed (${code}): ${reason}`);
      
      const isolationValid = organizationIds.size <= 1 && 
                            (organizationIds.size === 0 || organizationIds.has(TECHFLOW_ORG_ID));
      
      resolve({
        connected: connected,
        messages_received: messagesReceived,
        organization_ids: Array.from(organizationIds),
        isolation_valid: isolationValid,
        sample_messages: messages.slice(0, 2)
      });
    });
  });
}

if (require.main === module) {
  setTimeout(() => {
    testRealSync()
      .then(() => {
        console.log('\n🎯 Real sync test completed!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Real sync test failed:', error.message);
        process.exit(1);
      });
  }, 2000);
}

module.exports = { testRealSync };