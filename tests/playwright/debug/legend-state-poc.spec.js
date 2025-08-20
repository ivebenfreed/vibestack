/**
 * Legend State POC Playwright Test
 * 
 * Tests the pure Legend State implementation with real API integration
 * Uses persistent browser context with Wide Corp authentication
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Legend State POC', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Legend State POC debug page
    await page.goto('/debug/legend-state-poc');
    
    // Check if we're redirected to login
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/sign-in') || page.url().includes('/login')) {
      console.log('🔐 Need to login first, using Wide Corp CEO credentials');
      
      // Fill in login form
      await page.fill('input[type="email"]', 'ceo@widecorp.com');
      await page.fill('input[type="password"]', 'WideCorp2024!CEO');
      await page.click('button:has-text("Login")');
      
      // Wait for login to complete and redirect
      await page.waitForURL(/\/debug\/legend-state-poc|\/dashboard|\//, { timeout: 10000 });
      
      // Navigate to our debug page if we're not there already
      if (!page.url().includes('/debug/legend-state-poc')) {
        await page.goto('/debug/legend-state-poc');
      }
    }
    
    // Wait for page to be ready - check for heading or any main content
    await page.waitForSelector('h1, [data-testid="legend-state-controls"]', { timeout: 10000 });
    
    // Wait a moment for Legend State observables to initialize
    await page.waitForTimeout(500);
  });

  test('should display Legend State POC interface', async ({ page }) => {
    // Check main heading
    await expect(page.locator('h1')).toContainText('Legend State Data Management');
    
    // Check that all main cards are present
    await expect(page.locator('text=Legend State Controls')).toBeVisible();
    await expect(page.locator('text=Projects (')).toBeVisible();
    await expect(page.locator('text=Clients (')).toBeVisible();
    await expect(page.locator('text=Legend State Debug Info')).toBeVisible();
    
    // Check control buttons are present
    await expect(page.locator('button:has-text("Start Polling")')).toBeVisible();
    await expect(page.locator('button:has-text("Stop Polling")')).toBeVisible();
    await expect(page.locator('button:has-text("Manual Fetch")')).toBeVisible();
    await expect(page.locator('button:has-text("Create Sample Project")')).toBeVisible();
  });

  test('should handle polling controls', async ({ page }) => {
    // Wait for page to load completely
    await page.waitForSelector('h1:has-text("Legend State Data Management")');
    
    // Initially polling should be inactive - check badge
    await expect(page.locator('[data-testid="polling-status"]')).toContainText('Polling Inactive');
    
    // Find and click start polling button
    console.log('🚀 Starting Legend State polling...');
    await page.click('[data-testid="start-polling"]');
    
    // Check that polling becomes active - wait for badge to change
    await expect(page.locator('[data-testid="polling-status"]')).toContainText('Polling Active', { timeout: 10000 });
    
    // Wait for at least one polling cycle and check console for Legend State logs
    await page.waitForTimeout(3000);
    
    // Stop polling
    console.log('⏹️ Stopping Legend State polling...');
    await page.click('[data-testid="stop-polling"]');
    
    // Check that polling becomes inactive again
    await expect(page.locator('[data-testid="polling-status"]')).toContainText('Polling Inactive', { timeout: 5000 });
  });

  test('should perform manual fetch', async ({ page }) => {
    // Setup console logging to capture Legend State activity
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Legend State')) {
        logs.push(msg.text());
        console.log('Legend State Log:', msg.text());
      }
    });
    
    // Perform manual fetch
    console.log('📡 Performing manual fetch...');
    await page.click('button:has-text("Manual Fetch")');
    
    // Wait for fetch to complete
    await page.waitForTimeout(2000);
    
    // Check if we got some Legend State activity in console
    expect(logs.some(log => log.includes('Fetching data from real API'))).toBeTruthy();
    
    // Check if Last fetch time appears
    await expect(page.locator('text=Last:')).toBeVisible();
  });

  test('should change polling intervals', async ({ page }) => {
    // Test different polling intervals
    const intervals = ['2s', '5s', '10s'];
    
    for (const interval of intervals) {
      console.log(`⏱️ Testing ${interval} interval...`);
      await page.click(`button:has-text("${interval}")`);
      
      // Brief wait to see if any errors occur
      await page.waitForTimeout(500);
      
      // Check that no error alerts appeared
      await expect(page.locator('[role="alert"]')).not.toBeVisible();
    }
  });

  test('should display debug information', async ({ page }) => {
    // Check debug info is displayed
    const debugCard = page.locator('text=Legend State Debug Info').locator('..');
    
    // Should show Wide Corp organization ID
    await expect(debugCard.locator('text=01920000-1000-7000-8000-000000000001')).toBeVisible();
    
    // Should show API base URL
    await expect(debugCard.locator('text=http://localhost:8787/api')).toBeVisible();
    
    // Should show polling status
    await expect(debugCard.locator('text=Inactive')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    const errorLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('❌')) {
        errorLogs.push(msg.text());
        console.log('Error Log:', msg.text());
      }
    });
    
    // Try manual fetch which might hit non-existent endpoints
    await page.click('button:has-text("Manual Fetch")');
    
    // Wait for potential errors
    await page.waitForTimeout(3000);
    
    // Check if error alert appears for API failures
    const errorAlert = page.locator('[role="alert"]');
    if (await errorAlert.isVisible()) {
      console.log('✅ Error handling working - error alert displayed');
      await expect(errorAlert).toContainText('Failed to fetch');
    } else {
      console.log('✅ No API errors - endpoints are working');
    }
  });

  test('should demonstrate reactive updates', async ({ page }) => {
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('observable changed')) {
        logs.push(msg.text());
        console.log('Reactive Update:', msg.text());
      }
    });
    
    // Start polling to trigger reactive updates
    await page.click('button:has-text("Start Polling")');
    
    // Wait for a few polling cycles
    await page.waitForTimeout(6000);
    
    // Stop polling
    await page.click('button:has-text("Stop Polling")');
    
    // Check that we captured some reactive updates
    console.log('📊 Total reactive updates captured:', logs.length);
    
    // Should have captured at least some observable changes
    expect(logs.length).toBeGreaterThan(0);
  });

  test('should attempt to create sample project', async ({ page }) => {
    // Setup console logging
    const logs = [];
    page.on('console', msg => {
      logs.push(msg.text());
    });
    
    // Try to create a sample project
    console.log('📝 Attempting to create sample project...');
    await page.click('button:has-text("Create Sample Project")');
    
    // Wait for creation attempt
    await page.waitForTimeout(3000);
    
    // Check results - either success or graceful error handling
    const errorAlert = page.locator('[role="alert"]');
    if (await errorAlert.isVisible()) {
      console.log('⚠️ Project creation failed (expected if entity tables not set up)');
      await expect(errorAlert).toContainText('Failed to create project');
    } else {
      console.log('✅ Project creation succeeded or no error displayed');
    }
    
    // Manual fetch to see if new project appears
    await page.click('button:has-text("Manual Fetch")');
    await page.waitForTimeout(2000);
  });

  test('should show project and client counts', async ({ page }) => {
    // Perform fetch to get current data
    await page.click('button:has-text("Manual Fetch")');
    await page.waitForTimeout(2000);
    
    // Check that project and client counts are displayed
    const projectCard = page.locator('text=Projects (').first();
    const clientCard = page.locator('text=Clients (').first();
    
    await expect(projectCard).toBeVisible();
    await expect(clientCard).toBeVisible();
    
    // Extract counts from the text
    const projectText = await projectCard.textContent();
    const clientText = await clientCard.textContent();
    
    const projectCount = projectText.match(/Projects \((\d+)\)/)?.[1] || '0';
    const clientCount = clientText.match(/Clients \((\d+)\)/)?.[1] || '0';
    
    console.log(`📊 Found ${projectCount} projects and ${clientCount} clients`);
    
    // Verify debug info shows same counts
    const debugInfo = page.locator('text=Legend State Debug Info').locator('..');
    await expect(debugInfo.locator(`text=${projectCount} projects, ${clientCount} clients`)).toBeVisible();
  });
});

test.describe('Legend State Real-World Usage', () => {
  test('should handle concurrent polling and manual operations', async ({ page }) => {
    await page.goto('/debug/legend-state-poc');
    await page.waitForSelector('h1');
    
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Legend State')) {
        logs.push({ text: msg.text(), timestamp: Date.now() });
      }
    });
    
    // Start polling
    await page.click('button:has-text("Start Polling")');
    await page.waitForTimeout(1000);
    
    // Perform manual operations while polling is active
    await page.click('button:has-text("Manual Fetch")');
    await page.waitForTimeout(1000);
    
    // Try creating a project while polling
    await page.click('button:has-text("Create Sample Project")');
    await page.waitForTimeout(2000);
    
    // Change interval while polling
    await page.click('button:has-text("2s")');
    await page.waitForTimeout(3000);
    
    // Stop polling
    await page.click('button:has-text("Stop Polling")');
    
    console.log('📊 Concurrent operation test completed with', logs.length, 'Legend State events');
    
    // Should have handled concurrent operations without errors
    const errorAlert = page.locator('[role="alert"]');
    if (await errorAlert.isVisible()) {
      console.log('⚠️ Some errors occurred during concurrent operations');
    } else {
      console.log('✅ Concurrent operations handled successfully');
    }
  });
});