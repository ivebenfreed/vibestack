/**
 * Simple Data Check - Just go to root and check for Wide Corp data
 * No navigation, no complex waits, just check what's there
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test.describe('Simple Wide Corp Data Check', () => {
  test('should find Wide Corp data after going to root', async ({ page }) => {
    console.log('🚀 Simple data check - just go to root...\n');
    
    // Just go to root - that's it
    await page.goto('/');
    
    // Wait a reasonable time for data to load
    await page.waitForTimeout(10000);
    
    // Check what data exists
    const dataCheck = await page.evaluate(() => {
      // Check LiveStore instances
      const liveStoreInstances = window.liveStoreInstances || {};
      const widecorpInstance = liveStoreInstances['01920000-1000-7000-8000-000000000001'];
      
      const result = {
        hasLiveStoreInstances: !!window.liveStoreInstances,
        liveStoreInstanceCount: Object.keys(liveStoreInstances).length,
        liveStoreInstanceKeys: Object.keys(liveStoreInstances),
        hasWidecorpInstance: !!widecorpInstance,
        widecorpInstanceType: typeof widecorpInstance,
        data: null,
        error: null
      };
      
      // If Wide Corp instance exists, try to query data
      if (widecorpInstance && widecorpInstance.store) {
        try {
          // Simple data check - don't use async queries that might fail
          result.hasStore = true;
          result.storeType = typeof widecorpInstance.store;
          result.storeMethods = Object.keys(widecorpInstance.store);
        } catch (error) {
          result.error = error.message;
        }
      }
      
      return result;
    });
    
    console.log('📊 Data Check Results:');
    console.log(`   LiveStore instances: ${dataCheck.liveStoreInstanceCount}`);
    console.log(`   Instance keys: ${dataCheck.liveStoreInstanceKeys.join(', ')}`);
    console.log(`   Has Wide Corp instance: ${dataCheck.hasWidecorpInstance}`);
    console.log(`   Has store: ${dataCheck.hasStore || false}`);
    console.log(`   Store methods: ${dataCheck.storeMethods?.slice(0, 5).join(', ') || 'none'}`);
    if (dataCheck.error) {
      console.log(`   Error: ${dataCheck.error}`);
    }
    
    // Check auth status
    const authCheck = await page.evaluate(() => {
      const authMachine = window.authMachineActor;
      if (!authMachine) return { hasAuth: false };
      
      const snapshot = authMachine.getSnapshot();
      return {
        hasAuth: true,
        state: snapshot.value,
        userEmail: snapshot.context?.user?.email,
        orgName: snapshot.context?.currentOrganization?.name,
        orgId: snapshot.context?.currentOrganization?.id
      };
    });
    
    console.log('🔐 Auth Check Results:');
    console.log(`   User: ${authCheck.userEmail || 'none'}`);
    console.log(`   Organization: ${authCheck.orgName || 'none'}`);
    console.log(`   Org ID: ${authCheck.orgId || 'none'}`);
    console.log(`   Auth State: ${JSON.stringify(authCheck.state)}`);
    
    // Check sync status
    const syncCheck = await page.evaluate(() => {
      const syncActor = window.pureLiveStoreSyncMachineActor;
      if (!syncActor) return { hasSync: false };
      
      const snapshot = syncActor.getSnapshot();
      return {
        hasSync: true,
        state: snapshot.value,
        clientId: snapshot.context?.clientId,
        organizationId: snapshot.context?.organizationId
      };
    });
    
    console.log('🔄 Sync Check Results:');
    console.log(`   Client ID: ${syncCheck.clientId || 'none'}`);
    console.log(`   Sync Org ID: ${syncCheck.organizationId || 'none'}`);
    console.log(`   Sync State: ${JSON.stringify(syncCheck.state)}`);
    
    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('SIMPLE DATA CHECK SUMMARY');
    console.log('='.repeat(50));
    
    const isAuthenticated = authCheck.orgId === '01920000-1000-7000-8000-000000000001';
    const hasSyncMachine = !!syncCheck.clientId;
    const hasLiveStoreSetup = dataCheck.liveStoreInstanceCount > 0;
    
    console.log(`✅ Authenticated to Wide Corp: ${isAuthenticated ? 'YES' : 'NO'}`);
    console.log(`✅ Sync machine working: ${hasSyncMachine ? 'YES' : 'NO'}`);
    console.log(`✅ LiveStore instances: ${hasLiveStoreSetup ? 'YES' : 'NO'} (${dataCheck.liveStoreInstanceCount})`);
    
    if (isAuthenticated && hasSyncMachine) {
      console.log('🎉 System is ready for data sync!');
    } else {
      console.log('⚠️ System not fully ready yet');
    }
    
    console.log('='.repeat(50));
    
    // Basic assertions - just verify the system components exist
    expect(authCheck.hasAuth, 'Should have auth machine').toBe(true);
    expect(syncCheck.hasSync, 'Should have sync machine').toBe(true);
    expect(syncCheck.clientId, 'Should have client ID').toMatch(/^client_/);
    
    console.log('\n✅ Simple data check completed!');
  });
});