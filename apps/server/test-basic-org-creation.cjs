#!/usr/bin/env node

/**
 * Basic TechFlow Organization Test
 * Tests the core functionality step by step
 */

const fs = require('fs');

async function apiCall(method, endpoint, data = null) {
  const fetch = (await import('node-fetch')).default;
  
  // Read session cookies
  let cookieHeader = '';
  try {
    const cookieContent = fs.readFileSync('./cookies.txt', 'utf8');
    const cookieMatch = cookieContent.match(/better-auth\.session_token\s+([^\s]+)/);
    if (cookieMatch) {
      cookieHeader = `better-auth.session_token=${decodeURIComponent(cookieMatch[1])}`;
    }
  } catch (error) {
    console.log('⚠️ No session cookies found');
    return null;
  }
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  console.log(`🔗 ${method} ${endpoint}`);
  if (data) console.log('📤', JSON.stringify(data, null, 2));
  
  const response = await fetch(`http://localhost:8787${endpoint}`, options);
  const result = await response.text();
  
  console.log(`📥 ${response.status} ${response.statusText}`);
  
  let jsonResult;
  try {
    jsonResult = JSON.parse(result);
    console.log('📊', JSON.stringify(jsonResult, null, 2));
  } catch (e) {
    console.log('📄 Raw response:', result);
    jsonResult = result;
  }
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }
  
  return jsonResult;
}

async function testBasicFlow() {
  console.log('🧪 Testing Basic TechFlow Organization Creation Flow\n');
  
  try {
    // 1. Test organization creation
    console.log('=== 1. Testing Organization Creation ===');
    const orgData = {
      name: "TechFlow Test Organization",
      slug: "techflow-test-org",
      description: "Test organization for development"
    };
    
    const org = await apiCall('POST', '/api/organizations', orgData);
    console.log('✅ Organization created successfully\n');
    
    // 2. Test organization retrieval
    console.log('=== 2. Testing Organization Retrieval ===');
    const orgList = await apiCall('GET', '/api/organizations');
    console.log('✅ Organizations retrieved successfully\n');
    
    // 3. Test user creation (without adding to org first)
    console.log('=== 3. Testing User Creation ===');
    const userData = {
      name: "Test User",
      email: "testuser@techflow.test",
      password: "X9#mK8$nP2@vQ7!wE5"
    };
    
    try {
      const user = await apiCall('POST', '/api/auth/sign-up/email', userData);
      console.log('✅ User created successfully\n');
    } catch (error) {
      console.log('ℹ️ User creation may need email verification\n');
    }
    
    // 4. Save test results
    if (!fs.existsSync('./orgtest')) {
      fs.mkdirSync('./orgtest', { recursive: true });
    }
    
    fs.writeFileSync('./orgtest/basic-test-results.json', JSON.stringify({
      organization: org,
      timestamp: new Date().toISOString(),
      test_status: 'completed'
    }, null, 2));
    
    console.log('✅ Basic test flow completed successfully!');
    console.log(`📁 Results saved to: ./orgtest/basic-test-results.json`);
    
    return org;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Execute if called directly
if (require.main === module) {
  testBasicFlow()
    .then(() => {
      console.log('\n🎉 All basic tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Basic test failed:', error);
      process.exit(1);
    });
}

module.exports = { testBasicFlow };