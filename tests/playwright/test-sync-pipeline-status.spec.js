/**
 * Test Sync Pipeline Status
 * 
 * Quick check of LiveStore and sync components availability
 */

import { test, expect } from '@playwright/test';

test('Sync pipeline status check', async ({ page }) => {
  console.log('🔄 Checking sync pipeline status...');
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    if (text.includes('LiveStore') || 
        text.includes('LocalChanges') ||
        text.includes('sync') ||
        text.includes('Wide Corp')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Quick auth flow
  console.log('🔐 Quick authentication...');
  await page.goto('http://localhost:5173/sign-in');
  
  await page.evaluate(() => {
    localStorage.removeItem('vibestack-last-organization-id');
    localStorage.removeItem('auth-machine-state');
  });
  
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  
  // Quick org selection check
  let orgSelected = false;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const hasOrgSelection = await page.locator('text=Wide Corp Solutions').isVisible().catch(() => false);
    if (hasOrgSelection) {
      console.log('👆 Selecting Wide Corp Solutions...');
      await page.locator('text=Wide Corp Solutions').click();
      orgSelected = true;
      break;
    }
  }
  
  if (orgSelected) {
    console.log('✅ Organization selection successful');
    await page.waitForTimeout(5000);
  } else {
    console.log('⚠️ No organization selection needed or available');
  }
  
  // Navigate to debug page
  console.log('🔍 Navigating to debug page...');
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForTimeout(3000);
  
  // Check all components in one go
  console.log('🧪 Checking all sync components...');
  
  const syncPipelineStatus = await page.evaluate(async () => {
    const results = {
      timestamp: Date.now(),
      url: window.location.href,
      components: {}
    };
    
    try {
      // Check LiveStore client
      results.components.liveStoreClient = {
        available: !!window.liveStoreClient,
        type: typeof window.liveStoreClient
      };
      
      // Check LocalChanges database
      results.components.localChanges = {
        available: !!(window.db && window.db.localChanges),
        dbExists: !!window.db,
        dbKeys: window.db ? Object.keys(window.db) : []
      };
      
      // Check sync helpers
      results.components.syncHelpers = {
        available: !!window.testSyncHelpers,
        functions: window.testSyncHelpers ? Object.keys(window.testSyncHelpers) : []
      };
      
      // Check XState inspector
      results.components.xstateInspector = {
        available: !!window.xstateTestInspector,
        functions: window.xstateTestInspector ? Object.keys(window.xstateTestInspector) : []
      };
      
      // Check DexieOutgoingChangeService
      results.components.dexieService = {
        available: !!window.DexieOutgoingChangeService
      };
      
      // Check auth state
      const authState = localStorage.getItem('auth-machine-state');
      results.auth = {
        hasState: !!authState,
        state: authState ? JSON.parse(authState).value : null
      };
      
      // Check organization persistence
      const orgId = localStorage.getItem('vibestack-last-organization-id');
      results.organization = {
        persisted: !!orgId,
        id: orgId
      };
      
      // Try to get LocalChanges count if available
      if (window.db && window.db.localChanges) {
        try {
          results.localChangesCount = await window.db.localChanges.count();
          console.log(`[BROWSER] LocalChanges count: ${results.localChangesCount}`);
        } catch (error) {
          results.localChangesError = error.message;
        }
      }
      
      // Check for LiveStore test function
      if (window.testLiveStoreInBrowser) {
        results.components.liveStoreTestFunction = {
          available: true,
          type: typeof window.testLiveStoreInBrowser
        };
      }
      
      console.log('[BROWSER] Sync pipeline status check complete');
      return results;
      
    } catch (error) {
      console.log('[BROWSER] Error during status check:', error.message);
      results.error = error.message;
      return results;
    }
  });
  
  // Take screenshot
  await page.screenshot({ path: 'sync-pipeline-status.png' });
  
  // Analyze and report
  console.log('\n=== SYNC PIPELINE STATUS ANALYSIS ===');
  
  const components = syncPipelineStatus.components || {};
  const auth = syncPipelineStatus.auth || {};
  const org = syncPipelineStatus.organization || {};
  
  console.log(`🔐 Authentication State: ${auth.hasState ? '✅' : '❌'} (${auth.state || 'unknown'})`);
  console.log(`🏢 Organization Persisted: ${org.persisted ? '✅' : '❌'} (${org.id || 'none'})`);
  console.log(`🗄️ LiveStore Client: ${components.liveStoreClient?.available ? '✅' : '❌'}`);
  console.log(`📝 LocalChanges Database: ${components.localChanges?.available ? '✅' : '❌'}`);
  console.log(`🔄 Sync Helpers: ${components.syncHelpers?.available ? '✅' : '❌'}`);
  console.log(`🔍 XState Inspector: ${components.xstateInspector?.available ? '✅' : '❌'}`);
  console.log(`🌉 Dexie Service: ${components.dexieService?.available ? '✅' : '❌'}`);
  
  if (syncPipelineStatus.localChangesCount !== undefined) {
    console.log(`📊 LocalChanges Records: ${syncPipelineStatus.localChangesCount}`);
  }
  
  if (components.liveStoreTestFunction?.available) {
    console.log(`🧪 LiveStore Test Function: ✅`);
  }
  
  // Count available components
  const availableComponents = Object.values(components)
    .filter(comp => comp && comp.available).length;
  const totalComponents = Object.keys(components).length;
  
  console.log(`\n📊 Component Summary: ${availableComponents}/${totalComponents} available`);
  
  // Determine pipeline readiness
  const coreComponentsReady = 
    components.localChanges?.available && 
    (components.syncHelpers?.available || components.xstateInspector?.available);
    
  const authReady = auth.hasState && org.persisted;
  
  console.log('\n=== PIPELINE READINESS ===');
  console.log(`🔐 Auth Infrastructure: ${authReady ? '✅ READY' : '❌ NOT READY'}`);
  console.log(`🔄 Sync Infrastructure: ${coreComponentsReady ? '✅ READY' : '❌ NOT READY'}`);
  console.log(`🗄️ LiveStore Available: ${components.liveStoreClient?.available ? '✅ YES' : '❌ NO'}`);
  
  if (authReady && coreComponentsReady) {
    console.log('🎉 SUCCESS: Pipeline ready for testing!');
  } else if (authReady) {
    console.log('⚠️ PARTIAL: Auth ready, sync components need setup');
  } else {
    console.log('❌ BLOCKED: Core infrastructure not ready');
  }
  
  console.log('\n=== NEXT STEPS ===');
  if (!authReady) {
    console.log('🔧 Fix authentication and organization selection');
  } else if (!components.localChanges?.available) {
    console.log('🔧 Debug LocalChanges database initialization');
  } else if (!components.liveStoreClient?.available) {
    console.log('🔧 Debug LiveStore client initialization');
  } else {
    console.log('🧪 Ready to test sync mutations');
  }
  
  console.log('========================================');
  
  // Show detailed component info if requested
  if (process.env.VERBOSE) {
    console.log('\n=== DETAILED COMPONENT INFO ===');
    console.log(JSON.stringify(syncPipelineStatus, null, 2));
  }
  
  // Test passes if we have basic auth working
  expect(authReady || orgSelected).toBe(true);
});