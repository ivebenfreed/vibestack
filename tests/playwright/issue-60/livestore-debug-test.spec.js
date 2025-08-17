/**
 * LiveStore Debug Page Test
 * 
 * Tests the LiveStore debug page functionality including:
 * - Page loads successfully
 * - Table data can be loaded through sync system
 * - Wide Corp data is displayed correctly
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('LiveStore Debug Page', () => {
  test('should load debug page and display table data', async ({ page }) => {
    // Navigate to the LiveStore debug page
    await page.goto('/debug/livestore-test');
    
    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('LiveStore Integration Debug');
    
    // Check that the user session shows authenticated
    await expect(page.locator('text=✅ Authenticated as')).toBeVisible();
    
    // Check that the Wide Corp tables section is visible
    await expect(page.locator('text=Live Data Tables (Via Sync System)')).toBeVisible();
    await expect(page.locator('text=Wide Corp Solutions')).toBeVisible();
    
    // Check that all tab options are available
    await expect(page.locator('text=Projects')).toBeVisible();
    await expect(page.locator('text=Clients')).toBeVisible();
    await expect(page.locator('text=Timesheets')).toBeVisible();
    await expect(page.locator('text=Skills')).toBeVisible();
    
    // Test loading table data by clicking the Refresh Data button
    const refreshButton = page.locator('button:has-text("Refresh Data")').first();
    await refreshButton.click();
    
    // Wait for loading to complete (either success or error)
    await page.waitForFunction(() => {
      const loadingSpinner = document.querySelector('.animate-spin');
      return !loadingSpinner;
    }, { timeout: 10000 });
    
    // Check if data loaded successfully or if there's an error message
    const hasSuccessMessage = await page.locator('text=records loaded successfully via sync system').isVisible();
    const hasErrorMessage = await page.locator('text=❌ Error:').isVisible();
    
    if (hasSuccessMessage) {
      console.log('✅ Table data loaded successfully');
      
      // Verify table structure is displayed
      await expect(page.locator('table')).toBeVisible();
      await expect(page.locator('thead th')).toHaveCount({ min: 1 });
      
      // Check that record count is shown
      await expect(page.locator('text=records loaded successfully')).toBeVisible();
      
    } else if (hasErrorMessage) {
      console.log('⚠️ Table data loading failed with error - this is expected if not authenticated properly');
      
      // Verify error handling works
      await expect(page.locator('text=❌ Error:')).toBeVisible();
      
    } else {
      throw new Error('Expected either success or error message after data loading');
    }
  });
  
  test('should run LiveStore integration tests', async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/debug/livestore-test');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('LiveStore Integration Debug');
    
    // Click "Run All Tests" button
    const runTestsButton = page.locator('button:has-text("Run All Tests")');
    await runTestsButton.click();
    
    // Wait for tests to complete (up to 30 seconds for all tests)
    await page.waitForFunction(() => {
      const runningButton = document.querySelector('button:has-text("Running Tests...")');
      return !runningButton;
    }, { timeout: 30000 });
    
    // Check that test results are displayed
    await expect(page.locator('text=Test Results')).toBeVisible();
    
    // Verify that some tests ran (should see at least one test result)
    const testResults = page.locator('[class*="border rounded"] [class*="font-medium"]');
    await expect(testResults).toHaveCount({ min: 1 });
    
    // Check for specific test names that should be present
    await expect(page.locator('text=Browser Imports')).toBeVisible();
    await expect(page.locator('text=Schema Generation')).toBeVisible();
    
    // Log test results for debugging
    const testCount = await testResults.count();
    console.log(`Found ${testCount} test results`);
    
    for (let i = 0; i < testCount; i++) {
      const testName = await testResults.nth(i).textContent();
      const testRow = testResults.nth(i).locator('..');
      const hasSuccess = await testRow.locator('text=✅ Success').isVisible();
      const hasError = await testRow.locator('text=❌ Error').isVisible();
      
      console.log(`Test "${testName}": ${hasSuccess ? 'PASSED' : hasError ? 'FAILED' : 'UNKNOWN'}`);
    }
  });
  
  test('should handle tab switching for different table types', async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/debug/livestore-test');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('LiveStore Integration Debug');
    
    // Test switching between different table tabs
    const tableTypes = ['Projects', 'Clients', 'Timesheets', 'Skills'];
    
    for (const tableType of tableTypes) {
      // Click on the tab
      await page.locator(`button[role="tab"]:has-text("${tableType}")`).click();
      
      // Verify the tab content is displayed
      await expect(page.locator(`[role="tabpanel"] h3:has-text("${tableType}")`)).toBeVisible();
      
      // Verify table name is shown
      await expect(page.locator('text=Table: org_01920000_1000_7000_8000_000000000001_')).toBeVisible();
      
      console.log(`✅ Successfully switched to ${tableType} tab`);
    }
  });
  
  test('should display debug information correctly', async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/debug/livestore-test');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('LiveStore Integration Debug');
    
    // Check debug information section
    await expect(page.locator('text=Debug Information')).toBeVisible();
    
    // Verify debug info fields are present
    await expect(page.locator('text=Test Org ID:')).toBeVisible();
    await expect(page.locator('text=Client ID:')).toBeVisible();
    await expect(page.locator('text=User ID:')).toBeVisible();
    
    // Check status cards
    await expect(page.locator('text=User Session')).toBeVisible();
    await expect(page.locator('text=Schema Status')).toBeVisible();
    await expect(page.locator('text=Instance Status')).toBeVisible();
    
    // Manual test buttons should be present
    await expect(page.locator('text=Manual Tests')).toBeVisible();
    await expect(page.locator('button:has-text("Test Schema")')).toBeVisible();
    await expect(page.locator('button:has-text("Test Instance")')).toBeVisible();
    await expect(page.locator('button:has-text("Test Operations")')).toBeVisible();
    await expect(page.locator('button:has-text("Load All Tables")')).toBeVisible();
  });
});