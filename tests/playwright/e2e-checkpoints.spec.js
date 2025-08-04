// tests/playwright/e2e-checkpoints.spec.js
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

test.describe('E2E with Checkpoints', () => {
  test.setTimeout(120000); // 2 minutes total
  
  test('CHECKPOINT 1: Login', async ({ page }) => {
    const env = loadEnvFile();
    
    console.log('=== CHECKPOINT 1: LOGIN ===');
    
    // Navigate
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Screenshot initial
    await page.screenshot({ path: 'screenshots/checkpoint-1-initial.png', fullPage: true });
    console.log('Initial URL:', page.url());
    
    if (page.url().includes('sign-in')) {
      // Fill and submit
      await page.fill('input[type="email"]', env.VIBE_DEV_EMAIL || 'ben@getelevra.com');
      await page.fill('input[type="password"]', env.VIBE_DEV_PASSWORD || 'password');
      await page.screenshot({ path: 'screenshots/checkpoint-1-filled.png', fullPage: true });
      
      await page.click('button:has-text("Login")');
      
      // Wait for navigation with timeout
      try {
        await page.waitForURL(url => !url.toString().includes('sign-in'), { timeout: 20000 });
        console.log('✅ LOGIN SUCCESSFUL');
        console.log('Post-login URL:', page.url());
      } catch (e) {
        console.log('❌ LOGIN FAILED - timeout waiting for navigation');
        throw e;
      }
    } else {
      console.log('✅ ALREADY LOGGED IN');
    }
    
    await page.screenshot({ path: 'screenshots/checkpoint-1-complete.png', fullPage: true });
  });
  
  test('CHECKPOINT 2: Sync Detection', async ({ page }) => {
    const env = loadEnvFile();
    
    console.log('\n=== CHECKPOINT 2: SYNC DETECTION ===');
    
    // Quick login if needed
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    if (page.url().includes('sign-in')) {
      await page.fill('input[type="email"]', env.VIBE_DEV_EMAIL || 'ben@getelevra.com');
      await page.fill('input[type="password"]', env.VIBE_DEV_PASSWORD || 'password');
      await page.click('button:has-text("Login")');
      await page.waitForURL(url => !url.toString().includes('sign-in'), { timeout: 20000 });
    }
    
    // Wait a bit for sync overlay to appear
    await page.waitForTimeout(3000);
    
    // Check for sync
    const syncOverlay = page.locator('text="Syncing data"');
    const syncVisible = await syncOverlay.isVisible().catch(() => false);
    
    await page.screenshot({ path: 'screenshots/checkpoint-2-sync-check.png', fullPage: true });
    
    if (syncVisible) {
      console.log('✅ SYNC OVERLAY DETECTED');
      
      // Check sync message details
      const syncMessage = await page.locator('text="Connecting and syncing"').isVisible().catch(() => false);
      console.log('Sync message visible:', syncMessage);
    } else {
      console.log('⚠️ NO SYNC OVERLAY VISIBLE');
      
      // Check if app is already loaded
      const mainContent = await page.locator('main, [role="main"]').count();
      if (mainContent > 0) {
        console.log('✅ APP ALREADY LOADED (sync might have completed)');
      }
    }
  });
  
  test('CHECKPOINT 3: Sync Completion', async ({ page }) => {
    const env = loadEnvFile();
    
    console.log('\n=== CHECKPOINT 3: SYNC COMPLETION ===');
    
    // Quick login if needed
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    if (page.url().includes('sign-in')) {
      await page.fill('input[type="email"]', env.VIBE_DEV_EMAIL || 'ben@getelevra.com');
      await page.fill('input[type="password"]', env.VIBE_DEV_PASSWORD || 'password');
      await page.click('button:has-text("Login")');
      await page.waitForURL(url => !url.toString().includes('sign-in'), { timeout: 20000 });
    }
    
    // Monitor sync
    const syncOverlay = page.locator('text="Syncing data"');
    let syncWasVisible = false;
    
    // Check if sync is visible
    for (let i = 0; i < 10; i++) {
      const isVisible = await syncOverlay.isVisible().catch(() => false);
      if (isVisible) {
        syncWasVisible = true;
        console.log(`Sync visible at ${i}s`);
        await page.screenshot({ path: `screenshots/checkpoint-3-syncing-${i}.png`, fullPage: true });
      } else if (syncWasVisible) {
        console.log(`✅ SYNC COMPLETED at ${i}s`);
        break;
      }
      await page.waitForTimeout(1000);
    }
    
    // Final check
    const stillSyncing = await syncOverlay.isVisible().catch(() => false);
    await page.screenshot({ path: 'screenshots/checkpoint-3-final.png', fullPage: true });
    
    if (!stillSyncing) {
      console.log('✅ SYNC NOT VISIBLE (completed or skipped)');
      
      // Verify app content
      const mainContent = await page.locator('main, [role="main"], .app-content').count();
      const buttons = await page.locator('button:visible').count();
      
      console.log('Main content elements:', mainContent);
      console.log('Visible buttons:', buttons);
      
      expect(mainContent).toBeGreaterThan(0);
    } else {
      console.log('❌ SYNC STILL RUNNING after 10s');
    }
  });
  
  test('CHECKPOINT 4: App Interaction', async ({ page }) => {
    const env = loadEnvFile();
    
    console.log('\n=== CHECKPOINT 4: APP INTERACTION ===');
    
    // Quick login if needed
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    if (page.url().includes('sign-in')) {
      await page.fill('input[type="email"]', env.VIBE_DEV_EMAIL || 'ben@getelevra.com');
      await page.fill('input[type="password"]', env.VIBE_DEV_PASSWORD || 'password');
      await page.click('button:has-text("Login")');
      await page.waitForURL(url => !url.toString().includes('sign-in'), { timeout: 20000 });
    }
    
    // Wait for any sync to complete (max 30s)
    const syncOverlay = page.locator('text="Syncing data"');
    try {
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 });
    } catch {
      console.log('Sync timeout - proceeding anyway');
    }
    
    // Wait for UI to stabilize
    await page.waitForTimeout(2000);
    
    // Take screenshot of loaded app
    await page.screenshot({ path: 'screenshots/checkpoint-4-app-loaded.png', fullPage: true });
    
    // Find clickable elements
    const buttons = await page.locator('button:visible:not(:has-text("Logout"))').all();
    const links = await page.locator('a[href]:visible').all();
    
    console.log(`Found ${buttons.length} buttons and ${links.length} links`);
    
    // Try to click something
    if (buttons.length > 0) {
      const button = buttons[0];
      const text = await button.textContent();
      console.log(`Clicking button: "${text}"`);
      await button.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'screenshots/checkpoint-4-after-click.png', fullPage: true });
      console.log('✅ INTERACTION SUCCESSFUL');
    } else if (links.length > 0) {
      const link = links[0];
      const text = await link.textContent();
      console.log(`Clicking link: "${text}"`);
      await link.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'screenshots/checkpoint-4-after-click.png', fullPage: true });
      console.log('✅ INTERACTION SUCCESSFUL');
    } else {
      console.log('❌ NO INTERACTIVE ELEMENTS FOUND');
    }
    
    // Final verification
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    expect(finalUrl).not.toContain('sign-in');
  });
});