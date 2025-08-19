#!/usr/bin/env node

/**
 * Test Wide Corp WebSocket sync with proper credentials
 */

const WebSocket = require('ws');

async function testWideCorpSync() {
  // Wide Corp CEO session from previous script
  const wideCorpId = '01920000-1000-7000-8000-000000000001';
  const sessionToken = 'V4AGOD4N5FLyuEBh7ixAYrGvy6zsdRBy.Jwhr2U7mLvxCrA79hi2lNK5KxUqMPh6Vq3UU6ZRmF3Y%3D';
  
  console.log('🏢 Testing Wide Corp WebSocket Sync');
  console.log(`Organization: ${wideCorpId}`);
  console.log(`User: Alice CEO (Owner role)\n`);
  
  const clientId = `wide-corp-ceo-${Date.now()}`;
  const url = `ws://localhost:8787/api/sync?clientId=${clientId}&organizationId=${wideCorpId}&lsn=0/0`;
  
  console.log(`🔗 Connecting to: ${url}\n`);
  
  const ws = new WebSocket(url, {
    headers: {
      'Cookie': `better-auth.session_token=${sessionToken}`,
      'Origin': 'http://localhost:5173'
    }
  });
  
  let messageCount = 0;
  let tablesReceived = new Set();
  let recordCount = 0;
  let initStartReceived = false;
  let initCompleteReceived = false;
  
  ws.on('open', () => {
    console.log('✅ Connected to Wide Corp sync successfully');
    
    // Send sync request after connection
    setTimeout(() => {
      const syncRequest = {
        type: 'clt_request_sync',
        clientId: clientId,
        lsn: '0/0',
        messageId: `sync_${Date.now()}`,
        timestamp: Date.now()
      };
      
      console.log('📤 Sending sync request...\n');
      ws.send(JSON.stringify(syncRequest));
    }, 1000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      messageCount++;
      
      switch (message.type) {
        case 'srv_init_start':
          initStartReceived = true;
          console.log(`🚀 Initial sync started:`);
          console.log(`   Tables to sync: ${message.tableCount}`);
          console.log(`   Server LSN: ${message.serverLSN}`);
          console.log(`   Resuming: ${message.resuming}\n`);
          break;
          
        case 'srv_init_changes':
          message.changes.forEach(change => {
            tablesReceived.add(change.table);
            recordCount++;
          });
          
          console.log(`📦 Table: ${message.table}`);
          console.log(`   Records in chunk: ${message.changes.length}`);
          console.log(`   Progress: ${message.tableIndex + 1}/${message.totalTables} tables`);
          console.log(`   Chunk: ${message.chunkIndex + 1}/${message.totalChunks}`);
          
          // Show first record as sample
          if (message.changes.length > 0) {
            const firstRecord = message.changes[0];
            const sampleData = { ...firstRecord.data };
            // Truncate long fields for readability
            Object.keys(sampleData).forEach(key => {
              if (typeof sampleData[key] === 'string' && sampleData[key].length > 50) {
                sampleData[key] = sampleData[key].substring(0, 50) + '...';
              }
            });
            console.log(`   Sample record:`, JSON.stringify(sampleData, null, 2));
          }
          console.log('');
          break;
          
        case 'srv_init_complete':
          initCompleteReceived = true;
          console.log(`🎉 Initial sync completed!`);
          console.log(`   Total records synced: ${message.totalRecords}`);
          console.log(`   Final server LSN: ${message.serverLSN}\n`);
          break;
          
        case 'srv_heartbeat':
          console.log(`💓 Heartbeat received`);
          break;
          
        case 'srv_state_change':
          console.log(`🔄 State change: ${message.state} (LSN: ${message.lsn})`);
          break;
          
        default:
          console.log(`📥 ${message.type}: ${JSON.stringify(message).substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.error('🔴 Error parsing message:', error.message);
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`\n🔌 Connection closed: ${code} ${reason}`);
    printSummary();
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
  
  function printSummary() {
    console.log('\n📊 SYNC SUMMARY:');
    console.log('================');
    console.log(`Messages received: ${messageCount}`);
    console.log(`Tables synced: ${tablesReceived.size}`);
    console.log(`Total records: ${recordCount}`);
    console.log(`Init started: ${initStartReceived ? '✅' : '❌'}`);
    console.log(`Init completed: ${initCompleteReceived ? '✅' : '❌'}`);
    
    if (tablesReceived.size > 0) {
      console.log('\n📋 Tables received:');
      Array.from(tablesReceived).sort().forEach(table => {
        console.log(`  - ${table}`);
      });
    }
    
    // Verify it's Wide Corp data
    const wideCorpTables = Array.from(tablesReceived).filter(t => 
      t.includes('01920000_1000_7000_8000_000000000001')
    );
    
    console.log('\n🔍 SECURITY VALIDATION:');
    if (wideCorpTables.length === tablesReceived.size && tablesReceived.size > 0) {
      console.log('✅ SUCCESS: All tables belong to Wide Corp');
      console.log('✅ No cross-organization data leakage detected');
    } else if (tablesReceived.size === 0) {
      console.log('⚠️  No tables received - check organization data');
    } else {
      console.log('❌ SECURITY ISSUE: Non-Wide Corp tables detected!');
    }
  }
  
  // Close after 30 seconds
  setTimeout(() => {
    console.log('\n⏰ Test timeout - closing connection');
    ws.close();
  }, 30000);
}

testWideCorpSync().catch(console.error);