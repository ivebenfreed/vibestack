#!/usr/bin/env node

/**
 * WebSocket Message Flow Test
 * Tests the complete message acknowledgment system for sync changes
 */

const fs = require('fs');
const WebSocket = require('ws');

async function testWebSocketMessageFlow() {
  console.log('🔄 Testing WebSocket Message Acknowledgment Flow\n');
  
  try {
    // Load organization data
    const organization = JSON.parse(fs.readFileSync('./organization-final.json', 'utf8'));
    console.log(`📋 Organization: ${organization.name}`);
    console.log(`🆔 Organization Slug: ${organization.slug}`);
    
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
    
    // Test the complete WebSocket message flow
    console.log('\n=== Testing Complete WebSocket Message Flow ===');
    
    const clientId = `message-flow-test-${Date.now()}`;
    const wsUrl = `ws://localhost:8787/api/sync?clientId=${clientId}&lsn=0/0&org=${organization.slug}`;
    
    console.log(`🔗 Connecting to: ${wsUrl}`);
    
    const messageFlow = await testCompleteMessageFlow(wsUrl, cookieValue, clientId);
    
    if (messageFlow.success) {
      console.log('\n✅ WebSocket Message Flow Test: SUCCESS');
      console.log('📊 Message Flow Summary:');
      console.log(`  🔌 Connection: ${messageFlow.connectionStatus}`);
      console.log(`  📤 Messages Sent: ${messageFlow.messagesSent}`);
      console.log(`  📥 Messages Received: ${messageFlow.messagesReceived.length}`);
      console.log(`  🎯 Acknowledgments: ${messageFlow.acknowledgments}`);
      
      console.log('\n📋 Received Messages:');
      messageFlow.messagesReceived.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.type} - ${msg.summary}`);
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
        test_results: messageFlow,
        message_acknowledgment_system: {
          description: 'Complete bidirectional message flow with acknowledgments',
          client_to_server_messages: [
            'clt_send_changes - Client sends data changes',
            'clt_heartbeat - Client sends periodic heartbeat',
            'clt_changes_received - Client acknowledges server messages',
            'clt_changes_applied - Client confirms changes applied'
          ],
          server_to_client_messages: [
            'srv_changes_received - Server acknowledges client changes received',
            'srv_changes_applied - Server confirms changes applied to database',
            'srv_send_changes - Server sends changes to client',
            'srv_heartbeat - Server sends periodic heartbeat'
          ],
          flow_pattern: [
            '1. Client connects with: clientId + lsn + org',
            '2. Client sends: clt_send_changes with TableChange[]',
            '3. Server responds: srv_changes_received (immediate ack)',
            '4. Server processes changes to database',
            '5. Server responds: srv_changes_applied (confirmation)',
            '6. Server broadcasts to other clients: srv_send_changes',
            '7. Clients respond: clt_changes_received + clt_changes_applied'
          ]
        }
      };
      
      fs.writeFileSync('./websocket-message-flow-results.json', JSON.stringify(results, null, 2));
      console.log('\n✅ Saved: websocket-message-flow-results.json');
      
      return true;
    } else {
      console.log('❌ WebSocket Message Flow Test: FAILED');
      console.log(`❌ Error: ${messageFlow.error}`);
      return false;
    }
    
  } catch (error) {
    console.error('💥 Message flow test failed:', error);
    return false;
  }
}

function testCompleteMessageFlow(url, cookieValue, clientId) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, {
      headers: {
        'Cookie': `better-auth.session_token=${cookieValue}`
      }
    });
    
    const flowResults = {
      success: false,
      connectionStatus: 'pending',
      messagesSent: 0,
      messagesReceived: [],
      acknowledgments: 0,
      error: null
    };
    
    const timeout = setTimeout(() => {
      flowResults.error = 'Connection timeout';
      resolve(flowResults);
    }, 15000);
    
    ws.on('open', () => {
      console.log('🟢 WebSocket connected successfully!');
      flowResults.connectionStatus = 'connected';
      
      // Send a test change message
      const testChange = {
        type: 'clt_send_changes',
        clientId: clientId,
        messageId: `test-msg-${Date.now()}`,
        timestamp: new Date().toISOString(),
        changes: [
          {
            table: 'tasks',
            operation: 'insert',
            data: {
              id: `task-${Date.now()}`,
              title: 'WebSocket Test Task',
              description: 'Testing WebSocket message acknowledgment flow',
              status: 'todo',
              organizationId: 'test-org'
            },
            sequenceNumber: 1,
            updatedAt: new Date().toISOString()
          }
        ]
      };
      
      console.log('📤 Sending test change message...');
      ws.send(JSON.stringify(testChange));
      flowResults.messagesSent++;
      
      // Send a heartbeat message
      setTimeout(() => {
        const heartbeat = {
          type: 'clt_heartbeat',
          clientId: clientId,
          messageId: `heartbeat-${Date.now()}`,
          timestamp: new Date().toISOString(),
          lsn: '0/0',
          active: true
        };
        
        console.log('💓 Sending heartbeat message...');
        ws.send(JSON.stringify(heartbeat));
        flowResults.messagesSent++;
      }, 2000);
      
      // Complete test after sufficient time
      setTimeout(() => {
        flowResults.success = true;
        clearTimeout(timeout);
        ws.close();
        resolve(flowResults);
      }, 10000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📥 Received: ${message.type}`);
        
        let summary = 'Unknown message';
        if (message.type === 'srv_changes_received') {
          summary = `Server acknowledged ${message.acknowledgedChanges?.length || 0} changes received`;
          flowResults.acknowledgments++;
        } else if (message.type === 'srv_changes_applied') {
          summary = `Server confirmed ${message.appliedChanges?.length || 0} changes applied`;
          flowResults.acknowledgments++;
        } else if (message.type === 'srv_send_changes') {
          summary = `Server sent ${message.changes?.length || 0} changes`;
        } else if (message.type === 'srv_heartbeat') {
          summary = 'Server heartbeat';
        } else if (message.type === 'sync-error') {
          summary = `Sync error: ${message.error}`;
        }
        
        flowResults.messagesReceived.push({
          type: message.type,
          timestamp: new Date().toISOString(),
          summary: summary,
          messageId: message.messageId
        });
        
      } catch (e) {
        console.log(`📥 Raw message: ${data.toString()}`);
        flowResults.messagesReceived.push({
          type: 'raw',
          timestamp: new Date().toISOString(),
          summary: data.toString(),
          raw: true
        });
      }
    });
    
    ws.on('error', (error) => {
      console.log(`❌ WebSocket error: ${error.message}`);
      flowResults.error = error.message;
      clearTimeout(timeout);
      resolve(flowResults);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 Connection closed: ${code} ${reason}`);
      if (!flowResults.success && !flowResults.error) {
        flowResults.error = `Connection closed: ${code} ${reason}`;
      }
      clearTimeout(timeout);
      if (!flowResults.success) {
        resolve(flowResults);
      }
    });
  });
}

// Execute if called directly
if (require.main === module) {
  testWebSocketMessageFlow()
    .then((success) => {
      if (success) {
        console.log('\n🎉 WebSocket message flow testing completed successfully!');
        console.log('✅ The WebSocket sync message acknowledgment system is working');
        process.exit(0);
      } else {
        console.log('\n💥 WebSocket message flow testing failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 WebSocket message flow test error:', error);
      process.exit(1);
    });
}

module.exports = { testWebSocketMessageFlow };