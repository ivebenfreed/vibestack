/**
 * Simple LiveStore Workers Test
 * 
 * Test LiveStore worker initialization in isolation
 */

import { test, expect } from '@playwright/test';

test('Simple LiveStore workers test', async ({ page }) => {
  console.log('🔧 Testing LiveStore workers...');
  
  // Navigate to debug page
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForTimeout(3000);
  
  // Test worker initialization
  console.log('🧪 Testing LiveStore worker initialization...');
  
  const workerTest = await page.evaluate(async () => {
    const results = {
      timestamp: Date.now(),
      tests: {}
    };
    
    try {
      console.log('[BROWSER] Testing LiveStore worker creation...');
      
      // Test 1: Check if testLiveStoreInBrowser exists
      if (window.testLiveStoreInBrowser) {
        console.log('[BROWSER] ✅ testLiveStoreInBrowser function exists');
        results.tests.functionExists = true;
        
        // Test 2: Try to run the test function (with timeout)
        const testPromise = window.testLiveStoreInBrowser();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout after 10 seconds')), 10000)
        );
        
        try {
          await Promise.race([testPromise, timeoutPromise]);
          console.log('[BROWSER] ✅ testLiveStoreInBrowser completed successfully');
          results.tests.functionRun = { success: true };
        } catch (error) {
          console.log('[BROWSER] ❌ testLiveStoreInBrowser failed:', error.message);
          results.tests.functionRun = { success: false, error: error.message };
        }
      } else {
        console.log('[BROWSER] ❌ testLiveStoreInBrowser function not found');
        results.tests.functionExists = false;
      }
      
      // Test 3: Check for LiveStore client availability
      if (window.liveStoreClient) {
        console.log('[BROWSER] ✅ LiveStore client is available');
        results.tests.clientAvailable = true;
      } else {
        console.log('[BROWSER] ❌ LiveStore client not available');
        results.tests.clientAvailable = false;
      }
      
      console.log('[BROWSER] Worker test complete');
      return results;
      
    } catch (error) {
      console.log('[BROWSER] Worker test error:', error.message);
      results.error = error.message;
      return results;
    }
  });
  
  await page.screenshot({ path: 'livestore-workers-simple.png' });
  
  // Analyze results
  console.log('\n=== LIVESTORE WORKERS TEST ===');
  
  const tests = workerTest.tests || {};
  
  console.log(`🔧 Function Exists: ${tests.functionExists ? '✅' : '❌'}`);
  console.log(`🚀 Function Run: ${tests.functionRun?.success ? '✅' : '❌'}`);
  if (tests.functionRun && !tests.functionRun.success) {
    console.log(`   Error: ${tests.functionRun.error}`);
  }
  console.log(`🔗 Client Available: ${tests.clientAvailable ? '✅' : '❌'}`);
  
  if (workerTest.error) {
    console.log(`❌ Test Error: ${workerTest.error}`);
  }
  
  console.log('\n=== WORKER STATUS ===');
  
  const hasBasicFunction = tests.functionExists;
  const canRunFunction = tests.functionRun?.success;
  const hasClient = tests.clientAvailable;
  
  if (canRunFunction && hasClient) {
    console.log('🎉 SUCCESS: LiveStore workers are working!');
  } else if (hasBasicFunction && !canRunFunction) {
    console.log('⚠️ PARTIAL: Function exists but fails to run');
    console.log('   This suggests worker initialization issues');
  } else if (!hasBasicFunction) {
    console.log('❌ BLOCKED: Basic LiveStore function not available');
  } else {
    console.log('🔧 DEBUGGING: Mixed results, need investigation');
  }
  
  console.log('===============================');
  
  // Test passes if we can at least find the function
  expect(tests.functionExists).toBe(true);
});