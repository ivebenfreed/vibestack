#!/usr/bin/env node

/**
 * Test Wide Corp WebSocket auto-sync (triggered by LSN=0/0)
 */

const WebSocket = require('ws');

async function testWideCorpAutoSync() {
  // Wide Corp CEO session
  const wideCorpId = '01920000-1000-7000-8000-000000000001';
  const sessionToken = 'V4AGOD4N5FLyuEBh7ixAYrGvy6zsdRBy.Jwhr2U7mLvxCrA79hi2lNK5KxUqMPh6Vq3UU6ZRmF3Y%3D';
  
  console.log('🏢 Wide Corp Auto-Sync Test (LSN-triggered)');
  console.log(`Organization: ${wideCorpId}`);
  console.log(`User: Alice CEO (Owner role)\n`);
  
  const clientId = `wide-corp-auto-${Date.now()}`;
  // LSN=0/0 should automatically trigger initial sync
  const url = `ws://localhost:8787/api/sync?clientId=${clientId}&organizationId=${wideCorpId}&lsn=0/0`;
  
  console.log(`🔗 Connecting with LSN=0/0 to trigger auto-sync:`);
  console.log(`   ${url}\n`);
  
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
    console.log('✅ Connected - waiting for LSN-triggered auto-sync...\n');
    // No manual messages needed - LSN=0/0 triggers automatic initial sync
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      messageCount++;
      
      switch (message.type) {
        case 'srv_heartbeat':
          console.log(`💓 Heartbeat: ${message.messageId}`);
          break;
          
        case 'srv_state_change':
          console.log(`🔄 State: ${message.state} (LSN: ${message.lsn})`);
          break;
          
        case 'srv_init_start':
          initStartReceived = true;
          console.log(`🚀 INITIAL SYNC STARTED:`);
          console.log(`   Tables: ${message.tableCount}`);
          console.log(`   Server LSN: ${message.serverLSN}`);
          console.log(`   Resuming: ${message.resuming}\n`);
          break;
          
        case 'srv_init_changes':
          message.changes.forEach(change => {
            tablesReceived.add(change.table);
            recordCount++;
          });
          
          console.log(`📦 ${message.table}: ${message.changes.length} records (${message.tableIndex + 1}/${message.totalTables})`);
          break;
          
        case 'srv_init_complete':
          initCompleteReceived = true;
          console.log(`\n🎉 INITIAL SYNC COMPLETE!`);
          console.log(`   Total records: ${message.totalRecords}`);
          console.log(`   Server LSN: ${message.serverLSN}\n`);
          
          // Close after successful completion
          setTimeout(() => {
            console.log('✅ Auto-sync completed successfully - closing connection');
            ws.close();
          }, 1000);
          break;
          
        default:
          console.log(`📥 ${message.type}`);
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
    console.log('\n📊 AUTO-SYNC SUMMARY:');
    console.log('====================');
    console.log(`Messages received: ${messageCount}`);
    console.log(`Tables synced: ${tablesReceived.size}`);
    console.log(`Total records: ${recordCount}`);
    console.log(`Sync started: ${initStartReceived ? '✅' : '❌'}`);
    console.log(`Sync completed: ${initCompleteReceived ? '✅' : '❌'}`);
    
    if (tablesReceived.size > 0) {
      console.log('\n📋 Tables synced:');
      Array.from(tablesReceived).sort().forEach(table => {
        console.log(`  - ${table}`);
      });
    }
    
    // Security validation
    const wideCorpTables = Array.from(tablesReceived).filter(t => 
      t.includes('01920000_1000_7000_8000_000000000001')
    );
    
    console.log('\n🔍 SECURITY CHECK:');
    if (wideCorpTables.length === tablesReceived.size && tablesReceived.size > 0) {
      console.log('✅ SUCCESS: All tables belong to Wide Corp');
      console.log('✅ No cross-organization data leakage');
    } else if (tablesReceived.size === 0) {
      console.log('⚠️  No tables synced');
    } else {
      console.log('❌ SECURITY ISSUE: Non-Wide Corp tables detected!');
    }
    
    console.log('\n🏆 FINAL RESULT:');
    if (initStartReceived && initCompleteReceived && tablesReceived.size > 0) {
      console.log('✅ WIDE CORP WEBSOCKET SYNC IS WORKING CORRECTLY!');
    } else {
      console.log('❌ Sync did not complete properly');
    }
  }
  
  // Safety timeout
  setTimeout(() => {
    console.log('\n⏰ Safety timeout (60s) - closing connection');
    ws.close();
  }, 60000);
}

testWideCorpAutoSync().catch(console.error);