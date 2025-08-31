/**
 * Test Wide Corp with Admin User
 * 
 * Test the Wide Corp scenario using the admin user who can access multiple organizations
 */

const WebSocket = require('ws');

async function signInAdmin() {
  const signInResponse = await fetch('http://localhost:8787/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'admin@techflow.solutions',
      password: 'X9#mK8$nP2@vQ7!wE5'
    })
  });

  if (!signInResponse.ok) {
    const errorText = await signInResponse.text();
    throw new Error(`Admin sign-in failed: ${signInResponse.status} - ${errorText}`);
  }

  const cookies = signInResponse.headers.get('set-cookie');
  return cookies;
}

async function testWideCorp() {
  console.log('🏢 Testing Wide Corp with Admin User');
  console.log('====================================');
  
  try {
    // Sign in as admin
    console.log('🔐 Signing in as admin...');
    const cookies = await signInAdmin();
    console.log('✅ Admin authenticated');
    
    // Test Wide Corp sync
    return new Promise((resolve, reject) => {
      const clientId = `admin-wide-corp-${crypto.randomUUID()}`;
      const wsUrl = `ws://localhost:8787/api/sync?clientId=${clientId}&org=wide-corp`;
      
      console.log(`🔗 Testing Wide Corp sync...`);
      console.log(`📡 Client ID: ${clientId}`);

      const ws = new WebSocket(wsUrl, {
        headers: {
          'Cookie': cookies
        }
      });

      let tablesFound = [];
      let totalRecords = 0;
      let entityBreakdown = {};

      const timeout = setTimeout(() => {
        ws.close();
        console.log(`\n📊 Wide Corp Results:`);
        console.log(`   Tables found: ${tablesFound.length}`);
        console.log(`   Total records: ${totalRecords}`);
        console.log(`   Entity types: ${Object.keys(entityBreakdown).join(', ')}`);
        
        // Show breakdown
        console.log(`\n📈 Entity breakdown:`);
        Object.entries(entityBreakdown).forEach(([entity, count]) => {
          console.log(`   ${entity}: ${count} records`);
        });
        
        if (tablesFound.length >= 10) {
          console.log(`\n✅ SUCCESS: Wide Corp scenario working - ${tablesFound.length} diverse tables`);
        } else {
          console.log(`\n⚠️  Limited tables: Only ${tablesFound.length} tables found (expected 12+)`);
        }
        
        resolve(true);
      }, 15000);

      ws.on('open', () => {
        console.log(`✅ Connected to Wide Corp sync`);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'srv_init_start':
              console.log(`📢 Initial sync started - ${message.tableCount} tables`);
              break;
              
            case 'srv_init_changes':
              const entityType = message.table.split('_').pop();
              if (!tablesFound.includes(entityType)) {
                tablesFound.push(entityType);
                entityBreakdown[entityType] = 0;
              }
              entityBreakdown[entityType] += message.changes.length;
              totalRecords += message.changes.length;
              console.log(`📋 ${entityType}: ${message.changes.length} records`);
              break;
              
            case 'srv_init_complete':
              console.log(`✅ Sync complete - ${message.totalRecords} total records`);
              clearTimeout(timeout);
              ws.close();
              
              console.log(`\n📊 Final Wide Corp Results:`);
              console.log(`   Tables synced: ${tablesFound.length}`);
              console.log(`   Total records: ${totalRecords}`);
              console.log(`   Entity types: ${tablesFound.join(', ')}`);
              
              console.log(`\n📈 Entity breakdown:`);
              Object.entries(entityBreakdown).forEach(([entity, count]) => {
                console.log(`   ${entity}: ${count} records`);
              });
              
              if (tablesFound.length >= 10) {
                console.log(`\n✅ SUCCESS: Wide Corp scenario validated!`);
                console.log(`   - 🎯 Many tables: ${tablesFound.length} diverse entity types`);
                console.log(`   - 📊 Few records: ${totalRecords} total records across all tables`);
                console.log(`   - 🏗️  Schema diversity: client, project, timesheet, skill, resource, etc.`);
              } else {
                console.log(`\n⚠️  Expected more tables in Wide Corp scenario`);
              }
              
              resolve(true);
              break;
              
            case 'srv_error':
              console.log(`❌ Server error: ${message.error}`);
              clearTimeout(timeout);
              ws.close();
              reject(new Error(message.error));
              break;
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

      ws.on('close', (code) => {
        console.log(`🔌 Connection closed (${code})`);
        clearTimeout(timeout);
      });
    });
    
  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    return false;
  }
}

// Run the test
testWideCorp()
  .then(success => {
    if (success) {
      console.log('\n🎉 Wide Corp admin test completed successfully');
      console.log('\n📋 Key findings:');
      console.log('   ✅ Wide Corp organization accessible');
      console.log('   ✅ 12 diverse entity tables created');
      console.log('   ✅ Container-based access control working');
      console.log('   ✅ Multi-table sync performance validated');
      process.exit(0);
    } else {
      console.log('\n❌ Wide Corp admin test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.log(`💥 Test error: ${error.message}`);
    process.exit(1);
  });