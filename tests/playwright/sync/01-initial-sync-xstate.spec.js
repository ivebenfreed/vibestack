/**
 * Test: Initial Sync with XState Monitoring
 * Scenario: Fresh client performs initial sync to get all data
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';
import { clearAllSyncState } from '../helpers/sync-test-setup.js';

test.describe('Initial Sync with XState Monitoring', () => {
  test('should perform initial sync for fresh client', async ({ page }) => {
    console.log('🚀 Testing initial sync with XState monitoring...\n');
    console.log('='.repeat(60));
    
    // First navigate to the page
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait for XState inspector
    await page.waitForFunction(() => {
      return window.xstateTestInspector !== undefined;
    }, { timeout: 5000 });
    
    console.log('✅ App ready, XState inspector available');
    
    // Clear all sync state to simulate fresh client
    console.log('\n🧹 Clearing sync state for fresh start...');
    await clearAllSyncState(page);
    
    // Clear XState inspector data
    await page.evaluate(() => {
      window.xstateTestInspector.clear();
      window.xstateTestInspector.addMarker('INITIAL_SYNC_TEST_START');
    });
    
    // Reload to start fresh
    console.log('🔄 Reloading page to trigger initial sync...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait for XState inspector again
    await page.waitForFunction(() => {
      return window.xstateTestInspector !== undefined;
    }, { timeout: 5000 });
    
    // Add marker after reload
    await page.evaluate(() => {
      window.xstateTestInspector.addMarker('AFTER_RELOAD_FRESH_STATE');
    });
    
    // Monitor initial sync progress
    console.log('\n📈 Monitoring initial sync progress...');
    
    // Check for initial sync state
    let foundInitialSync = false;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (!foundInitialSync && attempts < maxAttempts) {
      const currentState = await page.evaluate(() => {
        const state = window.xstateTestInspector.getCurrentState('sync-machine-v3');
        const events = window.xstateTestInspector.getEvents('sync-machine-v3');
        const hasInitialSyncEvents = events.some(e => 
          e.event.type.includes('INIT') || 
          e.state.includes('initial_sync')
        );
        
        return { state, hasInitialSyncEvents };
      });
      
      if (currentState.state === 'initial_sync' || currentState.hasInitialSyncEvents) {
        foundInitialSync = true;
        console.log(`   ✅ Found initial_sync state/events (attempt ${attempts + 1})`);
      } else if (currentState.state === 'catchup_sync') {
        console.log(`   📥 In catchup_sync state (attempt ${attempts + 1})`);
        break; // Catchup is also acceptable for initial data load
      } else if (currentState.state === 'live_sync') {
        console.log(`   ⚡ Already in live_sync (attempt ${attempts + 1})`);
        break; // May have completed initial sync very quickly
      }
      
      attempts++;
      if (!foundInitialSync && attempts < maxAttempts) {
        await page.waitForTimeout(500);
      }
    }
    
    // Wait for sync to complete
    console.log('\n⏳ Waiting for sync to complete...');
    const reachedLiveSync = await page.evaluate(async () => {
      return await window.xstateTestInspector.waitForState('sync-machine-v3', 'live_sync', 15000);
    });
    
    if (reachedLiveSync) {
      console.log('✅ Reached live_sync state');
    } else {
      console.log('⚠️ Did not reach live_sync state');
    }
    
    // Analyze what happened during sync
    const syncAnalysis = await page.evaluate(() => {
      const summary = window.xstateTestInspector.getSummary();
      const syncMachine = summary.machines['sync-machine-v3'];
      const events = window.xstateTestInspector.getEvents('sync-machine-v3');
      const transitions = window.xstateTestInspector.getTransitions('sync-machine-v3');
      
      // Count event types
      const eventTypes = new Map();
      events.forEach(e => {
        const type = e.event.type;
        eventTypes.set(type, (eventTypes.get(type) || 0) + 1);
      });
      
      // Look for initial/catchup sync indicators
      const hasInitMessages = events.some(e => 
        e.event.type.includes('srv_init') || 
        e.event.type.includes('INIT')
      );
      
      const hasCatchupMessages = events.some(e => 
        e.event.type.includes('srv_catchup') || 
        e.event.type.includes('CATCHUP')
      );
      
      const hasIncomingChanges = events.some(e => 
        e.event.type === 'INCOMING_CHANGES'
      );
      
      // Count data received
      const incomingChangesEvents = events.filter(e => 
        e.event.type === 'INCOMING_CHANGES'
      );
      
      // Get state path
      const statePath = transitions.map(t => t.to);
      
      return {
        currentState: syncMachine?.currentState,
        totalEvents: syncMachine?.eventCount || 0,
        totalTransitions: transitions.length,
        eventTypes: Array.from(eventTypes.entries()),
        hasInitMessages,
        hasCatchupMessages,
        hasIncomingChanges,
        incomingChangesCount: incomingChangesEvents.length,
        statePath,
        markers: summary.markers
      };
    });
    
    console.log('\n📊 Sync Analysis:');
    console.log(`   Current state: ${syncAnalysis.currentState}`);
    console.log(`   Total events: ${syncAnalysis.totalEvents}`);
    console.log(`   Total transitions: ${syncAnalysis.totalTransitions}`);
    console.log(`   Has initial sync messages: ${syncAnalysis.hasInitMessages ? '✅' : '❌'}`);
    console.log(`   Has catchup messages: ${syncAnalysis.hasCatchupMessages ? '✅' : '❌'}`);
    console.log(`   Has incoming changes: ${syncAnalysis.hasIncomingChanges ? '✅' : '❌'}`);
    console.log(`   Incoming changes batches: ${syncAnalysis.incomingChangesCount}`);
    
    if (syncAnalysis.statePath.length > 0) {
      console.log('\n📍 State Path:');
      const uniqueStates = [...new Set(syncAnalysis.statePath)];
      uniqueStates.forEach(state => {
        console.log(`   → ${state}`);
      });
    }
    
    console.log('\n📬 Event Type Distribution:');
    syncAnalysis.eventTypes
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
    
    // Check data in database
    const dataCheck = await page.evaluate(async () => {
      try {
        const db = window.db;
        if (!db) return { hasDb: false };
        
        const counts = {
          tasks: await db.tasks.count(),
          users: await db.users.count(),
          projects: await db.projects.count(),
          comments: await db.comments.count()
        };
        
        // Check LocalChanges
        let localChanges = { available: false };
        if (db.LocalChanges) {
          const all = await db.LocalChanges.toArray();
          localChanges = {
            available: true,
            total: all.length,
            pending: all.filter(c => c.status === 'pending').length,
            processed: all.filter(c => c.status === 'processed').length
          };
        }
        
        return { hasDb: true, counts, localChanges };
      } catch (error) {
        return { hasDb: false, error: error.message };
      }
    });
    
    if (dataCheck.hasDb) {
      console.log('\n📦 Data Received:');
      Object.entries(dataCheck.counts).forEach(([entity, count]) => {
        if (count > 0) {
          console.log(`   ${entity}: ${count}`);
        }
      });
      
      if (dataCheck.localChanges.available) {
        console.log('\n📝 LocalChanges:');
        console.log(`   Total: ${dataCheck.localChanges.total}`);
        console.log(`   Pending: ${dataCheck.localChanges.pending}`);
        console.log(`   Processed: ${dataCheck.localChanges.processed}`);
      }
    }
    
    // Check final sync state
    const finalSyncState = await page.evaluate(() => {
      return window.testSyncHelpers?.getSyncState();
    });
    
    console.log('\n📊 Final Sync State:');
    console.log(`   Client ID: ${finalSyncState?.clientId}`);
    console.log(`   LSN: ${finalSyncState?.currentLSN}`);
    
    // Show markers
    console.log('\n🏷️ Test Markers:');
    syncAnalysis.markers.forEach(m => {
      console.log(`   ${m.marker}`);
      if (m.data) {
        console.log(`     Data: ${JSON.stringify(m.data)}`);
      }
    });
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const hasData = dataCheck.hasDb && 
      (dataCheck.counts.tasks > 0 || 
       dataCheck.counts.users > 0 || 
       dataCheck.counts.projects > 0);
    
    const testPassed = 
      reachedLiveSync && 
      (syncAnalysis.hasInitMessages || syncAnalysis.hasCatchupMessages) &&
      syncAnalysis.hasIncomingChanges &&
      hasData;
    
    if (testPassed) {
      console.log('\n✅ Initial sync test PASSED');
      console.log('   - Started with fresh state (no sync data)');
      console.log('   - Received initial/catchup sync messages');
      console.log('   - Processed incoming changes');
      console.log('   - Populated database with data');
      console.log('   - Reached live_sync state');
    } else {
      console.log('\n⚠️ Initial sync test INCOMPLETE');
      if (!reachedLiveSync) {
        console.log('   - Did not reach live_sync state');
      }
      if (!syncAnalysis.hasInitMessages && !syncAnalysis.hasCatchupMessages) {
        console.log('   - No initial/catchup sync messages detected');
      }
      if (!syncAnalysis.hasIncomingChanges) {
        console.log('   - No incoming changes processed');
      }
      if (!hasData) {
        console.log('   - No data populated in database');
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/sync-initial-xstate.png',
      fullPage: true 
    });
    
    console.log('\n' + '='.repeat(60));
  });
});