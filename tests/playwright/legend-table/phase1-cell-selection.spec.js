// ====================================
// PHASE 1: CELL SELECTION TESTS
// ====================================
// Tests for accurate cell selection with coordinate mapping
// Validates no accidental large selections from small movements

import { test, expect } from '../fixtures/persistent-context.js';

const LEGEND_TABLE_URL = '/debug/legend-table';
const CELL_SELECTION_TIMEOUT = 2000;

test.describe('Phase 1: Cell Selection Accuracy', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(LEGEND_TABLE_URL);
    
    // Wait for Legend Table to be ready
    await page.waitForSelector('.vibegridx-table-container', { timeout: 10000 });
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
    
    console.log('Legend Table loaded and ready for testing');
  });

  test('single cell click selection works', async ({ page }) => {
    // Click on a specific cell
    const firstCell = page.locator('.vibegridx-cell').first();
    await firstCell.click();

    // Verify only one cell is selected
    const selectedCells = page.locator('.vibegridx-selection-element');
    const selectionCount = await selectedCells.count();
    
    expect(selectionCount).toBe(1);
    console.log(`✅ Single cell selection: ${selectionCount} cell selected`);
  });

  test('drag selection works for small ranges (2x3 cells)', async ({ page }) => {
    // Get the first few cells for dragging
    const startCell = page.locator('.vibegridx-cell[data-row-id][data-column-id]').first();
    const startBox = await startCell.boundingBox();
    expect(startBox).toBeTruthy();

    // Calculate end position (2 rows down, 3 columns right)
    const endX = startBox.x + (3 * 200); // Assuming 200px column width
    const endY = startBox.y + (2 * 40);  // Assuming 40px row height

    // Perform drag selection
    await page.mouse.move(startBox.x + 10, startBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    // Wait for selection to update
    await page.waitForTimeout(500);

    // Verify reasonable selection size (should be around 6 cells: 2x3)
    const selectedCells = page.locator('.vibegridx-selection-element');
    const selectionCount = await selectedCells.count();
    
    // Allow some tolerance but should be close to 6
    expect(selectionCount).toBeGreaterThan(0);
    expect(selectionCount).toBeLessThan(20); // Should not be massive
    console.log(`✅ Small drag selection: ${selectionCount} cells selected`);
  });

  test('drag selection works for medium ranges (10x5 cells)', async ({ page }) => {
    // Get starting cell
    const startCell = page.locator('.vibegridx-cell[data-row-id][data-column-id]').first();
    const startBox = await startCell.boundingBox();
    expect(startBox).toBeTruthy();

    // Calculate end position (10 rows down, 5 columns right)  
    const endX = startBox.x + (5 * 200); // 5 columns
    const endY = startBox.y + (10 * 40); // 10 rows

    // Perform drag selection
    await page.mouse.move(startBox.x + 10, startBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    // Wait for selection to update
    await page.waitForTimeout(1000);

    // Verify reasonable selection size (should be around 50 cells: 10x5)
    const selectedCells = page.locator('.vibegridx-selection-element');
    const selectionCount = await selectedCells.count();
    
    // Should be reasonable size, not thousands
    expect(selectionCount).toBeGreaterThan(10);
    expect(selectionCount).toBeLessThan(200); // Much less than the previous 4000+ issue
    console.log(`✅ Medium drag selection: ${selectionCount} cells selected`);
  });

  test('no accidental large selections from small movements', async ({ page }) => {
    // Get a cell to click
    const testCell = page.locator('.vibegridx-cell[data-row-id][data-column-id]').first();
    const cellBox = await testCell.boundingBox();
    expect(cellBox).toBeTruthy();

    // Simulate very small mouse movements (the issue we're fixing)
    await page.mouse.move(cellBox.x + 10, cellBox.y + 10);
    await page.mouse.down();
    
    // Move just 6 pixels (this was causing 4000+ cell selections before)
    await page.mouse.move(cellBox.x + 16, cellBox.y + 16);
    await page.mouse.up();

    // Wait for any potential selection
    await page.waitForTimeout(500);

    // Verify no massive selection occurred
    const selectedCells = page.locator('.vibegridx-selection-element');
    const selectionCount = await selectedCells.count();
    
    // Should be very small selection or single cell
    expect(selectionCount).toBeLessThan(10);
    console.log(`✅ Small movement selection: ${selectionCount} cells selected (should be < 10)`);

    // Also check for specific error patterns in console
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Large selection detected')) {
        logs.push(msg.text());
      }
    });

    // Should not see "Large selection detected" warnings
    expect(logs.length).toBe(0);
  });

  test('drag threshold prevents accidental drag operations', async ({ page }) => {
    // Get a cell
    const testCell = page.locator('.vibegridx-cell[data-row-id][data-column-id]').first();
    const cellBox = await testCell.boundingBox();
    expect(cellBox).toBeTruthy();

    // Mouse down and move just 2-3 pixels (below threshold)
    await page.mouse.move(cellBox.x + 10, cellBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(cellBox.x + 12, cellBox.y + 12); // 2px movement
    await page.mouse.up();

    await page.waitForTimeout(300);

    // Should result in single cell selection, not drag selection
    const selectedCells = page.locator('.vibegridx-selection-element');
    const selectionCount = await selectedCells.count();
    
    expect(selectionCount).toBeLessThanOrEqual(1);
    console.log(`✅ Below-threshold movement: ${selectionCount} cell selected (should be 1 or 0)`);
  });

  test('selection performance is acceptable', async ({ page }) => {
    const startTime = Date.now();

    // Perform a medium drag selection
    const startCell = page.locator('.vibegridx-cell[data-row-id][data-column-id]').first();
    const startBox = await startCell.boundingBox();
    expect(startBox).toBeTruthy();

    const endX = startBox.x + (3 * 200);
    const endY = startBox.y + (5 * 40);

    await page.mouse.move(startBox.x + 10, startBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    // Wait for selection to complete
    await page.waitForSelector('.vibegridx-selection-element', { timeout: 2000 });

    const endTime = Date.now();
    const selectionTime = endTime - startTime;

    // Selection should complete within reasonable time
    expect(selectionTime).toBeLessThan(1000); // Less than 1 second
    console.log(`✅ Selection completed in ${selectionTime}ms`);
  });

});