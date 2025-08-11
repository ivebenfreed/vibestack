/**
 * Test: Verify No Initial Sync Loop
 * Scenario: Ensure fresh client doesn't get stuck in initial sync loop
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';
import { clearAllSyncState } from '../helpers/sync-test-setup.js';

test.describe('No Initial Sync Loop Test', () => {
  test('should not loop initial sync on fresh connect', async ({ page }) => {
    console.log('🚀 Testing that initial sync doesn\'t loop...\n');
    console.log('='.repeat(60));
    
    // Clear all sync state to simulate fresh client
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Give app time to load
    
    console.log('🧹 Clearing sync state for fresh client...');
    await page.evaluate(() => {
      // Clear all sync-related storage
      localStorage.clear();
      sessionStorage.clear();
      if (window.db) {
        // Clear Dexie if available
        window.db.delete().catch(() => {});
      }
    });
    
    // Track initial sync attempts
    await page.evaluate(() => {
      window.syncTracking = {
        initialSyncStarts: 0,
        initialSyncCompletes: 0,
        catchupSyncStarts: 0,
        liveSyncStarts: 0,
        stateChanges: [],
        lastState: null,
        messages: []
      };
      
      // Override WebSocket to track messages
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = class extends OriginalWebSocket {
        constructor(...args) {
          super(...args);
          
          // Track outgoing messages
          const originalSend = this.send.bind(this);
          this.send = function(data) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'clt_sync_init') {
                window.syncTracking.initialSyncStarts++;
                console.log(`📤 Client requesting initial sync #${window.syncTracking.initialSyncStarts}`);
              }
              window.syncTracking.messages.push({ direction: 'sent', type: parsed.type, time: Date.now() });
            } catch (e) {}
            return originalSend(data);
          };
          
          // Track incoming messages
          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              window.syncTracking.messages.push({ direction: 'received', type: data.type, time: Date.now() });
              
              if (data.type === 'srv_init_start') {
                console.log(`📥 Server starting initial sync (resuming: ${data.resuming})`);
              } else if (data.type === 'srv_init_complete') {
                window.syncTracking.initialSyncCompletes++;
                console.log(`✅ Initial sync complete #${window.syncTracking.initialSyncCompletes}`);
              } else if (data.type === 'srv_catchup_start') {
                window.syncTracking.catchupSyncStarts++;
                console.log(`📥 Catchup sync start #${window.syncTracking.catchupSyncStarts}`);
              } else if (data.type === 'srv_live_start') {
                window.syncTracking.liveSyncStarts++;
                console.log(`⚡ Live sync start #${window.syncTracking.liveSyncStarts}`);
              }
            } catch (e) {}
          });
        }
      };
    });
    
    // Reload to trigger fresh sync
    console.log('\n🔄 Reloading page to trigger fresh sync...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Wait and monitor for multiple initial sync attempts
    console.log('\n⏳ Monitoring for 10 seconds...');
    await page.waitForTimeout(10000);
    
    // Collect results
    const syncResults = await page.evaluate(() => {
      // Also check XState if available
      let xstateInfo = null;
      if (window.xstateTestInspector) {
        const events = window.xstateTestInspector.getEvents('sync-machine-v3');
        const transitions = window.xstateTestInspector.getTransitions('sync-machine-v3');
        const currentState = window.xstateTestInspector.getCurrentState('sync-machine-v3');
        
        // Count how many times we entered initial_sync state
        const initialSyncEntries = transitions.filter(t => t.to === 'initial_sync').length;
        
        xstateInfo = {
          currentState,
          initialSyncEntries,
          totalTransitions: transitions.length,
          hasLoops: initialSyncEntries > 1
        };
      }
      
      return {
        tracking: window.syncTracking,
        xstate: xstateInfo
      };
    });
    
    // Analyze results
    console.log('\n' + '='.repeat(60));
    console.log('ANALYSIS');
    console.log('='.repeat(60));
    
    console.log('\n📊 Sync Tracking Results:');
    console.log(`   Initial sync requests: ${syncResults.tracking.initialSyncStarts}`);
    console.log(`   Initial sync completes: ${syncResults.tracking.initialSyncCompletes}`);
    console.log(`   Catchup sync starts: ${syncResults.tracking.catchupSyncStarts}`);
    console.log(`   Live sync starts: ${syncResults.tracking.liveSyncStarts}`);
    console.log(`   Total messages: ${syncResults.tracking.messages.length}`);
    
    if (syncResults.xstate) {
      console.log('\n📊 XState Analysis:');
      console.log(`   Current state: ${syncResults.xstate.currentState}`);
      console.log(`   Times entered initial_sync: ${syncResults.xstate.initialSyncEntries}`);
      console.log(`   Total state transitions: ${syncResults.xstate.totalTransitions}`);
      console.log(`   Has loops: ${syncResults.xstate.hasLoops ? '⚠️ YES' : '✅ NO'}`);
    }
    
    // Check for message patterns indicating loops
    const messageTypes = syncResults.tracking.messages.map(m => m.type);
    const initStartCount = messageTypes.filter(t => t === 'clt_sync_init').length;
    const initCompleteCount = messageTypes.filter(t => t === 'srv_init_complete').length;
    
    console.log('\n📬 Message Pattern Analysis:');
    console.log(`   Client init requests: ${initStartCount}`);
    console.log(`   Server init completes: ${initCompleteCount}`);
    
    // Look for repeated patterns
    const hasRepeatedPattern = initStartCount > 2 || 
                               syncResults.tracking.initialSyncStarts > 2 ||
                               (syncResults.xstate && syncResults.xstate.initialSyncEntries > 1);
    
    // === VERDICT ===
    console.log('\n' + '='.repeat(60));
    console.log('VERDICT');
    console.log('='.repeat(60));
    
    if (hasRepeatedPattern) {
      console.log('\n❌ FAILED: Initial sync is looping!');
      console.log('   The client is repeatedly requesting initial sync');
      console.log('   This indicates the original bug is NOT fixed');
      
      // Show message timeline
      console.log('\n📜 Message Timeline (last 20):');
      syncResults.tracking.messages.slice(-20).forEach(m => {
        const icon = m.direction === 'sent' ? '📤' : '📥';
        console.log(`   ${icon} ${m.type}`);
      });
    } else if (syncResults.tracking.initialSyncStarts === 0) {
      console.log('\n⚠️ INCONCLUSIVE: No initial sync detected');
      console.log('   The sync system may not be working properly');
    } else if (syncResults.tracking.initialSyncStarts === 1 && 
               syncResults.tracking.initialSyncCompletes >= 1) {
      console.log('\n✅ PASSED: No initial sync loop detected!');
      console.log('   - Client requested initial sync exactly once');
      console.log('   - Server completed initial sync successfully');
      console.log('   - No repeated initial sync attempts');
      console.log('   - The original bug appears to be FIXED');
    } else {
      console.log('\n⚠️ PARTIAL: Initial sync started but may not have completed');
      console.log(`   - Starts: ${syncResults.tracking.initialSyncStarts}`);
      console.log(`   - Completes: ${syncResults.tracking.initialSyncCompletes}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/no-initial-sync-loop.png',
      fullPage: true 
    });
    
    console.log('\n' + '='.repeat(60));
    
    // Assert no looping
    expect(syncResults.tracking.initialSyncStarts).toBeLessThanOrEqual(1);
    expect(hasRepeatedPattern).toBe(false);
  });
});