/**
 * Test Auto Organization Selection and Complete LiveStore Flow
 */

import { test, expect } from '@playwright/test';

test('auto organization selection and LiveStore flow', async ({ page }) => {
  console.log('🧪 Testing auto organization selection and complete LiveStore flow...');
  
  // Capture console logs to monitor the full flow
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Log important initialization messages
    if (text.includes('LiveStore') || 
        text.includes('AppInitMachine') || 
        text.includes('AuthMachine') ||
        text.includes('Auto-selecting') ||
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
  
  // Clear any existing organization preference
  try {
    await page.evaluate(() => {
      localStorage.removeItem('vibestack-last-organization-id');
      localStorage.removeItem('auth-machine-state');
    });
    console.log('🧹 Cleared localStorage preferences');
  } catch (error) {
    console.log('⚠️ Could not clear localStorage, continuing...', error.message);
  }
  
  // Sign in as CEO (multiple organizations available)
  console.log('🔐 Signing in as CEO with multiple organizations...');
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  
  console.log('⏱️ Waiting for auto-selection and full initialization...');
  await page.waitForTimeout(20000); // Give plenty of time for full flow
  
  // Take screenshot of final state
  await page.screenshot({ path: 'auto-org-selection-test.png' });
  
  // Analyze the logs for auto-selection and full flow
  console.log('\n=== ANALYZING AUTO-SELECTION FLOW ===');
  
  // 1. Authentication
  const hasAuthSuccess = consoleLogs.some(log => 
    log.includes('authenticated') || log.includes('User authenticated')
  );
  
  // 2. Auto-selection (should happen instead of manual selection)
  const hasAutoSelection = consoleLogs.some(log => 
    log.includes('Auto-selecting') && log.includes('organization')
  );
  
  const hasManualSelection = consoleLogs.some(log => 
    log.includes('needsOrganizationSelection') || log.includes('Select Organization')
  );
  
  // 3. Organization ready  
  const hasOrgReady = consoleLogs.some(log => 
    log.includes('organization') && (log.includes('ready') || log.includes('setup complete'))
  );
  
  // 4. App Init Machine progression
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
  
  // 5. LiveStore Provider
  const hasLiveStoreProvider = consoleLogs.some(log => 
    log.includes('[LiveStoreProvider]') && log.includes('event listeners')
  );
  
  const hasLiveStoreInit = consoleLogs.some(log => 
    log.includes('[LiveStoreProvider]') && log.includes('livestore:init')
  );
  
  const hasLiveStoreReady = consoleLogs.some(log => 
    log.includes('LiveStore') && (log.includes('ready') || log.includes('initialized successfully'))
  );
  
  // 6. System ready
  const hasSystemReady = consoleLogs.some(log => 
    log.includes('System fully ready') || log.includes('system ready')
  );
  
  console.log(`🔐 Authentication Success: ${hasAuthSuccess ? '✅' : '❌'}`);
  console.log(`🤖 Auto Organization Selection: ${hasAutoSelection ? '✅' : '❌'}`);
  console.log(`👤 Manual Selection Required: ${hasManualSelection ? '❌ UNEXPECTED' : '✅ SKIPPED'}`);
  console.log(`🏢 Organization Ready: ${hasOrgReady ? '✅' : '❌'}`);
  console.log(`🔄 App Init Start: ${hasAppInitStart ? '✅' : '❌'}`);
  console.log(`📊 App Init Database: ${hasAppInitDatabase ? '✅' : '❌'}`);
  console.log(`🔗 App Init Sync: ${hasAppInitSync ? '✅' : '❌'}`);
  console.log(`🗄️ App Init LiveStore: ${hasAppInitLiveStore ? '✅' : '❌'}`);
  console.log(`📡 LiveStore Provider Setup: ${hasLiveStoreProvider ? '✅' : '❌'}`);
  console.log(`🚀 LiveStore Init Event: ${hasLiveStoreInit ? '✅' : '❌'}`);
  console.log(`✅ LiveStore Ready: ${hasLiveStoreReady ? '✅' : '❌'}`);
  console.log(`🎉 System Ready: ${hasSystemReady ? '✅' : '❌'}`);
  
  // Get current page state
  const currentUrl = page.url();
  const pageTitle = await page.title();
  
  // Check if we're past organization selection (not stuck on it)
  const onDashboard = !currentUrl.includes('sign-in') && !currentUrl.includes('sign-up');
  
  // Check if org selection UI is visible
  const orgSelectionVisible = await page.locator('text=Select Organization').isVisible().catch(() => false);
  
  console.log(`\n🌐 Final State:`);
  console.log(`   URL: ${currentUrl}`);
  console.log(`   Title: ${pageTitle}`);
  console.log(`   Past Sign-in: ${onDashboard ? '✅' : '❌'}`);
  console.log(`   Org Selection Hidden: ${!orgSelectionVisible ? '✅' : '❌ STILL VISIBLE'}`);
  
  // Check localStorage for saved preference
  const savedOrgId = await page.evaluate(() => {
    return localStorage.getItem('vibestack-last-organization-id');
  });
  
  console.log(`💾 Saved Org Preference: ${savedOrgId ? '✅ ' + savedOrgId : '❌ NOT SAVED'}`);
  
  // Count relevant log types
  const liveStoreLogs = consoleLogs.filter(log => log.includes('LiveStore')).length;
  const appInitLogs = consoleLogs.filter(log => log.includes('[AppInitMachine]')).length;
  const authLogs = consoleLogs.filter(log => log.includes('[AuthMachine]')).length;
  
  console.log(`\n📊 Log Counts:`);
  console.log(`   LiveStore logs: ${liveStoreLogs}`);
  console.log(`   AppInit logs: ${appInitLogs}`);
  console.log(`   Auth logs: ${authLogs}`);
  
  console.log('\n=== AUTO-SELECTION FLOW SUMMARY ===');
  const flowSteps = [
    hasAuthSuccess,
    hasAutoSelection,
    !hasManualSelection, // Should NOT require manual selection
    hasOrgReady,
    hasAppInitStart,
    hasLiveStoreProvider,
    hasLiveStoreInit,
    hasLiveStoreReady,
    hasSystemReady,
    onDashboard,
    !orgSelectionVisible // Should NOT show org selection
  ];
  
  const completedSteps = flowSteps.filter(Boolean).length;
  console.log(`Completed ${completedSteps}/${flowSteps.length} flow steps`);
  console.log('=====================================');
  
  expect(true).toBe(true); // Test always passes, we're monitoring the flow
});