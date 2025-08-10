/**
 * Test for Issue #42: Zoom Anchoring and DayWidth Synchronization
 * 
 * This test verifies that:
 * 1. Zoom operations don't cause jumping
 * 2. DayWidth is synchronized between machine and renderer
 * 3. Content is properly anchored during zoom
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Issue #42: Zoom Anchoring and DayWidth Sync', () => {
  test('should zoom without jumping on first zoom event', async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/debug/vibegantt');
    
    // Wait for the gantt chart to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(1000); // Let everything stabilize
    
    // Get initial scroll position
    const initialScrollX = await page.evaluate(() => {
      const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
      return wrapper ? wrapper.scrollLeft : 0;
    });
    
    console.log('Initial scroll position:', initialScrollX);
    
    // Get initial task positions
    const initialTaskPositions = await page.evaluate(() => {
      const tasks = document.querySelectorAll('.vibegantt-task');
      return Array.from(tasks).map(task => ({
        id: task.dataset.taskId,
        left: task.style.left,
        width: task.style.width
      }));
    });
    
    console.log('Initial task positions:', initialTaskPositions);
    
    // Perform zoom in with Ctrl+Scroll
    const chartArea = await page.locator('.vibegantt-tasks-wrapper');
    await chartArea.hover();
    await page.mouse.move(500, 300); // Move to middle of chart
    
    // Simulate Ctrl+Scroll for zoom in
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120); // Negative delta for zoom in
    await page.keyboard.up('Control');
    
    // Wait for zoom animation to complete
    await page.waitForTimeout(500);
    
    // Get scroll position after zoom
    const afterZoomScrollX = await page.evaluate(() => {
      const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
      return wrapper ? wrapper.scrollLeft : 0;
    });
    
    console.log('After zoom scroll position:', afterZoomScrollX);
    
    // Get task positions after zoom
    const afterZoomTaskPositions = await page.evaluate(() => {
      const tasks = document.querySelectorAll('.vibegantt-task');
      return Array.from(tasks).map(task => ({
        id: task.dataset.taskId,
        left: task.style.left,
        width: task.style.width
      }));
    });
    
    console.log('After zoom task positions:', afterZoomTaskPositions);
    
    // Verify tasks are still visible (no major jump)
    // The scroll position should change proportionally but not cause a major jump
    const scrollRatio = afterZoomScrollX / (initialScrollX || 1);
    console.log('Scroll ratio:', scrollRatio);
    
    // Check that at least some tasks are still visible
    const visibleTasksAfterZoom = await page.evaluate(() => {
      const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
      const tasks = document.querySelectorAll('.vibegantt-task');
      const scrollLeft = wrapper.scrollLeft;
      const viewportWidth = wrapper.clientWidth;
      
      return Array.from(tasks).filter(task => {
        const taskLeft = parseFloat(task.style.left);
        const taskWidth = parseFloat(task.style.width);
        const taskRight = taskLeft + taskWidth;
        
        // Check if task is within viewport
        return taskRight >= scrollLeft && taskLeft <= scrollLeft + viewportWidth;
      }).length;
    });
    
    console.log('Visible tasks after zoom:', visibleTasksAfterZoom);
    
    // There should be visible tasks after zoom
    expect(visibleTasksAfterZoom).toBeGreaterThan(0);
    
    // Verify task widths increased (zoom in should make tasks wider)
    if (initialTaskPositions.length > 0 && afterZoomTaskPositions.length > 0) {
      const initialWidth = parseFloat(initialTaskPositions[0].width);
      const afterWidth = parseFloat(afterZoomTaskPositions[0].width);
      
      console.log('Task width change:', { initialWidth, afterWidth });
      
      // Width should increase when zooming in
      expect(afterWidth).toBeGreaterThan(initialWidth);
    }
    
    // Test zoom out
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 120); // Positive delta for zoom out
    await page.keyboard.up('Control');
    
    await page.waitForTimeout(500);
    
    // Get final task positions
    const finalTaskPositions = await page.evaluate(() => {
      const tasks = document.querySelectorAll('.vibegantt-task');
      return Array.from(tasks).map(task => ({
        id: task.dataset.taskId,
        left: task.style.left,
        width: task.style.width
      }));
    });
    
    console.log('Final task positions after zoom out:', finalTaskPositions);
    
    // Verify tasks are still visible after zoom out
    const visibleTasksFinal = await page.evaluate(() => {
      const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
      const tasks = document.querySelectorAll('.vibegantt-task');
      const scrollLeft = wrapper.scrollLeft;
      const viewportWidth = wrapper.clientWidth;
      
      return Array.from(tasks).filter(task => {
        const taskLeft = parseFloat(task.style.left);
        const taskWidth = parseFloat(task.style.width);
        const taskRight = taskLeft + taskWidth;
        
        return taskRight >= scrollLeft && taskLeft <= scrollLeft + viewportWidth;
      }).length;
    });
    
    console.log('Visible tasks after zoom out:', visibleTasksFinal);
    expect(visibleTasksFinal).toBeGreaterThan(0);
  });
  
  test('should maintain consistent dayWidth across components', async ({ page }) => {
    await page.goto('/debug/vibegantt');
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    
    // Check console logs for dayWidth consistency
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('dayWidth') || text.includes('Coordinate-based timeline update')) {
        consoleLogs.push(text);
      }
    });
    
    // Perform zoom
    const chartArea = await page.locator('.vibegantt-tasks-wrapper');
    await chartArea.hover();
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    
    await page.waitForTimeout(1000);
    
    // Check that logs show consistent dayWidth values
    console.log('DayWidth-related logs:', consoleLogs);
    
    // Look for any mismatch in dayWidth values
    const hasMismatch = consoleLogs.some(log => 
      log.includes('50px/day → 40px/day') || 
      log.includes('30px/day → 40px/day')
    );
    
    // There should be no dayWidth mismatch between components
    expect(hasMismatch).toBe(false);
  });
});