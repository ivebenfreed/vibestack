/**
 * Test script to make server-side changes and see if Legend State picks them up
 * This simulates what would happen if another user made changes
 */

// Wide Corp organization ID
const orgId = '01920000-1000-7000-8000-000000000001';
const apiBase = 'http://localhost:8787/api';

async function makeServerSideChanges() {
  console.log('🔧 Making server-side changes to test Legend State reactivity...');
  
  try {
    // Test 1: Try to create a new project via API
    console.log('📝 Attempting to create a new project...');
    
    const createResponse = await fetch(`${apiBase}/archetype/orgs/${orgId}/entities/projects`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entityName: 'projects',
        definition: {
          archetype: 'project',
          fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'description', type: 'longtext' },
            { name: 'status', type: 'status_option' },
            { name: 'priority', type: 'priority_option' }
          ]
        },
        data: {
          name: `Test Project ${Date.now()}`,
          description: 'Created by server-side test script',
          status: 'active',
          priority: 'high'
        }
      })
    });
    
    if (createResponse.ok) {
      const result = await createResponse.json();
      console.log('✅ Project created successfully:', result);
    } else {
      console.log('⚠️ Project creation failed:', createResponse.status, await createResponse.text());
    }
    
    // Test 2: Try to fetch projects to see current state
    console.log('📊 Fetching current projects...');
    
    const fetchResponse = await fetch(`${apiBase}/archetype/orgs/${orgId}/entities/projects`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (fetchResponse.ok) {
      const projects = await fetchResponse.json();
      console.log('✅ Current projects:', projects);
    } else {
      console.log('⚠️ Fetch failed:', fetchResponse.status, await fetchResponse.text());
    }
    
    console.log('🎯 Server-side changes completed!');
    console.log('📡 If Legend State polling is active, it should pick up these changes automatically');
    
  } catch (error) {
    console.error('❌ Error making server-side changes:', error);
  }
}

// Test creating changes via direct database manipulation (if we had access)
async function simulateExternalDataChange() {
  console.log(`
🎯 Simulating External Data Changes:

Since we can't directly modify the database from here, Legend State polling 
will demonstrate reactivity by:

1. Random status changes in the mock data (every poll cycle)
2. Timestamp updates showing when data was last fetched
3. Error recovery when API endpoints aren't available

To see real reactivity:
- Open multiple browser tabs with the Legend State POC
- Make changes in one tab 
- Watch other tabs update automatically via polling
- Check console logs for reactive updates
  `);
}

// Instructions
console.log(`
🧪 Server-Side Change Test Instructions:

1. Open browser console
2. Run: makeServerSideChanges()
3. Check if Legend State polling picks up the changes
4. Watch for reactive updates in the UI

For more realistic testing:
- Run this script while Legend State polling is active
- Check console logs for API responses
- Verify UI updates with new data
`);

// Auto-run if we want to test immediately
// makeServerSideChanges().catch(console.error);