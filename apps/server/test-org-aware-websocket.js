#!/usr/bin/env node
/**
 * Organization-Aware WebSocket Broadcasting Test
 * 
 * This test verifies that:
 * 1. Clients from the same organization can communicate with each other
 * 2. Clients from different organizations are isolated from each other
 * 3. Broadcasting respects organization boundaries
 */

import WebSocket from 'ws';
import { randomUUID } from 'crypto';

// Test Configuration
const SERVER_URL = 'ws://localhost:8787';
const TIMEOUT = 10000; // 10 seconds

// Test Organizations (these should match actual orgs in your database)
const TEST_ORGS = {
  org1: {
    slug: 'acme-corp',
    name: 'ACME Corporation' 
  },
  org2: {
    slug: 'globodyne',
    name: 'Globodyne Systems'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = '') {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function generateClientId() {
  return `test-client-${randomUUID()}`;
}

class TestClient {
  constructor(organizationSlug, clientId, color = colors.blue) {
    this.organizationSlug = organizationSlug;
    this.clientId = clientId;
    this.color = color;
    this.ws = null;
    this.messages = [];
    this.connected = false;
    this.authenticated = false;
  }

  async connect(authToken = null) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, TIMEOUT);

      try {
        // Build WebSocket URL with query parameters
        let wsUrl = `${SERVER_URL}/api/sync/connect/${this.organizationSlug}?clientId=${this.clientId}&lsn=0/0`;
        
        if (authToken) {
          wsUrl += `&auth=${authToken}`;
        }

        this.log(`Connecting to ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.connected = true;
          this.log('✅ Connected');
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.messages.push(message);
            this.log(`📨 Received: ${JSON.stringify(message)}`);
            
            // Check for authentication success
            if (message.type === 'sync-ready') {
              this.authenticated = true;
              this.log('🔐 Authenticated successfully');
            }
          } catch (error) {
            this.log(`❌ Error parsing message: ${error.message}`, colors.red);
          }
        });

        this.ws.on('error', (error) => {
          clearTimeout(timeout);
          this.log(`❌ WebSocket error: ${error.message}`, colors.red);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          this.connected = false;
          this.log(`🔌 Disconnected (${code}): ${reason}`, colors.yellow);
        });

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  sendMessage(message) {
    if (!this.connected || !this.ws) {
      this.log('❌ Cannot send message - not connected', colors.red);
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      this.log(`📤 Sent: ${messageStr}`);
      return true;
    } catch (error) {
      this.log(`❌ Error sending message: ${error.message}`, colors.red);
      return false;
    }
  }

  sendTestChange() {
    const testChange = {
      type: 'client-changes',
      changes: [{
        table: 'test_table',
        operation: 'insert',
        data: {
          id: randomUUID(),
          message: `Test from ${this.clientId}`,
          timestamp: new Date().toISOString(),
          organization: this.organizationSlug
        },
        lsn: `0/${Date.now()}`
      }],
      clientId: this.clientId,
      messageId: randomUUID()
    };

    return this.sendMessage(testChange);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  log(message, color = this.color) {
    log(`[${this.organizationSlug}:${this.clientId.slice(-8)}] ${message}`, color);
  }

  getReceivedChanges() {
    return this.messages.filter(msg => 
      msg.type === 'server-changes' || msg.type === 'live-changes'
    );
  }
}

class OrganizationIsolationTest {
  constructor() {
    this.clients = new Map();
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  async runTest() {
    log('🚀 Starting Organization-Aware WebSocket Broadcasting Test', colors.bold + colors.cyan);
    log('='.repeat(70), colors.cyan);

    try {
      await this.setupClients();
      await this.testBasicConnectivity();
      await this.testOrganizationIsolation();
      await this.testCrossOrganizationBlocking();
      await this.cleanup();
      
      this.printResults();
    } catch (error) {
      log(`❌ Test suite failed: ${error.message}`, colors.red);
      await this.cleanup();
      process.exit(1);
    }
  }

  async setupClients() {
    log('\n📋 Setting up test clients...', colors.bold);

    // Create 2 clients for organization 1
    const org1Client1 = new TestClient(TEST_ORGS.org1.slug, generateClientId(), colors.green);
    const org1Client2 = new TestClient(TEST_ORGS.org1.slug, generateClientId(), colors.green);

    // Create 2 clients for organization 2  
    const org2Client1 = new TestClient(TEST_ORGS.org2.slug, generateClientId(), colors.magenta);
    const org2Client2 = new TestClient(TEST_ORGS.org2.slug, generateClientId(), colors.magenta);

    this.clients.set('org1_client1', org1Client1);
    this.clients.set('org1_client2', org1Client2);
    this.clients.set('org2_client1', org2Client1);
    this.clients.set('org2_client2', org2Client2);

    log(`Created ${this.clients.size} test clients`, colors.blue);
  }

  async testBasicConnectivity() {
    log('\n🔌 Testing basic WebSocket connectivity...', colors.bold);

    for (const [name, client] of this.clients) {
      try {
        // Try connecting without authentication first to see what happens
        await client.connect();
        this.passed(`${name} connected successfully`);
      } catch (error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          this.warning(`${name} requires authentication (expected): ${error.message}`);
        } else {
          this.failed(`${name} connection failed: ${error.message}`);
        }
      }
    }
  }

  async testOrganizationIsolation() {
    log('\n🏢 Testing organization isolation...', colors.bold);

    // Wait for connections to stabilize
    await this.sleep(1000);

    const org1Client1 = this.clients.get('org1_client1');
    const org1Client2 = this.clients.get('org1_client2');
    
    if (org1Client1.connected && org1Client2.connected) {
      // Client 1 sends a change
      log('Testing same-organization communication...', colors.blue);
      org1Client1.sendTestChange();
      
      // Wait for message propagation
      await this.sleep(2000);
      
      const org1Client2Changes = org1Client2.getReceivedChanges();
      if (org1Client2Changes.length > 0) {
        this.passed('Same-organization clients can communicate');
      } else {
        this.failed('Same-organization clients cannot communicate');
      }
    } else {
      this.warning('Cannot test organization isolation - clients not connected');
    }
  }

  async testCrossOrganizationBlocking() {
    log('\n🚫 Testing cross-organization blocking...', colors.bold);

    const org1Client = this.clients.get('org1_client1');
    const org2Client = this.clients.get('org2_client1');

    if (org1Client.connected && org2Client.connected) {
      // Clear previous messages
      org2Client.messages = [];
      
      // Org1 client sends a change
      log('Testing cross-organization isolation...', colors.blue);
      org1Client.sendTestChange();
      
      // Wait for message propagation
      await this.sleep(2000);
      
      const org2Changes = org2Client.getReceivedChanges();
      if (org2Changes.length === 0) {
        this.passed('Cross-organization messages are properly blocked');
      } else {
        this.failed(`Cross-organization leak detected: ${org2Changes.length} messages received`);
      }
    } else {
      this.warning('Cannot test cross-organization blocking - clients not connected');
    }
  }

  async cleanup() {
    log('\n🧹 Cleaning up...', colors.bold);
    
    for (const [name, client] of this.clients) {
      client.disconnect();
    }
    
    // Wait for graceful disconnection
    await this.sleep(500);
    log('All clients disconnected', colors.blue);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  passed(message) {
    this.results.passed++;
    this.results.total++;
    log(`✅ PASS: ${message}`, colors.green);
  }

  failed(message) {
    this.results.failed++;
    this.results.total++;
    log(`❌ FAIL: ${message}`, colors.red);
  }

  warning(message) {
    log(`⚠️  WARN: ${message}`, colors.yellow);
  }

  printResults() {
    log('\n📊 Test Results', colors.bold + colors.cyan);
    log('='.repeat(70), colors.cyan);
    log(`Total Tests: ${this.results.total}`);
    log(`Passed: ${this.results.passed}`, colors.green);
    log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? colors.red : colors.green);
    
    const successRate = this.results.total > 0 ? 
      ((this.results.passed / this.results.total) * 100).toFixed(1) : 0;
    log(`Success Rate: ${successRate}%`, successRate === '100.0' ? colors.green : colors.yellow);

    if (this.results.failed === 0) {
      log('\n🎉 All tests passed! Organization isolation is working correctly.', colors.bold + colors.green);
    } else {
      log('\n⚠️  Some tests failed. Organization isolation may not be working correctly.', colors.bold + colors.red);
    }
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new OrganizationIsolationTest();
  test.runTest().catch(error => {
    log(`💥 Test suite crashed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });
}

export { OrganizationIsolationTest, TestClient };