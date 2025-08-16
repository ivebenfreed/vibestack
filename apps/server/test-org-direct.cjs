#!/usr/bin/env node

/**
 * Direct Test of Organization System without Authentication
 * Tests endpoints that should work with proper authentication headers
 */

const API_BASE = 'http://localhost:8787/api';

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  const url = `${API_BASE}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    console.log(`🔄 ${method} ${endpoint}`);
    const response = await fetch(url, options);
    
    let result;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = await response.text();
    }
    
    console.log(`${response.ok ? '✅' : '❌'} ${method} ${endpoint} - ${response.status}`);
    if (!response.ok) {
      console.log('Error:', result);
    }
    return { success: response.ok, status: response.status, data: result };
    
  } catch (error) {
    console.log(`💥 ${method} ${endpoint} - Network Error`);
    console.log('Error:', error.message);
    return { success: false, error: error.message };
  }
};

async function testEndpoints() {
  console.log('🚀 Testing Custom Organization System Endpoints');
  console.log('='.repeat(50));

  // Test health endpoint
  const health = await makeRequest('GET', '/health');
  if (!health.success) {
    console.log('❌ Server not healthy, stopping tests');
    return;
  }

  // Test unauthenticated access to organization endpoints (should fail)
  console.log('\n🔒 Testing authentication requirements...');
  
  const tests = [
    ['GET', '/organizations'],
    ['POST', '/organizations', { name: 'Test Org', slug: 'test-org' }],
    ['GET', '/organizations/test-id'],
    ['GET', '/organizations/test-id/members'],
    ['POST', '/organizations/test-id/invitations', { email: 'test@example.com', role: 'member' }]
  ];

  let authRequired = 0;
  let total = tests.length;

  for (const [method, endpoint, data] of tests) {
    const result = await makeRequest(method, endpoint, data);
    if (result.status === 401) {
      authRequired++;
      console.log(`  ✅ ${method} ${endpoint} - Correctly requires authentication`);
    } else {
      console.log(`  ❌ ${method} ${endpoint} - Should require authentication but got ${result.status}`);
    }
  }

  console.log(`\n📊 Authentication Test Results:`);
  console.log(`✅ Properly protected: ${authRequired}/${total}`);
  
  if (authRequired === total) {
    console.log('🎉 All organization endpoints properly require authentication!');
    console.log('✅ Custom organization system security is working correctly');
    return true;
  } else {
    console.log('⚠️ Some endpoints may have security issues');
    return false;
  }
}

testEndpoints().catch(console.error);