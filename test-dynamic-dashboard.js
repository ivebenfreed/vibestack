/**
 * Quick Dashboard Test with Wide Corp
 * Test the dynamic dashboard loading with organization-specific entities
 */

// Wide Corp test organization
const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

console.log('🧪 Testing Dynamic Dashboard...');

// Test 1: Navigate to dashboard and check for dynamic entity cards
async function testDynamicDashboard() {
  console.log('\n📊 Testing dashboard with dynamic entities...');
  
  // Navigate to dashboard
  window.location.hash = '#/';
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Wait for dashboard to load
  const dashboardElement = document.querySelector('[data-testid="dashboard-content"]');
  if (!dashboardElement) {
    console.error('❌ Dashboard content not found');
    return false;
  }
  
  console.log('✅ Dashboard loaded');
  
  // Check for entity cards
  const entityCards = document.querySelectorAll('[data-testid="dashboard-content"] .grid > div');
  console.log(`📋 Found ${entityCards.length} entity cards`);
  
  // Print card details
  entityCards.forEach((card, index) => {
    const title = card.querySelector('.text-sm.font-medium')?.textContent;
    const count = card.querySelector('.text-2xl.font-bold')?.textContent;
    const description = card.querySelector('.text-muted-foreground.text-xs')?.textContent;
    console.log(`   Card ${index + 1}: ${title} - ${count} (${description})`);
  });
  
  return entityCards.length > 0;
}

// Test 2: Check schema loading
async function testSchemaLoading() {
  console.log('\n🔍 Testing schema loading...');
  
  try {
    const response = await fetch(`/api/archetype/orgs/${WIDE_CORP_ORG_ID}/schema`);
    const data = await response.json();
    
    if (data.success && data.schema) {
      const entities = Object.keys(data.schema.entities);
      console.log(`✅ Schema loaded: ${entities.length} entities`);
      entities.forEach(entity => {
        const tableName = data.schema.entities[entity].tableName;
        console.log(`   - ${entity} (${tableName})`);
      });
      return true;
    } else {
      console.error('❌ Schema loading failed:', data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error loading schema:', error);
    return false;
  }
}

// Test 3: Check LiveStore connectivity
async function testLiveStoreConnectivity() {
  console.log('\n🔗 Testing LiveStore connectivity...');
  
  const liveStore = window.globalLiveStore || window.LiveStore;
  if (!liveStore) {
    console.error('❌ LiveStore not available');
    return false;
  }
  
  try {
    // Test basic query
    const tables = await liveStore.query("SELECT name FROM sqlite_master WHERE type='table'");
    console.log(`✅ LiveStore connected: ${tables.length} tables found`);
    
    // Show org-specific tables
    const orgTables = tables.filter(t => t.name.includes(WIDE_CORP_ORG_ID.replace(/-/g, '')));
    console.log(`📋 Organization tables: ${orgTables.length}`);
    orgTables.forEach(table => {
      console.log(`   - ${table.name}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ LiveStore query failed:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Dynamic Dashboard Tests...');
  
  const results = {
    schema: await testSchemaLoading(),
    liveStore: await testLiveStoreConnectivity(),
    dashboard: await testDynamicDashboard()
  };
  
  console.log('\n📊 Test Results:');
  console.log(`   Schema Loading:     ${results.schema ? '✅' : '❌'}`);
  console.log(`   LiveStore Connect:  ${results.liveStore ? '✅' : '❌'}`);
  console.log(`   Dashboard Display:  ${results.dashboard ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n🎯 Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return results;
}

// Auto-run when loaded
if (typeof window !== 'undefined') {
  // Wait for page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(runAllTests, 3000);
    });
  } else {
    setTimeout(runAllTests, 1000);
  }
}

// Make available in console
if (typeof window !== 'undefined') {
  window.testDynamicDashboard = runAllTests;
}