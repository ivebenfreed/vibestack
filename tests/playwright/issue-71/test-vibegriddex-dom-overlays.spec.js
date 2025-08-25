/**
 * Test DOM overlays functionality in VibeGrid after Konva removal
 * 
 * This test verifies that:
 * 1. VibeGrid loads without Konva dependencies
 * 2. DOM overlays are created and functional
 * 3. Selection overlays render properly
 * 4. Canvas overlay container exists
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('VibeGrid DOM Overlays', () => {
  
  test('should render DOM overlays without Konva', async ({ page }) => {
    // Navigate to tasks page with VibeGrid
    await page.goto('/tasks');
    
    // Wait for the grid to load
    await page.waitForSelector('[data-testid="vibegrid-container"]', { timeout: 10000 });
    
    // Check that VibeGridDx loaded successfully
    const gridContainer = page.locator('[data-testid="vibegriddx-container"]');
    await expect(gridContainer).toBeVisible();
    
    // Wait for overlay container to be created
    await page.waitForSelector('.vibegridx-overlay-container', { timeout: 5000 });
    
    // Verify DOM overlay container exists (not Konva canvas)
    const overlayContainer = page.locator('.vibegridx-overlay-container');
    await expect(overlayContainer).toBeVisible();
    
    // Verify that no Konva canvas elements exist
    const konvaCanvas = page.locator('canvas[data-konva="true"]');
    await expect(konvaCanvas).toHaveCount(0);
    
    // Check for XState machine readiness
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 10000 }
    );
    
    console.log('✅ DOM overlays loaded successfully without Konva');
  });
  
  test('should handle cell selection with DOM overlays', async ({ page }) => {
    // Navigate to tasks page
    await page.goto('/tasks');
    
    // Wait for grid and overlay container
    await page.waitForSelector('[data-testid="vibegriddx-container"]');
    await page.waitForSelector('.vibegridx-overlay-container');
    
    // Wait for table readiness
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
    
    // Try to interact with a cell (if data exists)
    const cells = page.locator('[data-testid^="cell-"]');
    const cellCount = await cells.count();
    
    if (cellCount > 0) {
      // Click on the first cell
      await cells.first().click();
      
      // Wait a bit for selection overlay to potentially render
      await page.waitForTimeout(500);
      
      // Check if selection overlay elements exist
      const selectionOverlay = page.locator('.vibegridx-selection-container');
      await expect(selectionOverlay).toBeVisible();
      
      console.log('✅ Cell selection working with DOM overlays');
    } else {
      console.log('ℹ️  No data cells found, but grid loaded successfully');
    }
  });
  
  test('should not have Konva-related JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => {
      // Collect JavaScript errors
      errors.push(error.message);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Navigate and wait for load
    await page.goto('/tasks');
    await page.waitForSelector('[data-testid="vibegriddx-container"]');
    
    // Wait for any async loading to complete
    await page.waitForTimeout(2000);
    
    // Filter for Konva-related errors
    const konvaErrors = errors.filter(error => 
      error.toLowerCase().includes('konva') || 
      error.toLowerCase().includes('canvas') && error.toLowerCase().includes('stage')
    );
    
    // Should have no Konva-related errors
    expect(konvaErrors).toHaveLength(0);
    
    console.log('✅ No Konva-related JavaScript errors detected');
  });
});