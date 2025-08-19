/**
 * Test: Monitor Sync Phase Completion
 * Scenario: Watch sync machine complete the full flow
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Monitor Sync Completion', () => {
  test('should monitor sync machine through full completion', async ({ page }) => {
    console.log('📊 Monitoring sync machine to completion...\n');
    console.log('='.repeat(60));
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Monitor sync progress for 15 seconds
    console.log('\n📈 Monitoring sync progression...');
    
    const progressLog = [];
    const startTime = Date.now();
    
    while (Date.now() - startTime < 15000) {
      const status = await page.evaluate(() => {
        const inspector = window.xstateTestInspector;
        if (!inspector) return null;
        
        const syncState = inspector.getCurrentState('sync-machine-v3');
        const appInitState = inspector.getCurrentState('app-init-machine');
        const events = inspector.getEvents('sync-machine-v3');
        const recentEvent = events.length > 0 ? events[events.length - 1] : null;
        
        return {
          timestamp: Date.now(),
          syncState,
          appInitState,
          totalSyncEvents: events.length,
          lastEvent: recentEvent ? recentEvent.event.type : null
        };
      });
      
      if (status) {
        // Only log if state changed
        const lastEntry = progressLog[progressLog.length - 1];
        if (!lastEntry || 
            lastEntry.syncState !== status.syncState || 
            lastEntry.appInitState !== status.appInitState ||
            lastEntry.totalSyncEvents !== status.totalSyncEvents) {
          
          progressLog.push(status);
          const elapsed = ((status.timestamp - startTime) / 1000).toFixed(1);
          console.log(`   [${elapsed}s] Sync: ${JSON.stringify(status.syncState)} | App: ${status.appInitState} | Events: ${status.totalSyncEvents}`);
          
          if (status.lastEvent) {
            console.log(`         Last Event: ${status.lastEvent}`);
          }
        }
      }
      
      await page.waitForTimeout(500);
    }
    
    // Get final detailed status
    const finalStatus = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      if (!inspector) return null;
      
      const summary = inspector.getSummary();
      const syncMachine = summary.machines['sync-machine-v3'];
      const appInitMachine = summary.machines['app-init-machine'];
      
      const syncEvents = inspector.getEvents('sync-machine-v3');
      const appEvents = inspector.getEvents('app-init-machine');
      
      // Get sync context for error details
      const syncContext = syncMachine?.context || {};
      
      // Check for live sync state
      const isLiveSync = inspector.getCurrentState('sync-machine-v3') === 'live_sync';
      
      // Check for any recent events
      const recentSyncEvents = syncEvents.slice(-5).map(e => ({
        type: e.event.type,
        timestamp: e.timestamp
      }));
      
      return {
        syncState: inspector.getCurrentState('sync-machine-v3'),
        appInitState: inspector.getCurrentState('app-init-machine'),
        syncContext,
        isLiveSync,
        totalSyncEvents: syncEvents.length,
        totalAppEvents: appEvents.length,
        recentSyncEvents,
        hasError: !!syncContext.error,
        errorDetails: syncContext.error
      };
    });
    
    console.log('\n🎯 Final Status:');
    console.log(`   Sync State: ${JSON.stringify(finalStatus.syncState)}`);
    console.log(`   App Init State: ${finalStatus.appInitState}`);
    console.log(`   Is Live Sync: ${finalStatus.isLiveSync ? '✅' : '❌'}`);
    console.log(`   Total Sync Events: ${finalStatus.totalSyncEvents}`);
    console.log(`   Has Error: ${finalStatus.hasError ? '❌' : '✅'}`);
    
    if (finalStatus.hasError) {
      console.log(`   Error Details: ${JSON.stringify(finalStatus.errorDetails)}`);
    }
    
    if (finalStatus.recentSyncEvents.length > 0) {
      console.log('\n📝 Recent Sync Events:');
      finalStatus.recentSyncEvents.forEach(event => {
        console.log(`   ${event.type}`);
      });
    }
    
    // Check if app init machine progressed
    const appInitProgressed = finalStatus.appInitState !== 'idle' && 
                             finalStatus.appInitState !== 'sync';
    
    // Check if sync reached a stable state
    const syncStable = finalStatus.isLiveSync || 
                      finalStatus.syncState === 'catchup_sync' ||
                      finalStatus.syncState === 'initial_sync';
    
    const overallSuccess = appInitProgressed && syncStable && !finalStatus.hasError;
    
    console.log(`\n🎉 Overall Status: ${overallSuccess ? '✅ SUCCESS' : '⚠️ IN PROGRESS'}`);
    
    if (overallSuccess) {
      console.log('✅ Sync system is working correctly!');
      console.log('   - App init machine progressed');
      console.log('   - Sync machine reached stable state');
      console.log('   - No errors detected');
    } else {
      console.log('⚠️ Sync system status:');
      if (!appInitProgressed) {
        console.log('   - App init machine needs to progress further');
      }
      if (!syncStable) {
        console.log('   - Sync machine still in transition phase');
      }
      if (finalStatus.hasError) {
        console.log('   - Sync machine has error');
      }
    }
    
    // Check database data
    const dataStatus = await page.evaluate(async () => {
      if (!window.db) return { hasDb: false };
      
      try {
        const counts = {
          users: await window.db.users.count(),
          projects: await window.db.projects.count(),
          tasks: await window.db.tasks.count(),
          comments: await window.db.comments.count()
        };
        
        return { hasDb: true, counts };
      } catch (e) {
        return { hasDb: true, error: e.message };
      }
    });
    
    if (dataStatus.hasDb) {
      console.log('\n💾 Database Status:');
      if (dataStatus.counts) {
        Object.entries(dataStatus.counts).forEach(([table, count]) => {
          console.log(`   ${table}: ${count}`);
        });
      } else if (dataStatus.error) {
        console.log(`   Error: ${dataStatus.error}`);
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/sync-completion-monitor.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/sync-completion-monitor.png');
    console.log('\n' + '='.repeat(60));
    console.log('Sync completion monitoring completed');
    console.log('='.repeat(60));
  });
});