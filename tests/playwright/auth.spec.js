// tests/playwright/auth.spec.js
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to load environment variables
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env.local not found, login credentials not available');
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  
  return env;
}

test.describe('Authentication Tests', () => {
  test.setTimeout(30000); // 30 second timeout for each test
  
  test('should successfully login with valid credentials', async ({ page }) => {
    const env = loadEnvFile();
    
    // Skip test if no credentials are available
    if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
      console.log('⚠️  Skipping test: No credentials found in .env.local');
      console.log('   Add VIBE_DEV_EMAIL and VIBE_DEV_PASSWORD to .env.local');
      test.skip();
      return;
    }
    
    // Navigate to the app
    await page.goto('/');
    console.log('🌐 Navigated to app root');
    
    // Check if we're already logged in
    const isLoggedIn = await page.evaluate(() => {
      return !window.location.pathname.includes('/login') && 
             !window.location.pathname.includes('/sign-in') &&
             !window.location.pathname.includes('/handler');
    });
    
    if (isLoggedIn) {
      console.log('✅ Already logged in, logging out first...');
      
      // Look for user menu or logout button
      const userButton = page.locator('[data-testid="user-button"], button:has-text("Logout"), button[aria-label*="user"], button[aria-label*="account"]');
      if (await userButton.count() > 0) {
        await userButton.first().click();
        await page.waitForTimeout(500);
        
        // Click logout option
        const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out")');
        if (await logoutButton.count() > 0) {
          await logoutButton.first().click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // Wait for login page to load
    console.log('⏳ Waiting for login page...');
    await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', { 
      timeout: 30000 
    });
    
    // Find and fill email field
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.clear();
    await emailInput.fill(env.VIBE_DEV_EMAIL);
    console.log(`📧 Entered email: ${env.VIBE_DEV_EMAIL}`);
    
    // Find and fill password field
    const passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first();
    await passwordInput.waitFor({ state: 'visible' });
    await passwordInput.clear();
    await passwordInput.fill(env.VIBE_DEV_PASSWORD);
    console.log('🔑 Entered password');
    
    // Wait for form validation
    await page.waitForTimeout(1000);
    
    // Take screenshot before login
    await page.screenshot({ 
      path: 'screenshots/auth-login-form.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: screenshots/auth-login-form.png');
    
    // Find and click login button
    const loginButton = page.locator('button:has-text("Login")').first();
    await loginButton.waitFor({ state: 'visible' });
    await loginButton.click();
    console.log('🔄 Login button clicked, waiting for authentication...');
    
    // Wait for successful login (redirect away from login page)
    try {
      await page.waitForFunction(() => {
        const path = window.location.pathname;
        return !path.includes('/login') && 
               !path.includes('/sign-in') &&
               !path.includes('/handler');
      }, { timeout: 30000 });
      
      console.log('✅ Successfully logged in!');
      console.log(`📍 Current URL: ${page.url()}`);
      
      // Take screenshot after successful login
      await page.waitForTimeout(2000); // Wait for page to fully load
      await page.screenshot({ 
        path: 'screenshots/auth-logged-in.png',
        fullPage: true 
      });
      console.log('📸 Screenshot saved: screenshots/auth-logged-in.png');
      
      // Verify we can see authenticated content
      await page.waitForTimeout(2000); // Give page time to render
      const authenticatedElements = await page.locator('nav, header, main, [data-testid="dashboard"], [data-testid="user-menu"], .authenticated-content').count();
      console.log(`✅ Found ${authenticatedElements} authenticated UI elements`);
      
      // Just verify we're not on login page anymore
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/login');
      expect(currentUrl).not.toContain('/sign-in');
      expect(currentUrl).not.toContain('/handler');
      
    } catch (error) {
      console.log('❌ Login failed or timed out');
      
      // Check for error messages
      const errorMessages = await page.locator('.error, [role="alert"], .alert-error, [data-testid="error-message"]').allTextContents();
      if (errorMessages.length > 0) {
        console.log('❌ Error messages found:', errorMessages);
      }
      
      // Take screenshot of error state
      await page.screenshot({ 
        path: 'screenshots/auth-login-error.png',
        fullPage: true 
      });
      console.log('📸 Error screenshot saved: screenshots/auth-login-error.png');
      
      throw new Error('Login failed');
    }
  });
  
  test('should handle invalid credentials', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for login page
    await page.waitForSelector('input[type="email"], input[name="email"]', { 
      timeout: 30000 
    });
    
    // Try to login with invalid credentials
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill('invalid@example.com');
    
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill('wrongpassword');
    
    // Click login
    const loginButton = page.locator('button:has-text("Login")').first();
    await loginButton.click();
    
    // Wait for error message
    await page.waitForTimeout(2000);
    
    // Check that we're still on login page
    const stillOnLoginPage = await page.evaluate(() => {
      const path = window.location.pathname;
      return path.includes('/login') || 
             path.includes('/sign-in') ||
             path.includes('/handler');
    });
    
    expect(stillOnLoginPage).toBeTruthy();
    console.log('✅ Correctly stayed on login page with invalid credentials');
    
    // Look for error messages
    const errorVisible = await page.locator('.error, [role="alert"], .alert-error, [data-testid="error-message"], .text-red-500').count() > 0;
    if (errorVisible) {
      console.log('✅ Error message displayed for invalid credentials');
    }
  });
  
  test('should maintain session across page refreshes', async ({ page }) => {
    const env = loadEnvFile();
    
    // Skip if no credentials
    if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
      test.skip();
      return;
    }
    
    // Login first
    await page.goto('/');
    
    // Perform login if needed
    const needsLogin = await page.evaluate(() => {
      const path = window.location.pathname;
      return path.includes('/login') || 
             path.includes('/sign-in') ||
             path.includes('/handler');
    });
    
    if (needsLogin) {
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      await emailInput.fill(env.VIBE_DEV_EMAIL);
      
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
      await passwordInput.fill(env.VIBE_DEV_PASSWORD);
      
      const loginButton = page.locator('button:has-text("Login")').first();
      await loginButton.click();
      
      // Wait for login to complete
      await page.waitForFunction(() => {
        const path = window.location.pathname;
        return !path.includes('/login') && 
               !path.includes('/sign-in') &&
               !path.includes('/handler');
      }, { timeout: 30000 });
    }
    
    // Get current URL after login
    const urlAfterLogin = page.url();
    console.log(`📍 URL after login: ${urlAfterLogin}`);
    
    // Refresh the page
    await page.reload();
    console.log('🔄 Page refreshed');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Check that we're still logged in (not redirected to login)
    const stillLoggedIn = await page.evaluate(() => {
      const path = window.location.pathname;
      return !path.includes('/login') && 
             !path.includes('/sign-in') &&
             !path.includes('/handler');
    });
    
    expect(stillLoggedIn).toBeTruthy();
    console.log('✅ Session maintained after refresh');
    
    // Verify authenticated content is still visible
    const authenticatedElements = await page.locator('nav, header, [data-testid="dashboard"], [data-testid="user-menu"]').count();
    expect(authenticatedElements).toBeGreaterThan(0);
    console.log('✅ Authenticated UI elements still visible after refresh');
  });
});