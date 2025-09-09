/**
 * VibeGrid Pure Observable Testing - Category 3
 * Column Operations (Sorting, Resizing, Management)
 * 
 * Testing plan reference: apps/worker/src/components/custom/vibegrid/VIBEGRID_PURE_TESTING_PLAN.md
 * Lines 72-97: Category 3 (Column Operations)
 * 
 * Current status: Expected failures - these features are not yet implemented
 * Run with: ./scripts/playwright-test.sh tests/playwright/vibegrid/03-column-operations.spec.js
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('VibeGrid Category 3: Column Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the VibeGrid Pure test page
    await page.goto('http://localhost:4001/debug/test-vibegrid-pure');
    
    // Wait for the table to load completely
    await page.waitForSelector('[data-testid="vibegrid-table"]', { timeout: 10000 });
    await page.waitForTimeout(1000); // Additional wait for data loading
    
    console.log('✅ VibeGrid loaded and ready for column operations testing');
  });

  test.describe('Category 3.1: Column Sorting', () => {
    test('should sort ascending when clicking column header', async ({ page }) => {
      // Get the title column header
      const titleHeader = page.locator('[data-col="title"] .column-header, th[data-col="title"]').first();
      
      // Get initial order of task titles
      const initialTitles = await page.locator('[data-col="title"] .cell-content').allTextContents();
      console.log('Initial titles order:', initialTitles.slice(0, 3));
      
      // Click the title header to sort ascending
      await titleHeader.click();
      
      // EXPECTED FAILURE: Sorting not implemented yet
      // Wait for sort to complete
      await page.waitForTimeout(1000);
      
      // Check for sort indicator (ascending arrow)
      await expect(page.locator('[data-col="title"] .sort-indicator.ascending, [data-col="title"] .fa-sort-up')).toBeVisible({ timeout: 2000 });
      
      // Get sorted order
      const sortedTitles = await page.locator('[data-col="title"] .cell-content').allTextContents();
      console.log('Sorted titles order:', sortedTitles.slice(0, 3));
      
      // Verify titles are sorted alphabetically
      const expectedSorted = [...initialTitles].sort((a, b) => a.localeCompare(b));
      expect(sortedTitles).toEqual(expectedSorted);
    });

    test('should toggle to descending sort on second click', async ({ page }) => {
      const priorityHeader = page.locator('[data-col="priority"] .column-header, th[data-col="priority"]').first();
      
      // First click - ascending
      await priorityHeader.click();
      await page.waitForTimeout(500);
      
      // Second click - descending
      await priorityHeader.click();
      await page.waitForTimeout(500);
      
      // EXPECTED FAILURE: Toggle sorting not implemented
      // Check for descending sort indicator
      await expect(page.locator('[data-col="priority"] .sort-indicator.descending, [data-col="priority"] .fa-sort-down')).toBeVisible({ timeout: 2000 });
      
      // Verify descending order (High > Medium > Low for priority)
      const priorities = await page.locator('[data-col="priority"] .cell-content').allTextContents();
      const firstPriority = priorities[0];
      const lastPriority = priorities[priorities.length - 1];
      
      // High/Critical should come before Low in descending sort
      expect(['High', 'Critical'].some(p => firstPriority.includes(p))).toBeTruthy();
    });

    test('should clear sort on third click', async ({ page }) => {
      const statusHeader = page.locator('[data-col="status"] .column-header, th[data-col="status"]').first();
      
      // Get original order
      const originalOrder = await page.locator('[data-col="status"] .cell-content').allTextContents();
      
      // Click 1: Ascending
      await statusHeader.click();
      await page.waitForTimeout(500);
      
      // Click 2: Descending  
      await statusHeader.click();
      await page.waitForTimeout(500);
      
      // Click 3: Clear sort (return to original order)
      await statusHeader.click();
      await page.waitForTimeout(500);
      
      // EXPECTED FAILURE: Clear sort not implemented
      // Should have no sort indicator
      await expect(page.locator('[data-col="status"] .sort-indicator, [data-col="status"] .fa-sort')).not.toBeVisible();
      
      // Should return to original order
      const currentOrder = await page.locator('[data-col="status"] .cell-content').allTextContents();
      expect(currentOrder).toEqual(originalOrder);
    });

    test('should support multi-column sort with Ctrl+Click', async ({ page }) => {
      // Sort by priority first
      const priorityHeader = page.locator('[data-col="priority"] .column-header').first();
      await priorityHeader.click();
      await page.waitForTimeout(500);
      
      // Then sort by status with Ctrl+Click for multi-column sort
      const statusHeader = page.locator('[data-col="status"] .column-header').first();
      await statusHeader.click({ modifiers: ['Control'] });
      await page.waitForTimeout(500);
      
      // EXPECTED FAILURE: Multi-column sort not implemented
      // Both columns should show sort indicators
      await expect(page.locator('[data-col="priority"] .sort-indicator')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('[data-col="status"] .sort-indicator')).toBeVisible({ timeout: 2000 });
      
      // Should show sort order numbers (1, 2)
      await expect(page.locator('[data-col="priority"] .sort-order')).toContainText('1');
      await expect(page.locator('[data-col="status"] .sort-order')).toContainText('2');
    });
  });

  test.describe('Category 3.2: Column Resizing', () => {
    test('should show resize handles on column borders', async ({ page }) => {
      // Hover over column border to reveal resize handle
      const titleHeader = page.locator('[data-col="title"] .column-header').first();
      const headerBounds = await titleHeader.boundingBox();
      
      if (headerBounds) {
        // Hover near the right edge of the header
        await page.mouse.move(headerBounds.x + headerBounds.width - 2, headerBounds.y + headerBounds.height / 2);
        await page.waitForTimeout(500);
        
        // EXPECTED FAILURE: Resize handles not implemented
        // Should show resize cursor
        const cursor = await page.evaluate(() => document.body.style.cursor);
        expect(cursor).toBe('col-resize');
        
        // Should show visual resize handle
        await expect(page.locator('.column-resize-handle, .resize-handle')).toBeVisible({ timeout: 2000 });
      }
    });

    test('should resize column by dragging resize handle', async ({ page }) => {
      const titleHeader = page.locator('[data-col="title"] .column-header').first();
      const initialWidth = await titleHeader.evaluate(el => el.offsetWidth);
      
      // Get the right edge of the header for resize handle
      const headerBounds = await titleHeader.boundingBox();
      if (headerBounds) {
        const resizeX = headerBounds.x + headerBounds.width - 2;
        const resizeY = headerBounds.y + headerBounds.height / 2;
        
        // Drag to resize (make wider)
        await page.mouse.move(resizeX, resizeY);
        await page.mouse.down();
        await page.mouse.move(resizeX + 100, resizeY); // Drag 100px wider
        await page.mouse.up();
        
        // EXPECTED FAILURE: Column resizing not implemented
        // Check new width
        const newWidth = await titleHeader.evaluate(el => el.offsetWidth);
        expect(newWidth).toBeGreaterThan(initialWidth + 50); // Should be significantly wider
        
        // Should show resize preview during drag
        await expect(page.locator('.resize-preview-line')).toBeVisible();
      }
    });

    test('should enforce minimum column width', async ({ page }) => {
      const priorityHeader = page.locator('[data-col="priority"] .column-header').first();
      const headerBounds = await priorityHeader.boundingBox();
      
      if (headerBounds) {
        const resizeX = headerBounds.x + headerBounds.width - 2;
        const resizeY = headerBounds.y + headerBounds.height / 2;
        
        // Try to drag to make column very narrow
        await page.mouse.move(resizeX, resizeY);
        await page.mouse.down();
        await page.mouse.move(headerBounds.x + 10, resizeY); // Try to make it only 10px wide
        await page.mouse.up();
        
        // EXPECTED FAILURE: Minimum width constraint not implemented
        // Should not go below minimum width (e.g., 60px)
        const finalWidth = await priorityHeader.evaluate(el => el.offsetWidth);
        expect(finalWidth).toBeGreaterThanOrEqual(60);
      }
    });

    test('should auto-fit column width on double-click', async ({ page }) => {
      const descHeader = page.locator('[data-col="description"] .column-header').first();
      const headerBounds = await descHeader.boundingBox();
      
      if (headerBounds) {
        const resizeX = headerBounds.x + headerBounds.width - 2;
        const resizeY = headerBounds.y + headerBounds.height / 2;
        
        // Double-click on resize handle for auto-fit
        await page.mouse.move(resizeX, resizeY);
        await page.mouse.dblclick();
        
        // EXPECTED FAILURE: Auto-fit not implemented
        // Should resize to fit content
        await page.waitForTimeout(500);
        
        // Width should change to fit the longest content in that column
        const newWidth = await descHeader.evaluate(el => el.offsetWidth);
        expect(newWidth).toBeGreaterThan(100); // Should be reasonable width for content
      }
    });
  });

  test.describe('Category 3.3: Column Management', () => {
    test('should show column menu on right-click', async ({ page }) => {
      const statusHeader = page.locator('[data-col="status"] .column-header').first();
      
      // Right-click on column header
      await statusHeader.click({ button: 'right' });
      
      // EXPECTED FAILURE: Column context menu not implemented
      // Should show context menu with column options
      await expect(page.locator('.column-context-menu, .context-menu')).toBeVisible({ timeout: 2000 });
      
      // Menu should have options like Hide, Freeze, Sort, etc.
      await expect(page.locator('.context-menu')).toContainText('Hide Column');
      await expect(page.locator('.context-menu')).toContainText('Freeze Column');
      await expect(page.locator('.context-menu')).toContainText('Sort Ascending');
      await expect(page.locator('.context-menu')).toContainText('Sort Descending');
    });

    test('should hide column via context menu', async ({ page }) => {
      const priorityHeader = page.locator('[data-col="priority"] .column-header').first();
      
      // Verify column is initially visible
      await expect(priorityHeader).toBeVisible();
      
      // Right-click and hide
      await priorityHeader.click({ button: 'right' });
      await page.locator('.context-menu .hide-column, text="Hide Column"').click();
      
      // EXPECTED FAILURE: Hide/show columns not implemented
      // Column should be hidden
      await expect(priorityHeader).not.toBeVisible();
      
      // Column should not appear in data rows either
      await expect(page.locator('[data-col="priority"]')).not.toBeVisible();
    });

    test('should reorder columns by dragging headers', async ({ page }) => {
      const titleHeader = page.locator('[data-col="title"] .column-header').first();
      const statusHeader = page.locator('[data-col="status"] .column-header').first();
      
      // Get initial positions
      const titleBounds = await titleHeader.boundingBox();
      const statusBounds = await statusHeader.boundingBox();
      
      if (titleBounds && statusBounds) {
        // Drag title column to where status column is
        await page.mouse.move(titleBounds.x + titleBounds.width / 2, titleBounds.y + titleBounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(statusBounds.x + statusBounds.width / 2, statusBounds.y + statusBounds.height / 2);
        await page.mouse.up();
        
        // EXPECTED FAILURE: Column reordering not implemented
        // Should show drag preview during drag
        await expect(page.locator('.column-drag-preview')).toBeVisible();
        
        // After drop, columns should be reordered
        const newTitleBounds = await titleHeader.boundingBox();
        const newStatusBounds = await statusHeader.boundingBox();
        
        // Title should now be where status was (approximately)
        expect(newTitleBounds?.x).toBeCloseTo(statusBounds.x, 50);
      }
    });

    test('should freeze/pin columns to left side', async ({ page }) => {
      const titleHeader = page.locator('[data-col="title"] .column-header').first();
      
      // Right-click and freeze column
      await titleHeader.click({ button: 'right' });
      await page.locator('.context-menu .freeze-column, text="Freeze Column"').click();
      
      // EXPECTED FAILURE: Column freezing not implemented
      // Column should have frozen/pinned styling
      await expect(page.locator('[data-col="title"]')).toHaveClass(/frozen|pinned/);
      
      // When scrolling horizontally, frozen columns should stay in place
      await page.mouse.wheel(1000, 0); // Scroll right
      
      // Frozen column should still be visible
      await expect(titleHeader).toBeVisible();
      
      // But other columns should have scrolled
      const otherHeader = page.locator('[data-col="description"] .column-header').first();
      const isVisible = await otherHeader.isVisible();
      expect(isVisible).toBeFalsy(); // Should be scrolled out of view
    });

    test('should show column visibility toggle panel', async ({ page }) => {
      // Look for column visibility button (usually in toolbar)
      const columnToggleButton = page.locator('[data-testid="column-visibility-toggle"], .column-toggle-btn, button:has-text("Columns")').first();
      await columnToggleButton.click();
      
      // EXPECTED FAILURE: Column visibility panel not implemented
      // Should show panel with checkboxes for each column
      await expect(page.locator('.column-visibility-panel, .column-toggle-panel')).toBeVisible({ timeout: 2000 });
      
      // Should list all columns with checkboxes
      await expect(page.locator('.column-visibility-panel')).toContainText('title');
      await expect(page.locator('.column-visibility-panel')).toContainText('priority');
      await expect(page.locator('.column-visibility-panel')).toContainText('status');
      
      // Should have checkboxes for toggling
      const checkboxes = page.locator('.column-visibility-panel input[type="checkbox"]');
      expect(await checkboxes.count()).toBeGreaterThan(3);
    });
  });

  test.afterEach(async ({ page }) => {
    // Take screenshot on failure for debugging
    if (test.info().status === 'failed') {
      await page.screenshot({ 
        path: `screenshots/vibegrid-column-operations-failure-${Date.now()}.png`,
        fullPage: true 
      });
    }
  });
});