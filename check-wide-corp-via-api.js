/**
 * Check Wide Corp business data via API
 */

const BASE_URL = 'http://localhost:8787';
const ORG_ID = '01920000-1000-7000-8000-000000000001';

async function checkWideCorp() {
  try {
    console.log('🏢 Checking Wide Corp data via API...');
    
    // Check database health
    const healthResponse = await fetch(`${BASE_URL}/api/db/kysely-test`);
    const healthData = await healthResponse.json();
    console.log('🔍 Database Health:', healthData.success ? '✅' : '❌');
    console.log('   User count:', healthData.data?.userCount || 'unknown');
    
    // Try to query projects directly through a test API if available
    console.log('\n📋 Checking for DataForge schema...');
    const schemaResponse = await fetch(`${BASE_URL}/api/dataforge/orgs/${ORG_ID}/schema`);
    const schemaData = await schemaResponse.json();
    console.log('📊 Schema Response:', schemaData);
    
    // Check what entities are available
    if (schemaData.success && schemaData.schema) {
      const entities = Object.keys(schemaData.schema.entities || {});
      console.log('🎯 Available entities:', entities.length, entities);
      
      if (entities.length === 0) {
        console.log('\n⚠️  NO ENTITIES FOUND!');
        console.log('   This means Wide Corp has no business data configured for sync.');
        console.log('   Projects and clients exist in database but not in LiveStore schema.');
      }
    }
    
  } catch (error) {
    console.error('❌ API error:', error.message);
  }
}

checkWideCorp();