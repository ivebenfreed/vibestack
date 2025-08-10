// Issue #42: Console Debug Test for VibeGantt Drag & Drop
import { test, expect } from '../fixtures/persistent-context.js';

test.describe('VibeGantt Console Debug', () => {
  test.setTimeout(90000);
  
  test('should capture console logs during drag operation', async ({ page }) => {
    console.log('\n=== CONSOLE DEBUG TEST ===');
    
    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('GanttMachine') || text.includes('GanttEventDelegationManager') || text.includes('GanttRenderer')) {
        consoleMessages.push({
          type: msg.type(),
          text: text,
          timestamp: Date.now()
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
      console.log('⏳ Waiting for sync...');
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }
    
    // Wait for ready signal
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    , { timeout: 15000 }).catch(() => {});
    
    await page.waitForSelector('[data-testid="vibegantt-container"]', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const taskCount = await page.locator('[data-testid^="task-bar-"], .vibegantt-task').count();
    console.log(`📋 Found ${taskCount} tasks`);
    
    if (taskCount === 0) {
      console.log('⚠️ No tasks found, ending test');
      return;
    }
    
    // Clear previous console messages
    consoleMessages.length = 0;
    
    // Find and interact with a task
    let taskElement = page.locator('[data-testid^="task-bar-"]').first();
    if (!(await taskElement.isVisible().catch(() => false))) {
      taskElement = page.locator('.vibegantt-task').first();
    }
    
    await expect(taskElement).toBeVisible();
    const initialBounds = await taskElement.boundingBox();
    
    console.log(`🎯 Starting drag operation on task at x=${initialBounds.x}`);
    
    // Perform drag with console logging
    await taskElement.hover();
    console.log('1️⃣ Hovered over task');
    await page.waitForTimeout(100);
    
    // Use Playwright's built-in drag method instead
    console.log(`2️⃣ Starting drag from (${initialBounds.x}, ${initialBounds.y}) to (${initialBounds.x + 150}, ${initialBounds.y})`);
    
    await taskElement.dragTo(page.locator('[data-testid="vibegantt-container"]'), {
      targetPosition: { 
        x: initialBounds.x + 150 - 313, // Adjust for container offset
        y: initialBounds.y - (await page.locator('[data-testid="vibegantt-container"]').boundingBox()).y
      }
    });
    
    console.log('3️⃣ Drag operation completed');
    await page.waitForTimeout(2000); // Allow for backend processing
    
    // Analyze console messages
    console.log('\n📊 CONSOLE MESSAGE ANALYSIS:');
    console.log(`Total messages captured: ${consoleMessages.length}`);
    
    const dragStartMessages = consoleMessages.filter(msg => msg.text.includes('TASK_DRAG_START'));
    const dragMoveMessages = consoleMessages.filter(msg => msg.text.includes('TASK_DRAG_MOVE'));
    const dragEndMessages = consoleMessages.filter(msg => msg.text.includes('TASK_DRAG_END'));
    const domainServiceMessages = consoleMessages.filter(msg => msg.text.includes('domain service'));
    const errorMessages = consoleMessages.filter(msg => msg.type === 'error');
    
    console.log(`📍 TASK_DRAG_START events: ${dragStartMessages.length}`);
    console.log(`🔄 TASK_DRAG_MOVE events: ${dragMoveMessages.length}`);
    console.log(`🏁 TASK_DRAG_END events: ${dragEndMessages.length}`);
    console.log(`🔧 Domain service calls: ${domainServiceMessages.length}`);
    console.log(`❌ Error messages: ${errorMessages.length}`);
    
    if (errorMessages.length > 0) {
      console.log('\n❌ ERROR MESSAGES:');
      errorMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.text}`);
      });
    }
    
    if (dragStartMessages.length > 0) {
      console.log('\n📍 DRAG START MESSAGES:');
      dragStartMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.text}`);
      });
    }
    
    if (dragEndMessages.length > 0) {
      console.log('\n🏁 DRAG END MESSAGES:');
      dragEndMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.text}`);
      });
    }
    
    if (domainServiceMessages.length > 0) {
      console.log('\n🔧 DOMAIN SERVICE MESSAGES:');
      domainServiceMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.text}`);
      });
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-console-debug.png',
      fullPage: true 
    });
    
    console.log('✅ Console debug test completed');
  });
});