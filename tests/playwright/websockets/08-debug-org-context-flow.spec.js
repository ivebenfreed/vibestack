/**
 * Debug Organization Context Flow - Auth → App Init → Sync
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('debug organization context passing through auth → app init → sync chain', async ({ page }) => {
  console.log('🔍 Debugging organization context flow...');
  
  // Navigate and handle org selection
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Check auth machine state first
  const authState = await page.evaluate(() => {
    const authActor = window.authMachineActor;
    if (authActor) {
      const snapshot = authActor.getSnapshot();
      return {
        state: snapshot.value,
        authenticated: snapshot.matches('authenticated'),
        currentOrganization: snapshot.context.currentOrganization,
        userOrganizations: snapshot.context.userOrganizations,
        organizationSetupComplete: snapshot.context.organizationSetupComplete,
        needsOrganizationSetup: snapshot.context.needsOrganizationSetup
      };
    }
    return null;
  });
  
  console.log('🔐 Auth Machine State:', authState);
  
  // Handle organization selection if needed
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Organization selection required, selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(3000);
    
    // Check auth state after org selection
    const postOrgAuthState = await page.evaluate(() => {
      const authActor = window.authMachineActor;
      if (authActor) {
        const snapshot = authActor.getSnapshot();
        return {
          state: snapshot.value,
          authenticated: snapshot.matches('authenticated'),
          currentOrganization: snapshot.context.currentOrganization,
          organizationSetupComplete: snapshot.context.organizationSetupComplete
        };
      }
      return null;
    });
    
    console.log('🏢 Auth State After Org Selection:', postOrgAuthState);
  } else {
    console.log('📊 No organization selection needed');
  }
  
  await page.waitForTimeout(2000);
  
  // Check app init machine state
  const appInitState = await page.evaluate(() => {
    const appInitActor = window.appInitActor;
    if (appInitActor) {
      const snapshot = appInitActor.getSnapshot();
      return {
        state: snapshot.value,
        organizationId: snapshot.context.organizationId,
        isDatabaseInitialized: snapshot.context.isDatabaseInitialized,
        isSyncReady: snapshot.context.isSyncReady
      };
    }
    return null;
  });
  
  console.log('🔄 App Init Machine State:', appInitState);
  
  // Check sync machine state
  const syncState = await page.evaluate(() => {
    const syncActor = window.syncMachineActor;
    if (syncActor) {
      const snapshot = syncActor.getSnapshot();
      return {
        state: snapshot.value,
        organizationId: snapshot.context.organizationId,
        clientId: snapshot.context.clientId,
        isConnected: snapshot.context.isConnected,
        error: snapshot.context.error
      };
    }
    return null;
  });
  
  console.log('⚙️ Sync Machine State:', syncState);
  
  // Check localStorage for organization info
  const storageInfo = await page.evaluate(() => {
    return {
      lastOrgId: localStorage.getItem('vibestack-last-organization-id'),
      authState: localStorage.getItem('auth-machine-state')?.substring(0, 200) + '...',
      syncState: localStorage.getItem('sync-machine-state')
    };
  });
  
  console.log('💾 Storage Info:', storageInfo);
  
  // Manual trigger test - send START_INIT with org ID
  console.log('🧪 Testing manual START_INIT with organization ID...');
  const manualResult = await page.evaluate(() => {
    const orgId = localStorage.getItem('vibestack-last-organization-id');
    const appInitActor = window.appInitActor;
    
    if (appInitActor && orgId) {
      console.log(`Sending START_INIT with organizationId: ${orgId}`);
      appInitActor.send({ 
        type: 'START_INIT', 
        organizationId: orgId 
      });
      
      // Check if it was received
      const snapshot = appInitActor.getSnapshot();
      return {
        sent: true,
        orgIdSent: orgId,
        appInitOrgId: snapshot.context.organizationId
      };
    }
    
    return { sent: false, reason: 'Missing appInitActor or orgId' };
  });
  
  console.log('🧪 Manual START_INIT Result:', manualResult);
  
  await page.waitForTimeout(2000);
  
  // Check states after manual trigger
  const finalAppInitState = await page.evaluate(() => {
    const appInitActor = window.appInitActor;
    if (appInitActor) {
      const snapshot = appInitActor.getSnapshot();
      return {
        state: snapshot.value,
        organizationId: snapshot.context.organizationId
      };
    }
    return null;
  });
  
  const finalSyncState = await page.evaluate(() => {
    const syncActor = window.syncMachineActor;
    if (syncActor) {
      const snapshot = syncActor.getSnapshot();
      return {
        state: snapshot.value,
        organizationId: snapshot.context.organizationId
      };
    }
    return null;
  });
  
  console.log('🎯 Final App Init State:', finalAppInitState);
  console.log('🎯 Final Sync State:', finalSyncState);
  
  console.log('🔍 Organization context flow debug completed');
});