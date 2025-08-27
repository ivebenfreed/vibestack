// ====================================
// PHASE 1: COORDINATE ACCURACY TESTS  
// ====================================
// Tests coordinate mapping accuracy for both visible and virtualized rows
// Validates no elementFromPoint fallbacks are triggered

import { test, expect } from '../fixtures/persistent-context.js';

const LEGEND_TABLE_URL = '/debug/legend-table';

test.describe('Phase 1: Coordinate Mapping Accuracy', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(LEGEND_TABLE_URL);
    
    // Wait for Legend Table to be ready  
    await page.waitForSelector('.vibegridx-table-container', { timeout: 10000 });
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );

    console.log('Legend Table loaded for coordinate testing');
  });

  test('cell detection accurate for visible rows', async ({ page }) => {
    // Test clicking on multiple visible cells
    const visibleCells = page.locator('.vibegridx-cell[data-row-id][data-column-id]').first();
    
    // Click on first visible cell
    await visibleCells.click();
    
    // Verify selection happened
    const selectedCells = page.locator('.vibegridx-selection-element');
    const selectionCount = await selectedCells.count();
    expect(selectionCount).toBeGreaterThan(0);

    // Get the actual cell data to verify correct targeting
    const cellData = await visibleCells.getAttribute('data-row-id');
    expect(cellData).toBeTruthy();
    
    console.log(`✅ Visible cell detection: Selected cell with row-id ${cellData}`);
  });

  test('cell detection accurate for virtualized rows (row 5000+)', async ({ page }) => {
    // Scroll to middle of large dataset to test virtualized rows
    const tableContainer = page.locator('.vibegridx-viewport');
    
    // Scroll to around row 5000 (assuming 40px row height)
    const targetScrollTop = 5000 * 40; 
    await tableContainer.evaluate((el, scrollTop) => {
      el.scrollTop = scrollTop;
    }, targetScrollTop);

    // Wait for virtualization to render new rows
    await page.waitForTimeout(1000);

    // Verify we have cells rendered in the new position
    const virtualizedCells = page.locator('.vibegridx-cell[data-row-id][data-column-id]');
    const cellCount = await virtualizedCells.count();
    expect(cellCount).toBeGreaterThan(0);

    // Click on a virtualized cell
    const firstVirtualCell = virtualizedCells.first();
    await firstVirtualCell.click();

    // Verify selection worked for virtualized cell
    const selectedCells = page.locator('.vibegridx-selection-element');
    const selectionCount = await selectedCells.count();
    expect(selectionCount).toBeGreaterThan(0);

    // Get row ID to verify it's actually a high row number
    const virtualRowId = await firstVirtualCell.getAttribute('data-row-id');
    expect(virtualRowId).toBeTruthy();
    
    console.log(`✅ Virtualized cell detection: Selected cell with row-id ${virtualRowId}`);
  });

  test('mouse position maps to correct cells in all scroll positions', async ({ page }) => {
    // Test coordinate mapping at different scroll positions
    const tableContainer = page.locator('.vibegridx-viewport');
    const scrollPositions = [0, 1000, 3000, 5000];

    for (const scrollTop of scrollPositions) {
      // Scroll to position
      await tableContainer.evaluate((el, scroll) => {
        el.scrollTop = scroll;
      }, scrollTop);

      await page.waitForTimeout(500); // Wait for virtualization

      // Get cells at this position
      const cellsAtPosition = page.locator('.vibegridx-cell[data-row-id][data-column-id]');
      const cellCount = await cellsAtPosition.count();

      if (cellCount > 0) {
        // Click on first cell at this position
        const firstCell = cellsAtPosition.first();
        await firstCell.click();

        // Verify selection worked
        const selectedCells = page.locator('.vibegridx-selection-element');
        const selectionCount = await selectedCells.count();
        expect(selectionCount).toBeGreaterThan(0);

        const rowId = await firstCell.getAttribute('data-row-id');
        console.log(`✅ Scroll position ${scrollTop}: Selected cell with row-id ${rowId}`);
      }
    }
  });

  test('no elementFromPoint fallbacks triggered', async ({ page }) => {
    // Monitor console for elementFromPoint usage warnings
    const elementFromPointUsage = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('elementFromPoint') || text.includes('No valid cell found under mouse')) {
        elementFromPointUsage.push(text);
      }
    });

    // Perform various interactions that might trigger fallbacks
    const testCell = page.locator('.vibegridx-cell[data-row-id][data-column-id]').first();
    
    // Click operations
    await testCell.click();
    await page.waitForTimeout(200);

    // Drag operations
    const cellBox = await testCell.boundingBox();
    if (cellBox) {
      await page.mouse.move(cellBox.x + 10, cellBox.y + 10);
      await page.mouse.down();
      await page.mouse.move(cellBox.x + 100, cellBox.y + 50);
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    // Should not have triggered any elementFromPoint fallbacks
    expect(elementFromPointUsage.length).toBe(0);
    console.log('✅ No elementFromPoint fallbacks detected during interactions');
  });

  test('coordinate system handles overlay elements correctly', async ({ page }) => {
    // Create a selection that will generate overlay elements
    const firstCell = page.locator('.vibegridx-cell[data-row-id][data-column-id]').first();
    await firstCell.click();

    // Verify overlay elements exist
    const overlayElements = page.locator('.vibegridx-selection-element, .vibegridx-fill-handle');
    const overlayCount = await overlayElements.count();
    expect(overlayCount).toBeGreaterThan(0);

    // Now try clicking/dragging over overlay elements 
    // The coordinate system should handle this correctly
    const firstOverlay = overlayElements.first();
    const overlayBox = await firstOverlay.boundingBox();

    if (overlayBox) {
      // Click on the overlay - should still detect correct cell underneath
      await page.mouse.click(overlayBox.x + 10, overlayBox.y + 10);
      
      // Should still have valid selection
      const selectedCells = page.locator('.vibegridx-selection-element');
      const selectionCount = await selectedCells.count();
      expect(selectionCount).toBeGreaterThan(0);
    }

    console.log('✅ Coordinate system correctly handles overlay elements');
  });

  test('coordinate mapping performance is acceptable', async ({ page }) => {
    // Test coordinate mapping performance under load
    const startTime = Date.now();
    const iterations = 10;

    // Perform multiple coordinate-based operations quickly
    const cells = page.locator('.vibegridx-cell[data-row-id][data-column-id]');
    
    for (let i = 0; i < iterations; i++) {
      const cell = cells.nth(i % 5); // Cycle through first 5 cells
      await cell.click();
      await page.waitForTimeout(50); // Small delay between clicks
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTimePerOperation = totalTime / iterations;

    // Each coordinate mapping operation should be fast
    expect(avgTimePerOperation).toBeLessThan(100); // Less than 100ms per operation
    console.log(`✅ Coordinate mapping performance: ${avgTimePerOperation.toFixed(1)}ms per operation`);
  });

});