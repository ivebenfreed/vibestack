/**
 * Simple test to verify dependency selection
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('simple dependency selection test', async ({ page }) => {
  // Navigate to debug route
  await page.goto('/debug/vibegantt');
  
  // Wait for Gantt to load
  await page.waitForSelector('.vibegantt', { state: 'visible' });
  await page.waitForSelector('.vibegantt-task', { state: 'visible' });
  
  // Wait for dependencies to render
  await page.waitForTimeout(3000);
  
  // Debug: Count dependencies
  const depCount = await page.locator('.vibegantt-dependency-group').count();
  console.log('Found dependencies:', depCount);
  
  // Debug: Check what classes exist
  const firstDepClasses = await page.locator('.vibegantt-dependency-group').first().getAttribute('class');
  console.log('First dependency classes:', firstDepClasses);
  
  // Try clicking the first dependency path directly
  const depPath = page.locator('.vibegantt-dependency').first();
  if (await depPath.count() > 0) {
    const box = await depPath.boundingBox();
    if (box) {
      console.log('Clicking at:', box.x + box.width/2, box.y + box.height/2);
      
      // Click and wait a bit
      await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
      await page.waitForTimeout(1000);
      
      // Check if selected class was added
      const selectedCount = await page.locator('.vibegantt-dependency-group.selected').count();
      console.log('Selected dependencies after click:', selectedCount);
      
      // Check if delete button appeared
      const deleteCount = await page.locator('.delete-button').count();
      console.log('Delete buttons:', deleteCount);
      
      // Take screenshot
      await page.screenshot({ 
        path: './screenshots/issue-53/simple-test-result.png',
        fullPage: true 
      });
      
      // Try clicking delete button if present
      if (deleteCount > 0) {
        const deleteBtn = page.locator('.delete-button circle').first();
        const btnBox = await deleteBtn.boundingBox();
        if (btnBox) {
          console.log('Clicking delete at:', btnBox.x + btnBox.width/2, btnBox.y + btnBox.height/2);
          await page.mouse.click(btnBox.x + btnBox.width/2, btnBox.y + btnBox.height/2);
          await page.waitForTimeout(1000);
          
          const newDepCount = await page.locator('.vibegantt-dependency-group').count();
          console.log('Dependencies after delete:', newDepCount);
        }
      }
    }
  }
});