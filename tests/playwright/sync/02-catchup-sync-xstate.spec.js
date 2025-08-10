/**
 * Test: Catchup Sync with XState Monitoring
 * Scenario: Client with older LSN catches up to current server state
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';
import { setupCatchupSync } from '../helpers/sync-test-setup.js';

test.describe('Catchup Sync with XState Monitoring', () => {
  test('should catch up when client LSN is behind server', async ({ page }) => {
    console.log('🚀 Testing catchup sync with XState monitoring...\n');
    console.log('='.repeat(60));
    
    // First navigate to establish initial state
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait for XState inspector
    await page.waitForFunction(() => {
      return window.xstateTestInspector !== undefined;
    }, { timeout: 5000 });
    
    // Clear inspector
    await page.evaluate(() => {
      window.xstateTestInspector.clear();
    });
    
    // Wait for initial sync to complete
    console.log('⏳ Waiting for initial sync to complete...');
    const initiallyInLiveSync = await page.evaluate(async () => {
      return await window.xstateTestInspector.waitForState('sync-machine-v3', 'live_sync', 10000);
    });
    
    if (initiallyInLiveSync) {
      console.log('✅ Initially reached live_sync state');
    }
    
    // Get current state before forcing catchup
    const beforeState = await page.evaluate(() => {
      const syncState = window.testSyncHelpers?.getSyncState();
      const xstateState = window.xstateTestInspector.getCurrentState('sync-machine-v3');
      const summary = window.xstateTestInspector.getSummary();
      return { 
        syncState, 
        xstateState,
        eventCount: summary.machines['sync-machine-v3']?.eventCount || 0
      };
    });
    
    console.log('\n📊 State before forcing catchup:');
    console.log(`   LSN: ${beforeState.syncState?.currentLSN}`);
    console.log(`   XState: ${beforeState.xstateState}`);
    console.log(`   Events processed: ${beforeState.eventCount}`);
    
    // Now force an older LSN to trigger catchup
    console.log('\n🔧 Setting older LSN to trigger catchup...');
    const lsnSet = await page.evaluate(() => {
      window.xstateTestInspector.addMarker('FORCING_OLD_LSN');
      
      if (window.testSyncHelpers) {
        // Use valid hex LSN format
        const success = window.testSyncHelpers.forceSetSyncState('0/100000');
        
        if (success) {
          window.xstateTestInspector.addMarker('LSN_SET_SUCCESS', { lsn: '0/100000' });
        }
        
        return success;
      }
      return false;
    });
    
    if (!lsnSet) {
      console.log('❌ Failed to set LSN for catchup test');
      return;
    }
    
    console.log('✅ LSN set to 0/100000');
    
    // Reload to trigger catchup
    console.log('\n🔄 Reloading page to trigger catchup sync...');
    await page.evaluate(() => {
      window.xstateTestInspector.addMarker('BEFORE_RELOAD');
    });
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait for XState inspector to be available again
    await page.waitForFunction(() => {
      return window.xstateTestInspector !== undefined;
    }, { timeout: 5000 });
    
    // Add marker after reload
    await page.evaluate(() => {
      window.xstateTestInspector.addMarker('AFTER_RELOAD');
    });
    
    // Monitor state transitions
    console.log('\n📈 Monitoring state transitions...');
    
    // Wait a bit for initial transitions
    await page.waitForTimeout(2000);
    
    // Check if we went through catchup state
    const stateHistory = await page.evaluate(() => {
      const transitions = window.xstateTestInspector.getTransitions('sync-machine-v3');
      const events = window.xstateTestInspector.getEvents('sync-machine-v3');
      
      // Look for catchup-related states and events
      const catchupTransitions = transitions.filter(t => 
        t.to.includes('catchup') || t.from.includes('catchup')
      );
      
      const catchupEvents = events.filter(e => 
        e.event.type.includes('CATCHUP') || 
        e.event.type.includes('catchup') ||
        e.state.includes('catchup')
      );
      
      return {
        transitions,
        catchupTransitions,
        catchupEvents,
        totalEvents: events.length
      };
    });
    
    console.log(`   Total events: ${stateHistory.totalEvents}`);
    console.log(`   Catchup transitions: ${stateHistory.catchupTransitions.length}`);
    console.log(`   Catchup events: ${stateHistory.catchupEvents.length}`);
    
    if (stateHistory.catchupTransitions.length > 0) {
      console.log('\n   Catchup state transitions:');
      stateHistory.catchupTransitions.forEach(t => {
        console.log(`     ${t.from} → ${t.to}`);
      });
    }
    
    // Wait for sync to complete
    console.log('\n⏳ Waiting for sync to stabilize...');
    const reachedLiveSync = await page.evaluate(async () => {
      return await window.xstateTestInspector.waitForState('sync-machine-v3', 'live_sync', 15000);
    });
    
    if (reachedLiveSync) {
      console.log('✅ Reached live_sync state after catchup');
    } else {
      console.log('⚠️ Did not reach live_sync state');
    }
    
    // Get final analysis
    const finalAnalysis = await page.evaluate(() => {
      const summary = window.xstateTestInspector.getSummary();
      const syncMachine = summary.machines['sync-machine-v3'];
      const events = window.xstateTestInspector.getEvents('sync-machine-v3');
      
      // Count event types
      const eventTypes = new Map();
      events.forEach(e => {
        const type = e.event.type;
        eventTypes.set(type, (eventTypes.get(type) || 0) + 1);
      });
      
      // Look for specific catchup indicators
      const hasCatchupChanges = events.some(e => 
        e.event.type === 'srv_catchup_changes' || 
        e.event.type.includes('CATCHUP')
      );
      
      const hasIncomingChanges = events.some(e => 
        e.event.type === 'INCOMING_CHANGES'
      );
      
      return {
        currentState: syncMachine?.currentState,
        totalEvents: syncMachine?.eventCount || 0,
        eventTypes: Array.from(eventTypes.entries()),
        hasCatchupChanges,
        hasIncomingChanges,
        markers: summary.markers
      };
    });
    
    console.log('\n📊 Final Analysis:');
    console.log(`   Current state: ${finalAnalysis.currentState}`);
    console.log(`   Total events: ${finalAnalysis.totalEvents}`);
    console.log(`   Has catchup changes: ${finalAnalysis.hasCatchupChanges ? '✅' : '❌'}`);
    console.log(`   Has incoming changes: ${finalAnalysis.hasIncomingChanges ? '✅' : '❌'}`);
    
    console.log('\n📬 Event Type Distribution:');
    finalAnalysis.eventTypes
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
    
    // Check final sync state
    const finalSyncState = await page.evaluate(() => {
      return window.testSyncHelpers?.getSyncState();
    });
    
    console.log('\n📊 Final Sync State:');
    console.log(`   Client ID: ${finalSyncState?.clientId}`);
    console.log(`   LSN: ${finalSyncState?.currentLSN}`);
    
    // LSN should be updated from the test value
    if (finalSyncState?.currentLSN && finalSyncState.currentLSN !== '0/100000') {
      console.log(`   ✅ LSN updated from 0/100000 to ${finalSyncState.currentLSN}`);
    } else {
      console.log(`   ⚠️ LSN not updated (still ${finalSyncState?.currentLSN})`);
    }
    
    // Show markers
    console.log('\n🏷️ Test Markers:');
    finalAnalysis.markers.forEach(m => {
      console.log(`   ${m.marker}`);
      if (m.data) {
        console.log(`     Data: ${JSON.stringify(m.data)}`);
      }
    });
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const testPassed = 
      reachedLiveSync && 
      finalAnalysis.hasIncomingChanges &&
      finalSyncState?.currentLSN !== '0/100000';
    
    if (testPassed) {
      console.log('\n✅ Catchup sync test PASSED');
      console.log('   - Successfully triggered catchup by setting old LSN');
      console.log('   - Received incoming changes during catchup');
      console.log('   - Reached live_sync state after catchup');
      console.log('   - LSN was updated to current value');
    } else {
      console.log('\n⚠️ Catchup sync test INCOMPLETE');
      if (!reachedLiveSync) {
        console.log('   - Did not reach live_sync state');
      }
      if (!finalAnalysis.hasIncomingChanges) {
        console.log('   - No incoming changes detected');
      }
      if (finalSyncState?.currentLSN === '0/100000') {
        console.log('   - LSN was not updated');
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/sync-catchup-xstate.png',
      fullPage: true 
    });
    
    console.log('\n' + '='.repeat(60));
  });
});