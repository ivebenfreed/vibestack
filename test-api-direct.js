/**
 * Direct API test to trigger table change notification
 */
const fetch = require('node-fetch');

async function testDirectAPI() {
  try {
    console.log('🚀 Making direct API call to create project...');
    
    // Make direct API call
    const response = await fetch('http://localhost:8787/api/archetype/orgs/01920000-1000-7000-8000-000000000001/data/Project', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'test-script/1.0'
      },
      body: JSON.stringify({
        name: `Direct API Test Project ${Date.now()}`,
        description: 'Created via direct API to test table change notifications',
        status: 'planning',
        project_type: 'development',
        budget: 25000.00
      })
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📊 Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ Project created successfully via direct API!');
      console.log('🔍 Check server logs for table change notifications');
    } else {
      console.log('❌ API call failed');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDirectAPI();