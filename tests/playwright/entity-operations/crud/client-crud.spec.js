import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Client CRUD Operations', () => {
  let testClientId = null;
  let testClientName = null;

  test.beforeEach(async ({ page }) => {
    // Generate unique test data
    const timestamp = Date.now();
    testClientName = `Test Client ${timestamp}`;
    
    // Navigate to Clients entity page
    await page.goto('/entities/Client');
    await page.waitForSelector('[data-playwright-ready="true"]');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Delete test client if it was created
    if (testClientId) {
      try {
        await page.goto(`/entities/Client/${testClientId}`);
        await page.waitForSelector('[data-testid="entity-actions"]');
        await page.click('[data-testid="delete-entity"]');
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]');
      } catch (error) {
        console.log('Cleanup failed, client may already be deleted:', error.message);
      }
      testClientId = null;
    }
  });

  test('should create a new client', async ({ page }) => {
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');

    // Fill in client details
    await page.fill('[data-testid="field-name"]', testClientName);
    await page.fill('[data-testid="field-email"]', `test-${Date.now()}@example.com`);
    await page.fill('[data-testid="field-phone"]', '+1-555-0123');
    
    // Fill company information if available
    const companyField = page.locator('[data-testid="field-company"]');
    if (await companyField.isVisible()) {
      await companyField.fill('Test Company Inc.');
    }

    // Fill address if available
    const addressField = page.locator('[data-testid="field-address"]');
    if (await addressField.isVisible()) {
      await addressField.fill('123 Test Street, Test City, TC 12345');
    }

    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    // Extract the created client ID
    const url = page.url();
    const idMatch = url.match(/\/entities\/Client\/([^\/]+)/);
    if (idMatch) {
      testClientId = idMatch[1];
    }

    await expect(page.locator('[data-testid="entity-title"]')).toContainText(testClientName);
    console.log(`✅ Client created successfully: ${testClientName} (ID: ${testClientId})`);
  });

  test('should read and display client details', async ({ page }) => {
    // Create client for reading
    await test.step('Create client for reading', async () => {
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

    // Navigate to client list and search
    await page.goto('/entities/Client');
    await page.waitForSelector('[data-testid="entity-list"]');
    
    await page.fill('[data-testid="search-input"]', testClientName);
    await page.waitForTimeout(500);
    
    const clientRow = page.locator(`[data-testid="entity-row"][data-entity-id="${testClientId}"]`);
    await expect(clientRow).toBeVisible();
    await expect(clientRow).toContainText(testClientName);
    
    // View client details
    await clientRow.click();
    await page.waitForSelector('[data-testid="entity-details"]');
    
    await expect(page.locator('[data-testid="entity-title"]')).toContainText(testClientName);
    await expect(page.locator('[data-testid="field-name-display"]')).toContainText(testClientName);
    
    console.log(`✅ Client details read successfully: ${testClientName}`);
  });

  test('should update client information', async ({ page }) => {
    const updatedName = `${testClientName} - Updated`;
    const updatedEmail = `updated-${Date.now()}@example.com`;
    
    // Create client for updating
    await test.step('Create client for updating', async () => {
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

    // Edit client
    await page.click('[data-testid="edit-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    await page.fill('[data-testid="field-name"]', updatedName);
    await page.fill('[data-testid="field-email"]', updatedEmail);
    await page.fill('[data-testid="field-phone"]', '+1-555-9999');
    
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    // Verify changes
    await expect(page.locator('[data-testid="entity-title"]')).toContainText(updatedName);
    await expect(page.locator('[data-testid="field-email-display"]')).toContainText(updatedEmail);
    
    testClientName = updatedName;
    console.log(`✅ Client updated successfully: ${updatedName}`);
  });

  test('should delete client', async ({ page }) => {
    // Create client for deletion
    await test.step('Create client for deletion', async () => {
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

    // Delete client
    await page.click('[data-testid="delete-entity"]');
    await page.waitForSelector('[data-testid="delete-confirmation"]');
    await page.click('[data-testid="confirm-delete"]');
    await page.waitForSelector('[data-testid="entity-deleted"]');
    
    // Verify deletion
    await expect(page).toHaveURL(/\/entities\/Client$/);
    
    await page.waitForSelector('[data-testid="entity-list"]');
    await page.fill('[data-testid="search-input"]', testClientName);
    await page.waitForTimeout(500);
    
    const clientRow = page.locator(`[data-testid="entity-row"][data-entity-id="${testClientId}"]`);
    await expect(clientRow).not.toBeVisible();
    
    testClientId = null;
    console.log(`✅ Client deleted successfully: ${testClientName}`);
  });

  test('should validate email format', async ({ page }) => {
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    await page.fill('[data-testid="field-name"]', testClientName);
    await page.fill('[data-testid="field-email"]', 'invalid-email-format');
    
    await page.click('[data-testid="save-entity"]');
    
    // Verify email validation error
    await expect(page.locator('[data-testid="field-email-error"]')).toContainText('valid email');
    
    console.log('✅ Email validation working correctly');
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    
    // Try to save without required fields
    await page.click('[data-testid="save-entity"]');
    
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-name-error"]')).toContainText('required');
    
    console.log('✅ Required field validation working correctly');
  });

  test('should handle duplicate email validation', async ({ page }) => {
    const duplicateEmail = `duplicate-${Date.now()}@example.com`;
    
    // Create first client with email
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', `${testClientName} - First`);
    await page.fill('[data-testid="field-email"]', duplicateEmail);
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Client\/([^\/]+)/);
    if (idMatch) {
      testClientId = idMatch[1];
    }

    // Try to create second client with same email
    await page.goto('/entities/Client');
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', `${testClientName} - Second`);
    await page.fill('[data-testid="field-email"]', duplicateEmail);
    await page.click('[data-testid="save-entity"]');
    
    // Verify duplicate email error
    await expect(page.locator('[data-testid="field-email-error"]')).toContainText('already exists');
    
    console.log('✅ Duplicate email validation working correctly');
  });
});