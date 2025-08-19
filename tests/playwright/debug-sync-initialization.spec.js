/**
 * Debug Sync Machine Initialization
 */

import { test, expect } from './fixtures/persistent-context.js';

test('Debug sync machine initialization', async ({ page }) => {
  console.log('🧪 Debugging sync machine initialization...');
  
  // Navigate to the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Check current app init state
  const appInitState = await page.evaluate(() => {
    return {
      appInitActor: !!window.appInitActor,
      syncActor: !!window.syncMachineActor,
      appInitState: window.appInitActor ? window.appInitActor.getSnapshot().value : null,
      appInitContext: window.appInitActor ? window.appInitActor.getSnapshot().context : null,
    };
  });
  
  console.log('📊 Initial app state:', appInitState);
  
  // Handle organization selection if needed
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(5000);
  }

  // Check state after organization selection
  const afterOrgState = await page.evaluate(() => {
    return {
      appInitState: window.appInitActor ? window.appInitActor.getSnapshot().value : null,
      appInitContext: window.appInitActor ? window.appInitActor.getSnapshot().context : null,
      syncState: window.syncMachineActor ? window.syncMachineActor.getSnapshot().value : null,
      syncContext: window.syncMachineActor ? window.syncMachineActor.getSnapshot().context : null,
    };
  });
  
  console.log('📊 State after org selection:', afterOrgState);

  // Listen for console messages about LiveStore initialization
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (text.includes('LiveStore') || text.includes('service') || text.includes('sync')) {
      console.log(`🔍 Browser: ${text}`);
    }
  });

  // Wait and monitor for changes
  await page.waitForTimeout(15000);

  // Final state check
  const finalState = await page.evaluate(() => {
    return {
      appInitState: window.appInitActor ? window.appInitActor.getSnapshot().value : null,
      appInitContext: window.appInitActor ? {
        organizationId: window.appInitActor.getSnapshot().context.organizationId,
        isSyncReady: window.appInitActor.getSnapshot().context.isSyncReady,
        error: window.appInitActor.getSnapshot().context.error
      } : null,
      syncState: window.syncMachineActor ? window.syncMachineActor.getSnapshot().value : null,
      syncContext: window.syncMachineActor ? {
        organizationId: window.syncMachineActor.getSnapshot().context.organizationId,
        clientId: window.syncMachineActor.getSnapshot().context.clientId,
        isConnected: window.syncMachineActor.getSnapshot().context.isConnected,
        error: window.syncMachineActor.getSnapshot().context.error
      } : null,
      liveStoreAvailable: typeof window.LiveStore !== 'undefined'
    };
  });
  
  console.log('🎯 Final state:', finalState);
  
  // Print relevant console messages
  const liveStoreMessages = consoleMessages.filter(msg => 
    msg.includes('LiveStore') || msg.includes('Failed to initialize') || msg.includes('error')
  );
  
  console.log('📄 LiveStore-related messages:', liveStoreMessages.slice(-10));

  // The test passes - we're just debugging
  console.log('✅ Debug complete');
});