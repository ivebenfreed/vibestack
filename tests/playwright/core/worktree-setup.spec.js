// tests/playwright/worktree-setup.spec.js
// Test suite to verify worktree is properly set up with auth and sync
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

// Get worktree configuration
function getWorktreeConfig() {
  const cwd = process.cwd();
  const branchMatch = cwd.match(/issue-(\d+)/);
  const issueNumber = branchMatch ? branchMatch[1] : null;
  
  if (!issueNumber) {
    // Try git branch
    try {
      const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      const match = branchName.match(/(?:issue-|feature-|pr-)(\d+)/);
      if (match) {
        return {
          issueNumber: match[1],
          webPort: 5173 + (parseInt(match[1]) * 10),
          serverPort: 8787 + (parseInt(match[1]) * 10),
          isWorktree: true
        };
      }
    } catch (e) {
      // Silent fail
    }
    
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
    isWorktree: true
  };
}

test.describe('Worktree Setup Tests', () => {
  test.setTimeout(60000); // 60 second timeout
  
  const config = getWorktreeConfig();
  
  test.beforeAll(async () => {
    console.log('🚀 Verifying worktree setup...');
    console.log(`📍 Configuration:`, config);
    if (config.isWorktree) {
      console.log(`   Issue #${config.issueNumber} worktree`);
      console.log(`   Web URL: http://localhost:${config.webPort}`);
      console.log(`   API URL: http://localhost:${config.serverPort}`);
    }
  });
  
  test('should be authenticated from stored state', async ({ page }) => {
    console.log('\n=== AUTHENTICATION VERIFICATION ===');
    
    // Navigate to the app
    await page.goto('/');
    console.log('🌐 Navigated to app');
    
    // Take screenshot
    await page.screenshot({ 
      path: `screenshots/worktree-auth-check.png`,
      fullPage: true 
    });
    
    // Verify we're authenticated (not on login page)
    const isAuthenticated = await page.evaluate(() => {
      const path = window.location.pathname;
      const hasLoginForm = document.querySelector('input[type="email"], input[name="email"]');
      return (!path.includes('/login') && 
              !path.includes('/sign-in') &&
              !path.includes('/handler')) && !hasLoginForm;
    });
    
    expect(isAuthenticated).toBe(true);
    console.log('✅ Authenticated via stored state!');
    console.log(`📍 Current URL: ${page.url()}`);
  });
  
  test('should handle initial sync properly', async ({ page }) => {
    console.log('\n=== SYNC VERIFICATION ===');
    
    // Navigate to app
    await page.goto('/');
    
    // Enable console logging for sync messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.toLowerCase().includes('sync') || 
          text.includes('WebSocket') ||
          text.includes('connection')) {
        console.log('   [Browser]:', text);
      }
    });
    
    // Check for sync overlay and wait if present
    const syncOverlay = page.locator('text="Syncing data"');
    if (await syncOverlay.isVisible().catch(() => false)) {
      console.log('   ✓ Sync overlay detected');
      console.log('   ⏳ Waiting for sync to complete...');
      
      await page.screenshot({ 
        path: `screenshots/worktree-syncing.png`,
        fullPage: true 
      });
      
      try {
        await syncOverlay.waitFor({ state: 'detached', timeout: 60000 });
        console.log('   ✓ Sync completed');
        await page.waitForTimeout(3000); // Let UI stabilize
      } catch (e) {
        console.log('   ⚠️ Sync timeout');
      }
    } else {
      console.log('   ℹ️ No sync overlay (data may already be synced)');
    }
    
    // Verify app is functional
    await page.screenshot({ 
      path: `screenshots/worktree-ready.png`,
      fullPage: true 
    });
    
    const interactiveElements = await page.locator('button:visible, a[href]:visible').count();
    console.log(`   Interactive elements: ${interactiveElements}`);
    
    expect(interactiveElements).toBeGreaterThan(2);
    console.log('✅ App is ready!');
  });
  
  test('should persist session across reloads', async ({ page }) => {
    console.log('\n=== SESSION PERSISTENCE TEST ===');
    
    // First navigation
    await page.goto('/');
    const urlBefore = page.url();
    console.log(`📍 URL before reload: ${urlBefore}`);
    
    // Reload
    await page.reload();
    console.log('🔄 Page reloaded');
    await page.waitForTimeout(2000);
    
    // Check if sync overlay appears after reload
    const syncAfterReload = page.locator('text="Syncing data"');
    if (await syncAfterReload.isVisible().catch(() => false)) {
      console.log('   ⏳ Waiting for sync after reload...');
      await syncAfterReload.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }
    
    // Verify still authenticated
    const stillAuthenticated = await page.evaluate(() => {
      const path = window.location.pathname;
      const hasLoginForm = document.querySelector('input[type="email"], input[name="email"]');
      return (!path.includes('/login') && 
              !path.includes('/sign-in') &&
              !path.includes('/handler')) && !hasLoginForm;
    });
    
    expect(stillAuthenticated).toBe(true);
    console.log('✅ Session persisted after reload');
    
    const urlAfter = page.url();
    console.log(`📍 URL after reload: ${urlAfter}`);
  });
  
  test.afterAll(async () => {
    console.log('\n=== SETUP VERIFICATION COMPLETE ===');
    if (config.isWorktree) {
      console.log(`✅ Issue #${config.issueNumber} worktree is properly configured`);
      console.log(`   Auth state is persisted`);
      console.log(`   Screenshots saved in: ./screenshots/`);
    }
  });
});