/**
 * Test: Fix Sync Initialization Chain
 * Scenario: Debug and fix the broken sync initialization chain
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Fix Sync Initialization', () => {
  test('should debug and fix the sync initialization chain', async ({ page }) => {
    console.log('🔧 Fixing sync initialization chain...\n');
    console.log('='.repeat(60));
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Wait for initial setup
    await page.waitForTimeout(2000);
    
    // Check if appInitActor exists
    const actorStatus = await page.evaluate(() => {
      return {
        hasAppInitActor: !!window.appInitActor,
        hasAuthMachineActor: !!window.authMachineActor,
        hasSyncMachineActor: !!window.syncMachineActor,
        appInitActorState: window.appInitActor ? 
          window.xstateTestInspector?.getCurrentState('app-init-machine') : null,
        authActorState: window.authMachineActor ?
          window.xstateTestInspector?.getCurrentState('auth-machine') : null
      };
    });
    
    console.log('\n🎯 Actor Status:');
    console.log(`   App Init Actor: ${actorStatus.hasAppInitActor ? '✅' : '❌'}`);
    console.log(`   Auth Machine Actor: ${actorStatus.hasAuthMachineActor ? '✅' : '❌'}`);
    console.log(`   Sync Machine Actor: ${actorStatus.hasSyncMachineActor ? '✅' : '❌'}`);
    
    if (actorStatus.appInitActorState) {
      console.log(`   App Init State: ${actorStatus.appInitActorState}`);
    }
    
    if (actorStatus.authActorState) {
      console.log(`   Auth State: ${actorStatus.authActorState}`);
    }
    
    // Fix 1: If appInitActor exists but is in idle, manually send START_INIT
    if (actorStatus.hasAppInitActor && actorStatus.appInitActorState === 'idle') {
      console.log('\n🔧 Fix 1: Manually triggering START_INIT...');
      
      const fix1Result = await page.evaluate(() => {
        try {
          console.log('[FIX] Sending START_INIT to app init machine');
          window.appInitActor.send({ type: 'START_INIT' });
          
          // Wait a moment and check state
          return new Promise((resolve) => {
            setTimeout(() => {
              const newState = window.xstateTestInspector?.getCurrentState('app-init-machine');
              resolve({ success: true, newState });
            }, 1000);
          });
        } catch (e) {
          return { success: false, error: e.message };
        }
      });
      
      console.log(`   Result: ${JSON.stringify(fix1Result)}`);
      
      // Wait for potential state changes
      await page.waitForTimeout(2000);
    }
    
    // Check what happened after Fix 1
    const postFix1Status = await page.evaluate(() => {
      return {
        appInitState: window.xstateTestInspector?.getCurrentState('app-init-machine'),
        syncState: window.xstateTestInspector?.getCurrentState('sync-machine-v3'),
        hasLiveStoreInit: window.eventLog?.some(e => e.type === 'livestore:init') || false,
        hasLiveStoreReady: window.eventLog?.some(e => e.type === 'livestore:ready') || false,
        hasDatabaseReady: window.eventLog?.some(e => e.type === 'database:ready') || false
      };
    });
    
    console.log('\n📊 Post-Fix 1 Status:');
    console.log(`   App Init State: ${postFix1Status.appInitState}`);
    console.log(`   Sync State: ${postFix1Status.syncState}`);
    console.log(`   LiveStore Init Event: ${postFix1Status.hasLiveStoreInit ? '✅' : '❌'}`);
    console.log(`   LiveStore Ready Event: ${postFix1Status.hasLiveStoreReady ? '✅' : '❌'}`);
    console.log(`   Database Ready Event: ${postFix1Status.hasDatabaseReady ? '✅' : '❌'}`);
    
    // Fix 2: If database is ready but app init machine isn't progressing, send DATABASE_READY
    if (postFix1Status.hasDatabaseReady && postFix1Status.appInitState === 'database') {
      console.log('\n🔧 Fix 2: Manually triggering DATABASE_READY...');
      
      const fix2Result = await page.evaluate(() => {
        try {
          console.log('[FIX] Sending DATABASE_READY to app init machine');
          window.appInitActor.send({ type: 'DATABASE_READY' });
          
          return new Promise((resolve) => {
            setTimeout(() => {
              const newState = window.xstateTestInspector?.getCurrentState('app-init-machine');
              resolve({ success: true, newState });
            }, 1000);
          });
        } catch (e) {
          return { success: false, error: e.message };
        }
      });
      
      console.log(`   Result: ${JSON.stringify(fix2Result)}`);
      await page.waitForTimeout(2000);
    }
    
    // Fix 3: If sync machine is idle, manually send CONNECT
    const currentSyncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });
    
    if (currentSyncState === 'idle') {
      console.log('\n🔧 Fix 3: Manually triggering sync CONNECT...');
      
      const fix3Result = await page.evaluate(() => {
        try {
          console.log('[FIX] Sending CONNECT to sync machine');
          window.syncMachineActor.send({ type: 'CONNECT' });
          
          return new Promise((resolve) => {
            setTimeout(() => {
              const newState = window.xstateTestInspector?.getCurrentState('sync-machine-v3');
              resolve({ success: true, newState });
            }, 3000); // Give more time for connection attempt
          });
        } catch (e) {
          return { success: false, error: e.message };
        }
      });
      
      console.log(`   Result: ${JSON.stringify(fix3Result)}`);
      await page.waitForTimeout(3000);
    }
    
    // Final status check
    const finalStatus = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      
      return {
        appInitState: inspector?.getCurrentState('app-init-machine'),
        syncState: inspector?.getCurrentState('sync-machine-v3'),
        liveStoreReady: !!window.liveStoreSchemaClient,
        syncButtonStatus: document.querySelector('button[aria-label*="Sync"]')?.textContent || 
                         document.querySelector('[data-testid="sync-status-button"]')?.textContent ||
                         'Not found',
        hasData: {
          users: window.db ? 'available' : 'no db',
          dbReady: !!window.db
        },
        events: window.eventLog?.map(e => e.type) || []
      };
    });
    
    console.log('\n🎯 Final Status:');
    console.log(`   App Init State: ${finalStatus.appInitState}`);
    console.log(`   Sync State: ${finalStatus.syncState}`);
    console.log(`   LiveStore Client: ${finalStatus.liveStoreReady ? '✅' : '❌'}`);
    console.log(`   Sync Button: ${finalStatus.syncButtonStatus}`);
    console.log(`   Database Ready: ${finalStatus.hasData.dbReady ? '✅' : '❌'}`);
    
    if (finalStatus.events.length > 0) {
      const uniqueEvents = [...new Set(finalStatus.events)];
      console.log(`   Events Fired: ${uniqueEvents.slice(-10).join(', ')}`);
    }
    
    // Check if sync is actually working now
    const syncWorking = finalStatus.syncState !== 'idle' && 
                       finalStatus.syncState !== 'disconnected' &&
                       finalStatus.appInitState !== 'idle';
    
    console.log(`\n🎉 Sync System Status: ${syncWorking ? '✅ WORKING' : '❌ STILL BROKEN'}`);
    
    if (syncWorking) {
      console.log('✅ Sync initialization chain has been fixed!');
      console.log('   - App init machine progressed beyond idle');
      console.log('   - Sync machine started connection process');
      console.log('   - System is attempting to sync');
    } else {
      console.log('❌ Sync initialization still needs work:');
      if (finalStatus.appInitState === 'idle') {
        console.log('   - App init machine still in idle (START_INIT not triggered)');
      }
      if (finalStatus.syncState === 'idle') {
        console.log('   - Sync machine still in idle (CONNECT not triggered)');
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/sync-fix-attempt.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/sync-fix-attempt.png');
    console.log('\n' + '='.repeat(60));
    console.log('Sync initialization fix attempt completed');
    console.log('='.repeat(60));
  });
});