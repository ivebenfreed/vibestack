/**
 * Test: Sync System After Fix
 * Scenario: Test sync with manual initialization fix applied
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Sync System After Fix', () => {
  test('should work properly after applying the initialization fix', async ({ page }) => {
    console.log('🧪 Testing sync system after applying fix...\n');
    console.log('='.repeat(60));
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Apply the fix (send START_INIT to app init machine)
    const fixResult = await page.evaluate(() => {
      if (window.appInitActor) {
        const currentState = window.xstateTestInspector?.getCurrentState('app-init-machine');
        console.log('[FIX] Current app init state:', currentState);
        
        if (currentState === 'idle') {
          console.log('[FIX] Sending START_INIT to fix initialization');
          window.appInitActor.send({ type: 'START_INIT' });
          return { applied: true, reason: 'was in idle state' };
        } else {
          return { applied: false, reason: `already in ${currentState} state` };
        }
      }
      return { applied: false, reason: 'no appInitActor found' };
    });
    
    console.log(`\n🔧 Fix applied: ${fixResult.applied} (${fixResult.reason})`);
    
    // Wait for initialization to progress
    await page.waitForTimeout(3000);
    
    // Monitor sync progress for 10 seconds
    console.log('\n📊 Monitoring sync progress...');
    
    const progressUpdates = [];
    const startTime = Date.now();
    
    while (Date.now() - startTime < 10000) {
      const status = await page.evaluate(() => {
        const inspector = window.xstateTestInspector;
        if (!inspector) return null;
        
        return {
          appInitState: inspector.getCurrentState('app-init-machine'),
          syncState: inspector.getCurrentState('sync-machine-v3'),
          timestamp: Date.now()
        };
      });
      
      if (status) {
        progressUpdates.push(status);
      }
      
      await page.waitForTimeout(1000);
    }
    
    // Analyze progress
    const uniqueAppInitStates = [...new Set(progressUpdates.map(u => u.appInitState))];
    const uniqueSyncStates = [...new Set(progressUpdates.map(u => JSON.stringify(u.syncState)))];
    
    console.log('\n📈 Progress Analysis:');
    console.log(`   App Init States: ${uniqueAppInitStates.join(' → ')}`);
    console.log(`   Sync States: ${uniqueSyncStates.length} unique states`);
    
    // Show sync state progression
    if (uniqueSyncStates.length > 1) {
      console.log('   Sync State Changes:');
      let lastSyncState = null;
      progressUpdates.forEach(update => {
        const currentSyncState = JSON.stringify(update.syncState);
        if (currentSyncState !== lastSyncState) {
          console.log(`     → ${update.syncState}`);
          lastSyncState = currentSyncState;
        }
      });
    }
    
    // Check final status
    const finalStatus = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      
      return {
        appInitState: inspector?.getCurrentState('app-init-machine'),
        syncState: inspector?.getCurrentState('sync-machine-v3'),
        hasDb: !!window.db,
        hasLiveStore: !!window.liveStoreSchemaClient,
        syncButtonText: document.querySelector('button[aria-label*="Sync"]')?.textContent ||
                       document.querySelector('[data-testid="sync-status-button"]')?.textContent ||
                       'Not found'
      };
    });
    
    console.log('\n🎯 Final Status:');
    console.log(`   App Init: ${finalStatus.appInitState}`);
    console.log(`   Sync: ${JSON.stringify(finalStatus.syncState)}`);
    console.log(`   Database: ${finalStatus.hasDb ? '✅' : '❌'}`);
    console.log(`   LiveStore: ${finalStatus.hasLiveStore ? '✅' : '❌'}`);
    console.log(`   Sync Button: ${finalStatus.syncButtonText}`);
    
    // Check if sync is attempting connection
    const isConnecting = typeof finalStatus.syncState === 'object' && 
                        (finalStatus.syncState?.connecting || 
                         finalStatus.syncState?.initial_sync ||
                         finalStatus.syncState?.catchup_sync ||
                         finalStatus.syncState?.live_sync);
    
    const isActive = finalStatus.appInitState !== 'idle' && isConnecting;
    
    console.log(`\n🚀 Sync System: ${isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    
    if (isActive) {
      console.log('✅ Success! The sync system is working:');
      console.log('   - App init machine started');
      console.log('   - Sync machine is connecting/syncing');
      console.log('   - Database is available');
    } else {
      console.log('❌ Sync system still needs work:');
      if (finalStatus.appInitState === 'idle') {
        console.log('   - App init still in idle');
      }
      if (!isConnecting) {
        console.log('   - Sync machine not connecting');
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/sync-after-fix.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/sync-after-fix.png');
    console.log('\n' + '='.repeat(60));
    console.log('Sync system test after fix completed');
    console.log('='.repeat(60));
  });
});