// VibeGantt Comprehensive Test Suite
// Tests all functionality using MCP browser automation

import { test, expect } from '@playwright/test';

test.describe('VibeGantt Component Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test page
    await page.goto('http://localhost:4000/debug/vibegantt-test');

    // Wait for component to load
    await page.waitForSelector('[data-testid="vibegantt-container"]', { timeout: 10000 });

    // Wait for tasks to render
    await page.waitForSelector('.vibegantt-task-bar', { timeout: 5000 });
  });

  test('should render VibeGantt component with mock data', async ({ page }) => {
    // Test component presence
    const ganttContainer = page.locator('[data-testid="vibegantt-container"]');
    await expect(ganttContainer).toBeVisible();

    // Test task bars
    const taskBars = page.locator('.vibegantt-task-bar');
    await expect(taskBars).toHaveCount(9); // Should have 9 mock tasks

    // Test dependency lines
    const dependencyLines = page.locator('.vibegantt-dependency-line');
    await expect(dependencyLines).toHaveCount(9); // Should have 9 dependencies

    // Test time markers
    const timeMarkers = page.locator('.vibegantt-time-marker');
    expect(await timeMarkers.count()).toBeGreaterThan(10); // Should have multiple time markers

    // Test controls
    await expect(page.locator('.vibegantt-controls')).toBeVisible();
  });

  test('should handle task selection', async ({ page }) => {
    // Click first task bar
    const firstTask = page.locator('.vibegantt-task-bar').first();
    await firstTask.click();

    // Verify task is selected
    await expect(firstTask).toHaveClass(/selected/);

    // Check that task row is also selected
    const taskRows = page.locator('.vibegantt-task-row');
    await expect(taskRows.first()).toHaveClass(/selected/);

    // Click another task
    const secondTask = page.locator('.vibegantt-task-bar').nth(1);
    await secondTask.click();

    // Verify selection moved
    await expect(secondTask).toHaveClass(/selected/);
    await expect(firstTask).not.toHaveClass(/selected/);
  });

  test('should handle zoom functionality', async ({ page }) => {
    // Get initial zoom level
    const zoomLabel = page.locator('.vibegantt-controls .vibegantt-label').filter({ hasText: '%' });
    const initialZoom = await zoomLabel.textContent();

    // Click zoom in
    await page.locator('.vibegantt-controls button').filter({ hasText: '+' }).click();

    // Wait for zoom to update
    await page.waitForTimeout(500);

    // Check zoom increased
    const newZoom = await zoomLabel.textContent();
    expect(newZoom).not.toBe(initialZoom);

    // Click zoom out
    await page.locator('.vibegantt-controls button').filter({ hasText: '-' }).click();

    // Wait for zoom to update
    await page.waitForTimeout(500);

    // Test zoom to fit
    await page.locator('.vibegantt-controls button').filter({ hasText: 'Fit' }).click();
    await page.waitForTimeout(500);
  });

  test('should handle time scale changes', async ({ page }) => {
    // Get time scale selector
    const timeScaleSelect = page.locator('.vibegantt-select');

    // Change to week view
    await timeScaleSelect.selectOption('week');
    await page.waitForTimeout(1000);

    // Verify time markers changed
    const timeMarkers = page.locator('.vibegantt-time-marker-label');
    const markerText = await timeMarkers.first().textContent();
    expect(markerText).toContain('Week');

    // Change to month view
    await timeScaleSelect.selectOption('month');
    await page.waitForTimeout(1000);

    // Change back to day view
    await timeScaleSelect.selectOption('day');
    await page.waitForTimeout(1000);
  });

  test('should handle drag and drop functionality', async ({ page }) => {
    // Select first task
    const firstTask = page.locator('.vibegantt-task-bar').first();

    // Get initial position
    const initialBox = await firstTask.boundingBox();

    // Drag task to the right (simulate rescheduling)
    await firstTask.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox.x + 100, initialBox.y);
    await page.mouse.up();

    // Wait for update
    await page.waitForTimeout(1000);

    // Verify task moved
    const newBox = await firstTask.boundingBox();
    expect(newBox.x).toBeGreaterThan(initialBox.x);
  });

  test('should handle task creation and deletion', async ({ page }) => {
    // Get initial task count
    const initialTaskCount = await page.locator('.vibegantt-task-bar').count();

    // Click add task button
    await page.locator('.vibegantt-controls button').filter({ hasText: '+ Task' }).click();
    await page.waitForTimeout(500);

    // Verify task was added
    const newTaskCount = await page.locator('.vibegantt-task-bar').count();
    expect(newTaskCount).toBe(initialTaskCount + 1);

    // Select the new task (last one)
    await page.locator('.vibegantt-task-bar').last().click();
    await page.waitForTimeout(500);

    // Delete the selected task
    await page.locator('.vibegantt-controls button').filter({ hasText: 'Delete' }).click();
    await page.waitForTimeout(500);

    // Verify task was deleted
    const finalTaskCount = await page.locator('.vibegantt-task-bar').count();
    expect(finalTaskCount).toBe(initialTaskCount);
  });

  test('should handle dependency visualization', async ({ page }) => {
    // Test dependency line visibility
    const dependencyLines = page.locator('.vibegantt-dependency-line');
    await expect(dependencyLines.first()).toBeVisible();

    // Click on a dependency line
    await dependencyLines.first().click();
    await page.waitForTimeout(500);

    // Verify dependency is selected (would show different styling)
    await expect(dependencyLines.first()).toHaveClass(/selected/);
  });

  test('should handle data reset and clear operations', async ({ page }) => {
    // Delete a task first
    await page.locator('.vibegantt-task-bar').first().click();
    await page.locator('.vibegantt-controls button').filter({ hasText: 'Delete' }).click();
    await page.waitForTimeout(500);

    // Reset data
    await page.locator('.vibegantt-controls button').filter({ hasText: 'Reset' }).click();
    await page.waitForTimeout(1000);

    // Verify all 9 tasks are back
    const taskBars = page.locator('.vibegantt-task-bar');
    await expect(taskBars).toHaveCount(9);

    // Clear all data
    await page.locator('.vibegantt-controls button').filter({ hasText: 'Clear' }).click();
    await page.waitForTimeout(1000);

    // Verify no tasks remain
    await expect(taskBars).toHaveCount(0);

    // Reset data again
    await page.locator('.vibegantt-controls button').filter({ hasText: 'Reset' }).click();
    await page.waitForTimeout(1000);
  });

  test('should handle scroll synchronization', async ({ page }) => {
    // Get timeline and task list elements
    const timeline = page.locator('.vibegantt-timeline');
    const taskList = page.locator('.vibegantt-task-list');

    // Scroll timeline vertically
    await timeline.evaluate(el => el.scrollTop = 50);
    await page.waitForTimeout(500);

    // Check that task list scrolled too
    const taskListScrollTop = await taskList.evaluate(el => el.scrollTop);
    expect(taskListScrollTop).toBe(50);

    // Scroll task list
    await taskList.evaluate(el => el.scrollTop = 100);
    await page.waitForTimeout(500);

    // Check that timeline scrolled too
    const timelineScrollTop = await timeline.evaluate(el => el.scrollTop);
    expect(timelineScrollTop).toBe(100);
  });

  test('should run automated test suite', async ({ page }) => {
    // Click the basic tests button
    await page.locator('button').filter({ hasText: '🧪 Run Basic Tests' }).click();
    await page.waitForTimeout(2000);

    // Verify test results appeared
    const testOutput = page.locator('.bg-black.text-green-400');
    await expect(testOutput).toContainText('✅');

    // Click interaction tests
    await page.locator('button').filter({ hasText: '🖱️ Test Interactions' }).click();
    await page.waitForTimeout(2000);

    // Verify more results
    await expect(testOutput).toContainText('interaction tests');
  });

  test('should take performance screenshots', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({
      path: 'test-results/vibegantt-initial.png',
      fullPage: true
    });

    // Zoom in and take screenshot
    await page.locator('.vibegantt-controls button').filter({ hasText: '+' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'test-results/vibegantt-zoomed-in.png',
      fullPage: false
    });

    // Change time scale and take screenshot
    await page.locator('.vibegantt-select').selectOption('week');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'test-results/vibegantt-week-view.png',
      fullPage: false
    });

    // Select a task and take screenshot
    await page.locator('.vibegantt-task-bar').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'test-results/vibegantt-task-selected.png',
      fullPage: false
    });
  });

  test('should validate performance metrics', async ({ page }) => {
    // Measure initial load time
    const startTime = Date.now();
    await page.goto('http://localhost:4000/debug/vibegantt-test');
    await page.waitForSelector('[data-testid="vibegantt-container"]');
    const loadTime = Date.now() - startTime;

    console.log(`VibeGantt load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds

    // Measure zoom operation time
    const zoomStartTime = Date.now();
    await page.locator('.vibegantt-controls button').filter({ hasText: '+' }).click();
    await page.waitForTimeout(500);
    const zoomTime = Date.now() - zoomStartTime;

    console.log(`Zoom operation time: ${zoomTime}ms`);
    expect(zoomTime).toBeLessThan(1000); // Zoom should be responsive

    // Test memory usage (basic check)
    const metrics = await page.evaluate(() => performance.memory);
    console.log('Memory usage:', metrics);

    // Verify no console errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);
    expect(logs.length).toBe(0); // No console errors
  });
});

test.describe('VibeGantt Edge Cases', () => {
  test('should handle empty data gracefully', async ({ page }) => {
    await page.goto('http://localhost:4000/debug/vibegantt-test');
    await page.waitForSelector('[data-testid="vibegantt-container"]');

    // Clear all data
    await page.locator('.vibegantt-controls button').filter({ hasText: 'Clear' }).click();
    await page.waitForTimeout(1000);

    // Verify component still renders properly
    await expect(page.locator('[data-testid="vibegantt-container"]')).toBeVisible();

    // Verify no task bars
    await expect(page.locator('.vibegantt-task-bar')).toHaveCount(0);

    // Verify controls still work
    await expect(page.locator('.vibegantt-controls')).toBeVisible();
  });

  test('should handle rapid interactions', async ({ page }) => {
    await page.goto('http://localhost:4000/debug/vibegantt-test');
    await page.waitForSelector('[data-testid="vibegantt-container"]');

    // Rapid zoom operations
    for (let i = 0; i < 5; i++) {
      await page.locator('.vibegantt-controls button').filter({ hasText: '+' }).click();
      await page.waitForTimeout(100);
    }

    // Rapid time scale changes
    const timeScales = ['week', 'month', 'day'];
    for (const scale of timeScales) {
      await page.locator('.vibegantt-select').selectOption(scale);
      await page.waitForTimeout(200);
    }

    // Verify component is still responsive
    await expect(page.locator('[data-testid="vibegantt-container"]')).toBeVisible();
  });
});