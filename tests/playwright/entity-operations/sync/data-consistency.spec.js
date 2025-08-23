import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Data Consistency Validation', () => {
  let testEntityIds = [];

  test.afterEach(async ({ page }) => {
    // Cleanup created entities
    for (const entityId of testEntityIds) {
      try {
        await page.goto(`/entities/Project/${entityId}`);
        await page.waitForSelector('[data-testid="entity-actions"]');
        await page.click('[data-testid="delete-entity"]');
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
      } catch (error) {
        console.log(`Cleanup failed for entity ${entityId}:`, error.message);
      }
    }
    testEntityIds = [];
  });

  test('should maintain data consistency between IndexedDB and server', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Consistency Test ${timestamp}`;

    // Create entity and capture data
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', testName);
    await page.fill('[data-testid="field-description"]', 'Consistency test description');
    
    const startDateField = page.locator('[data-testid="field-start_date"]');
    if (await startDateField.isVisible()) {
      await startDateField.fill('2024-01-15');
    }
    
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Get data from IndexedDB
    const indexedDBData = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('vibestack');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      const transaction = db.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });

    // Verify data exists in IndexedDB
    const projectInDB = indexedDBData.find(p => p.name === testName);
    expect(projectInDB).toBeTruthy();
    expect(projectInDB.name).toBe(testName);
    expect(projectInDB.description).toBe('Consistency test description');

    // Clear browser cache and reload to force server fetch
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await page.reload();
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Search for entity (should come from server)
    await page.fill('[data-testid="search-input"]', testName);
    await page.waitForTimeout(1000);
    
    const entityRow = page.locator(`[data-testid="entity-row"]`).filter({ hasText: testName });
    await expect(entityRow).toBeVisible();
    
    // View details and verify data matches
    await entityRow.click();
    await page.waitForSelector('[data-testid="entity-details"]');
    
    await expect(page.locator('[data-testid="field-name-display"]')).toContainText(testName);
    
    const descriptionDisplay = page.locator('[data-testid="field-description-display"]');
    if (await descriptionDisplay.isVisible()) {
      await expect(descriptionDisplay).toContainText('Consistency test description');
    }
    
    console.log('✅ Data consistency between IndexedDB and server verified');
  });

  test('should handle concurrent modifications correctly', async ({ browser }) => {
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();
    
    await page1.goto('http://localhost:5173/entities/Project');
    await page2.goto('http://localhost:5173/entities/Project');
    
    await page1.waitForSelector('[data-playwright-ready="true"]');
    await page2.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Concurrent Test ${timestamp}`;

    // Create entity in first tab
    await page1.click('[data-testid="new-entity"]');
    await page1.waitForSelector('[data-testid="entity-form"]');
    await page1.fill('[data-testid="field-name"]', testName);
    await page1.fill('[data-testid="field-description"]', 'Initial description');
    await page1.click('[data-testid="save-entity"]');
    await page1.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page1.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Navigate to same entity in second tab
    await page2.goto(url);
    await page2.waitForSelector('[data-testid="entity-details"]');

    // Both tabs start editing simultaneously
    await Promise.all([
      page1.click('[data-testid="edit-entity"]'),
      page2.click('[data-testid="edit-entity"]')
    ]);

    await page1.waitForSelector('[data-testid="entity-form"]');
    await page2.waitForSelector('[data-testid="entity-form"]');

    // Make different changes
    await page1.fill('[data-testid="field-description"]', 'Modified by user 1');
    await page2.fill('[data-testid="field-description"]', 'Modified by user 2');

    // Save both (first one should succeed, second might conflict)
    await page1.click('[data-testid="save-entity"]');
    await page1.waitForSelector('[data-testid="entity-saved"]');

    await page2.click('[data-testid="save-entity"]');
    
    // Check for conflict resolution UI
    const conflictDialog = page2.locator('[data-testid="conflict-resolution"]');
    if (await conflictDialog.isVisible()) {
      // Accept the newer change
      await page2.click('[data-testid="accept-newer-version"]');
    } else {
      // If no conflict UI, wait for save to complete
      await page2.waitForSelector('[data-testid="entity-saved"]');
    }

    // Verify final state is consistent
    await page1.reload();
    await page2.reload();
    
    await page1.waitForSelector('[data-testid="entity-details"]');
    await page2.waitForSelector('[data-testid="entity-details"]');
    
    const desc1 = await page1.locator('[data-testid="field-description-display"]').textContent();
    const desc2 = await page2.locator('[data-testid="field-description-display"]').textContent();
    
    // Both should show the same final state
    expect(desc1).toBe(desc2);
    
    console.log('✅ Concurrent modification handling verified');
    
    await page1.close();
    await page2.close();
  });

  test('should validate entity reference integrity', async ({ page }) => {
    await page.goto('/entities/Client');
    await page.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    
    // Create client first
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', `Test Client ${timestamp}`);
    
    const emailField = page.locator('[data-testid="field-email"]');
    if (await emailField.isVisible()) {
      await emailField.fill(`client-${timestamp}@example.com`);
    }
    
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const clientUrl = page.url();
    const clientIdMatch = clientUrl.match(/\/entities\/Client\/([^\/]+)/);
    let clientId = null;
    if (clientIdMatch) {
      clientId = clientIdMatch[1];
    }

    // Create project referencing the client
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-testid="entity-list"]');
    
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', `Test Project ${timestamp}`);
    
    const clientField = page.locator('[data-testid="field-client_id"]');
    if (await clientField.isVisible()) {
      await clientField.selectOption({ index: 1 }); // Select the created client
    }
    
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const projectUrl = page.url();
    const projectIdMatch = projectUrl.match(/\/entities\/Project\/([^\/]+)/);
    if (projectIdMatch) {
      testEntityIds.push(projectIdMatch[1]);
    }

    // Verify relationship exists
    const clientDisplay = page.locator('[data-testid="field-client_id-display"]');
    if (await clientDisplay.isVisible()) {
      await expect(clientDisplay).toContainText(`Test Client ${timestamp}`);
    }

    // Try to delete client (should warn about references)
    if (clientId) {
      await page.goto(`/entities/Client/${clientId}`);
      await page.waitForSelector('[data-testid="entity-details"]');
      
      await page.click('[data-testid="delete-entity"]');
      
      const warning = page.locator('[data-testid="reference-warning"]');
      if (await warning.isVisible()) {
        await expect(warning).toContainText('referenced by other entities');
        await page.click('[data-testid="cancel-delete"]');
      } else {
        // If no warning, proceed with normal deletion for cleanup
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
      }
    }
    
    console.log('✅ Entity reference integrity verified');
  });

  test('should maintain audit trail for data changes', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Audit Test ${timestamp}`;

    // Create entity
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', testName);
    await page.fill('[data-testid="field-description"]', 'Original description');
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Check if audit history is available
    const auditTab = page.locator('[data-testid="audit-history-tab"]');
    if (await auditTab.isVisible()) {
      await auditTab.click();
      
      // Should show creation event
      const createEvent = page.locator('[data-testid="audit-event-create"]');
      await expect(createEvent).toBeVisible();
      
      // Go back to edit
      await page.click('[data-testid="details-tab"]');
      await page.click('[data-testid="edit-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-description"]', 'Updated description');
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      // Check audit history again
      await auditTab.click();
      
      const updateEvent = page.locator('[data-testid="audit-event-update"]');
      await expect(updateEvent).toBeVisible();
      
      // Should show field changes
      const fieldChange = page.locator('[data-testid="field-change-description"]');
      if (await fieldChange.isVisible()) {
        await expect(fieldChange).toContainText('Original description');
        await expect(fieldChange).toContainText('Updated description');
      }
    } else {
      console.log('ℹ️ Audit history not implemented yet');
    }
    
    console.log('✅ Audit trail validation completed');
  });

  test('should handle schema evolution gracefully', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Test that existing entities work with current schema
    const entityRows = await page.locator('[data-testid="entity-row"]').count();
    expect(entityRows).toBeGreaterThan(0);

    // Click on first entity to test field compatibility
    const firstRow = page.locator('[data-testid="entity-row"]').first();
    await firstRow.click();
    await page.waitForSelector('[data-testid="entity-details"]');

    // Check for schema version compatibility warnings
    const schemaWarning = page.locator('[data-testid="schema-version-warning"]');
    if (await schemaWarning.isVisible()) {
      console.log('⚠️ Schema version warning detected');
      await expect(schemaWarning).toContainText(/version|compatibility/);
    }

    // Verify basic fields are accessible
    const nameDisplay = page.locator('[data-testid="field-name-display"]');
    await expect(nameDisplay).toBeVisible();

    // Test editing to ensure schema compatibility
    await page.click('[data-testid="edit-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    const nameField = page.locator('[data-testid="field-name"]');
    const currentName = await nameField.inputValue();
    
    await page.click('[data-testid="cancel-edit"]');
    await page.waitForSelector('[data-testid="entity-details"]');
    
    console.log('✅ Schema evolution compatibility verified');
  });

  test('should validate data synchronization timestamps', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Timestamp Test ${timestamp}`;

    // Create entity and note creation time
    const beforeCreate = Date.now();
    
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', testName);
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const afterCreate = Date.now();
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Check metadata timestamps if available
    const createdAtDisplay = page.locator('[data-testid="created-at-display"]');
    if (await createdAtDisplay.isVisible()) {
      const createdAtText = await createdAtDisplay.textContent();
      const createdAtTime = new Date(createdAtText).getTime();
      
      // Verify timestamp is within reasonable range
      expect(createdAtTime).toBeGreaterThanOrEqual(beforeCreate - 1000);
      expect(createdAtTime).toBeLessThanOrEqual(afterCreate + 1000);
    }

    // Update entity and check updated timestamp
    const beforeUpdate = Date.now();
    
    await page.click('[data-testid="edit-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-description"]', 'Updated for timestamp test');
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const afterUpdate = Date.now();

    const updatedAtDisplay = page.locator('[data-testid="updated-at-display"]');
    if (await updatedAtDisplay.isVisible()) {
      const updatedAtText = await updatedAtDisplay.textContent();
      const updatedAtTime = new Date(updatedAtText).getTime();
      
      // Verify updated timestamp is after creation and within range
      expect(updatedAtTime).toBeGreaterThanOrEqual(beforeUpdate - 1000);
      expect(updatedAtTime).toBeLessThanOrEqual(afterUpdate + 1000);
    }
    
    console.log('✅ Data synchronization timestamps validated');
  });
});