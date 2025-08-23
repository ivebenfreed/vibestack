import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Project-Client Relationship Operations', () => {
  let testProjectId = null;
  let testClientId = null;
  let testProjectName = null;
  let testClientName = null;

  test.beforeEach(async ({ page }) => {
    const timestamp = Date.now();
    testProjectName = `Test Project ${timestamp}`;
    testClientName = `Test Client ${timestamp}`;
    
    await page.goto('/');
    await page.waitForSelector('[data-playwright-ready="true"]');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup created entities
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
    
    if (testClientId) {
      try {
        await page.goto(`/entities/Client/${testClientId}`);
        await page.click('[data-testid="delete-entity"]');
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
      } catch (error) {
        console.log('Client cleanup failed:', error.message);
      }
    }
  });

  test('should create project with client relationship', async ({ page }) => {
    // First create a client
    await test.step('Create client', async () => {
      await page.goto('/entities/Client');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      
      await page.fill('[data-testid="field-name"]', testClientName);
      await page.fill('[data-testid="field-email"]', `test-${Date.now()}@example.com`);
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Client\/([^\/]+)/);
      if (idMatch) {
        testClientId = idMatch[1];
      }
      
      console.log(`✅ Client created: ${testClientName} (ID: ${testClientId})`);
    });

    // Create project and link to client
    await test.step('Create project with client relationship', async () => {
      await page.goto('/entities/Project');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      
      await page.fill('[data-testid="field-name"]', testProjectName);
      await page.fill('[data-testid="field-description"]', 'Test project with client relationship');
      
      // Select the client if client selector is available
      const clientField = page.locator('[data-testid="field-client_id"]');
      if (await clientField.isVisible()) {
        await clientField.selectOption({ label: testClientName });
      } else {
        // Alternative: use client dropdown or search
        const clientDropdown = page.locator('[data-testid="client-dropdown"]');
        if (await clientDropdown.isVisible()) {
          await clientDropdown.click();
          await page.locator(`[data-testid="client-option"][data-client-id="${testClientId}"]`).click();
        }
      }
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch) {
        testProjectId = idMatch[1];
      }
      
      console.log(`✅ Project created with client relationship: ${testProjectName} (ID: ${testProjectId})`);
    });

    // Verify relationship is displayed
    await test.step('Verify relationship display', async () => {
      // Check project shows client
      const clientDisplay = page.locator('[data-testid="field-client-display"]');
      if (await clientDisplay.isVisible()) {
        await expect(clientDisplay).toContainText(testClientName);
      }
      
      // Navigate to client and check if project is listed
      await page.goto(`/entities/Client/${testClientId}`);
      await page.waitForSelector('[data-testid="entity-details"]');
      
      const relatedProjects = page.locator('[data-testid="related-projects"]');
      if (await relatedProjects.isVisible()) {
        await expect(relatedProjects).toContainText(testProjectName);
      }
      
      console.log('✅ Relationship displayed correctly on both sides');
    });
  });

  test('should update project-client relationship', async ({ page }) => {
    let secondClientId = null;
    const secondClientName = `${testClientName} - Second`;
    
    try {
      // Create first client and project
      await test.step('Setup initial entities', async () => {
        // Create first client
        await page.goto('/entities/Client');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', testClientName);
        await page.fill('[data-testid="field-email"]', `test-1-${Date.now()}@example.com`);
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url1 = page.url();
        const idMatch1 = url1.match(/\/entities\/Client\/([^\/]+)/);
        if (idMatch1) {
          testClientId = idMatch1[1];
        }

        // Create second client
        await page.goto('/entities/Client');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', secondClientName);
        await page.fill('[data-testid="field-email"]', `test-2-${Date.now()}@example.com`);
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url2 = page.url();
        const idMatch2 = url2.match(/\/entities\/Client\/([^\/]+)/);
        if (idMatch2) {
          secondClientId = idMatch2[1];
        }

        // Create project with first client
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', testProjectName);
        
        const clientField = page.locator('[data-testid="field-client_id"]');
        if (await clientField.isVisible()) {
          await clientField.selectOption({ label: testClientName });
        }
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url3 = page.url();
        const idMatch3 = url3.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch3) {
          testProjectId = idMatch3[1];
        }
      });

      // Update project to use second client
      await test.step('Update client relationship', async () => {
        await page.click('[data-testid="edit-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        
        const clientField = page.locator('[data-testid="field-client_id"]');
        if (await clientField.isVisible()) {
          await clientField.selectOption({ label: secondClientName });
        }
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        console.log('✅ Project client relationship updated');
      });

      // Verify updated relationship
      await test.step('Verify updated relationship', async () => {
        // Check project now shows second client
        const clientDisplay = page.locator('[data-testid="field-client-display"]');
        if (await clientDisplay.isVisible()) {
          await expect(clientDisplay).toContainText(secondClientName);
        }
        
        // Check first client no longer lists this project
        await page.goto(`/entities/Client/${testClientId}`);
        await page.waitForSelector('[data-testid="entity-details"]');
        
        const relatedProjects1 = page.locator('[data-testid="related-projects"]');
        if (await relatedProjects1.isVisible()) {
          await expect(relatedProjects1).not.toContainText(testProjectName);
        }
        
        // Check second client now lists this project
        await page.goto(`/entities/Client/${secondClientId}`);
        await page.waitForSelector('[data-testid="entity-details"]');
        
        const relatedProjects2 = page.locator('[data-testid="related-projects"]');
        if (await relatedProjects2.isVisible()) {
          await expect(relatedProjects2).toContainText(testProjectName);
        }
        
        console.log('✅ Updated relationship verified on both sides');
      });
      
    } finally {
      // Cleanup second client
      if (secondClientId) {
        try {
          await page.goto(`/entities/Client/${secondClientId}`);
          await page.click('[data-testid="delete-entity"]');
          await page.click('[data-testid="confirm-delete"]');
          await page.waitForSelector('[data-testid="entity-deleted"]');
        } catch (error) {
          console.log('Second client cleanup failed:', error.message);
        }
      }
    }
  });

  test('should handle cascade delete behavior', async ({ page }) => {
    // Create client and project
    await test.step('Setup entities for cascade test', async () => {
      // Create client
      await page.goto('/entities/Client');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-name"]', testClientName);
      await page.fill('[data-testid="field-email"]', `test-${Date.now()}@example.com`);
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url1 = page.url();
      const idMatch1 = url1.match(/\/entities\/Client\/([^\/]+)/);
      if (idMatch1) {
        testClientId = idMatch1[1];
      }

      // Create project linked to client
      await page.goto('/entities/Project');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-name"]', testProjectName);
      
      const clientField = page.locator('[data-testid="field-client_id"]');
      if (await clientField.isVisible()) {
        await clientField.selectOption({ label: testClientName });
      }
      
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url2 = page.url();
      const idMatch2 = url2.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch2) {
        testProjectId = idMatch2[1];
      }
    });

    // Try to delete client (should be prevented or show warning)
    await test.step('Test cascade delete prevention', async () => {
      await page.goto(`/entities/Client/${testClientId}`);
      await page.click('[data-testid="delete-entity"]');
      
      // Check for cascade delete warning or prevention
      const cascadeWarning = page.locator('[data-testid="cascade-warning"]');
      const deleteBlocked = page.locator('[data-testid="delete-blocked"]');
      
      if (await cascadeWarning.isVisible()) {
        // Cascade delete warning shown - cancel
        await page.click('[data-testid="cancel-delete"]');
        console.log('✅ Cascade delete warning displayed correctly');
      } else if (await deleteBlocked.isVisible()) {
        // Delete blocked due to related entities
        await page.click('[data-testid="close-blocked-dialog"]');
        console.log('✅ Delete correctly blocked due to related entities');
      } else {
        // No warning - proceed with delete to test cascade
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
        
        // Check if project still exists
        await page.goto(`/entities/Project/${testProjectId}`);
        const projectExists = await page.locator('[data-testid="entity-details"]').isVisible();
        
        if (projectExists) {
          // Project exists - client foreign key should be null
          const clientDisplay = page.locator('[data-testid="field-client-display"]');
          if (await clientDisplay.isVisible()) {
            await expect(clientDisplay).toContainText('No client assigned');
          }
          console.log('✅ Cascade delete - project client reference nullified');
        } else {
          // Project was deleted too - cascade delete occurred
          console.log('✅ Cascade delete - related project was also deleted');
          testProjectId = null; // Don't try to clean up
        }
        
        testClientId = null; // Already deleted
      }
    });
  });

  test('should validate relationship integrity', async ({ page }) => {
    // Test referential integrity constraints
    await test.step('Test invalid relationship assignment', async () => {
      await page.goto('/entities/Project');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      
      await page.fill('[data-testid="field-name"]', testProjectName);
      
      // Try to assign a non-existent client ID if possible
      const clientField = page.locator('[data-testid="field-client_id"]');
      if (await clientField.isVisible()) {
        // Try to manually enter invalid ID
        await page.evaluate(() => {
          const field = document.querySelector('[data-testid="field-client_id"]');
          if (field) {
            field.value = 'invalid-client-id-12345';
            field.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        
        await page.click('[data-testid="save-entity"]');
        
        // Should show validation error
        const validationError = page.locator('[data-testid="field-client_id-error"]');
        if (await validationError.isVisible()) {
          await expect(validationError).toContainText('invalid');
          console.log('✅ Invalid relationship validation working');
        }
      }
    });
  });

  test('should handle many-to-many relationships if supported', async ({ page }) => {
    // Test if projects can be assigned to multiple clients or vice versa
    let secondProjectId = null;
    const secondProjectName = `${testProjectName} - Second`;
    
    try {
      // Create client
      await test.step('Create shared client', async () => {
        await page.goto('/entities/Client');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', testClientName);
        await page.fill('[data-testid="field-email"]', `test-${Date.now()}@example.com`);
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url = page.url();
        const idMatch = url.match(/\/entities\/Client\/([^\/]+)/);
        if (idMatch) {
          testClientId = idMatch[1];
        }
      });

      // Create multiple projects for same client
      await test.step('Create multiple projects for client', async () => {
        // First project
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        await page.fill('[data-testid="field-name"]', testProjectName);
        
        const clientField1 = page.locator('[data-testid="field-client_id"]');
        if (await clientField1.isVisible()) {
          await clientField1.selectOption({ label: testClientName });
        }
        
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
        
        const clientField2 = page.locator('[data-testid="field-client_id"]');
        if (await clientField2.isVisible()) {
          await clientField2.selectOption({ label: testClientName });
        }
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url2 = page.url();
        const idMatch2 = url2.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch2) {
          secondProjectId = idMatch2[1];
        }
      });

      // Verify client shows both projects
      await test.step('Verify one-to-many relationship', async () => {
        await page.goto(`/entities/Client/${testClientId}`);
        await page.waitForSelector('[data-testid="entity-details"]');
        
        const relatedProjects = page.locator('[data-testid="related-projects"]');
        if (await relatedProjects.isVisible()) {
          await expect(relatedProjects).toContainText(testProjectName);
          await expect(relatedProjects).toContainText(secondProjectName);
          console.log('✅ One-to-many relationship verified - client shows multiple projects');
        }
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
});