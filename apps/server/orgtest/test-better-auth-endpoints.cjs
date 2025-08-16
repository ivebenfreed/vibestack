#!/usr/bin/env node

/**
 * Test Better Auth endpoints to find the correct sign-in method
 */

async function testBetterAuthEndpoints() {
  console.log('🔍 Testing Better Auth endpoint availability...');
  
  const baseUrl = 'http://localhost:8787';
  
  // Test different Better Auth endpoints
  const endpoints = [
    '/api/auth/sign-in',
    '/api/auth/sign-in/email', 
    '/api/auth/signin',
    '/api/auth/signin/email',
    '/api/auth/session',
    '/api/auth/me'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing ${endpoint}...`);
      
      // Try GET first
      const getResponse = await fetch(`${baseUrl}${endpoint}`);
      console.log(`   GET: ${getResponse.status}`);
      
      // Try POST for sign-in endpoints
      if (endpoint.includes('sign-in') || endpoint.includes('signin')) {
        const postResponse = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'testpass'
          })
        });
        console.log(`   POST: ${postResponse.status}`);
        
        if (postResponse.status !== 404) {
          const responseText = await postResponse.text();
          console.log(`   Response: ${responseText.substring(0, 200)}...`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${endpoint}:`, error.message);
    }
  }
  
  // Test if we can discover available endpoints
  console.log('\n🔍 Testing endpoint discovery...');
  try {
    const discoverResponse = await fetch(`${baseUrl}/api/auth`);
    console.log(`Auth root status: ${discoverResponse.status}`);
    
    if (discoverResponse.ok) {
      const text = await discoverResponse.text();
      console.log(`Auth root response: ${text.substring(0, 500)}...`);
    }
  } catch (error) {
    console.error('❌ Error discovering endpoints:', error.message);
  }
}

if (require.main === module) {
  testBetterAuthEndpoints()
    .then(() => {
      console.log('\n✅ Better Auth endpoint testing complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Better Auth endpoint test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testBetterAuthEndpoints };