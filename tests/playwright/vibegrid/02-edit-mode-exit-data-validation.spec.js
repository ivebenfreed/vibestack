/**
 * VibeGrid Pure Observable Testing - Category 2.3-2.4
 * Edit Mode Exit & Data Validation
 * 
 * Testing plan reference: apps/worker/src/components/custom/vibegrid/VIBEGRID_PURE_TESTING_PLAN.md
 * Lines 56-69: Category 2.3-2.4 (Edit Mode Exit & Data Validation)
 * 
 * Current status: Expected failures - these features are not yet implemented
 * Run with: ./scripts/playwright-test.sh tests/playwright/vibegrid/02-edit-mode-exit-data-validation.spec.js
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('VibeGrid Category 2.3-2.4: Edit Mode Exit & Data Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the VibeGrid Pure test page
    await page.goto('http://localhost:4001/debug/test-vibegrid-pure');
    
    // Check if we need to login first
    await page.waitForTimeout(2000); // Wait for potential redirect
    
    const needsLogin = await page.evaluate(() => {
      const path = window.location.pathname;
      return path.includes('/sign-in') || path.includes('/login') || path.includes('/handler');
    });

    if (needsLogin) {
      console.log('📝 Authentication required, logging in...');
      
      // Wait for login form
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
      
      // Fill credentials (Alice CEO)
      await page.fill('input[type="email"], input[name="email"]', 'ceo@widecorp.com');
      await page.fill('input[type="password"], input[name="password"]', 'WideCorp2024!CEO');
      
      // Submit login
      await page.click('button:has-text("Login"), button[type="submit"]');
      
      // Wait for redirect to complete
      await page.waitForFunction(() => {
        const path = window.location.pathname;
        return !path.includes('/sign-in') && !path.includes('/login') && !path.includes('/handler');
      }, { timeout: 30000 });
      
      // Navigate again to our test page
      await page.goto('http://localhost:4001/debug/test-vibegrid-pure');
    }
    
    // Wait for app initialization to complete (loading screen to disappear)
    await page.waitForFunction(() => {
      const bodyText = document.body.textContent || '';
      return !bodyText.includes('Starting...') && !bodyText.includes('Preparing application...');
    }, { timeout: 30000 });
    
    // Wait for the actual test page to load
    await page.waitForSelector('h1:has-text("VibeGridPure Test")', { timeout: 15000 });
    
    // Wait for the VibeGrid to load completely 
    await page.waitForSelector('.vibegridx-container', { timeout: 15000 });
    await page.waitForTimeout(3000); // Additional wait for data loading and rendering
    
    console.log('✅ VibeGrid loaded and ready for testing');
  });

  test.describe('Category 2.3: Edit Mode Exit', () => {
    test('should save changes and move to next cell with Enter key', async ({ page }) => {
      // Click on a cell content to enter edit mode (dual-target system)
      const firstCell = page.locator('[data-row="0"][data-col="title"] .cell-content').first();
      await firstCell.click();
      
      // Verify edit mode is active
      await page.waitForSelector('[data-testid="cell-editor"]', { timeout: 5000 });
      
      // Clear and enter new value
      await page.keyboard.press('Control+a');
      await page.keyboard.type('New Task Title');
      
      // Press Enter to commit and move to next cell
      await page.keyboard.press('Enter');
      
      // EXPECTED FAILURE: Feature not implemented yet
      // Should move to next row in same column (task below)
      const nextRowCell = page.locator('[data-row="1"][data-col="title"]');
      await expect(nextRowCell).toHaveClass(/selected/, { timeout: 2000 });
      
      // Verify the edit was saved
      await expect(page.locator('[data-row="0"][data-col="title"]')).toContainText('New Task Title');
    });

    test('should save changes and move to next cell with Tab', async ({ page }) => {
      // Enter edit mode on a cell
      const priorityCell = page.locator('[data-row="0"][data-col="priority"] .cell-content').first();
      await priorityCell.click();
      
      // Wait for edit mode
      await page.waitForSelector('[data-testid="cell-editor"]', { timeout: 5000 });
      
      // Select a new priority value (dropdown editor)
      await page.selectOption('select[data-testid="cell-editor-select"]', 'High');
      
      // Press Tab to commit and move to next cell
      await page.keyboard.press('Tab');
      
      // EXPECTED FAILURE: Feature not implemented yet
      // Should move to next column in same row
      const nextColCell = page.locator('[data-row="0"][data-col="status"]');
      await expect(nextColCell).toHaveClass(/selected/, { timeout: 2000 });
      
      // Verify the edit was saved
      await expect(page.locator('[data-row="0"][data-col="priority"]')).toContainText('High');
    });

    test('should save changes when clicking outside edit area', async ({ page }) => {
      // Enter edit mode
      const descCell = page.locator('[data-row="1"][data-col="description"] .cell-content').first();
      await descCell.click();
      
      // Wait for edit mode
      await page.waitForSelector('[data-testid="cell-editor"]', { timeout: 5000 });
      
      // Enter new value
      await page.keyboard.press('Control+a');
      await page.keyboard.type('Updated description via click-away');
      
      // Click outside to commit changes
      await page.locator('body').click({ position: { x: 10, y: 10 } });
      
      // EXPECTED FAILURE: Feature not implemented yet
      // Should auto-save on focus loss
      await expect(page.locator('[data-row="1"][data-col="description"]')).toContainText('Updated description via click-away');
      
      // Verify edit mode exited
      await expect(page.locator('[data-testid="cell-editor"]')).not.toBeVisible();
    });

    test('should pre-select text when edit mode starts', async ({ page }) => {
      // Click on a cell with existing text
      const titleCell = page.locator('[data-row="2"][data-col="title"] .cell-content').first();
      await titleCell.click();
      
      // Wait for edit mode
      await page.waitForSelector('[data-testid="cell-editor"] input', { timeout: 5000 });
      
      // EXPECTED FAILURE: Feature not implemented yet
      // Text should be pre-selected for easy replacement
      const selectedText = await page.evaluate(() => {
        const input = document.querySelector('[data-testid="cell-editor"] input');
        return input ? input.value.substring(input.selectionStart, input.selectionEnd) : '';
      });
      
      // The entire text should be selected
      const fullText = await page.inputValue('[data-testid="cell-editor"] input');
      expect(selectedText).toBe(fullText);
    });
  });

  test.describe('Category 2.4: Edit Data Validation', () => {
    test('should validate and edit text fields (title, description)', async ({ page }) => {
      // Test title field editing
      const titleCell = page.locator('[data-row="0"][data-col="title"] .cell-content').first();
      await titleCell.click();
      
      await page.waitForSelector('[data-testid="cell-editor"] input', { timeout: 5000 });
      
      // Clear and enter new title
      await page.keyboard.press('Control+a');
      await page.keyboard.type('Validated Title Change');
      await page.keyboard.press('Escape'); // Cancel to avoid save
      
      // EXPECTED FAILURE: Basic text editing might work, but validation is not implemented
      // Re-enter edit mode to test
      await titleCell.click();
      await page.waitForSelector('[data-testid="cell-editor"] input', { timeout: 5000 });
      
      // Test with empty value (should show validation)
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Delete');
      await page.keyboard.press('Enter');
      
      // Should show validation error for empty title
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible({ timeout: 2000 });
    });

    test('should validate number fields (estimated_hours, actual_hours)', async ({ page }) => {
      // Test estimated hours field
      const hoursCell = page.locator('[data-row="0"][data-col="estimated_hours"] .cell-content').first();
      await hoursCell.click();
      
      await page.waitForSelector('[data-testid="cell-editor"] input', { timeout: 5000 });
      
      // EXPECTED FAILURE: Number validation not implemented
      // Try to enter invalid number
      await page.keyboard.press('Control+a');
      await page.keyboard.type('not-a-number');
      await page.keyboard.press('Enter');
      
      // Should show validation error
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible({ timeout: 2000 });
      
      // Try negative number
      await hoursCell.click();
      await page.waitForSelector('[data-testid="cell-editor"] input', { timeout: 5000 });
      await page.keyboard.press('Control+a');
      await page.keyboard.type('-5');
      await page.keyboard.press('Enter');
      
      // Should show validation error for negative hours
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible({ timeout: 2000 });
    });

    test('should validate date fields (due_date, created_at)', async ({ page }) => {
      // Test due_date field if it exists
      const dueDateCell = page.locator('[data-row="0"][data-col="due_date"] .cell-content').first();
      const cellExists = await dueDateCell.count();
      
      if (cellExists > 0) {
        await dueDateCell.click();
        
        // EXPECTED FAILURE: Date validation not implemented
        // Try invalid date format
        await page.waitForSelector('[data-testid="cell-editor"]', { timeout: 5000 });
        await page.keyboard.type('not-a-date');
        await page.keyboard.press('Enter');
        
        // Should show validation error
        await expect(page.locator('[data-testid="validation-error"]')).toBeVisible({ timeout: 2000 });
      } else {
        console.log('⚠️  due_date column not found, skipping date validation test');
        test.skip();
      }
    });

    test('should validate select/dropdown fields (priority, status, task_type)', async ({ page }) => {
      // Test priority dropdown validation
      const priorityCell = page.locator('[data-row="1"][data-col="priority"] .cell-content').first();
      await priorityCell.click();
      
      await page.waitForSelector('[data-testid="cell-editor-select"]', { timeout: 5000 });
      
      // EXPECTED FAILURE: Advanced dropdown validation not implemented
      // Select a valid option
      await page.selectOption('[data-testid="cell-editor-select"]', 'Critical');
      await page.keyboard.press('Enter');
      
      // Verify selection was applied
      await expect(page.locator('[data-row="1"][data-col="priority"]')).toContainText('Critical');
      
      // Test status field
      const statusCell = page.locator('[data-row="1"][data-col="status"] .cell-content').first();
      await statusCell.click();
      
      await page.waitForSelector('[data-testid="cell-editor-select"]', { timeout: 5000 });
      
      // Select new status
      await page.selectOption('[data-testid="cell-editor-select"]', 'In Progress');
      await page.keyboard.press('Escape'); // Cancel to test cancellation
      
      // Should not have changed (cancelled)
      await expect(page.locator('[data-row="1"][data-col="status"]')).not.toContainText('In Progress');
    });

    test('should show meaningful validation error messages', async ({ page }) => {
      // Test with various invalid inputs to check error messaging
      const titleCell = page.locator('[data-row="0"][data-col="title"] .cell-content').first();
      await titleCell.click();
      
      await page.waitForSelector('[data-testid="cell-editor"] input', { timeout: 5000 });
      
      // EXPECTED FAILURE: Detailed validation messages not implemented
      // Try extremely long title
      const longTitle = 'x'.repeat(1000);
      await page.keyboard.press('Control+a');
      await page.keyboard.type(longTitle);
      await page.keyboard.press('Enter');
      
      // Should show specific error about length
      const errorMessage = page.locator('[data-testid="validation-error"]');
      await expect(errorMessage).toBeVisible({ timeout: 2000 });
      await expect(errorMessage).toContainText(/too long|length|limit/i);
    });
  });

  test.afterEach(async ({ page }) => {
    // Take screenshot on failure for debugging
    if (test.info().status === 'failed') {
      await page.screenshot({ 
        path: `screenshots/vibegrid-edit-validation-failure-${Date.now()}.png`,
        fullPage: true 
      });
    }
  });
});