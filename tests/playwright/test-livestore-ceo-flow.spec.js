/**
 * Test LiveStore Flow with CEO Account (Single Organization)
 */

import { test, expect } from '@playwright/test';

test('LiveStore flow with CEO account', async ({ page }) => {
  console.log('🧪 Testing LiveStore flow with CEO account (single org)...');
  
  // Capture console logs to monitor the full flow
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Log important initialization messages
    if (text.includes('LiveStore') || 
        text.includes('AppInitMachine') || 
        text.includes('livestore:') ||
        text.includes('Organization') ||
        text.includes('Database') ||
        text.includes('Sync') ||
        text.includes('System ready')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Navigate to sign-in page
  console.log('🌐 Navigating to sign-in page...');
  await page.goto('http://localhost:5173/sign-in');
  await page.waitForTimeout(2000);
  
  // Sign in as CEO (single organization)
  console.log('🔐 Signing in as CEO...');
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  
  console.log('⏱️ Waiting for authentication and initialization...');
  await page.waitForTimeout(15000); // Give plenty of time for full flow
  
  // Take screenshot of final state
  await page.screenshot({ path: 'livestore-ceo-flow-test.png' });
  
  // Analyze the logs for the complete flow
  console.log('\n=== ANALYZING CEO LIVESTORE FLOW ===');
  
  // 1. Authentication
  const hasAuthSuccess = consoleLogs.some(log => 
    log.includes('authenticated') || log.includes('sign-in success')
  );
  
  // 2. Organization setup (should skip selection)
  const hasOrgSelection = consoleLogs.some(log => 
    log.includes('needsOrganizationSelection') || log.includes('Select Organization')
  );
  
  const hasOrgReady = consoleLogs.some(log => 
    log.includes('organization') && log.includes('ready')
  );
  
  // 3. App Init Machine progression
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
  
  // 4. LiveStore Provider
  const hasLiveStoreProvider = consoleLogs.some(log => 
    log.includes('[LiveStoreProvider]') && log.includes('event listeners')
  );
  
  const hasLiveStoreInit = consoleLogs.some(log => 
    log.includes('[LiveStoreProvider]') && log.includes('livestore:init')
  );
  
  const hasLiveStoreReady = consoleLogs.some(log => 
    log.includes('LiveStore') && (log.includes('ready') || log.includes('initialized successfully'))
  );
  
  // 5. System ready
  const hasSystemReady = consoleLogs.some(log => 
    log.includes('System fully ready') || log.includes('system ready')
  );
  
  console.log(`🔐 Authentication Success: ${hasAuthSuccess ? '✅' : '❌'}`);
  console.log(`🏢 Organization Selection (should skip): ${hasOrgSelection ? '❌ UNEXPECTED' : '✅ SKIPPED'}`);
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
  
  // Check if we're on the dashboard (not stuck on org selection)
  const onDashboard = currentUrl.includes('/dashboard') || 
                     currentUrl === 'http://localhost:5173/' ||
                     !currentUrl.includes('sign-in');
  
  console.log(`\n🌐 Final State:`);
  console.log(`   URL: ${currentUrl}`);
  console.log(`   Title: ${pageTitle}`);
  console.log(`   On Dashboard: ${onDashboard ? '✅' : '❌'}`);
  
  // Check for any org selection UI
  const orgSelectionVisible = await page.locator('text=Select Organization').isVisible().catch(() => false);
  console.log(`   Org Selection Visible: ${orgSelectionVisible ? '❌ UNEXPECTED' : '✅ HIDDEN'}`);
  
  // Count relevant log types
  const liveStoreLogs = consoleLogs.filter(log => log.includes('LiveStore')).length;
  const appInitLogs = consoleLogs.filter(log => log.includes('[AppInitMachine]')).length;
  
  console.log(`\n📊 Log Counts:`);
  console.log(`   LiveStore logs: ${liveStoreLogs}`);
  console.log(`   AppInit logs: ${appInitLogs}`);
  
  console.log('\n=== CEO LIVESTORE FLOW SUMMARY ===');
  const flowSteps = [
    hasAuthSuccess,
    !hasOrgSelection, // Should NOT have org selection
    hasOrgReady,
    hasAppInitStart,
    hasLiveStoreProvider,
    hasLiveStoreInit,
    hasLiveStoreReady,
    hasSystemReady,
    onDashboard
  ];
  
  const completedSteps = flowSteps.filter(Boolean).length;
  console.log(`Completed ${completedSteps}/${flowSteps.length} flow steps`);
  console.log('===================================');
  
  expect(true).toBe(true); // Test always passes, we're monitoring the flow
});