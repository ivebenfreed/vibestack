// tests/playwright/test-template.spec.js
// Template for new Playwright tests - uses existing auth state gracefully
import { test, expect } from '@playwright/test';

test.describe('Test Template', () => {
  test.setTimeout(60000);
  
  test.beforeEach(async ({ page }) => {
    console.log('🚀 Setting up test...');
    
    // Navigate to the app
    await page.goto('/');
    console.log('🌐 Navigated to app');
    
    // Check if we need to handle auth (graceful fallback)
    const needsAuth = await page.evaluate(() => {
      const path = window.location.pathname;
      const hasLoginForm = document.querySelector('input[type="email"], input[name="email"]');
      return (path.includes('/login') || 
              path.includes('/sign-in') ||
              path.includes('/handler')) || hasLoginForm;
    });
    
    if (needsAuth) {
      console.log('🔐 Auth state expired, logging in...');
      
      // Load credentials from environment
      const email = process.env.VIBE_DEV_EMAIL || 'ben@getelevra.com';
      const password = process.env.VIBE_DEV_PASSWORD;
      
      if (!password) {
        console.log('⚠️ No password found in environment, skipping auth');
        test.skip();
        return;
      }
      
      // Fill login form
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
      await page.locator('input[type="email"], input[name="email"]').first().fill(email);
      await page.locator('input[type="password"], input[name="password"]').first().fill(password);
      await page.locator('button:has-text("Login")').first().click();
      
      // Wait for redirect
      await page.waitForFunction(() => {
        const path = window.location.pathname;
        return !path.includes('/login') && 
               !path.includes('/sign-in') &&
               !path.includes('/handler');
      }, { timeout: 30000 });
      
      console.log('✅ Login successful');
    } else {
      console.log('✅ Already authenticated via stored state');
    }
    
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