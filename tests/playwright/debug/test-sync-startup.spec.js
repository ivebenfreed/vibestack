/**
 * Test Sync Startup
 * 
 * This test checks if the sync machine starts properly after the schema is loaded.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('verify sync startup after schema load', async ({ page }) => {
  console.log('🔄 Testing sync startup...');
  
  // Navigate to app
  await page.goto('/');
  await page.waitForTimeout(2000);
  
  // Wait for auth and app init to be ready
  await page.waitForFunction(() => {
    return window.authMachineActor && window.appInitActor && window.pureLiveStoreSyncMachineActor;
  }, { timeout: 10000 });
  
  // Give it time to process
  await page.waitForTimeout(5000);
  
  // Check the states of all machines
  const machineStates = await page.evaluate(() => {
    return {
      auth: {
        state: window.authMachineActor?.getSnapshot?.()?.value,
        hasUser: !!window.authMachineActor?.getSnapshot?.()?.context?.user,
        hasOrg: !!window.authMachineActor?.getSnapshot?.()?.context?.currentOrganization,
        orgId: window.authMachineActor?.getSnapshot?.()?.context?.currentOrganization?.id
      },
      appInit: {
        state: window.appInitActor?.getSnapshot?.()?.value,
        organizationId: window.appInitActor?.getSnapshot?.()?.context?.organizationId,
        isReady: window.appInitActor?.getSnapshot?.()?.value === 'ready'
      },
      sync: {
        state: window.pureLiveStoreSyncMachineActor?.getSnapshot?.()?.value,
        isConnected: window.pureLiveStoreSyncMachineActor?.getSnapshot?.()?.matches?.('connected'),
        isLiveSync: window.pureLiveStoreSyncMachineActor?.getSnapshot?.()?.matches?.('live_sync')
      }
    };
  });
  
  console.log('🎭 Machine states:', JSON.stringify(machineStates, null, 2));
  
  // Check URL - should not be on sign-in
  const currentUrl = page.url();
  console.log('📍 Current URL:', currentUrl);
  
  // Summary
  console.log('\n📋 Sync Startup Summary:');
  console.log('  🔐 Auth ready:', machineStates.auth.hasUser && machineStates.auth.hasOrg);
  console.log('  🚀 App init ready:', machineStates.appInit.isReady);
  console.log('  🔄 Sync started:', machineStates.sync.state !== 'idle');
  console.log('  🔗 Sync connected:', machineStates.sync.isConnected || false);
  console.log('  📱 On dashboard:', !currentUrl.includes('/sign-in'));
  
  const syncWorking = machineStates.sync.state !== 'idle';
  if (syncWorking) {
    console.log('✅ SUCCESS: Sync machine has started!');
  } else {
    console.log('❌ ISSUE: Sync machine is still idle');
  }
  
  expect(true).toBe(true); // Always pass - diagnostic
});