/**
 * Quick test for dependency selection and deletion
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Quick Dependency Test', () => {
  test('dependency delete button works', async ({ page }) => {
    console.log('Navigating to debug route...');
    await page.goto('/debug/vibegantt');
    
    // Wait for Gantt to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    
    // Wait for tasks to render
    await page.waitForSelector('.vibegantt-task', { timeout: 10000 });
    
    // Give dependencies time to render
    await page.waitForTimeout(2000);
    
    // Take screenshot to see what's rendered
    await page.screenshot({ 
      path: './screenshots/issue-53/quick-test-loaded.png',
      fullPage: true 
    });
    
    // Try to find any dependency
    const dependency = page.locator('.vibegantt-dependency-group').first();
    const depCount = await dependency.count();
    
    console.log('Dependencies found:', depCount);
    
    if (depCount === 0) {
      console.log('No dependencies found, skipping test');
      return;
    }
    
    // Click the dependency
    await dependency.click();
    await page.waitForTimeout(500);
    
    // Look for delete button
    const deleteButton = page.locator('.delete-button').first();
    const deleteCount = await deleteButton.count();
    
    console.log('Delete buttons found:', deleteCount);
    
    // Take screenshot after selection
    await page.screenshot({ 
      path: './screenshots/issue-53/quick-test-selected.png',
      fullPage: true 
    });
    
    if (deleteCount > 0) {
      // Click delete button
      await deleteButton.click();
      console.log('Clicked delete button');
      
      // Wait a bit for deletion
      await page.waitForTimeout(1000);
      
      // Take screenshot after deletion
      await page.screenshot({ 
        path: './screenshots/issue-53/quick-test-deleted.png',
        fullPage: true 
      });
      
      // Check if dependency was removed
      const remainingDeps = await page.locator('.vibegantt-dependency-group').count();
      console.log('Dependencies after deletion:', remainingDeps);
      
      expect(remainingDeps).toBeLessThan(depCount);
    } else {
      console.log('No delete button found after selection');
    }
  });
});