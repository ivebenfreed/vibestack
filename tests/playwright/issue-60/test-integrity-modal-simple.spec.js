/**
 * Test the integrity modal functionality with Dexie implementation
 * Issue #60 - Update integrity analysis and reset functionality for Dexie
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Integrity Modal - Dexie Implementation', () => {
  test('should show integrity modal and allow validation', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 30000 });
    
    // Open dev tools modal (using keyboard shortcut)
    await page.keyboard.press('Control+Shift+D');
    
    // Wait for modal to appear
    await page.waitForSelector('text=Developer Tools', { timeout: 5000 });
    
    // Click on Integrity tab
    await page.click('text=Integrity');
    
    // Wait for integrity panel to load
    await page.waitForSelector('text=Integrity Debug Panel', { timeout: 5000 });
    
    // Check that the panel shows database stats
    await expect(page.locator('text=Database Statistics')).toBeVisible();
    
    // Check connection status is shown
    await expect(page.locator('text=Connection Status:')).toBeVisible();
    
    // Run validation (if connected)
    const runValidationButton = page.locator('button:has-text("Run Validation")');
    const isDisabled = await runValidationButton.isDisabled();
    
    if (!isDisabled) {
      // Click validation button
      await runValidationButton.click();
      
      // Wait for validation to complete (look for result or error)
      await page.waitForSelector('text=/Valid:|Validation failed/', { timeout: 10000 });
      
      console.log('Validation completed successfully');
    } else {
      console.log('Validation button is disabled (not connected)');
    }
    
    // Check that reset buttons are present
    await expect(page.locator('button:has-text("Reset Domain Data")')).toBeVisible();
    await expect(page.locator('button:has-text("Full System Reset")')).toBeVisible();
    
    // Check simulation tools are present
    await expect(page.locator('button:has-text("Simulate LSN Drift")')).toBeVisible();
    await expect(page.locator('button:has-text("Simulate Time Gap")')).toBeVisible();
    
    // Close the modal
    await page.keyboard.press('Escape');
    
    // Verify modal is closed
    await expect(page.locator('text=Developer Tools')).not.toBeVisible();
  });

  test('should show database stats correctly', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 30000 });
    
    // Open dev tools modal
    await page.keyboard.press('Control+Shift+D');
    await page.waitForSelector('text=Developer Tools', { timeout: 5000 });
    
    // Click on Integrity tab
    await page.click('text=Integrity');
    await page.waitForSelector('text=Integrity Debug Panel', { timeout: 5000 });
    
    // Check database stats are displayed
    await expect(page.locator('text=Total Records:')).toBeVisible();
    await expect(page.locator('text=Is Empty:')).toBeVisible();
    
    // Verify stats contain numeric values or "Yes/No"
    const totalRecordsText = await page.locator('text=Total Records:').locator('..').textContent();
    expect(totalRecordsText).toMatch(/Total Records:\s*\d+/);
    
    const isEmptyText = await page.locator('text=Is Empty:').locator('..').textContent();
    expect(isEmptyText).toMatch(/Is Empty:\s*(Yes|No)/);
    
    console.log('Database stats:', { totalRecordsText, isEmptyText });
  });
});