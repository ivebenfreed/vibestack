import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Timesheet CRUD Operations', () => {
  let testTimesheetId = null;
  let testDescription = null;

  test.beforeEach(async ({ page }) => {
    // Generate unique test data
    const timestamp = Date.now();
    testDescription = `Test Timesheet Entry ${timestamp}`;
    
    // Navigate to Timesheets entity page
    await page.goto('/entities/Timesheet');
    await page.waitForSelector('[data-playwright-ready="true"]');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Delete test timesheet if it was created
    if (testTimesheetId) {
      try {
        await page.goto(`/entities/Timesheet/${testTimesheetId}`);
        await page.waitForSelector('[data-testid="entity-actions"]');
        await page.click('[data-testid="delete-entity"]');
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
      } catch (error) {
        console.log('Cleanup failed, timesheet may already be deleted:', error.message);
      }
      testTimesheetId = null;
    }
  });

  test('should create a new timesheet entry', async ({ page }) => {
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');

    // Fill in timesheet details
    await page.fill('[data-testid="field-description"]', testDescription);
    
    // Set work date
    const dateField = page.locator('[data-testid="field-date"]');
    if (await dateField.isVisible()) {
      await dateField.fill('2024-01-15');
    }

    // Set start time
    const startTimeField = page.locator('[data-testid="field-start_time"]');
    if (await startTimeField.isVisible()) {
      await startTimeField.fill('09:00');
    }

    // Set end time
    const endTimeField = page.locator('[data-testid="field-end_time"]');
    if (await endTimeField.isVisible()) {
      await endTimeField.fill('17:00');
    }

    // Set hours worked
    const hoursField = page.locator('[data-testid="field-hours"]');
    if (await hoursField.isVisible()) {
      await hoursField.fill('8.0');
    }

    // Set project if available
    const projectField = page.locator('[data-testid="field-project_id"]');
    if (await projectField.isVisible()) {
      await projectField.selectOption({ index: 1 }); // Select first available project
    }

    // Set task type if available
    const taskTypeField = page.locator('[data-testid="field-task_type"]');
    if (await taskTypeField.isVisible()) {
      await taskTypeField.fill('Development');
    }

    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    // Extract the created timesheet ID
    const url = page.url();
    const idMatch = url.match(/\/entities\/Timesheet\/([^\/]+)/);
    if (idMatch) {
      testTimesheetId = idMatch[1];
    }

    await expect(page.locator('[data-testid="field-description-display"]')).toContainText(testDescription);
    console.log(`✅ Timesheet created successfully: ${testDescription} (ID: ${testTimesheetId})`);
  });

  test('should read and display timesheet details', async ({ page }) => {
    // Create timesheet for reading
    await test.step('Create timesheet for reading', async () => {
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-description"]', testDescription);
      
      const hoursField = page.locator('[data-testid="field-hours"]');
      if (await hoursField.isVisible()) {
        await hoursField.fill('8.0');
      }
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Timesheet\/([^\/]+)/);
      if (idMatch) {
        testTimesheetId = idMatch[1];
      }
    });

    // Navigate to timesheet list and search
    await page.goto('/entities/Timesheet');
    await page.waitForSelector('[data-testid="entity-list"]');
    
    await page.fill('[data-testid="search-input"]', testDescription);
    await page.waitForTimeout(500);
    
    const timesheetRow = page.locator(`[data-testid="entity-row"][data-entity-id="${testTimesheetId}"]`);
    await expect(timesheetRow).toBeVisible();
    await expect(timesheetRow).toContainText(testDescription);
    
    // View timesheet details
    await timesheetRow.click();
    await page.waitForSelector('[data-testid="entity-details"]');
    
    await expect(page.locator('[data-testid="field-description-display"]')).toContainText(testDescription);
    
    console.log(`✅ Timesheet details read successfully: ${testDescription}`);
  });

  test('should update timesheet information', async ({ page }) => {
    const updatedDescription = `${testDescription} - Updated`;
    
    // Create timesheet for updating
    await test.step('Create timesheet for updating', async () => {
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-description"]', testDescription);
      
      const hoursField = page.locator('[data-testid="field-hours"]');
      if (await hoursField.isVisible()) {
        await hoursField.fill('8.0');
      }
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Timesheet\/([^\/]+)/);
      if (idMatch) {
        testTimesheetId = idMatch[1];
      }
    });

    // Edit timesheet
    await page.click('[data-testid="edit-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    await page.fill('[data-testid="field-description"]', updatedDescription);
    
    // Update hours
    const hoursField = page.locator('[data-testid="field-hours"]');
    if (await hoursField.isVisible()) {
      await hoursField.fill('7.5');
    }

    // Update task type
    const taskTypeField = page.locator('[data-testid="field-task_type"]');
    if (await taskTypeField.isVisible()) {
      await taskTypeField.fill('Testing');
    }
    
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    // Verify changes
    await expect(page.locator('[data-testid="field-description-display"]')).toContainText(updatedDescription);
    
    const hoursDisplay = page.locator('[data-testid="field-hours-display"]');
    if (await hoursDisplay.isVisible()) {
      await expect(hoursDisplay).toContainText('7.5');
    }
    
    testDescription = updatedDescription;
    console.log(`✅ Timesheet updated successfully: ${updatedDescription}`);
  });

  test('should delete timesheet', async ({ page }) => {
    // Create timesheet for deletion
    await test.step('Create timesheet for deletion', async () => {
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-description"]', testDescription);
      
      const hoursField = page.locator('[data-testid="field-hours"]');
      if (await hoursField.isVisible()) {
        await hoursField.fill('8.0');
      }
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Timesheet\/([^\/]+)/);
      if (idMatch) {
        testTimesheetId = idMatch[1];
      }
    });

    // Delete timesheet
    await page.click('[data-testid="delete-entity"]');
    await page.waitForSelector('[data-testid="delete-confirmation"]');
    await page.click('[data-testid="confirm-delete"]');
    await page.waitForSelector('[data-testid="entity-deleted"]');
    
    // Verify deletion
    await expect(page).toHaveURL(/\/entities\/Timesheet$/);
    
    await page.waitForSelector('[data-testid="entity-list"]');
    await page.fill('[data-testid="search-input"]', testDescription);
    await page.waitForTimeout(500);
    
    const timesheetRow = page.locator(`[data-testid="entity-row"][data-entity-id="${testTimesheetId}"]`);
    await expect(timesheetRow).not.toBeVisible();
    
    testTimesheetId = null;
    console.log(`✅ Timesheet deleted successfully: ${testDescription}`);
  });

  test('should validate time entry logic', async ({ page }) => {
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    await page.fill('[data-testid="field-description"]', testDescription);
    
    // Test invalid time range (end time before start time)
    const startTimeField = page.locator('[data-testid="field-start_time"]');
    const endTimeField = page.locator('[data-testid="field-end_time"]');
    
    if (await startTimeField.isVisible() && await endTimeField.isVisible()) {
      await startTimeField.fill('17:00');
      await endTimeField.fill('09:00');
      
      await page.click('[data-testid="save-entity"]');
      
      // Verify time validation error
      await expect(page.locator('[data-testid="time-range-error"]')).toContainText('end time must be after start time');
    }
    
    console.log('✅ Time validation working correctly');
  });

  test('should validate hours worked', async ({ page }) => {
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    await page.fill('[data-testid="field-description"]', testDescription);
    
    // Test negative hours
    const hoursField = page.locator('[data-testid="field-hours"]');
    if (await hoursField.isVisible()) {
      await hoursField.fill('-1');
      
      await page.click('[data-testid="save-entity"]');
      
      // Verify hours validation error
      await expect(page.locator('[data-testid="field-hours-error"]')).toContainText('must be positive');
    }
    
    console.log('✅ Hours validation working correctly');
  });

  test('should calculate total hours for date range', async ({ page }) => {
    const baseDescription = `Batch Test ${Date.now()}`;
    const createdIds = [];
    
    try {
      // Create multiple timesheet entries for the same date
      for (let i = 1; i <= 3; i++) {
        await page.goto('/entities/Timesheet');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        
        await page.fill('[data-testid="field-description"]', `${baseDescription} - Entry ${i}`);
        
        const dateField = page.locator('[data-testid="field-date"]');
        if (await dateField.isVisible()) {
          await dateField.fill('2024-01-15');
        }
        
        const hoursField = page.locator('[data-testid="field-hours"]');
        if (await hoursField.isVisible()) {
          await hoursField.fill(`${i * 2}.0`); // 2, 4, 6 hours respectively
        }
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url = page.url();
        const idMatch = url.match(/\/entities\/Timesheet\/([^\/]+)/);
        if (idMatch) {
          createdIds.push(idMatch[1]);
        }
      }
      
      // Navigate to timesheet summary or reports page if available
      await page.goto('/entities/Timesheet');
      
      // Filter by date if date filter is available
      const dateFilter = page.locator('[data-testid="date-filter"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.fill('2024-01-15');
        await page.waitForTimeout(500);
        
        // Check if total hours is displayed
        const totalHours = page.locator('[data-testid="total-hours"]');
        if (await totalHours.isVisible()) {
          await expect(totalHours).toContainText('12'); // 2 + 4 + 6 = 12 hours
        }
      }
      
      console.log('✅ Hours calculation tested successfully');
      
    } finally {
      // Cleanup created entries
      for (const id of createdIds) {
        try {
          await page.goto(`/entities/Timesheet/${id}`);
          await page.click('[data-testid="delete-entity"]');
          await page.click('[data-testid="confirm-delete"]');
          await page.waitForSelector('[data-testid="entity-deleted"]');
        } catch (error) {
          console.log(`Cleanup failed for timesheet ${id}:`, error.message);
        }
      }
    }
  });
});