/**
 * Test suite for dependency selection and deletion in VibeGantt
 * Issue #53: Implement dependency selection and deletion with data persistence
 */

import { test, expect } from '../fixtures/persistent-context.js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to capture console logs
test.beforeEach(async ({ page }) => {
  // Capture console logs
  page.on('console', msg => {
    if (msg.type() === 'log') {
      console.log('Browser console:', msg.text());
    }
  });
  
  // Store console logs for assertions
  await page.evaluate(() => {
    window.consoleLogs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      window.consoleLogs.push(args.join(' '));
      originalLog.apply(console, args);
    };
  });
});

test.describe('Dependency Selection and Deletion', () => {
  test('should select and delete single dependency', async ({ page }) => {
    // Navigate to debug route
    await page.goto('/debug/vibegantt');
    
    // Wait for Gantt to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let data load
    
    // Screenshot initial state
    await page.screenshot({ 
      path: './screenshots/issue-53/deps-initial.png',
      fullPage: true 
    });
    
    // Find first dependency
    const dependency = page.locator('.vibegantt-dependency').first();
    
    // Check if dependency exists
    const depCount = await dependency.count();
    if (depCount === 0) {
      console.log('No dependencies found in the chart, skipping test');
      test.skip();
      return;
    }
    
    // Get dependency ID
    const dependencyId = await dependency.getAttribute('data-dependency-id');
    console.log('Testing with dependency:', dependencyId);
    
    // Click dependency to select it
    await dependency.click();
    
    // Wait for selection visual feedback
    await page.waitForTimeout(500);
    
    // Verify selection in console logs
    const logsAfterSelect = await page.evaluate(() => window.consoleLogs || []);
    const selectLog = logsAfterSelect.find(log => 
      log.includes('Dependency selected:') || 
      log.includes('DEPENDENCY_SELECT')
    );
    expect(selectLog).toBeTruthy();
    
    // Screenshot selected state
    await page.screenshot({ 
      path: './screenshots/issue-53/deps-selected.png',
      fullPage: true 
    });
    
    // Check visual selection state
    const selectedPath = page.locator('.vibegantt-dependency path[stroke-width="2.5"]');
    await expect(selectedPath).toHaveCount(1);
    
    // Press Delete key
    await page.keyboard.press('Delete');
    
    // Wait for deletion
    await page.waitForTimeout(1000);
    
    // Verify deletion in console logs
    const logsAfterDelete = await page.evaluate(() => window.consoleLogs || []);
    const deleteLog = logsAfterDelete.find(log => 
      log.includes('entityDependencyService.deleteUI') ||
      log.includes('Deleted entity dependency') ||
      log.includes('Delete key pressed')
    );
    expect(deleteLog).toBeTruthy();
    
    // Verify dependency is removed from DOM
    await expect(dependency).not.toBeVisible();
    
    // Screenshot after deletion
    await page.screenshot({ 
      path: './screenshots/issue-53/deps-deleted.png',
      fullPage: true 
    });
  });
  
  test('should select multiple dependencies with Ctrl+Click', async ({ page }) => {
    // Navigate to debug route
    await page.goto('/debug/vibegantt');
    
    // Wait for Gantt to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let data load
    
    // Find dependencies
    const dependencies = page.locator('.vibegantt-dependency');
    const depCount = await dependencies.count();
    
    if (depCount < 2) {
      console.log('Not enough dependencies for multi-select test, skipping');
      test.skip();
      return;
    }
    
    // Screenshot initial state
    await page.screenshot({ 
      path: './screenshots/issue-53/deps-multi-initial.png',
      fullPage: true 
    });
    
    // Click first dependency
    const firstDep = dependencies.nth(0);
    await firstDep.click();
    
    // Ctrl+Click second dependency
    const secondDep = dependencies.nth(1);
    await secondDep.click({ modifiers: ['Control'] });
    
    await page.waitForTimeout(500);
    
    // Screenshot multi-selected state
    await page.screenshot({ 
      path: './screenshots/issue-53/deps-multi-selected.png',
      fullPage: true 
    });
    
    // Verify both are selected visually
    const selectedPaths = page.locator('.vibegantt-dependency path[stroke-width="2.5"]');
    await expect(selectedPaths).toHaveCount(2);
    
    // Press Delete key
    await page.keyboard.press('Delete');
    
    // Wait for deletion
    await page.waitForTimeout(1000);
    
    // Verify console shows multiple deletions
    const logs = await page.evaluate(() => window.consoleLogs || []);
    const deleteLogs = logs.filter(log => 
      log.includes('deleteUI') || 
      log.includes('Deleting selected dependencies')
    );
    expect(deleteLogs.length).toBeGreaterThan(0);
    
    // Verify both dependencies are removed
    await expect(firstDep).not.toBeVisible();
    await expect(secondDep).not.toBeVisible();
    
    // Screenshot after deletion
    await page.screenshot({ 
      path: './screenshots/issue-53/deps-multi-deleted.png',
      fullPage: true 
    });
  });
  
  test('should clear selection when clicking empty space', async ({ page }) => {
    // Navigate to debug route
    await page.goto('/debug/vibegantt');
    
    // Wait for Gantt to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Find and click a dependency
    const dependency = page.locator('.vibegantt-dependency').first();
    if (await dependency.count() === 0) {
      test.skip();
      return;
    }
    
    await dependency.click();
    await page.waitForTimeout(500);
    
    // Verify selection
    const selectedPath = page.locator('.vibegantt-dependency path[stroke-width="2.5"]');
    await expect(selectedPath).toHaveCount(1);
    
    // Click empty space in the timeline
    const timeline = page.locator('.vibegantt-timeline');
    const box = await timeline.boundingBox();
    if (box) {
      // Click in the middle of the timeline away from tasks
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    
    await page.waitForTimeout(500);
    
    // Verify selection is cleared
    await expect(selectedPath).toHaveCount(0);
    
    // Screenshot cleared state
    await page.screenshot({ 
      path: './screenshots/issue-53/deps-selection-cleared.png',
      fullPage: true 
    });
  });
  
  test('should show dependency interaction UI elements', async ({ page }) => {
    // Navigate to debug route
    await page.goto('/debug/vibegantt');
    
    // Wait for Gantt to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Find and click a dependency
    const dependency = page.locator('.vibegantt-dependency').first();
    if (await dependency.count() === 0) {
      test.skip();
      return;
    }
    
    await dependency.click();
    await page.waitForTimeout(500);
    
    // Screenshot with UI elements
    await page.screenshot({ 
      path: './screenshots/issue-53/deps-ui-elements.png',
      fullPage: true 
    });
    
    // Check for delete button
    const deleteButton = page.locator('.delete-button').first();
    await expect(deleteButton).toBeVisible();
    
    // Check for connection handles
    const connectionHandles = page.locator('.connection-handle');
    await expect(connectionHandles).toHaveCount(2); // Start and end handles
    
    // Test delete button click
    await deleteButton.click();
    await page.waitForTimeout(1000);
    
    // Verify dependency is deleted
    await expect(dependency).not.toBeVisible();
    
    // Screenshot after button deletion
    await page.screenshot({ 
      path: './screenshots/issue-53/deps-button-deleted.png',
      fullPage: true 
    });
  });
});

// Helper function to create screenshot directory
test.beforeAll(async () => {
  const screenshotDir = path.resolve('./screenshots/issue-53');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
});