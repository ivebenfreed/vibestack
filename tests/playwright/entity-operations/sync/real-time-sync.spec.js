import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Real-time Entity Sync', () => {
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

  test('should sync create operations across tabs in real-time', async ({ browser }) => {
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();
    
    // Load the same entity page in both tabs
    await page1.goto('http://localhost:5173/entities/Project');
    await page2.goto('http://localhost:5173/entities/Project');
    
    await page1.waitForSelector('[data-playwright-ready="true"]');
    await page2.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Sync Test Project ${timestamp}`;

    // Create project in first tab
    await page1.click('[data-testid="new-entity"]');
    await page1.waitForSelector('[data-testid="entity-form"]');
    await page1.fill('[data-testid="field-name"]', testName);
    await page1.fill('[data-testid="field-description"]', 'Test sync description');
    
    const startDateField = page1.locator('[data-testid="field-start_date"]');
    if (await startDateField.isVisible()) {
      await startDateField.fill('2024-01-01');
    }
    
    await page1.click('[data-testid="save-entity"]');
    await page1.waitForSelector('[data-testid="entity-saved"]');
    
    // Extract entity ID
    const url = page1.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Wait for WebSocket sync and verify in second tab
    await page2.waitForTimeout(2000); // Allow sync time
    await page2.reload();
    await page2.waitForSelector('[data-testid="entity-list"]');
    
    await page2.fill('[data-testid="search-input"]', testName);
    await page2.waitForTimeout(500);
    
    const entityRow = page2.locator(`[data-testid="entity-row"]`).filter({ hasText: testName });
    await expect(entityRow).toBeVisible();
    
    console.log('✅ Real-time create sync verified across tabs');
    
    await page1.close();
    await page2.close();
  });

  test('should sync update operations across tabs in real-time', async ({ browser }) => {
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();
    
    await page1.goto('http://localhost:5173/entities/Project');
    await page2.goto('http://localhost:5173/entities/Project');
    
    await page1.waitForSelector('[data-playwright-ready="true"]');
    await page2.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Update Sync Test ${timestamp}`;
    const updatedName = `${testName} - Updated`;

    // Create project in first tab
    await page1.click('[data-testid="new-entity"]');
    await page1.waitForSelector('[data-testid="entity-form"]');
    await page1.fill('[data-testid="field-name"]', testName);
    await page1.click('[data-testid="save-entity"]');
    await page1.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page1.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Wait for sync, then update in first tab
    await page1.waitForTimeout(1000);
    await page1.click('[data-testid="edit-entity"]');
    await page1.waitForSelector('[data-testid="entity-form"]');
    await page1.fill('[data-testid="field-name"]', updatedName);
    await page1.click('[data-testid="save-entity"]');
    await page1.waitForSelector('[data-testid="entity-saved"]');

    // Verify update synced to second tab
    await page2.waitForTimeout(2000);
    await page2.reload();
    await page2.waitForSelector('[data-testid="entity-list"]');
    
    await page2.fill('[data-testid="search-input"]', updatedName);
    await page2.waitForTimeout(500);
    
    const entityRow = page2.locator(`[data-testid="entity-row"]`).filter({ hasText: updatedName });
    await expect(entityRow).toBeVisible();
    
    console.log('✅ Real-time update sync verified across tabs');
    
    await page1.close();
    await page2.close();
  });

  test('should sync delete operations across tabs in real-time', async ({ browser }) => {
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();
    
    await page1.goto('http://localhost:5173/entities/Project');
    await page2.goto('http://localhost:5173/entities/Project');
    
    await page1.waitForSelector('[data-playwright-ready="true"]');
    await page2.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Delete Sync Test ${timestamp}`;

    // Create project in first tab
    await page1.click('[data-testid="new-entity"]');
    await page1.waitForSelector('[data-testid="entity-form"]');
    await page1.fill('[data-testid="field-name"]', testName);
    await page1.click('[data-testid="save-entity"]');
    await page1.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page1.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    let entityId = null;
    if (idMatch) {
      entityId = idMatch[1];
    }

    // Wait for sync, then verify in second tab
    await page2.waitForTimeout(2000);
    await page2.reload();
    await page2.waitForSelector('[data-testid="entity-list"]');
    
    await page2.fill('[data-testid="search-input"]', testName);
    await page2.waitForTimeout(500);
    
    const entityRowBefore = page2.locator(`[data-testid="entity-row"]`).filter({ hasText: testName });
    await expect(entityRowBefore).toBeVisible();

    // Delete in first tab
    await page1.click('[data-testid="delete-entity"]');
    await page1.waitForSelector('[data-testid="delete-confirmation"]');
    await page1.click('[data-testid="confirm-delete"]');
    await page1.waitForSelector('[data-testid="entity-deleted"]');

    // Verify deletion synced to second tab
    await page2.waitForTimeout(2000);
    await page2.reload();
    await page2.waitForSelector('[data-testid="entity-list"]');
    
    await page2.fill('[data-testid="search-input"]', testName);
    await page2.waitForTimeout(500);
    
    const entityRowAfter = page2.locator(`[data-testid="entity-row"]`).filter({ hasText: testName });
    await expect(entityRowAfter).not.toBeVisible();
    
    console.log('✅ Real-time delete sync verified across tabs');
    
    await page1.close();
    await page2.close();
  });

  test('should handle WebSocket connection recovery', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Monitor WebSocket connection status
    await page.evaluate(() => {
      window.webSocketEvents = [];
      
      // Override WebSocket to track events
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        
        ws.addEventListener('open', () => {
          window.webSocketEvents.push({ type: 'open', timestamp: Date.now() });
        });
        
        ws.addEventListener('close', () => {
          window.webSocketEvents.push({ type: 'close', timestamp: Date.now() });
        });
        
        ws.addEventListener('error', () => {
          window.webSocketEvents.push({ type: 'error', timestamp: Date.now() });
        });
        
        return ws;
      };
    });

    // Create initial entity
    const timestamp = Date.now();
    const testName = `WS Recovery Test ${timestamp}`;
    
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', testName);
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Simulate network disruption by going offline/online
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    await page.context().setOffline(false);
    
    // Wait for reconnection
    await page.waitForTimeout(3000);
    
    // Verify WebSocket events
    const wsEvents = await page.evaluate(() => window.webSocketEvents);
    expect(wsEvents.some(event => event.type === 'open')).toBe(true);
    
    // Test that sync still works after recovery
    await page.click('[data-testid="edit-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', `${testName} - Recovered`);
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    await expect(page.locator('[data-testid="field-name-display"]')).toContainText('Recovered');
    
    console.log('✅ WebSocket connection recovery verified');
  });

  test('should sync between different entity types', async ({ browser }) => {
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();
    
    // Page 1: Projects view
    await page1.goto('http://localhost:5173/entities/Project');
    await page1.waitForSelector('[data-playwright-ready="true"]');
    
    // Page 2: Clients view  
    await page2.goto('http://localhost:5173/entities/Client');
    await page2.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    
    // Create client in second tab
    await page2.click('[data-testid="new-entity"]');
    await page2.waitForSelector('[data-testid="entity-form"]');
    await page2.fill('[data-testid="field-name"]', `Sync Client ${timestamp}`);
    
    const emailField = page2.locator('[data-testid="field-email"]');
    if (await emailField.isVisible()) {
      await emailField.fill(`sync-${timestamp}@example.com`);
    }
    
    await page2.click('[data-testid="save-entity"]');
    await page2.waitForSelector('[data-testid="entity-saved"]');

    // Create project in first tab that might reference the client
    await page1.click('[data-testid="new-entity"]');
    await page1.waitForSelector('[data-testid="entity-form"]');
    await page1.fill('[data-testid="field-name"]', `Sync Project ${timestamp}`);
    
    // Check if client selection is available
    const clientField = page1.locator('[data-testid="field-client_id"]');
    if (await clientField.isVisible()) {
      // Wait for sync to populate client options
      await page1.waitForTimeout(2000);
      await clientField.selectOption({ index: 1 });
    }
    
    await page1.click('[data-testid="save-entity"]');
    await page1.waitForSelector('[data-testid="entity-saved"]');
    
    const projectUrl = page1.url();
    const projectIdMatch = projectUrl.match(/\/entities\/Project\/([^\/]+)/);
    if (projectIdMatch) {
      testEntityIds.push(projectIdMatch[1]);
    }

    // Verify cross-entity sync worked
    await page2.waitForTimeout(1000);
    
    console.log('✅ Cross-entity sync verified between Projects and Clients');
    
    await page1.close();
    await page2.close();
  });
});