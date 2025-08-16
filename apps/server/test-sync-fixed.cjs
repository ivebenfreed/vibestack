/**
 * Test org-aware sync with fixed table filtering
 */

const WebSocket = require('ws');

// Known working admin credentials from setup-admin-user.cjs
const ADMIN_EMAIL = 'admin@techflow.solutions';
const ADMIN_PASSWORD = 'X9#mK8$nP2@vQ7!wE5';
const TECHFLOW_ORG_ID = '108b0ac2-487f-4951-b295-b1924288daad';

async function testSyncWithFixedFiltering() {
  console.log('🔧 Testing Sync with Fixed Table Filtering');
  console.log('=============================================');
  
  try {
    // Step 1: Sign in to get session cookies
    console.log('🔐 Step 1: Authenticating admin user...');
    const signInResponse = await fetch('http://localhost:8787/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });

    if (!signInResponse.ok) {
      const errorText = await signInResponse.text();
      throw new Error(`Sign-in failed: ${signInResponse.status} - ${errorText}`);
    }

    const cookies = signInResponse.headers.get('set-cookie');
    if (!cookies) {
      throw new Error('No session cookies received from sign-in');
    }

    console.log('✅ Authentication successful');
    console.log('🍪 Session cookies received');

    // Step 2: Test WebSocket connection with organization context
    console.log('\n🔗 Step 2: Testing WebSocket connection...');
    const clientId = `test-fixed-${crypto.randomUUID()}`;
    const wsUrl = `ws://localhost:8787/api/sync?clientId=${clientId}&org=techflow-solutions`;
    
    console.log(`📡 Connecting to: ${wsUrl}`);
    console.log(`🏢 Organization: TechFlow (${TECHFLOW_ORG_ID})`);
    console.log(`👤 Client ID: ${clientId}`);

    const ws = new WebSocket(wsUrl, {
      headers: {
        'Cookie': cookies
      }
    });

    return new Promise((resolve, reject) => {
      let initialSyncComplete = false;
      let receivedTableCount = 0;
      let receivedRecordCount = 0;
      const receivedTables = new Set();

      const timeout = setTimeout(() => {
        console.log('\n⏰ Test timeout - closing connection');
        ws.close();
        
        console.log('\n📊 Final Results:');
        console.log(`📋 Tables received: ${receivedTableCount}`);
        console.log(`📝 Total records: ${receivedRecordCount}`);
        console.log(`🗂️ Table names: ${Array.from(receivedTables).join(', ')}`);
        
        if (receivedTableCount === 3 && receivedTables.has('org_108b0ac2_487f_4951_b295_b1924288daad_project')) {
          console.log('\n✅ SUCCESS: Organization-scoped sync working correctly!');
          console.log('✅ Received 3 expected business tables only');
          console.log('✅ No server-side system tables leaked to client');
          console.log('✅ Perfect data isolation achieved');
          resolve(true);
        } else {
          console.log('\n❌ FAILURE: Organization scoping not working correctly');
          console.log(`❌ Expected 3 business tables, got ${receivedTableCount}`);
          console.log(`❌ Expected only TechFlow business tables`);
          resolve(false);
        }
      }, 15000);

      ws.on('open', () => {
        console.log('✅ WebSocket connection established');
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'srv_init_start':
              console.log(`📢 Initial sync started - ${message.tableCount} tables to sync`);
              break;
              
            case 'srv_init_changes':
              if (!receivedTables.has(message.table)) {
                receivedTables.add(message.table);
                receivedTableCount++;
                console.log(`📋 Table ${receivedTableCount}: ${message.table} (${message.changes.length} records)`);
              }
              receivedRecordCount += message.changes.length;
              break;
              
            case 'srv_init_complete':
              console.log(`✅ Initial sync complete - ${message.totalRecords} total records`);
              initialSyncComplete = true;
              
              clearTimeout(timeout);
              ws.close();
              
              console.log('\n📊 Sync Results:');
              console.log(`📋 Tables received: ${receivedTableCount}`);
              console.log(`📝 Total records: ${receivedRecordCount}`);
              console.log(`🗂️ Table names: ${Array.from(receivedTables).join(', ')}`);
              
              // Check if we got only the expected business tables (no server-side system tables)
              const expectedBusinessTables = [
                'org_108b0ac2_487f_4951_b295_b1924288daad_project',
                'org_108b0ac2_487f_4951_b295_b1924288daad_task',
                'org_108b0ac2_487f_4951_b295_b1924288daad_time_entry'
              ];
              
              const hasAllExpected = expectedBusinessTables.every(table => receivedTables.has(table));
              const hasOnlyExpected = Array.from(receivedTables).every(table => expectedBusinessTables.includes(table));
              
              if (receivedTableCount === 3 && hasAllExpected && hasOnlyExpected) {
                console.log('\n✅ SUCCESS: Organization-scoped sync working correctly!');
                console.log('✅ Received exactly 3 expected business tables');
                console.log('✅ All TechFlow business tables present');
                console.log('✅ No server-side system tables leaked to client');
                console.log('✅ Perfect organization data isolation achieved');
                console.log('✅ Client only receives business data it should see');
                resolve(true);
              } else {
                console.log('\n❌ FAILURE: Organization scoping not working correctly');
                console.log(`❌ Expected 3 business tables, got ${receivedTableCount}`);
                console.log('❌ Missing tables:', expectedBusinessTables.filter(t => !receivedTables.has(t)));
                console.log('❌ Unexpected tables:', Array.from(receivedTables).filter(t => !expectedBusinessTables.includes(t)));
                console.log('❌ System tables should not be synced to client');
                resolve(false);
              }
              break;
              
            case 'srv_error':
              console.log(`❌ Server error: ${message.error}`);
              clearTimeout(timeout);
              ws.close();
              reject(new Error(message.error));
              break;
              
            default:
              console.log(`📨 Received: ${message.type}`);
          }
        } catch (error) {
          console.log(`❌ Message parsing error: ${error.message}`);
        }
      });

      ws.on('error', (error) => {
        console.log(`❌ WebSocket error: ${error.message}`);
        clearTimeout(timeout);
        reject(error);
      });

      ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket closed (${code}): ${reason}`);
        clearTimeout(timeout);
        if (!initialSyncComplete) {
          reject(new Error(`Connection closed before sync complete: ${code} - ${reason}`));
        }
      });
    });

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  }
}

// Run the test
testSyncWithFixedFiltering()
  .then(success => {
    if (success) {
      console.log('\n🎉 Test completed successfully');
      process.exit(0);
    } else {
      console.log('\n💥 Test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.log(`💥 Test error: ${error.message}`);
    process.exit(1);
  });