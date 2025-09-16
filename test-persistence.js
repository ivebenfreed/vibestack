/**
 * Test script to verify VibeGrid persistence implementation
 * Run this in the browser console to test persistence behavior
 */

// Test function to check localStorage for VibeGrid persistence keys
function testVibeGridPersistence() {
  console.log('🧪 Testing VibeGrid Persistence Implementation...\n');

  // Get all localStorage keys related to VibeGrid
  const allKeys = Object.keys(localStorage);
  const vibeGridKeys = allKeys.filter(key =>
    key.includes('vibeGrid') ||
    key.includes('vibestack') ||
    key.includes('vibegridx')
  );

  console.log('📋 Found VibeGrid-related localStorage keys:', vibeGridKeys);

  // Check for the new visual state persistence keys
  const visualStateKeys = vibeGridKeys.filter(key => key.includes('vibeGrid-visual-'));
  const columnKeys = vibeGridKeys.filter(key => key.includes('vibeGrid-columns-'));
  const tableStateKeys = vibeGridKeys.filter(key => key.includes('vibestack-table-'));

  console.log('\n🎯 Visual State Keys (NEW FORMAT):', visualStateKeys);
  console.log('📊 Column Keys (OLD FORMAT):', columnKeys);
  console.log('🗃️ Table State Keys:', tableStateKeys);

  // Examine the content of visual state keys
  visualStateKeys.forEach(key => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      console.log(`\n📝 Content of ${key}:`, {
        hasGroupConfig: !!value.groupConfig,
        groupFields: value.groupConfig?.fields?.length || 0,
        expandedGroups: value.groupConfig?.expandedGroups?.size || 0,
        columnCount: Object.keys(value.columnWidths || {}).length,
        visibleColumns: Object.values(value.columnVisibility || {}).filter(Boolean).length,
        sortCount: value.sortBy?.length || 0,
        filterCount: value.filters?.length || 0,
        version: value.version,
        lastUpdated: value.lastUpdated
      });

      if (value.groupConfig) {
        console.log(`  🎯 Group Config Details:`, {
          fields: value.groupConfig.fields,
          expandedGroups: Array.from(value.groupConfig.expandedGroups || [])
        });
      }
    } catch (e) {
      console.error(`❌ Error parsing ${key}:`, e);
    }
  });

  // Test group state changes
  console.log('\n🧪 To test group state persistence:');
  console.log('1. Apply grouping to a table');
  console.log('2. Expand/collapse some groups');
  console.log('3. Run: testVibeGridPersistence() again');
  console.log('4. Refresh the page');
  console.log('5. Check if group state persisted');

  return {
    totalKeys: vibeGridKeys.length,
    visualStateKeys: visualStateKeys.length,
    columnKeys: columnKeys.length,
    tableStateKeys: tableStateKeys.length
  };
}

// Function to simulate group config changes for testing
function simulateGroupConfigChange() {
  console.log('🧪 Simulating group config change...');

  // Create a test group config
  const testGroupConfig = {
    fields: [{ field: 'status', direction: 'asc' }],
    expandedGroups: new Set(['group_status_in_progress', 'group_status_done'])
  };

  // Check if visualInputs$ is available (Legend State observable)
  if (typeof window !== 'undefined' && window.visualInputs$) {
    window.visualInputs$.groupConfig.set(testGroupConfig);
    console.log('✅ Group config set via visualInputs$');
  } else {
    console.log('⚠️ visualInputs$ not found - this should be called from a VibeGrid context');
  }

  // Check localStorage after a delay
  setTimeout(() => {
    console.log('🔍 Checking localStorage after group config change...');
    testVibeGridPersistence();
  }, 1000);
}

// Function to clear all VibeGrid persistence for testing
function clearVibeGridPersistence() {
  const allKeys = Object.keys(localStorage);
  const vibeGridKeys = allKeys.filter(key =>
    key.includes('vibeGrid') ||
    key.includes('vibestack') ||
    key.includes('vibegridx')
  );

  vibeGridKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ Removed: ${key}`);
  });

  console.log(`✅ Cleared ${vibeGridKeys.length} VibeGrid persistence keys`);
}

// Export functions to global scope for browser console use
if (typeof window !== 'undefined') {
  window.testVibeGridPersistence = testVibeGridPersistence;
  window.simulateGroupConfigChange = simulateGroupConfigChange;
  window.clearVibeGridPersistence = clearVibeGridPersistence;

  console.log('🔧 VibeGrid persistence test functions loaded:');
  console.log('  - testVibeGridPersistence()');
  console.log('  - simulateGroupConfigChange()');
  console.log('  - clearVibeGridPersistence()');
}

// Auto-run test
if (typeof window !== 'undefined') {
  testVibeGridPersistence();
}