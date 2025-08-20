/**
 * Debug Initialization Flow
 * 
 * This test examines the complete initialization flow to understand
 * why the ultra-fast local-first loading isn't working as expected.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('debug complete initialization flow', async ({ page }) => {
  console.log('🚀 Debugging complete initialization flow...');
  
  // Navigate and capture flow
  await page.goto('/');
  
  // Wait for initial load
  await page.waitForTimeout(1000);
  
  // Get detailed state of all machines
  const initialState = await page.evaluate(() => {
    return {
      timestamp: Date.now(),
      authMachine: {
        exists: !!window.authMachineActor,
        state: window.authMachineActor?.getSnapshot?.()?.value,
        context: {
          user: !!window.authMachineActor?.getSnapshot?.()?.context?.user,
          currentOrg: !!window.authMachineActor?.getSnapshot?.()?.context?.currentOrganization,
          userOrganizations: window.authMachineActor?.getSnapshot?.()?.context?.userOrganizations?.length || 0,
        }
      },
      appInitMachine: {
        exists: !!window.appInitActor,
        state: window.appInitActor?.getSnapshot?.()?.value,
        context: {
          hasLocalData: window.appInitActor?.getSnapshot?.()?.context?.hasLocalData,
          localDataChecked: window.appInitActor?.getSnapshot?.()?.context?.localDataChecked,
          isDatabaseInitialized: window.appInitActor?.getSnapshot?.()?.context?.isDatabaseInitialized,
          isLiveStoreReady: window.appInitActor?.getSnapshot?.()?.context?.isLiveStoreReady,
          organizationId: window.appInitActor?.getSnapshot?.()?.context?.organizationId
        }
      },
      syncMachine: {
        exists: !!window.pureLiveStoreSyncMachineActor,
        state: window.pureLiveStoreSyncMachineActor?.getSnapshot?.()?.value
      },
      localStorage: {
        authMachine: !!localStorage.getItem('auth-machine-state'),
        keys: Object.keys(localStorage)
      },
      url: window.location.href
    };
  });
  
  console.log('📊 Initial state (t=0):', JSON.stringify(initialState, null, 2));
  
  // Wait for things to settle and check again
  await page.waitForTimeout(3000);
  
  const settledState = await page.evaluate(() => {
    return {
      timestamp: Date.now(),
      authMachine: {
        exists: !!window.authMachineActor,
        state: window.authMachineActor?.getSnapshot?.()?.value,
        matches: {
          authenticated: window.authMachineActor?.getSnapshot?.()?.matches?.('authenticated'),
          ready: window.authMachineActor?.getSnapshot?.()?.matches?.('authenticated.ready')
        },
        context: {
          user: !!window.authMachineActor?.getSnapshot?.()?.context?.user,
          currentOrg: !!window.authMachineActor?.getSnapshot?.()?.context?.currentOrganization,
          userOrganizations: window.authMachineActor?.getSnapshot?.()?.context?.userOrganizations?.length || 0,
        }
      },
      appInitMachine: {
        exists: !!window.appInitActor,
        state: window.appInitActor?.getSnapshot?.()?.value,
        context: {
          hasLocalData: window.appInitActor?.getSnapshot?.()?.context?.hasLocalData,
          localDataChecked: window.appInitActor?.getSnapshot?.()?.context?.localDataChecked,
          isDatabaseInitialized: window.appInitActor?.getSnapshot?.()?.context?.isDatabaseInitialized,
          isLiveStoreReady: window.appInitActor?.getSnapshot?.()?.context?.isLiveStoreReady,
          organizationId: window.appInitActor?.getSnapshot?.()?.context?.organizationId
        }
      },
      syncMachine: {
        exists: !!window.pureLiveStoreSyncMachineActor,
        state: window.pureLiveStoreSyncMachineActor?.getSnapshot?.()?.value
      },
      localStorage: {
        authMachine: !!localStorage.getItem('auth-machine-state'),
        keys: Object.keys(localStorage)
      },
      url: window.location.href
    };
  });
  
  console.log('📊 Settled state (t=3s):', JSON.stringify(settledState, null, 2));
  
  // Check if any events were triggered  
  const eventCheck = await page.evaluate(() => {
    // Try to manually trigger app init if it hasn't started
    const authActor = window.authMachineActor;
    const appInitActor = window.appInitActor;
    
    if (authActor && appInitActor) {
      const authSnapshot = authActor.getSnapshot();
      const appInitSnapshot = appInitActor.getSnapshot();
      
      // Log the communication between machines
      const hasOrg = !!authSnapshot.context.currentOrganization;
      const orgId = authSnapshot.context.currentOrganization?.id;
      const appInitState = appInitSnapshot.value;
      
      return {
        authHasOrg: hasOrg,
        authOrgId: orgId,
        appInitState: appInitState,
        appInitIdle: appInitState === 'idle'
      };
    }
    
    return { error: 'Actors not found' };
  });
  
  console.log('🔗 Machine communication check:', eventCheck);
  
  // If app init is still idle, try to trigger it manually
  if (eventCheck.appInitState === 'idle' && eventCheck.authOrgId) {
    console.log('🎯 Manually triggering app init...');
    const manualTrigger = await page.evaluate((orgId) => {
      window.appInitActor?.send({ type: 'START_INIT', organizationId: orgId });
      return { triggered: true, orgId };
    }, eventCheck.authOrgId);
    
    console.log('Manual trigger result:', manualTrigger);
    
    // Wait and check result
    await page.waitForTimeout(2000);
    const afterTrigger = await page.evaluate(() => ({
      appInitState: window.appInitActor?.getSnapshot?.()?.value,
      timestamp: Date.now()
    }));
    
    console.log('After manual trigger:', afterTrigger);
  }
  
  // Final summary
  console.log('\n📋 Initialization Flow Summary:');
  console.log('  - Auth machine loaded:', settledState.authMachine.exists);
  console.log('  - Auth is authenticated:', settledState.authMachine.matches.authenticated);
  console.log('  - Auth has user:', settledState.authMachine.context.user);
  console.log('  - Auth has org:', settledState.authMachine.context.currentOrg);
  console.log('  - App init loaded:', settledState.appInitMachine.exists);
  console.log('  - App init state:', settledState.appInitMachine.state);
  console.log('  - LocalStorage persisted:', settledState.localStorage.authMachine);
  console.log('  - Final URL:', settledState.url);
  
  expect(true).toBe(true); // Always pass - diagnostic
});