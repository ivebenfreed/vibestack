// Issue #42: Test that field name fix resolved the drag & drop issue
import { test, expect } from '../fixtures/persistent-context.js';

test.describe('VibeGantt Field Name Fix', () => {
  test.setTimeout(60000);
  
  test('should handle drag operations with correct field names', async ({ page }) => {
    console.log('\n=== TESTING FIELD NAME FIX ===');
    
    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Invalid task data') || 
          text.includes('move calculation') || 
          text.includes('domain service')) {
        consoleMessages.push({
          type: msg.type(),
          text: text
        });
        console.log(`[${msg.type().toUpperCase()}] ${text}`);
      }
    });
    
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
    
    // Check task data structure
    const taskData = await page.evaluate(() => {
      const store = window.__vibegantt_store_actor;
      if (!store) return null;
      
      const snapshot = store.getSnapshot();
      const tasks = snapshot.context.tasks;
      const firstTask = Object.values(tasks)[0];
      
      return {
        hasStartDate: !!firstTask?.startDate,
        hasDueDate: !!firstTask?.dueDate,
        startDate: firstTask?.startDate,
        dueDate: firstTask?.dueDate,
        // Check for old field names (should not exist)
        hasPlannedStartDate: !!firstTask?.plannedStartDate,
        hasPlannedEndDate: !!firstTask?.plannedEndDate
      };
    });
    
    console.log('📋 Task Data Structure:', taskData);
    
    // Verify correct field names are present
    expect(taskData).not.toBeNull();
    expect(taskData.hasStartDate).toBe(true);
    expect(taskData.hasDueDate).toBe(true);
    expect(taskData.hasPlannedStartDate).toBe(false);
    expect(taskData.hasPlannedEndDate).toBe(false);
    
    // Find and drag a task
    const taskElement = page.locator('.vibegantt-task').first();
    await expect(taskElement).toBeVisible();
    
    const box = await taskElement.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const endX = startX + 100; // Drag 100px to the right
    
    console.log(`🎯 Dragging task from (${startX}, ${startY}) to (${endX}, ${startY})`);
    
    // Perform drag operation
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(endX, startY, { steps: 5 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Check console for errors
    const errorMessages = consoleMessages.filter(msg => 
      msg.type === 'error' && msg.text.includes('Invalid task data')
    );
    
    const successMessages = consoleMessages.filter(msg => 
      msg.text.includes('BEFORE move calculation') || 
      msg.text.includes('AFTER move calculation') ||
      msg.text.includes('Calling domain service')
    );
    
    console.log('\n📊 Results:');
    console.log(`  ❌ Error messages about invalid task data: ${errorMessages.length}`);
    console.log(`  ✅ Successful date calculations: ${successMessages.length > 0 ? 'Yes' : 'No'}`);
    
    if (errorMessages.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      errorMessages.forEach(msg => console.log(`  - ${msg.text}`));
    }
    
    if (successMessages.length > 0) {
      console.log('\n✅ SUCCESS MESSAGES:');
      successMessages.forEach(msg => console.log(`  - ${msg.text.substring(0, 100)}...`));
    }
    
    // Expect no "Invalid task data" errors
    expect(errorMessages.length).toBe(0);
    
    // Expect successful date calculations
    expect(successMessages.length).toBeGreaterThan(0);
    
    console.log('\n✅ Field name fix verified - drag & drop should now work correctly!');
  });
});