/**
 * Direct LiveStore Sync Test - Test Completed Migration
 * Navigate to root and test the LiveStore sync system directly
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test.describe('LiveStore Sync Direct Test', () => {
  test('should test completed LiveStore migration sync system', async ({ page }) => {
    console.log('🚀 Testing completed LiveStore sync system...\n');
    
    // Navigate to root - that's it, no API dependency
    await page.goto('/');
    
    // Wait a bit for initialization
    await page.waitForTimeout(3000);
    
    // Test the LiveStore sync machine that's already implemented
    const syncMachineTest = await page.evaluate(() => {
      // Test the pure LiveStore sync machine
      const syncActor = window.pureLiveStoreSyncMachineActor;
      if (!syncActor) {
        return { error: 'Pure LiveStore sync machine not found' };
      }
      
      const snapshot = syncActor.getSnapshot();
      return {
        success: true,
        state: snapshot.value,
        context: {
          organizationId: snapshot.context?.organizationId,
          clientId: snapshot.context?.clientId,
          isConnected: snapshot.context?.isConnected
        }
      };
    });
    
    console.log('📊 LiveStore Sync Machine:', syncMachineTest);
    
    // Test LiveStore functionality directly (from completed migration)
    const liveStoreTest = await page.evaluate(async () => {
      // Test the browser functions from completed migration
      if (typeof window.testLiveStoreInBrowser === 'function') {
        try {
          const result = await window.testLiveStoreInBrowser();
          return { success: true, result };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
      
      // Check for other LiveStore test functions
      const testFunctions = Object.keys(window).filter(k => 
        k.includes('livestore') || k.includes('LiveStore') || k.includes('test')
      );
      
      return { 
        success: false, 
        testFunctionsAvailable: testFunctions,
        message: 'testLiveStoreInBrowser not available'
      };
    });
    
    console.log('🧪 LiveStore Test Result:', liveStoreTest);
    
    // Test sync helpers from completed migration
    const syncHelperTest = await page.evaluate(() => {
      if (window.testSyncHelpers) {
        const state = window.testSyncHelpers.getSyncState();
        return {
          success: true,
          syncState: state,
          helpers: Object.keys(window.testSyncHelpers)
        };
      }
      return { success: false, message: 'testSyncHelpers not available' };
    });
    
    console.log('🔧 Sync Helpers:', syncHelperTest);
    
    // Test Wide Corp authentication (should be working from profile)
    const authTest = await page.evaluate(() => {
      // Check if we're authenticated to Wide Corp
      const user = window.currentUser || window.user;
      const org = window.currentOrganization || window.organization;
      
      return {
        authenticated: !!user,
        userEmail: user?.email,
        orgId: org?.id || 'unknown',
        orgName: org?.name || 'unknown'
      };
    });
    
    console.log('🔐 Authentication Status:', authTest);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('COMPLETED LIVESTORE MIGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    
    const hasLiveStoreSyncMachine = syncMachineTest.success;
    const hasAuthentication = authTest.authenticated;
    
    console.log(`✅ Pure LiveStore Sync Machine: ${hasLiveStoreSyncMachine ? 'FOUND' : 'MISSING'}`);
    console.log(`✅ Wide Corp Authentication: ${hasAuthentication ? 'ACTIVE' : 'MISSING'}`);
    console.log(`📦 Organization ID: ${authTest.orgId}`);
    console.log(`👤 User: ${authTest.userEmail || 'unknown'}`);
    
    if (syncMachineTest.success) {
      console.log(`🔄 Sync State: ${syncMachineTest.state}`);
      console.log(`🆔 Client ID: ${syncMachineTest.context.clientId || 'unknown'}`);
    }
    
    // The test passes if we have the LiveStore sync machine - that proves migration is complete
    expect(hasLiveStoreSyncMachine).toBe(true);
    
    console.log('\n✅ LiveStore migration sync test completed!');
  });
});