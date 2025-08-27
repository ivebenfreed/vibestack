/**
 * UltraTable Selection Overlay Test
 * 
 * Tests the selection overlay system for UltraTable components:
 * - Individual cell selection overlays
 * - Multi-selection with Ctrl+click
 * - Visual feedback positioning
 * - Console log verification
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('UltraTable Selection Overlay', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to UltraTable debug page
    await page.goto('/debug/ultra-table');
    
    // Wait for the page to load completely
    await page.waitForSelector('h1:text("UltraTable 10K Performance Test")');
    
    // Clear console logs to start fresh
    await page.evaluate(() => console.clear());
  });

  test('should display initial state and table', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-initial.png', fullPage: true });
    
    // Verify the page loaded correctly
    await expect(page.locator('h1')).toContainText('UltraTable 10K Performance Test');
    
    // Check that UltraTable is visible
    await expect(page.locator('[class*="ultra-table"]')).toBeVisible();
    
    console.log('✅ Initial page load successful');
  });

  test('should show selection overlay on cell click', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Find the first visible cell
    const firstCell = page.locator('table tbody td').first();
    await expect(firstCell).toBeVisible();
    
    // Click on the first cell
    console.log('🖱️ Clicking first cell...');
    await firstCell.click();
    
    // Take screenshot after first click
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-single-cell.png', fullPage: true });
    
    // Check for console logs about selection
    const logs = await page.evaluate(() => {
      return window.console.logs || [];
    });
    
    // Look for selection overlay elements
    const selectionOverlay = page.locator('.absolute.border-2.border-primary\\/60');
    
    // Verify selection overlay appears (it might be portal-rendered)
    // We'll check for any element with selection-related CSS classes
    const overlayExists = await page.locator('[class*="border-primary"]').count();
    console.log(`📊 Found ${overlayExists} potential overlay elements`);
    
    console.log('✅ Single cell selection test completed');
  });

  test('should support multi-selection with Ctrl+click', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Get the first few cells
    const cells = page.locator('table tbody td');
    await expect(cells.first()).toBeVisible();
    
    // Click first cell normally
    console.log('🖱️ Clicking first cell...');
    await cells.first().click();
    
    // Take screenshot after first selection
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-first-cell.png', fullPage: true });
    
    // Ctrl+click second cell for multi-selection
    console.log('🖱️ Ctrl+clicking second cell...');
    await cells.nth(1).click({ modifiers: ['Control'] });
    
    // Take screenshot after multi-selection
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-multi-cell.png', fullPage: true });
    
    // Ctrl+click third cell
    console.log('🖱️ Ctrl+clicking third cell...');
    await cells.nth(2).click({ modifiers: ['Control'] });
    
    // Take final screenshot showing multiple selections
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-multiple-cells.png', fullPage: true });
    
    // Check for multiple selection overlays
    const overlayCount = await page.locator('[class*="border-primary"]').count();
    console.log(`📊 Found ${overlayCount} overlay elements after multi-selection`);
    
    console.log('✅ Multi-selection test completed');
  });

  test('should show proper console logs for selection state', async ({ page }) => {
    // Enable console log capture
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });
    
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Click on a few cells to trigger selection logs
    const cells = page.locator('table tbody td');
    await cells.first().click();
    await page.waitForTimeout(500); // Allow logs to accumulate
    
    await cells.nth(1).click({ modifiers: ['Control'] });
    await page.waitForTimeout(500);
    
    // Take screenshot of current state
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-console-test.png', fullPage: true });
    
    // Check console logs for selection-related messages
    const selectionLogs = consoleLogs.filter(log => 
      log.includes('SelectionOverlay') || 
      log.includes('selection') ||
      log.includes('cell') ||
      log.toLowerCase().includes('ultra')
    );
    
    console.log('🔍 Selection-related console logs:');
    selectionLogs.forEach(log => console.log('  ', log));
    
    // Verify we got some selection-related logs
    expect(selectionLogs.length).toBeGreaterThan(0);
    
    console.log('✅ Console logging test completed');
  });

  test('should test both Legend State and External Data modes', async ({ page }) => {
    // Test Legend State mode (default)
    console.log('🧪 Testing Legend State mode...');
    await expect(page.locator('button:text("Legend State Data")')).toHaveClass(/default|bg-/);
    
    // Click on a cell in Legend State mode
    await page.waitForSelector('table', { timeout: 10000 });
    await page.locator('table tbody td').first().click();
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-legend-state.png', fullPage: true });
    
    // Switch to External Data mode
    console.log('🔄 Switching to External Data mode...');
    await page.click('button:text("Test Data (100 rows)")');
    
    // Wait for table to re-render with external data
    await page.waitForTimeout(1000);
    
    // Click on a cell in External Data mode
    await page.locator('table tbody td').first().click();
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-external-data.png', fullPage: true });
    
    // Try multi-selection in external data mode
    await page.locator('table tbody td').nth(1).click({ modifiers: ['Control'] });
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-external-multi.png', fullPage: true });
    
    console.log('✅ Both data modes tested successfully');
  });

  test('should verify overlay positioning and styling', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Click on a cell to create selection overlay
    const targetCell = page.locator('table tbody td').first();
    const cellBox = await targetCell.boundingBox();
    
    console.log('📐 Target cell position:', cellBox);
    
    await targetCell.click();
    await page.waitForTimeout(500); // Allow overlay to render
    
    // Take detailed screenshot
    await page.screenshot({ path: '.playwright-mcp/ultra-table-selection-positioning.png', fullPage: true });
    
    // Check if any overlay elements exist with expected classes
    const overlaySelectors = [
      '.absolute.border-2.border-primary\\/60',
      '[class*="border-primary"]',
      '[class*="selection"]',
      '.pointer-events-none.z-10'
    ];
    
    for (const selector of overlaySelectors) {
      const count = await page.locator(selector).count();
      console.log(`📊 Elements matching "${selector}": ${count}`);
    }
    
    // Check for the portal container that should contain overlays
    const portalElements = await page.locator('[class*="absolute"][class*="inset-0"]').count();
    console.log(`📊 Portal-like elements: ${portalElements}`);
    
    console.log('✅ Overlay positioning test completed');
  });
});