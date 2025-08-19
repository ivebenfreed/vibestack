#!/usr/bin/env node

const WebSocket = require('ws');

async function testWideCorp() {
  const wideCorpId = '01920000-1000-7000-8000-000000000001';
  const sessionToken = 'zWhBgBEb748G0YDRyOGbAYgFcx0TJgRM.hIAliznnIfwxXeC3f5IYCGcP3tZwhC2pyU2lDe3AVIY%3D';
  
  console.log(`🔍 Testing Wide Corp organization: ${wideCorpId}\n`);
  
  const url = `ws://localhost:8787/api/sync?clientId=wide-corp-test-${Date.now()}&organizationId=${wideCorpId}&lsn=0/0`;
  
  console.log(`🔗 Connecting to: ${url}`);
  
  const ws = new WebSocket(url, {
    headers: {
      'Cookie': `better-auth.session_token=${sessionToken}`,
      'Origin': 'http://localhost:5173'
    }
  });
  
  let messageCount = 0;
  let tablesReceived = new Set();
  
  ws.on('open', () => {
    console.log('✅ Connected to Wide Corp sync');
    
    // Send sync request
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'clt_request_sync',
        clientId: `wide-corp-test-${Date.now()}`,
        lsn: '0/0',
        messageId: `sync_${Date.now()}`,
        timestamp: Date.now()
      }));
    }, 1000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      messageCount++;
      
      if (message.type === 'srv_init_changes') {
        message.changes.forEach(change => {
          tablesReceived.add(change.table);
        });
        
        console.log(`📦 Received ${message.changes.length} changes from table: ${message.table}`);
        console.log(`📊 Progress: Table ${message.tableIndex + 1}/${message.totalTables}`);
      } else {
        console.log(`📥 Message: ${message.type}`);
      }
      
    } catch (error) {
      console.error('🔴 Error parsing message:', error);
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`\n🔌 Connection closed: ${code} ${reason}`);
    console.log(`📊 Summary:`);
    console.log(`  Messages received: ${messageCount}`);
    console.log(`  Tables received: ${tablesReceived.size}`);
    console.log(`  Tables: ${Array.from(tablesReceived).join(', ')}`);
    
    // Check if we got Wide Corp tables
    const wideCorpTables = Array.from(tablesReceived).filter(t => 
      t.includes('01920000_1000_7000_8000_000000000001')
    );
    
    if (wideCorpTables.length > 0) {
      console.log(`✅ SUCCESS: Received ${wideCorpTables.length} Wide Corp tables`);
    } else {
      console.log(`❌ ERROR: No Wide Corp tables received`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
  
  // Close after 10 seconds
  setTimeout(() => {
    console.log('\n⏰ Test timeout - closing connection');
    ws.close();
  }, 10000);
}

testWideCorp();