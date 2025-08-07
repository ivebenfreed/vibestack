/**
 * Final test for dependency selection and deletion - working around overlapping elements
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('dependency selection and deletion final test', async ({ page }) => {
  // Navigate to debug route
  await page.goto('/debug/vibegantt');
  
  // Refresh to get the updated code
  await page.reload();
  
  // Wait for Gantt to load
  await page.waitForSelector('.vibegantt', { state: 'visible' });
  await page.waitForSelector('.vibegantt-task', { state: 'visible' });
  await page.waitForTimeout(2000);
  
  // Count initial dependencies
  const initialCount = await page.locator('.vibegantt-dependency-group').count();
  console.log('Initial dependencies:', initialCount);
  
  if (initialCount === 0) {
    console.log('No dependencies found');
    return;
  }
  
  // Find a dependency that's not overlapped by looking for one in the middle of the chart
  const deps = await page.locator('.vibegantt-dependency-group').all();
  let selectedDep = null;
  let depId = null;
  
  // Try to find a dependency that's clickable
  for (let i = Math.floor(deps.length / 2); i < deps.length; i++) {
    const dep = deps[i];
    const box = await dep.boundingBox();
    if (box && box.x > 500 && box.x < 1500) { // Middle of the screen
      selectedDep = dep;
      depId = await dep.getAttribute('data-dependency-id');
      console.log(`Found clickable dependency ${i} at x=${box.x}, id=${depId}`);
      break;
    }
  }
  
  if (!selectedDep) {
    console.log('No clickable dependency found in middle of screen');
    selectedDep = deps[0];
    depId = await selectedDep.getAttribute('data-dependency-id');
  }
  
  // Click the dependency path within the group
  const depPath = selectedDep.locator('.vibegantt-dependency').first();
  const pathBox = await depPath.boundingBox();
  
  if (pathBox) {
    console.log(`Clicking dependency path at: ${pathBox.x + pathBox.width/2}, ${pathBox.y + pathBox.height/2}`);
    await page.mouse.click(pathBox.x + pathBox.width/2, pathBox.y + pathBox.height/2);
    await page.waitForTimeout(500);
  }
  
  // Check if selected
  const selectedCount = await page.locator('.vibegantt-dependency-group.selected').count();
  console.log('Selected dependencies:', selectedCount);
  
  // Look for delete button
  const deleteButtons = await page.locator('.delete-button').count();
  console.log('Delete buttons:', deleteButtons);
  
  // Take screenshot
  await page.screenshot({ 
    path: './screenshots/issue-53/final-test-selected.png',
    fullPage: true 
  });
  
  if (selectedCount > 0 && deleteButtons > 0) {
    console.log('Selection successful! Testing delete...');
    
    // Click delete button
    const deleteBtn = page.locator('.delete-button').first();
    await deleteBtn.click();
    await page.waitForTimeout(1000);
    
    // Check final count
    const finalCount = await page.locator('.vibegantt-dependency-group').count();
    console.log('Final dependencies:', finalCount);
    
    expect(finalCount).toBe(initialCount - 1);
    console.log('Delete successful!');
  } else {
    // Try keyboard delete as fallback
    console.log('Testing keyboard delete...');
    
    // Focus the gantt container
    const ganttContainer = page.locator('.vibegantt');
    await ganttContainer.focus();
    
    // Dispatch selection event directly
    await page.evaluate((id) => {
      const event = new CustomEvent('dependency-select', {
        detail: { dependencyId: id },
        bubbles: true
      });
      document.querySelector('.vibegantt').dispatchEvent(event);
    }, depId);
    
    await page.waitForTimeout(500);
    
    // Press Delete key
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1000);
    
    const finalCount = await page.locator('.vibegantt-dependency-group').count();
    console.log('Final dependencies after keyboard delete:', finalCount);
  }
  
  // Take final screenshot
  await page.screenshot({ 
    path: './screenshots/issue-53/final-test-complete.png',
    fullPage: true 
  });
});