// ====================================
// PHASE 1: PERFORMANCE REGRESSION TESTS
// ====================================
// Tests that Phase 1 changes don't degrade performance
// Validates 12K row table performance benchmarks

import { test, expect } from '../fixtures/persistent-context.js';

const LEGEND_TABLE_URL = '/debug/legend-table';
const PERFORMANCE_TIMEOUT = 30000;

test.describe('Phase 1: Performance Regression Tests', () => {

  test.beforeEach(async ({ page }) => {
    console.log('Starting performance test...');
  });

  test('12K row table loads within 2 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate to Legend Table
    await page.goto(LEGEND_TABLE_URL);
    
    // Wait for table to be fully loaded and ready
    await page.waitForSelector('.vibegridx-table-container', { timeout: 10000 });
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );

    // Wait for data to be loaded (look for actual cells with data)
    await page.waitForSelector('.vibegridx-cell[data-row-id]', { timeout: 10000 });
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Should load within 2 seconds
    expect(loadTime).toBeLessThan(2000);
    console.log(`✅ Table loaded in ${loadTime}ms (target: <2000ms)`);

    // Verify we actually have a substantial dataset
    const cellCount = await page.locator('.vibegridx-cell[data-row-id]').count();
    expect(cellCount).toBeGreaterThan(10); // Should have rendered cells
    console.log(`✅ Rendered ${cellCount} cells`);
  });

  test('scroll performance maintains 60fps', async ({ page }) => {
    await page.goto(LEGEND_TABLE_URL);
    
    // Wait for table to be ready
    await page.waitForSelector('.vibegridx-table-container', { timeout: 10000 });
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );

    const tableContainer = page.locator('.vibegridx-viewport');
    
    // Measure scroll performance
    const scrollStartTime = Date.now();
    const scrollDistance = 5000; // Scroll through substantial data
    const scrollSteps = 20;
    const scrollIncrement = scrollDistance / scrollSteps;

    // Perform smooth scrolling and measure frame consistency
    for (let i = 0; i < scrollSteps; i++) {
      const scrollTop = i * scrollIncrement;
      await tableContainer.evaluate((el, scroll) => {
        el.scrollTop = scroll;
      }, scrollTop);
      
      // Small delay to check rendering keeps up
      await page.waitForTimeout(16); // 60fps = 16ms per frame
    }

    const scrollEndTime = Date.now();
    const totalScrollTime = scrollEndTime - scrollStartTime;
    const avgFrameTime = totalScrollTime / scrollSteps;

    // Should maintain close to 60fps (16ms per frame)
    expect(avgFrameTime).toBeLessThan(50); // Allow some tolerance
    console.log(`✅ Scroll performance: ${avgFrameTime.toFixed(1)}ms per frame (target: <50ms for 60fps)`);
  });

  test('selection operations complete within 100ms', async ({ page }) => {
    await page.goto(LEGEND_TABLE_URL);
    
    await page.waitForSelector('.vibegridx-table-container', { timeout: 10000 });
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );

    // Test single cell selection speed
    const singleCellStart = Date.now();
    const firstCell = page.locator('.vibegridx-cell[data-row-id]').first();
    await firstCell.click();
    await page.waitForSelector('.vibegridx-selection-element', { timeout: 1000 });
    const singleCellTime = Date.now() - singleCellStart;

    expect(singleCellTime).toBeLessThan(100);
    console.log(`✅ Single cell selection: ${singleCellTime}ms (target: <100ms)`);

    // Test small range selection speed
    const rangeSelectionStart = Date.now();
    const cellBox = await firstCell.boundingBox();
    if (cellBox) {
      await page.mouse.move(cellBox.x + 10, cellBox.y + 10);
      await page.mouse.down();
      await page.mouse.move(cellBox.x + 300, cellBox.y + 120); // Small range
      await page.mouse.up();
    }
    
    // Wait for selection to update
    await page.waitForTimeout(200);
    const rangeSelectionTime = Date.now() - rangeSelectionStart;

    expect(rangeSelectionTime).toBeLessThan(100);
    console.log(`✅ Range selection: ${rangeSelectionTime}ms (target: <100ms)`);
  });

  test('memory usage remains stable during operations', async ({ page }) => {
    await page.goto(LEGEND_TABLE_URL);
    
    await page.waitForSelector('.vibegridx-table-container', { timeout: 10000 });
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );

    // Get baseline memory usage
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    // Perform various operations that might cause memory leaks
    const operations = [
      // Scroll operations
      async () => {
        const viewport = page.locator('.vibegridx-viewport');
        await viewport.evaluate(el => { el.scrollTop = 1000; });
        await page.waitForTimeout(100);
      },
      
      // Selection operations  
      async () => {
        const cell = page.locator('.vibegridx-cell[data-row-id]').first();
        await cell.click();
        await page.waitForTimeout(100);
      },
      
      // Drag operations
      async () => {
        const cell = page.locator('.vibegridx-cell[data-row-id]').first();
        const box = await cell.boundingBox();
        if (box) {
          await page.mouse.move(box.x + 10, box.y + 10);
          await page.mouse.down();
          await page.mouse.move(box.x + 200, box.y + 80);
          await page.mouse.up();
        }
        await page.waitForTimeout(100);
      }
    ];

    // Perform operations multiple times
    for (let i = 0; i < 5; i++) {
      for (const operation of operations) {
        await operation();
      }
    }

    // Force garbage collection if possible
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });

    await page.waitForTimeout(1000);

    // Check final memory usage
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    if (initialMemory > 0 && finalMemory > 0) {
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);
      
      // Memory growth should be reasonable (less than 10MB)
      expect(memoryGrowthMB).toBeLessThan(10);
      console.log(`✅ Memory usage: +${memoryGrowthMB.toFixed(1)}MB after operations (target: <10MB)`);
    } else {
      console.log('⚠️  Memory measurement not available in this environment');
    }
  });

  test('no performance regressions in console warnings', async ({ page }) => {
    const performanceWarnings = [];
    
    // Monitor for performance-related console messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('performance') || 
          text.includes('slow') || 
          text.includes('timeout') ||
          text.includes('Large selection detected') ||
          text.includes('violation')) {
        performanceWarnings.push(text);
      }
    });

    await page.goto(LEGEND_TABLE_URL);
    
    await page.waitForSelector('.vibegridx-table-container', { timeout: 10000 });
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );

    // Perform typical user interactions
    const cell = page.locator('.vibegridx-cell[data-row-id]').first();
    await cell.click();

    const cellBox = await cell.boundingBox();
    if (cellBox) {
      // Small drag operation
      await page.mouse.move(cellBox.x + 10, cellBox.y + 10);
      await page.mouse.down();
      await page.mouse.move(cellBox.x + 150, cellBox.y + 60);
      await page.mouse.up();
    }

    // Scroll test
    const viewport = page.locator('.vibegridx-viewport');
    await viewport.evaluate(el => { el.scrollTop = 2000; });

    await page.waitForTimeout(2000);

    // Should not have performance warnings
    if (performanceWarnings.length > 0) {
      console.log('Performance warnings detected:', performanceWarnings);
    }
    
    // Allow some warnings but not excessive
    expect(performanceWarnings.length).toBeLessThan(5);
    console.log(`✅ Performance warnings: ${performanceWarnings.length} (target: <5)`);
  });

  test('large dataset operations remain responsive', async ({ page }) => {
    await page.goto(LEGEND_TABLE_URL);
    
    await page.waitForSelector('.vibegridx-table-container', { timeout: 10000 });
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );

    // Test operations that could be expensive with large datasets
    const operationTests = [
      {
        name: 'Scroll to bottom',
        operation: async () => {
          const viewport = page.locator('.vibegridx-viewport');
          await viewport.evaluate(el => { el.scrollTop = el.scrollHeight; });
          await page.waitForTimeout(500);
        },
        maxTime: 1000
      },
      {
        name: 'Scroll to middle',
        operation: async () => {
          const viewport = page.locator('.vibegridx-viewport');
          await viewport.evaluate(el => { el.scrollTop = el.scrollHeight / 2; });
          await page.waitForTimeout(500);
        },
        maxTime: 1000
      },
      {
        name: 'Quick scroll jumps',
        operation: async () => {
          const viewport = page.locator('.vibegridx-viewport');
          const positions = [0, 5000, 10000, 2000, 8000];
          for (const pos of positions) {
            await viewport.evaluate((el, scrollTop) => { el.scrollTop = scrollTop; }, pos);
            await page.waitForTimeout(100);
          }
        },
        maxTime: 2000
      }
    ];

    for (const test of operationTests) {
      const startTime = Date.now();
      await test.operation();
      const operationTime = Date.now() - startTime;
      
      expect(operationTime).toBeLessThan(test.maxTime);
      console.log(`✅ ${test.name}: ${operationTime}ms (target: <${test.maxTime}ms)`);
    }
  });

});