import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Project CRUD Operations', () => {
  let testProjectId = null;
  let testProjectName = null;

  test.beforeEach(async ({ page }) => {
    // Generate unique test data
    const timestamp = Date.now();
    testProjectName = `Test Project ${timestamp}`;
    
    // Navigate to Projects entity page
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Delete test project if it was created
    if (testProjectId) {
      try {
        // Navigate to project and delete it
        await page.goto(`/entities/Project/${testProjectId}`);
        await page.waitForSelector('[data-testid="entity-actions"]');
        await page.click('[data-testid="delete-entity"]');
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
      } catch (error) {
        console.log('Cleanup failed, project may already be deleted:', error.message);
      }
      testProjectId = null;
    }
  });

  test('should create a new project', async ({ page }) => {
    // Click "New Entity" button
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');

    // Fill in project details
    await page.fill('[data-testid="field-name"]', testProjectName);
    await page.fill('[data-testid="field-description"]', 'Automated test project description');
    
    // Set project dates if available
    const startDateField = page.locator('[data-testid="field-start_date"]');
    if (await startDateField.isVisible()) {
      await startDateField.fill('2024-01-01');
    }

    // Save the project
    await page.click('[data-testid="save-entity"]');
    
    // Wait for success notification
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    // Extract the created project ID from URL or data attribute
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testProjectId = idMatch[1];
    }

    // Verify project was created and displayed
    await expect(page.locator('[data-testid="entity-title"]')).toContainText(testProjectName);
    
    console.log(`✅ Project created successfully: ${testProjectName} (ID: ${testProjectId})`);
  });

  test('should read and display project details', async ({ page }) => {
    // First create a project to read
    await test.step('Create project for reading', async () => {
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-name"]', testProjectName);
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch) {
        testProjectId = idMatch[1];
      }
    });

    // Navigate to project list and find our project
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-testid="entity-list"]');
    
    // Search for our project
    await page.fill('[data-testid="search-input"]', testProjectName);
    await page.waitForTimeout(500); // Wait for search to filter
    
    // Verify project appears in list
    const projectRow = page.locator(`[data-testid="entity-row"][data-entity-id="${testProjectId}"]`);
    await expect(projectRow).toBeVisible();
    await expect(projectRow).toContainText(testProjectName);
    
    // Click to view project details
    await projectRow.click();
    await page.waitForSelector('[data-testid="entity-details"]');
    
    // Verify all project details are displayed
    await expect(page.locator('[data-testid="entity-title"]')).toContainText(testProjectName);
    await expect(page.locator('[data-testid="field-name-display"]')).toContainText(testProjectName);
    
    console.log(`✅ Project details read successfully: ${testProjectName}`);
  });

  test('should update project information', async ({ page }) => {
    const updatedName = `${testProjectName} - Updated`;
    
    // First create a project to update
    await test.step('Create project for updating', async () => {
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-name"]', testProjectName);
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch) {
        testProjectId = idMatch[1];
      }
    });

    // Enter edit mode
    await page.click('[data-testid="edit-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    // Update project fields
    await page.fill('[data-testid="field-name"]', updatedName);
    await page.fill('[data-testid="field-description"]', 'Updated description for automated test');
    
    // Save changes
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    // Verify changes were saved
    await expect(page.locator('[data-testid="entity-title"]')).toContainText(updatedName);
    await expect(page.locator('[data-testid="field-name-display"]')).toContainText(updatedName);
    
    // Update testProjectName for cleanup
    testProjectName = updatedName;
    
    console.log(`✅ Project updated successfully: ${updatedName}`);
  });

  test('should delete project', async ({ page }) => {
    // First create a project to delete
    await test.step('Create project for deletion', async () => {
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-name"]', testProjectName);
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch) {
        testProjectId = idMatch[1];
      }
    });

    // Delete the project
    await page.click('[data-testid="delete-entity"]');
    
    // Confirm deletion in modal
    await page.waitForSelector('[data-testid="delete-confirmation"]');
    await page.click('[data-testid="confirm-delete"]');
    
    // Wait for deletion to complete
    await page.waitForSelector('[data-testid="entity-deleted"]');
    
    // Verify we're redirected to project list
    await expect(page).toHaveURL(/\/entities\/Project$/);
    
    // Verify project no longer exists in list
    await page.waitForSelector('[data-testid="entity-list"]');
    await page.fill('[data-testid="search-input"]', testProjectName);
    await page.waitForTimeout(500);
    
    const projectRow = page.locator(`[data-testid="entity-row"][data-entity-id="${testProjectId}"]`);
    await expect(projectRow).not.toBeVisible();
    
    // Clear testProjectId since it's been deleted
    testProjectId = null;
    
    console.log(`✅ Project deleted successfully: ${testProjectName}`);
  });

  test('should validate required fields', async ({ page }) => {
    // Try to create project without required fields
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    // Attempt to save without filling required fields
    await page.click('[data-testid="save-entity"]');
    
    // Verify validation errors appear
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-name-error"]')).toContainText('required');
    
    console.log('✅ Required field validation working correctly');
  });

  test('should handle concurrent edits', async ({ page, browser }) => {
    // This test simulates two users editing the same project
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    try {
      // First create a project
      await test.step('Create project for concurrent edit test', async () => {
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', testProjectName);
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url = page.url();
        const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch) {
          testProjectId = idMatch[1];
        }
      });

      // Both users navigate to the same project
      const projectUrl = `/entities/Project/${testProjectId}`;
      await page2.goto(projectUrl);
      await page2.waitForSelector('[data-testid="entity-details"]');
      
      // User 1 starts editing
      await page.click('[data-testid="edit-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      
      // User 2 also starts editing
      await page2.click('[data-testid="edit-entity"]');
      await page2.waitForSelector('[data-testid="entity-form"]');
      
      // User 1 makes changes and saves
      await page.fill('[data-testid="field-name"]', `${testProjectName} - User 1 Edit`);
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      // User 2 makes different changes and tries to save
      await page2.fill('[data-testid="field-name"]', `${testProjectName} - User 2 Edit`);
      await page2.click('[data-testid="save-entity"]');
      
      // Verify conflict detection (implementation dependent)
      // This might show a conflict resolution dialog or error message
      const hasConflictDialog = await page2.locator('[data-testid="conflict-dialog"]').isVisible();
      const hasConflictError = await page2.locator('[data-testid="conflict-error"]').isVisible();
      
      expect(hasConflictDialog || hasConflictError).toBe(true);
      
      console.log('✅ Concurrent edit handling tested');
      
    } finally {
      await context2.close();
    }
  });
});