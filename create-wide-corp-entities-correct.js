/**
 * Create Wide Corp DataForge entities with correct format
 */

const BASE_URL = 'http://localhost:8787';
const ORG_ID = '01920000-1000-7000-8000-000000000001';

async function createWideCorp() {
  try {
    console.log('🏗️  Creating Wide Corp DataForge entities (correct format)...');
    
    // 1. Create Project entity (extends base_projects)
    console.log('\n📋 Creating Project entity...');
    const projectEntity = {
      entityName: 'Project',
      definition: {
        extends: 'base_projects',
        customFields: {
          client_id: { type: 'string', syncable: true },
          budget: { type: 'number', syncable: true },
          estimated_hours: { type: 'number', syncable: true }
        },
        syncable: true
      }
    };
    
    const projectResponse = await fetch(`${BASE_URL}/api/dataforge/orgs/${ORG_ID}/entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectEntity)
    });
    
    const projectResult = await projectResponse.json();
    console.log('📋 Project entity result:', projectResult.success ? '✅' : '❌');
    if (!projectResult.success) {
      console.log('   Error:', projectResult.error);
      console.log('   Details:', projectResult.details);
    } else {
      console.log('   Table:', projectResult.entity.tableName);
    }
    
    // 2. Create Task entity (extends base_tasks)
    console.log('\n✅ Creating Task entity...');
    const taskEntity = {
      entityName: 'Task',
      definition: {
        extends: 'base_tasks',
        customFields: {
          project_id: { type: 'string', syncable: true },
          estimated_hours: { type: 'number', syncable: true },
          actual_hours: { type: 'number', syncable: true }
        },
        syncable: true
      }
    };
    
    const taskResponse = await fetch(`${BASE_URL}/api/dataforge/orgs/${ORG_ID}/entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskEntity)
    });
    
    const taskResult = await taskResponse.json();
    console.log('✅ Task entity result:', taskResult.success ? '✅' : '❌');
    if (!taskResult.success) {
      console.log('   Error:', taskResult.error);
      console.log('   Details:', taskResult.details);
    } else {
      console.log('   Table:', taskResult.entity.tableName);
    }
    
    // 3. Create Client entity (extends base_contacts)
    console.log('\n👥 Creating Client entity...');
    const clientEntity = {
      entityName: 'Client',
      definition: {
        extends: 'base_contacts',
        customFields: {
          company: { type: 'string', syncable: true },
          billing_address: { type: 'text', syncable: true },
          payment_terms: { type: 'string', syncable: true }
        },
        syncable: true
      }
    };
    
    const clientResponse = await fetch(`${BASE_URL}/api/dataforge/orgs/${ORG_ID}/entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientEntity)
    });
    
    const clientResult = await clientResponse.json();
    console.log('👥 Client entity result:', clientResult.success ? '✅' : '❌');
    if (!clientResult.success) {
      console.log('   Error:', clientResult.error);
      console.log('   Details:', clientResult.details);
    } else {
      console.log('   Table:', clientResult.entity.tableName);
    }
    
    // 4. Verify schema now has entities
    console.log('\n🔍 Verifying schema...');
    const schemaResponse = await fetch(`${BASE_URL}/api/dataforge/orgs/${ORG_ID}/schema`);
    const schemaData = await schemaResponse.json();
    
    if (schemaData.success) {
      const entities = Object.keys(schemaData.schema.entities || {});
      console.log('🎯 Schema now has entities:', entities.length, entities);
      
      if (entities.length > 0) {
        console.log('\n🎉 SUCCESS! Wide Corp now has syncable entities:');
        entities.forEach(entity => {
          const entityDef = schemaData.schema.entities[entity];
          console.log(`   📦 ${entity}: ${Object.keys(entityDef.columns || {}).length} columns`);
        });
        
        console.log('\n✨ LiveStore should now be able to initialize and sync data!');
      }
    }
    
  } catch (error) {
    console.error('❌ Creation error:', error.message);
  }
}

createWideCorp();