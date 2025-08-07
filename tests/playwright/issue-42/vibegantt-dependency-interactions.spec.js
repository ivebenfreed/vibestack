// Issue #12: Test VibeGantt dependency line interactions
import { test, expect } from '../fixtures/persistent-context.js';

test.describe('VibeGantt Dependency Interactions', () => {
  test.setTimeout(60000);
  
  test('should handle dependency line clicks and selections', async ({ page }) => {
    console.log('\n=== DEPENDENCY INTERACTION TEST ===');
    
    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Dependency') || text.includes('DEPENDENCY')) {
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
    
    // Check if dependencies exist
    const dependencyCount = await page.locator('.vibegantt-dependency').count();
    console.log(`📋 Found ${dependencyCount} dependencies`);
    
    if (dependencyCount === 0) {
      console.log('⚠️ No dependencies found, skipping interaction tests');
      return;
    }
    
    // Test 1: Click on a dependency line
    console.log('\n🎯 Test 1: Clicking on dependency line');
    const firstDependency = page.locator('.vibegantt-dependency').first();
    
    // Get dependency ID
    const dependencyId = await firstDependency.getAttribute('data-dependency-id');
    console.log(`  Clicking dependency: ${dependencyId}`);
    
    await firstDependency.click();
    await page.waitForTimeout(500);
    
    // Check if selection event was fired
    const selectMessages = consoleMessages.filter(msg => 
      msg.text.includes('DEPENDENCY_SELECT') || 
      msg.text.includes('Dependency clicked')
    );
    console.log(`  Selection events fired: ${selectMessages.length}`);
    
    // Check for visual feedback (selected class)
    const isSelected = await firstDependency.evaluate(el => 
      el.classList.contains('selected') || 
      el.querySelector('.dependency-selection') !== null
    );
    console.log(`  Visual selection feedback: ${isSelected ? 'Yes' : 'No'}`);
    
    // Test 2: Check if delete button appears
    console.log('\n🗑️ Test 2: Delete button visibility');
    
    // Hover over the dependency
    await firstDependency.hover();
    await page.waitForTimeout(500);
    
    // Check if delete button is visible
    const deleteButton = page.locator('.delete-button').first();
    const deleteButtonVisible = await deleteButton.isVisible().catch(() => false);
    console.log(`  Delete button visible on hover: ${deleteButtonVisible ? 'Yes' : 'No'}`);
    
    if (deleteButtonVisible) {
      // Test 3: Click delete button
      console.log('\n🗑️ Test 3: Clicking delete button');
      await deleteButton.click();
      await page.waitForTimeout(500);
      
      const deleteMessages = consoleMessages.filter(msg => 
        msg.text.includes('DEPENDENCY_DELETE') || 
        msg.text.includes('delete button clicked')
      );
      console.log(`  Delete events fired: ${deleteMessages.length}`);
    }
    
    // Test 4: Check for connection handles
    console.log('\n🔗 Test 4: Connection handles for reassignment');
    
    const connectionHandles = await page.locator('.connection-handle').count();
    console.log(`  Connection handles found: ${connectionHandles}`);
    
    if (connectionHandles > 0) {
      const firstHandle = page.locator('.connection-handle').first();
      const handleType = await firstHandle.getAttribute('data-handle-type');
      console.log(`  First handle type: ${handleType}`);
      
      // Try to drag the handle
      console.log('  Attempting to drag connection handle...');
      const handleBox = await firstHandle.boundingBox();
      if (handleBox) {
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(100);
        
        // Find a task to drop on
        const taskElement = page.locator('.vibegantt-task').last();
        const taskBox = await taskElement.boundingBox();
        if (taskBox) {
          await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
          await page.waitForTimeout(100);
          await page.mouse.up();
          
          const dragMessages = consoleMessages.filter(msg => 
            msg.text.includes('DEPENDENCY_DRAG') || 
            msg.text.includes('DEPENDENCY_REASSIGN')
          );
          console.log(`  Drag/reassign events fired: ${dragMessages.length}`);
        }
      }
    }
    
    // Summary
    console.log('\n📊 INTERACTION SUMMARY:');
    console.log(`  Total dependencies: ${dependencyCount}`);
    console.log(`  Console events captured: ${consoleMessages.length}`);
    
    const eventTypes = [...new Set(consoleMessages.map(msg => {
      if (msg.text.includes('DEPENDENCY_SELECT')) return 'SELECT';
      if (msg.text.includes('DEPENDENCY_DELETE')) return 'DELETE';
      if (msg.text.includes('DEPENDENCY_DRAG')) return 'DRAG';
      if (msg.text.includes('DEPENDENCY_REASSIGN')) return 'REASSIGN';
      return 'OTHER';
    }))];
    
    console.log(`  Event types fired: ${eventTypes.join(', ')}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-dependency-interactions.png',
      fullPage: true 
    });
    
    // Verify at least selection works
    expect(selectMessages.length).toBeGreaterThan(0);
    
    console.log('\n✅ Dependency interaction test completed');
  });
});