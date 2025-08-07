/**
 * Manual verification test - takes screenshots for manual review
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Manual Verification', () => {
  test('capture screenshots for manual verification', async ({ page }) => {
    console.log('Navigating to debug route...');
    await page.goto('/debug/vibegantt');
    
    // Wait for Gantt to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForSelector('.vibegantt-task', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: './screenshots/issue-53/manual-1-initial.png',
      fullPage: true 
    });
    
    // Find a dependency path element (the actual line)
    const depPath = page.locator('.vibegantt-dependency').first();
    const pathCount = await depPath.count();
    
    console.log('Dependency paths found:', pathCount);
    
    if (pathCount > 0) {
      // Get the bounding box and click in the middle
      const box = await depPath.boundingBox();
      if (box) {
        console.log('Clicking dependency at:', box.x + box.width/2, box.y + box.height/2);
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        await page.waitForTimeout(1000);
        
        // Take screenshot after selection
        await page.screenshot({ 
          path: './screenshots/issue-53/manual-2-selected.png',
          fullPage: true 
        });
        
        // Check if delete button appeared
        const deleteBtn = page.locator('.delete-button circle');
        const btnCount = await deleteBtn.count();
        console.log('Delete buttons found:', btnCount);
        
        if (btnCount > 0) {
          // Click the delete button circle specifically
          const btnBox = await deleteBtn.first().boundingBox();
          if (btnBox) {
            console.log('Clicking delete button at:', btnBox.x + btnBox.width/2, btnBox.y + btnBox.height/2);
            await page.mouse.click(btnBox.x + btnBox.width/2, btnBox.y + btnBox.height/2);
            await page.waitForTimeout(1000);
            
            // Take screenshot after deletion attempt
            await page.screenshot({ 
              path: './screenshots/issue-53/manual-3-after-delete.png',
              fullPage: true 
            });
          }
        }
      }
    }
    
    console.log('Screenshots saved to ./screenshots/issue-53/manual-*.png');
    console.log('Please review them to verify functionality');
  });
});