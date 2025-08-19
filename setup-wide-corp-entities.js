/**
 * Set up DataForge entities for Wide Corp's existing business data
 */

const BASE_URL = 'http://localhost:8787';
const ORG_ID = '01920000-1000-7000-8000-000000000001';

async function setupWideCorp() {
  try {
    console.log('🏗️  Setting up Wide Corp DataForge entities...');
    
    // 1. Create Project entity
    console.log('\n📋 Creating Project entity...');
    const projectEntity = {
      entityName: 'Project',
      definition: {
        fields: {
          id: { type: 'string', primary: true },
          name: { type: 'string', syncable: true, required: true },
          description: { type: 'string', syncable: true },
          status: { type: 'string', syncable: true },
          client_id: { type: 'string', syncable: true },
          organization_id: { type: 'string', syncable: true },
          created_at: { type: 'datetime', syncable: true },
          updated_at: { type: 'datetime', syncable: true }
        },
        syncable: true,
        tableName: `org_${ORG_ID.replace(/-/g, '_')}_project`
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
    }
    
    // 2. Create Client entity
    console.log('\n👥 Creating Client entity...');
    const clientEntity = {
      entityName: 'Client',
      definition: {
        fields: {
          id: { type: 'string', primary: true },
          name: { type: 'string', syncable: true, required: true },
          email: { type: 'string', syncable: true },
          phone: { type: 'string', syncable: true },
          address: { type: 'text', syncable: true },
          organization_id: { type: 'string', syncable: true },
          created_at: { type: 'datetime', syncable: true },
          updated_at: { type: 'datetime', syncable: true }
        },
        syncable: true,
        tableName: `org_${ORG_ID.replace(/-/g, '_')}_client`
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
    }
    
    // 3. Create Task entity
    console.log('\n✅ Creating Task entity...');
    const taskEntity = {
      entityName: 'Task',
      definition: {
        fields: {
          id: { type: 'string', primary: true },
          title: { type: 'string', syncable: true, required: true },
          description: { type: 'text', syncable: true },
          status: { type: 'string', syncable: true },
          priority: { type: 'string', syncable: true },
          project_id: { type: 'string', syncable: true },
          assignee_id: { type: 'string', syncable: true },
          organization_id: { type: 'string', syncable: true },
          due_date: { type: 'datetime', syncable: true },
          created_at: { type: 'datetime', syncable: true },
          updated_at: { type: 'datetime', syncable: true }
        },
        syncable: true,
        tableName: `org_${ORG_ID.replace(/-/g, '_')}_task`
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
    }
    
    // 4. Verify schema now has entities
    console.log('\n🔍 Verifying schema...');
    const schemaResponse = await fetch(`${BASE_URL}/api/dataforge/orgs/${ORG_ID}/schema`);
    const schemaData = await schemaResponse.json();
    
    if (schemaData.success) {
      const entities = Object.keys(schemaData.schema.entities || {});
      console.log('🎯 Schema now has entities:', entities.length, entities);
      
      if (entities.length > 0) {
        console.log('\n🎉 SUCCESS! Wide Corp now has syncable entities configured.');
        console.log('   LiveStore should now be able to initialize and sync data.');
      }
    }
    
  } catch (error) {
    console.error('❌ Setup error:', error.message);
  }
}

setupWideCorp();