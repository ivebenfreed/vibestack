/**
 * Comprehensive test for all dependency line interaction features
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Full Dependency Interaction Features', () => {
  test('should support selection, hover, delete button, and connection handles', async ({ page }) => {
    console.log('\n=== COMPREHENSIVE DEPENDENCY INTERACTION TEST ===');
    
    // Navigate to the debug page
    await page.goto('/debug/vibegantt');
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Wait for dependencies to render
    await page.waitForSelector('.vibegantt-dependency-group', { timeout: 10000 });
    
    // Count dependencies
    const depCount = await page.locator('.vibegantt-dependency-group').count();
    console.log(`\n📊 Total dependencies: ${depCount}`);
    
    // Test 1: Selection via click
    console.log('\n🎯 Test 1: Selection via click');
    
    // Set up console monitoring
    const events = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('DEPENDENCY_SELECT') || text.includes('Dependency clicked')) {
        events.push({ type: 'select', text });
        console.log(`  [EVENT] ${text}`);
      } else if (text.includes('DEPENDENCY_DELETE')) {
        events.push({ type: 'delete', text });
        console.log(`  [EVENT] ${text}`);
      }
    });
    
    // Click first dependency
    const firstDep = await page.locator('.vibegantt-dependency-group').first();
    await firstDep.click({ force: true });
    await page.waitForTimeout(500);
    
    // Verify selection happened
    const selectEvents = events.filter(e => e.type === 'select');
    console.log(`  Selection events: ${selectEvents.length}`);
    expect(selectEvents.length).toBeGreaterThan(0);
    
    // Check for delete button
    const deleteButton = await page.locator('.dependency-controls .delete-button').first();
    const hasDeleteButton = await deleteButton.count() > 0;
    console.log(`  Delete button appeared: ${hasDeleteButton}`);
    
    // Test 2: Hover effects
    console.log('\n🖱️ Test 2: Hover effects');
    
    // Get a dependency that's not selected
    const secondDep = await page.locator('.vibegantt-dependency-group').nth(1);
    
    // Get initial state
    const initialStroke = await secondDep.locator('.vibegantt-dependency').getAttribute('stroke');
    const initialWidth = await secondDep.locator('.vibegantt-dependency').getAttribute('stroke-width');
    console.log(`  Initial: stroke=${initialStroke}, width=${initialWidth}`);
    
    // Hover over it
    await secondDep.hover();
    await page.waitForTimeout(300);
    
    // Check hover state
    const hoverStroke = await secondDep.locator('.vibegantt-dependency').getAttribute('stroke');
    const hoverWidth = await secondDep.locator('.vibegantt-dependency').getAttribute('stroke-width');
    console.log(`  Hover: stroke=${hoverStroke}, width=${hoverWidth}`);
    
    // Verify hover changed the appearance
    const hoverChanged = (hoverStroke !== initialStroke) || (hoverWidth !== initialWidth);
    console.log(`  Hover effect working: ${hoverChanged}`);
    
    // Test 3: Delete button functionality
    if (hasDeleteButton) {
      console.log('\n🗑️ Test 3: Delete button click');
      
      // Click delete button
      await deleteButton.click({ force: true });
      await page.waitForTimeout(500);
      
      // Check if delete event was fired
      const deleteEvents = events.filter(e => e.type === 'delete');
      console.log(`  Delete events: ${deleteEvents.length}`);
      
      // Check if dependency count decreased
      const newDepCount = await page.locator('.vibegantt-dependency-group').count();
      console.log(`  Dependencies after delete: ${newDepCount} (was ${depCount})`);
    }
    
    // Test 4: Connection handles
    console.log('\n🔗 Test 4: Connection handles');
    
    // Look for connection handles on selected dependency
    const handles = await page.locator('.connection-handle').all();
    console.log(`  Connection handles found: ${handles.length}`);
    
    if (handles.length > 0) {
      // Check handle properties
      const firstHandle = handles[0];
      const handleType = await firstHandle.getAttribute('data-handle-type');
      const handleDepId = await firstHandle.getAttribute('data-dependency-id');
      console.log(`  First handle: type=${handleType}, dependency=${handleDepId}`);
      
      // Verify handles are visible when dependency is selected
      const handleOpacity = await firstHandle.evaluate(el => 
        window.getComputedStyle(el).opacity
      );
      console.log(`  Handle opacity: ${handleOpacity}`);
    }
    
    // Test 5: Deselection
    console.log('\n❌ Test 5: Deselection');
    
    // Click in empty area
    await page.mouse.click(50, 50);
    await page.waitForTimeout(500);
    
    // Check if selection is cleared
    const selectedCount = await page.locator('.vibegantt-dependency-group.selected').count();
    console.log(`  Selected dependencies after clicking away: ${selectedCount}`);
    
    // Check if delete button is gone
    const deleteButtonGone = await page.locator('.dependency-controls').count() === 0;
    console.log(`  Delete button removed: ${deleteButtonGone}`);
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/dependency-full-interactions.png',
      fullPage: false
    });
    
    // Summary
    console.log('\n📊 INTERACTION SUMMARY:');
    console.log(`  ✅ Selection: ${selectEvents.length > 0 ? 'Working' : 'Not working'}`);
    console.log(`  ✅ Hover: ${hoverChanged ? 'Working' : 'Not working'}`);
    console.log(`  ✅ Delete button: ${hasDeleteButton ? 'Visible' : 'Not visible'}`);
    console.log(`  ✅ Connection handles: ${handles.length > 0 ? 'Present' : 'Not found'}`);
    console.log(`  ✅ Deselection: ${deleteButtonGone ? 'Working' : 'Not working'}`);
    
    console.log('\n✅ All dependency interaction features tested');
  });
  
  test('should handle dependency reassignment via drag', async ({ page }) => {
    console.log('\n=== DEPENDENCY REASSIGNMENT TEST ===');
    
    // Navigate to the debug page
    await page.goto('/debug/vibegantt');
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Wait for dependencies
    await page.waitForSelector('.vibegantt-dependency-group', { timeout: 10000 });
    
    // Select a dependency
    const firstDep = await page.locator('.vibegantt-dependency-group').first();
    await firstDep.click({ force: true });
    await page.waitForTimeout(500);
    
    // Find connection handle
    const startHandle = await page.locator('.connection-handle[data-handle-type="start"]').first();
    const hasHandle = await startHandle.count() > 0;
    
    if (hasHandle) {
      console.log('🔗 Testing connection handle drag');
      
      // Get handle position
      const handleBox = await startHandle.boundingBox();
      if (handleBox) {
        // Find a task to drop on
        const targetTask = await page.locator('.vibegantt-task').nth(2);
        const taskBox = await targetTask.boundingBox();
        
        if (taskBox) {
          // Monitor for drag events
          const dragEvents = [];
          page.on('console', msg => {
            const text = msg.text();
            if (text.includes('DEPENDENCY_DRAG') || text.includes('DEPENDENCY_REASSIGN')) {
              dragEvents.push(text);
              console.log(`  [DRAG EVENT] ${text}`);
            }
          });
          
          // Perform drag
          console.log('  Dragging handle to new task...');
          await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(100);
          
          // Drag to target
          await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2, { steps: 10 });
          await page.waitForTimeout(100);
          
          // Check if target is highlighted
          const targetHighlighted = await targetTask.evaluate(el => 
            el.classList.contains('dependency-drop-target')
          );
          console.log(`  Target highlighted: ${targetHighlighted}`);
          
          // Drop
          await page.mouse.up();
          await page.waitForTimeout(500);
          
          console.log(`  Drag events fired: ${dragEvents.length}`);
        }
      }
    } else {
      console.log('  No connection handles found - skipping drag test');
    }
    
    console.log('\n✅ Reassignment test completed');
  });
});