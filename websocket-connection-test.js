#!/usr/bin/env node

/**
 * WebSocket Connection Stability Test
 * 
 * Tests WebSocket connections to identify stability issues:
 * - Connection establishment
 * - Message sending/receiving
 * - Heartbeat functionality
 * - Reconnection behavior
 * - Multiple client simulation
 */

const WebSocket = require('ws');

// Configuration
const CONFIG = {
  serverUrl: 'ws://localhost:8787/api/sync',
  organizationId: '108b0ac2-487f-4951-b295-b1924288daad',
  sessionToken: 'zWhBgBEb748G0YDRyOGbAYgFcx0TJgRM.hIAliznnIfwxXeC3f5IYCGcP3tZwhC2pyU2lDe3AVIY%3D',
  testDurationMs: 30000, // 30 seconds
  heartbeatIntervalMs: 5000, // 5 seconds
  clients: 2 // Number of concurrent clients
};

class WebSocketTester {
  constructor(clientId, config) {
    this.clientId = clientId;
    this.config = config;
    this.ws = null;
    this.stats = {
      connectAttempts: 0,
      connectSuccesses: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      reconnects: 0,
      disconnects: 0
    };
    this.isRunning = false;
    this.heartbeatTimer = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.stats.connectAttempts++;
      
      const url = `${this.config.serverUrl}?clientId=${this.clientId}&organizationId=${this.config.organizationId}&lsn=0/0`;
      
      console.log(`[${this.clientId}] 🔌 Connecting to: ${url}`);
      
      this.ws = new WebSocket(url, {
        headers: {
          'Cookie': `better-auth.session_token=${this.config.sessionToken}`,
          'Origin': 'http://localhost:5173'
        }
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.stats.connectSuccesses++;
        console.log(`[${this.clientId}] ✅ Connected successfully`);
        this.setupMessageHandlers();
        this.startHeartbeat();
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.stats.errors++;
        console.error(`[${this.clientId}] ❌ Connection error:`, error.message);
        reject(error);
      });
    });
  }

  setupMessageHandlers() {
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.stats.messagesReceived++;
        
        // Log non-heartbeat messages
        if (message.type !== 'srv_heartbeat_ack') {
          console.log(`[${this.clientId}] 📥 Received:`, message.type, message.messageId || '');
        }
        
        // Handle specific message types
        switch (message.type) {
          case 'srv_sync_strategy':
            console.log(`[${this.clientId}] 🎯 Sync strategy:`, message.strategy);
            break;
          case 'srv_sync_error':
            console.log(`[${this.clientId}] ⚠️ Sync error:`, message.error);
            break;
          case 'srv_heartbeat_ack':
            // Heartbeat acknowledged - connection is healthy
            break;
          default:
            console.log(`[${this.clientId}] 📦 Message:`, message);
        }
      } catch (error) {
        console.error(`[${this.clientId}] 🔴 Error parsing message:`, error.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.stats.disconnects++;
      console.log(`[${this.clientId}] 🔌 Connection closed:`, code, reason.toString());
      this.stopHeartbeat();
      
      // Auto-reconnect if running
      if (this.isRunning && code !== 1000) {
        setTimeout(() => {
          console.log(`[${this.clientId}] 🔄 Attempting reconnect...`);
          this.stats.reconnects++;
          this.connect().catch(err => {
            console.error(`[${this.clientId}] 💥 Reconnect failed:`, err.message);
          });
        }, 3000);
      }
    });

    this.ws.on('error', (error) => {
      this.stats.errors++;
      console.error(`[${this.clientId}] 🔴 WebSocket error:`, error.message);
    });
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat = {
          type: 'clt_heartbeat',
          clientId: this.clientId,
          lsn: '0/0',
          messageId: `heartbeat_${Date.now()}`,
          timestamp: Date.now()
        };
        
        this.sendMessage(heartbeat);
      }
    }, this.config.heartbeatIntervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        this.stats.messagesSent++;
        
        // Only log non-heartbeat messages
        if (message.type !== 'clt_heartbeat') {
          console.log(`[${this.clientId}] 📤 Sent:`, message.type, message.messageId || '');
        }
      } catch (error) {
        this.stats.errors++;
        console.error(`[${this.clientId}] 💥 Error sending message:`, error.message);
      }
    } else {
      console.error(`[${this.clientId}] ❌ Cannot send message - connection not ready`);
    }
  }

  async start() {
    this.isRunning = true;
    try {
      await this.connect();
      console.log(`[${this.clientId}] 🚀 Test started - running for ${this.config.testDurationMs}ms`);
      
      // Test initial sync request
      setTimeout(() => {
        this.sendMessage({
          type: 'clt_request_sync',
          clientId: this.clientId,
          lsn: '0/0',
          messageId: `sync_${Date.now()}`,
          timestamp: Date.now()
        });
      }, 2000);
      
    } catch (error) {
      console.error(`[${this.clientId}] 💥 Failed to start:`, error.message);
    }
  }

  stop() {
    console.log(`[${this.clientId}] 🛑 Stopping test...`);
    this.isRunning = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Test completed');
    }
  }

  getStats() {
    return {
      clientId: this.clientId,
      ...this.stats,
      successRate: this.stats.connectAttempts > 0 ? 
        (this.stats.connectSuccesses / this.stats.connectAttempts * 100).toFixed(2) + '%' : '0%'
    };
  }
}

async function runTest() {
  console.log('🔄 Starting WebSocket Connection Stability Test\n');
  console.log('Configuration:');
  console.log(`  Server: ${CONFIG.serverUrl}`);
  console.log(`  Organization: ${CONFIG.organizationId}`);
  console.log(`  Duration: ${CONFIG.testDurationMs}ms`);
  console.log(`  Heartbeat: ${CONFIG.heartbeatIntervalMs}ms`);
  console.log(`  Clients: ${CONFIG.clients}\n`);

  const testers = [];
  
  // Create and start multiple clients
  for (let i = 1; i <= CONFIG.clients; i++) {
    const clientId = `stability-test-${i}-${Date.now()}`;
    const tester = new WebSocketTester(clientId, CONFIG);
    testers.push(tester);
    
    // Stagger connection attempts
    setTimeout(() => {
      tester.start();
    }, i * 1000);
  }

  // Run test for specified duration
  await new Promise(resolve => setTimeout(resolve, CONFIG.testDurationMs));

  // Stop all clients
  console.log('\n🏁 Test duration completed - stopping clients...');
  testers.forEach(tester => tester.stop());

  // Wait for clean shutdown
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Print results
  console.log('\n📊 Test Results:');
  console.log('================');
  
  let totalStats = {
    connectAttempts: 0,
    connectSuccesses: 0,
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    reconnects: 0,
    disconnects: 0
  };

  testers.forEach(tester => {
    const stats = tester.getStats();
    console.log(`\n[${stats.clientId}]:`);
    console.log(`  Connections: ${stats.connectSuccesses}/${stats.connectAttempts} (${stats.successRate})`);
    console.log(`  Messages: ${stats.messagesSent} sent, ${stats.messagesReceived} received`);
    console.log(`  Issues: ${stats.errors} errors, ${stats.reconnects} reconnects, ${stats.disconnects} disconnects`);
    
    // Add to totals
    Object.keys(totalStats).forEach(key => {
      totalStats[key] += stats[key];
    });
  });

  console.log('\n🎯 Summary:');
  console.log(`  Overall Success Rate: ${totalStats.connectAttempts > 0 ? 
    (totalStats.connectSuccesses / totalStats.connectAttempts * 100).toFixed(2) + '%' : '0%'}`);
  console.log(`  Total Messages: ${totalStats.messagesSent} sent, ${totalStats.messagesReceived} received`);
  console.log(`  Issues: ${totalStats.errors} errors, ${totalStats.reconnects} reconnects`);
  
  // Analysis
  console.log('\n🔍 Analysis:');
  if (totalStats.errors === 0 && totalStats.reconnects === 0) {
    console.log('  ✅ No connection stability issues detected');
  } else {
    console.log('  ⚠️ Connection stability issues found:');
    if (totalStats.errors > 0) {
      console.log(`    - ${totalStats.errors} errors occurred`);
    }
    if (totalStats.reconnects > 0) {
      console.log(`    - ${totalStats.reconnects} reconnection attempts`);
    }
  }
  
  if (totalStats.messagesReceived === 0) {
    console.log('  ⚠️ No messages received - check server message handling');
  }

  console.log('\n🎉 WebSocket stability test completed!');
}

// Run the test
if (require.main === module) {
  runTest().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

module.exports = { WebSocketTester, runTest };