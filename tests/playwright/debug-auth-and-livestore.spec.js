/**
 * Debug Authentication and LiveStore Flow
 */

import { test, expect } from './fixtures/persistent-context.js';

test('Debug auth flow and LiveStore initialization', async ({ page }) => {
  console.log('🧪 Debugging auth flow and LiveStore initialization...');
  
  // Navigate to the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  
  // Check initial state
  let authState = await page.evaluate(() => {
    return {
      authMachine: !!window.authMachine,
      authState: window.authMachine ? window.authMachine.getSnapshot().value : null,
      authContext: window.authMachine ? {
        user: !!window.authMachine.getSnapshot().context.user,
        authenticated: window.authMachine.getSnapshot().context.authenticated
      } : null
    };
  });
  
  console.log('🔐 Initial auth state:', authState);
  
  // Wait for auth to resolve
  await page.waitForTimeout(5000);
  
  authState = await page.evaluate(() => {
    return {
      authMachine: !!window.authMachine,
      authState: window.authMachine ? window.authMachine.getSnapshot().value : null,
      authContext: window.authMachine ? {
        user: !!window.authMachine.getSnapshot().context.user,
        authenticated: window.authMachine.getSnapshot().context.authenticated,
        email: window.authMachine.getSnapshot().context.user?.email
      } : null
    };
  });
  
  console.log('🔐 Auth state after wait:', authState);
  
  // Check if we need to select organization
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Organization selection needed, selecting Wide Corp...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(3000);
  } else {
    console.log('🏢 No organization selection needed');
  }
  
  // Check app init state
  const appState = await page.evaluate(() => {
    return {
      appInitActor: !!window.appInitActor,
      appInitState: window.appInitActor ? window.appInitActor.getSnapshot().value : null,
      orgId: window.appInitActor ? window.appInitActor.getSnapshot().context.organizationId : null,
      syncReady: window.appInitActor ? window.appInitActor.getSnapshot().context.isSyncReady : null
    };
  });
  
  console.log('📱 App init state:', appState);
  
  // Check sync machine state  
  const syncState = await page.evaluate(() => {
    return {
      syncActor: !!window.syncMachineActor,
      syncState: window.syncMachineActor ? window.syncMachineActor.getSnapshot().value : null,
      syncContext: window.syncMachineActor ? {
        organizationId: window.syncMachineActor.getSnapshot().context.organizationId,
        isConnected: window.syncMachineActor.getSnapshot().context.isConnected
      } : null
    };
  });
  
  console.log('🔄 Sync machine state:', syncState);
  
  // Wait for sync to potentially connect
  await page.waitForTimeout(10000);
  
  // Final check for LiveStore
  const finalState = await page.evaluate(() => {
    return {
      liveStore: typeof window.LiveStore !== 'undefined',
      syncConnected: window.syncMachineActor ? window.syncMachineActor.getSnapshot().context.isConnected : false,
      orgId: window.syncMachineActor ? window.syncMachineActor.getSnapshot().context.organizationId : null
    };
  });
  
  console.log('🎯 Final state:', finalState);
  
  if (!finalState.syncConnected) {
    throw new Error('Sync machine never connected - auth or organization issue');
  }
  
  if (!finalState.liveStore) {
    console.error('❌ LiveStore never initialized despite sync being connected');
  } else {
    console.log('✅ LiveStore initialized successfully!');
  }
});