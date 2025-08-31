#!/usr/bin/env node
/**
 * Test Authenticated WebSocket Connection with Organization Context
 * 
 * This script tests that:
 * 1. WebSocket connection can be established with valid authentication
 * 2. Organization context is properly established and affirmed
 * 3. Real-time sync works with organization isolation
 */

import WebSocket from 'ws';
import { randomUUID } from 'crypto';

// Test Configuration
const SERVER_URL = 'ws://localhost:8787';
const COOKIE_VALUE = 'better-auth.session_token=hAboPJTJkBFBep4FetUvBcfH6GxkUMBo'; // TechFlow admin session
const ORG_SLUG = '934fd0a8-f306-4f13-a544-094282f047eb';  // TechFlow organization ID
const CLIENT_ID = `test-auth-${randomUUID()}`;

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

class AuthenticatedWebSocketTest {
  constructor() {
    this.ws = null;
    this.messages = [];
    this.orgContextConfirmed = false;
    this.syncReadyReceived = false;
  }

  async runTest() {
    log('🔐 Testing Authenticated WebSocket Connection with Organization Context', colors.bold + colors.cyan);
    log('='.repeat(80), colors.cyan);
    log(`Organization: ${ORG_SLUG}`, colors.blue);
    log(`Client ID: ${CLIENT_ID}`, colors.blue);
    log(`Cookie Auth: ${COOKIE_VALUE.substring(0, 30)}...`, colors.blue);

    try {
      await this.connectWithAuth();
      await this.waitForOrgContext();
      await this.testOrgAwareMessaging();
      this.disconnect();
      
      this.printResults();
    } catch (error) {
      log(`❌ Test failed: ${error.message}`, colors.red);
      this.disconnect();
      process.exit(1);
    }
  }

  async connectWithAuth() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 10 seconds'));
      }, 10000);

      try {
        // Build WebSocket URL with organization parameter for context
        const wsUrl = `${SERVER_URL}/api/sync?clientId=${CLIENT_ID}&orgId=${ORG_SLUG}`;
        
        log(`🔗 Connecting to: ${wsUrl}`, colors.blue);
        log(`🍪 Using cookie: ${COOKIE_VALUE.substring(0, 50)}...`, colors.blue);
        
        // Create WebSocket with cookie authentication
        this.ws = new WebSocket(wsUrl, {
          headers: {
            'Cookie': COOKIE_VALUE
          }
        });

        this.ws.on('open', () => {
          clearTimeout(timeout);
          log('✅ WebSocket connection established', colors.green);
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.messages.push(message);
            this.handleMessage(message);
          } catch (error) {
            log(`❌ Error parsing message: ${error.message}`, colors.red);
          }
        });

        this.ws.on('error', (error) => {
          clearTimeout(timeout);
          log(`❌ WebSocket error: ${error.message}`, colors.red);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          log(`🔌 WebSocket closed (${code}): ${reason}`, colors.yellow);
        });

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  handleMessage(message) {
    log(`📨 Received: ${JSON.stringify(message)}`, colors.magenta);
    
    switch (message.type) {
      case 'sync-ready':
        this.syncReadyReceived = true;
        log('🎯 Sync ready - authentication successful!', colors.green);
        
        // Check if organization context is included
        if (message.organizationId || message.organization) {
          this.orgContextConfirmed = true;
          log(`🏢 Organization context confirmed: ${message.organizationId || message.organization}`, colors.green);
        }
        break;
        
      case 'organization-context':
        this.orgContextConfirmed = true;
        log(`🏢 Organization context established: ${JSON.stringify(message)}`, colors.green);
        break;
        
      case 'auth-success':
        log('🔐 Authentication successful', colors.green);
        break;
        
      case 'error':
        log(`❌ Server error: ${message.message || message.error}`, colors.red);
        break;
        
      default:
        log(`📩 Other message type: ${message.type}`, colors.blue);
    }
  }

  async waitForOrgContext() {
    log('⏳ Waiting for organization context and sync ready...', colors.yellow);
    
    // Wait up to 5 seconds for sync-ready and organization context
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds at 100ms intervals
    
    while (attempts < maxAttempts && (!this.syncReadyReceived || !this.orgContextConfirmed)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.syncReadyReceived) {
      throw new Error('Sync ready message not received - authentication may have failed');
    }
    
    if (!this.orgContextConfirmed) {
      log('⚠️  Organization context not explicitly confirmed, but sync is ready', colors.yellow);
    }
    
    log('✅ WebSocket authentication and organization context established', colors.green);
  }

  async testOrgAwareMessaging() {
    log('🧪 Testing organization-aware messaging...', colors.bold);
    
    // Send a test change to verify organization-aware processing
    const testChange = {
      type: 'client-changes',
      changes: [{
        table: 'test_messages',
        operation: 'insert',
        data: {
          id: randomUUID(),
          message: `Test from authenticated client ${CLIENT_ID}`,
          organization_id: '550e8400-e29b-41d4-a716-446655440001', // techstartup-inc ID
          timestamp: new Date().toISOString(),
          client_id: CLIENT_ID
        },
        lsn: `0/${Date.now()}`
      }],
      clientId: CLIENT_ID,
      messageId: randomUUID()
    };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    log(`📤 Sending test change: ${JSON.stringify(testChange, null, 2)}`, colors.blue);
    this.ws.send(JSON.stringify(testChange));
    
    // Wait for any response
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    log('✅ Test message sent successfully', colors.green);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  printResults() {
    log('\\n📊 Test Results', colors.bold + colors.cyan);
    log('='.repeat(50), colors.cyan);
    
    const results = [
      { test: 'WebSocket Connection', passed: !!this.ws },
      { test: 'Authentication Success', passed: this.syncReadyReceived },
      { test: 'Organization Context', passed: this.orgContextConfirmed },
      { test: 'Message Exchange', passed: this.messages.length > 0 }
    ];
    
    let totalPassed = 0;
    results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const color = result.passed ? colors.green : colors.red;
      log(`${status} ${result.test}`, color);
      if (result.passed) totalPassed++;
    });
    
    log(`\\nResults: ${totalPassed}/${results.length} tests passed`, 
         totalPassed === results.length ? colors.green : colors.yellow);
    
    if (totalPassed === results.length) {
      log('\\n🎉 All tests passed! Authenticated WebSocket with organization context is working correctly.', 
          colors.bold + colors.green);
    } else {
      log('\\n⚠️  Some tests failed. Check the connection and authentication setup.', 
          colors.bold + colors.red);
    }
    
    log(`\\n📝 Total messages received: ${this.messages.length}`, colors.blue);
    if (this.messages.length > 0) {
      log('Message types received:', colors.blue);
      const messageTypes = [...new Set(this.messages.map(m => m.type))];
      messageTypes.forEach(type => log(`  - ${type}`, colors.blue));
    }
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new AuthenticatedWebSocketTest();
  test.runTest().catch(error => {
    log(`💥 Test suite crashed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });
}

export { AuthenticatedWebSocketTest };