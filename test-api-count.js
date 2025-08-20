/**
 * Test Universal Archetype API count endpoint
 */

const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

async function testAPICount() {
  console.log('🧪 Testing API count endpoint...');
  
  try {
    // First get the schema to see what entities exist
    const schemaResponse = await fetch(`http://localhost:8787/api/archetype/orgs/${WIDE_CORP_ORG_ID}/schema`);
    const schemaData = await schemaResponse.json();
    
    if (!schemaData.success) {
      console.error('❌ Schema API failed:', schemaData.error);
      return;
    }
    
    const entities = Object.keys(schemaData.schema.entities);
    console.log(`✅ Found ${entities.length} entities in schema:`);
    entities.forEach(entity => console.log(`   - ${entity}`));
    
    // Test count endpoint for each entity
    console.log('\n🔢 Testing count API for each entity:');
    
    for (const entityName of entities.slice(0, 5)) { // Test first 5
      try {
        const countResponse = await fetch(
          `http://localhost:8787/api/archetype/orgs/${WIDE_CORP_ORG_ID}/data/${entityName}?count=true`
        );
        
        if (countResponse.ok) {
          const countData = await countResponse.json();
          console.log(`   ✅ ${entityName}: ${countData.count} records`);
        } else {
          console.log(`   ❌ ${entityName}: HTTP ${countResponse.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${entityName}: ${error.message}`);
      }
    }
    
    console.log('\n🎯 API count test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAPICount();