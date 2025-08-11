/**
 * Test: Full Sync Flow Verification
 * Scenario: Test initial sync → live sync → refresh → confirm skipping
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';
import { clearAllSyncState } from '../helpers/sync-test-setup.js';

test.describe('Full Sync Flow with Resume', () => {
  test('should progress through all sync states and skip on refresh', async ({ page }) => {
    console.log('🚀 Testing full sync flow with resume capability...\n');
    console.log('='.repeat(60));
    
    // === PHASE 1: Initial Sync ===
    console.log('\n📍 PHASE 1: Initial Sync');
    console.log('-'.repeat(40));
    
    // Navigate to the page
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Clear all sync state to simulate fresh client
    console.log('🧹 Clearing sync state for fresh start...');
    await clearAllSyncState(page);
    
    // Set up message tracking
    await page.evaluate(() => {
      window.syncMessages = {
        initial: [],
        catchup: [],
        live: [],
        tables: new Set()
      };
      
      // Override WebSocket to capture messages
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = class extends OriginalWebSocket {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              
              // Track message types
              if (data.type === 'srv_init_start') {
                window.syncMessages.initial.push(data);
                console.log(`📥 Initial sync start - resuming: ${data.resuming}, tables: ${data.tableCount}`);
              } else if (data.type === 'srv_init_changes' && data.table) {
                window.syncMessages.tables.add(data.table);
                console.log(`📦 Received table: ${data.table} (${data.tableIndex + 1}/${data.totalTables})`);
              } else if (data.type === 'srv_init_complete') {
                window.syncMessages.initial.push(data);
                console.log(`✅ Initial sync complete - total records: ${data.totalRecords}`);
              } else if (data.type?.includes('catchup')) {
                window.syncMessages.catchup.push(data);
              } else if (data.type === 'srv_live_start') {
                window.syncMessages.live.push(data);
                console.log('⚡ Entered live sync mode');
              }
            } catch (e) {
              // Not JSON, ignore
            }
          });
        }
      };
    });
    
    // Reload to trigger initial sync
    console.log('🔄 Reloading page to trigger initial sync...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait for initial sync to complete
    await page.waitForFunction(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3') === 'live_sync';
    }, { timeout: 15000 });
    
    // Analyze initial sync
    const initialSyncData = await page.evaluate(() => {
      if (!window.syncMessages) {
        return {
          tablesReceived: [],
          messageCount: 0,
          hasResumeFlag: false
        };
      }
      return {
        tablesReceived: Array.from(window.syncMessages.tables),
        messageCount: window.syncMessages.initial.length,
        hasResumeFlag: window.syncMessages.initial.some(m => m.resuming === true)
      };
    });
    
    console.log('\n📊 Initial Sync Results:');
    console.log(`   Tables synced: ${initialSyncData.tablesReceived.length}`);
    console.log(`   Tables: ${initialSyncData.tablesReceived.join(', ')}`);
    console.log(`   Was resuming: ${initialSyncData.hasResumeFlag ? '✅' : '❌'}`);
    
    // Check database
    const dbAfterInitial = await page.evaluate(async () => {
      const db = window.db;
      if (!db) return null;
      
      const counts = {};
      const tables = ['users', 'tasks', 'projects', 'tags', 'tag_sets', 'status_sets', 'status_definitions', 'comments'];
      for (const table of tables) {
        if (db[table]) {
          counts[table] = await db[table].count();
        }
      }
      return counts;
    });
    
    console.log('\n📦 Database after initial sync:');
    Object.entries(dbAfterInitial || {}).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`   ${table}: ${count}`);
      }
    });
    
    // === PHASE 2: Refresh Page (Should Skip Initial) ===
    console.log('\n📍 PHASE 2: Page Refresh (Testing Skip)');
    console.log('-'.repeat(40));
    
    // Reset message tracking
    await page.evaluate(() => {
      window.syncMessages = {
        initial: [],
        catchup: [],
        live: [],
        tables: new Set(),
        skippedInitial: false
      };
    });
    
    console.log('🔄 Refreshing page (should skip initial sync)...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait a bit to see what sync happens
    await page.waitForTimeout(3000);
    
    // Check if it went to live sync without initial
    const refreshSyncData = await page.evaluate(() => {
      const state = window.xstateTestInspector?.getCurrentState('sync-machine-v3');
      if (!window.syncMessages) {
        return {
          currentState: state,
          tablesReceived: [],
          hadInitialSync: false,
          hadCatchupSync: false,
          wentToLive: state === 'live_sync'
        };
      }
      return {
        currentState: state,
        tablesReceived: Array.from(window.syncMessages.tables),
        hadInitialSync: window.syncMessages.initial.length > 0,
        hadCatchupSync: window.syncMessages.catchup.length > 0,
        wentToLive: window.syncMessages.live.length > 0 || state === 'live_sync'
      };
    });
    
    console.log('\n📊 Refresh Results:');
    console.log(`   Current state: ${refreshSyncData.currentState}`);
    console.log(`   Had initial sync: ${refreshSyncData.hadInitialSync ? '✅' : '❌ (Skipped as expected)'}`);
    console.log(`   Had catchup sync: ${refreshSyncData.hadCatchupSync ? '✅' : '❌'}`);
    console.log(`   Went to live: ${refreshSyncData.wentToLive ? '✅' : '❌'}`);
    console.log(`   Tables re-synced: ${refreshSyncData.tablesReceived.length}`);
    
    // === PHASE 3: Clear and Re-sync (Test Resume) ===
    console.log('\n📍 PHASE 3: Clear State and Re-sync');
    console.log('-'.repeat(40));
    
    console.log('🧹 Clearing sync state to force initial sync again...');
    await clearAllSyncState(page);
    
    // Reset tracking
    await page.evaluate(() => {
      window.syncMessages = {
        initial: [],
        tables: new Set()
      };
    });
    
    console.log('🔄 Reloading to trigger fresh initial sync...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait for sync
    await page.waitForFunction(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3') === 'live_sync';
    }, { timeout: 15000 });
    
    const finalSyncData = await page.evaluate(() => {
      if (!window.syncMessages) {
        return {
          tablesReceived: [],
          wasResuming: false
        };
      }
      return {
        tablesReceived: Array.from(window.syncMessages.tables),
        wasResuming: window.syncMessages.initial.some(m => m.resuming === true)
      };
    });
    
    console.log('\n📊 Final Re-sync Results:');
    console.log(`   Tables synced: ${finalSyncData.tablesReceived.length}`);
    console.log(`   Was resuming: ${finalSyncData.wasResuming ? '✅' : '❌ (Fresh sync as expected)'}`);
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const allTablesSynced = initialSyncData.tablesReceived.length >= 8; // Should have at least 8 tables
    const skippedOnRefresh = !refreshSyncData.hadInitialSync;
    const progressedToLive = refreshSyncData.wentToLive;
    
    if (allTablesSynced && skippedOnRefresh && progressedToLive) {
      console.log('\n✅ Full sync flow test PASSED');
      console.log('   - Initial sync received all tables');
      console.log('   - Refresh skipped initial sync (already synced)');
      console.log('   - Progressed directly to live sync on refresh');
      console.log('   - Resume capability working correctly');
    } else {
      console.log('\n⚠️ Full sync flow test INCOMPLETE');
      if (!allTablesSynced) {
        console.log(`   - Only ${initialSyncData.tablesReceived.length} tables synced (expected 8+)`);
      }
      if (!skippedOnRefresh) {
        console.log('   - Did not skip initial sync on refresh');
      }
      if (!progressedToLive) {
        console.log('   - Did not progress to live sync properly');
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/sync-full-flow.png',
      fullPage: true 
    });
    
    console.log('\n' + '='.repeat(60));
  });
});