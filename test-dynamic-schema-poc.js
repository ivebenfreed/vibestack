/**
 * Dynamic Schema POC Test Script
 * 
 * Quick test script to validate the dynamic schema POC functionality
 * using Wide Corp test organization.
 */

console.log('🧪 Starting Dynamic Schema POC Test...');

// Test script for browser console or Node.js testing
async function testDynamicSchemaPOC() {
  try {
    console.log('📋 Dynamic Schema POC Test Results:');
    console.log('=====================================');
    
    // Import the POC module
    const { dynamicSchemaPOC, pocHelpers, WIDE_CORP_ORG_ID } = await import('./apps/web/src/lib/dynamic-schema-poc.ts');
    
    console.log(`🏢 Using Wide Corp organization: ${WIDE_CORP_ORG_ID}`);
    
    // 1. Initialize POC
    console.log('\n1️⃣ Initializing POC...');
    const initResult = await dynamicSchemaPOC.initialize();
    console.log('Init result:', initResult);
    
    if (!initResult.success) {
      throw new Error(`Initialization failed: ${initResult.error}`);
    }
    
    // 2. Get current schema info
    console.log('\n2️⃣ Current schema info:');
    const info = pocHelpers.getInfo();
    console.log(info);
    
    // 3. Test adding a field
    console.log('\n3️⃣ Testing add field...');
    const addResult = await pocHelpers.addField('Project', 'pocBudget', 'number');
    console.log('Add field result:', addResult);
    
    // 4. Test changing field type
    console.log('\n4️⃣ Testing change field type...');
    const changeResult = await dynamicSchemaPOC.testChangeFieldType('Project', 'pocBudget', 'string');
    console.log('Change type result:', changeResult);
    
    // 5. Test removing field
    console.log('\n5️⃣ Testing remove field...');
    const removeResult = await pocHelpers.removeField('Project', 'pocBudget');
    console.log('Remove field result:', removeResult);
    
    // 6. Run full test suite
    console.log('\n6️⃣ Running full test suite...');
    const suiteResult = await pocHelpers.runTests();
    console.log('Test suite result:', suiteResult);
    
    console.log('\n✅ POC Test Completed Successfully!');
    console.log('=====================================');
    
    return {
      success: true,
      results: {
        init: initResult,
        add: addResult,
        change: changeResult,
        remove: removeResult,
        suite: suiteResult
      }
    };
    
  } catch (error) {
    console.error('❌ POC Test Failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Browser console helper
if (typeof window !== 'undefined') {
  window.testDynamicSchemaPOC = testDynamicSchemaPOC;
  console.log('💡 Browser test function available: window.testDynamicSchemaPOC()');
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testDynamicSchemaPOC };
}

// Auto-run if called directly
if (typeof window === 'undefined') {
  testDynamicSchemaPOC().then(result => {
    console.log('Final test result:', result);
    process.exit(result.success ? 0 : 1);
  });
}