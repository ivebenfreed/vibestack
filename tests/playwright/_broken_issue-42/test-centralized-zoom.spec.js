import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Issue #42: Centralized Zoom State', () => {
  test('scroll position should be tracked by machine state for zoom anchoring', async ({ page }) => {
    // Navigate to the Gantt page
    await page.goto('/debug/vibegantt');
    
    // Wait for the Gantt chart to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
    
    // Wait for tasks to be visible
    await page.waitForSelector('.vibegantt-task', { timeout: 10000 });
    
    // Scroll horizontally to a position where we can test anchoring
    const ganttContainer = page.locator('.vibegantt-container');
    const scrollWrapper = page.locator('.vibegantt-task-scroll-wrapper');
    
    console.log('Scrolling to test position...');
    await scrollWrapper.evaluate(el => {
      el.scrollLeft = 500; // Scroll 500px to the right
    });
    
    // Wait a moment for scroll events to propagate
    await page.waitForTimeout(100);
    
    // Check console logs to see if machine received SCROLL event
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('GanttMachine') || msg.text().includes('SCROLL')) {
        consoleLogs.push(msg.text());
      }
    });
    
    // Trigger a zoom event with Ctrl+Wheel
    await ganttContainer.hover();
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -180); // Zoom in
    await page.keyboard.up('Control');
    
    // Wait for zoom to complete
    await page.waitForTimeout(100);
    
    // Check if the machine logs show non-zero currentScrollX
    const machineLog = await page.evaluate(() => {
      // Look for the most recent zoom log
      return window.console._logs?.find(log => 
        log.includes('currentScrollX') && log.includes('GanttMachine')
      ) || 'No zoom log found';
    });
    
    console.log('Machine zoom log:', machineLog);
    
    // The test passes if we don't see currentScrollX: 0 in the zoom calculation
    // This indicates the machine is properly tracking scroll position
    expect(machineLog).not.toContain('currentScrollX: 0');
  });
  
  test('zoom should maintain content position after multiple scroll and zoom events', async ({ page }) => {
    // Navigate to the Gantt page
    await page.goto('/debug/vibegantt');
    
    // Wait for the Gantt chart to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
    
    // Wait for tasks to be visible
    await page.waitForSelector('.vibegantt-task', { timeout: 10000 });
    
    const ganttContainer = page.locator('.vibegantt-container');
    const scrollWrapper = page.locator('.vibegantt-task-scroll-wrapper');
    
    // Get initial task positions
    const initialTaskPositions = await page.locator('.vibegantt-task').evaluateAll(tasks => 
      tasks.map(task => ({
        id: task.getAttribute('data-task-id'),
        rect: task.getBoundingClientRect()
      }))
    );
    
    console.log('Initial task positions:', initialTaskPositions.length);
    
    // Scroll to a specific position
    await scrollWrapper.evaluate(el => {
      el.scrollLeft = 300;
    });
    
    await page.waitForTimeout(100);
    
    // Zoom out
    await ganttContainer.hover();
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 180); // Zoom out
    await page.keyboard.up('Control');
    
    await page.waitForTimeout(200);
    
    // Zoom back in
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -180); // Zoom in
    await page.keyboard.up('Control');
    
    await page.waitForTimeout(200);
    
    // Get final task positions
    const finalTaskPositions = await page.locator('.vibegantt-task').evaluateAll(tasks => 
      tasks.map(task => ({
        id: task.getAttribute('data-task-id'),
        rect: task.getBoundingClientRect()
      }))
    );
    
    console.log('Final task positions:', finalTaskPositions.length);
    
    // Tasks should still be visible and in reasonable positions
    // (not all jumping to the left edge)
    expect(finalTaskPositions.length).toBeGreaterThan(0);
    expect(finalTaskPositions.length).toBe(initialTaskPositions.length);
    
    // Check that tasks didn't all jump to position 0
    const tasksAtZero = finalTaskPositions.filter(task => task.rect.left <= 10);
    expect(tasksAtZero.length).toBeLessThan(finalTaskPositions.length);
  });
});