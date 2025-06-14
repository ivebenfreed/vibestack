import { SyncOperationTests } from './scenarios/SyncOperationTests';
import { SyncTestFramework } from './core/SyncTestFramework';

/**
 * Standalone script to run sync operation tests
 * This replaces the old sync isolation tests with more comprehensive sync operation testing
 */
async function runSyncOperationTest() {
  console.log('🧪 Starting Sync Operation Tests...');
  
  try {
    // Initialize the test framework
    const framework = new SyncTestFramework();
    await framework.initialize();
    
    console.log('✅ Test framework initialized');
    
    // Create and run sync operation tests
    const syncOperationTests = new SyncOperationTests(framework);
    
    // Run the test with progress reporting
    const result = await syncOperationTests.run((progress, step) => {
      console.log(`📊 Progress: ${Math.round(progress * 100)}% - ${step}`);
    });
    
    // Report results
    console.log('\n📋 Test Results:');
    console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Steps: ${result.steps.length}`);
    
    if (result.success) {
      console.log('🎉 All sync operation tests passed!');
    } else {
      console.log('💥 Some tests failed:');
      result.steps.forEach((step, index) => {
        if (!step.success) {
          console.log(`  ${index + 1}. ${step.name}: ${step.error?.message || 'Unknown error'}`);
        }
      });
    }
    
    // Cleanup
    await framework.cleanup();
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  runSyncOperationTest().catch(console.error);
} 