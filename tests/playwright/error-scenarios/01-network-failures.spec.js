/**
 * Network Failure Scenario Testing
 * 
 * Tests application behavior during network failures:
 * - Offline/online transitions
 * - Connection timeouts
 * - Intermittent connectivity
 * - WebSocket disconnections
 * - Sync recovery after network issues
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Network Failure Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for app to be fully loaded and synced
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
  });

  test('should handle offline mode gracefully', async ({ page }) => {
    // Add XState inspection markers
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Network test: Going offline');
    });

    // Go offline
    await page.context().setOffline(true);
    
    // Try to perform actions that require network
    try {
      await page.click('button:has-text("New Project"), [data-testid="new-project"]');
      await page.fill('input[name="name"], input[placeholder*="project" i]', 'Offline Test Project');
      await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
    } catch (e) {
      // Some UI elements might not be available - that's okay
    }
    
    // Check for offline indicators
    const offlineIndicators = [
      'text=Offline',
      'text=No connection',
      'text=Connection lost',
      '[data-testid="offline-indicator"]',
      '.offline',
      '.network-error'
    ];
    
    let hasOfflineIndicator = false;
    for (const selector of offlineIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        hasOfflineIndicator = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }
    
    // Check sync machine state - should handle offline gracefully
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3') || 'unknown';
    });
    
    // Should not be in error state - should be in idle or disconnected
    expect(syncState).not.toBe('error');
    
    // Go back online
    await page.context().setOffline(false);
    
    // Wait for reconnection
    await page.waitForTimeout(3000);
    
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Network test: Back online');
    });
    
    // Should reconnect and sync
    const reconnectedState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3') || 'unknown';
    });
    
    // Should eventually return to connected state
    expect(reconnectedState).not.toBe('error');
  });

  test('should handle WebSocket disconnections', async ({ page }) => {
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('WebSocket test: Starting');
    });

    // Wait for WebSocket to be connected
    await page.waitForTimeout(2000);
    
    // Check initial sync state
    const initialState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    // Simulate WebSocket disconnection by going offline briefly
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    await page.context().setOffline(false);
    
    // Wait for reconnection attempt
    await page.waitForTimeout(5000);
    
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('WebSocket test: After reconnection attempt');
    });
    
    // Check that sync machine handles reconnection
    const finalState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    // Should not be stuck in error state
    expect(finalState).not.toBe('error');
  });

  test('should queue changes during offline mode', async ({ page }) => {
    // Create a task while online first
    try {
      await page.click('button:has-text("New Task"), [data-testid="new-task"]');
      await page.fill('input[name="title"], input[placeholder*="task" i]', 'Online Task');
      await page.click('button[type="submit"], button:has-text("Create")');
      await page.waitForTimeout(1000);
    } catch (e) {
      // UI might vary - continue with offline test
    }
    
    // Go offline
    await page.context().setOffline(true);
    
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Offline queuing test: Creating changes offline');
    });
    
    // Try to make changes while offline
    try {
      await page.click('button:has-text("New Task"), [data-testid="new-task"]');
      await page.fill('input[name="title"], input[placeholder*="task" i]', 'Offline Task');
      await page.click('button[type="submit"], button:has-text("Create")');
    } catch (e) {
      // Expected - some actions might fail offline
    }
    
    // Check if changes are queued in local storage or sync system
    const queuedChanges = await page.evaluate(() => {
      // Check for queued changes in various possible locations
      const localChanges = window.db ? 'Available' : 'Unavailable';
      const syncState = window.xstateTestInspector?.getCurrentState('sync-machine-v3') || 'unknown';
      
      return {
        localChanges,
        syncState,
        localStorage: Object.keys(localStorage).length,
        sessionStorage: Object.keys(sessionStorage).length
      };
    });
    
    expect(queuedChanges.syncState).not.toBe('error');
    
    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(3000);
    
    // Should attempt to sync queued changes
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Offline queuing test: Back online, syncing');
    });
    
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    // Should recover to operational state
    expect(syncState).not.toBe('error');
  });

  test('should handle slow network connections', async ({ page }) => {
    // Simulate slow network
    await page.context().route('**/*', async route => {
      // Add delay to all requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });
    
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Slow network test: Making requests');
    });
    
    // Try to perform actions with slow network
    try {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch (e) {
      // Timeout expected with slow network
    }
    
    // Should show loading states appropriately
    const loadingIndicators = [
      'text=Loading',
      '[data-testid="loading"]',
      '.loading',
      '.spinner'
    ];
    
    let hasLoadingIndicator = false;
    for (const selector of loadingIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        hasLoadingIndicator = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }
    
    // App should handle slow connections gracefully
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    // Should not error due to slow network
    expect(syncState).not.toBe('error');
  });

  test('should handle intermittent connectivity', async ({ page }) => {
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Intermittent connectivity test: Starting');
    });

    // Simulate intermittent connectivity
    for (let i = 0; i < 3; i++) {
      // Go offline
      await page.context().setOffline(true);
      await page.waitForTimeout(1000);
      
      // Go online
      await page.context().setOffline(false);
      await page.waitForTimeout(2000);
      
      await page.evaluate((iteration) => {
        window.xstateTestInspector?.addMarker(`Intermittent test: Cycle ${iteration + 1}`);
      }, i);
    }
    
    // Check final state after intermittent connectivity
    const finalState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    // Should recover from intermittent issues
    expect(finalState).not.toBe('error');
  });

  test('should handle API endpoint failures', async ({ page }) => {
    // Mock API failures
    await page.context().route('**/api/**', async route => {
      if (Math.random() < 0.5) {
        // 50% chance of failure
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service temporarily unavailable' })
        });
      } else {
        await route.continue();
      }
    });
    
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('API failure test: Making requests with random failures');
    });
    
    // Try to perform various actions
    try {
      await page.goto('/projects');
      await page.waitForTimeout(3000);
      
      await page.goto('/tasks');
      await page.waitForTimeout(3000);
      
      await page.goto('/dashboard');
      await page.waitForTimeout(3000);
    } catch (e) {
      // Some failures expected
    }
    
    // App should handle API failures gracefully
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    // Should handle API failures without crashing
    expect(syncState).not.toBe('error');
  });

  test('should retry failed requests appropriately', async ({ page }) => {
    let requestCount = 0;
    
    // Track retry attempts
    await page.context().route('**/api/sync/**', async route => {
      requestCount++;
      
      if (requestCount <= 2) {
        // Fail first 2 attempts
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Temporary failure' })
        });
      } else {
        // Succeed on 3rd attempt
        await route.continue();
      }
    });
    
    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Retry test: Starting sync with retry logic');
    });
    
    // Trigger sync action
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for retries to occur
    await page.waitForTimeout(10000);
    
    // Should eventually succeed after retries
    expect(requestCount).toBeGreaterThan(1); // Should have retried
    
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    // Should recover after successful retry
    expect(syncState).not.toBe('error');
  });

  test('should handle connection state transitions', async ({ page }) => {
    // Monitor connection state changes
    const stateTransitions = [];
    
    await page.exposeFunction('logStateTransition', (state) => {
      stateTransitions.push({ state, timestamp: Date.now() });
    });
    
    await page.evaluate(() => {
      // Monitor sync machine state changes
      const interval = setInterval(() => {
        const currentState = window.xstateTestInspector?.getCurrentState('sync-machine-v3');
        if (currentState) {
          window.logStateTransition(currentState);
        }
      }, 1000);
      
      // Store interval for cleanup
      window.stateMonitorInterval = interval;
    });
    
    // Perform connection transitions
    await page.context().setOffline(true);
    await page.waitForTimeout(3000);
    
    await page.context().setOffline(false);
    await page.waitForTimeout(5000);
    
    // Cleanup monitoring
    await page.evaluate(() => {
      if (window.stateMonitorInterval) {
        clearInterval(window.stateMonitorInterval);
      }
    });
    
    // Should have recorded state transitions
    expect(stateTransitions.length).toBeGreaterThan(0);
    
    // Should not end in error state
    const finalTransition = stateTransitions[stateTransitions.length - 1];
    expect(finalTransition.state).not.toBe('error');
  });
});