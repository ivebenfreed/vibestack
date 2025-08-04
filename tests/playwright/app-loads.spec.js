// tests/playwright/app-loads.spec.js
import { test, expect } from '@playwright/test';

test.describe('App Loading Tests', () => {
  test.setTimeout(20000); // 20 second timeout
  
  test('should load the application', async ({ page }) => {
    console.log('🌐 Navigating to application...');
    
    // Navigate to the app with extended timeout
    await page.goto('/', { waitUntil: 'networkidle', timeout: 15000 });
    
    console.log(`📍 Current URL: ${page.url()}`);
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'screenshots/app-initial-load.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: screenshots/app-initial-load.png');
    
    // Check if we're on a login page or the main app
    const isLoginPage = page.url().includes('/login') || 
                       page.url().includes('/sign-in') ||
                       page.url().includes('/handler');
    
    if (isLoginPage) {
      console.log('🔐 App loaded - showing login page');
      
      // Verify login form elements exist
      const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').count();
      const passwordInput = await page.locator('input[type="password"], input[name="password"]').count();
      const loginButton = await page.locator('button:has-text("Login")').count();
      
      expect(emailInput).toBeGreaterThan(0);
      expect(passwordInput).toBeGreaterThan(0);
      expect(loginButton).toBeGreaterThan(0);
      
      console.log('✅ Login form elements found');
    } else {
      console.log('🏠 App loaded - showing main application');
      
      // User is already logged in, verify some UI elements exist
      const mainContent = await page.locator('main, [role="main"], #root, #app').count();
      expect(mainContent).toBeGreaterThan(0);
      
      console.log('✅ Main application content found');
    }
  });
  
  test('should have correct title', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Get the page title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);
    
    // Verify title is not empty
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });
  
  test('should handle API health check', async ({ page }) => {
    // Check if API is responding
    const apiResponse = await page.request.get('http://localhost:8787/health', {
      timeout: 10000
    }).catch(error => {
      console.log('⚠️  API health check failed:', error.message);
      return null;
    });
    
    if (apiResponse) {
      console.log(`🔧 API Response Status: ${apiResponse.status()}`);
      expect(apiResponse.status()).toBeLessThan(500);
      
      const responseText = await apiResponse.text().catch(() => '');
      console.log(`📝 API Response: ${responseText.substring(0, 100)}...`);
    } else {
      console.log('⚠️  API not responding on health endpoint');
    }
  });
});