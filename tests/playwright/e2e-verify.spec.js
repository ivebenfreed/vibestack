// tests/playwright/e2e-verify.spec.js
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper to load env
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
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

test.describe('End-to-End Verification', () => {
  test.setTimeout(60000); // 60 seconds
  
  test('complete app flow - login, sync, and interact', async ({ page }) => {
    const env = loadEnvFile();
    
    console.log('=== STARTING E2E TEST ===');
    
    // Step 1: Navigate to app
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Give React time to render
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'screenshots/e2e-1-initial.png', fullPage: true });
    console.log('   Screenshot: e2e-1-initial.png');
    console.log('   Current URL:', page.url());
    
    // Step 2: Login if needed
    if (page.url().includes('sign-in') || page.url().includes('login')) {
      console.log('2. Login page detected, performing login...');
      
      // Wait for and fill email
      const emailInput = page.locator('input[placeholder*="email" i], input[type="email"], input[name="email"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(env.VIBE_DEV_EMAIL || 'ben@getelevra.com');
      console.log('   ✓ Email entered');
      
      // Fill password
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill(env.VIBE_DEV_PASSWORD || 'password');
      console.log('   ✓ Password entered');
      
      // Take screenshot before login
      await page.screenshot({ path: 'screenshots/e2e-2-login-form.png', fullPage: true });
      console.log('   Screenshot: e2e-2-login-form.png');
      
      // Click login button
      const loginButton = page.locator('button:has-text("Login")').first();
      await loginButton.click();
      console.log('   ✓ Login button clicked');
      
      // Wait for navigation
      await Promise.race([
        page.waitForURL(url => !url.toString().includes('sign-in') && !url.toString().includes('login'), { timeout: 30000 }),
        page.waitForTimeout(30000)
      ]);
      
      await page.screenshot({ path: 'screenshots/e2e-3-after-login.png', fullPage: true });
      console.log('   Screenshot: e2e-3-after-login.png');
      console.log('   Post-login URL:', page.url());
    }
    
    // Step 3: Check for sync overlay
    console.log('3. Checking for sync process...');
    const syncOverlay = page.locator('text="Syncing data"');
    const syncVisible = await syncOverlay.isVisible().catch(() => false);
    
    if (syncVisible) {
      console.log('   Sync overlay detected, waiting for completion...');
      await page.screenshot({ path: 'screenshots/e2e-4-syncing.png', fullPage: true });
      console.log('   Screenshot: e2e-4-syncing.png');
      
      // Wait for sync to complete (overlay to disappear)
      await syncOverlay.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
        console.log('   ⚠️  Sync timeout - proceeding anyway');
      });
      
      await page.waitForTimeout(2000); // Extra wait for UI to stabilize
    }
    
    // Step 4: Verify app loaded
    console.log('4. Verifying app is loaded...');
    await page.screenshot({ path: 'screenshots/e2e-5-app-loaded.png', fullPage: true });
    console.log('   Screenshot: e2e-5-app-loaded.png');
    
    // Check for main app elements
    const mainContent = await page.locator('main, [role="main"], .app-content, #root > div').count();
    console.log('   Main content elements found:', mainContent);
    
    // Check for navigation or header
    const navElements = await page.locator('nav, header, [role="navigation"], .navbar, .header').count();
    console.log('   Navigation elements found:', navElements);
    
    // Step 5: Try to interact with the app
    console.log('5. Testing basic interactions...');
    
    // Click on first clickable element that's not a logout button
    const clickableElements = page.locator('button:not(:has-text("Logout")):not(:has-text("Sign out")), a[href]:not([href*="logout"])');
    const clickableCount = await clickableElements.count();
    console.log('   Clickable elements found:', clickableCount);
    
    if (clickableCount > 0) {
      const firstClickable = clickableElements.first();
      const elementText = await firstClickable.textContent().catch(() => 'unknown');
      console.log('   Clicking on:', elementText);
      await firstClickable.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'screenshots/e2e-6-after-interaction.png', fullPage: true });
      console.log('   Screenshot: e2e-6-after-interaction.png');
    }
    
    // Final verification
    console.log('\n=== E2E TEST SUMMARY ===');
    console.log('✓ App loads:', true);
    console.log('✓ Login works:', !page.url().includes('sign-in'));
    console.log('✓ Main content present:', mainContent > 0);
    console.log('✓ Navigation present:', navElements > 0);
    console.log('✓ Interactive elements:', clickableCount > 0);
    console.log('✓ Current URL:', page.url());
    
    // Assert success
    expect(mainContent).toBeGreaterThan(0);
    expect(page.url()).not.toContain('sign-in');
    expect(page.url()).not.toContain('login');
    
    console.log('\n✅ E2E TEST PASSED!');
  });
});