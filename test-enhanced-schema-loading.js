/**
 * Test Enhanced Schema Loading
 * Verify that the enhanced schema client correctly processes the new DataForge structure
 */

import { OrgSchemaClient } from './apps/worker/src/lib/schema-client.ts';

async function testEnhancedSchemaLoading() {
  console.log('🧪 Testing Enhanced Schema Loading...\n');
  
  const schemaClient = new OrgSchemaClient();
  const testOrgId = '01920000-1000-7000-8000-000000000001';
  
  try {
    // Test 1: Load organization schema
    console.log('1. Loading organization schema...');
    const schemaResult = await schemaClient.loadOrgSchema(testOrgId);
    
    if (!schemaResult.success) {
      throw new Error(`Schema loading failed: ${schemaResult.error}`);
    }
    
    console.log(`✅ Schema loaded successfully with ${Object.keys(schemaResult.schema.entities).length} entities`);
    
    // Test 2: Check enhanced entity structure
    console.log('\n2. Testing enhanced entity structure...');
    const entityNames = ['TeamTask', 'TestProduct', 'Task'];  // Entities with different structures
    
    for (const entityName of entityNames) {
      if (schemaResult.schema.entities[entityName]) {
        const entity = schemaResult.schema.entities[entityName];
        console.log(`\n📋 Entity: ${entityName}`);
        console.log(`   Archetype: ${entity.archetype}`);
        console.log(`   Syncable fields: ${Object.keys(entity.syncableFields).length}`);
        console.log(`   Custom fields: ${Object.keys(entity.customFields || {}).length}`);
        console.log(`   Relationship fields: ${Object.keys(entity.relationshipFields || {}).length}`);
        
        // Show some field examples
        const syncableFieldNames = Object.keys(entity.syncableFields).slice(0, 3);
        const customFieldNames = Object.keys(entity.customFields || {}).slice(0, 2);
        const relationshipFieldNames = Object.keys(entity.relationshipFields || {});
        
        if (syncableFieldNames.length > 0) {
          console.log(`   Syncable samples: ${syncableFieldNames.join(', ')}`);
        }
        if (customFieldNames.length > 0) {
          console.log(`   Custom samples: ${customFieldNames.join(', ')}`);
        }
        if (relationshipFieldNames.length > 0) {
          console.log(`   Relationship samples: ${relationshipFieldNames.join(', ')}`);
        }
      }
    }
    
    // Test 3: Generate form fields with relationships
    console.log('\n3. Testing enhanced form field generation...');
    const testEntity = 'TeamTask'; // Has both custom fields and relationships
    const formFields = await schemaClient.generateFormFields(testOrgId, testEntity);
    
    console.log(`✅ Generated ${formFields.length} form fields for ${testEntity}`);
    
    // Group form fields by category
    const fieldsByCategory = formFields.reduce((acc, field) => {
      const category = field.fieldCategory || 'unknown';
      if (!acc[category]) acc[category] = [];
      acc[category].push(field.name);
      return acc;
    }, {});
    
    for (const [category, fields] of Object.entries(fieldsByCategory)) {
      console.log(`   ${category}: ${fields.join(', ')}`);
    }
    
    // Test 4: Test specific field type access
    console.log('\n4. Testing specific field type access...');
    
    const customFields = await schemaClient.getCustomFields(testOrgId, testEntity);
    const relationshipFields = await schemaClient.getRelationshipFields(testOrgId, testEntity);
    
    console.log(`✅ Custom fields for ${testEntity}:`);
    for (const [name, field] of Object.entries(customFields || {})) {
      console.log(`   ${name}: ${field.type} (required: ${field.required})`);
    }
    
    console.log(`✅ Relationship fields for ${testEntity}:`);
    for (const [name, field] of Object.entries(relationshipFields || {})) {
      console.log(`   ${name}: ${field.type} -> ${field.targetEntityType || 'user'} (${field.cardinality})`);
    }
    
    console.log('\n🎉 All tests passed! Enhanced schema loading is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testEnhancedSchemaLoading();