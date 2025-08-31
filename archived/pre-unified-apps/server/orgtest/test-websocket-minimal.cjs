#!/usr/bin/env node

/**
 * Minimal WebSocket Test
 * Focus on getting the basic WebSocket connection working
 */

const fs = require('fs');
const WebSocket = require('ws');

async function testMinimalWebSocket() {
  console.log('🔄 Testing Minimal WebSocket Connection\n');
  
  try {
    // Load organization data
    const organization = JSON.parse(fs.readFileSync('./organization-final.json', 'utf8'));
    console.log(`📋 Organization: ${organization.name}`);
    console.log(`🆔 Organization ID: ${organization.id}`);
    
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
    
    // Test different WebSocket URLs
    const testUrls = [
      // Test 1: Just clientId
      `ws://localhost:8787/api/sync?clientId=minimal-test-${Date.now()}`,
      
      // Test 2: ClientId + org param
      `ws://localhost:8787/api/sync?clientId=minimal-test-${Date.now()}&org=${organization.id}`,
      
      // Test 3: ClientId + organization param
      `ws://localhost:8787/api/sync?clientId=minimal-test-${Date.now()}&organization=${organization.id}`,
    ];
    
    for (let i = 0; i < testUrls.length; i++) {
      const url = testUrls[i];
      console.log(`\n--- Test ${i + 1}: ${url} ---`);
      
      try {
        const testResult = await testWebSocketConnection(url, cookieValue);
        console.log(`✅ Test ${i + 1} result:`, testResult.status);
        if (testResult.connected) {
          console.log(`📦 Messages received: ${testResult.messages.length}`);
          testResult.ws.close();
          break; // Success! Stop testing
        }
      } catch (error) {
        console.log(`❌ Test ${i + 1} failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Minimal WebSocket test failed:', error);
  }
}

function testWebSocketConnection(url, cookieValue) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        'Cookie': `better-auth.session_token=${cookieValue}`,
        'Origin': 'http://localhost:5173', // Add explicit origin
      }
    });
    
    const result = {
      ws,
      connected: false,
      messages: [],
      status: 'pending'
    };
    
    const timeout = setTimeout(() => {
      result.status = 'timeout';
      reject(new Error('Connection timeout'));
    }, 5000);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      result.connected = true;
      result.status = 'connected';
      console.log('🟢 WebSocket connected successfully!');
      resolve(result);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        result.messages.push(message);
        console.log('📥 Message received:', message);
      } catch (e) {
        result.messages.push({ raw: data.toString() });
        console.log('📥 Raw message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      result.status = `error: ${error.message}`;
      reject(error);
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      result.status = `closed: ${code} ${reason}`;
      console.log(`🔌 Connection closed: ${code} ${reason}`);
      if (!result.connected) {
        reject(new Error(`Connection closed: ${code} ${reason}`));
      }
    });
  });
}

// Execute if called directly
if (require.main === module) {
  testMinimalWebSocket()
    .then(() => {
      console.log('\n🎉 Minimal WebSocket testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Minimal WebSocket testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testMinimalWebSocket };