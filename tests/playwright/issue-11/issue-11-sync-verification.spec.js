import { test, expect } from '@playwright/test';

test.describe('Issue 11: Entity Dependencies Sync Verification', () => {
  test('should login, complete initial sync, and verify all tables are populated without errors', async ({ page, context }) => {
    test.setTimeout(60000); // Increase timeout to 60 seconds for full sync
    // Array to collect console messages
    const consoleMessages = [];
    const consoleErrors = [];
    
    // Listen to console events
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      
      if (type === 'error') {
        consoleErrors.push(text);
      }
      
      consoleMessages.push({ type, text });
      
      // Log sync-related messages for debugging
      if (text.includes('sync') || text.includes('Sync') || text.includes('entity_dependencies') || text.includes('Dexie')) {
        console.log(`[${type}] ${text}`);
      }
    });

    // Navigate to the app
    await page.goto('http://localhost:5283');
    
    // Wait for the login form
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    
    // Login with test credentials from environment
    const email = process.env.VIBE_DEV_EMAIL || 'test@example.com';
    const password = process.env.VIBE_DEV_PASSWORD || 'password123';
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    
    // Click the login button
    await page.click('button[type="submit"]');
    
    // Wait for redirect to main app after successful login (could be dashboard or projects)
    await page.waitForURL((url) => {
      return url.pathname === '/' || url.pathname.includes('/projects') || url.pathname.includes('/dashboard');
    }, { timeout: 30000 });
    
    // Wait for initial sync to complete
    // We'll look for sync completion indicators
    await page.waitForTimeout(5000); // Give initial sync time to start
    
    // Wait for the page to load and sync to complete
    // Look for "Users Table" text which appears on the dashboard
    await page.waitForFunction(() => {
      const bodyText = document.body.innerText || '';
      return bodyText.includes('Users Table') && bodyText.includes('Projects Table');
    }, { timeout: 30000 });
    
    // Additional wait to ensure all background sync operations complete
    await page.waitForTimeout(3000);
    
    // Verify no Dexie table errors
    const dexieErrors = consoleErrors.filter(error => 
      error.includes('Dexie table not found') || 
      error.includes('entity_dependencies')
    );
    
    expect(dexieErrors).toHaveLength(0);
    
    // Verify no "No incoming function support" errors
    const incomingFunctionErrors = consoleErrors.filter(error =>
      error.includes('No incoming function support')
    );
    
    expect(incomingFunctionErrors).toHaveLength(0);
    
    // Check the dashboard shows data has synced
    const dashboardText = await page.textContent('body');
    
    // Verify data is shown on dashboard
    expect(dashboardText).toContain('Users Table');
    expect(dashboardText).toContain('46'); // Users count
    expect(dashboardText).toContain('Projects Table');
    expect(dashboardText).toContain('41'); // Projects count
    expect(dashboardText).toContain('Tasks Table');
    expect(dashboardText).toContain('145'); // Tasks count
    
    // The critical verification is that there were no Dexie table errors
    // If entity_dependencies synced correctly, there should be no errors
    
    // Check for sync completion messages in console
    const syncMessages = consoleMessages.filter(msg => 
      msg.text.includes('Initial sync completed') ||
      msg.text.includes('sync finished') ||
      msg.text.includes('Sync complete')
    );
    
    // Log summary
    console.log('\n=== Sync Verification Summary ===');
    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log(`Dexie-related errors: ${dexieErrors.length}`);
    console.log(`Sync completion messages: ${syncMessages.length}`);
    console.log('================================\n');
    
    // Final assertion - no critical errors
    expect(consoleErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('Failed to load resource')
    )).toHaveLength(0);
  });
});