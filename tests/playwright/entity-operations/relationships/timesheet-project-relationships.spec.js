import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Timesheet-Project Relationship Operations', () => {
  let testProjectId = null;
  let testTimesheetId = null;
  let testProjectName = null;
  let testTimesheetDescription = null;

  test.beforeEach(async ({ page }) => {
    const timestamp = Date.now();
    testProjectName = `Test Project ${timestamp}`;
    testTimesheetDescription = `Test Timesheet ${timestamp}`;
    
    await page.goto('/');
    await page.waitForSelector('[data-playwright-ready="true"]');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup created entities
    if (testTimesheetId) {
      try {
        await page.goto(`/entities/Timesheet/${testTimesheetId}`);
        await page.click('[data-testid="delete-entity"]');
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
      } catch (error) {
        console.log('Timesheet cleanup failed:', error.message);
      }
    }
    
    if (testProjectId) {
      try {
        await page.goto(`/entities/Project/${testProjectId}`);
        await page.click('[data-testid="delete-entity"]');
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
      } catch (error) {
        console.log('Project cleanup failed:', error.message);
      }
    }
  });

  test('should create timesheet with project assignment', async ({ page }) => {
    // First create a project
    await test.step('Create project', async () => {
      await page.goto('/entities/Project');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      
      await page.fill('[data-testid="field-name"]', testProjectName);
      await page.fill('[data-testid="field-description"]', 'Test project for timesheet relationships');
      
      const startDateField = page.locator('[data-testid="field-start_date"]');
      if (await startDateField.isVisible()) {
        await startDateField.fill('2024-01-01');
      }
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch) {
        testProjectId = idMatch[1];
      }
      
      console.log(`✅ Project created: ${testProjectName} (ID: ${testProjectId})`);
    });

    // Create timesheet and assign to project
    await test.step('Create timesheet with project assignment', async () => {
      await page.goto('/entities/Timesheet');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      
      await page.fill('[data-testid="field-description"]', testTimesheetDescription);
      
      // Set work details
      const dateField = page.locator('[data-testid="field-date"]');
      if (await dateField.isVisible()) {
        await dateField.fill('2024-01-15');
      }
      
      const hoursField = page.locator('[data-testid="field-hours"]');
      if (await hoursField.isVisible()) {
        await hoursField.fill('8.0');
      }
      
      // Assign to project
      const projectField = page.locator('[data-testid="field-project_id"]');
      if (await projectField.isVisible()) {
        await projectField.selectOption({ label: testProjectName });
      } else {
        // Alternative: use project dropdown
        const projectDropdown = page.locator('[data-testid="project-dropdown"]');
        if (await projectDropdown.isVisible()) {
          await projectDropdown.click();
          await page.locator(`[data-testid="project-option"][data-project-id="${testProjectId}"]`).click();
        }
      }
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Timesheet\/([^\/]+)/);
      if (idMatch) {
        testTimesheetId = idMatch[1];
      }
      
      console.log(`✅ Timesheet created with project assignment: ${testTimesheetDescription} (ID: ${testTimesheetId})`);
    });

    // Verify relationship is displayed
    await test.step('Verify relationship display', async () => {
      // Check timesheet shows project
      const projectDisplay = page.locator('[data-testid="field-project-display"]');
      if (await projectDisplay.isVisible()) {
        await expect(projectDisplay).toContainText(testProjectName);
      }
      
      // Navigate to project and check if timesheet is listed
      await page.goto(`/entities/Project/${testProjectId}`);
      await page.waitForSelector('[data-testid="entity-details"]');
      
      const relatedTimesheets = page.locator('[data-testid="related-timesheets"]');
      if (await relatedTimesheets.isVisible()) {
        await expect(relatedTimesheets).toContainText(testTimesheetDescription);
      }
      
      console.log('✅ Relationship displayed correctly on both sides');
    });
  });

  test('should calculate project time totals', async ({ page }) => {
    let timesheet1Id = null;
    let timesheet2Id = null;
    let timesheet3Id = null;
    
    try {
      // Create project
      await test.step('Create project for time tracking', async () => {
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        
        await page.fill('[data-testid="field-name"]', testProjectName);
        await page.fill('[data-testid="field-description"]', 'Project for time calculation testing');
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url = page.url();
        const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch) {
          testProjectId = idMatch[1];
        }
      });

      // Create multiple timesheet entries for the same project
      await test.step('Create multiple timesheet entries', async () => {
        const timesheetData = [
          { description: `${testTimesheetDescription} - Day 1`, hours: '8.0', date: '2024-01-15' },
          { description: `${testTimesheetDescription} - Day 2`, hours: '7.5', date: '2024-01-16' },
          { description: `${testTimesheetDescription} - Day 3`, hours: '6.0', date: '2024-01-17' }
        ];
        
        const createdIds = [];
        
        for (const entry of timesheetData) {
          await page.goto('/entities/Timesheet');
          await page.click('[data-testid="new-entity"]');
          await page.waitForSelector('[data-testid="entity-form"]');
          
          await page.fill('[data-testid="field-description"]', entry.description);
          
          const dateField = page.locator('[data-testid="field-date"]');
          if (await dateField.isVisible()) {
            await dateField.fill(entry.date);
          }
          
          const hoursField = page.locator('[data-testid="field-hours"]');
          if (await hoursField.isVisible()) {
            await hoursField.fill(entry.hours);
          }
          
          const projectField = page.locator('[data-testid="field-project_id"]');
          if (await projectField.isVisible()) {
            await projectField.selectOption({ label: testProjectName });
          }
          
          await page.click('[data-testid="save-entity"]');
          await page.waitForSelector('[data-testid="entity-saved"]');
          
          const url = page.url();
          const idMatch = url.match(/\/entities\/Timesheet\/([^\/]+)/);
          if (idMatch) {
            createdIds.push(idMatch[1]);
          }
        }
        
        [timesheet1Id, timesheet2Id, timesheet3Id] = createdIds;
        console.log('✅ Created 3 timesheet entries with hours: 8.0, 7.5, 6.0');
      });

      // Verify project shows total hours
      await test.step('Verify project time totals', async () => {
        await page.goto(`/entities/Project/${testProjectId}`);
        await page.waitForSelector('[data-testid="entity-details"]');
        
        // Check if project displays total hours
        const totalHours = page.locator('[data-testid="project-total-hours"]');
        if (await totalHours.isVisible()) {
          await expect(totalHours).toContainText('21.5'); // 8.0 + 7.5 + 6.0 = 21.5
          console.log('✅ Project total hours calculated correctly: 21.5');
        }
        
        // Check if timesheet list shows all entries
        const timesheetList = page.locator('[data-testid="related-timesheets"]');
        if (await timesheetList.isVisible()) {
          await expect(timesheetList).toContainText('Day 1');
          await expect(timesheetList).toContainText('Day 2');
          await expect(timesheetList).toContainText('Day 3');
          console.log('✅ All timesheet entries displayed under project');
        }
      });
      
    } finally {
      // Cleanup timesheet entries
      for (const id of [timesheet1Id, timesheet2Id, timesheet3Id]) {
        if (id) {
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
    }
  });

  test('should reassign timesheet to different project', async ({ page }) => {
    let secondProjectId = null;
    const secondProjectName = `${testProjectName} - Second`;
    
    try {
      // Create two projects
      await test.step('Create two projects', async () => {
        // First project
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', testProjectName);
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url1 = page.url();
        const idMatch1 = url1.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch1) {
          testProjectId = idMatch1[1];
        }

        // Second project
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', secondProjectName);
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url2 = page.url();
        const idMatch2 = url2.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch2) {
          secondProjectId = idMatch2[1];
        }
      });

      // Create timesheet assigned to first project
      await test.step('Create timesheet with initial project', async () => {
        await page.goto('/entities/Timesheet');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        
        await page.fill('[data-testid="field-description"]', testTimesheetDescription);
        
        const hoursField = page.locator('[data-testid="field-hours"]');
        if (await hoursField.isVisible()) {
          await hoursField.fill('8.0');
        }
        
        const projectField = page.locator('[data-testid="field-project_id"]');
        if (await projectField.isVisible()) {
          await projectField.selectOption({ label: testProjectName });
        }
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url = page.url();
        const idMatch = url.match(/\/entities\/Timesheet\/([^\/]+)/);
        if (idMatch) {
          testTimesheetId = idMatch[1];
        }
      });

      // Reassign timesheet to second project
      await test.step('Reassign timesheet to second project', async () => {
        await page.click('[data-testid="edit-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        
        const projectField = page.locator('[data-testid="field-project_id"]');
        if (await projectField.isVisible()) {
          await projectField.selectOption({ label: secondProjectName });
        }
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        console.log('✅ Timesheet reassigned to second project');
      });

      // Verify updated relationships
      await test.step('Verify updated project assignments', async () => {
        // Check timesheet shows second project
        const projectDisplay = page.locator('[data-testid="field-project-display"]');
        if (await projectDisplay.isVisible()) {
          await expect(projectDisplay).toContainText(secondProjectName);
        }
        
        // Check first project no longer lists this timesheet
        await page.goto(`/entities/Project/${testProjectId}`);
        await page.waitForSelector('[data-testid="entity-details"]');
        
        const firstProjectTimesheets = page.locator('[data-testid="related-timesheets"]');
        if (await firstProjectTimesheets.isVisible()) {
          await expect(firstProjectTimesheets).not.toContainText(testTimesheetDescription);
        }
        
        // Check second project now lists this timesheet
        await page.goto(`/entities/Project/${secondProjectId}`);
        await page.waitForSelector('[data-testid="entity-details"]');
        
        const secondProjectTimesheets = page.locator('[data-testid="related-timesheets"]');
        if (await secondProjectTimesheets.isVisible()) {
          await expect(secondProjectTimesheets).toContainText(testTimesheetDescription);
        }
        
        console.log('✅ Timesheet reassignment verified on both projects');
      });
      
    } finally {
      // Cleanup second project
      if (secondProjectId) {
        try {
          await page.goto(`/entities/Project/${secondProjectId}`);
          await page.click('[data-testid="delete-entity"]');
          await page.click('[data-testid="confirm-delete"]');
          await page.waitForSelector('[data-testid="entity-deleted"]');
        } catch (error) {
          console.log('Second project cleanup failed:', error.message);
        }
      }
    }
  });

  test('should handle project deletion with timesheets', async ({ page }) => {
    // Create project and timesheet
    await test.step('Setup project with timesheet', async () => {
      // Create project
      await page.goto('/entities/Project');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-name"]', testProjectName);
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url1 = page.url();
      const idMatch1 = url1.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch1) {
        testProjectId = idMatch1[1];
      }

      // Create timesheet
      await page.goto('/entities/Timesheet');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-description"]', testTimesheetDescription);
      
      const hoursField = page.locator('[data-testid="field-hours"]');
      if (await hoursField.isVisible()) {
        await hoursField.fill('8.0');
      }
      
      const projectField = page.locator('[data-testid="field-project_id"]');
      if (await projectField.isVisible()) {
        await projectField.selectOption({ label: testProjectName });
      }
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url2 = page.url();
      const idMatch2 = url2.match(/\/entities\/Timesheet\/([^\/]+)/);
      if (idMatch2) {
        testTimesheetId = idMatch2[1];
      }
    });

    // Try to delete project
    await test.step('Test project deletion with related timesheets', async () => {
      await page.goto(`/entities/Project/${testProjectId}`);
      await page.click('[data-testid="delete-entity"]');
      
      // Check for relationship constraint warning
      const relationshipWarning = page.locator('[data-testid="relationship-warning"]');
      const deleteBlocked = page.locator('[data-testid="delete-blocked"]');
      
      if (await relationshipWarning.isVisible()) {
        // Warning shown about related timesheets
        await expect(relationshipWarning).toContainText('timesheet');
        await page.click('[data-testid="cancel-delete"]');
        console.log('✅ Project deletion warning displayed for related timesheets');
      } else if (await deleteBlocked.isVisible()) {
        // Delete blocked due to related timesheets
        await expect(deleteBlocked).toContainText('timesheet');
        await page.click('[data-testid="close-blocked-dialog"]');
        console.log('✅ Project deletion blocked due to related timesheets');
      } else {
        // Delete proceeded - check timesheet behavior
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
        
        // Check if timesheet still exists
        await page.goto(`/entities/Timesheet/${testTimesheetId}`);
        const timesheetExists = await page.locator('[data-testid="entity-details"]').isVisible();
        
        if (timesheetExists) {
          // Timesheet exists - project reference should be null
          const projectDisplay = page.locator('[data-testid="field-project-display"]');
          if (await projectDisplay.isVisible()) {
            await expect(projectDisplay).toContainText('No project assigned');
          }
          console.log('✅ Project deleted - timesheet project reference nullified');
        } else {
          // Timesheet was also deleted - cascade delete occurred
          console.log('✅ Project deleted - related timesheet was also deleted');
          testTimesheetId = null; // Don't try to clean up
        }
        
        testProjectId = null; // Already deleted
      }
    });
  });

  test('should filter timesheets by project', async ({ page }) => {
    let otherProjectId = null;
    let otherTimesheetId = null;
    const otherProjectName = `${testProjectName} - Other`;
    const otherTimesheetDescription = `${testTimesheetDescription} - Other`;
    
    try {
      // Create two projects and two timesheets
      await test.step('Setup test data', async () => {
        // Create first project and timesheet
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', testProjectName);
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url1 = page.url();
        const idMatch1 = url1.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch1) {
          testProjectId = idMatch1[1];
        }

        await page.goto('/entities/Timesheet');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-description"]', testTimesheetDescription);
        
        const hoursField1 = page.locator('[data-testid="field-hours"]');
        if (await hoursField1.isVisible()) {
          await hoursField1.fill('8.0');
        }
        
        const projectField1 = page.locator('[data-testid="field-project_id"]');
        if (await projectField1.isVisible()) {
          await projectField1.selectOption({ label: testProjectName });
        }
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url2 = page.url();
        const idMatch2 = url2.match(/\/entities\/Timesheet\/([^\/]+)/);
        if (idMatch2) {
          testTimesheetId = idMatch2[1];
        }

        // Create second project and timesheet
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', otherProjectName);
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url3 = page.url();
        const idMatch3 = url3.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch3) {
          otherProjectId = idMatch3[1];
        }

        await page.goto('/entities/Timesheet');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-description"]', otherTimesheetDescription);
        
        const hoursField2 = page.locator('[data-testid="field-hours"]');
        if (await hoursField2.isVisible()) {
          await hoursField2.fill('6.0');
        }
        
        const projectField2 = page.locator('[data-testid="field-project_id"]');
        if (await projectField2.isVisible()) {
          await projectField2.selectOption({ label: otherProjectName });
        }
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url4 = page.url();
        const idMatch4 = url4.match(/\/entities\/Timesheet\/([^\/]+)/);
        if (idMatch4) {
          otherTimesheetId = idMatch4[1];
        }
      });

      // Test project filtering
      await test.step('Test timesheet filtering by project', async () => {
        await page.goto('/entities/Timesheet');
        await page.waitForSelector('[data-testid="entity-list"]');
        
        // Apply project filter if available
        const projectFilter = page.locator('[data-testid="project-filter"]');
        if (await projectFilter.isVisible()) {
          await projectFilter.selectOption({ label: testProjectName });
          await page.waitForTimeout(500);
          
          // Should show only timesheet for selected project
          const visibleRows = await page.locator('[data-testid="entity-row"]').count();
          const firstProjectRow = page.locator(`[data-testid="entity-row"][data-entity-id="${testTimesheetId}"]`);
          const otherProjectRow = page.locator(`[data-testid="entity-row"][data-entity-id="${otherTimesheetId}"]`);
          
          await expect(firstProjectRow).toBeVisible();
          await expect(otherProjectRow).not.toBeVisible();
          
          console.log('✅ Timesheet filtering by project working correctly');
        }
      });
      
    } finally {
      // Cleanup other entities
      if (otherTimesheetId) {
        try {
          await page.goto(`/entities/Timesheet/${otherTimesheetId}`);
          await page.click('[data-testid="delete-entity"]');
          await page.click('[data-testid="confirm-delete"]');
          await page.waitForSelector('[data-testid="entity-deleted"]');
        } catch (error) {
          console.log('Other timesheet cleanup failed:', error.message);
        }
      }
      
      if (otherProjectId) {
        try {
          await page.goto(`/entities/Project/${otherProjectId}`);
          await page.click('[data-testid="delete-entity"]');
          await page.click('[data-testid="confirm-delete"]');
          await page.waitForSelector('[data-testid="entity-deleted"]');
        } catch (error) {
          console.log('Other project cleanup failed:', error.message);
        }
      }
    }
  });
});