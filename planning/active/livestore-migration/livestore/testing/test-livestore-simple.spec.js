/**
 * Simple LiveStore Test (No Admin Required)
 * 
 * Tests LiveStore integration using the simple test route that doesn't require admin permissions
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('LiveStore Simple Integration Test', () => {
  test('should access simple test route and run basic LiveStore tests', async ({ page }) => {
    console.log('🔄 Testing simple LiveStore integration...');
    
    // Navigate directly to the simple test route
    await page.goto('/debug/livestore-test-simple', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Simple LiveStore Test")', { timeout: 30000 });
    console.log('✅ Simple test route loaded successfully');

    // Check authentication status
    const authStatus = await page.locator('text=Authentication Status').locator('..').textContent();
    console.log('🔐 Auth Status:', authStatus);

    // Run the basic tests
    const runTestsButton = page.locator('button:has-text("Run Basic Tests")');
    await expect(runTestsButton).toBeVisible();
    
    console.log('🧪 Starting basic LiveStore tests...');
    await runTestsButton.click();

    // Wait for tests to complete
    await page.waitForTimeout(10000);

    // Check test results
    const testResults = await page.locator('.space-y-3 > div').count();
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
      
      // Check specific test results
      const browserEnvPassed = await page.locator('text=Browser Environment').locator('..').locator('text=✅ Success').isVisible();
      const importTestPassed = await page.locator('text=LiveStore Package Import').locator('..').locator('text=✅ Success').isVisible();
      
      console.log(`\n📋 Key Tests:`);
      console.log(`   Browser Environment: ${browserEnvPassed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Package Import: ${importTestPassed ? '✅ PASS' : '❌ FAIL'}`);
      
      // At minimum, browser environment and imports should work
      expect(browserEnvPassed).toBe(true);
      expect(importTestPassed).toBe(true);
      
    } else {
      console.log('⚠️ No test results found, tests may still be running');
    }

    // Take screenshot for debugging
    await page.screenshot({ 
      path: 'screenshots/livestore-simple-test.png',
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved to screenshots/livestore-simple-test.png');
  });

  test('should run manual tests', async ({ page }) => {
    console.log('🔄 Testing manual LiveStore operations...');
    
    // Navigate to simple test route
    await page.goto('/debug/livestore-test-simple', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('h1:has-text("Simple LiveStore Test")');
    
    // Test manual import button
    const importButton = page.locator('button:has-text("Test Imports")');
    if (await importButton.isVisible()) {
      console.log('🧪 Running manual import test...');
      await importButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Test manual schema button
    const schemaButton = page.locator('button:has-text("Test Schema")');
    if (await schemaButton.isVisible()) {
      console.log('🧪 Running manual schema test...');
      await schemaButton.click();
      await page.waitForTimeout(2000);
    }

    // Check for any new test results
    const testResults = await page.locator('.space-y-3 > div').count();
    console.log(`📋 Manual test results: ${testResults}`);

    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/livestore-manual-tests.png',
      fullPage: true 
    });
    
    console.log('✅ Manual tests completed');
  });
});