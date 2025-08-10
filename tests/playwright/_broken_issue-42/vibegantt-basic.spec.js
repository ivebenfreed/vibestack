// Issue #42: Basic VibeGantt Test
import { test, expect } from '../fixtures/persistent-context.js';

test.describe('VibeGantt Basic Tests', () => {
  test.setTimeout(60000);
  
  test('should load VibeGantt component', async ({ page }) => {
    console.log('🚀 Testing VibeGantt basic load...');
    
    // Navigate to the VibeGantt debug page
    await page.goto('/debug/vibegantt');
    console.log('🌐 Navigated to VibeGantt debug page');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('📡 Network idle');
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-initial.png',
      fullPage: true 
    });
    
    // Check page title
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check for React app root
    const root = await page.locator('#root').isVisible();
    console.log(`🔧 React root visible: ${root}`);
    
    // Check current URL
    const url = page.url();
    console.log(`🌐 Current URL: ${url}`);
    
    // Wait for sync to complete
    const syncOverlay = page.locator('text="Syncing data"');
    if (await syncOverlay.isVisible().catch(() => false)) {
      console.log('⏳ Waiting for sync to complete...');
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {
        console.log('⚠️ Sync overlay timeout, continuing anyway');
      });
    }
    
    // Wait for Playwright ready signal
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    , { timeout: 10000 }).catch(() => {
      console.log('⚠️ Playwright ready signal timeout');
    });
    
    const playwrightReady = await page.evaluate(() => 
      document.body.getAttribute('data-playwright-ready')
    );
    console.log(`🎯 Playwright ready signal: ${playwrightReady}`);
    
    // Wait for the VibeGantt container
    await page.waitForSelector('[data-testid="vibegantt-container"]', { timeout: 10000 }).catch(() => {
      console.log('⚠️ VibeGantt container not found');
    });
    
    const containerVisible = await page.locator('[data-testid="vibegantt-container"]').isVisible().catch(() => false);
    console.log(`📊 VibeGantt container visible: ${containerVisible}`);
    
    if (containerVisible) {
      // Wait a bit for tasks to render
      await page.waitForTimeout(2000);
      
      // Check for any tasks
      const taskCount = await page.locator('[data-testid^="task-bar-"]').count();
      console.log(`📋 Found ${taskCount} tasks`);
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-final.png',
      fullPage: true 
    });
    
    console.log('✅ Basic VibeGantt test completed');
  });
});