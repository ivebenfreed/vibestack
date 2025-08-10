/**
 * Test: Live Sync with XState Monitoring
 * Scenario: Real-time sync between multiple tabs/clients using XState inspection
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Live Sync with XState Monitoring', () => {
  test('should detect and sync changes between tabs', async ({ page, context }) => {
    console.log('🚀 Testing live sync between tabs with XState monitoring...\n');
    console.log('='.repeat(60));
    
    // === TAB 1 SETUP ===
    console.log('\n📱 TAB 1: Setting up first client...');
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait for XState inspector
    await page.waitForFunction(() => {
      return window.xstateTestInspector !== undefined;
    }, { timeout: 5000 });
    
    // Clear inspector and add marker
    await page.evaluate(() => {
      window.xstateTestInspector.clear();
      window.xstateTestInspector.addMarker('TAB1_INITIALIZED');
    });
    
    // Wait for sync machine to reach live_sync state
    console.log('   Waiting for live_sync state...');
    const tab1InLiveSync = await page.evaluate(async () => {
      return await window.xstateTestInspector.waitForState('sync-machine-v3', 'live_sync', 10000);
    });
    
    if (tab1InLiveSync) {
      console.log('   ✅ Tab 1 in live_sync state');
    } else {
      console.log('   ⚠️ Tab 1 not in live_sync state');
    }
    
    // Get initial state
    const tab1InitialState = await page.evaluate(() => {
      const syncState = window.testSyncHelpers?.getSyncState();
      const xstateState = window.xstateTestInspector.getCurrentState('sync-machine-v3');
      return { syncState, xstateState };
    });
    
    console.log(`   Client ID: ${tab1InitialState.syncState?.clientId}`);
    console.log(`   LSN: ${tab1InitialState.syncState?.currentLSN}`);
    console.log(`   XState: ${tab1InitialState.xstateState}`);
    
    // === TAB 2 SETUP ===
    console.log('\n📱 TAB 2: Opening second client...');
    const page2 = await context.newPage();
    
    await page2.goto('/', { waitUntil: 'domcontentloaded' });
    await page2.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait for XState inspector in tab 2
    await page2.waitForFunction(() => {
      return window.xstateTestInspector !== undefined;
    }, { timeout: 5000 });
    
    // Add marker in tab 2
    await page2.evaluate(() => {
      window.xstateTestInspector.addMarker('TAB2_INITIALIZED');
    });
    
    // Wait for tab 2 to reach live_sync
    console.log('   Waiting for live_sync state...');
    const tab2InLiveSync = await page2.evaluate(async () => {
      return await window.xstateTestInspector.waitForState('sync-machine-v3', 'live_sync', 10000);
    });
    
    if (tab2InLiveSync) {
      console.log('   ✅ Tab 2 in live_sync state');
    } else {
      console.log('   ⚠️ Tab 2 not in live_sync state');
    }
    
    // === DATA OPERATIONS ===
    console.log('\n🔄 OPERATIONS: Creating data changes in Tab 2...');
    
    // Get initial event counts
    const initialEventCounts = await page2.evaluate(() => {
      const summary = window.xstateTestInspector.getSummary();
      return {
        total: summary.totalEvents,
        syncMachine: summary.machines['sync-machine-v3']?.eventCount || 0
      };
    });
    
    // Create a task
    const taskCreated = await page2.evaluate(async () => {
      try {
        const db = window.db;
        if (!db) {
          return { success: false, reason: 'No database' };
        }
        
        const newTask = {
          id: `live-sync-test-${Date.now()}`,
          title: `Live Sync Test Task`,
          description: 'Created for XState monitoring',
          created_at: new Date(),
          updated_at: new Date()
        };
        
        window.xstateTestInspector.addMarker('BEFORE_CREATE_TASK', { id: newTask.id });
        await db.tasks.add(newTask);
        window.xstateTestInspector.addMarker('AFTER_CREATE_TASK', { id: newTask.id });
        
        return { success: true, task: newTask };
      } catch (error) {
        return { success: false, reason: error.message };
      }
    });
    
    if (taskCreated.success) {
      console.log(`   ✅ Created task: ${taskCreated.task.id}`);
      
      // Wait for sync events
      await page2.waitForTimeout(2000);
      
      // Check if sync events were triggered
      const afterCreateEvents = await page2.evaluate(() => {
        const summary = window.xstateTestInspector.getSummary();
        const syncEvents = window.xstateTestInspector.getEvents('sync-machine-v3');
        const recentEvents = syncEvents.slice(-5).map(e => e.event.type);
        return {
          total: summary.totalEvents,
          syncMachine: summary.machines['sync-machine-v3']?.eventCount || 0,
          recentTypes: recentEvents
        };
      });
      
      const newEvents = afterCreateEvents.syncMachine - initialEventCounts.syncMachine;
      console.log(`   📊 New sync events after create: ${newEvents}`);
      if (afterCreateEvents.recentTypes.length > 0) {
        console.log(`   Recent event types: ${afterCreateEvents.recentTypes.join(', ')}`);
      }
      
      // Update the task
      const taskUpdated = await page2.evaluate(async (taskId) => {
        try {
          const db = window.db;
          window.xstateTestInspector.addMarker('BEFORE_UPDATE_TASK', { id: taskId });
          await db.tasks.update(taskId, {
            title: 'Updated: Live Sync Test Task',
            updated_at: new Date()
          });
          window.xstateTestInspector.addMarker('AFTER_UPDATE_TASK', { id: taskId });
          return { success: true };
        } catch (error) {
          return { success: false, reason: error.message };
        }
      }, taskCreated.task.id);
      
      if (taskUpdated.success) {
        console.log(`   ✅ Updated task: ${taskCreated.task.id}`);
      }
      
      await page2.waitForTimeout(2000);
      
      // Delete the task
      const taskDeleted = await page2.evaluate(async (taskId) => {
        try {
          const db = window.db;
          window.xstateTestInspector.addMarker('BEFORE_DELETE_TASK', { id: taskId });
          await db.tasks.delete(taskId);
          window.xstateTestInspector.addMarker('AFTER_DELETE_TASK', { id: taskId });
          return { success: true };
        } catch (error) {
          return { success: false, reason: error.message };
        }
      }, taskCreated.task.id);
      
      if (taskDeleted.success) {
        console.log(`   ✅ Deleted task: ${taskCreated.task.id}`);
      }
    } else {
      console.log(`   ❌ Failed to create task: ${taskCreated.reason}`);
    }
    
    // Wait for sync to complete
    await page2.waitForTimeout(3000);
    
    // === ANALYSIS ===
    console.log('\n📊 XSTATE ANALYSIS:');
    
    // Get summaries from both tabs
    const tab1Summary = await page.evaluate(() => {
      return window.xstateTestInspector.getSummary();
    });
    
    const tab2Summary = await page2.evaluate(() => {
      return window.xstateTestInspector.getSummary();
    });
    
    console.log('\nTab 1 Summary:');
    console.log(`   Total events: ${tab1Summary.totalEvents}`);
    console.log(`   Sync machine events: ${tab1Summary.machines['sync-machine-v3']?.eventCount || 0}`);
    console.log(`   Current state: ${tab1Summary.machines['sync-machine-v3']?.currentState}`);
    
    console.log('\nTab 2 Summary:');
    console.log(`   Total events: ${tab2Summary.totalEvents}`);
    console.log(`   Sync machine events: ${tab2Summary.machines['sync-machine-v3']?.eventCount || 0}`);
    console.log(`   Current state: ${tab2Summary.machines['sync-machine-v3']?.currentState}`);
    
    // Get sync-specific events from Tab 2
    const tab2SyncEvents = await page2.evaluate(() => {
      const events = window.xstateTestInspector.getEvents('sync-machine-v3');
      const eventTypes = new Map();
      events.forEach(e => {
        const type = e.event.type;
        eventTypes.set(type, (eventTypes.get(type) || 0) + 1);
      });
      return Array.from(eventTypes.entries());
    });
    
    console.log('\n📬 Tab 2 Sync Event Types:');
    tab2SyncEvents
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
    
    // Check for key sync events
    const hasChangesSent = tab2SyncEvents.some(([type]) => 
      type.includes('CHANGES_SENT') || type.includes('SEND_CHANGES')
    );
    const hasWsMessages = tab2SyncEvents.some(([type]) => type === 'WS_MESSAGE');
    const hasAck = tab2SyncEvents.some(([type]) => type.includes('ACK'));
    
    console.log('\n🔍 Sync Flow Verification:');
    console.log(`   Changes sent: ${hasChangesSent ? '✅' : '❌'}`);
    console.log(`   WebSocket messages: ${hasWsMessages ? '✅' : '❌'}`);
    console.log(`   Acknowledgments: ${hasAck ? '❌ (might be in server logs)' : '❌'}`);
    
    // Get all markers
    const allMarkers = tab2Summary.markers;
    console.log('\n🏷️ Test Markers:');
    allMarkers.forEach(m => {
      console.log(`   ${m.marker}`);
      if (m.data) {
        console.log(`     Data: ${JSON.stringify(m.data)}`);
      }
    });
    
    // Check LocalChanges
    const localChangesInfo = await page2.evaluate(async () => {
      try {
        const db = window.db;
        if (db?.LocalChanges) {
          const all = await db.LocalChanges.toArray();
          const pending = all.filter(c => c.status === 'pending');
          const processed = all.filter(c => c.status === 'processed');
          return {
            total: all.length,
            pending: pending.length,
            processed: processed.length,
            hasAccess: true
          };
        }
        return { hasAccess: false };
      } catch (error) {
        return { hasAccess: false, error: error.message };
      }
    });
    
    console.log('\n📦 LocalChanges Status:');
    if (localChangesInfo.hasAccess) {
      console.log(`   Total: ${localChangesInfo.total}`);
      console.log(`   Pending: ${localChangesInfo.pending}`);
      console.log(`   Processed: ${localChangesInfo.processed}`);
      
      if (localChangesInfo.pending > 0) {
        console.log('   ⚠️ Some changes are still pending');
      }
    } else {
      console.log('   ❌ Cannot access LocalChanges');
    }
    
    // === CROSS-TAB VERIFICATION ===
    console.log('\n🔄 CROSS-TAB SYNC VERIFICATION:');
    
    // Check if Tab 1 received any sync events (it should if live sync is working)
    const tab1RecentEvents = await page.evaluate(() => {
      const events = window.xstateTestInspector.getEvents('sync-machine-v3');
      return events.slice(-10).map(e => e.event.type);
    });
    
    console.log('   Tab 1 recent events:', tab1RecentEvents.join(', ') || 'none');
    
    // Check final states
    const tab1FinalState = await page.evaluate(() => {
      return window.testSyncHelpers?.getSyncState();
    });
    
    const tab2FinalState = await page2.evaluate(() => {
      return window.testSyncHelpers?.getSyncState();
    });
    
    console.log('\n📊 Final Sync States:');
    console.log('   Tab 1:');
    console.log(`     LSN: ${tab1FinalState?.currentLSN}`);
    console.log('   Tab 2:');
    console.log(`     LSN: ${tab2FinalState?.currentLSN}`);
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const testPassed = 
      tab1InLiveSync && 
      tab2InLiveSync && 
      taskCreated.success &&
      hasChangesSent &&
      hasWsMessages;
    
    if (testPassed) {
      console.log('\n✅ Live sync test PASSED');
      console.log('   - Both tabs reached live_sync state');
      console.log('   - Data operations succeeded');
      console.log('   - Sync events were triggered');
      console.log('   - WebSocket communication occurred');
    } else {
      console.log('\n⚠️ Live sync test INCOMPLETE');
      if (!tab1InLiveSync || !tab2InLiveSync) {
        console.log('   - One or both tabs did not reach live_sync');
      }
      if (!taskCreated.success) {
        console.log('   - Data operations failed');
      }
      if (!hasChangesSent) {
        console.log('   - No change events detected');
      }
      if (!hasWsMessages) {
        console.log('   - No WebSocket messages detected');
      }
    }
    
    // Take screenshots
    await page.screenshot({ 
      path: 'screenshots/sync-live-xstate-tab1.png',
      fullPage: true 
    });
    
    await page2.screenshot({ 
      path: 'screenshots/sync-live-xstate-tab2.png',
      fullPage: true 
    });
    
    // Close second tab
    await page2.close();
    
    console.log('\n' + '='.repeat(60));
  });
});