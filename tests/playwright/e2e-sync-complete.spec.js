// tests/playwright/e2e-sync-complete.spec.js
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

test.describe('E2E with Sync Completion', () => {
  test.setTimeout(120000); // 2 minutes
  
  test('login and wait for sync to complete', async ({ page }) => {
    const env = loadEnvFile();
    
    console.log('=== E2E TEST WITH SYNC COMPLETION ===');
    
    // Enable console logging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('sync') || text.includes('Sync') || text.includes('SYNC')) {
        console.log('   [Browser]:', text);
      }
    });
    
    // Step 1: Navigate to app
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/sync-1-initial.png', fullPage: true });
    console.log('   Screenshot: sync-1-initial.png');
    console.log('   URL:', page.url());
    
    // Step 2: Login if needed
    if (page.url().includes('sign-in')) {
      console.log('2. Performing login...');
      
      // Fill credentials
      await page.fill('input[type="email"]', env.VIBE_DEV_EMAIL || 'ben@getelevra.com');
      await page.fill('input[type="password"]', env.VIBE_DEV_PASSWORD || 'password');
      
      await page.screenshot({ path: 'screenshots/sync-2-credentials.png', fullPage: true });
      console.log('   Screenshot: sync-2-credentials.png');
      
      // Click login
      await page.click('button:has-text("Login")');
      console.log('   ✓ Login clicked');
      
      // Wait for navigation away from login
      await page.waitForURL(url => !url.toString().includes('sign-in'), { timeout: 30000 });
      console.log('   ✓ Navigated away from login');
    }
    
    // Step 3: Handle sync overlay
    console.log('3. Checking for sync overlay...');
    await page.waitForTimeout(2000); // Let UI stabilize
    
    await page.screenshot({ path: 'screenshots/sync-3-after-login.png', fullPage: true });
    console.log('   Screenshot: sync-3-after-login.png');
    
    // Look for sync overlay
    const syncOverlay = page.locator('text="Syncing data"');
    const syncVisible = await syncOverlay.isVisible().catch(() => false);
    
    if (syncVisible) {
      console.log('   ✓ Sync overlay detected');
      console.log('   Waiting for sync to complete...');
      
      // Wait for sync overlay to disappear
      try {
        await syncOverlay.waitFor({ state: 'detached', timeout: 60000 });
        console.log('   ✓ Sync overlay disappeared');
      } catch (e) {
        console.log('   ⚠️ Sync timeout - checking if app is still functional');
        
        // Take screenshot of current state
        await page.screenshot({ path: 'screenshots/sync-timeout.png', fullPage: true });
        
        // Try to close the overlay manually if there's a button
        const closeButton = page.locator('button:has-text("Close"), button:has-text("Skip"), button:has-text("Continue")');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          console.log('   ✓ Closed sync overlay manually');
        }
      }
      
      // Wait for UI to stabilize after sync
      await page.waitForTimeout(3000);
    } else {
      console.log('   No sync overlay visible');
    }
    
    // Step 4: Verify app is fully loaded
    console.log('4. Verifying app is fully loaded...');
    await page.screenshot({ path: 'screenshots/sync-4-app-ready.png', fullPage: true });
    console.log('   Screenshot: sync-4-app-ready.png');
    
    // Check for app content
    const appContent = await page.locator('main, [role="main"], .app-content').count();
    const navContent = await page.locator('nav, header, .sidebar, [role="navigation"]').count();
    const buttons = await page.locator('button:visible').count();
    
    console.log('   App content elements:', appContent);
    console.log('   Navigation elements:', navContent);
    console.log('   Visible buttons:', buttons);
    
    // Step 5: Perform actual interactions
    console.log('5. Testing real interactions...');
    
    // Try to find and click on a meaningful element
    const menuItems = page.locator('a[href], button:not(:has-text("Logout")):not(:has-text("Sign out"))').filter({ hasText: /tasks|projects|dashboard|home|create|new|add/i });
    const menuCount = await menuItems.count();
    
    if (menuCount > 0) {
      const firstItem = menuItems.first();
      const itemText = await firstItem.textContent();
      console.log(`   Clicking on menu item: "${itemText}"`);
      await firstItem.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'screenshots/sync-5-after-click.png', fullPage: true });
      console.log('   Screenshot: sync-5-after-click.png');
      console.log('   New URL:', page.url());
    }
    
    // Step 6: Final verification
    console.log('\n=== FINAL VERIFICATION ===');
    
    // Make sure we're not stuck on sync
    const stillSyncing = await page.locator('text="Syncing data"').isVisible().catch(() => false);
    console.log('Still syncing:', stillSyncing);
    
    // Check final state
    const finalUrl = page.url();
    const isLoggedIn = !finalUrl.includes('sign-in') && !finalUrl.includes('login');
    const hasContent = appContent > 0 || navContent > 0;
    
    console.log('✓ Logged in:', isLoggedIn);
    console.log('✓ Has content:', hasContent);
    console.log('✓ Not stuck on sync:', !stillSyncing);
    console.log('✓ Final URL:', finalUrl);
    
    // Assertions
    expect(isLoggedIn).toBe(true);
    expect(hasContent).toBe(true);
    expect(stillSyncing).toBe(false);
    
    console.log('\n✅ E2E TEST WITH SYNC PASSED!');
  });
});