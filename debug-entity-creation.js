/**
 * Debug DataForge entity creation
 */

const BASE_URL = 'http://localhost:8787';
const ORG_ID = '01920000-1000-7000-8000-000000000001';

async function debugEntityCreation() {
  try {
    console.log('🔍 Debugging DataForge entity creation...');
    
    // Test with minimal entity first
    const minimalEntity = {
      entityName: 'TestProject',
      definition: {
        fields: {
          id: { type: 'string', primary: true },
          name: { type: 'string', syncable: true, required: true }
        },
        syncable: true
      }
    };
    
    console.log('\n📡 Testing entity creation...');
    console.log('Request body:', JSON.stringify(minimalEntity, null, 2));
    
    const response = await fetch(`${BASE_URL}/api/dataforge/orgs/${ORG_ID}/entities`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(minimalEntity)
    });
    
    console.log('\n📊 Response details:');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    try {
      const responseJson = JSON.parse(responseText);
      console.log('Parsed response:', JSON.stringify(responseJson, null, 2));
      
      if (responseJson.details) {
        console.log('Error details:', responseJson.details);
      }
    } catch (parseError) {
      console.log('Failed to parse JSON response');
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugEntityCreation();