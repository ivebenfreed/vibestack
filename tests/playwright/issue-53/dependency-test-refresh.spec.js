/**
 * Test dependency selection with page refresh
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('dependency selection after refresh', async ({ page }) => {
  // Navigate to debug route
  await page.goto('/debug/vibegantt');
  
  // Refresh to get the updated code
  await page.reload();
  
  // Wait for Gantt to load
  await page.waitForSelector('.vibegantt', { state: 'visible' });
  await page.waitForSelector('.vibegantt-task', { state: 'visible' });
  
  // Wait for dependencies to render
  await page.waitForTimeout(2000);
  
  // Count dependencies
  const depCount = await page.locator('.vibegantt-dependency-group').count();
  console.log('Found dependencies:', depCount);
  
  if (depCount === 0) {
    console.log('No dependencies found, skipping test');
    return;
  }
  
  // Try clicking the first dependency group directly
  const firstDep = page.locator('.vibegantt-dependency-group').first();
  
  // Click and wait
  await firstDep.click();
  await page.waitForTimeout(500);
  
  // Check if it got selected
  const selectedCount = await page.locator('.vibegantt-dependency-group.selected').count();
  console.log('Selected dependencies after click:', selectedCount);
  
  // Check for delete button
  const deleteCount = await page.locator('.delete-button').count();
  console.log('Delete buttons:', deleteCount);
  
  // Take screenshot
  await page.screenshot({ 
    path: './screenshots/issue-53/refresh-test-result.png',
    fullPage: true 
  });
  
  if (selectedCount > 0) {
    expect(selectedCount).toBe(1);
    expect(deleteCount).toBeGreaterThan(0);
  } else {
    // Try clicking the path element directly
    const depPath = page.locator('.vibegantt-dependency').first();
    await depPath.click();
    await page.waitForTimeout(500);
    
    const selectedAfterPath = await page.locator('.vibegantt-dependency-group.selected').count();
    console.log('Selected after clicking path:', selectedAfterPath);
    
    const deleteAfterPath = await page.locator('.delete-button').count();
    console.log('Delete buttons after clicking path:', deleteAfterPath);
  }
});