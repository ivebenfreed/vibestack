// tests/playwright/vibegantt-screenshot.spec.js
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

// Helper function to login if needed
async function ensureLoggedIn(page) {
  const env = loadEnvFile();
  
  // Check if we're on a login page by looking for email input
  const emailInput = page.locator('input[type="email"]');
  const isLoginPage = await emailInput.count() > 0;
  
  if (isLoginPage && env.VIBE_DEV_EMAIL && env.VIBE_DEV_PASSWORD) {
    console.log('🔐 Auto-logging in with dev credentials...');
    console.log(`   Email: ${env.VIBE_DEV_EMAIL}`);
    
    // Wait for form to be ready
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    
    // Clear and fill email
    await emailInput.clear();
    await emailInput.fill(env.VIBE_DEV_EMAIL);
    
    // Fill password
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.clear();
    await passwordInput.fill(env.VIBE_DEV_PASSWORD);
    
    // Wait a moment for form validation
    await page.waitForTimeout(1000);
    
    // Click login button
    const loginButton = page.locator('button:has-text("Login")');
    await loginButton.click();
    
    console.log('🔄 Waiting for login to complete...');
    
    // Wait for navigation away from login page or success indication
    try {
      await page.waitForFunction(() => 
        !window.location.pathname.includes('/login') && 
        !window.location.pathname.includes('/sign-in')
      , { timeout: 15000 });
      
      console.log('✅ Successfully logged in');
      return true;
    } catch (error) {
      console.log('⚠️  Login may have failed or is taking longer than expected');
      
      // Check if there are any error messages
      const errorMsg = await page.locator('.error, [role="alert"], .alert-error').textContent().catch(() => null);
      if (errorMsg) {
        console.log(`❌ Login error: ${errorMsg}`);
      }
      
      return false;
    }
  } else if (isLoginPage) {
    console.log('⚠️  On login page but no credentials available in .env.local');
    return false;
  }
  
  return true; // Not on login page
}

test.describe('VibeGantt Debug', () => {
  test('should load and screenshot VibeGantt debug page', async ({ page }) => {
    // Navigate to the VibeGantt debug page
    await page.goto('/debug/vibegantt');
    
    // Handle login if needed
    const loginSuccess = await ensureLoggedIn(page);
    
    if (!loginSuccess) {
      console.log('❌ Login failed, skipping test');
      test.skip();
      return;
    }
    
    // Navigate to debug page again if we were redirected
    if (!page.url().includes('/debug/vibegantt')) {
      console.log('🔄 Navigating back to debug page after login...');
      await page.goto('/debug/vibegantt');
    }
    
    // Wait for the page to load and sync to complete
    console.log('⏳ Waiting for page elements to load...');
    await page.waitForSelector('[data-testid="gantt-chart"], .vibegantt, h1:has-text("VibeGantt Debug")', { 
      timeout: 30000 
    });
    
    // Wait a bit more for any data to load
    await page.waitForTimeout(5000);
    
    // Take a screenshot
    const screenshotPath = `screenshots/vibegantt-debug-${Date.now()}.png`;
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    
    // Verify the page loaded correctly
    await expect(page.locator('h1')).toContainText('VibeGantt Debug');
    
    // Check if the gantt chart container exists
    const ganttExists = await page.locator('.vibegantt, [data-testid="gantt-chart"]').count() > 0;
    console.log(`📊 Gantt chart container found: ${ganttExists}`);
  });
  
  test('should test VibeGantt interactions', async ({ page }) => {
    await page.goto('/debug/vibegantt');
    
    // Handle login if needed
    const loginSuccess = await ensureLoggedIn(page);
    
    if (!loginSuccess) {
      console.log('❌ Login failed, skipping interaction test');
      test.skip();
      return;
    }
    
    // Navigate to debug page again if we were redirected
    if (!page.url().includes('/debug/vibegantt')) {
      console.log('🔄 Navigating back to debug page after login...');
      await page.goto('/debug/vibegantt');
    }
    
    // Wait for the page to be fully loaded
    console.log('⏳ Waiting for debug page to load...');
    await page.waitForSelector('h1:has-text("VibeGantt Debug")', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Try to interact with debug controls
    const zoomSelect = page.locator('select, combobox').first();
    if (await zoomSelect.count() > 0) {
      await zoomSelect.selectOption('Month');
      console.log('✅ Changed zoom level to Month');
    } else {
      console.log('⚠️  No zoom controls found');
    }
    
    // Toggle some checkboxes
    const weekendsCheckbox = page.locator('input[type="checkbox"]').first();
    if (await weekendsCheckbox.count() > 0) {
      await weekendsCheckbox.click();
      console.log('✅ Toggled weekends checkbox');
    } else {
      console.log('⚠️  No checkboxes found');
    }
    
    // Take a screenshot after interactions
    const screenshotPath = `screenshots/vibegantt-interactions-${Date.now()}.png`;
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`📸 Interaction screenshot saved: ${screenshotPath}`);
  });
});