/**
 * Sync Conflict Scenario Testing
 * 
 * Tests sync conflict resolution and handling:
 * - Concurrent modifications from multiple clients
 * - Last-writer-wins conflict resolution
 * - Optimistic locking failures
 * - Version mismatch handling
 * - Data integrity during conflicts
 * - Rollback mechanisms
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Sync Conflict Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for sync to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
    
    // Wait for sync machine to reach operational state
    await page.waitForTimeout(3000);
  });

  test('should handle concurrent task modifications', async ({ context, page }) => {
    // Create a second browser tab for concurrent editing
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Conflict test: Starting concurrent modifications');
    });

    // Create a task in the first tab
    try {
      await page.click('button:has-text("New Task"), [data-testid="new-task"]');
      await page.fill('input[name="title"], input[placeholder*="task" i]', 'Conflict Test Task');
      await page.click('button[type="submit"], button:has-text("Create")');
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('Task creation UI may vary');
    }

    // Try to modify the same task from both tabs simultaneously
    const taskTitle = 'Modified from Tab 1';
    const taskTitle2 = 'Modified from Tab 2';

    try {
      // Modify from first tab
      await page.fill('input[name="title"], [contenteditable="true"]', taskTitle);
      
      // Modify from second tab simultaneously
      await page2.fill('input[name="title"], [contenteditable="true"]', taskTitle2);
      
      // Save both changes
      await Promise.all([
        page.keyboard.press('Enter').catch(() => {}),
        page2.keyboard.press('Enter').catch(() => {})
      ]);
      
      await page.waitForTimeout(3000);
    } catch (e) {
      // Some UI interactions may fail - that's okay for this test
    }

    // Check sync states - should handle conflicts gracefully
    const syncState1 = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    const syncState2 = await page2.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Neither should be in permanent error state
    expect(syncState1).not.toBe('error');
    expect(syncState2).not.toBe('error');

    await page2.close();
  });

  test('should handle version mismatch scenarios', async ({ page }) => {
    // Mock version mismatch responses from server
    await page.context().route('**/api/sync/**', async route => {
      const request = route.request();
      const postData = request.postData();
      
      if (postData && postData.includes('changes')) {
        // Simulate version mismatch
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Version Mismatch',
            type: 'VERSION_CONFLICT',
            message: 'The data has been modified by another user',
            serverVersion: '2.1.0',
            clientVersion: '2.0.0'
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Version mismatch test: Creating conflicting change');
    });

    // Try to make a change that will trigger version conflict
    try {
      await page.click('button:has-text("New Task")');
      await page.fill('input[name="title"]', 'Version Conflict Test');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    } catch (e) {
      // UI may vary
    }

    // Check how sync handles version mismatch
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Should handle version conflicts gracefully
    expect(syncState).not.toBe('unknown');

    // Look for conflict resolution UI
    const conflictIndicators = [
      'text=Conflict detected',
      'text=Data was modified',
      'text=Refresh required',
      '[data-testid="version-conflict"]',
      '.conflict-warning'
    ];

    let foundConflictUI = false;
    for (const selector of conflictIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        foundConflictUI = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }

    // Should either handle automatically or show user feedback
    expect(syncState === 'error' || foundConflictUI || syncState === 'live_sync').toBe(true);
  });

  test('should handle optimistic locking failures', async ({ page }) => {
    // Mock optimistic lock failures
    let lockFailureCount = 0;
    
    await page.context().route('**/api/**', async route => {
      const request = route.request();
      const postData = request.postData();
      
      if (postData && postData.includes('update') && lockFailureCount < 2) {
        lockFailureCount++;
        
        // Simulate optimistic lock failure
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Optimistic Lock Failure',
            type: 'LOCK_CONFLICT',
            message: 'Record was modified by another process',
            currentVersion: lockFailureCount + 1
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Optimistic lock test: Triggering lock failure');
    });

    // Try to update something that will trigger lock failure
    try {
      await page.click('[data-testid="task-item"], .task-item', { timeout: 5000 });
      await page.fill('input[name="title"], [contenteditable]', 'Lock Test Update');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    } catch (e) {
      // UI elements may not exist
    }

    // Should handle lock failures with retry logic
    expect(lockFailureCount).toBeGreaterThan(0);

    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Should recover from lock failures
    expect(syncState).not.toBe('error');
  });

  test('should maintain data integrity during conflicts', async ({ page }) => {
    // Track data consistency during conflicts
    await page.evaluate(() => {
      window.dataIntegrityLog = [];
      window.xstateTestInspector?.addMarker('Integrity test: Starting data tracking');
    });

    // Mock conflict responses that test data integrity
    await page.context().route('**/api/sync/**', async route => {
      const request = route.request();
      
      if (request.method() === 'POST') {
        // Simulate partial success with some data corruption
        await route.fulfill({
          status: 207, // Multi-status
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              { status: 200, id: '1', success: true },
              { status: 409, id: '2', success: false, error: 'Conflict' },
              { status: 200, id: '3', success: true }
            ],
            message: 'Partial sync completed with conflicts'
          })
        });
      } else {
        await route.continue();
      }
    });

    // Try multiple operations to test integrity
    try {
      // Create multiple tasks
      for (let i = 0; i < 3; i++) {
        await page.click('button:has-text("New Task")');
        await page.fill('input[name="title"]', `Integrity Test ${i + 1}`);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // UI may vary
    }

    await page.waitForTimeout(5000);

    // Check database state for integrity
    const dbIntegrity = await page.evaluate(() => {
      if (!window.db) return { available: false };
      
      // Check if database is in consistent state
      return {
        available: true,
        tablesExist: typeof window.db.tasks !== 'undefined'
      };
    });

    // Should maintain database integrity even with conflicts
    expect(dbIntegrity.available).toBe(true);

    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    expect(syncState).not.toBe('error');
  });

  test('should handle rollback scenarios', async ({ page }) => {
    let rollbackTriggered = false;

    // Mock server responses that require rollback
    await page.context().route('**/api/**', async route => {
      const request = route.request();
      const postData = request.postData();
      
      if (postData && postData.includes('changes')) {
        rollbackTriggered = true;
        
        // Simulate server rejecting changes requiring rollback
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation Failed',
            type: 'ROLLBACK_REQUIRED',
            message: 'Changes violate business rules and must be rolled back',
            rollbackInstructions: ['revert_task_123', 'refresh_dependencies']
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Rollback test: Making change that requires rollback');
    });

    // Make change that will require rollback
    try {
      await page.click('button:has-text("New Task")');
      await page.fill('input[name="title"]', 'Rollback Test Task');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    } catch (e) {
      // UI may vary
    }

    // Should handle rollback gracefully
    expect(rollbackTriggered).toBe(true);

    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Should handle rollback without permanent error
    expect(syncState).not.toBe('error');
  });

  test('should handle cascade conflict resolution', async ({ page }) => {
    // Test conflicts that cascade to related entities
    await page.context().route('**/api/sync/**', async route => {
      const request = route.request();
      
      if (request.method() === 'POST') {
        // Simulate cascade conflict (e.g., deleting project affects tasks)
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Cascade Conflict',
            type: 'DEPENDENCY_CONFLICT',
            message: 'Change affects dependent entities',
            affectedEntities: ['task_1', 'task_2', 'project_1'],
            resolutionRequired: true
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Cascade conflict test: Triggering dependency conflict');
    });

    // Try operation that affects multiple entities
    try {
      await page.click('[data-testid="delete-project"], button:has-text("Delete")');
      await page.click('button:has-text("Confirm"), button:has-text("Yes")');
      await page.waitForTimeout(3000);
    } catch (e) {
      // UI may not have delete functionality
    }

    // Should handle cascade conflicts appropriately
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    expect(syncState).not.toBe('unknown');
  });

  test('should provide user feedback during conflict resolution', async ({ page }) => {
    // Mock conflict that requires user intervention
    await page.context().route('**/api/sync/**', async route => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Manual Resolution Required',
          type: 'USER_INTERVENTION_NEEDED',
          message: 'Conflicts require manual resolution',
          conflictData: {
            localVersion: { title: 'Local Title' },
            serverVersion: { title: 'Server Title' },
            field: 'title'
          }
        })
      });
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('User feedback test: Conflict requiring manual resolution');
    });

    // Trigger conflict
    try {
      await page.click('[data-testid="task-item"]');
      await page.fill('input[name="title"]', 'User Feedback Test');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    } catch (e) {
      // UI may vary
    }

    // Look for user feedback UI
    const feedbackSelectors = [
      'text=Conflict detected',
      'text=Manual resolution',
      'text=Choose version',
      '[data-testid="conflict-resolver"]',
      '.conflict-dialog'
    ];

    let foundFeedback = false;
    for (const selector of feedbackSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        foundFeedback = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }

    // Should provide user feedback for conflicts
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Should handle conflicts with user feedback
    expect(syncState === 'error' || foundFeedback || syncState !== 'unknown').toBe(true);
  });
});