#!/usr/bin/env node

/**
 * Extended Wide Corp WebSocket sync test - includes all message types
 */

const WebSocket = require('ws');

async function testWideCorpSyncExtended() {
  // Wide Corp CEO session
  const wideCorpId = '01920000-1000-7000-8000-000000000001';
  const sessionToken = 'V4AGOD4N5FLyuEBh7ixAYrGvy6zsdRBy.Jwhr2U7mLvxCrA79hi2lNK5KxUqMPh6Vq3UU6ZRmF3Y%3D';
  
  console.log('🏢 Extended Wide Corp WebSocket Sync Test');
  console.log(`Organization: ${wideCorpId}`);
  console.log(`User: Alice CEO (Owner role)\n`);
  
  const clientId = `wide-corp-ceo-ext-${Date.now()}`;
  const url = `ws://localhost:8787/api/sync?clientId=${clientId}&organizationId=${wideCorpId}&lsn=0/0`;
  
  console.log(`🔗 Connecting to: ${url}\n`);
  
  const ws = new WebSocket(url, {
    headers: {
      'Cookie': `better-auth.session_token=${sessionToken}`,
      'Origin': 'http://localhost:5173'
    }
  });
  
  let messageCount = 0;
  let connected = false;
  
  ws.on('open', () => {
    connected = true;
    console.log('✅ Connected successfully - waiting for server messages...\n');
    
    // Don't send anything initially - just wait for server to send heartbeats or state changes
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      messageCount++;
      
      console.log(`📥 Message ${messageCount}: ${message.type}`);
      console.log(`   Full message:`, JSON.stringify(message, null, 2));
      console.log('');
      
      // Respond to specific message types
      if (message.type === 'srv_heartbeat') {
        // Send heartbeat response
        const heartbeatAck = {
          type: 'clt_heartbeat_ack',
          clientId: clientId,
          messageId: `ack_${Date.now()}`,
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(heartbeatAck));
        console.log('📤 Sent heartbeat acknowledgment\n');
      }
      
      if (message.type === 'srv_state_change' && message.state === 'initial') {
        // Server is ready for initial sync - send sync request
        const syncRequest = {
          type: 'clt_request_sync',
          clientId: clientId,
          lsn: '0/0',
          messageId: `sync_${Date.now()}`,
          timestamp: Date.now()
        };
        
        console.log('📤 Server ready - sending sync request...');
        ws.send(JSON.stringify(syncRequest));
        console.log('');
      }
      
    } catch (error) {
      console.error('🔴 Error parsing message:', error.message);
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`\n🔌 Connection closed: ${code} ${reason}`);
    console.log(`📊 Summary: ${messageCount} messages received`);
    console.log(`Connection lasted: ${connected ? 'Success' : 'Failed'}`);
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
  
  // Close after 20 seconds to see initial flow
  setTimeout(() => {
    console.log('\n⏰ Test timeout - closing connection');
    ws.close();
  }, 20000);
}

testWideCorpSyncExtended().catch(console.error);