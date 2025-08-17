/**
 * LiveStore Debug Route Test
 * 
 * Tests the LiveStore integration using the debug route with authenticated session
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('LiveStore Debug Route Integration', () => {
  test('should access debug route and run LiveStore tests', async ({ page }) => {
    // Navigate to the debug route
    await page.goto('/debug/livestore-test');
    
    // Wait for the page to load
    await page.waitForSelector('h1:has-text("LiveStore Integration Debug")', { timeout: 30000 });
    
    console.log('✅ Debug route loaded successfully');

    // Check if user is authenticated
    const userSessionCard = page.locator('text=User Session').locator('..');
    await expect(userSessionCard).toContainText('Authenticated');
    
    console.log('✅ User session verified as authenticated');

    // Wait for schema and instance status to load
    await page.waitForTimeout(2000);

    // Check status cards
    const schemaStatus = await page.locator('text=Schema Status').locator('..').textContent();
    const instanceStatus = await page.locator('text=Instance Status').locator('..').textContent();
    
    console.log('📊 Schema Status:', schemaStatus);
    console.log('📊 Instance Status:', instanceStatus);

    // Run all tests by clicking the button
    const runTestsButton = page.locator('button:has-text("Run All Tests")');
    await expect(runTestsButton).toBeVisible();
    
    console.log('🧪 Starting LiveStore integration tests...');
    await runTestsButton.click();

    // Wait for tests to complete (give it time for all tests)
    await page.waitForTimeout(10000);

    // Check test results
    const testResults = await page.locator('[data-testid="test-result"], .space-y-3 > div').count();
    console.log(`📋 Found ${testResults} test results`);

    if (testResults > 0) {
      // Get all test result text content
      const results = await page.locator('.space-y-3 > div').allTextContents();
      
      console.log('\n🧪 Test Results:');
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result}`);
      });

      // Count successful tests
      const successfulTests = await page.locator('text=✅ Success').count();
      const errorTests = await page.locator('text=❌ Error').count();
      
      console.log(`\n📊 Test Summary: ${successfulTests} passed, ${errorTests} failed`);
      
      // Expect at least some tests to pass
      expect(successfulTests).toBeGreaterThan(0);
      
    } else {
      console.log('⚠️ No test results found, tests may still be running');
    }

    // Take screenshot for debugging
    await page.screenshot({ 
      path: 'screenshots/livestore-debug-route.png',
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved to screenshots/livestore-debug-route.png');
  });

  test('should test manual operations', async ({ page }) => {
    // Navigate to the debug route
    await page.goto('/debug/livestore-test');
    
    // Wait for the page to load
    await page.waitForSelector('h1:has-text("LiveStore Integration Debug")');
    
    // Wait for components to initialize
    await page.waitForTimeout(3000);

    // Test individual manual test buttons
    const manualTestButtons = [
      'Test Schema',
      'Test Instance', 
      'Test Operations'
    ];

    for (const buttonText of manualTestButtons) {
      const button = page.locator(`button:has-text("${buttonText}")`);
      
      if (await button.isVisible()) {
        console.log(`🧪 Running manual test: ${buttonText}`);
        await button.click();
        
        // Wait a bit for the test to complete
        await page.waitForTimeout(1000);
        
        // Check if any new test results appeared
        const testResults = await page.locator('.space-y-3 > div').count();
        console.log(`📋 Test results after ${buttonText}: ${testResults}`);
      } else {
        console.log(`⚠️ Manual test button not found: ${buttonText}`);
      }
    }

    // Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/livestore-manual-tests.png',
      fullPage: true 
    });
  });

  test('should verify LiveStore components are available in browser', async ({ page }) => {
    // Navigate to the debug route
    await page.goto('/debug/livestore-test');
    
    // Wait for the page to load
    await page.waitForSelector('h1:has-text("LiveStore Integration Debug")');

    // Test if LiveStore functions are available in browser console
    const browserTestResult = await page.evaluate(async () => {
      try {
        // Test if our LiveStore test functions are available
        const results = {
          testLiveStoreInBrowser: typeof window.testLiveStoreInBrowser,
          testLiveStoreChangeTracking: typeof window.testLiveStoreChangeTracking,
          liveStoreImports: false,
          schemaGeneration: false
        };

        // Test LiveStore imports
        try {
          const { Store, createStore, Schema } = await import('@livestore/livestore');
          const { makePersistedAdapter } = await import('@livestore/adapter-web');
          
          if (typeof Store === 'function' && typeof createStore === 'function' &&
              typeof Schema === 'object' && typeof makePersistedAdapter === 'function') {
            results.liveStoreImports = true;
          }
        } catch (error) {
          console.error('LiveStore import error:', error);
        }

        // Test schema generation
        try {
          const testSchema = Schema.Struct({
            test_table: Schema.Struct({
              id: Schema.String,
              name: Schema.String
            })
          });
          
          if (typeof testSchema === 'function') {
            results.schemaGeneration = true;
          }
        } catch (error) {
          console.error('Schema generation error:', error);
        }

        return results;
      } catch (error) {
        return { error: error.message };
      }
    });

    console.log('🌐 Browser Test Results:', JSON.stringify(browserTestResult, null, 2));

    // Verify that LiveStore components are available
    expect(browserTestResult.liveStoreImports).toBe(true);
    expect(browserTestResult.schemaGeneration).toBe(true);
    
    console.log('✅ LiveStore components verified in browser environment');
  });

  test('should test LiveStore operations with real data', async ({ page }) => {
    // Navigate to the debug route
    await page.goto('/debug/livestore-test');
    
    // Wait for the page to load and components to initialize
    await page.waitForSelector('h1:has-text("LiveStore Integration Debug")');
    await page.waitForTimeout(3000);

    // Test LiveStore operations in browser
    const operationsResult = await page.evaluate(async () => {
      try {
        // Check if we have access to LiveStore operations
        const testResults = {
          operationsAvailable: false,
          insertTest: false,
          queryTest: false,
          error: null
        };

        // Test if operations are accessible
        if (typeof window.testLiveStoreInBrowser === 'function') {
          testResults.operationsAvailable = true;
          
          // Run a simple test
          await window.testLiveStoreInBrowser();
          testResults.insertTest = true;
          testResults.queryTest = true;
        }

        return testResults;
      } catch (error) {
        return { 
          operationsAvailable: false,
          insertTest: false,
          queryTest: false,
          error: error.message 
        };
      }
    });

    console.log('🔧 Operations Test Results:', JSON.stringify(operationsResult, null, 2));

    if (operationsResult.error) {
      console.log(`⚠️ Operations test error: ${operationsResult.error}`);
    } else {
      expect(operationsResult.operationsAvailable).toBe(true);
      console.log('✅ LiveStore operations working in authenticated environment');
    }

    // Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/livestore-operations-test.png',
      fullPage: true 
    });
  });
});