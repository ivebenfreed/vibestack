// Issue #42: Verify drag & drop persistence
import { test, expect } from '../fixtures/persistent-context.js';

test.describe('VibeGantt Drag & Drop Persistence', () => {
  test.setTimeout(90000);
  
  test('should persist task position after drag and page refresh', async ({ page }) => {
    console.log('\n=== DRAG & DROP PERSISTENCE TEST ===');
    
    // Navigate and setup
    await page.goto('/debug/vibegantt');
    await page.waitForLoadState('networkidle');
    
    // Wait for sync
    const syncOverlay = page.locator('text="Syncing data"');
    if (await syncOverlay.isVisible().catch(() => false)) {
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }
    
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    , { timeout: 15000 }).catch(() => {});
    
    await page.waitForSelector('[data-testid="vibegantt-container"]', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Get initial task data
    const initialTaskData = await page.evaluate(() => {
      const store = window.__vibegantt_store_actor;
      if (!store) return null;
      
      const snapshot = store.getSnapshot();
      const tasks = Object.values(snapshot.context.tasks);
      const firstTask = tasks[0];
      
      return {
        taskId: firstTask.id,
        title: firstTask.title,
        originalStartDate: firstTask.startDate,
        originalDueDate: firstTask.dueDate
      };
    });
    
    console.log('📋 Initial Task Data:', {
      taskId: initialTaskData.taskId,
      title: initialTaskData.title,
      startDate: initialTaskData.originalStartDate,
      dueDate: initialTaskData.originalDueDate
    });
    
    // Find and drag the first task
    const taskElement = page.locator('.vibegantt-task').first();
    await expect(taskElement).toBeVisible();
    
    const box = await taskElement.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const endX = startX + 150; // Drag 150px to the right (3 days at 50px/day)
    
    console.log(`🎯 Dragging task 150px to the right (approximately 3 days)`);
    
    // Capture console for domain service call
    let domainServiceCalled = false;
    let domainServiceSuccess = false;
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Calling domain service updateTask')) {
        domainServiceCalled = true;
        console.log('  ✅ Domain service updateTask called');
      }
      if (text.includes('Domain service updateTask SUCCESS')) {
        domainServiceSuccess = true;
        console.log('  ✅ Domain service update succeeded');
      }
    });
    
    // Perform drag operation
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(endX, startY, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    
    // Wait for backend processing
    await page.waitForTimeout(3000);
    
    // Verify domain service was called
    expect(domainServiceCalled).toBe(true);
    
    // Get updated task data after drag
    const updatedTaskData = await page.evaluate(() => {
      const store = window.__vibegantt_store_actor;
      if (!store) return null;
      
      const snapshot = store.getSnapshot();
      const tasks = Object.values(snapshot.context.tasks);
      const firstTask = tasks.find(t => t.title === tasks[0].title);
      
      return {
        taskId: firstTask.id,
        updatedStartDate: firstTask.startDate,
        updatedDueDate: firstTask.dueDate
      };
    });
    
    console.log('\n📅 Date Changes:');
    console.log(`  Original Start: ${initialTaskData.originalStartDate}`);
    console.log(`  Updated Start:  ${updatedTaskData.updatedStartDate}`);
    console.log(`  Original Due:   ${initialTaskData.originalDueDate}`);
    console.log(`  Updated Due:    ${updatedTaskData.updatedDueDate}`);
    
    // Verify dates actually changed
    expect(updatedTaskData.updatedStartDate).not.toBe(initialTaskData.originalStartDate);
    expect(updatedTaskData.updatedDueDate).not.toBe(initialTaskData.originalDueDate);
    
    // Calculate the actual day difference
    const startDiff = new Date(updatedTaskData.updatedStartDate) - new Date(initialTaskData.originalStartDate);
    const daysDiff = Math.round(startDiff / (1000 * 60 * 60 * 24));
    console.log(`  Days moved: ${daysDiff}`);
    
    // Take screenshot of updated position
    await page.screenshot({ 
      path: 'screenshots/vibegantt-after-drag.png',
      fullPage: true 
    });
    
    console.log('\n🔄 Refreshing page to test persistence...');
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for sync again
    if (await syncOverlay.isVisible().catch(() => false)) {
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }
    
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    , { timeout: 15000 }).catch(() => {});
    
    await page.waitForSelector('[data-testid="vibegantt-container"]', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Get task data after refresh
    const persistedTaskData = await page.evaluate((taskId) => {
      const store = window.__vibegantt_store_actor;
      if (!store) return null;
      
      const snapshot = store.getSnapshot();
      const tasks = Object.values(snapshot.context.tasks);
      const task = tasks.find(t => t.id === taskId);
      
      return {
        taskId: task.id,
        persistedStartDate: task.startDate,
        persistedDueDate: task.dueDate
      };
    }, initialTaskData.taskId);
    
    console.log('\n📌 After Page Refresh:');
    console.log(`  Persisted Start: ${persistedTaskData.persistedStartDate}`);
    console.log(`  Persisted Due:   ${persistedTaskData.persistedDueDate}`);
    
    // Verify persistence - dates should match the updated dates (compare as strings to avoid object comparison issues)
    expect(new Date(persistedTaskData.persistedStartDate).toISOString()).toBe(new Date(updatedTaskData.updatedStartDate).toISOString());
    expect(new Date(persistedTaskData.persistedDueDate).toISOString()).toBe(new Date(updatedTaskData.updatedDueDate).toISOString());
    
    // Take screenshot of persisted position
    await page.screenshot({ 
      path: 'screenshots/vibegantt-after-refresh.png',
      fullPage: true 
    });
    
    console.log('\n✅ SUCCESS: Task position persisted after page refresh!');
    console.log('  • Task was dragged to new dates');
    console.log('  • Domain service successfully updated the backend');
    console.log('  • After page refresh, task remains at new position');
    console.log('  • Drag & drop persistence is working correctly!');
  });
});