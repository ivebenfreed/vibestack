// tests/playwright/sync-persistence-test.spec.js
// Test specifically to verify if sync runs again on subsequent visits
import { test, expect } from '@playwright/test';

test.describe('Sync Persistence Verification', () => {
  test('should not re-sync data on subsequent visits', async ({ page }) => {
    console.log('\n=== SYNC PERSISTENCE TEST ===');
    
    // Collect all sync-related console messages
    const syncLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.toLowerCase().includes('sync') || 
          text.includes('WebSocket') ||
          text.includes('initial') ||
          text.includes('snapshot') ||
          text.includes('checkpoint') ||
          text.includes('LSN') ||
          text.includes('replication')) {
        syncLogs.push(text);
        console.log('   [Browser Console]:', text);
      }
    });
    
    // Navigate to app
    console.log('🌐 Navigating to app...');
    await page.goto('/');
    
    // Wait a bit to ensure any sync would have started
    await page.waitForTimeout(5000);
    
    // Check for sync overlay
    const syncOverlay = page.locator('text="Syncing data"');
    const syncOverlayVisible = await syncOverlay.isVisible().catch(() => false);
    
    // Take screenshot
    await page.screenshot({ 
      path: `screenshots/sync-persistence-check.png`,
      fullPage: true 
    });
    
    // Analyze results
    console.log('\n📊 Sync Analysis:');
    console.log(`   Sync overlay visible: ${syncOverlayVisible ? '❌ YES (re-syncing!)' : '✅ NO (not re-syncing)'}`);
    console.log(`   Sync-related console logs: ${syncLogs.length}`);
    
    if (syncLogs.length > 0) {
      console.log('\n   Console messages detected:');
      syncLogs.forEach((log, i) => console.log(`     ${i + 1}. ${log}`));
    }
    
    // Check localStorage for sync state
    const syncState = await page.evaluate(() => {
      const state = localStorage.getItem('sync-machine-state');
      return state ? JSON.parse(state) : null;
    });
    
    if (syncState) {
      console.log('\n   Sync state from localStorage:');
      console.log(`     Client ID: ${syncState.clientId}`);
      console.log(`     Current LSN: ${syncState.currentLSN}`);
    }
    
    // Verify we're authenticated
    const isAuthenticated = await page.evaluate(() => {
      const path = window.location.pathname;
      return !path.includes('/login') && !path.includes('/sign-in');
    });
    
    console.log(`\n   Authentication status: ${isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated'}`);
    
    // The key assertion: sync overlay should NOT be visible
    expect(syncOverlayVisible).toBe(false);
    console.log('\n✅ Sync persistence verified - no re-sync occurred!');
  });
});