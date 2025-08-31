#!/usr/bin/env node

/**
 * Simple test to verify auth endpoints are responding
 */

async function testAuthEndpoints() {
  console.log('🔍 Testing auth endpoint availability...');
  
  const baseUrl = 'http://localhost:8787';
  
  const endpoints = [
    '/api/health',
    '/api/auth/session',
    '/api/env/debug'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing ${endpoint}...`);
      const response = await fetch(`${baseUrl}${endpoint}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
      
      const text = await response.text();
      console.log(`   Response: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
      
    } catch (error) {
      console.error(`❌ Error testing ${endpoint}:`, error.message);
    }
  }
  
  // Test if we can sign up a user programmatically
  console.log('\n🔐 Testing programmatic user creation...');
  try {
    const signupResponse = await fetch(`${baseUrl}/api/auth/test-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test-sync@techflow.solutions',
        password: 'TestPassword123!',
        name: 'Test Sync User'
      })
    });
    
    console.log(`   Signup status: ${signupResponse.status}`);
    const signupText = await signupResponse.text();
    console.log(`   Signup response: ${signupText}`);
    
  } catch (error) {
    console.error('❌ Error testing signup:', error.message);
  }
}

if (require.main === module) {
  testAuthEndpoints()
    .then(() => {
      console.log('\n✅ Auth endpoint testing complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Auth endpoint test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testAuthEndpoints };