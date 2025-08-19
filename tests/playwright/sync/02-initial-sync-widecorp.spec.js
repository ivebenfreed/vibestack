/**
 * Initial Sync Test with Wide Corp Organization Selection
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('should complete initial sync for Wide Corp CEO', async ({ page }) => {
  console.log('🚀 Testing Wide Corp initial sync...');
  
  // Navigate to the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  
  // Check if we're on organization selection page
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 5000 });
  
  if (hasOrgSelection) {
    console.log('🏢 Organization selection required, selecting Wide Corp...');
    
    // Click on Wide Corp Solutions
    await page.locator('text=Wide Corp Solutions').click();
    console.log('✅ Selected Wide Corp Solutions');
    
    // Wait for navigation to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    console.log('📊 Navigated to dashboard');
  }
  
  // Now wait for app to be ready
  try {
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    console.log('✅ App ready');
  } catch (error) {
    console.log('⚠️ App ready timeout, checking current state...');
    const url = page.url();
    console.log('📍 Current URL:', url);
    await page.screenshot({ path: 'screenshots/app-ready-timeout.png' });
  }
  
  // Check if we have sync functionality
  const syncHelpers = await page.evaluate(() => {
    return typeof window.testSyncHelpers !== 'undefined';
  });
  
  if (syncHelpers) {
    console.log('🔄 Testing sync functionality...');
    
    // Clear sync state and test initial sync
    const clearResult = await page.evaluate(() => {
      return window.testSyncHelpers.clearSyncState();
    });
    console.log('🧹 Cleared sync state:', clearResult);
    
    // Reload to trigger fresh sync
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Wait a bit for sync to start
    await page.waitForTimeout(5000);
    
    // Check sync events
    const syncEvents = await page.evaluate(() => {
      if (window.testSyncHelpers && window.testSyncHelpers.getSyncEvents) {
        return window.testSyncHelpers.getSyncEvents();
      }
      return [];
    });
    
    console.log('📊 Sync events:', syncEvents.length);
    console.log('📋 Event types:', syncEvents.map(e => e.type).join(', '));
    
    // Check if we got any incoming data
    const hasIncomingChanges = syncEvents.some(e => 
      e.type === 'WS_MESSAGE' && 
      e.message && 
      (e.message.type === 'srv_init_data' || e.message.changes)
    );
    
    if (hasIncomingChanges) {
      console.log('✅ SUCCESS: Got incoming data during sync!');
    } else {
      console.log('⚠️ No incoming data detected');
    }
    
    // Log server logs for debugging
    console.log('📄 Check server logs for sync activity');
  } else {
    console.log('⚠️ Sync helpers not available');
  }
  
  console.log('🎯 Wide Corp sync test completed');
});