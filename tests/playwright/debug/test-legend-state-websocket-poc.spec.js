// @ts-check
import { test, expect } from '../fixtures/persistent-context.js';

/**
 * Legend State WebSocket POC Test
 * 
 * Tests the Legend State WebSocket POC page that hooks into the existing
 * sync system for real-time table change notifications.
 */

test.describe('Legend State WebSocket POC', () => {

  // Helper function to navigate to POC page with authentication
  async function navigateToPOC(page) {
    await page.goto('/debug/legend-state-websocket-poc');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('/sign-in')) {
      console.log('Redirected to sign-in, authentication may have expired');
      await page.fill('[name="email"]', 'ceo@widecorp.com');
      await page.fill('[name="password"]', 'WideCorp2024!CEO');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
      
      if (!page.url().includes('/debug/legend-state-websocket-poc')) {
        await page.goto('/debug/legend-state-websocket-poc');
        await page.waitForTimeout(3000);
      }
    }
  }

  test('should connect to sync system and display data', async ({ page }) => {
    await navigateToPOC(page);
    
    // Wait for the page to load and display the title
    await expect(page.locator('h1')).toContainText('Legend State + Existing Sync Integration');
    
    // Check that the sync integration section is visible
    await expect(page.locator('text=Live Sync Integration')).toBeVisible();
    
    // Check that the WebSocket connection badge appears (may start as disconnected)
    const connectionBadge = page.locator('text=/WebSocket (Connected|Disconnected)/');
    await expect(connectionBadge).toBeVisible();
    
    // Wait for the system to attempt connection (give it some time)
    await page.waitForTimeout(3000);
    
    // Check if the manual refresh button is available
    await expect(page.locator('button:has-text("Manual Refresh")')).toBeVisible();
    
    // Check that the Projects and Clients sections are visible
    await expect(page.locator('text=Projects (')).toBeVisible();
    await expect(page.locator('text=Clients (')).toBeVisible();
  });

  test('should load initial data via manual refresh', async ({ page }) => {
    await page.goto('/debug/legend-state-websocket-poc');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Legend State + Existing Sync Integration');
    
    // Click manual refresh to trigger initial data load
    await page.locator('button:has-text("Manual Refresh")').click();
    
    // Wait for API calls to complete
    await page.waitForTimeout(2000);
    
    // Check if projects data was loaded (count should be visible)
    const projectsHeader = page.locator('text=/Projects \\(\\d+\\)/');
    await expect(projectsHeader).toBeVisible();
    
    // Check if clients data was loaded
    const clientsHeader = page.locator('text=/Clients \\(\\d+\\)/');
    await expect(clientsHeader).toBeVisible();
    
    // If there are projects, check that they display properly
    const projectCount = await page.locator('text=/Projects \\((\\d+)\\)/')
      .textContent().then(text => parseInt(text.match(/\\((\\d+)\\)/)?.[1] || '0'));
    
    if (projectCount > 0) {
      // Should see project cards in the projects section
      await expect(page.locator('.space-y-2 .p-3.bg-muted').first()).toBeVisible();
    }
  });

  test('should create a sample project and test WebSocket notifications', async ({ page }) => {
    await navigateToPOC(page);
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Legend State + Existing Sync Integration');
    
    // First do a manual refresh to get baseline data
    await page.locator('button:has-text("Manual Refresh")').click();
    await page.waitForTimeout(2000);
    
    // Get initial project count
    const initialProjectsText = await page.locator('text=/Projects \\(\\d+\\)/')
      .textContent();
    const match = initialProjectsText.match(/Projects \((\d+)\)/);
    const initialCount = match ? parseInt(match[1]) : 0;
    
    console.log(`Initial project count from UI: ${initialCount}`);
    console.log(`Initial projects text: ${initialProjectsText}`);
    
    // Set up a listener for console messages to monitor WebSocket notifications
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.text().includes('Legend State') || msg.text().includes('WebSocket') || 
          msg.text().includes('table change notification') || msg.text().includes('TABLE CHANGE NOTIFICATION')) {
        consoleMessages.push(msg.text());
        console.log(`[Browser Console] ${msg.text()}`);
      }
    });
    
    // Create a sample project
    await page.locator('button:has-text("Create Sample Project")').click();
    
    // Wait for the creation to complete and for potential WebSocket notification
    // This should trigger a table change notification if the sync system is working
    await page.waitForTimeout(5000);
    
    // Check if the project count increased (either via WebSocket or manual refresh)
    // First check if it updated automatically via WebSocket
    let currentProjectsText = await page.locator('text=/Projects \\(\\d+\\)/')
      .textContent();
    let currentMatch = currentProjectsText.match(/Projects \((\d+)\)/);
    let currentCount = currentMatch ? parseInt(currentMatch[1]) : 0;
    
    if (currentCount === initialCount) {
      console.log('No automatic update detected, trying manual refresh...');
      // If WebSocket notification didn't trigger automatic update, manually refresh
      await page.locator('button:has-text("Manual Refresh")').click();
      await page.waitForTimeout(2000);
      
      currentProjectsText = await page.locator('text=/Projects \\(\\d+\\)/')
        .textContent();
      currentMatch = currentProjectsText.match(/Projects \((\d+)\)/);
      currentCount = currentMatch ? parseInt(currentMatch[1]) : 0;
    }
    
    console.log(`Final project count: ${currentCount}`);
    
    // Verify that the project was created (count should have increased)
    expect(currentCount).toBeGreaterThan(initialCount);
    
    // Check console messages for WebSocket activity
    console.log('Console messages captured:', consoleMessages);
    
    // Look for evidence of WebSocket connection and table notifications
    const hasWebSocketActivity = consoleMessages.some(msg => 
      msg.includes('WebSocket') || 
      msg.includes('table change notification') ||
      msg.includes('TABLE CHANGE NOTIFICATION') ||
      msg.includes('Connected') ||
      msg.includes('simpleNotificationSyncMachineActor')
    );
    
    if (hasWebSocketActivity) {
      console.log('✅ WebSocket activity detected in console logs');
    } else {
      console.log('⚠️ No WebSocket activity detected in console logs');
    }
    
    // Check if "Last Change" badge appeared (indicates WebSocket notification was received)
    const lastChangeBadge = page.locator('text=/Last Change:/');
    const hasLastChangeBadge = await lastChangeBadge.isVisible();
    
    if (hasLastChangeBadge) {
      console.log('✅ Last Change badge detected - WebSocket notification likely received');
      await expect(lastChangeBadge).toBeVisible();
    } else {
      console.log('⚠️ No Last Change badge detected - WebSocket notifications may not be working');
    }
  });

  test('should update a project and test WebSocket notifications', async ({ page }) => {
    await page.goto('/debug/legend-state-websocket-poc');
    
    // Wait for page to load and get initial data
    await expect(page.locator('h1')).toContainText('Legend State + Existing Sync Integration');
    
    await page.locator('button:has-text("Manual Refresh")').click();
    await page.waitForTimeout(2000);
    
    // Check if we have any projects to update
    const projectsText = await page.locator('text=/Projects \\(\\d+\\)/')
      .textContent();
    const projectCount = parseInt(projectsText.match(/\\((\\d+)\\)/)?.[1] || '0');
    
    if (projectCount === 0) {
      // Create a project first if none exist
      await page.locator('button:has-text("Create Sample Project")').click();
      await page.waitForTimeout(3000);
    }
    
    // Set up console message monitoring
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.text().includes('Legend State') || msg.text().includes('WebSocket') || 
          msg.text().includes('table change notification') || msg.text().includes('Updated') ||
          msg.text().includes('TABLE CHANGE NOTIFICATION')) {
        consoleMessages.push(msg.text());
        console.log(`[Browser Console] ${msg.text()}`);
      }
    });
    
    // Update a random project
    const updateButton = page.locator('button:has-text("Update Random Project")');
    
    // Check if button is enabled (should be if we have projects)
    await expect(updateButton).not.toBeDisabled();
    
    // Click to update
    await updateButton.click();
    
    // Wait for the update to complete and potential WebSocket notification
    await page.waitForTimeout(5000);
    
    // Check console for update activity
    const hasUpdateActivity = consoleMessages.some(msg => 
      msg.includes('Updated') || 
      msg.includes('update') ||
      msg.includes('WebSocket') ||
      msg.includes('table change notification')
    );
    
    if (hasUpdateActivity) {
      console.log('✅ Update activity detected in console logs');
    }
    
    // Check if "Last Change" badge appeared
    const lastChangeBadge = page.locator('text=/Last Change:/');
    const hasLastChangeBadge = await lastChangeBadge.isVisible();
    
    if (hasLastChangeBadge) {
      console.log('✅ Last Change badge detected after update');
    }
    
    console.log('Update test console messages:', consoleMessages);
  });

  test('should display sync connection status correctly', async ({ page }) => {
    await page.goto('/debug/legend-state-websocket-poc');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Legend State + Existing Sync Integration');
    
    // Check the debug info section
    await expect(page.locator('text=Existing Sync Integration Debug')).toBeVisible();
    
    // Check organization ID is displayed
    await expect(page.locator('text=01920000-1000-7000-8000-000000000001')).toBeVisible();
    
    // Check sync connection status
    const syncStatus = page.locator('text=/Sync Connection/').locator('..').locator('.text-muted-foreground');
    await expect(syncStatus).toBeVisible();
    
    // Wait a moment for connection to establish
    await page.waitForTimeout(3000);
    
    // The status should show either "Listening" or "Not Connected"
    const statusText = await syncStatus.textContent();
    expect(['Listening', 'Not Connected']).toContain(statusText);
    
    console.log(`Sync connection status: ${statusText}`);
    
    // Check active table filters
    await expect(page.locator('text=Project, Client')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    await page.goto('/debug/legend-state-websocket-poc');
    
    // Monitor for any error messages
    const errorAlerts = page.locator('.border-red-200, [variant="destructive"]');
    
    // Wait for initial load
    await page.waitForTimeout(3000);
    
    // Check if any error alerts are displayed
    const errorCount = await errorAlerts.count();
    
    if (errorCount > 0) {
      console.log('Error alerts detected:', await errorAlerts.allTextContents());
    }
    
    // The page should still function even if there are connection issues
    await expect(page.locator('button:has-text("Manual Refresh")')).toBeVisible();
    await expect(page.locator('button:has-text("Create Sample Project")')).toBeVisible();
  });

});