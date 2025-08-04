// tests/playwright/worktree-setup.spec.js
// Base test suite for worktree initialization - ensures auth and sync are properly set up
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper to load environment variables
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

// Helper to detect worktree configuration
function getWorktreeConfig() {
  const cwd = process.cwd();
  const branchMatch = cwd.match(/issue-(\d+)/);
  const issueNumber = branchMatch ? branchMatch[1] : null;
  
  if (!issueNumber) {
    return {
      issueNumber: null,
      webPort: 5173,
      serverPort: 8787,
      isWorktree: false
    };
  }
  
  // Calculate ports based on issue number
  const baseWebPort = 5173;
  const baseServerPort = 8787;
  const offset = parseInt(issueNumber) * 10;
  
  return {
    issueNumber,
    webPort: baseWebPort + offset,
    serverPort: baseServerPort + offset,
    isWorktree: true,
    profileName: `profile-${issueNumber}`
  };
}

test.describe('Worktree Setup Tests', () => {
  test.setTimeout(90000); // 90 second timeout for setup tests
  
  const config = getWorktreeConfig();
  
  test.beforeAll(async () => {
    console.log('🚀 Starting worktree setup tests...');
    console.log(`📍 Configuration:`, config);
    if (config.isWorktree) {
      console.log(`   Issue #${config.issueNumber} worktree detected`);
      console.log(`   Web URL: http://localhost:${config.webPort}`);
      console.log(`   API URL: http://localhost:${config.serverPort}`);
      console.log(`   Profile: ${config.profileName}`);
    }
  });
  
  test('should authenticate and establish session', async ({ page }) => {
    const env = loadEnvFile();
    
    // Skip test if no credentials are available
    if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
      console.log('⚠️  Skipping test: No credentials found in .env.local');
      console.log('   Add VIBE_DEV_EMAIL and VIBE_DEV_PASSWORD to .env.local');
      test.skip();
      return;
    }
    
    console.log('=== AUTHENTICATION TEST ===');
    
    // Navigate to the app
    const baseUrl = `http://localhost:${config.webPort}`;
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    console.log(`🌐 Navigated to ${baseUrl}`);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: `screenshots/worktree-setup-1-initial.png`,
      fullPage: true 
    });
    
    // Check if we need to login
    const needsLogin = await page.evaluate(() => {
      const path = window.location.pathname;
      return path.includes('/login') || 
             path.includes('/sign-in') ||
             path.includes('/handler');
    });
    
    if (!needsLogin) {
      console.log('✅ Already authenticated, session exists');
      
      // Verify authenticated state
      const authenticatedElements = await page.locator('nav, header, main').count();
      expect(authenticatedElements).toBeGreaterThan(0);
      
      return;
    }
    
    console.log('🔐 Performing login...');
    
    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { 
      timeout: 30000 
    });
    
    // Fill credentials
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(env.VIBE_DEV_EMAIL);
    console.log(`📧 Entered email: ${env.VIBE_DEV_EMAIL}`);
    
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(env.VIBE_DEV_PASSWORD);
    console.log('🔑 Entered password');
    
    // Take screenshot before login
    await page.screenshot({ 
      path: `screenshots/worktree-setup-2-login-form.png`,
      fullPage: true 
    });
    
    // Click login
    const loginButton = page.locator('button:has-text("Login")').first();
    await loginButton.click();
    console.log('🔄 Login submitted');
    
    // Wait for authentication to complete
    try {
      await page.waitForFunction(() => {
        const path = window.location.pathname;
        return !path.includes('/login') && 
               !path.includes('/sign-in') &&
               !path.includes('/handler');
      }, { timeout: 30000 });
      
      console.log('✅ Authentication successful!');
      console.log(`📍 Current URL: ${page.url()}`);
      
      // Take screenshot after login
      await page.screenshot({ 
        path: `screenshots/worktree-setup-3-authenticated.png`,
        fullPage: true 
      });
      
    } catch (error) {
      console.log('❌ Authentication failed');
      
      // Check for error messages
      const errorMessages = await page.locator('.error, [role="alert"], .text-red-500').allTextContents();
      if (errorMessages.length > 0) {
        console.log('❌ Error messages:', errorMessages);
      }
      
      await page.screenshot({ 
        path: `screenshots/worktree-setup-auth-error.png`,
        fullPage: true 
      });
      
      throw new Error('Authentication failed');
    }
  });
  
  test('should complete initial data sync', async ({ page }) => {
    const env = loadEnvFile();
    
    if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
      test.skip();
      return;
    }
    
    console.log('\n=== INITIAL SYNC TEST ===');
    
    // Enable console logging for sync-related messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.toLowerCase().includes('sync') || 
          text.includes('WebSocket') ||
          text.includes('connection') ||
          text.includes('data')) {
        console.log('   [Browser]:', text);
      }
    });
    
    // Navigate to app (should be authenticated from previous test)
    const baseUrl = `http://localhost:${config.webPort}`;
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    console.log(`🌐 Navigated to ${baseUrl}`);
    
    // Wait for page to stabilize
    await page.waitForTimeout(2000);
    
    // Check for sync overlay
    console.log('🔄 Checking for sync process...');
    const syncOverlay = page.locator('text="Syncing data", text="Loading", text="Synchronizing"');
    const syncVisible = await syncOverlay.first().isVisible().catch(() => false);
    
    if (syncVisible) {
      console.log('   ✓ Sync overlay detected');
      console.log('   ⏳ Waiting for sync to complete...');
      
      // Take screenshot of sync state
      await page.screenshot({ 
        path: `screenshots/worktree-setup-4-syncing.png`,
        fullPage: true 
      });
      
      // Wait for sync to complete (overlay to disappear)
      try {
        await syncOverlay.first().waitFor({ state: 'detached', timeout: 60000 });
        console.log('   ✓ Sync overlay disappeared');
        
        // Wait additional time for the app to fully load after sync
        await page.waitForTimeout(5000);
        
        // Wait for some content to appear
        await page.waitForSelector('main, nav, header, .app-content, [role="main"], [role="navigation"]', { timeout: 10000 }).catch(() => {
          console.log('   ⚠️ Main content selectors not found, continuing anyway');
        });
        
      } catch (e) {
        console.log('   ⚠️ Sync timeout - checking if app is functional');
        
        // Try to close overlay if possible
        const closeButton = page.locator('button:has-text("Close"), button:has-text("Skip")');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          console.log('   ✓ Closed sync overlay manually');
          await page.waitForTimeout(3000);
        }
      }
    } else {
      console.log('   ℹ️ No sync overlay visible (data may already be synced)');
      // Still wait a bit for content to load
      await page.waitForTimeout(2000);
    }
    
    // Verify app is functional
    console.log('\n📊 Verifying app state...');
    
    // Check for main app elements
    const mainContent = await page.locator('main, [role="main"]').count();
    const navigation = await page.locator('nav, [role="navigation"], .sidebar').count();
    const interactiveElements = await page.locator('button:visible, a[href]:visible').count();
    
    console.log(`   Main content elements: ${mainContent}`);
    console.log(`   Navigation elements: ${navigation}`);
    console.log(`   Interactive elements: ${interactiveElements}`);
    
    // Take final screenshot
    await page.screenshot({ 
      path: `screenshots/worktree-setup-5-ready.png`,
      fullPage: true 
    });
    
    // Verify data is loaded by checking for common elements
    // Be flexible - the app structure may vary, so check for basic functionality
    const hasAnyContent = mainContent > 0 || navigation > 0 || interactiveElements > 5;
    const isNotStuckOnSync = !await page.locator('text="Syncing data"').isVisible().catch(() => false);
    
    expect(hasAnyContent).toBe(true);
    expect(isNotStuckOnSync).toBe(true);
    expect(interactiveElements).toBeGreaterThan(2);
    
    console.log('✅ Initial sync completed successfully!');
  });
  
  test('should persist session across page reloads', async ({ page }) => {
    const env = loadEnvFile();
    
    if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
      test.skip();
      return;
    }
    
    console.log('\n=== SESSION PERSISTENCE TEST ===');
    
    // Navigate to app
    const baseUrl = `http://localhost:${config.webPort}`;
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    
    // Verify we're authenticated
    const isAuthenticated = await page.evaluate(() => {
      const path = window.location.pathname;
      return !path.includes('/login') && 
             !path.includes('/sign-in') &&
             !path.includes('/handler');
    });
    
    expect(isAuthenticated).toBe(true);
    console.log('✅ Currently authenticated');
    
    // Reload page
    await page.reload();
    console.log('🔄 Page reloaded');
    
    // Wait for page to load and sync to complete
    await page.waitForTimeout(3000);
    
    // Check if there's a sync overlay after reload and wait for it
    const syncAfterReload = page.locator('text="Syncing data"');
    if (await syncAfterReload.isVisible().catch(() => false)) {
      console.log('   ⏳ Waiting for sync after reload...');
      await syncAfterReload.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {
        console.log('   ⚠️ Sync timeout after reload');
      });
      await page.waitForTimeout(2000);
    }
    
    // Verify still authenticated - check both URL and presence of login form
    const stillAuthenticated = await page.evaluate(() => {
      const path = window.location.pathname;
      const hasLoginForm = document.querySelector('input[type="email"], input[name="email"]');
      return (!path.includes('/login') && 
              !path.includes('/sign-in') &&
              !path.includes('/handler')) && !hasLoginForm;
    });
    
    expect(stillAuthenticated).toBe(true);
    console.log('✅ Session persisted after reload');
    
    // Verify app is functional
    const hasContent = await page.locator('main, nav, button, a[href]').count() > 0;
    expect(hasContent).toBe(true);
    console.log('✅ App content loaded after reload');
  });
  
  test.afterAll(async () => {
    console.log('\n=== WORKTREE SETUP COMPLETE ===');
    if (config.isWorktree) {
      console.log(`✅ Issue #${config.issueNumber} worktree is ready for development`);
      console.log(`   Profile: ${config.profileName}`);
      console.log(`   Screenshots saved in: ./screenshots/`);
    }
  });
});