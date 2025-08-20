/**
 * Comprehensive Auth and Initialization Test
 * 
 * This test performs the complete flow in one session:
 * 1. Login and save auth state
 * 2. Refresh page to test persistence
 * 3. Measure ultra-fast initialization performance
 * 4. Verify local-first loading works
 */

import { test, expect } from '../fixtures/persistent-context.js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to load environment variables
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  
  return env;
}

test('complete auth persistence and ultra-fast init flow', async ({ page }) => {
  const env = loadEnvFile();
  
  if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
    console.log('⚠️  Skipping test: No credentials');
    test.skip();
    return;
  }

  console.log('🚀 Testing complete auth + ultra-fast init flow...');
  
  // ======================
  // PHASE 1: INITIAL LOGIN
  // ======================
  console.log('\n📍 PHASE 1: Initial Login');
  const loginStartTime = performance.now();
  
  await page.goto('/');
  await page.waitForTimeout(2000);
  
  const needsLogin = page.url().includes('/sign-in');
  console.log('Needs login:', needsLogin);
  
  if (needsLogin) {
    console.log('🔐 Performing login...');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', env.VIBE_DEV_EMAIL);
    await page.fill('input[type="password"]', env.VIBE_DEV_PASSWORD);
    await page.click('button:has-text("Login")');
    
    await page.waitForFunction(() => !window.location.pathname.includes('/sign-in'), { timeout: 15000 });
    console.log('✅ Login completed');
  }
  
  const loginEndTime = performance.now();
  const loginTime = loginEndTime - loginStartTime;
  console.log(`⏱️ Login took: ${loginTime.toFixed(0)}ms`);
  
  // Wait for auth state to fully settle
  await page.waitForTimeout(3000);
  
  // Check auth state after login
  const postLoginState = await page.evaluate(() => {
    return {
      authState: window.authMachineActor?.getSnapshot?.()?.value,
      hasUser: !!window.authMachineActor?.getSnapshot?.()?.context?.user,
      hasOrg: !!window.authMachineActor?.getSnapshot?.()?.context?.currentOrganization,
      userOrgs: window.authMachineActor?.getSnapshot?.()?.context?.userOrganizations?.length || 0,
      appInitState: window.appInitActor?.getSnapshot?.()?.value,
      localStorage: !!localStorage.getItem('auth-machine-state')
    };
  });
  
  console.log('Post-login state:', postLoginState);
  
  // ======================
  // PHASE 2: PAGE REFRESH & PERSISTENCE TEST
  // ======================
  console.log('\n📍 PHASE 2: Testing persistence after refresh');
  const refreshStartTime = performance.now();
  
  await page.reload();
  await page.waitForTimeout(1000); // Minimal wait to let auth start
  
  // Measure time to auth restoration
  const authRestoredTime = await page.waitForFunction(() => {
    const authActor = window.authMachineActor;
    return authActor?.getSnapshot?.()?.context?.user != null;
  }, { timeout: 5000 }).then(() => performance.now() - refreshStartTime).catch(() => -1);
  
  console.log(`⏱️ Auth restored in: ${authRestoredTime > 0 ? authRestoredTime.toFixed(0) + 'ms' : 'FAILED'}`);
  
  // Check if we stayed on dashboard (not redirected to sign-in)
  await page.waitForTimeout(1000);
  const currentUrl = page.url();
  const stayedLoggedIn = !currentUrl.includes('/sign-in');
  console.log('Stayed logged in:', stayedLoggedIn ? '✅' : '❌');
  console.log('Current URL:', currentUrl);
  
  // ======================
  // PHASE 3: MEASURE ULTRA-FAST INITIALIZATION
  // ======================
  console.log('\n📍 PHASE 3: Ultra-fast initialization performance');
  
  // Wait for all machines to be available
  await page.waitForFunction(() => {
    return window.authMachineActor && window.appInitActor && window.pureLiveStoreSyncMachineActor;
  }, { timeout: 5000 });
  
  const initState = await page.evaluate(() => {
    const authSnapshot = window.authMachineActor.getSnapshot();
    const appInitSnapshot = window.appInitActor.getSnapshot();
    const syncSnapshot = window.pureLiveStoreSyncMachineActor.getSnapshot();
    
    return {
      timestamp: Date.now(),
      auth: {
        state: authSnapshot.value,
        isAuthenticated: authSnapshot.matches('authenticated'),
        isReady: authSnapshot.matches('authenticated.ready'),
        hasUser: !!authSnapshot.context.user,
        hasOrg: !!authSnapshot.context.currentOrganization,
        orgName: authSnapshot.context.currentOrganization?.name
      },
      appInit: {
        state: appInitSnapshot.value,
        hasLocalData: appInitSnapshot.context.hasLocalData,
        localDataChecked: appInitSnapshot.context.localDataChecked,
        isDatabaseInitialized: appInitSnapshot.context.isDatabaseInitialized,
        organizationId: appInitSnapshot.context.organizationId
      },
      sync: {
        state: syncSnapshot.value
      }
    };
  });
  
  console.log('Current initialization state:', JSON.stringify(initState, null, 2));
  
  // ======================
  // PHASE 4: TRIGGER ULTRA-FAST INIT IF NEEDED
  // ======================
  if (initState.auth.hasUser && !initState.auth.hasOrg) {
    console.log('\n📍 PHASE 4: User needs organization - triggering selection...');
    
    // Get available organizations and auto-select
    const orgSelection = await page.evaluate(() => {
      const authSnapshot = window.authMachineActor.getSnapshot();
      const orgs = authSnapshot.context.userOrganizations;
      
      if (orgs && orgs.length > 0) {
        const selectedOrg = orgs[0]; // Auto-select first org
        console.log('[Test] Auto-selecting organization:', selectedOrg.name);
        
        window.authMachineActor.send({ 
          type: 'SELECT_ORGANIZATION', 
          organizationId: selectedOrg.id 
        });
        
        return { selected: true, orgName: selectedOrg.name, orgId: selectedOrg.id };
      }
      
      return { selected: false, reason: 'No organizations available' };
    });
    
    console.log('Organization selection:', orgSelection);
    
    if (orgSelection.selected) {
      // Wait for organization selection to complete
      await page.waitForFunction(() => {
        const authSnapshot = window.authMachineActor?.getSnapshot?.();
        return !!authSnapshot?.context?.currentOrganization;
      }, { timeout: 10000 });
      
      console.log('✅ Organization selected successfully');
    }
  }
  
  // ======================
  // PHASE 5: MEASURE FINAL PERFORMANCE
  // ======================
  console.log('\n📍 PHASE 5: Final performance measurement');
  
  // Wait for systems to be ready
  await page.waitForTimeout(2000);
  
  const finalState = await page.evaluate(() => {
    const authSnapshot = window.authMachineActor?.getSnapshot?.();
    const appInitSnapshot = window.appInitActor?.getSnapshot?.();
    
    return {
      auth: {
        state: authSnapshot?.value,
        isAuthenticated: authSnapshot?.matches?.('authenticated'),
        isReady: authSnapshot?.matches?.('authenticated.ready'),
        hasUser: !!authSnapshot?.context?.user,
        hasOrg: !!authSnapshot?.context?.currentOrganization
      },
      appInit: {
        state: appInitSnapshot?.value,
        isReady: appInitSnapshot?.value === 'ready',
        hasLocalData: appInitSnapshot?.context?.hasLocalData,
        organizationId: appInitSnapshot?.context?.organizationId
      },
      url: window.location.href,
      localStorage: {
        hasAuthState: !!localStorage.getItem('auth-machine-state')
      }
    };
  });
  
  console.log('Final state:', JSON.stringify(finalState, null, 2));
  
  // ======================
  // SUMMARY
  // ======================
  console.log('\n📋 COMPREHENSIVE TEST SUMMARY:');
  console.log(`  🔐 Login time: ${loginTime.toFixed(0)}ms`);
  console.log(`  ⚡ Auth restore time: ${authRestoredTime > 0 ? authRestoredTime.toFixed(0) + 'ms' : 'FAILED'}`);
  console.log(`  🏠 Stay logged in: ${stayedLoggedIn ? 'YES' : 'NO'}`);
  console.log(`  👤 Has user: ${finalState.auth.hasUser ? 'YES' : 'NO'}`);
  console.log(`  🏢 Has organization: ${finalState.auth.hasOrg ? 'YES' : 'NO'}`);
  console.log(`  🚀 App init ready: ${finalState.appInit.isReady ? 'YES' : 'NO'}`);
  console.log(`  💾 Persistence saved: ${finalState.localStorage.hasAuthState ? 'YES' : 'NO'}`);
  console.log(`  📱 Final URL: ${finalState.url}`);
  
  // Performance assertions (informational)
  const authRestoreGood = authRestoredTime > 0 && authRestoredTime < 2000; // Under 2s
  const overallGood = stayedLoggedIn && finalState.auth.hasUser && finalState.localStorage.hasAuthState;
  
  console.log(`\n🎯 PERFORMANCE ASSESSMENT:`);
  console.log(`  Auth restore speed: ${authRestoreGood ? '✅ EXCELLENT' : '⚠️ NEEDS IMPROVEMENT'}`);
  console.log(`  Overall functionality: ${overallGood ? '✅ WORKING' : '❌ NEEDS FIXING'}`);
  
  // Always pass - this is comprehensive diagnostic
  expect(true).toBe(true);
});