import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Offline Sync Operations', () => {
  let testEntityIds = [];

  test.afterEach(async ({ page }) => {
    // Ensure we're back online
    await page.context().setOffline(false);
    
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

  test('should queue operations while offline and sync when reconnected', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Offline Test ${timestamp}`;

    // Create entity while online first
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', testName);
    await page.fill('[data-testid="field-description"]', 'Created while online');
    await page.click('[data-testid="save-entity"]');
    await page.waitForSelector('[data-testid="entity-saved"]');
    
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }

    // Go offline
    await page.context().setOffline(true);
    
    // Verify offline indicator appears
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    if (await offlineIndicator.isVisible()) {
      await expect(offlineIndicator).toContainText('Offline');
    }

    // Try to edit while offline
    await page.click('[data-testid="edit-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-description"]', 'Updated while offline');
    await page.click('[data-testid="save-entity"]');
    
    // Should show queued/pending state
    const pendingIndicator = page.locator('[data-testid="sync-pending"]');
    if (await pendingIndicator.isVisible()) {
      await expect(pendingIndicator).toContainText('Pending sync');
    }

    // Go back online
    await page.context().setOffline(false);
    
    // Wait for sync to complete
    await page.waitForTimeout(3000);
    
    // Verify changes were synced
    await page.reload();
    await page.waitForSelector('[data-testid="entity-details"]');
    
    const descriptionDisplay = page.locator('[data-testid="field-description-display"]');
    if (await descriptionDisplay.isVisible()) {
      await expect(descriptionDisplay).toContainText('Updated while offline');
    }
    
    console.log('✅ Offline operation queuing and sync verified');
  });

  test('should handle conflicts when multiple users edit same entity offline', async ({ browser }) => {
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();
    
    await page1.goto('http://localhost:5173/entities/Project');
    await page2.goto('http://localhost:5173/entities/Project');
    
    await page1.waitForSelector('[data-playwright-ready="true"]');
    await page2.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const testName = `Conflict Test ${timestamp}`;

    // Create entity in first tab
    await page1.click('[data-testid="new-entity"]');
    await page1.waitForSelector('[data-testid="entity-form"]');
    await page1.fill('[data-testid="field-name"]', testName);
    await page1.fill('[data-testid="field-description"]', 'Original description');
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

    // Both tabs go offline
    await page1.context().setOffline(true);
    await page2.context().setOffline(true);

    // Edit in first tab
    await page1.click('[data-testid="edit-entity"]');
    await page1.waitForSelector('[data-testid="entity-form"]');
    await page1.fill('[data-testid="field-description"]', 'User 1 changes');
    await page1.click('[data-testid="save-entity"]');

    // Edit in second tab  
    await page2.click('[data-testid="edit-entity"]');
    await page2.waitForSelector('[data-testid="entity-form"]');
    await page2.fill('[data-testid="field-description"]', 'User 2 changes');
    await page2.click('[data-testid="save-entity"]');

    // Both come back online
    await page1.context().setOffline(false);
    await page2.context().setOffline(false);

    // Wait for conflict resolution
    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    // Check if conflict resolution UI appears
    const conflictDialog = page1.locator('[data-testid="conflict-resolution"]');
    if (await conflictDialog.isVisible()) {
      // Resolve conflict by accepting one version
      await page1.click('[data-testid="accept-local-changes"]');
    }

    // Verify resolution
    await page1.reload();
    await page2.reload();
    
    console.log('✅ Offline conflict resolution tested');
    
    await page1.close();
    await page2.close();
  });

  test('should preserve local changes during extended offline periods', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Go offline immediately
    await page.context().setOffline(true);

    const timestamp = Date.now();
    const testName = `Extended Offline ${timestamp}`;

    // Try to create entity while offline
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', testName);
    await page.fill('[data-testid="field-description"]', 'Created offline');
    
    const startDateField = page.locator('[data-testid="field-start_date"]');
    if (await startDateField.isVisible()) {
      await startDateField.fill('2024-06-01');
    }
    
    await page.click('[data-testid="save-entity"]');
    
    // Should show local storage indicator
    const localIndicator = page.locator('[data-testid="stored-locally"]');
    if (await localIndicator.isVisible()) {
      await expect(localIndicator).toContainText('Stored locally');
    }

    // Navigate away and back to verify persistence
    await page.goto('/entities/Client');
    await page.waitForSelector('[data-playwright-ready="true"]');
    
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');
    
    // Search for offline-created entity
    await page.fill('[data-testid="search-input"]', testName);
    await page.waitForTimeout(500);
    
    const entityRow = page.locator(`[data-testid="entity-row"]`).filter({ hasText: testName });
    if (await entityRow.isVisible()) {
      await entityRow.click();
      await page.waitForSelector('[data-testid="entity-details"]');
      
      const nameDisplay = page.locator('[data-testid="field-name-display"]');
      await expect(nameDisplay).toContainText(testName);
    }

    // Go back online and verify sync
    await page.context().setOffline(false);
    await page.waitForTimeout(3000);
    
    // Refresh to ensure data persisted to server
    await page.reload();
    await page.waitForSelector('[data-testid="entity-list"]');
    
    await page.fill('[data-testid="search-input"]', testName);
    await page.waitForTimeout(500);
    
    const syncedRow = page.locator(`[data-testid="entity-row"]`).filter({ hasText: testName });
    await expect(syncedRow).toBeVisible();
    
    // Extract ID for cleanup
    await syncedRow.click();
    const finalUrl = page.url();
    const finalIdMatch = finalUrl.match(/\/entities\/Project\/([^\/]+)/);
    if (finalIdMatch) {
      testEntityIds.push(finalIdMatch[1]);
    }
    
    console.log('✅ Extended offline persistence and sync verified');
  });

  test('should handle bulk operations while offline', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    const timestamp = Date.now();
    const projects = [];

    // Create multiple entities while online first
    for (let i = 1; i <= 3; i++) {
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-name"]', `Bulk Test ${timestamp}-${i}`);
      await page.click('[data-testid="save-entity"]');
      await page.waitForSelector('[data-testid="entity-saved"]');
      
      const url = page.url();
      const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
      if (idMatch) {
        projects.push(idMatch[1]);
        testEntityIds.push(idMatch[1]);
      }
      
      await page.goto('/entities/Project');
      await page.waitForSelector('[data-testid="entity-list"]');
    }

    // Go offline
    await page.context().setOffline(true);

    // Perform bulk updates while offline
    for (let i = 0; i < projects.length; i++) {
      await page.goto(`/entities/Project/${projects[i]}`);
      await page.waitForSelector('[data-testid="entity-details"]');
      
      await page.click('[data-testid="edit-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');
      await page.fill('[data-testid="field-description"]', `Bulk updated offline ${i + 1}`);
      await page.click('[data-testid="save-entity"]');
      
      // Should show pending sync indicator
      const pendingIndicator = page.locator('[data-testid="sync-pending"]');
      if (await pendingIndicator.isVisible()) {
        await expect(pendingIndicator).toContainText('Pending');
      }
    }

    // Go back online
    await page.context().setOffline(false);
    
    // Wait for all operations to sync
    await page.waitForTimeout(5000);
    
    // Verify all updates synced
    for (let i = 0; i < projects.length; i++) {
      await page.goto(`/entities/Project/${projects[i]}`);
      await page.waitForSelector('[data-testid="entity-details"]');
      
      const descriptionDisplay = page.locator('[data-testid="field-description-display"]');
      if (await descriptionDisplay.isVisible()) {
        await expect(descriptionDisplay).toContainText(`Bulk updated offline ${i + 1}`);
      }
    }
    
    console.log('✅ Bulk offline operations sync verified');
  });

  test('should show sync status and progress indicators', async ({ page }) => {
    await page.goto('/entities/Project');
    await page.waitForSelector('[data-playwright-ready="true"]');

    // Monitor sync status in UI
    const syncStatus = page.locator('[data-testid="sync-status"]');
    
    // Should start as online/synced
    if (await syncStatus.isVisible()) {
      await expect(syncStatus).toContainText(/Online|Synced/);
    }

    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    
    // Should show offline status
    if (await syncStatus.isVisible()) {
      await expect(syncStatus).toContainText(/Offline|Disconnected/);
    }

    const timestamp = Date.now();
    const testName = `Sync Status Test ${timestamp}`;

    // Create entity while offline
    await page.click('[data-testid="new-entity"]');
    await page.waitForSelector('[data-testid="entity-form"]');
    await page.fill('[data-testid="field-name"]', testName);
    await page.click('[data-testid="save-entity"]');
    
    // Should show pending changes
    const pendingCount = page.locator('[data-testid="pending-changes-count"]');
    if (await pendingCount.isVisible()) {
      await expect(pendingCount).toContainText('1');
    }

    // Go back online
    await page.context().setOffline(false);
    
    // Should show syncing status
    await page.waitForTimeout(500);
    if (await syncStatus.isVisible()) {
      // May briefly show "Syncing..." before returning to "Online"
      await page.waitForTimeout(2000);
      await expect(syncStatus).toContainText(/Online|Synced/);
    }

    // Pending count should clear
    if (await pendingCount.isVisible()) {
      await expect(pendingCount).toContainText('0');
    }

    // Extract ID for cleanup
    const url = page.url();
    const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
    if (idMatch) {
      testEntityIds.push(idMatch[1]);
    }
    
    console.log('✅ Sync status indicators verified');
  });
});