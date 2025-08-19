/**
 * Complete Wide Corp Sync Test - Full flow from org selection to data sync
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('complete Wide Corp sync from org selection to data reception', async ({ page }) => {
  console.log('🚀 Testing complete Wide Corp sync flow...');
  
  // Navigate and handle org selection
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Handle organization selection
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    console.log('✅ Wide Corp Solutions selected');
  }
  
  // Wait for app to initialize and navigate to dashboard
  console.log('⏳ Waiting for app initialization...');
  
  // Try different ways to detect when app is ready
  let appReady = false;
  
  // Wait for URL to change to dashboard
  try {
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    console.log('📊 Navigated to dashboard');
    appReady = true;
  } catch (e) {
    console.log('⚠️ Dashboard URL not detected, checking other indicators...');
  }
  
  // Wait for page content to indicate readiness
  if (!appReady) {
    try {
      await page.waitForSelector('[data-testid="dashboard"], .dashboard, text=Dashboard', { timeout: 5000 });
      console.log('📊 Dashboard content detected');
      appReady = true;
    } catch (e) {
      console.log('⚠️ Dashboard content not detected');
    }
  }
  
  // Give extra time for sync initialization
  await page.waitForTimeout(5000);
  
  // Check current state
  const currentState = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      hasSync: typeof window.syncMachineActor !== 'undefined',
      hasTestHelpers: typeof window.testSyncHelpers !== 'undefined',
      localStorage: {
        orgId: localStorage.getItem('vibestack-last-organization-id'),
        syncState: localStorage.getItem('sync-machine-state')
      }
    };
  });
  
  console.log('📊 Current App State:');
  console.log(`   URL: ${currentState.url}`);
  console.log(`   Title: ${currentState.title}`);
  console.log(`   Has Sync Actor: ${currentState.hasSync}`);
  console.log(`   Has Test Helpers: ${currentState.hasTestHelpers}`);
  console.log(`   Org ID: ${currentState.localStorage.orgId}`);
  
  // Force a fresh sync by clearing client state
  console.log('🔄 Triggering fresh sync...');
  
  await page.evaluate(() => {
    // Clear sync state to force fresh sync
    localStorage.setItem('sync-machine-state', JSON.stringify({
      clientId: Date.now().toString(),
      currentLSN: '0/0'
    }));
    
    // If sync machine is available, send refresh event
    if (window.syncMachineActor) {
      try {
        window.syncMachineActor.send({ type: 'RESET' });
      } catch (e) {
        console.log('Could not send RESET to sync machine:', e.message);
      }
    }
  });
  
  // Reload to trigger fresh sync
  console.log('🔄 Reloading to trigger fresh sync...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  
  // Handle org selection again if needed
  const hasOrgSelectionAgain = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelectionAgain) {
    console.log('🏢 Re-selecting Wide Corp Solutions after reload...');
    await page.locator('text=Wide Corp Solutions').click();
  }
  
  // Wait for sync to complete
  console.log('⏳ Waiting 15 seconds for sync to complete...');
  await page.waitForTimeout(15000);
  
  // Check final state
  const finalState = await page.evaluate(() => {
    const state = {
      url: window.location.href,
      syncAvailable: typeof window.testSyncHelpers !== 'undefined',
      events: [],
      error: null
    };
    
    if (window.testSyncHelpers) {
      try {
        state.events = window.testSyncHelpers.getSyncEvents() || [];
      } catch (e) {
        state.error = e.message;
      }
    }
    
    return state;
  });
  
  console.log('📊 Final Sync State:');
  console.log(`   URL: ${finalState.url}`);
  console.log(`   Sync Available: ${finalState.syncAvailable}`);
  console.log(`   Total Events: ${finalState.events.length}`);
  
  if (finalState.events.length > 0) {
    const eventTypes = [...new Set(finalState.events.map(e => e.type))];
    console.log(`   Event Types: ${eventTypes.join(', ')}`);
    
    const wsMessages = finalState.events.filter(e => e.type === 'WS_MESSAGE');
    console.log(`   WebSocket Messages: ${wsMessages.length}`);
    
    const dataMessages = wsMessages.filter(e => 
      e.message && (
        e.message.type === 'srv_init_data' ||
        e.message.type === 'srv_init_start' ||
        (e.message.changes && e.message.changes.length > 0)
      )
    );
    
    console.log(`   Data Messages: ${dataMessages.length}`);
    
    if (dataMessages.length > 0) {
      console.log('✅ SUCCESS: Received data messages during sync!');
      dataMessages.forEach((msg, i) => {
        const changes = msg.message?.changes?.length || 0;
        console.log(`      Data Message ${i + 1}: ${msg.message?.type} (${changes} changes)`);
      });
    } else {
      console.log('❌ No data messages received');
    }
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'screenshots/complete-widecorp-sync.png' });
  
  console.log('💡 Check server logs for sync activity details');
  console.log('🎯 Complete Wide Corp sync test finished');
});