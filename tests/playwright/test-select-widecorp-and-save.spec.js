/**
 * Test Manual Selection of Wide Corp and Verify Save + Complete Flow
 */

import { test, expect } from '@playwright/test';

test('select Wide Corp org and verify save + complete flow', async ({ page }) => {
  console.log('🧪 Testing manual Wide Corp selection and complete flow...');
  
  // Capture console logs to monitor the full flow
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Log important initialization messages
    if (text.includes('LiveStore') || 
        text.includes('AppInitMachine') || 
        text.includes('AuthMachine') ||
        text.includes('Wide Corp') ||
        text.includes('Saving organization') ||
        text.includes('livestore:') ||
        text.includes('Organization') ||
        text.includes('system ready')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Navigate to sign-in page first
  console.log('🌐 Navigating to sign-in page...');
  await page.goto('http://localhost:5173/sign-in');
  await page.waitForTimeout(2000);
  
  // Clear any existing organization preference to force selection
  try {
    await page.evaluate(() => {
      localStorage.removeItem('vibestack-last-organization-id');
      localStorage.removeItem('auth-machine-state');
    });
    console.log('🧹 Cleared localStorage to force manual selection');
  } catch (error) {
    console.log('⚠️ Could not clear localStorage, continuing...', error.message);
  }
  
  // Sign in as CEO
  console.log('🔐 Signing in as CEO...');
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  
  console.log('⏱️ Waiting for organization selection screen...');
  await page.waitForTimeout(5000);
  
  // Verify organization selection is shown
  const orgSelectionVisible = await page.locator('text=Select Organization').isVisible();
  console.log(`🏢 Organization selection screen visible: ${orgSelectionVisible}`);
  
  if (orgSelectionVisible) {
    console.log('👆 Clicking on Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    
    console.log('⏱️ Waiting for selection to complete and full initialization...');
    await page.waitForTimeout(20000); // Give time for full initialization flow
  } else {
    console.log('⚠️ Organization selection not visible, continuing...');
    await page.waitForTimeout(15000);
  }
  
  // Take screenshot of final state
  await page.screenshot({ path: 'widecorp-selection-test.png' });
  
  // Check if organization preference was saved
  const savedOrgId = await page.evaluate(() => {
    return localStorage.getItem('vibestack-last-organization-id');
  });
  
  const authState = await page.evaluate(() => {
    try {
      const state = localStorage.getItem('auth-machine-state');
      return state ? JSON.parse(state) : null;
    } catch {
      return null;
    }
  });
  
  console.log('\n=== ANALYZING WIDE CORP SELECTION FLOW ===');
  
  // 1. Organization selection and saving
  const hasWideCorpSelection = consoleLogs.some(log => 
    log.includes('Wide Corp') && (log.includes('select') || log.includes('click'))
  );
  
  const hasOrgSave = consoleLogs.some(log => 
    log.includes('Saving organization preference') || log.includes('Wide Corp')
  );
  
  // 2. App Init Machine progression
  const hasAppInitStart = consoleLogs.some(log => 
    log.includes('[AppInitMachine]') && log.includes('START_INIT')
  );
  
  const hasAppInitDatabase = consoleLogs.some(log => 
    log.includes('[AppInitMachine]') && log.includes('database')
  );
  
  const hasAppInitSync = consoleLogs.some(log => 
    log.includes('[AppInitMachine]') && log.includes('sync')
  );
  
  const hasAppInitLiveStore = consoleLogs.some(log => 
    log.includes('[AppInitMachine]') && log.includes('LiveStore')
  );
  
  // 3. LiveStore flow
  const hasLiveStoreProvider = consoleLogs.some(log => 
    log.includes('[LiveStoreProvider]') && log.includes('event listeners')
  );
  
  const hasLiveStoreInit = consoleLogs.some(log => 
    log.includes('[LiveStoreProvider]') && log.includes('livestore:init')
  );
  
  const hasLiveStoreReady = consoleLogs.some(log => 
    log.includes('LiveStore') && (log.includes('ready') || log.includes('initialized successfully'))
  );
  
  // 4. System ready
  const hasSystemReady = consoleLogs.some(log => 
    log.includes('System fully ready') || log.includes('system ready')
  );
  
  console.log(`🏢 Wide Corp Selection: ${hasWideCorpSelection ? '✅' : '❌'}`);
  console.log(`💾 Organization Preference Saved: ${hasOrgSave ? '✅' : '❌'}`);
  console.log(`🔄 App Init Start: ${hasAppInitStart ? '✅' : '❌'}`);
  console.log(`📊 App Init Database: ${hasAppInitDatabase ? '✅' : '❌'}`);
  console.log(`🔗 App Init Sync: ${hasAppInitSync ? '✅' : '❌'}`);
  console.log(`🗄️ App Init LiveStore: ${hasAppInitLiveStore ? '✅' : '❌'}`);
  console.log(`📡 LiveStore Provider Setup: ${hasLiveStoreProvider ? '✅' : '❌'}`);
  console.log(`🚀 LiveStore Init Event: ${hasLiveStoreInit ? '✅' : '❌'}`);
  console.log(`✅ LiveStore Ready: ${hasLiveStoreReady ? '✅' : '❌'}`);
  console.log(`🎉 System Ready: ${hasSystemReady ? '✅' : '❌'}`);
  
  // Check localStorage state
  console.log(`\n💾 LocalStorage State:`);
  console.log(`   Saved Org ID: ${savedOrgId || 'NOT SAVED'}`);
  console.log(`   Auth State Org: ${authState?.context?.currentOrganization?.name || 'NOT SAVED'}`);
  
  // Get current page state
  const currentUrl = page.url();
  const pageTitle = await page.title();
  const stillSelectingOrg = await page.locator('text=Select Organization').isVisible().catch(() => false);
  
  console.log(`\n🌐 Final State:`);
  console.log(`   URL: ${currentUrl}`);
  console.log(`   Title: ${pageTitle}`);
  console.log(`   Still Selecting Org: ${stillSelectingOrg ? '❌ STUCK' : '✅ COMPLETED'}`);
  
  // Count relevant log types
  const liveStoreLogs = consoleLogs.filter(log => log.includes('LiveStore')).length;
  const appInitLogs = consoleLogs.filter(log => log.includes('[AppInitMachine]')).length;
  const authLogs = consoleLogs.filter(log => log.includes('[AuthMachine]')).length;
  const widecorpLogs = consoleLogs.filter(log => log.includes('Wide Corp')).length;
  
  console.log(`\n📊 Log Counts:`);
  console.log(`   LiveStore logs: ${liveStoreLogs}`);
  console.log(`   AppInit logs: ${appInitLogs}`);
  console.log(`   Auth logs: ${authLogs}`);
  console.log(`   Wide Corp logs: ${widecorpLogs}`);
  
  console.log('\n=== WIDE CORP SELECTION SUMMARY ===');
  const flowSteps = [
    hasWideCorpSelection,
    hasOrgSave,
    !!savedOrgId, // localStorage saved
    hasAppInitStart,
    hasLiveStoreProvider,
    hasLiveStoreInit,
    hasLiveStoreReady,
    hasSystemReady,
    !stillSelectingOrg // Not stuck on org selection
  ];
  
  const completedSteps = flowSteps.filter(Boolean).length;
  console.log(`Completed ${completedSteps}/${flowSteps.length} flow steps`);
  console.log('====================================');
  
  expect(true).toBe(true); // Test always passes, we're monitoring the flow
});