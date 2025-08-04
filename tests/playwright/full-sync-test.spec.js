// tests/playwright/full-sync-test.spec.js
// Test to watch full sync completion and LSN updates
import { test, expect } from '@playwright/test';

test.describe('Full Sync Completion', () => {
  test('should complete initial sync and update LSN', async ({ page }) => {
    console.log('\n=== FULL SYNC COMPLETION TEST ===');
    
    // Collect all sync-related console messages
    const syncLogs = [];
    const lsnUpdates = [];
    let initCompleteReceived = false;
    
    page.on('console', msg => {
      const text = msg.text();
      
      // Track LSN updates
      if (text.includes('LSN update') || text.includes('currentLSN')) {
        lsnUpdates.push(text);
        console.log('   📊 LSN:', text);
      }
      
      // Track init complete
      if (text.includes('srv_init_complete') || text.includes('Initial sync completed')) {
        initCompleteReceived = true;
        console.log('   ✅ INIT COMPLETE:', text);
      }
      
      // Track save state
      if (text.includes('saveOwnState')) {
        console.log('   💾 SAVE STATE:', text);
      }
      
      // General sync logs
      if (text.includes('sync') || text.includes('LSN')) {
        syncLogs.push(text);
      }
    });
    
    // Navigate to app
    console.log('🌐 Navigating to app...');
    await page.goto('/');
    
    // Wait longer for sync to complete
    console.log('⏳ Waiting for initial sync to complete (30 seconds)...');
    await page.waitForTimeout(30000);
    
    // Check final sync state
    const finalSyncState = await page.evaluate(() => {
      const state = localStorage.getItem('sync-machine-state');
      return state ? JSON.parse(state) : null;
    });
    
    console.log('\n📊 Final Analysis:');
    console.log(`   srv_init_complete received: ${initCompleteReceived ? '✅ YES' : '❌ NO'}`);
    console.log(`   LSN updates detected: ${lsnUpdates.length}`);
    
    if (finalSyncState) {
      console.log('\n   Final sync state:');
      console.log(`     Client ID: ${finalSyncState.clientId}`);
      console.log(`     Current LSN: ${finalSyncState.currentLSN}`);
      console.log(`     LSN is updated: ${finalSyncState.currentLSN !== '0/0' ? '✅ YES' : '❌ NO'}`);
    }
    
    // Log all LSN updates
    if (lsnUpdates.length > 0) {
      console.log('\n   All LSN updates:');
      lsnUpdates.forEach((update, i) => console.log(`     ${i + 1}. ${update}`));
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: `screenshots/full-sync-complete.png`,
      fullPage: true 
    });
    
    // Verify LSN was updated
    expect(finalSyncState).toBeTruthy();
    expect(finalSyncState.currentLSN).not.toBe('0/0');
    console.log('\n✅ Test complete!');
  });
});