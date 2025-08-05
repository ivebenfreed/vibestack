// tests/playwright/test-template.spec.js
// Template for new Playwright tests - uses persistent browser context
import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Test Template', () => {
  test.setTimeout(60000);
  
  test.beforeEach(async ({ page }) => {
    console.log('🚀 Setting up test...');
    
    // Navigate to the app
    await page.goto('/');
    console.log('🌐 Navigated to app');
    
    // With persistent context, we should already be logged in
    // Just wait for app initialization
    await page.waitForFunction(() => {
      // Check if React app is ready
      return document.querySelector('#root') && 
             !document.querySelector('[data-loading="true"]');
    }, { timeout: 30000 });
    
    console.log('✅ App initialized with persistent context');
    
    // Wait for any sync overlay to disappear
    const syncOverlay = page.locator('text="Syncing data"');
    if (await syncOverlay.isVisible().catch(() => false)) {
      console.log('⏳ Waiting for sync to complete...');
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {
        console.log('⚠️ Sync overlay timeout');
      });
    }
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'screenshots/test-setup.png',
      fullPage: true 
    });
  });
  
  test('should load app successfully', async ({ page }) => {
    console.log('\n=== APP LOADING TEST ===');
    
    // Verify we're on the main app
    const isOnApp = await page.evaluate(() => {
      const path = window.location.pathname;
      return !path.includes('/login') && 
             !path.includes('/sign-in') &&
             !path.includes('/handler');
    });
    
    expect(isOnApp).toBe(true);
    console.log('✅ App loaded successfully');
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/app-loaded.png',
      fullPage: true 
    });
  });
  
  test('should have interactive elements', async ({ page }) => {
    console.log('\n=== INTERACTIVITY TEST ===');
    
    // Count interactive elements
    const interactiveCount = await page.locator('button:visible, a[href]:visible, input:visible').count();
    console.log(`📊 Found ${interactiveCount} interactive elements`);
    
    expect(interactiveCount).toBeGreaterThan(0);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/interactive-elements.png',
      fullPage: true 
    });
  });
  
  // Template for navigation test
  test('should navigate to specific page', async ({ page }) => {
    console.log('\n=== NAVIGATION TEST ===');
    
    // Example: Navigate to debug page
    await page.goto('/debug');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    expect(currentUrl).toContain('/debug');
    
    await page.screenshot({ 
      path: 'screenshots/navigation-test.png',
      fullPage: true 
    });
  });
  
  test.afterAll(async () => {
    console.log('\n=== TESTS COMPLETE ===');
    console.log('📸 Screenshots saved in: ./screenshots/');
  });
});