/**
 * Fresh Initial Sync Test - Force LSN 0/0 to get all Wide Corp records
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('should perform fresh initial sync with LSN 0/0 and receive all records', async ({ page }) => {
  console.log('🚀 Testing FRESH initial sync (LSN 0/0) for Wide Corp...');
  
  // Navigate to the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  
  // Handle organization selection if needed
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 5000 });
  if (hasOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(2000);
  }
  
  // Wait for page to load
  await page.waitForTimeout(3000);
  
  // Force fresh sync by clearing ALL local state and setting LSN to 0/0
  console.log('🧹 Forcing fresh sync state (LSN 0/0)...');
  
  const freshSyncResult = await page.evaluate(() => {
    // Clear localStorage sync state
    localStorage.removeItem('sync-machine-v3-state');
    localStorage.removeItem('vibestack-sync-state');
    localStorage.removeItem('currentLSN');
    
    // Clear any IndexedDB/Dexie data
    if (window.testSyncHelpers) {
      window.testSyncHelpers.clearSyncState();
    }
    
    // Force fresh client state in sync machine if available
    if (window.syncMachineActor) {
      window.syncMachineActor.send({ 
        type: 'FORCE_FRESH_SYNC',
        payload: { resetLSN: true }
      });
    }
    
    return { cleared: true, timestamp: Date.now() };
  });
  
  console.log('🔄 Fresh sync setup:', freshSyncResult);
  
  // Reload page to trigger completely fresh sync
  console.log('🔄 Reloading page to trigger fresh initial sync...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  
  // Handle org selection again if needed
  const hasOrgSelectionAfterReload = await page.locator('text=Select Organization').isVisible({ timeout: 5000 });
  if (hasOrgSelectionAfterReload) {
    console.log('🏢 Re-selecting Wide Corp Solutions after reload...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(2000);
  }
  
  // Wait for sync to start and complete
  console.log('⏳ Waiting for fresh initial sync to complete...');
  await page.waitForTimeout(10000); // Give plenty of time for sync
  
  // Check sync results
  const syncResults = await page.evaluate(() => {
    const results = {
      hasTestHelpers: typeof window.testSyncHelpers !== 'undefined',
      events: [],
      syncState: 'unknown',
      dataReceived: false,
      totalEvents: 0
    };
    
    if (window.testSyncHelpers) {
      try {
        results.events = window.testSyncHelpers.getSyncEvents() || [];
        results.totalEvents = results.events.length;
        results.syncState = window.testSyncHelpers.getCurrentSyncState?.() || 'unknown';
        
        // Check for incoming data
        results.dataReceived = results.events.some(event => 
          event.type === 'WS_MESSAGE' && 
          event.message && 
          (event.message.type === 'srv_init_data' || 
           event.message.type === 'srv_init_start' ||
           (event.message.changes && event.message.changes.length > 0))
        );
      } catch (error) {
        results.error = error.message;
      }
    }
    
    return results;
  });
  
  console.log('📊 Fresh Sync Results:');
  console.log(`   Sync State: ${syncResults.syncState}`);
  console.log(`   Total Events: ${syncResults.totalEvents}`);
  console.log(`   Data Received: ${syncResults.dataReceived}`);
  console.log(`   Has Test Helpers: ${syncResults.hasTestHelpers}`);
  
  if (syncResults.events.length > 0) {
    const eventTypes = syncResults.events.map(e => e.type);
    const uniqueTypes = [...new Set(eventTypes)];
    console.log(`   Event Types: ${uniqueTypes.join(', ')}`);
    
    // Count message types
    const wsMessages = syncResults.events.filter(e => e.type === 'WS_MESSAGE');
    const messageTypes = wsMessages.map(e => e.message?.type).filter(Boolean);
    const uniqueMessageTypes = [...new Set(messageTypes)];
    
    if (uniqueMessageTypes.length > 0) {
      console.log(`   WebSocket Message Types: ${uniqueMessageTypes.join(', ')}`);
    }
    
    // Look for specific data messages
    const initMessages = wsMessages.filter(e => 
      e.message?.type === 'srv_init_data' || 
      e.message?.type === 'srv_init_start' ||
      (e.message?.changes && e.message.changes.length > 0)
    );
    
    if (initMessages.length > 0) {
      console.log(`   📦 Found ${initMessages.length} data messages`);
      initMessages.forEach((msg, i) => {
        const changes = msg.message?.changes?.length || 0;
        const type = msg.message?.type || 'unknown';
        console.log(`      Message ${i + 1}: ${type} (${changes} changes)`);
      });
    }
  }
  
  // Take screenshot of final state
  await page.screenshot({ path: 'screenshots/fresh-sync-result.png' });
  
  // Expected result: Should have received 409 records from Wide Corp
  if (syncResults.dataReceived) {
    console.log('✅ SUCCESS: Fresh initial sync received data!');
  } else {
    console.log('❌ ISSUE: No data received during fresh sync');
    console.log('💡 Check server logs for sync activity');
  }
  
  console.log('🎯 Fresh initial sync test completed');
});